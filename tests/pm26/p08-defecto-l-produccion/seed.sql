-- PM26 P08 -- fixtures para la bateria de comportamiento. Todo
-- sintetico, ningun dato ni identidad real.

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'), -- Propietario A, todos_locales
  ('22222222-2222-2222-2222-222222222222'), -- Propietario A, solo LOCAL_A1
  ('33333333-3333-3333-3333-333333333333'), -- Encargado A/LOCAL_A1 (no Propietario)
  ('44444444-4444-4444-4444-444444444444'), -- Propietario B, todos_locales
  ('55555555-5555-5555-5555-555555555555'); -- Propietario A/LOCAL_A1 pero perfil inactivo

insert into public.membresias_usuario (user_id, empresa_id, local_id, todos_locales, rol, activo) values
  ('11111111-1111-1111-1111-111111111111', 'EMPRESA_A', null, true, 'Propietario', true),
  ('22222222-2222-2222-2222-222222222222', 'EMPRESA_A', 'LOCAL_A1', false, 'Propietario', true),
  ('33333333-3333-3333-3333-333333333333', 'EMPRESA_A', 'LOCAL_A1', false, 'Encargado', true),
  ('44444444-4444-4444-4444-444444444444', 'EMPRESA_B', null, true, 'Propietario', true),
  ('55555555-5555-5555-5555-555555555555', 'EMPRESA_A', 'LOCAL_A1', false, 'Propietario', true);

insert into public.perfiles (user_id, rol, activo) values
  ('11111111-1111-1111-1111-111111111111', 'Propietario', true),
  ('22222222-2222-2222-2222-222222222222', 'Propietario', true),
  ('33333333-3333-3333-3333-333333333333', 'Básico', true),
  ('44444444-4444-4444-4444-444444444444', 'Propietario', true),
  ('55555555-5555-5555-5555-555555555555', 'Propietario', false);
