-- PM26 P08 -- bateria de permisos para la propuesta del Defecto L en
-- produccion: positivos y negativos de rol, empresa, local. Reporta
-- cada caso con RAISE NOTICE 'Pn/Nn=PASS|FAIL' para que validar.sh lo
-- compruebe por grep -- las llamadas que deben fallar se capturan con
-- EXCEPTION WHEN OTHERS, nunca dejando que aborten el script. RLS
-- directo (sin RPC, igual que produccion real): un INSERT bloqueado
-- lanza una excepcion real; un DELETE bloqueado por USING simplemente
-- no afecta filas, sin excepcion -- cada caso respeta esa diferencia.
set client_min_messages to notice;
set role authenticated;

do $$
begin
  -- P1: Propietario A (todos_locales) crea en LOCAL_A1
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, empresa_id, local_id)
  values ('tok-p1', 'Candidato Uno', 'EMPRESA_A', 'LOCAL_A1');
  raise notice 'P1=PASS';
exception when others then
  raise notice 'P1=FAIL (%)', sqlerrm;
end $$;

do $$
begin
  -- P2: mismo Propietario (todos_locales) crea en LOCAL_A2
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, empresa_id, local_id)
  values ('tok-p2', 'Candidato Dos', 'EMPRESA_A', 'LOCAL_A2');
  raise notice 'P2=PASS';
exception when others then
  raise notice 'P2=FAIL (%)', sqlerrm;
end $$;

do $$
begin
  -- P3: Propietario A2 (scoped solo a LOCAL_A1) crea en su propio local
  perform set_config('app.current_uid', '22222222-2222-2222-2222-222222222222', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, empresa_id, local_id)
  values ('tok-p3', 'Candidato Tres', 'EMPRESA_A', 'LOCAL_A1');
  raise notice 'P3=PASS';
exception when others then
  raise notice 'P3=FAIL (%)', sqlerrm;
end $$;

do $$
begin
  -- N4: Propietario A2 (scoped a LOCAL_A1) intenta crear en LOCAL_A2
  perform set_config('app.current_uid', '22222222-2222-2222-2222-222222222222', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, empresa_id, local_id)
  values ('tok-n4', 'No deberia crearse', 'EMPRESA_A', 'LOCAL_A2');
  raise notice 'N4=FAIL (no debia permitirse)';
exception when insufficient_privilege then
  raise notice 'N4=PASS';
when others then
  raise notice 'N4=FAIL (%)', sqlerrm;
end $$;

do $$
begin
  -- N5: Propietario B intenta crear en EMPRESA_A
  perform set_config('app.current_uid', '44444444-4444-4444-4444-444444444444', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, empresa_id, local_id)
  values ('tok-n5', 'No deberia crearse', 'EMPRESA_A', 'LOCAL_A1');
  raise notice 'N5=FAIL (no debia permitirse)';
exception when insufficient_privilege then
  raise notice 'N5=PASS';
when others then
  raise notice 'N5=FAIL (%)', sqlerrm;
end $$;

do $$
begin
  -- N6: Encargado (no Propietario) en EMPRESA_A/LOCAL_A1
  perform set_config('app.current_uid', '33333333-3333-3333-3333-333333333333', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, empresa_id, local_id)
  values ('tok-n6', 'No deberia crearse', 'EMPRESA_A', 'LOCAL_A1');
  raise notice 'N6=FAIL (no debia permitirse)';
exception when insufficient_privilege then
  raise notice 'N6=PASS';
when others then
  raise notice 'N6=FAIL (%)', sqlerrm;
end $$;

do $$
begin
  -- N7: perfil Propietario pero inactivo (activo=false)
  perform set_config('app.current_uid', '55555555-5555-5555-5555-555555555555', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, empresa_id, local_id)
  values ('tok-n7', 'No deberia crearse', 'EMPRESA_A', 'LOCAL_A1');
  raise notice 'N7=FAIL (no debia permitirse)';
exception when insufficient_privilege then
  raise notice 'N7=PASS';
when others then
  raise notice 'N7=FAIL (%)', sqlerrm;
end $$;

do $$
begin
  -- N8: sin identidad (anon, auth.uid() nulo)
  perform set_config('app.current_uid', '', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, empresa_id, local_id)
  values ('tok-n8', 'No deberia crearse', 'EMPRESA_A', 'LOCAL_A1');
  raise notice 'N8=FAIL (no debia permitirse)';
exception when insufficient_privilege then
  raise notice 'N8=PASS';
when others then
  raise notice 'N8=FAIL (%)', sqlerrm;
end $$;

do $$
declare v_count int;
begin
  -- P9: Propietario A (todos_locales) ve solo las filas de su empresa (3: P1,P2,P3)
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  select count(*) into v_count from public.prefiltros_candidatos;
  if v_count = 3 then raise notice 'P9=PASS'; else raise notice 'P9=FAIL (esperado 3, encontrado %)', v_count; end if;
end $$;

do $$
declare v_count int;
begin
  -- N10: Propietario B no ve las filas de EMPRESA_A
  perform set_config('app.current_uid', '44444444-4444-4444-4444-444444444444', false);
  select count(*) into v_count from public.prefiltros_candidatos;
  if v_count = 0 then raise notice 'N10=PASS'; else raise notice 'N10=FAIL (esperado 0, encontrado %)', v_count; end if;
end $$;

do $$
declare v_count int;
begin
  -- P11: Propietario A2 (scoped LOCAL_A1) borra su propia fila (tok-p3)
  perform set_config('app.current_uid', '22222222-2222-2222-2222-222222222222', false);
  delete from public.prefiltros_candidatos where token = 'tok-p3';
  get diagnostics v_count = row_count;
  if v_count = 1 then raise notice 'P11=PASS'; else raise notice 'P11=FAIL (filas afectadas %)', v_count; end if;
end $$;

do $$
declare v_count int;
begin
  -- N12: Propietario A2 (scoped LOCAL_A1) intenta borrar una fila de
  -- LOCAL_A2 (tok-p2) -- RLS por USING simplemente no afecta filas,
  -- sin excepcion (a diferencia del INSERT).
  perform set_config('app.current_uid', '22222222-2222-2222-2222-222222222222', false);
  delete from public.prefiltros_candidatos where token = 'tok-p2';
  get diagnostics v_count = row_count;
  if v_count = 0 then raise notice 'N12=PASS'; else raise notice 'N12=FAIL (se borraron % filas, no debia borrar ninguna)', v_count; end if;
end $$;

do $$
declare v_existe boolean;
begin
  -- Confirma que tok-p2 sigue existiendo tras el intento bloqueado de N12
  -- (como Propietario A, que si puede verla).
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  select exists(select 1 from public.prefiltros_candidatos where token = 'tok-p2') into v_existe;
  if v_existe then raise notice 'N12_SIN_RESIDUO_BORRADO=PASS'; else raise notice 'N12_SIN_RESIDUO_BORRADO=FAIL'; end if;
end $$;

do $$
declare v_count int;
begin
  -- N13: borrar un token inexistente -- 0 filas afectadas, sin excepcion
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  delete from public.prefiltros_candidatos where token = 'token-que-no-existe';
  get diagnostics v_count = row_count;
  if v_count = 0 then raise notice 'N13=PASS'; else raise notice 'N13=FAIL'; end if;
end $$;
