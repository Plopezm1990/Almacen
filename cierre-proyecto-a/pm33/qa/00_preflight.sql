-- PM33 P04 -- QA preflight (solo lectura). Ejecutado de verdad contra
-- qjqorixtkilwsndqayyx el 19/09/2026 -- ver el resultado real en
-- HALLAZGOS_P02.md sección 9. Este archivo es el mismo preflight,
-- versionado, para poder repetirlo o ejecutarlo contra otro entorno.
--
-- HALLAZGO DE ESTA EJECUCIÓN (no asumido, comprobado): la función
-- obtener_contexto_operativo() vigente en QA HOY es una reimplementación
-- COMPLETAMENTE DISTINTA de la de PROD -- usa las tablas relacionales
-- public.empleados/public.locales con autorización basada enteramente en
-- membresias_usuario, no el modelo heredado de almacen_kv que sí lee la
-- versión de PROD. Aplicar el candidato PM33 (P03/P04, diseñado para el
-- estado real de PROD) sobre QA tal cual SUSTITUIRÍA esa implementación
-- más avanzada por una más antigua -- no es una validación neutral, sería
-- un retroceso real para QA. Por eso este preflight no es solo
-- informativo: el bloque de abajo ABORTA (RAISE EXCEPTION) si detecta
-- que el entorno objetivo no tiene la forma que este candidato asume, en
-- vez de dejar que un `apply` posterior lo sobrescriba a ciegas.
--
-- "No supongas que coincide con producción": este preflight vuelve a
-- comprobarlo cada vez que se ejecuta, no reutiliza el resultado de hoy.

do $$
declare
  v_firmas int;
  v_pronargs int;
  v_prosrc text;
  v_usa_almacen_kv boolean;
  v_usa_empleados_relacional boolean;
begin
  select count(*) into v_firmas
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo';

  raise notice 'Sobrecargas existentes de obtener_contexto_operativo: %', v_firmas;

  if v_firmas = 0 then
    raise notice 'No existe ninguna función con ese nombre en este entorno -- fuera del supuesto de este candidato (piensa antes de aplicar: puede ser intencional o un entorno distinto).';
    return;
  end if;

  select p.pronargs, p.prosrc into v_pronargs, v_prosrc
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo'
  order by p.pronargs limit 1;

  v_usa_almacen_kv := v_prosrc ~ 'almacen_kv';
  v_usa_empleados_relacional := v_prosrc ~ '\mpublic\.empleados\M' or v_prosrc ~ '\mfrom empleados\M';

  raise notice 'pronargs=%, referencia almacen_kv=%, referencia tabla empleados relacional=%', v_pronargs, v_usa_almacen_kv, v_usa_empleados_relacional;

  if v_usa_empleados_relacional and not v_usa_almacen_kv then
    raise exception 'PREFLIGHT ABORTADO: la función vigente en este entorno usa el modelo relacional (public.empleados/locales), no almacen_kv. El candidato PM33 P03/P04 está diseñado para el modelo real de PROD (almacen_kv) y SUSTITUIRÍA esta implementación por una distinta/más antigua. No continuar sin una decisión explícita del propietario sobre cuál de los dos diseños es el vigente para este entorno.'
      using errcode = 'P0001';
  end if;

  if v_firmas > 1 then
    raise exception 'PREFLIGHT ABORTADO: existe más de una sobrecarga de obtener_contexto_operativo en este entorno -- estado inesperado, no asumido por la migración. Investigar antes de continuar.'
      using errcode = 'P0001';
  end if;

  raise notice 'PREFLIGHT OK: el entorno tiene una única sobrecarga (pronargs=%) basada en almacen_kv, compatible con el supuesto del candidato PM33 P03/P04.', v_pronargs;
end $$;

-- Grants actuales (para comparar antes/después de cualquier aplicación futura).
select p.oid::regprocedure::text as firma,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo';

-- Definición completa actual (para poder reconstruirla exactamente en un
-- rollback específico de este entorno -- nunca asumir que es la de PROD).
select pg_get_functiondef(p.oid) as definicion_actual
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo'
order by p.pronargs limit 1;

-- Dependencias (igual que se comprobó en PROD).
select classid::regclass::text as clase, objid, deptype
from pg_depend
where refobjid in (
  select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo'
);
