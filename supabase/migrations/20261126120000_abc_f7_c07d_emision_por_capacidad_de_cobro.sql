-- Hallazgo H-38 de la auditoría del TPV (26/11/2026): un cobro del Cajero/a se
-- cierra SIN documento fiscal.
--
-- Causa raíz (comprobada en el servidor de QA con la sesión real del Cajero/a):
-- la lectura del estado de la configuración de emisión y la propia emisión del
-- documento exigían `ABC_EMISOR_CAMBIAR`, una capacidad administrativa de
-- «cambiar el emisor» que solo tienen Propietario y Encargado. El cliente
-- (`emitirCheckoutFiscalC07D`) hace primero la lectura del estado; al fallar con
-- C07D_CONFIG_NO_AUTORIZADO no llega ni a llamar a la emisión, y la emisión
-- tampoco habría aceptado al Cajero/a.
--
-- Corrección: en las funciones de la CADENA DEL COBRO, quien puede iniciar un
-- cobro (`ABC_COBRO_INICIAR`) puede además emitir el documento de ese cobro y
-- leer su estado. Es el mismo criterio que ya usa `abc_c07d_estado_cuenta`.
-- Las funciones de ADMINISTRACIÓN fiscal (guardar la configuración, series,
-- adaptadores, retención, entrega, reconciliación…) siguen exigiendo
-- `ABC_EMISOR_CAMBIAR`: no se ensancha nada más.
--
-- Funciones afectadas:
--   * public.abc_c07d_emitir_checkout(...)                  (obligatoria)
--   * public.abc_c07d_estado_configuracion_emision(...)     (obligatoria)
--   * public.abc_preparar_ticket_fiscal_qa(...)             (solo QA; opcional:
--     no está en las migraciones, ver H-06, y puede no existir en otro entorno)
--
-- Cómo se aplica: se toma la definición ACTUAL de cada función en la base de
-- datos donde corre la migración y se sustituye solo su guarda. Así no se
-- arrastra ninguna deriva entre lo que dice el repositorio y lo que hay
-- desplegado, y la migración es idempotente. Si la guarda esperada no está
-- (alguien reescribió la función), la migración FALLA en vez de dejarla sin
-- tocar y dar el problema por resuelto.
--
-- Contrato: tests/rediseno/c07d-emision-cobro-pglite-contract.mjs

do $migracion$
declare
  v_nombre text;
  v_obligatoria boolean;
  v_oid oid;
  v_def text;
  v_nuevo text;
  v_encontradas integer;
  v_aplicadas integer := 0;
  v_patron constant text :=
    'not\s+private\.abc_tiene_capacidad\(\s*p_empresa_id\s*,\s*p_local_id\s*,\s*''ABC_EMISOR_CAMBIAR''\s*\)';
  v_reemplazo constant text :=
    'not (private.abc_tiene_capacidad(p_empresa_id, p_local_id, ''ABC_EMISOR_CAMBIAR'') '
    || 'or private.abc_tiene_capacidad(p_empresa_id, p_local_id, ''ABC_COBRO_INICIAR''))';
begin
  for v_nombre, v_obligatoria in
    values ('abc_c07d_emitir_checkout', true),
           ('abc_c07d_estado_configuracion_emision', true),
           ('abc_preparar_ticket_fiscal_qa', false)
  loop
    v_encontradas := 0;
    for v_oid in
      select p.oid
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname = v_nombre
         and p.prokind = 'f'
    loop
      v_encontradas := v_encontradas + 1;
      v_def := pg_get_functiondef(v_oid);

      -- Ya aplicada: no se vuelve a tocar.
      if position('ABC_COBRO_INICIAR' in v_def) > 0 then
        continue;
      end if;

      if (select count(*) from regexp_matches(v_def, v_patron, 'g')) <> 1 then
        raise exception 'GUARDA_NO_ENCONTRADA: % no tiene exactamente una guarda de ABC_EMISOR_CAMBIAR que sustituir', v_oid::regprocedure;
      end if;

      v_nuevo := regexp_replace(v_def, v_patron, v_reemplazo, 'g');
      execute v_nuevo;
      v_aplicadas := v_aplicadas + 1;
    end loop;

    if v_encontradas = 0 and v_obligatoria then
      raise exception 'FUNCION_OBLIGATORIA_NO_ENCONTRADA: public.%', v_nombre;
    end if;
  end loop;

  raise notice 'c07d emision por capacidad de cobro: % funcion(es) actualizada(s)', v_aplicadas;
end
$migracion$;
