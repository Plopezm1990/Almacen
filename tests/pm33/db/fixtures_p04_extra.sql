-- Datos adicionales para las pruebas de P04 (revisión independiente sobre
-- P03): colisión de empleado_id + local explícito, y revocación de
-- membresía. Se cargan DESPUÉS de fixtures.sql + fixtures_p03_extra.sql;
-- no las modifican.

-- ---------------------------------------------------------------------
-- Colisión de empleado_id para el BLOQUE OBLIGATORIO (Cajero/a). Mismo
-- patrón que dup-9 (Camarero/a, en fixtures_p03_extra.sql), pero con un id
-- distinto para no interferir con esas pruebas, y usado por un rol
-- gestionado por el bloque obligatorio.
-- ---------------------------------------------------------------------
insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-A', 'loc-A', 'empleados', (
    select coalesce(k.value, '[]'::jsonb) || '[{"id":"dup-77","nombre":"SEÑUELO-A-COLISION-dup77","puesto":"Caja","rol":"Cajero/a","activo":true}]'::jsonb
    from public.almacen_kv k where k.empresa_id='emp-A' and k.local_id='loc-A' and k.key='empleados'
  ))
on conflict (empresa_id, local_id, key) do update set value = excluded.value;

insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-B', 'loc-B', 'empleados', (
    select coalesce(k.value, '[]'::jsonb) || '[{"id":"dup-77","nombre":"SEÑUELO-B-COLISION-dup77","puesto":"Caja","rol":"Cajero/a","activo":true}]'::jsonb
    from public.almacen_kv k where k.empresa_id='emp-B' and k.local_id='loc-B' and k.key='empleados'
  ))
on conflict (empresa_id, local_id, key) do update set value = excluded.value;

insert into public.perfiles (user_id, rol, empleado_id, activo) values
  ('00000000-0000-0000-0000-0000000000c0', 'Cajero/a', 'dup-77', true);
-- Sin membresía deliberadamente: solo la vía heredada, ambigua.

-- ---------------------------------------------------------------------
-- Cajero/a con membresía única en A, que pide EXPLÍCITAMENTE el local de
-- B: caso pedido en esta ronda ("un usuario con membresía válida en A que
-- intenta consultar B"), para el bloque obligatorio.
-- ---------------------------------------------------------------------
insert into public.perfiles (user_id, rol, empleado_id, activo) values
  ('00000000-0000-0000-0000-0000000000c1', 'Cajero/a', null, true);
insert into public.membresias_usuario (id, user_id, empresa_id, local_id, todos_locales, rol, activo) values
  (24, '00000000-0000-0000-0000-0000000000c1', 'emp-A', 'loc-A', false, 'Cajero/a', true);

-- ---------------------------------------------------------------------
-- Revocación de membresía -- bloque obligatorio (Cajero/a). Empleado_id
-- único (sin colisión) en almacen_kv, pero su ÚNICA membresía para esa
-- empresa/local está desactivada desde el principio (no se muta estado
-- compartido de otras pruebas). Debe quedar SIN contexto (rechazo).
-- ---------------------------------------------------------------------
insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-A', 'loc-A', 'empleados', (
    select coalesce(k.value, '[]'::jsonb) || '[{"id":"ea-11","nombre":"SEÑUELO-A-Cajero-Revocado","puesto":"Caja","rol":"Cajero/a","activo":true}]'::jsonb
    from public.almacen_kv k where k.empresa_id='emp-A' and k.local_id='loc-A' and k.key='empleados'
  ))
on conflict (empresa_id, local_id, key) do update set value = excluded.value;

insert into public.perfiles (user_id, rol, empleado_id, activo) values
  ('00000000-0000-0000-0000-0000000000c2', 'Cajero/a', 'ea-11', true);
insert into public.membresias_usuario (id, user_id, empresa_id, local_id, todos_locales, rol, activo) values
  (25, '00000000-0000-0000-0000-0000000000c2', 'emp-A', 'loc-A', false, 'Cajero/a', false);

-- ---------------------------------------------------------------------
-- Revocación de membresía -- Camarero/a (el caso exacto reproducido:
-- misma forma que camareroActivo/c4, pero con su membresía YA desactivada
-- desde el fixture, para no mutar el estado de c4 que usan T16/T18).
-- ---------------------------------------------------------------------
insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-A', 'loc-A', 'empleados', (
    select coalesce(k.value, '[]'::jsonb) || '[{"id":"ea-9","nombre":"SEÑUELO-A-Camarero-Revocado","puesto":"Sala","rol":"Camarero/a","activo":true}]'::jsonb
    from public.almacen_kv k where k.empresa_id='emp-A' and k.local_id='loc-A' and k.key='empleados'
  ))
on conflict (empresa_id, local_id, key) do update set value = excluded.value;

insert into public.perfiles (user_id, rol, empleado_id, activo) values
  ('00000000-0000-0000-0000-0000000000c8', 'Camarero/a', 'ea-9', true);
insert into public.membresias_usuario (id, user_id, empresa_id, local_id, todos_locales, rol, activo) values
  (23, '00000000-0000-0000-0000-0000000000c8', 'emp-A', 'loc-A', false, 'Camarero/a', false);

-- ---------------------------------------------------------------------
-- Usuario heredado LEGÍTIMO, sin ninguna fila de membresía (nunca migrado
-- al modelo de membresías -- a diferencia de c8, que SÍ tiene una fila,
-- pero inactiva). Debe seguir funcionando sin cambios: la comprobación de
-- revocación no debe penalizar a quien nunca tuvo membresía.
-- ---------------------------------------------------------------------
insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-A', 'loc-A', 'empleados', (
    select coalesce(k.value, '[]'::jsonb) || '[{"id":"ea-10","nombre":"SEÑUELO-A-Camarero-HeredadoLegitimo","puesto":"Sala","rol":"Camarero/a","activo":true}]'::jsonb
    from public.almacen_kv k where k.empresa_id='emp-A' and k.local_id='loc-A' and k.key='empleados'
  ))
on conflict (empresa_id, local_id, key) do update set value = excluded.value;

insert into public.perfiles (user_id, rol, empleado_id, activo) values
  ('00000000-0000-0000-0000-0000000000c9', 'Camarero/a', 'ea-10', true);
-- Sin ninguna fila de membresía, ni activa ni inactiva.
