-- Hallazgo H-36 (auditoría del TPV, 25/11/2026).
-- Las cuentas que la aplicación crea para empleados (Encargado, Cajero/a, Camarero/a...) tienen una contraseña inicial que
-- fija quien las crea, y no obligaban a cambiarla: entraron sin que nada lo pidiera y la propia pantalla decía «el empleado
-- podrá cambiarla luego». Mientras nadie la cambie, quien creó la cuenta conoce la contraseña.
--
-- El mecanismo ya existe y ya lo usa el alta de Propietario (D01, decisión 3):
--   * private.plataforma_password_pendiente guarda las cuentas con la contraseña inicial pendiente;
--   * private.plataforma_marcar_password_pendiente(uuid) la marca (lo llama plataforma_asignar_propietario);
--   * un disparador en auth.users la desmarca cuando el hash de la contraseña cambia de verdad;
--   * private.plataforma_debe_cambiar_password() hace que abc_tiene_capacidad y los filtros del almacén cierren el acceso;
--   * la pantalla «Elige tu contraseña» (plataforma-panel.js) se muestra a CUALQUIER sesión que el servidor marque pendiente.
-- Lo que faltaba es que el alta de empleado la marcara. Las dos funciones Edge de alta (crear-cuenta-empleado y
-- qa-crear-empleado) crean el usuario y llaman a public.pm11_finalizar_creacion_cuenta_empleado, así que se marca ahí, en la
-- misma transacción que crea la membresía y el perfil: o hay cuenta con marca, o no hay cuenta.
--
-- Cómo se aplica: se parchea la definición VIVA de pm11_finalizar_creacion_cuenta_empleado (sin arrastrar deriva), solo en
-- el camino de cuenta nueva (la rama «ya creada» no toca nada), es idempotente y falla en voz alta si falta una pieza.
-- No marca cuentas que ya existen: obligar a cambiar la contraseña de empleados en activo es una decisión de producto.
--
-- Contrato: tests/rediseno/h36-cuenta-empleado-password-inicial-pglite-contract.mjs

do $migracion$
declare
  v_oid oid;
  v_def text;
  v_nuevo text;
  v_n integer;

  v_ancla constant text := 'v_audit_id := gen_random_uuid()::text;';
  v_insercion constant text :=
    E'-- H-36: la contraseña inicial la conoce quien crea la cuenta; se obliga a cambiarla en el primer acceso.\n' ||
    E'  perform private.plataforma_marcar_password_pendiente(p_user_id);\n' ||
    E'  update private.plataforma_password_pendiente set motivo = ''alta_empleado'' where user_id = p_user_id;\n\n' ||
    E'  ' || v_ancla;
begin
  if to_regprocedure('private.plataforma_marcar_password_pendiente(uuid)') is null
     or to_regclass('private.plataforma_password_pendiente') is null then
    raise exception 'DEPENDENCIA_OBLIGATORIA_NO_ENCONTRADA: private.plataforma_marcar_password_pendiente (migración 20261016120000)';
  end if;

  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'pm11_finalizar_creacion_cuenta_empleado' and p.prokind = 'f';
  if v_oid is null then
    raise exception 'FUNCION_OBLIGATORIA_NO_ENCONTRADA: public.pm11_finalizar_creacion_cuenta_empleado';
  end if;
  v_def := pg_get_functiondef(v_oid);

  if position('plataforma_marcar_password_pendiente' in v_def) > 0 then
    raise notice 'H36_YA_APLICADA: la función ya marca la contraseña inicial como pendiente';
  else
    v_n := (length(v_def) - length(replace(v_def, v_ancla, ''))) / length(v_ancla);
    if v_n <> 1 then
      raise exception 'ESTRUCTURA_NO_ENCONTRADA: se esperaba exactamente una coincidencia de «%» y hay %', v_ancla, v_n;
    end if;
    v_nuevo := replace(v_def, v_ancla, v_insercion);
    execute v_nuevo;
  end if;

  -- Postcondiciones: la función conserva su forma y ahora marca.
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'pm11_finalizar_creacion_cuenta_empleado' and p.prokind = 'f';
  v_def := pg_get_functiondef(v_oid);
  if position('plataforma_marcar_password_pendiente' in v_def) = 0 then
    raise exception 'POSTCONDICION_FALLIDA: la función no marca la contraseña inicial como pendiente';
  end if;
  if not exists (select 1 from pg_proc where oid = v_oid and prosecdef) then
    raise exception 'POSTCONDICION_FALLIDA: la función dejó de ser SECURITY DEFINER';
  end if;
  if has_function_privilege('authenticated', v_oid, 'EXECUTE') or has_function_privilege('anon', v_oid, 'EXECUTE') then
    raise exception 'POSTCONDICION_FALLIDA: la función no debe ser ejecutable por authenticated ni anon';
  end if;
end
$migracion$;
