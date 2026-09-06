-- PM11 · Personal / Empleados · P10
-- Anonimización irreversible y segura del empleado.
-- Aplicar únicamente en QA hasta autorización expresa. Producción/main no se toca.

create or replace function public.pm11_anonimizar_empleado(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text
) returns jsonb
language plpgsql
security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
declare
  v_empleado public.empleados%rowtype;
  v_user_id uuid;
  v_cuenta_retirada boolean := false;
  v_ahora timestamptz := now();
  v_datos_anonimos jsonb;
begin
  -- La anonimización es una operación administrativa sensible: solo Propietario
  -- activo y dentro de la empresa/local histórico del empleado.
  if auth.uid() is null
     or not private.pm11_propietario_puede_gestionar_vinculo(p_empresa_id, p_local_id) then
    raise exception 'anonimizacion_empleado_no_autorizada';
  end if;

  if nullif(btrim(p_empleado_id), '') is null then
    raise exception 'empleado_id_requerido';
  end if;
  if nullif(btrim(p_empresa_id), '') is null
     or nullif(btrim(p_local_id), '') is null
     or upper(btrim(p_local_id)) in ('TODOS', 'TODOS LOS LOCALES') then
    raise exception 'anonimizacion_contexto_invalido';
  end if;

  select * into v_empleado
    from public.empleados e
   where e.id = p_empleado_id
   for update;

  if not found then
    raise exception 'empleado_no_encontrado';
  end if;
  if v_empleado.empresa_id <> p_empresa_id or v_empleado.local_id <> p_local_id then
    raise exception 'empleado_contexto_no_coincide';
  end if;

  -- Reintento idempotente: el estado anonimizado es terminal y no genera otra auditoría.
  if v_empleado.estado = 'anonimizado' then
    return jsonb_build_object(
      'ok', true,
      'yaAnonimizado', true,
      'empleado', to_jsonb(v_empleado)
    );
  end if;

  if v_empleado.estado <> 'inactivo' then
    raise exception 'empleado_anonimizacion_requiere_baja';
  end if;

  -- Si existía una cuenta de acceso vinculada, se retira antes de anonimizar dentro
  -- de la MISMA transacción: se desactivan sus membresías, se desactiva/sanea el
  -- perfil y se elimina el vínculo. Así no queda acceso efectivo ni una referencia
  -- directa auth/perfil -> empleado anonimizado.
  select p.user_id into v_user_id
    from public.perfiles p
   where p.empleado_id = v_empleado.id
   for update;

  if v_user_id is not null then
    update public.membresias_usuario
       set activo = false,
           updated_at = now()
     where user_id = v_user_id
       and activo = true;

    update public.perfiles
       set empleado_id = null,
           activo = false,
           nombre = null,
           updated_at = now()
     where user_id = v_user_id;

    v_cuenta_retirada := true;
  end if;

  -- Whitelist deliberada de datos laborales no identificativos que pueden ser
  -- necesarios para trazabilidad histórica. Todo dato no listado (nombre, DNI/NIE,
  -- email, teléfono, dirección, PIN, documentos, ausencias con detalle, EPI, notas,
  -- foto, firma, etc.) desaparece del JSON autoritativo.
  v_datos_anonimos := jsonb_strip_nulls(jsonb_build_object(
    'id', v_empleado.id,
    'empresaId', v_empleado.empresa_id,
    'localId', v_empleado.local_id,
    'estado', 'anonimizado',
    'activo', false,
    'anonimizado', true,
    'anonimizadoAt', v_ahora,
    'historialLaboralConservado', true,
    'puesto', v_empleado.datos->'puesto',
    'departamento', v_empleado.datos->'departamento',
    'fechaAlta', v_empleado.datos->'fechaAlta',
    'fechaBaja', v_empleado.datos->'fechaBaja',
    'fechaContrato', v_empleado.datos->'fechaContrato',
    'tipoContrato', v_empleado.datos->'tipoContrato',
    'horasSemanales', v_empleado.datos->'horasSemanales',
    'pagas', v_empleado.datos->'pagas',
    'salarioBrutoMensual', v_empleado.datos->'salarioBrutoMensual',
    'costeEmpresaMensual', v_empleado.datos->'costeEmpresaMensual',
    'diasVacacionesAnuales', v_empleado.datos->'diasVacacionesAnuales',
    'vacacionesConsumidas', v_empleado.datos->'vacacionesConsumidas'
  ));

  update public.empleados
     set estado = 'anonimizado',
         nombre = null,
         anonimizado_at = v_ahora,
         datos = v_datos_anonimos
   where id = v_empleado.id
  returning * into v_empleado;

  -- La auditoría conserva únicamente identidad técnica/contexto y hechos del evento;
  -- nunca reinyecta nombre, email, DNI u otros datos personales eliminados.
  perform private.pm11_auditar_empleado(
    'Personal · anonimizar empleado',
    v_empleado.id,
    v_empleado.empresa_id,
    v_empleado.local_id,
    jsonb_build_object(
      'estadoAnterior', 'inactivo',
      'estadoNuevo', 'anonimizado',
      'cuentaAccesoRetirada', v_cuenta_retirada,
      'datosIdentificativosEliminados', true
    )
  );

  return jsonb_build_object(
    'ok', true,
    'yaAnonimizado', false,
    'cuentaAccesoRetirada', v_cuenta_retirada,
    'empleado', to_jsonb(v_empleado)
  );
end;
$$;

revoke all on function public.pm11_anonimizar_empleado(text, text, text)
  from public, anon;
grant execute on function public.pm11_anonimizar_empleado(text, text, text)
  to authenticated;

comment on function public.pm11_anonimizar_empleado(text, text, text) is
  'PM11 P10: anonimización irreversible de empleado inactivo; retira acceso vinculado, elimina PII autoritativa y conserva solo trazabilidad técnica/laboral permitida.';
