-- Datos de prueba: 2 empresas, 2 usuarios, con y sin membresia activa.
set search_path to public;

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333');

insert into public.perfiles (user_id, rol, activo) values
  ('11111111-1111-1111-1111-111111111111', 'Propietario', true),
  ('22222222-2222-2222-2222-222222222222', 'Encargado', true),
  ('33333333-3333-3333-3333-333333333333', 'Básico', false);

insert into public.membresias_usuario (user_id, empresa_id, local_id, todos_locales, rol, activo) values
  ('11111111-1111-1111-1111-111111111111', 'EMPRESA_A', null, true, 'Propietario', true),
  ('22222222-2222-2222-2222-222222222222', 'EMPRESA_B', 'LOCAL_B1', false, 'Encargado', true),
  ('33333333-3333-3333-3333-333333333333', 'EMPRESA_A', 'LOCAL_A1', false, 'Básico', true);

insert into public.suscripciones_push (endpoint, p256dh, auth, user_id) values
  ('ep-user1', 'p1', 'a1', '11111111-1111-1111-1111-111111111111'),
  ('ep-user2', 'p2', 'a2', '22222222-2222-2222-2222-222222222222');

insert into public.stock_operaciones (operation_id) values ('op-1'), ('op-2');
insert into public.movimientos_stock (operation_id, tipo, empresa_id, local_id, producto_id, actor_user_id) values
  ('op-1', 'VENTA', 'EMPRESA_A', 'LOCAL_A1', 'prod-1', '11111111-1111-1111-1111-111111111111'),
  ('op-2', 'VENTA', 'EMPRESA_B', 'LOCAL_B1', 'prod-2', '22222222-2222-2222-2222-222222222222');

insert into public.auditoria_registro (id, fecha, actor_user_id) values
  ('aud-1', current_date, '11111111-1111-1111-1111-111111111111'),
  ('aud-2', current_date, '22222222-2222-2222-2222-222222222222');

insert into public.pagos_encargo (id, operation_id, encargo_id, empresa_id, local_id) values
  ('pago-1', 'op-pago-1', 'enc-1', 'EMPRESA_A', 'LOCAL_A1');
insert into public.pagos_encargo (id, operation_id, encargo_id, empresa_id, local_id, revierte_pago_id) values
  ('pago-2', 'op-pago-2', 'enc-1', 'EMPRESA_A', 'LOCAL_A1', 'pago-1');
