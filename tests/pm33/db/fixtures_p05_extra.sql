-- PM33 P05: colisión de identidad con estados de actividad distintos
-- entre empresas (el filtro de "activo" no debe decidir unicidad antes de
-- tiempo). Un caso por cada rol del bloque obligatorio, más el control de
-- que un usuario heredado legítimo (sin colisión) no se ve afectado.

-- Cajero/a: dup-501 existe en emp-A/loc-A (INACTIVO) y emp-B/loc-B
-- (activo). Membresía real SOLO en A.
insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-A', 'loc-A', 'empleados', (
    select coalesce(k.value, '[]'::jsonb) || '[{"id":"dup-501","nombre":"SEÑUELO-A-COLISION-Cajero","puesto":"Caja","rol":"Cajero/a","activo":false}]'::jsonb
    from public.almacen_kv k where k.empresa_id='emp-A' and k.local_id='loc-A' and k.key='empleados'
  ))
on conflict (empresa_id, local_id, key) do update set value = excluded.value;
insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-B', 'loc-B', 'empleados', (
    select coalesce(k.value, '[]'::jsonb) || '[{"id":"dup-501","nombre":"SEÑUELO-B-COLISION-Cajero","puesto":"Caja","rol":"Cajero/a","activo":true}]'::jsonb
    from public.almacen_kv k where k.empresa_id='emp-B' and k.local_id='loc-B' and k.key='empleados'
  ))
on conflict (empresa_id, local_id, key) do update set value = excluded.value;
insert into public.perfiles (user_id, rol, empleado_id, activo) values
  ('00000000-0000-0000-0000-0000000000d1', 'Cajero/a', 'dup-501', true);
insert into public.membresias_usuario (id, user_id, empresa_id, local_id, todos_locales, rol, activo) values
  (30, '00000000-0000-0000-0000-0000000000d1', 'emp-A', 'loc-A', false, 'Cajero/a', true);

-- Encargado: dup-502, mismo patrón.
insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-A', 'loc-A', 'empleados', (
    select coalesce(k.value, '[]'::jsonb) || '[{"id":"dup-502","nombre":"SEÑUELO-A-COLISION-Encargado","puesto":"Encargado","rol":"Encargado","activo":false}]'::jsonb
    from public.almacen_kv k where k.empresa_id='emp-A' and k.local_id='loc-A' and k.key='empleados'
  ))
on conflict (empresa_id, local_id, key) do update set value = excluded.value;
insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-B', 'loc-B', 'empleados', (
    select coalesce(k.value, '[]'::jsonb) || '[{"id":"dup-502","nombre":"SEÑUELO-B-COLISION-Encargado","puesto":"Encargado","rol":"Encargado","activo":true}]'::jsonb
    from public.almacen_kv k where k.empresa_id='emp-B' and k.local_id='loc-B' and k.key='empleados'
  ))
on conflict (empresa_id, local_id, key) do update set value = excluded.value;
insert into public.perfiles (user_id, rol, empleado_id, activo) values
  ('00000000-0000-0000-0000-0000000000d2', 'Encargado', 'dup-502', true);
insert into public.membresias_usuario (id, user_id, empresa_id, local_id, todos_locales, rol, activo) values
  (31, '00000000-0000-0000-0000-0000000000d2', 'emp-A', 'loc-A', false, 'Encargado', true);

-- Churrero/a: dup-503, mismo patrón.
insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-A', 'loc-A', 'empleados', (
    select coalesce(k.value, '[]'::jsonb) || '[{"id":"dup-503","nombre":"SEÑUELO-A-COLISION-Churrero","puesto":"Obrador","rol":"Churrero/a","activo":false}]'::jsonb
    from public.almacen_kv k where k.empresa_id='emp-A' and k.local_id='loc-A' and k.key='empleados'
  ))
on conflict (empresa_id, local_id, key) do update set value = excluded.value;
insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-B', 'loc-B', 'empleados', (
    select coalesce(k.value, '[]'::jsonb) || '[{"id":"dup-503","nombre":"SEÑUELO-B-COLISION-Churrero","puesto":"Obrador","rol":"Churrero/a","activo":true}]'::jsonb
    from public.almacen_kv k where k.empresa_id='emp-B' and k.local_id='loc-B' and k.key='empleados'
  ))
on conflict (empresa_id, local_id, key) do update set value = excluded.value;
insert into public.perfiles (user_id, rol, empleado_id, activo) values
  ('00000000-0000-0000-0000-0000000000d3', 'Churrero/a', 'dup-503', true);
insert into public.membresias_usuario (id, user_id, empresa_id, local_id, todos_locales, rol, activo) values
  (32, '00000000-0000-0000-0000-0000000000d3', 'emp-A', 'loc-A', false, 'Churrero/a', true);
