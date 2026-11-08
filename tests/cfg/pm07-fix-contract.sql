-- PM-07 · contrato vivo de la corrección de `private.pm07_numero_catalogo` (migración 20261003130000).
--
-- Se ejecuta dentro de una transacción que termina en ROLLBACK (lo hace tests/cfg/pm07-fix-run.sh):
--
--   begin; <este archivo>; select <resumen de la.log>; rollback;
--
-- No depende de datos: crea dentro de la transacción la función tal como está en PRODUCCIÓN (borrador SIN la barra invertida en la expresión regular,
-- texto observado el 3/10/2026), comprueba el defecto, aplica la migración (las líneas `\i` de abajo; para ejecutarlo sin psql se sustituyen esas líneas
-- por el contenido del archivo) y comprueba el resultado. Todo se revierte con el ROLLBACK. Solo necesita el esquema `private` y el rol `authenticated`.
--
-- Estructura:
--   HELPERS · ANTES (la función como está en producción y su defecto) · MIGRACION (\i) · DESPUES (la función corregida y lo que se conserva) · REPETICION

-- ==== HELPERS ====
select set_config('la.log', '[]', true);

create function pg_temp.log(p_paso text, p_res text, p_det jsonb default null) returns void language plpgsql as $f$
begin
  perform set_config('la.log', (coalesce(nullif(current_setting('la.log', true), ''), '[]')::jsonb
    || jsonb_build_array(jsonb_build_object('paso', p_paso, 'res', p_res, 'det', p_det)))::text, true);
end $f$;

create function pg_temp.ok(p_nombre text, p_cond boolean, p_det jsonb default null) returns void language plpgsql as $f$
begin
  perform pg_temp.log(p_nombre, case when coalesce(p_cond, false) then 'OK' else 'FALLA' end, p_det);
end $f$;

-- Llama a la función con un texto y devuelve el resultado o el código de error (SQLSTATE) como texto.
create function pg_temp.valor(p_valor text, p_defecto numeric default 0) returns text language plpgsql as $f$
begin
  return private.pm07_numero_catalogo(p_valor, p_defecto)::text;
exception when others then
  return 'ERROR:' || sqlstate;
end $f$;

-- Huella md5 del cuerpo de la función (plpgsql: se resuelve al ejecutar, no al crear).
create function pg_temp.huella() returns text language plpgsql as $f$
declare v text;
begin
  select md5(replace(p.prosrc, chr(13), '')) into v from pg_proc p where p.oid = to_regprocedure('private.pm07_numero_catalogo(text,numeric)');
  return v;
end $f$;

create function pg_temp.acl() returns text language plpgsql as $f$
declare v text;
begin
  select coalesce(p.proacl::text, 'NULO') into v from pg_proc p where p.oid = to_regprocedure('private.pm07_numero_catalogo(text,numeric)');
  return v;
end $f$;

-- ==== ANTES ====
-- La función tal como está en producción (md5 3dcbe27249f1fd2d37c40ea6398d0215): el punto de la expresión regular SIN escapar.
create or replace function private.pm07_numero_catalogo(p_valor text, p_defecto numeric default 0)
returns numeric
language plpgsql
immutable
set search_path='pg_catalog','pg_temp'
as $$
begin
  if coalesce(btrim(p_valor),'') ~ '^[0-9]+(.[0-9]+)?$' then
    return greatest(0, p_valor::numeric);
  end if;
  return greatest(0, coalesce(p_defecto,0));
end;
$$;

-- Se le da un permiso conocido para comprobar después que la migración lo conserva.
revoke all on function private.pm07_numero_catalogo(text,numeric) from public;
grant execute on function private.pm07_numero_catalogo(text,numeric) to authenticated;
select set_config('la.acl_antes', pg_temp.acl(), true);

select pg_temp.ok('A1 la función de partida es exactamente la de producción (md5 del borrador)', pg_temp.huella() = '3dcbe27249f1fd2d37c40ea6398d0215', jsonb_build_object('md5', pg_temp.huella()));
select pg_temp.ok('A2 el defecto se reproduce: «1,5» lanza un error de conversión (22P02) en lugar de devolver el valor por defecto', pg_temp.valor('1,5') = 'ERROR:22P02', jsonb_build_object('res', pg_temp.valor('1,5')));
select pg_temp.ok('A3 el defecto también con otros separadores: «1x5» y «1 5» lanzan 22P02', pg_temp.valor('1x5') = 'ERROR:22P02' and pg_temp.valor('1 5') = 'ERROR:22P02', null);
select pg_temp.ok('A4 con números normales funciona: 12 → 12, 12.5 → 12.5, 0.25 → 0.25', pg_temp.valor('12') = '12' and pg_temp.valor('12.5') = '12.5' and pg_temp.valor('0.25') = '0.25', null);
select pg_temp.ok('A5 el permiso de partida es conocido (authenticated puede ejecutar; es distinto de nulo)', pg_temp.acl() <> 'NULO' and has_function_privilege('authenticated', 'private.pm07_numero_catalogo(text,numeric)', 'execute'), jsonb_build_object('acl', pg_temp.acl()));

-- ==== MIGRACION ====
\i supabase/migrations/20261003130000_abc_pm07_correccion_numero_catalogo.sql

-- ==== DESPUES ====
select pg_temp.ok('B1 la función queda con el cuerpo correcto (md5 7f36af3c791b2d94a2c76aed2ee4a095, el del archivo de PM07 y de QA)', pg_temp.huella() = '7f36af3c791b2d94a2c76aed2ee4a095', jsonb_build_object('md5', pg_temp.huella()));
select pg_temp.ok('B2 «1,5», «1x5» y «1 5» ya no lanzan error: devuelven el valor por defecto (0)', pg_temp.valor('1,5') = '0' and pg_temp.valor('1x5') = '0' and pg_temp.valor('1 5') = '0', jsonb_build_object('a', pg_temp.valor('1,5'), 'b', pg_temp.valor('1x5'), 'c', pg_temp.valor('1 5')));
select pg_temp.ok('B3 con un valor por defecto, un texto no numérico lo devuelve (abc → 7, 1,5 → 3); sin indicarlo, el valor por defecto de la función es 0 (así la llama el disparador de PM07)', pg_temp.valor('abc', 7) = '7' and pg_temp.valor('1,5', 3) = '3' and private.pm07_numero_catalogo('abc') = 0 and private.pm07_numero_catalogo('1,5') = 0 and private.pm07_numero_catalogo(null) = 0, null);
select pg_temp.ok('B4 los números normales siguen igual: 12, 12.5, 0.25, 0, 007 y con espacios alrededor', pg_temp.valor('12') = '12' and pg_temp.valor('12.5') = '12.5' and pg_temp.valor('0.25') = '0.25' and pg_temp.valor('0') = '0' and pg_temp.valor('007') = '7' and pg_temp.valor('  12.5  ') = '12.5', null);
select pg_temp.ok('B5 los casos sin sentido dan el valor por defecto: nulo, vacío, negativo, «.5», «5.», «1.2.3», «1e3» (el borrador aceptaba «1e3» como 1000)', pg_temp.valor(null) = '0' and pg_temp.valor('') = '0' and pg_temp.valor('-3') = '0' and pg_temp.valor('.5') = '0' and pg_temp.valor('5.') = '0' and pg_temp.valor('1.2.3') = '0' and pg_temp.valor('1e3') = '0', null);
select pg_temp.ok('B6 las propiedades no cambian: plpgsql, inmutable, NO es SECURITY DEFINER, search_path pg_catalog y pg_temp, devuelve numeric',
  (select l.lanname = 'plpgsql' and p.provolatile = 'i' and not p.prosecdef and p.proconfig = array['search_path=pg_catalog, pg_temp'] and p.prorettype = 'numeric'::regtype
     from pg_proc p join pg_language l on l.oid = p.prolang where p.oid = to_regprocedure('private.pm07_numero_catalogo(text,numeric)')), null);
select pg_temp.ok('B7 sigue habiendo una sola función con ese nombre (no se creó una sobrecarga)',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'pm07_numero_catalogo') = 1, null);
select pg_temp.ok('B8 los permisos de ejecución no cambian (create or replace los conserva)', pg_temp.acl() = current_setting('la.acl_antes') and has_function_privilege('authenticated', 'private.pm07_numero_catalogo(text,numeric)', 'execute'), jsonb_build_object('antes', current_setting('la.acl_antes'), 'despues', pg_temp.acl()));

-- ==== REPETICION ====
\i supabase/migrations/20261003130000_abc_pm07_correccion_numero_catalogo.sql
select pg_temp.ok('C1 repetir la migración sobre la versión ya correcta no falla y no cambia nada (md5, comportamiento y permisos iguales)', pg_temp.huella() = '7f36af3c791b2d94a2c76aed2ee4a095' and pg_temp.valor('1,5') = '0' and pg_temp.acl() = current_setting('la.acl_antes'), jsonb_build_object('md5', pg_temp.huella()));
