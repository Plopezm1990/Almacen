-- PM26 P08g -- bateria de comportamiento del catalogo de empresas y
-- locales. Se ejecuta con catalogo-empresas-locales-propuesta.sql ya
-- aplicado en el PostgreSQL local aislado. Cada caso reporta
-- 'Cn=PASS|FAIL' por RAISE NOTICE. Todo sintetico, ninguna identidad
-- real.
set client_min_messages to notice;

do $$
begin
  -- C1: un usuario autenticado NO puede insertar en empresas -- sin
  -- ninguna politica de INSERT, el propio RLS lo bloquea antes incluso
  -- de llegar al GRANT.
  set role authenticated;
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  insert into public.empresas (id, nombre) values ('FABRICADA', 'Empresa fabricada por el cliente');
  raise notice 'C1=FAIL (authenticated pudo crear una empresa)';
exception when others then
  raise notice 'C1=PASS (%)', sqlerrm;
end $$;
reset role;

do $$
begin
  -- C2: un usuario autenticado NO puede insertar en locales.
  set role authenticated;
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  insert into public.locales (id, empresa_id, nombre) values ('FABRICADO', 'EMPRESA_A', 'Local fabricado');
  raise notice 'C2=FAIL (authenticated pudo crear un local)';
exception when others then
  raise notice 'C2=PASS (%)', sqlerrm;
end $$;
reset role;

do $$
declare v_visibles int;
begin
  -- C3: un usuario autenticado NO puede leer el catalogo -- al no
  -- haber GRANT de SELECT (revocado explicitamente en la propuesta),
  -- el intento falla por permiso denegado antes de que RLS entre en
  -- juego; nunca llega a ver ninguna fila.
  set role authenticated;
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  select count(*) into v_visibles from public.empresas;
  raise notice 'C3=FAIL (authenticated vio % fila(s) del catalogo)', v_visibles;
exception when others then
  raise notice 'C3=PASS (%)', sqlerrm;
end $$;
reset role;

do $$
begin
  -- C4: la via administrativa (sin cambiar de rol -- el dueno de la
  -- conexion bypassa RLS) SI puede escribir en el catalogo.
  insert into public.empresas (id, nombre) values ('EMPRESA_TEST', 'Empresa de prueba');
  insert into public.locales (id, empresa_id, nombre) values ('LOCAL_TEST', 'EMPRESA_TEST', 'Local de prueba');
  raise notice 'C4=PASS';
exception when others then
  raise notice 'C4=FAIL (%)', sqlerrm;
end $$;

do $$
begin
  -- C5: un local no puede apuntar a una empresa que no existe en el
  -- catalogo -- la clave foranea lo impide incluso por via administrativa.
  insert into public.locales (id, empresa_id, nombre) values ('LOCAL_HUERFANO', 'EMPRESA_INEXISTENTE', 'x');
  raise notice 'C5=FAIL (se permitio un local con empresa_id inexistente)';
exception when others then
  raise notice 'C5=PASS (%)', sqlerrm;
end $$;

-- Limpieza de los datos de prueba de este archivo (C4/C5), para que
-- validar-catalogo.sh pueda re-ejecutar esta bateria de forma limpia.
delete from public.locales where id in ('LOCAL_TEST', 'LOCAL_HUERFANO');
delete from public.empresas where id = 'EMPRESA_TEST';
