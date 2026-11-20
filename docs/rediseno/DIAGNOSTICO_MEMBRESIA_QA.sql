-- Diagnóstico de la cuenta de ensayo qa.permisos.20261116@qa.invalid
--
-- Pégalo entero en el editor SQL de Supabase, en el proyecto de QA
-- (qjqorixtkilwsndqayyx), dale a Run sin volver a tocar el texto, y cópiame el
-- resultado.
--
-- SOLO LEE. No inserta, no actualiza, no borra y no crea nada. Devuelve la forma
-- de la tabla de membresías y qué tiene esa cuenta hoy; no devuelve contraseñas,
-- ni hashes, ni tokens, ni secretos de verificación en dos pasos.
--
-- Por qué hace falta: desde el navegador no se puede ni diagnosticar. Con el rol
-- de Camarero/a y con el de Encargado, `membresias_usuario` responde «permission
-- denied», que es lo correcto —esa tabla decide quién entra y no se expone al
-- cliente—, pero deja la avería invisible. La pantalla le genera un «Local
-- principal» del lado del cliente, así que parece tener local y no lo tiene.
--
-- Comprobado antes de pasártelo: se ejecutó contra un PostgreSQL de verdad
-- (PGlite) con el esquema mínimo, en los tres casos posibles —la cuenta no
-- existe, existe sin membresía, y existe con la membresía en otro local— y
-- responde bien en los tres. Es SQL de una sola vez, así que la comprobación no
-- se ha metido en la batería de CI; queda dicho aquí que se hizo.
--
-- Nota: aquí no se usa `::regclass` a propósito, por lo mismo que en
-- VOLCAR_TARIFAS_DESDE_QA.sql: el autocompletado del editor en el móvil llegó a
-- cambiar un nombre de tabla al pegar, y esa forma revienta si el nombre no
-- existe. Todo va por nombre de texto.

with u as (
  select id, email from auth.users where email = 'qa.permisos.20261116@qa.invalid'
)
select '1 COLUMNAS membresias_usuario' as seccion,
       lpad(c.ordinal_position::text, 2, '0') || ' · ' || c.column_name
         || ' · ' || c.data_type
         || case when c.is_nullable = 'NO' then ' · not null' else '' end
         || coalesce(' · default ' || c.column_default, '') as linea
from information_schema.columns c
where c.table_schema = 'public' and c.table_name = 'membresias_usuario'

union all
select '2 LA CUENTA EXISTE',
       coalesce((select 'si · user_id ' || id::text from u), 'NO · no hay ningun usuario con ese correo')

union all
select '3 SUS MEMBRESIAS',
       'empresa ' || coalesce(m.empresa_id, '(nulo)')
         || ' · local ' || coalesce(m.local_id, '(NULO)')
         || ' · todos_locales ' || coalesce(m.todos_locales::text, '(nulo)')
         || ' · rol ' || coalesce(m.rol, '(nulo)')
         || ' · activo ' || coalesce(m.activo::text, '(nulo)')
         || ' · id ' || coalesce(m.id::text, '(nulo)')
from public.membresias_usuario m
where m.user_id = (select id from u)

union all
select '3 SUS MEMBRESIAS', 'NINGUNA · la cuenta no tiene ni una fila en membresias_usuario'
where not exists (select 1 from public.membresias_usuario m where m.user_id = (select id from u))

union all
select '4 SU PERFIL',
       'rol ' || coalesce(p.rol, '(nulo)')
         || ' · nombre ' || coalesce(p.nombre, '(nulo)')
         || ' · empleado_id ' || coalesce(p.empleado_id, '(NULO)')
         || ' · activo ' || coalesce(p.activo::text, '(nulo)')
from public.perfiles p
where p.user_id = (select id from u)

union all
select '4 SU PERFIL', 'NINGUNO · la cuenta no tiene fila en perfiles'
where not exists (select 1 from public.perfiles p where p.user_id = (select id from u))

union all
select '5 SU EMPLEADO',
       'id ' || e.id || ' · estado ' || coalesce(e.estado, '(nulo)')
from public.empleados e
where e.id in (select p.empleado_id from public.perfiles p where p.user_id = (select id from u))

union all
select '6 LOCALES DE QA-EMP-A', 'id ' || l.id || ' · nombre ' || coalesce(l.nombre, '(nulo)')
from public.locales l
where l.empresa_id = 'QA-EMP-A'

union all
-- Una membresía que sí funciona, de la misma empresa, para copiar su forma
-- exacta en la reparación en vez de deducirla. Va entre paréntesis porque un
-- `limit` suelto dentro de un `union all` se aplicaría a todo el resultado, no
-- a esta rama.
select * from (
  select '7 MODELO · otra membresia de QA-EMP-A' as seccion,
         'local ' || coalesce(m.local_id, '(NULO)')
           || ' · todos_locales ' || coalesce(m.todos_locales::text, '(nulo)')
           || ' · rol ' || coalesce(m.rol, '(nulo)')
           || ' · activo ' || coalesce(m.activo::text, '(nulo)') as linea
  from public.membresias_usuario m
  where m.empresa_id = 'QA-EMP-A'
    and m.user_id is distinct from (select id from u)
    and m.activo = true
  limit 10
) modelo

order by 1, 2;
