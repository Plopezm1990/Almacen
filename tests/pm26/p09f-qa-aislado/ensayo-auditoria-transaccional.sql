-- Ensayo manual de QA. Ejecutar como una sola unidad; termina en ROLLBACK.
-- No contiene project refs, claves ni datos reales.
begin;
create temporary table p09f_marcas (caso text primary key, ok boolean not null, detalle text not null) on commit drop;

do $$
declare
  usuario_a uuid := gen_random_uuid();
  usuario_b uuid := gen_random_uuid();
  prefijo text := 'p09f-' || replace(gen_random_uuid()::text, '-', '');
  resultado jsonb;
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (usuario_a, 'authenticated', 'authenticated', prefijo || '-a@invalid.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (usuario_b, 'authenticated', 'authenticated', prefijo || '-b@invalid.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.empleados (id, empresa_id, local_id, estado, nombre, datos)
  values
    (prefijo || '-empleado-a', 'P09F_EMPRESA_A', 'P09F_LOCAL_A', 'activo', 'P09F QA A', '{}'::jsonb),
    (prefijo || '-empleado-b', 'P09F_EMPRESA_B', 'P09F_LOCAL_B', 'activo', 'P09F QA B', '{}'::jsonb);
  insert into public.membresias_usuario (user_id, empresa_id, local_id, todos_locales, rol, activo)
  values
    (usuario_a, 'P09F_EMPRESA_A', 'P09F_LOCAL_A', false, 'Propietario', true),
    (usuario_b, 'P09F_EMPRESA_B', 'P09F_LOCAL_B', false, 'Propietario', true);
  insert into public.perfiles (user_id, rol, empleado_id, nombre, activo)
  values
    (usuario_a, 'Propietario', prefijo || '-empleado-a', 'P09F QA A', true),
    (usuario_b, 'Propietario', prefijo || '-empleado-b', 'P09F QA B', true);

  perform set_config('request.jwt.claim.sub', usuario_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  resultado := public.registrar_auditoria(prefijo || '-permitida', 'P09F QA A', 'P09F_PRUEBA', 'acceso propio', current_date, '00:00', 'P09F_EMPRESA_A', 'P09F_LOCAL_A');
  insert into p09f_marcas values ('propietario_mismo_local', resultado is not null, 'la RPC devolvio resultado');

  begin
    perform public.registrar_auditoria(prefijo || '-cruzada-a', 'P09F QA A', 'P09F_PRUEBA', 'empresa ajena', current_date, '00:01', 'P09F_EMPRESA_B', 'P09F_LOCAL_B');
    insert into p09f_marcas values ('empresa_ajena_bloqueada', false, 'la RPC acepto empresa ajena');
  exception when others then
    insert into p09f_marcas values ('empresa_ajena_bloqueada', true, 'la RPC rechazo empresa ajena');
  end;

  perform set_config('request.jwt.claim.sub', usuario_b::text, true);
  begin
    perform public.registrar_auditoria(prefijo || '-cruzada-b', 'P09F QA B', 'P09F_PRUEBA', 'local ajeno', current_date, '00:02', 'P09F_EMPRESA_A', 'P09F_LOCAL_A');
    insert into p09f_marcas values ('local_ajeno_bloqueado', false, 'la RPC acepto local ajeno');
  exception when others then
    insert into p09f_marcas values ('local_ajeno_bloqueado', true, 'la RPC rechazo local ajeno');
  end;

  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.registrar_auditoria(prefijo || '-anonimo', 'P09F anonimo', 'P09F_PRUEBA', 'sin sesion', current_date, '00:03', 'P09F_EMPRESA_A', 'P09F_LOCAL_A');
    insert into p09f_marcas values ('sin_sesion_bloqueada', false, 'la RPC acepto una sesion ausente');
  exception when others then
    insert into p09f_marcas values ('sin_sesion_bloqueada', true, 'la RPC rechazo una sesion ausente');
  end;
end $$;

select jsonb_agg(jsonb_build_object('caso', caso, 'ok', ok, 'detalle', detalle) order by caso) from p09f_marcas;
rollback;
