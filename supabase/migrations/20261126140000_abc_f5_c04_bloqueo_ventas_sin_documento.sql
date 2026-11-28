-- Hallazgo H-38 de la auditoría del TPV (26/11/2026), parte b: el cierre de caja
-- no detectaba ventas cobradas SIN documento fiscal.
--
-- `private.abc_c04_bloqueos_cierre` es el punto único de bloqueos del cierre: lo
-- usan el ensayo C12, el cierre provisional (los guarda en su foto), el cierre
-- definitivo (que rechaza cualquier bloqueo) y el disparador que protege el paso a
-- CERRADA_FINAL. Solo conocía PAGOS_PENDIENTES y EFECTOS_PENDIENTES, así que una
-- sesión con ventas cobradas sin documento emitido se podía cerrar «apta» sin avisar.
--
-- Cambios, ambos sobre la definición VIVA de cada función (idempotentes; fallan en
-- voz alta si la forma esperada no está):
--   1. Nuevo bloqueo VENTAS_SIN_DOCUMENTO: hay un checkout COMPLETADO con importe,
--      del mismo local, completado dentro de la ventana de la sesión (de su apertura
--      a su cierre, o hasta ahora si sigue abierta), cuya venta fiscal no tiene un
--      documento EMITIDO. Un documento solo reservado sigue contando como falta.
--   2. El ensayo C12 clasifica ese bloqueo como BLOQUEADO (no como PENDIENTE).
--
-- Solo se aplica donde la emisión fiscal está CONFIGURADA y usable para el local (private.abc_c07d_emision_config
-- en estado VALIDADA o ACTIVA). Revisión de código de #226: sin emisor configurado (p. ej. la variante de producción
-- sin la semilla de QA) ningún cobro puede tener documento, y el bloqueo impediría cerrar la caja para siempre.
--
-- El cierre provisional no se bloquea (lo recoge en su foto y se puede reabrir); el
-- definitivo sí, hasta que se emita el documento pendiente. La emisión la puede
-- hacer quien inicia cobros (migraciones 20261126120000 y 20261126130000).
--
-- Contrato: tests/rediseno/c04-bloqueo-ventas-sin-documento-pglite-contract.mjs

do $migracion$
declare
  v_oid oid;
  v_def text;
  v_nuevo text;
  v_aplicadas integer := 0;

  -- Solo hay bloqueo si el local tiene la emisión fiscal configurada y usable.
  v_condicion_emision constant text :=
    'exists (select 1 from private.abc_c07d_emision_config cfg' || chr(10)
    || '                 where cfg.empresa_id=p_empresa_id and cfg.local_id=p_local_id' || chr(10)
    || '                   and cfg.estado in (''VALIDADA'',''ACTIVA''))';

  -- Ruta de actualización: la versión anterior de esta migración (ya aplicada en QA) no llevaba la condición.
  v_patron_sin_condicion constant text := 'select\s+''VENTAS_SIN_DOCUMENTO''::text\s+where\s+exists\s*\(';
  v_reemplazo_sin_condicion constant text :=
    'select ''VENTAS_SIN_DOCUMENTO''::text' || chr(10)
    || '        where ' || v_condicion_emision || chr(10)
    || '          and exists (';

  v_patron_bloqueos constant text := '\)\s*x\s*;';
  v_reemplazo_bloqueos constant text :=
    'union all' || chr(10)
    || '      select ''VENTAS_SIN_DOCUMENTO''::text' || chr(10)
    || '        where ' || v_condicion_emision || chr(10)
    || '          and exists (' || chr(10)
    || '          select 1' || chr(10)
    || '            from public.caja_sesiones s' || chr(10)
    || '            join public.checkouts c' || chr(10)
    || '              on c.empresa_id=s.empresa_id and c.local_id=s.local_id' || chr(10)
    || '            join public.checkout_ventas cv on cv.checkout_id=c.id' || chr(10)
    || '           where s.empresa_id=p_empresa_id' || chr(10)
    || '             and s.local_id=p_local_id' || chr(10)
    || '             and s.id=p_session_id' || chr(10)
    || '             and c.estado=''COMPLETADO''' || chr(10)
    || '             and cv.importe_objetivo>0' || chr(10)
    || '             and c.completed_at>=s.abierta_at' || chr(10)
    || '             and (s.cerrada_at is null or c.completed_at<=s.cerrada_at)' || chr(10)
    || '             and not exists (' || chr(10)
    || '               select 1 from public.abc_c05_documentos_emitidos d' || chr(10)
    || '                where d.empresa_id=c.empresa_id' || chr(10)
    || '                  and d.local_id=c.local_id' || chr(10)
    || '                  and d.documento_origen_id=cv.venta_fiscal_id::text' || chr(10)
    || '                  and d.estado=''EMITIDO''' || chr(10)
    || '             )' || chr(10)
    || '        )' || chr(10)
    || '    ) x;';

  v_patron_ensayo constant text := 'or\s+v_blockers\s*\?\s*''SESION_NO_REVISABLE''';
  v_reemplazo_ensayo constant text :=
    'or v_blockers ? ''SESION_NO_REVISABLE''' || chr(10)
    || '      or v_blockers ? ''VENTAS_SIN_DOCUMENTO''';
begin
  if to_regclass('private.abc_c07d_emision_config') is null then
    raise exception 'DEPENDENCIA_OBLIGATORIA_NO_ENCONTRADA: private.abc_c07d_emision_config (configuración de emisión fiscal)';
  end if;

  -- 1. Función de bloqueos (obligatoria, una sola).
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'abc_c04_bloqueos_cierre' and p.prokind = 'f';
  if v_oid is null then
    raise exception 'FUNCION_OBLIGATORIA_NO_ENCONTRADA: private.abc_c04_bloqueos_cierre';
  end if;
  v_def := pg_get_functiondef(v_oid);
  if position('VENTAS_SIN_DOCUMENTO' in v_def) = 0 then
    if (select count(*) from regexp_matches(v_def, v_patron_bloqueos, 'g')) <> 1
       or position('PAGOS_PENDIENTES' in v_def) = 0 then
      raise exception 'ESTRUCTURA_NO_ENCONTRADA: % no tiene la forma esperada (una sola subconsulta x con los bloqueos de pagos y efectos)', v_oid::regprocedure;
    end if;
    v_nuevo := regexp_replace(v_def, v_patron_bloqueos, v_reemplazo_bloqueos, 'g');
    execute v_nuevo;
    v_aplicadas := v_aplicadas + 1;
  elsif position('abc_c07d_emision_config' in v_def) = 0 then
    -- Ya tenía el bloqueo de la versión anterior (sin la condición de emisión configurada): se le añade.
    if (select count(*) from regexp_matches(v_def, v_patron_sin_condicion, 'g')) <> 1 then
      raise exception 'ESTRUCTURA_NO_ENCONTRADA: % tiene VENTAS_SIN_DOCUMENTO pero no con la forma esperada para añadirle la condición de emisión', v_oid::regprocedure;
    end if;
    v_nuevo := regexp_replace(v_def, v_patron_sin_condicion, v_reemplazo_sin_condicion, 'g');
    execute v_nuevo;
    v_aplicadas := v_aplicadas + 1;
  end if;

  -- 2. Ensayo C12 (obligatorio, una sola función).
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'abc_ensayar_cierre_sesion_caja' and p.prokind = 'f';
  if v_oid is null then
    raise exception 'FUNCION_OBLIGATORIA_NO_ENCONTRADA: public.abc_ensayar_cierre_sesion_caja';
  end if;
  v_def := pg_get_functiondef(v_oid);
  if position('VENTAS_SIN_DOCUMENTO' in v_def) = 0 then
    if (select count(*) from regexp_matches(v_def, v_patron_ensayo, 'g')) <> 1 then
      raise exception 'ESTRUCTURA_NO_ENCONTRADA: % no tiene exactamente una clasificacion BLOQUEADO por SESION_NO_REVISABLE que ampliar', v_oid::regprocedure;
    end if;
    v_nuevo := regexp_replace(v_def, v_patron_ensayo, v_reemplazo_ensayo, 'g');
    execute v_nuevo;
    v_aplicadas := v_aplicadas + 1;
  end if;

  raise notice 'c04 bloqueo ventas sin documento: % funcion(es) actualizada(s)', v_aplicadas;
end
$migracion$;
