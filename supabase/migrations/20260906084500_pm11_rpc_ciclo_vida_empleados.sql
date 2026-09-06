-- PM11 · Personal / Empleados · P05
-- RPC transaccionales de alta, edición, baja lógica y reactivación.
-- Aplicar únicamente en QA hasta autorización expresa. Producción/main no se toca.

-- Resuelve el estado operativo del local desde la persistencia de configuración
-- existente. Soporta tanto objetos de local como colecciones JSON de locales.
create or replace function private.pm11_local_activo(
  p_empresa_id text,
  p_local_id text
) returns boolean
language sql
stable security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
  select
    nullif(btrim(p_empresa_id), '') is not null
    and nullif(btrim(p_local_id), '') is not null
    and upper(btrim(p_local_id)) not in ('TODOS', 'TODOS LOS LOCALES')
    and exists (
      select 1
        from public.almacen_kv k
       where k.empresa_id = p_empresa_id
         and k.local_id = p_local_id
         and (
           (
             jsonb_typeof(k.value) = 'object'
             and k.value->>'id' = p_local_id
             and coalesce(nullif(k.value->>'empresaId',''), p_empresa_id) = p_empresa_id
             and lower(coalesce(k.value->>'activo','true')) in ('true','1','yes','si','sí')
           )
           or
           exists (
             select 1
               from jsonb_array_elements(
                 case when jsonb_typeof(k.value) = 'array' then k.value else '[]'::jsonb end
               ) j
              where j->>'id' = p_local_id
                and coalesce(nullif(j->>'empresaId',''), p_empresa_id) = p_empresa_id
                and lower(coalesce(j->>'activo','true')) in ('true','1','yes','si','sí')
           )
         )
    );
$$;

revoke all on function private.pm11_local_activo(text, text) from public, anon, authenticated;

-- Autoridad de mutación: membresía activa + rol permitido + local concreto activo.
-- El empresa_id recibido no se confía: debe coincidir con una membresía activa del actor.
create or replace function private.pm11_puede_mutar_personal(
  p_empresa_id text,
  p_local_id text
) returns boolean
language sql
stable security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
  select private.la_usuario_activo()
     and private.pm11_local_activo(p_empresa_id, p_local_id)
     and exists (
       select 1
         from public.membresias_usuario m
        where m.user_id = auth.uid()
          and m.empresa_id = p_empresa_id
          and m.activo = true
          and (
            (m.rol = 'Propietario' and (m.todos_locales = true or m.local_id = p_local_id))
            or
            (m.rol = 'Encargado' and m.todos_locales = false and m.local_id = p_local_id)
          )
     );
$$;

revoke all on function private.pm11_puede_mutar_personal(text, text) from public, anon, authenticated;

-- Valida en backend los campos numéricos heredados de LA-017 cuando estén presentes.
-- Los campos ausentes o vacíos se dejan al contrato de defaults/compatibilidad del frontend.
create or replace function private.pm11_validar_datos_laborales(p_datos jsonb)
returns void
language plpgsql
immutable
set search_path = 'pg_catalog', 'pg_temp'
as $$
declare
  v_key text;
  v_text text;
  v_num numeric;
begin
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'empleado_datos_invalidos';
  end if;

  foreach v_key in array array[
    'horasSemanales',
    'pagas',
    'salarioBrutoMensual',
    'costeEmpresaMensual',
    'diasVacacionesAnuales'
  ] loop
    if not (p_datos ? v_key) or p_datos->v_key = 'null'::jsonb then
      continue;
    end if;

    v_text := btrim(p_datos->>v_key);
    if v_text = '' then
      continue;
    end if;

    begin
      v_num := v_text::numeric;
    exception when others then
      raise exception 'empleado_numero_no_finito:%', v_key;
    end;

    if lower(v_num::text) in ('nan','infinity','-infinity') then
      raise exception 'empleado_numero_no_finito:%', v_key;
    end if;

    if v_key = 'pagas' then
      if v_num <= 0 then
        raise exception 'empleado_valor_fuera_rango:%', v_key;
      end if;
    elsif v_num < 0 then
      raise exception 'empleado_valor_fuera_rango:%', v_key;
    end if;
  end loop;
end;
$$;

revoke all on function private.pm11_validar_datos_laborales(jsonb) from public, anon, authenticated;

create or replace function private.pm11_auditar_empleado(
  p_accion text,
  p_empleado_id text,
  p_empresa_id text,
  p_local_id text,
  p_detalle jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
declare
  v_id text := gen_random_uuid()::text;
begin
  insert into public.auditoria_registro(
    id, fecha, datos, empresa_id, local_id, actor_user_id
  ) values (
    v_id,
    current_date,
    jsonb_build_object(
      'id', v_id,
      'accion', p_accion,
      'empleadoId', p_empleado_id,
      'empresaId', p_empresa_id,
      'localId', p_local_id,
      'actorUserId', auth.uid()
    ) || coalesce(p_detalle, '{}'::jsonb),
    p_empresa_id,
    p_local_id,
    auth.uid()
  );
end;
$$;

revoke all on function private.pm11_auditar_empleado(text, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.pm11_alta_empleado(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text,
  p_nombre text,
  p_datos jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
declare
  v_empleado public.empleados%rowtype;
  v_datos jsonb;
begin
  if auth.uid() is null or not private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) then
    raise exception 'personal_contexto_no_autorizado';
  end if;
  if nullif(btrim(p_empleado_id), '') is null then
    raise exception 'empleado_id_requerido';
  end if;
  if upper(btrim(p_local_id)) in ('TODOS', 'TODOS LOS LOCALES') then
    raise exception 'personal_local_concreto_requerido';
  end if;
  if nullif(btrim(p_nombre), '') is null then
    raise exception 'empleado_nombre_requerido';
  end if;
  if exists (select 1 from public.empleados e where e.id = p_empleado_id) then
    raise exception 'empleado_id_ya_existe';
  end if;

  perform private.pm11_validar_datos_laborales(coalesce(p_datos, '{}'::jsonb));

  v_datos := coalesce(p_datos, '{}'::jsonb)
    || jsonb_build_object(
      'id', p_empleado_id,
      'empresaId', p_empresa_id,
      'localId', p_local_id,
      'nombre', btrim(p_nombre),
      'activo', true,
      'estado', 'activo'
    );

  insert into public.empleados(id, empresa_id, local_id, estado, nombre, datos)
  values (p_empleado_id, p_empresa_id, p_local_id, 'activo', btrim(p_nombre), v_datos)
  returning * into v_empleado;

  perform private.pm11_auditar_empleado(
    'Personal · alta empleado', p_empleado_id, p_empresa_id, p_local_id,
    jsonb_build_object('estadoNuevo', 'activo')
  );

  return jsonb_build_object('ok', true, 'empleado', to_jsonb(v_empleado));
end;
$$;

create or replace function public.pm11_editar_empleado(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text,
  p_cambios jsonb default '{}'::jsonb,
  p_nombre text default null
) returns jsonb
language plpgsql
security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
declare
  v_empleado public.empleados%rowtype;
  v_nombre text;
  v_datos jsonb;
  v_campos jsonb;
begin
  if auth.uid() is null or not private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) then
    raise exception 'personal_contexto_no_autorizado';
  end if;
  if p_cambios is null or jsonb_typeof(p_cambios) <> 'object' then
    raise exception 'empleado_cambios_invalidos';
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
  if v_empleado.estado <> 'activo' then
    raise exception 'empleado_no_activo';
  end if;

  v_nombre := case when p_nombre is null then v_empleado.nombre else btrim(p_nombre) end;
  if nullif(v_nombre, '') is null then
    raise exception 'empleado_nombre_requerido';
  end if;

  v_datos := v_empleado.datos || p_cambios
    || jsonb_build_object(
      'id', v_empleado.id,
      'empresaId', v_empleado.empresa_id,
      'localId', v_empleado.local_id,
      'nombre', v_nombre,
      'activo', true,
      'estado', 'activo'
    );

  perform private.pm11_validar_datos_laborales(v_datos);

  update public.empleados
     set nombre = v_nombre,
         datos = v_datos
   where id = v_empleado.id
  returning * into v_empleado;

  select coalesce(jsonb_agg(k order by k), '[]'::jsonb)
    into v_campos
    from jsonb_object_keys(p_cambios) k;

  perform private.pm11_auditar_empleado(
    'Personal · editar empleado', v_empleado.id, v_empleado.empresa_id, v_empleado.local_id,
    jsonb_build_object('campos', v_campos, 'nombreModificado', p_nombre is not null)
  );

  return jsonb_build_object('ok', true, 'empleado', to_jsonb(v_empleado));
end;
$$;

create or replace function public.pm11_baja_empleado(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text,
  p_motivo text default null
) returns jsonb
language plpgsql
security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
declare
  v_empleado public.empleados%rowtype;
begin
  if auth.uid() is null or not private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) then
    raise exception 'personal_contexto_no_autorizado';
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
  if v_empleado.estado <> 'activo' then
    raise exception 'empleado_baja_estado_invalido';
  end if;

  update public.empleados
     set estado = 'inactivo',
         baja_at = now(),
         datos = datos || jsonb_build_object('activo', false, 'estado', 'inactivo')
   where id = v_empleado.id
  returning * into v_empleado;

  perform private.pm11_auditar_empleado(
    'Personal · baja empleado', v_empleado.id, v_empleado.empresa_id, v_empleado.local_id,
    jsonb_build_object('estadoAnterior', 'activo', 'estadoNuevo', 'inactivo', 'motivoInformado', nullif(btrim(coalesce(p_motivo,'')), '') is not null)
  );

  return jsonb_build_object('ok', true, 'empleado', to_jsonb(v_empleado));
end;
$$;

create or replace function public.pm11_reactivar_empleado(
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
begin
  if auth.uid() is null or not private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) then
    raise exception 'personal_contexto_no_autorizado';
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
  if v_empleado.estado <> 'inactivo' then
    raise exception 'empleado_reactivacion_estado_invalido';
  end if;

  update public.empleados
     set estado = 'activo',
         reactivado_at = now(),
         datos = datos || jsonb_build_object('activo', true, 'estado', 'activo')
   where id = v_empleado.id
  returning * into v_empleado;

  perform private.pm11_auditar_empleado(
    'Personal · reactivar empleado', v_empleado.id, v_empleado.empresa_id, v_empleado.local_id,
    jsonb_build_object('estadoAnterior', 'inactivo', 'estadoNuevo', 'activo')
  );

  return jsonb_build_object('ok', true, 'empleado', to_jsonb(v_empleado));
end;
$$;

revoke all on function public.pm11_alta_empleado(text, text, text, text, jsonb) from public, anon;
revoke all on function public.pm11_editar_empleado(text, text, text, jsonb, text) from public, anon;
revoke all on function public.pm11_baja_empleado(text, text, text, text) from public, anon;
revoke all on function public.pm11_reactivar_empleado(text, text, text) from public, anon;

grant execute on function public.pm11_alta_empleado(text, text, text, text, jsonb) to authenticated;
grant execute on function public.pm11_editar_empleado(text, text, text, jsonb, text) to authenticated;
grant execute on function public.pm11_baja_empleado(text, text, text, text) to authenticated;
grant execute on function public.pm11_reactivar_empleado(text, text, text) to authenticated;
