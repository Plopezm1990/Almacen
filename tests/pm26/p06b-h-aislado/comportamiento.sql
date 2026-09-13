-- Bateria de permisos: identidades positivas y negativas, antes y
-- despues de la migracion deben dar exactamente el mismo resultado.
\set QUIET on
set client_min_messages to warning;

\echo '--- Como user1 (11111111...), Propietario EMPRESA_A, activo ---'
set role authenticated;
set app.current_uid = '11111111-1111-1111-1111-111111111111';

\echo 'P1 SELECT propio perfil (positivo, esperado 1 fila):'
select count(*) from public.perfiles where user_id = '11111111-1111-1111-1111-111111111111';

\echo 'P2 SELECT perfil ajeno via RLS sin filtro explicito (negativo, esperado 0 filas visibles del ajeno):'
select count(*) from public.perfiles where user_id = '22222222-2222-2222-2222-222222222222';

\echo 'P3 UPDATE perfil ajeno (negativo, esperado 0 filas afectadas):'
update public.perfiles set updated_at = now() where user_id = '22222222-2222-2222-2222-222222222222';

\echo 'P4 UPDATE perfil propio (positivo, esperado 1 fila afectada):'
update public.perfiles set updated_at = now() where user_id = '11111111-1111-1111-1111-111111111111';

\echo 'P5 SELECT suscripcion push propia (positivo, esperado 1 fila):'
select count(*) from public.suscripciones_push where user_id = '11111111-1111-1111-1111-111111111111';

\echo 'P6 SELECT suscripcion push ajena (negativo, esperado 0 filas):'
select count(*) from public.suscripciones_push where endpoint = 'ep-user2';

\echo 'P7 DELETE suscripcion push ajena (negativo, esperado 0 filas afectadas):'
delete from public.suscripciones_push where endpoint = 'ep-user2';

\echo 'P8 SELECT membresia propia, usuario activo con membresia (positivo, esperado 1 fila, EMPRESA_A):'
select empresa_id from public.membresias_usuario where user_id = '11111111-1111-1111-1111-111111111111';

reset app.current_uid;
reset role;

\echo ''
\echo '--- Como user2 (22222222...), Encargado EMPRESA_B/LOCAL_B1, activo ---'
set role authenticated;
set app.current_uid = '22222222-2222-2222-2222-222222222222';

\echo 'P9 SELECT membresia propia (positivo, esperado 1 fila, EMPRESA_B):'
select empresa_id, local_id from public.membresias_usuario where user_id = '22222222-2222-2222-2222-222222222222';

\echo 'P10 SELECT membresia de user1, separacion entre empresas (negativo, esperado 0 filas visibles):'
select count(*) from public.membresias_usuario where user_id = '11111111-1111-1111-1111-111111111111';

reset app.current_uid;
reset role;

\echo ''
\echo '--- Como user3 (33333333...), perfil INACTIVO (activo=false) ---'
set role authenticated;
set app.current_uid = '33333333-3333-3333-3333-333333333333';

\echo 'P11 SELECT propio perfil (positivo aunque inactivo: la politica de perfiles solo exige user_id, esperado 1 fila):'
select count(*) from public.perfiles where user_id = '33333333-3333-3333-3333-333333333333';

\echo 'P12 SELECT propia membresia con perfil inactivo -- la_usuario_activo() debe devolver false (negativo, esperado 0 filas):'
select count(*) from public.membresias_usuario where user_id = '33333333-3333-3333-3333-333333333333';

reset app.current_uid;
reset role;

\echo ''
\echo '--- Sin identidad (auth.uid() IS NULL, simula anon/no autenticado) ---'
set role authenticated;
\echo 'P13 SELECT todos los perfiles sin identidad (negativo, esperado 0 filas):'
select count(*) from public.perfiles;
reset role;
