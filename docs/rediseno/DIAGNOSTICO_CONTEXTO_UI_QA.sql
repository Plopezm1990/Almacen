-- Diagnóstico del contexto de empresa/local de la cuenta restringida
-- qa.permisos.20261116@qa.invalid en QA (qjqorixtkilwsndqayyx).
--
-- Pégalo entero en el editor SQL de QA, dale a Run sin volver a tocar el texto
-- y cópiame el resultado.
--
-- SOLO LEE. No inserta, no actualiza, no borra y no crea nada. No devuelve
-- contraseñas, hashes, tokens ni secretos de verificación en dos pasos.
--
-- QUÉ PREGUNTA, Y POR QUÉ
--
-- El 20/11 se comprobó que la membresía de esa cuenta es correcta
-- (`id=221`, QA-EMP-A / QA-A1 / todos_locales=false / Camarero/a). Aun así, al
-- entrar en el Deploy Preview #225 con una sesión limpia, la pantalla le ofrece
-- un local inventado por el cliente —«Local principal», con un identificador
-- generado en el navegador (`mwp0e1ua2qbqk0` en la sesión del 20/11)— en lugar
-- de «Local A1», y la consola deja este error:
--
--   Error guardando localActivoId Error: Local no autorizado para esta cuenta
--     at window.storage.set (ui-context-bridge.js:151)
--     at async saveKey (fuente.js:101807)
--     at async (fuente.js:105639)
--
-- La cadena, leída en el código, es ésta:
--   1. `empresas`, `locales` y `localActivoId` se leen SOLO de localStorage
--      (ui-context-bridge.js, `CLAVES_CONTEXTO`): nunca se piden al servidor al
--      leer. Quien las deja escritas es la semilla del arranque,
--      `__laOwnerBootstrapSeedUiContext`, que se alimenta de la RPC
--      `obtener_contexto_instalacion_ui`.
--   2. Si esa semilla no llega a escribir, en un dispositivo nuevo la lista de
--      locales se lee vacía.
--   3. Con la lista vacía y cualquier dato operativo presente, fuente.js:105556
--      —una ruta de migración de instalaciones antiguas de un solo local—
--      INVENTA un local: `{ id: uid(), nombre: "Local principal" }`.
--   4. Acto seguido intenta persistirlo (fuente.js:105639) y el puente lo
--      rechaza, correctamente, porque ese local no es de la cuenta.
--
-- Falta saber por qué la semilla no escribe. La RPC
-- `obtener_contexto_instalacion_ui` (20260915043000_ui_context_bridge.sql) tiene
-- dos puntos por los que puede negarse, y los dos exigen `activo = true`:
--
--   v_empresa_principal → join `empresas e on e.id = m.empresa_id and e.activo = true`
--   v_local_activo      → join `locales l on ... and l.activo = true`
--   y después: `if v_empresa_principal is null or v_local_activo is null then
--                 raise exception 'Contexto empresarial incompleto'`
--
-- Es decir: si QA-EMP-A o QA-A1 tuvieran `activo = false`, la RPC lanzaría
-- excepción, la semilla no escribiría nada y saldría exactamente el síntoma
-- observado. El volcado de membresías del 20/11 no lo descarta porque pedía el
-- nombre del local, no su `activo`.
--
-- Esta consulta emula los tres `select` de la RPC con el `user_id` fijo de esa
-- cuenta y dice, en la última sección, cuál de las dos negativas se dispararía.
-- Si ninguna, la causa está en otro sitio (generación de instalación) y lo dirá.
--
-- Nota: sin `::regclass`, por lo mismo que en los otros volcados: el
-- autocompletado del editor en el móvil llegó a cambiar un nombre de tabla al
-- pegar, y esa forma revienta si el nombre no existe. Todo por nombre de texto.
--
-- Comprobado antes de pasártelo: se ejecutó contra un PostgreSQL de verdad
-- (PGlite) con el esquema mínimo, en tres casos —todo activo, empresa
-- desactivada y local desactivado— y el veredicto sale bien en los tres. Es SQL
-- de una sola vez, así que no está en la batería de CI; queda dicho aquí.

with u as (
  select id from auth.users where email = 'qa.permisos.20261116@qa.invalid'
)

-- 1. Qué columnas tienen de verdad las dos tablas que la RPC consulta.
select '1 COLUMNAS empresas' as seccion,
       lpad(c.ordinal_position::text, 2, '0') || ' · ' || c.column_name
         || ' · ' || c.data_type as linea
from information_schema.columns c
where c.table_schema = 'public' and c.table_name = 'empresas'

union all
select '2 COLUMNAS locales',
       lpad(c.ordinal_position::text, 2, '0') || ' · ' || c.column_name
         || ' · ' || c.data_type
from information_schema.columns c
where c.table_schema = 'public' and c.table_name = 'locales'

-- 3. La empresa, con su `activo`, que es el dato que faltaba.
union all
select '3 EMPRESA QA-EMP-A',
       'id ' || e.id || ' · nombre ' || coalesce(e.nombre, '(nulo)')
         || ' · activo ' || coalesce(e.activo::text, '(nulo)')
from public.empresas e
where e.id = 'QA-EMP-A'

union all
select '3 EMPRESA QA-EMP-A', 'NO EXISTE ninguna empresa con id QA-EMP-A'
where not exists (select 1 from public.empresas e where e.id = 'QA-EMP-A')

-- 4. Los locales de esa empresa, con su `activo`.
union all
select '4 LOCALES DE QA-EMP-A',
       'id ' || l.id || ' · nombre ' || coalesce(l.nombre, '(nulo)')
         || ' · activo ' || coalesce(l.activo::text, '(nulo)')
from public.locales l
where l.empresa_id = 'QA-EMP-A'

-- 5. Emulación de `v_empresa_principal`: el primer select de la RPC, tal cual.
union all
select '5 RPC v_empresa_principal',
       coalesce((
         select m.empresa_id
         from public.membresias_usuario m
         join public.empresas e on e.id = m.empresa_id and e.activo = true
         where m.user_id = (select id from u) and m.activo = true
         order by m.created_at, m.id
         limit 1
       ), 'NULO ← aqui se rompe: ninguna membresia activa apunta a una empresa activa')

-- 6. Emulación de `v_local_activo`: el tercer select de la RPC, tal cual.
union all
select '6 RPC v_local_activo',
       coalesce((
         select l.id
         from public.membresias_usuario m
         join public.locales l
           on l.empresa_id = m.empresa_id
          and l.activo = true
          and (m.todos_locales = true or l.id = m.local_id)
         where m.user_id = (select id from u) and m.activo = true
         order by m.created_at, l.created_at, l.id
         limit 1
       ), 'NULO ← aqui se rompe: la membresia no alcanza ningun local ACTIVO')

-- 7. Emulación de `v_locales`: la lista que la UI acabaría mostrando. Ojo: este
--    select de la RPC NO filtra por `activo`, a diferencia de los otros dos.
union all
select '7 RPC v_locales (lista para la UI)',
       'id ' || l.id || ' · activo ' || coalesce(l.activo::text, '(nulo)')
from public.membresias_usuario m
join public.locales l
  on l.empresa_id = m.empresa_id
 and (m.todos_locales = true or l.id = m.local_id)
where m.user_id = (select id from u) and m.activo = true

union all
select '7 RPC v_locales (lista para la UI)',
       'VACIA ← la UI recibiria cero locales'
where not exists (
  select 1 from public.membresias_usuario m
  join public.locales l
    on l.empresa_id = m.empresa_id
   and (m.todos_locales = true or l.id = m.local_id)
  where m.user_id = (select id from u) and m.activo = true
)

-- 8. La generación de instalación que tiene el servidor. La semilla del
--    arranque se niega si no coincide con la del navegador
--    (`localStorage['la_suite_installation_generation_v1']`), así que conviene
--    tenerla para compararla.
union all
select '8 GENERACION DEL SERVIDOR',
       'generation ' || coalesce(i.generation, '(nulo)')
from private.la_instalacion_estado i
where i.singleton = true

-- 9. El veredicto, dicho en una línea.
union all
select '9 VEREDICTO', case
  when not exists (select 1 from u)
    then 'La cuenta no existe. Nada de lo anterior aplica.'
  when (select m.empresa_id
          from public.membresias_usuario m
          join public.empresas e on e.id = m.empresa_id and e.activo = true
         where m.user_id = (select id from u) and m.activo = true
         order by m.created_at, m.id limit 1) is null
    then 'CONFIRMADO: la RPC lanza «Contexto empresarial incompleto» por la EMPRESA. '
      || 'QA-EMP-A no esta activa o la membresia no la alcanza. La semilla no escribe '
      || 'y el cliente inventa «Local principal». Arreglo en datos: reactivar la empresa.'
  when (select l.id
          from public.membresias_usuario m
          join public.locales l
            on l.empresa_id = m.empresa_id and l.activo = true
           and (m.todos_locales = true or l.id = m.local_id)
         where m.user_id = (select id from u) and m.activo = true
         order by m.created_at, l.created_at, l.id limit 1) is null
    then 'CONFIRMADO: la RPC lanza «Contexto empresarial incompleto» por el LOCAL. '
      || 'QA-A1 existe pero con activo=false, o la membresia no alcanza ningun local activo. '
      || 'La semilla no escribe y el cliente inventa «Local principal». '
      || 'Arreglo en datos: reactivar QA-A1.'
  else 'DESCARTADO: la RPC devuelve empresa y local, asi que no se niega por ahi. '
      || 'La causa esta en otro sitio: lo siguiente a mirar es la generacion de '
      || 'instalacion (seccion 8 frente a la del navegador) y, si tambien cuadra, '
      || 'la invencion de fuente.js:105556, que no debe ocurrir cuando el servidor manda.'
end

order by 1, 2;
