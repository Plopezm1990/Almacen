-- Datos de prueba: 2 empresas, locales activos en almacen_kv, y
-- usuarios con distintos roles/membresias.
set search_path to public;

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'), -- Propietario EMPRESA_A, todos_locales
  ('22222222-2222-2222-2222-222222222222'), -- Encargado EMPRESA_A/LOCAL_A1
  ('33333333-3333-3333-3333-333333333333'), -- Básico EMPRESA_A/LOCAL_A1 (no gestion)
  ('44444444-4444-4444-4444-444444444444'); -- Propietario EMPRESA_B

insert into public.perfiles (user_id, rol, activo) values
  ('11111111-1111-1111-1111-111111111111', 'Propietario', true),
  ('22222222-2222-2222-2222-222222222222', 'Encargado', true),
  ('33333333-3333-3333-3333-333333333333', 'Básico', true),
  ('44444444-4444-4444-4444-444444444444', 'Propietario', true);

insert into public.membresias_usuario (user_id, empresa_id, local_id, todos_locales, rol, activo) values
  ('11111111-1111-1111-1111-111111111111', 'EMPRESA_A', null, true, 'Propietario', true),
  ('22222222-2222-2222-2222-222222222222', 'EMPRESA_A', 'LOCAL_A1', false, 'Encargado', true),
  ('33333333-3333-3333-3333-333333333333', 'EMPRESA_A', 'LOCAL_A1', false, 'Básico', true),
  ('44444444-4444-4444-4444-444444444444', 'EMPRESA_B', null, true, 'Propietario', true);

insert into public.almacen_kv (key, value, empresa_id, local_id) values
  ('local::EMPRESA_A::LOCAL_A1', '{"id":"LOCAL_A1","empresaId":"EMPRESA_A","activo":true}'::jsonb, 'EMPRESA_A', 'LOCAL_A1'),
  ('local::EMPRESA_A::LOCAL_A2', '{"id":"LOCAL_A2","empresaId":"EMPRESA_A","activo":true}'::jsonb, 'EMPRESA_A', 'LOCAL_A2'),
  ('local::EMPRESA_B::LOCAL_B1', '{"id":"LOCAL_B1","empresaId":"EMPRESA_B","activo":true}'::jsonb, 'EMPRESA_B', 'LOCAL_B1');
