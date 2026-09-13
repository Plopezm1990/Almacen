-- PM26 P08e -- bateria centrada en la PRECONDICION de autorizacion: la
-- membresia. Se ejecuta con la migracion del Defecto L ya aplicada en
-- el Postgres local aislado. Cada caso reporta 'Mn=PASS|FAIL' por
-- RAISE NOTICE para que validar-membresias.sh lo compruebe por grep.
--
-- Lo que demuestra: el aislamiento NO lo da el rol Propietario, lo da
-- la membresia activa y coherente. Un Propietario sin membresia queda
-- bloqueado igual que un extrano, y desactivar la membresia retira el
-- acceso de inmediato. Todo sintetico, ninguna identidad real.
set client_min_messages to notice;

-- Usuario 6: Propietario en perfiles pero SIN ninguna membresia. Es el
-- retrato exacto de la cuenta legacy de produccion hoy.
insert into auth.users (id) values ('66666666-6666-6666-6666-666666666666');
insert into public.perfiles (user_id, rol, activo) values
  ('66666666-6666-6666-6666-666666666666', 'Propietario', true);

set role authenticated;

do $$
begin
  -- M1: Propietario con membresia coherente crea en SU empresa/local.
  perform set_config('app.current_uid', '22222222-2222-2222-2222-222222222222', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, empresa_id, local_id)
  values ('tok-m1', 'Candidato M1', 'EMPRESA_A', 'LOCAL_A1');
  raise notice 'M1=PASS';
exception when others then
  raise notice 'M1=FAIL (%)', sqlerrm;
end $$;

do $$
begin
  -- M2: el mismo Propietario intenta crear en OTRA empresa -> bloqueado.
  perform set_config('app.current_uid', '22222222-2222-2222-2222-222222222222', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, empresa_id, local_id)
  values ('tok-m2', 'Candidato M2', 'EMPRESA_B', 'LOCAL_B1');
  raise notice 'M2=FAIL (se permitio crear en empresa ajena)';
exception when others then
  raise notice 'M2=PASS';
end $$;

do $$
begin
  -- M3: el mismo Propietario intenta un local no autorizado -> bloqueado.
  perform set_config('app.current_uid', '22222222-2222-2222-2222-222222222222', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, empresa_id, local_id)
  values ('tok-m3', 'Candidato M3', 'EMPRESA_A', 'LOCAL_A2');
  raise notice 'M3=FAIL (se permitio crear en local ajeno)';
exception when others then
  raise notice 'M3=PASS';
end $$;

do $$
begin
  -- M4: Propietario en perfiles pero SIN membresia -> bloqueado. Este
  -- es el estado real de produccion hoy: el rol no basta.
  perform set_config('app.current_uid', '66666666-6666-6666-6666-666666666666', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, empresa_id, local_id)
  values ('tok-m4', 'Candidato M4', 'EMPRESA_A', 'LOCAL_A1');
  raise notice 'M4=FAIL (un Propietario sin membresia pudo crear)';
exception when others then
  raise notice 'M4=PASS';
end $$;

do $$
declare v_visibles int;
begin
  -- M5: lectura cruzada -- el Propietario de EMPRESA_B no ve la fila
  -- de EMPRESA_A creada en M1.
  perform set_config('app.current_uid', '44444444-4444-4444-4444-444444444444', false);
  select count(*) into v_visibles from public.prefiltros_candidatos where token = 'tok-m1';
  if v_visibles = 0 then
    raise notice 'M5=PASS';
  else
    raise notice 'M5=FAIL (vio % fila(s) de otra empresa)', v_visibles;
  end if;
end $$;

do $$
declare v_borradas int; v_sigue int;
begin
  -- M6: borrado cruzado -- un DELETE bloqueado por USING no lanza
  -- excepcion, simplemente no afecta filas. Se comprueba con el mismo
  -- patron DELETE ... RETURNING que genera .delete().select().
  perform set_config('app.current_uid', '44444444-4444-4444-4444-444444444444', false);
  with borradas as (
    delete from public.prefiltros_candidatos where token = 'tok-m1' returning 1
  )
  select count(*) into v_borradas from borradas;
  perform set_config('app.current_uid', '22222222-2222-2222-2222-222222222222', false);
  select count(*) into v_sigue from public.prefiltros_candidatos where token = 'tok-m1';
  if v_borradas = 0 and v_sigue = 1 then
    raise notice 'M6=PASS';
  else
    raise notice 'M6=FAIL (borradas=%, sigue=%)', v_borradas, v_sigue;
  end if;
end $$;

do $$
declare v_devueltas int;
begin
  -- M7: compatibilidad con el parche P08d -- el INSERT que envia el
  -- cliente parcheado (token, candidato_nombre, estado, empresa_id,
  -- local_id) y el DELETE con RETURNING que genera .delete().select().
  perform set_config('app.current_uid', '22222222-2222-2222-2222-222222222222', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, estado, empresa_id, local_id)
  values ('tok-m7', 'Candidato M7', 'pendiente', 'EMPRESA_A', 'LOCAL_A1');
  with borradas as (
    delete from public.prefiltros_candidatos where token = 'tok-m7' returning 1
  )
  select count(*) into v_devueltas from borradas;
  if v_devueltas = 1 then
    raise notice 'M7=PASS';
  else
    raise notice 'M7=FAIL (el borrado propio devolvio % filas)', v_devueltas;
  end if;
exception when others then
  raise notice 'M7=FAIL (%)', sqlerrm;
end $$;

-- M8: desactivar la membresia retira el acceso de inmediato, aunque el
-- perfil siga siendo Propietario activo. Demuestra que la autorizacion
-- cuelga de la membresia, no del rol.
reset role;
update public.membresias_usuario set activo = false
 where user_id = '22222222-2222-2222-2222-222222222222';
set role authenticated;

do $$
begin
  perform set_config('app.current_uid', '22222222-2222-2222-2222-222222222222', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, empresa_id, local_id)
  values ('tok-m8', 'Candidato M8', 'EMPRESA_A', 'LOCAL_A1');
  raise notice 'M8=FAIL (creo con la membresia desactivada)';
exception when others then
  raise notice 'M8=PASS';
end $$;

reset role;
update public.membresias_usuario set activo = true
 where user_id = '22222222-2222-2222-2222-222222222222';
