-- Dato adicional para probar la corrección P02 en el caso "contexto no
-- deducible" para un rol fuera del bloque obligatorio (Camarero/a). Se
-- carga DESPUÉS de fixtures.sql; no lo modifica.
--
-- Sin membresía y con empleado_id que no existe en ningún almacen_kv:
-- best-effort ve 0 candidatos -> no acota -> cae al mismo camino sin acotar
-- que ya tenía la función vigente en PROD (empleado queda null porque el id
-- no existe en ningún sitio, pero SIN lanzar excepción, a diferencia del
-- bloque obligatorio de Encargado/Cajero/a/Churrero/a).
insert into public.perfiles (user_id, rol, empleado_id, activo) values
  ('00000000-0000-0000-0000-0000000000c3', 'Camarero/a', 'no-existe-camarero', true);
