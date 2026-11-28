-- 02 · SEGUNDO FACTOR (MFA) por empresa · informe de SOLO LECTURA
--
-- Por qué existe: la migración 20261115120000 (mfa_politica_opcional) cambia DÓNDE se decide quién debe usar segundo factor: pasa de una lista de cargos escrita a mano
-- (`m03_server_aal2_gate`: Propietario, Encargado y Cajero/a) a la tabla `private.mfa_politica`, donde «sin fila = no se exige». La migración 20261128120000 solo siembra las
-- empresas NUEVAS y dice expresamente que no rellena las existentes. Resultado si solo se migra: tras el lanzamiento NO se exigiría segundo factor a nadie en las empresas actuales.
-- La decisión del usuario (E6, 25/11/2026) es: obligatorio SOLO para el Propietario. Este informe dice cuántas empresas hay, cuántos Propietarios tienen ya un factor verificado
-- y qué política hay hoy. Con él se decide, empresa por empresa, el alta de la política (script 02b).
--
-- No modifica nada. Ejecútalo con un rol de solo lectura.

begin read only;

-- A. Antes de migrar (funciona aunque `private.mfa_politica` aún no exista): empresas, Propietarios y factores verificados.
select e.id                                                   as empresa_id,
       e.nombre,
       e.activo,
       (select count(*) from public.membresias_usuario m
         where m.empresa_id = e.id and m.activo and m.rol = 'Propietario')               as propietarios_activos,
       (select count(*) from public.membresias_usuario m
         join auth.mfa_factors f on f.user_id = m.user_id and f.status = 'verified'
        where m.empresa_id = e.id and m.activo and m.rol = 'Propietario')                as propietarios_con_factor_verificado
  from public.empresas e
 order by e.activo desc, e.id;

-- B. Quién está hoy obligado a usar segundo factor por cargo (lo que deja de existir al migrar). Es la comprobación de que `m03_server_aal2_gate` está aplicada.
select pg_get_functiondef(p.oid) like '%aal2%' as la_usuario_activo_menciona_aal2,
       pg_get_functiondef(p.oid)               as definicion
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'private' and p.proname = 'la_usuario_activo';

rollback;

-- C. DESPUÉS de aplicar 20261115120000 (ejecútalo entonces, en otra transacción de solo lectura):
--    qué política hay por empresa. En una empresa sin fila de Propietario, NO se exige.
--
-- begin read only;
-- select e.id as empresa_id, e.activo,
--        (select exigida from private.mfa_politica p where p.empresa_id = e.id and p.rol = 'Propietario') as politica_propietario
--   from public.empresas e order by e.activo desc, e.id;
-- rollback;
