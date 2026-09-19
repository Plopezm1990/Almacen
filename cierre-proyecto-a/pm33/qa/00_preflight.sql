-- PM33 P05 -- QA preflight (solo lectura), v2.
--
-- CORRECCIÓN sobre la v1 (00_preflight.sql, commit ef325b3): la
-- comprobación anterior ("usa_empleados_relacional AND NOT
-- usa_almacen_kv") no rechazaba un modelo HÍBRIDO -- y la función real de
-- QA lo es: referencia `almacen_kv` (para leer el catálogo de locales) Y
-- `public.empleados` (para los datos del empleado) a la vez. Con esa
-- condición, `true AND NOT true` = false: el aborto NO se disparaba.
-- Además, la afirmación anterior en HALLAZGOS_P02.md/SEGUIMIENTO_18_PUNTOS.md
-- de que el preflight "abortó, correctamente, contra QA real" era
-- incorrecta por partida doble: (a) nunca se ejecutó el SCRIPT en sí
-- contra QA real en esa revisión -- se ejecutaron consultas de
-- introspección sueltas y se razonó manualmente sobre el resultado, lo
-- que no es lo mismo que ejecutar la puerta real; y (b) ese razonamiento
-- manual tenía el mismo defecto que la condición del script: no
-- contempló el caso híbrido. Corregido aquí en ambos sentidos: el script
-- se reescribe con una comprobación robusta, y se ejecuta de verdad
-- contra QA -- ver el resultado real en HALLAZGOS_P02.md sección 11.
--
-- NUEVO CRITERIO: en vez de heurísticas de texto sobre qué tablas
-- menciona el cuerpo (frágil, como demostró el caso híbrido), se compara
-- el HASH EXACTO (md5 de pg_get_functiondef) de la definición vigente
-- contra una lista corta de hashes conocidos y compatibles con este
-- candidato -- hoy, únicamente el de la función real de PROD, capturado
-- el 19/09/2026 vía consulta directa a flqercbgpgmmfaakrwkc. Cualquier
-- definición que no coincida EXACTAMENTE se trata como desconocida y el
-- preflight aborta, sin intentar adivinar si "se parece lo suficiente".
-- Esto también cubre, sin heurísticas adicionales, los casos "ausencia de
-- función" y "firma incompatible" explícitamente.

do $$
declare
  v_firmas int;
  v_def text;
  v_hash text;
  v_hashes_compatibles text[] := array[
    '40d7bf2ea50776b7eb40a3fff239c0b4' -- obtener_contexto_operativo() vigente en PROD (flqercbgpgmmfaakrwkc), capturado el 19/09/2026
  ];
begin
  select count(*) into v_firmas
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo';

  if v_firmas = 0 then
    raise exception 'PREFLIGHT ABORTADO: no existe ninguna función public.obtener_contexto_operativo en este entorno. Estado inesperado para este candidato -- no continuar sin investigar por qué.'
      using errcode = 'P0001';
  end if;

  if v_firmas > 1 then
    raise exception 'PREFLIGHT ABORTADO: existen % sobrecargas de obtener_contexto_operativo en este entorno (se esperaba exactamente 1). Estado inesperado -- no continuar sin investigar.', v_firmas
      using errcode = 'P0001';
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo';
  v_hash := md5(v_def);

  raise notice 'Definición actual -- hash md5: %', v_hash;

  if not (v_hash = any(v_hashes_compatibles)) then
    raise exception 'PREFLIGHT ABORTADO: la definición vigente de obtener_contexto_operativo (hash %) no coincide EXACTAMENTE con ninguna definición conocida y compatible con este candidato. No se asume compatibilidad por similitud de texto entre tablas mencionadas -- eso fue precisamente lo que falló en la versión anterior de este preflight ante un modelo híbrido. Decisión explícita del propietario requerida antes de continuar.', v_hash
      using errcode = 'P0001';
  end if;

  raise notice 'PREFLIGHT OK: la definición coincide exactamente con la esperada (hash %).', v_hash;
end $$;

-- Grants actuales (informativo, se imprime siempre, tanto si el bloque de
-- arriba abortó como si no -- psql sin ON_ERROR_STOP sigue tras un error
-- de un bloque anterior; con ON_ERROR_STOP sí se detendría aquí).
select p.oid::regprocedure::text as firma,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo';

-- Dependencias.
select classid::regclass::text as clase, objid, deptype
from pg_depend
where refobjid in (
  select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo'
);
