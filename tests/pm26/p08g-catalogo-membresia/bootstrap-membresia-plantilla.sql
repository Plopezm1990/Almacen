-- PM26 P08g -- PLANTILLA de bootstrap administrativo de la membresia
-- real. NO CONTIENE NINGUN IDENTIFICADOR REAL: los 5 marcadores
-- <<...>> de abajo son huecos que TU rellenas con tus propios valores
-- reales, y ejecutas TU MISMO, con tu propio acceso administrativo,
-- en el SQL editor del proyecto de produccion (L&A Suite).
--
-- Quien preparo este archivo (esta sesion) nunca ve, pide ni recibe
-- ninguno de esos valores reales. No ejecuta este archivo. Solo lo
-- disena y lo prueba con valores sinteticos en PostgreSQL local
-- aislado (ver validar-catalogo.sh).
--
-- Orden obligatorio:
--   1. Aplica primero catalogo-empresas-locales-propuesta.sql, si aun
--      no lo has hecho -- sin el catalogo, este archivo fallara por la
--      restriccion de clave foranea de locales.empresa_id.
--   2. Sustituye los 5 marcadores de abajo por tus valores reales.
--   3. Elige la Variante A o la Variante B de la membresia (paso 3) y
--      borra o comenta la que no uses.
--   4. Ejecuta este archivo completo, de una sola vez, en el SQL
--      editor de produccion.
--   5. Ejecuta las 3 consultas de verificacion del final por separado.
--      Las tres deben devolver EXACTAMENTE 1 fila. Si alguna devuelve
--      0, algo no se aplico -- no continues hasta entenderlo.
--
-- Marcadores a sustituir:
--   <<EMPRESA_ID>>       identificador corto y estable que tu eliges,
--                        ej. 'PRINCIPAL' (sin espacios, sin acentos).
--   <<EMPRESA_NOMBRE>>   nombre visible de la empresa.
--   <<LOCAL_ID>>         identificador corto y estable del local,
--                        ej. 'CENTRAL'.
--   <<LOCAL_NOMBRE>>     nombre visible del local.
--   <<UUID_PROPIETARIO>> el user_id real de auth.users para la cuenta
--                        propietaria. Se encuentra en Supabase Studio
--                        > Authentication > Users, columna "UID".

begin;

-- 1) La empresa real.
insert into public.empresas (id, nombre, activo)
values ('<<EMPRESA_ID>>', '<<EMPRESA_NOMBRE>>', true)
on conflict (id) do nothing;

-- 2) El local real. Registralo aunque el propietario vaya a operar
--    "todos los locales" (Variante A) -- la membresia decide el
--    alcance, pero el local fisico debe existir en el catalogo.
insert into public.locales (id, empresa_id, nombre, activo)
values ('<<LOCAL_ID>>', '<<EMPRESA_ID>>', '<<LOCAL_NOMBRE>>', true)
on conflict (id) do nothing;

-- 3) La membresia real. Elige UNA variante y borra o comenta la otra.

--    Variante A -- el propietario opera TODOS los locales de la empresa:
insert into public.membresias_usuario (user_id, empresa_id, local_id, todos_locales, rol, activo)
select '<<UUID_PROPIETARIO>>', '<<EMPRESA_ID>>', null, true, 'Propietario', true
where not exists (
  select 1 from public.membresias_usuario
   where user_id = '<<UUID_PROPIETARIO>>' and empresa_id = '<<EMPRESA_ID>>'
);

--    Variante B -- el propietario opera SOLO el local del paso 2:
-- insert into public.membresias_usuario (user_id, empresa_id, local_id, todos_locales, rol, activo)
-- select '<<UUID_PROPIETARIO>>', '<<EMPRESA_ID>>', '<<LOCAL_ID>>', false, 'Propietario', true
-- where not exists (
--   select 1 from public.membresias_usuario
--    where user_id = '<<UUID_PROPIETARIO>>' and empresa_id = '<<EMPRESA_ID>>'
-- );

commit;

-- --- Verificacion (ejecutar aparte, DESPUES del commit de arriba) ---
-- Cada una debe devolver EXACTAMENTE 1 fila:
select * from public.empresas where id = '<<EMPRESA_ID>>';
select * from public.locales where id = '<<LOCAL_ID>>';
select * from public.membresias_usuario
 where user_id = '<<UUID_PROPIETARIO>>' and empresa_id = '<<EMPRESA_ID>>' and activo = true;
