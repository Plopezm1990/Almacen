-- Datos adicionales para las pruebas específicas de aislamiento de
-- Camarero/a pedidas en la revisión de cierre (P03). Se cargan DESPUÉS de
-- fixtures.sql (y son independientes de fixtures_p02_extra.sql); no
-- modifican ninguno de los dos.

-- ---------------------------------------------------------------------
-- C4: Camarero/a ACTIVO legítimo, con membresía propia inequívoca. A
-- diferencia del usuario de T14 (empleado_id 'ea-4', marcado
-- deliberadamente INACTIVO en fixtures.sql para probar que no se filtra
-- por bajas), este es el caso funcional normal: un Camarero/a activo que
-- debe seguir viendo su propio registro tras el parche.
-- ---------------------------------------------------------------------
insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-A', 'loc-A', 'empleados', (
    select coalesce(k.value, '[]'::jsonb) || '[{"id":"ea-6","nombre":"SEÑUELO-A-Camarero-Activo-Hugo","puesto":"Sala","rol":"Camarero/a","activo":true}]'::jsonb
    from public.almacen_kv k where k.empresa_id='emp-A' and k.local_id='loc-A' and k.key='empleados'
  ))
on conflict (empresa_id, local_id, key) do update set value = excluded.value;

insert into public.perfiles (user_id, rol, empleado_id, activo) values
  ('00000000-0000-0000-0000-0000000000c4', 'Camarero/a', 'ea-6', true);
insert into public.membresias_usuario (id, user_id, empresa_id, local_id, todos_locales, rol, activo) values
  (20, '00000000-0000-0000-0000-0000000000c4', 'emp-A', 'loc-A', false, 'Camarero/a', true);

-- ---------------------------------------------------------------------
-- C5: empleado_id DUPLICADO entre dos empresas distintas (colisión real,
-- sin membresía que desambigüe). El contexto es ambiguo por diseño: dos
-- candidatos vía almacen_kv, ninguno por membresía.
-- ---------------------------------------------------------------------
insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-A', 'loc-A', 'empleados', (
    select coalesce(k.value, '[]'::jsonb) || '[{"id":"dup-9","nombre":"SEÑUELO-A-COLISION-dup9","puesto":"Sala","rol":"Camarero/a","activo":true}]'::jsonb
    from public.almacen_kv k where k.empresa_id='emp-A' and k.local_id='loc-A' and k.key='empleados'
  ))
on conflict (empresa_id, local_id, key) do update set value = excluded.value;

insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-B', 'loc-B', 'empleados', (
    select coalesce(k.value, '[]'::jsonb) || '[{"id":"dup-9","nombre":"SEÑUELO-B-COLISION-dup9","puesto":"Sala","rol":"Camarero/a","activo":true}]'::jsonb
    from public.almacen_kv k where k.empresa_id='emp-B' and k.local_id='loc-B' and k.key='empleados'
  ))
on conflict (empresa_id, local_id, key) do update set value = excluded.value;

insert into public.perfiles (user_id, rol, empleado_id, activo) values
  ('00000000-0000-0000-0000-0000000000c5', 'Camarero/a', 'dup-9', true);
-- Sin membresía deliberadamente.

-- ---------------------------------------------------------------------
-- C6: empleado_id que solo "resolvería" vía una membresía INACTIVA (no
-- existe en ningún almacen_kv). Si el código contase membresías inactivas
-- como candidato, este usuario obtendría contexto indebido.
-- ---------------------------------------------------------------------
insert into public.perfiles (user_id, rol, empleado_id, activo) values
  ('00000000-0000-0000-0000-0000000000c6', 'Camarero/a', 'ea-7', true);
insert into public.membresias_usuario (id, user_id, empresa_id, local_id, todos_locales, rol, activo) values
  (21, '00000000-0000-0000-0000-0000000000c6', 'emp-A', 'loc-A', false, 'Camarero/a', false);

-- ---------------------------------------------------------------------
-- C7: contexto que SÍ resuelve de forma inequívoca (una única membresía
-- activa), pero apunta a una empresa/local dados de baja (emp-C-baja /
-- loc-C-baja, ya definidos e inactivos en fixtures.sql). Debe tratarse
-- igual que "no resuelto": sin dato, sin excepción.
-- ---------------------------------------------------------------------
insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-C-baja', 'loc-C-baja', 'empleados', (
    select coalesce(k.value, '[]'::jsonb) || '[{"id":"ea-8","nombre":"SEÑUELO-C-Camarero-Baja","puesto":"Sala","rol":"Camarero/a","activo":true}]'::jsonb
    from public.almacen_kv k where k.empresa_id='emp-C-baja' and k.local_id='loc-C-baja' and k.key='empleados'
  ))
on conflict (empresa_id, local_id, key) do update set value = excluded.value;

insert into public.perfiles (user_id, rol, empleado_id, activo) values
  ('00000000-0000-0000-0000-0000000000c7', 'Camarero/a', 'ea-8', true);
insert into public.membresias_usuario (id, user_id, empresa_id, local_id, todos_locales, rol, activo) values
  (22, '00000000-0000-0000-0000-0000000000c7', 'emp-C-baja', 'loc-C-baja', false, 'Camarero/a', true);
