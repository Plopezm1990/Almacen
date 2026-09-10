-- Bateria de permisos para el diseno del aviso F: positivos y
-- negativos de rol, empresa, local y tokens. Cada caso se reporta con
-- RAISE NOTICE 'Pn ...=PASS/FAIL' para que validar.sh pueda comprobarlo
-- por grep -- las llamadas que deben fallar se capturan con
-- EXCEPTION WHEN OTHERS, nunca dejando que aborten el script.
--
-- Todo corre como el rol "authenticated" -- como superusuario
-- (postgres) los GRANT/REVOKE no se aplican nunca, y las pruebas N14/
-- N15 (bypass directo) no probarian nada real.
set client_min_messages to notice;
set role authenticated;

do $$
declare v_token text; v_token2 text; v_ok boolean; v_count int;
begin
  -- P1: Propietario EMPRESA_A (todos_locales) crea en LOCAL_A1
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  v_token := public.pm11_crear_prefiltro_candidato('EMPRESA_A', 'LOCAL_A1', 'Candidato Uno');
  if v_token is not null then raise notice 'P1=PASS'; else raise notice 'P1=FAIL'; end if;

  -- P2: mismo Propietario crea en LOCAL_A2 (todos_locales cubre otro local)
  v_token2 := public.pm11_crear_prefiltro_candidato('EMPRESA_A', 'LOCAL_A2', 'Candidato Dos');
  if v_token2 is not null then raise notice 'P2=PASS'; else raise notice 'P2=FAIL'; end if;

  -- P3: Encargado EMPRESA_A/LOCAL_A1 crea en su propio local
  perform set_config('app.current_uid', '22222222-2222-2222-2222-222222222222', false);
  perform public.pm11_crear_prefiltro_candidato('EMPRESA_A', 'LOCAL_A1', 'Candidato Tres');
  raise notice 'P3=PASS';
exception when others then
  raise notice 'P3=FAIL (%)', sqlerrm;
end $$;

do $$
begin
  -- N4: Encargado EMPRESA_A/LOCAL_A1 intenta crear en LOCAL_A2 (otro local)
  perform set_config('app.current_uid', '22222222-2222-2222-2222-222222222222', false);
  perform public.pm11_crear_prefiltro_candidato('EMPRESA_A', 'LOCAL_A2', 'No deberia crearse');
  raise notice 'N4=FAIL (no debia permitirse)';
exception when others then
  if sqlerrm = 'personal_contexto_no_autorizado' then raise notice 'N4=PASS'; else raise notice 'N4=FAIL (%)', sqlerrm; end if;
end $$;

do $$
begin
  -- N5: Propietario EMPRESA_A intenta crear en EMPRESA_B
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  perform public.pm11_crear_prefiltro_candidato('EMPRESA_B', 'LOCAL_B1', 'No deberia crearse');
  raise notice 'N5=FAIL (no debia permitirse)';
exception when others then
  if sqlerrm = 'personal_contexto_no_autorizado' then raise notice 'N5=PASS'; else raise notice 'N5=FAIL (%)', sqlerrm; end if;
end $$;

do $$
begin
  -- N6: Basico EMPRESA_A/LOCAL_A1 (no es Propietario/Encargado)
  perform set_config('app.current_uid', '33333333-3333-3333-3333-333333333333', false);
  perform public.pm11_crear_prefiltro_candidato('EMPRESA_A', 'LOCAL_A1', 'No deberia crearse');
  raise notice 'N6=FAIL (no debia permitirse)';
exception when others then
  if sqlerrm = 'personal_contexto_no_autorizado' then raise notice 'N6=PASS'; else raise notice 'N6=FAIL (%)', sqlerrm; end if;
end $$;

do $$
begin
  -- N7: sin identidad (anon)
  perform set_config('app.current_uid', '', false);
  perform public.pm11_crear_prefiltro_candidato('EMPRESA_A', 'LOCAL_A1', 'No deberia crearse');
  raise notice 'N7=FAIL (no debia permitirse)';
exception when others then
  if sqlerrm = 'personal_contexto_no_autorizado' then raise notice 'N7=PASS'; else raise notice 'N7=FAIL (%)', sqlerrm; end if;
end $$;

do $$
begin
  -- N8: local_id vacio
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  perform public.pm11_crear_prefiltro_candidato('EMPRESA_A', '', 'No deberia crearse');
  raise notice 'N8=FAIL (no debia permitirse)';
exception when others then
  if sqlerrm = 'personal_contexto_no_autorizado' then raise notice 'N8=PASS'; else raise notice 'N8=FAIL (%)', sqlerrm; end if;
end $$;

do $$
declare v_count int;
begin
  -- P9: listar (SELECT) como Propietario EMPRESA_A -- debe ver solo
  -- las filas de su empresa (creadas en P1/P2/P3: 3 filas).
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  select count(*) into v_count from public.prefiltros_candidatos;
  if v_count = 3 then raise notice 'P9=PASS'; else raise notice 'P9=FAIL (esperado 3, encontrado %)', v_count; end if;
end $$;

do $$
declare v_count int;
begin
  -- N10: Propietario EMPRESA_B no ve las filas de EMPRESA_A
  perform set_config('app.current_uid', '44444444-4444-4444-4444-444444444444', false);
  select count(*) into v_count from public.prefiltros_candidatos;
  if v_count = 0 then raise notice 'N10=PASS'; else raise notice 'N10=FAIL (esperado 0, encontrado %)', v_count; end if;
end $$;

do $$
declare v_ok boolean; v_token text;
begin
  -- P11: Encargado elimina un token de su propio local
  perform set_config('app.current_uid', '22222222-2222-2222-2222-222222222222', false);
  select token into v_token from public.prefiltros_candidatos where empresa_id = 'EMPRESA_A' and local_id = 'LOCAL_A1' and candidato_nombre = 'Candidato Tres';
  v_ok := public.pm11_eliminar_prefiltro_candidato('EMPRESA_A', 'LOCAL_A1', v_token);
  if v_ok then raise notice 'P11=PASS'; else raise notice 'P11=FAIL'; end if;
end $$;

do $$
declare v_token text;
begin
  -- N12: Encargado intenta eliminar un token que existe pero es de
  -- otro local (LOCAL_A2). El token se busca primero como Propietario
  -- (que sí ve LOCAL_A2 via todos_locales) -- el propio Encargado no
  -- podría ver esa fila por RLS, así que buscarla con su identidad
  -- daría NULL y no probaría nada real.
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  select token into v_token from public.prefiltros_candidatos where empresa_id = 'EMPRESA_A' and local_id = 'LOCAL_A2';
  if v_token is null then raise exception 'fixture_invalido: no se encontro el token de LOCAL_A2'; end if;

  perform set_config('app.current_uid', '22222222-2222-2222-2222-222222222222', false);
  perform public.pm11_eliminar_prefiltro_candidato('EMPRESA_A', 'LOCAL_A1', v_token);
  raise notice 'N12=FAIL (no debia permitirse)';
exception when others then
  -- El Encargado SI esta autorizado sobre el contexto declarado
  -- (EMPRESA_A/LOCAL_A1, el suyo propio) -- el rechazo correcto viene
  -- de que el token real pertenece a otro local, no de su rol.
  if sqlerrm = 'prefiltro_candidato_contexto_no_coincide' then raise notice 'N12=PASS'; else raise notice 'N12=FAIL (%)', sqlerrm; end if;
end $$;

do $$
declare v_ok boolean;
begin
  -- N13: eliminar un token inexistente -- debe devolver false, sin excepcion
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  v_ok := public.pm11_eliminar_prefiltro_candidato('EMPRESA_A', 'LOCAL_A1', 'token-que-no-existe');
  if v_ok = false then raise notice 'N13=PASS'; else raise notice 'N13=FAIL'; end if;
end $$;

do $$
begin
  -- N14: INSERT directo (bypass de la RPC) -- debe estar revocado
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, estado, empresa_id, local_id)
  values ('token-directo', 'Bypass', 'pendiente', 'EMPRESA_A', 'LOCAL_A1');
  raise notice 'N14=FAIL (no debia permitirse el insert directo)';
exception when insufficient_privilege then
  raise notice 'N14=PASS';
when others then
  raise notice 'N14=FAIL (%)', sqlerrm;
end $$;

do $$
declare v_token text;
begin
  -- N15: DELETE directo (bypass de la RPC) -- debe estar revocado
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  select token into v_token from public.prefiltros_candidatos limit 1;
  delete from public.prefiltros_candidatos where token = v_token;
  raise notice 'N15=FAIL (no debia permitirse el delete directo)';
exception when insufficient_privilege then
  raise notice 'N15=PASS';
when others then
  raise notice 'N15=FAIL (%)', sqlerrm;
end $$;
