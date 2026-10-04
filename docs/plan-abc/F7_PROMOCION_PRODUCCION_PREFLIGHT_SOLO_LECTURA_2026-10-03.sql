-- F7 · Promoción a producción · comprobaciones previas de SOLO LECTURA (preparado el 3/10/2026).
--
-- Producción es el proyecto de Supabase `flqercbgpgmmfaakrwkc`. El 3/10/2026, a las 11:33 UTC, con la autorización expresa de Pedro, se ejecutaron
-- en producción los bloques P0, P1, P2, P3, P5, P6, P7, P8 y P9 tal cual, y de P4 solo una versión estrecha (huellas md5 sin las definiciones).
-- Resultado: `F7_PROMOCION_PRODUCCION_FOTO_RESULTADO_2026-10-03.md`. Volver a ejecutarlo en producción exige una autorización nueva.
--
-- Reglas del archivo: solo `select`. Ningún `insert`, `update`, `delete`, `create`, `alter`, `drop`, `grant`, `revoke`, `truncate`, `set` de
-- datos, `do` ni función con efectos. Cada consulta es independiente (se puede ejecutar por separado). Las tablas que pueden no existir en
-- producción se consultan con `to_regclass`/`query_to_xml`, de modo que una tabla ausente da `NULL` en lugar de un error.
-- Se pide solo recuentos y huellas, nunca el contenido de filas con datos de personas o de clientes.
--
-- Cómo se usa: ejecutar cada bloque, guardar la salida íntegra (con la hora y el identificador del proyecto) en el expediente de la promoción
-- y comparar con lo esperado que figura en el documento `F7_PROMOCION_PRODUCCION_PREPARACION_2026-10-03.md`.

-- ============================================================================================================================
-- P0 · Dónde estoy (comprobar que es producción y no QA: debe salir el identificador del proyecto de producción en la herramienta usada)
-- ============================================================================================================================
select current_database() as base, current_setting('server_version') as version_postgres, now() as hora_servidor;

-- ============================================================================================================================
-- P1 · Qué migraciones están registradas (comparar con la lista de 45 del documento; los NOMBRES, no las marcas de tiempo: la herramienta
--      asigna su propia marca al aplicar, y en QA algunas se registraron con el nombre largo del archivo y otras con el corto)
-- ============================================================================================================================
select version, name
  from supabase_migrations.schema_migrations
 where version >= '20260923000000'
 order by version;

-- ============================================================================================================================
-- P2 · Qué objetos de cada migración candidata ya existen en producción. Por migración: cuántos de sus objetos nuevos existen.
--      «todos» = aplicada (o equivalente); «ninguno» = pendiente; «algunos» = DERIVA DE ESQUEMA: no aplicar nada sin revisarla.
-- ============================================================================================================================
with objetos(migracion, nombre, tipo, esquema, objeto) as (
  values
    ('20260924160739','abc_f3_a09_descuentos_cortesias','tabla','public','abc_descuento_politicas'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','tabla','public','abc_descuento_autorizaciones'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','tabla','public','abc_descuento_aprobacion_intentos'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','tabla','public','abc_descuentos_aplicados'),
    ('20260926110000','abc_f3_a10_kitchen_commands','tabla','public','tpv_estaciones_preparacion'),
    ('20260926110000','abc_f3_a10_kitchen_commands','tabla','public','tpv_producto_estaciones'),
    ('20260926110000','abc_f3_a10_kitchen_commands','tabla','public','comandas_preparacion'),
    ('20260926110000','abc_f3_a10_kitchen_commands','tabla','public','comanda_lineas'),
    ('20260926203000','abc_f3_a02_operating_day_a11','tabla','private','abc_operating_day_reglas'),
    ('20260929213000','abc_f4_b04_unknown_payment','tabla','public','abc_cobro_incidencias'),
    ('20260930100000','abc_f4_b06_non_sale_receipts','tabla','public','abc_cobros_no_venta'),
    ('20260930103000','abc_f4_b06_advance_traceability','tabla','public','abc_anticipo_movimientos'),
    ('20260930120000','abc_f4_b06_policy_catalog','tabla','public','abc_b06_politica_conceptos'),
    ('20260930150000','abc_f4_b07_provider_registry','tabla','private','abc_b07_proveedores'),
    ('20260930150000','abc_f4_b07_provider_registry','tabla','private','abc_b07_cuentas_comerciales'),
    ('20260930160000','abc_f4_b07_event_processing','tabla','public','abc_b07_eventos_proveedor'),
    ('20260930230000','abc_f4_b09_settlements_disputes','tabla','public','abc_b09_liquidaciones'),
    ('20260930230000','abc_f4_b09_settlements_disputes','tabla','public','abc_b09_liquidacion_lineas'),
    ('20260930230000','abc_f4_b09_settlements_disputes','tabla','public','abc_b09_disputas'),
    ('20260930233000','abc_f4_b09_import_resolution','tabla','public','abc_b09_operaciones'),
    ('20261001150000','abc_f5_c05_document_series','tabla','public','abc_c05_series_documentales'),
    ('20261001150000','abc_f5_c05_document_series','tabla','public','abc_c05_documentos_emitidos'),
    ('20261001160000','abc_f5_c06_document_types','tabla','public','abc_c06_documentos_clasificados'),
    ('20261001170000','abc_f5_c07_fiscal_gate','tabla','public','abc_c07_modalidades_fiscales'),
    ('20261001170000','abc_f5_c07_fiscal_gate','tabla','public','abc_c07_evaluaciones_fiscales'),
    ('20261001180000','abc_f5_c08_document_retention','tabla','public','abc_c08_documento_versiones'),
    ('20261001180000','abc_f5_c08_document_retention','tabla','public','abc_c08_correcciones_documentales'),
    ('20261001190000','abc_f5_c09_document_printing','tabla','public','abc_c09_impresiones_documentales'),
    ('20261001200000','abc_f5_c10_document_delivery','tabla','public','abc_c10_entregas_documentales'),
    ('20261001210000','abc_f5_c11_explainable_reconciliation','tabla','public','abc_c11_conciliaciones_documentales'),
    ('20261001220000','abc_f5_c12_close_rehearsal','tabla','public','abc_c12_ensayos_cierre'),
    ('20261002190000','abc_config_pieza1_dia_cajas','tabla','public','abc_config_ajustes'),
    ('20261002210000','abc_config_pieza2_diferencia_caja','tabla','public','caja_cierre_diferencias'),
    ('20261002220000','abc_config_pieza3_modalidades','tabla','public','abc_local_modalidades'),
    ('20261002230000','abc_config_pieza4_equipos','tabla','public','abc_local_equipos'),
    ('20261002240000','abc_config_pieza5_permisos','tabla','public','abc_capacidades_rol'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','funcion','private','abc_a09_lock_config_context'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','funcion','private','abc_a09_lock_config_context_write'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','funcion','private','abc_a09_config_lock_trigger'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','funcion','private','abc_descuento_politica_usuario'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','funcion','public','abc_listar_descuento_politicas'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','funcion','public','abc_configurar_descuento_politica'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','funcion','private','abc_a09_solicitud_dentro_limite'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','funcion','private','abc_a09_snapshot_solicitud'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','funcion','private','abc_a09_politica_puede_autorizar'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','funcion','public','abc_aplicar_descuento_cuenta'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','funcion','public','abc_aprobar_descuento_cuenta'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','funcion','private','abc_a09_guard_fiscal_linea'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','funcion','private','abc_a09_proyectar_centimos'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','funcion','private','abc_a09_jcs'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','funcion','private','abc_a09_snapshot_hash'),
    ('20260924160739','abc_f3_a09_descuentos_cortesias','funcion','private','abc_a09_validar_importe_snapshot'),
    ('20260926110000','abc_f3_a10_kitchen_commands','funcion','private','abc_a10_tiene_capacidad'),
    ('20260926110000','abc_f3_a10_kitchen_commands','funcion','private','abc_a10_estacion_producto'),
    ('20260926110000','abc_f3_a10_kitchen_commands','funcion','private','abc_a10_snapshot_linea'),
    ('20260926110000','abc_f3_a10_kitchen_commands','funcion','private','abc_a10_encolar_comanda'),
    ('20260926110000','abc_f3_a10_kitchen_commands','funcion','private','abc_a10_procesar_transiciones_linea'),
    ('20260926110000','abc_f3_a10_kitchen_commands','funcion','public','abc_crear_estacion_preparacion'),
    ('20260926110000','abc_f3_a10_kitchen_commands','funcion','public','abc_actualizar_estacion_preparacion'),
    ('20260926110000','abc_f3_a10_kitchen_commands','funcion','public','abc_asignar_producto_estacion'),
    ('20260926110000','abc_f3_a10_kitchen_commands','funcion','public','abc_enviar_cambio_comanda'),
    ('20260926110000','abc_f3_a10_kitchen_commands','funcion','public','abc_reimprimir_comanda'),
    ('20260926110000','abc_f3_a10_kitchen_commands','funcion','public','abc_resolver_merma_comanda_linea'),
    ('20260926110000','abc_f3_a10_kitchen_commands','funcion','public','abc_listar_comandas_estacion'),
    ('20260926110000','abc_f3_a10_kitchen_commands','funcion','public','abc_reclamar_efectos_cocina'),
    ('20260926110000','abc_f3_a10_kitchen_commands','funcion','public','abc_confirmar_entrega_comanda'),
    ('20260926203000','abc_f3_a02_operating_day_a11','funcion','private','abc_resolver_operating_day_contexto'),
    ('20260927203000','abc_f3_a08_2_payment_interlock','funcion','private','abc_cuenta_tiene_cobro_incierto'),
    ('20260927203000','abc_f3_a08_2_payment_interlock','funcion','private','abc_bloquear_cuenta_cobro_interlock'),
    ('20260927203000','abc_f3_a08_2_payment_interlock','funcion','private','abc_exigir_cuenta_sin_cobro_incierto'),
    ('20260928223000','pm10_cierre_sesion_caja','funcion','public','abc_cerrar_sesion_caja'),
    ('20260929040000','abc_f4_b02_b03_checkout_bridge','funcion','private','abc_f4_lineas_cobrables_cuenta'),
    ('20260929040000','abc_f4_b02_b03_checkout_bridge','funcion','public','abc_preparar_checkout_cuenta'),
    ('20260929213000','abc_f4_b04_unknown_payment','funcion','public','abc_abrir_incidencia_cobro'),
    ('20260929213000','abc_f4_b04_unknown_payment','funcion','public','abc_resolver_incidencia_cobro'),
    ('20260929213000','abc_f4_b04_unknown_payment','funcion','public','abc_listar_incidencias_cobro'),
    ('20260929220000','abc_f4_b05_mixed_payments','funcion','public','abc_estado_pago_mixto_cuenta'),
    ('20260930160000','abc_f4_b07_event_processing','funcion','private','abc_b07_payload_sin_tarjeta'),
    ('20260930160000','abc_f4_b07_event_processing','funcion','public','abc_b07_procesar_evento'),
    ('20260930233000','abc_f4_b09_import_resolution','funcion','private','abc_b09_requerir_service_role'),
    ('20260930233000','abc_f4_b09_import_resolution','funcion','private','abc_b09_iniciar_operacion'),
    ('20260930233000','abc_f4_b09_import_resolution','funcion','private','abc_b09_completar_operacion'),
    ('20260930233000','abc_f4_b09_import_resolution','funcion','public','abc_b09_importar_liquidacion'),
    ('20260930233000','abc_f4_b09_import_resolution','funcion','public','abc_b09_vincular_linea'),
    ('20260930233000','abc_f4_b09_import_resolution','funcion','public','abc_b09_resolver_disputa'),
    ('20261001090000','abc_f4_b10_card_data_boundary','funcion','private','abc_b10_payload_sin_datos_tarjeta'),
    ('20261001140000','abc_f5_c04_close_reopen','funcion','public','abc_iniciar_cierre_sesion_caja'),
    ('20261001140000','abc_f5_c04_close_reopen','funcion','public','abc_confirmar_cierre_provisional'),
    ('20261001140000','abc_f5_c04_close_reopen','funcion','public','abc_finalizar_cierre_sesion_caja'),
    ('20261001140000','abc_f5_c04_close_reopen','funcion','public','abc_reabrir_cierre_provisional'),
    ('20261001150000','abc_f5_c05_document_series','funcion','private','abc_c05_guard_documento'),
    ('20261001150000','abc_f5_c05_document_series','funcion','public','abc_reservar_numero_documental'),
    ('20261001150000','abc_f5_c05_document_series','funcion','public','abc_resolver_emision_documental'),
    ('20261001160000','abc_f5_c06_document_types','funcion','private','abc_c06_guard_clasificacion'),
    ('20261001160000','abc_f5_c06_document_types','funcion','public','abc_clasificar_documento'),
    ('20261001170000','abc_f5_c07_fiscal_gate','funcion','private','abc_c07_guard_config'),
    ('20261001170000','abc_f5_c07_fiscal_gate','funcion','private','abc_c07_guard_evaluacion'),
    ('20261001170000','abc_f5_c07_fiscal_gate','funcion','public','abc_configurar_modalidad_fiscal'),
    ('20261001170000','abc_f5_c07_fiscal_gate','funcion','public','abc_evaluar_documento_fiscal'),
    ('20261001180000','abc_f5_c08_document_retention','funcion','private','abc_c08_guard_version'),
    ('20261001180000','abc_f5_c08_document_retention','funcion','private','abc_c08_guard_correction'),
    ('20261001180000','abc_f5_c08_document_retention','funcion','public','abc_conservar_documento_emitido'),
    ('20261001180000','abc_f5_c08_document_retention','funcion','public','abc_registrar_correccion_documental'),
    ('20261001190000','abc_f5_c09_document_printing','funcion','private','abc_c09_guard_print'),
    ('20261001190000','abc_f5_c09_document_printing','funcion','public','abc_registrar_impresion_documental'),
    ('20261001200000','abc_f5_c10_document_delivery','funcion','private','abc_c10_guard_delivery'),
    ('20261001200000','abc_f5_c10_document_delivery','funcion','public','abc_registrar_entrega_documental'),
    ('20261001210000','abc_f5_c11_explainable_reconciliation','funcion','private','abc_c11_guard_reconciliation'),
    ('20261001210000','abc_f5_c11_explainable_reconciliation','funcion','public','abc_generar_conciliacion_documental'),
    ('20261001220000','abc_f5_c12_close_rehearsal','funcion','private','abc_c12_guard_rehearsal'),
    ('20261001220000','abc_f5_c12_close_rehearsal','funcion','public','abc_ensayar_cierre_sesion_caja'),
    ('20261002150000','abc_p3_catalogo_autoritativo','funcion','private','abc_catalogo_puede_gestionar'),
    ('20261002150000','abc_p3_catalogo_autoritativo','funcion','private','abc_catalogo_numero'),
    ('20261002150000','abc_p3_catalogo_autoritativo','funcion','public','abc_catalogo_guardar_productos'),
    ('20261002190000','abc_config_pieza1_dia_cajas','funcion','private','abc_config_puede_configurar'),
    ('20261002190000','abc_config_pieza1_dia_cajas','funcion','private','abc_ajuste_cajas_max'),
    ('20261002190000','abc_config_pieza1_dia_cajas','funcion','private','abc_config_dia_evento'),
    ('20261002190000','abc_config_pieza1_dia_cajas','funcion','public','abc_configurar_ajuste'),
    ('20261002190000','abc_config_pieza1_dia_cajas','funcion','public','abc_obtener_ajustes'),
    ('20261002190000','abc_config_pieza1_dia_cajas','funcion','public','abc_configurar_dia_operativo'),
    ('20261002210000','abc_config_pieza2_diferencia_caja','funcion','private','abc_ajuste_caja_umbral'),
    ('20261002210000','abc_config_pieza2_diferencia_caja','funcion','private','abc_cfg2_diferencia_estado'),
    ('20261002210000','abc_config_pieza2_diferencia_caja','funcion','private','abc_cfg2_guard_diferencia_caja'),
    ('20261002210000','abc_config_pieza2_diferencia_caja','funcion','public','abc_registrar_diferencia_caja'),
    ('20261002210000','abc_config_pieza2_diferencia_caja','funcion','public','abc_decidir_diferencia_caja'),
    ('20261002210000','abc_config_pieza2_diferencia_caja','funcion','public','abc_obtener_diferencia_caja'),
    ('20261002220000','abc_config_pieza3_modalidades','funcion','private','abc_modalidad_habilitada'),
    ('20261002220000','abc_config_pieza3_modalidades','funcion','private','abc_modalidades_habilitadas'),
    ('20261002220000','abc_config_pieza3_modalidades','funcion','public','abc_configurar_modalidad_local'),
    ('20261002220000','abc_config_pieza3_modalidades','funcion','public','abc_obtener_modalidades_local'),
    ('20261002220000','abc_config_pieza3_modalidades','funcion','private','abc_modalidad_guard_cuenta'),
    ('20261002230000','abc_config_pieza4_equipos','funcion','public','abc_configurar_equipo_local'),
    ('20261002230000','abc_config_pieza4_equipos','funcion','public','abc_listar_equipos_local'),
    ('20261002240000','abc_config_pieza5_permisos','funcion','private','abc_cap_catalogo'),
    ('20261002240000','abc_config_pieza5_permisos','funcion','private','abc_cap_techo_permite'),
    ('20261002240000','abc_config_pieza5_permisos','funcion','private','abc_cap_rol_configurable'),
    ('20261002240000','abc_config_pieza5_permisos','funcion','private','abc_cap_rol_retirado'),
    ('20261002240000','abc_config_pieza5_permisos','funcion','private','abc_cap_efectiva'),
    ('20261002240000','abc_config_pieza5_permisos','funcion','private','abc_config_puede_configurar_empresa'),
    ('20261002240000','abc_config_pieza5_permisos','funcion','public','abc_configurar_capacidad_rol'),
    ('20261002240000','abc_config_pieza5_permisos','funcion','public','abc_obtener_capacidades_rol'),
    ('20261002240000','abc_config_pieza5_permisos','funcion','public','abc_listar_roles_retirados'),
    ('20261002240000','abc_config_pieza5_permisos','funcion','private','abc_cfg5_guard_rol_retirado'),
    ('20261002250000','abc_config_pieza6d_dia_operativo','funcion','public','abc_obtener_dia_operativo_local'),
    ('20261003100000','abc_config_d13_reembolsos_aprobacion','funcion','public','abc_aprobar_reembolso'),
    ('20261003120000','abc_a09_eventos_descuento_cuenta','funcion','public','abc_listar_eventos_descuento_cuenta')
),
estado as (
  select o.migracion, o.nombre, o.tipo, o.esquema, o.objeto,
         case o.tipo
           when 'tabla' then to_regclass(format('%I.%I', o.esquema, o.objeto)) is not null
           else exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = o.esquema and p.proname = o.objeto)
         end as existe
    from objetos o
)
select migracion, nombre,
       count(*) as objetos_nuevos,
       count(*) filter (where existe) as existen,
       case when count(*) filter (where existe) = count(*) then 'todos'
            when count(*) filter (where existe) = 0 then 'ninguno'
            else 'ALGUNOS (deriva)' end as veredicto,
       string_agg(objeto, ', ' order by objeto) filter (where not existe) as faltan
  from estado
 group by migracion, nombre
 order by migracion;

-- (las migraciones que no crean tablas ni funciones nuevas, solo reemplazan funciones o cambian columnas, no salen en P2: se comprueban con P1, P3 y P4)

-- ============================================================================================================================
-- P3 · Huellas md5 de las funciones que cada migración exige conocer EXACTAMENTE (si no coinciden, la migración se niega a aplicarse y no
--      cambia nada). La corrección de PM07 acepta dos versiones: el borrador de producción (se corrige) y la correcta (repetición sin efecto): una de las
--      dos filas dará COINCIDE y la otra DISTINTA; cualquier otra huella es una deriva nueva. La fórmula es la de la propia migración: pieza 1 y pieza 2 usan md5(prosrc); pieza 5 y D13 usan md5(prosrc sin \r).
-- ============================================================================================================================
with esperado(migracion, firma, md5_esperado, sin_cr) as (
  values
    ('pieza1 20261002190000', 'public.abc_abrir_sesion_caja(text,text,text,uuid,uuid,uuid,uuid,text,numeric,date)', '416d085f933f188e1581d6087cece61d', false),
    ('pieza2 20261002210000', 'public.abc_configurar_ajuste(text,text,text,text,jsonb,text)', '21e043efa2354d64518f2606ef642dd8', false),
    ('pieza2 20261002210000', 'public.abc_obtener_ajustes(text,text)', '05722887fbdcab94e149b844020960e3', false),
    ('pieza5 20261002240000', 'private.abc_tiene_capacidad(text,text,text)', '130b601fe56233b852feb8caa3f4d0fc', true),
    ('pieza5 20261002240000', 'private.abc_a10_tiene_capacidad(text,text,text)', '998071080dee9187ea4d571b6f4fac51', true),
    ('pieza5 20261002240000', 'public.abc_reabrir_cierre_provisional(text,text,text,uuid,uuid,text,date)', 'd19658296237a9b05814a35a72096914', true),
    ('d13 20261003100000', 'public.abc_solicitar_reembolso(text,text,text,uuid,uuid,numeric,text,uuid,date)', '3b7f35bdfe8a753aa479290fa99001e9', true),
    ('d13 20261003100000', 'public.abc_confirmar_reembolso_efectivo(text,text,text,uuid,uuid,uuid,uuid,date)', '760a2afd8a0049bae6d7ed927eaffe95', true),
    ('d13 20261003100000', 'public.abc_cancelar_reembolso(text,text,text,uuid,text,uuid,date)', 'd7cb66acc9cc9514f4ecc572f10d7334', true),
    ('d13 20261003100000', 'private.abc_cap_catalogo()', '071f31a0df29ded3b2d7346b1f4344aa', true),
    ('d13 20261003100000', 'private.abc_cap_techo_permite(text,text)', '210fcaa1f84cd6c953dd499ab51b10c0', true),
    ('pm07fix 20261003130000 (borrador de producción, a corregir)', 'private.pm07_numero_catalogo(text,numeric)', '3dcbe27249f1fd2d37c40ea6398d0215', true),
    ('pm07fix 20261003130000 (versión correcta)', 'private.pm07_numero_catalogo(text,numeric)', '7f36af3c791b2d94a2c76aed2ee4a095', true)
)
select e.migracion, e.firma,
       to_regprocedure(e.firma) is not null as existe,
       e.md5_esperado,
       case when to_regprocedure(e.firma) is null then null
            when e.sin_cr then (select md5(replace(p.prosrc, chr(13), '')) from pg_proc p where p.oid = to_regprocedure(e.firma))
            else (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure(e.firma)) end as md5_en_produccion,
       case when to_regprocedure(e.firma) is null then 'NO EXISTE'
            when (case when e.sin_cr then (select md5(replace(p.prosrc, chr(13), '')) from pg_proc p where p.oid = to_regprocedure(e.firma))
                       else (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure(e.firma)) end) = e.md5_esperado then 'COINCIDE'
            else 'DISTINTA' end as veredicto
  from esperado e
 order by e.migracion, e.firma;

-- ============================================================================================================================
-- P4 · Copia de seguridad de las 46 funciones que las migraciones candidatas REEMPLAZAN (create or replace). Es la base de la recuperación:
--      guardar la salida completa (definición incluida) ANTES de aplicar nada. Solo lectura de catálogo.
-- ============================================================================================================================
select n.nspname as esquema, p.proname as funcion, pg_get_function_identity_arguments(p.oid) as argumentos,
       md5(p.prosrc) as md5_prosrc, pg_get_functiondef(p.oid) as definicion
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where (n.nspname || '.' || p.proname) = any(array[
    'private.abc_a10_procesar_transiciones_linea',
    'private.abc_a10_tiene_capacidad',
    'private.abc_b06_validar_anticipo_movimiento',
    'private.abc_c04_bloqueos_cierre',
    'private.abc_c04_guard_final_session',
    'private.abc_calcular_linea_tpv',
    'private.abc_calcular_linea_tpv_configurada',
    'private.abc_cap_catalogo',
    'private.abc_cap_techo_permite',
    'private.abc_descuento_politica',
    'private.abc_tiene_capacidad',
    'private.pm07_inicializar_stock_desde_productos_kv',
    'private.pm07_numero_catalogo',
    'private.pm09_bloquear_operation_id_stock',
    'private.pm10_numero_catalogo',
    'public.abc_abrir_cuenta',
    'public.abc_abrir_sesion_caja',
    'public.abc_actualizar_estacion_preparacion',
    'public.abc_asignar_cuota_importe',
    'public.abc_asignar_producto_estacion',
    'public.abc_b07_obtener_configuracion',
    'public.abc_catalogo_guardar_productos',
    'public.abc_configurar_ajuste',
    'public.abc_confirmar_efectivo',
    'public.abc_confirmar_entrega_comanda',
    'public.abc_confirmar_reembolso_efectivo',
    'public.abc_crear_estacion_preparacion',
    'public.abc_enviar_cambio_comanda',
    'public.abc_iniciar_cobro',
    'public.abc_listar_responsables_cuenta',
    'public.abc_mover_cantidad_linea_cuenta',
    'public.abc_obtener_ajustes',
    'public.abc_reabrir_cierre_provisional',
    'public.abc_recuperar_cuenta',
    'public.abc_registrar_movimiento_anticipo',
    'public.abc_reimprimir_comanda',
    'public.abc_resolver_intento',
    'public.abc_resolver_merma_comanda_linea',
    'public.abc_revertir_cuota_importe',
    'public.abc_solicitar_reembolso',
    'public.abc_unir_cuentas',
    'public.registrar_devolucion_venta_pm09',
    'public.registrar_venta_stock_carrito_pm09',
    'public.registrar_venta_stock_pm09',
    'public.revertir_venta_stock_carrito_pm09',
    'public.revertir_venta_stock_pm09'
])
 order by n.nspname, p.proname, 3;

-- ============================================================================================================================
-- P5 · Permisos del navegador (rol `authenticated`) sobre las tablas que la migración m04d (ACL parity) cierra. Si en producción el
--      navegador TODAVÍA puede leerlas, m04d no está aplicada allí (y entonces las dos correcciones de pantalla de «cobro» y «historial de
--      descuentos» no son necesarias hasta que se aplique m04d, pero sí lo serán después). Si no puede, esos arreglos son imprescindibles.
-- ============================================================================================================================
select t.nombre,
       to_regclass('public.' || t.nombre) is not null as existe,
       case when to_regclass('public.' || t.nombre) is null then null
            else has_table_privilege('authenticated', 'public.' || t.nombre, 'select') end as authenticated_puede_leer,
       case when to_regclass('public.' || t.nombre) is null then null
            else has_table_privilege('anon', 'public.' || t.nombre, 'select') end as anon_puede_leer
  from (values
    ('abc_c05_documentos_emitidos'),
    ('abc_c05_series_documentales'),
    ('abc_c06_documentos_clasificados'),
    ('abc_c07_evaluaciones_fiscales'),
    ('abc_c07_modalidades_fiscales'),
    ('abc_c08_correcciones_documentales'),
    ('abc_c08_documento_versiones'),
    ('abc_c09_impresiones_documentales'),
    ('abc_c10_entregas_documentales'),
    ('abc_c11_conciliaciones_documentales'),
    ('abc_c12_ensayos_cierre'),
    ('abc_capacidades_rol'),
    ('abc_cobro_incidencias'),
    ('abc_config_ajustes'),
    ('abc_descuento_politicas'),
    ('abc_eventos'),
    ('abc_local_equipos'),
    ('abc_local_modalidades'),
    ('abc_operaciones'),
    ('caja_cierre_diferencias'),
    ('efectos_pendientes'),
    ('operaciones_procesadas'),
    ('pago_aplicaciones'),
    ('pago_intentos'),
    ('pm29_res'),
    ('prefiltro_limites'),
    ('reembolso_aplicaciones'),
    ('reservas_saldo')
) as t(nombre)
 order by t.nombre;

-- ============================================================================================================================
-- P6 · Datos reales que tocan las migraciones (solo RECUENTOS; NULL = la tabla no existe todavía en producción)
-- ============================================================================================================================
select t.tabla,
       case when to_regclass(t.tabla) is null then null
            else (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %s', t.tabla), false, true, '')))[1]::text::bigint end as filas,
       t.por_que
  from (values
    ('public.empresas', 'cuántas empresas hay'),
    ('public.locales', 'cuántos locales hay (el piloto real)'),
    ('public.membresias_usuario', 'personas con acceso (pieza 5 cambia permisos y bloquea tres roles)'),
    ('public.almacen_kv', 'copia legada de datos; los bootstraps PM07 y PM10 la leen'),
    ('public.stock_ubicacion', 'PM07 inserta filas aquí desde los productos legados'),
    ('public.catalogo_tpv_productos', 'PM10 inserta aquí desde los productos legados; P3 interpreta sus precios con IVA incluido'),
    ('public.entidades_fiscales', 'PM10 crea un contexto fiscal SIMULADO en locales activos sin configuración'),
    ('public.caja_sesiones', 'sesiones de caja'),
    ('public.cuentas_comerciales', 'cuentas (pedidos) del TPV'),
    ('public.pagos', 'pagos reales o de prueba'),
    ('public.reembolsos', 'D13 rellena aprobado_por/aprobado_at de todos los existentes'),
    ('public.efectos_pendientes', 'cola de envíos (proveedor de pagos, etc.)'),
    ('public.abc_eventos', 'bitácora de eventos'),
    ('public.abc_config_ajustes', 'ajustes de configuración (pieza 1 en adelante)'),
    ('public.abc_capacidades_rol', 'permisos configurados (pieza 5)')
  ) as t(tabla, por_que)
 order by t.tabla;

-- ============================================================================================================================
-- P7 · Quién tiene un rol que la pieza 5 RETIRA (Churrero/a, Básico, Estándar). Solo cuántas membresías por rol y estado, sin nombres.
--      Tras aplicar la pieza 5 esas personas pierden los permisos ABC y no se puede dar de alta ni reactivar a nadie con esos roles.
-- ============================================================================================================================
select m.rol, m.activo, (m.local_id is null and coalesce(m.todos_locales, false)) as todos_los_locales, count(*) as membresias
  from public.membresias_usuario m
 where m.rol in ('Churrero/a', 'Básico', 'Estándar')
 group by 1, 2, 3
 order by 1, 2, 3;

select m.rol, m.activo, count(*) as membresias
  from public.membresias_usuario m
 group by 1, 2
 order by 1, 2;

-- ============================================================================================================================
-- P8 · Estado operativo (para elegir una ventana tranquila): cajas abiertas, cuentas abiertas, reembolsos pendientes, envíos pendientes, pedidos sin cerrar y pagos.
--      Ojo: ninguna operación del servidor cierra una cuenta (solo la fusión), así que «cuentas ABIERTA» no mide si hay algo en curso; sí lo miden los pedidos aún sin servir ni cancelar y los pagos.
--      Las columnas se leen por nombre habitual; si alguna no existe en producción la consulta falla SIN efectos y se anota la deriva.
-- ============================================================================================================================
select 'caja_sesiones por estado' as que, estado::text as valor, count(*) as filas from public.caja_sesiones group by estado
union all
select 'cuentas_comerciales por estado', estado::text, count(*) from public.cuentas_comerciales group by estado
union all
select 'reembolsos por estado', estado::text, count(*) from public.reembolsos group by estado
union all
select 'efectos_pendientes por estado', estado::text, count(*) from public.efectos_pendientes group by estado
union all
select 'pedidos_tpv por estado', estado::text, count(*) from public.pedidos_tpv group by estado
union all
select 'pagos por estado', estado::text, count(*) from public.pagos group by estado
order by 1, 2;

-- ============================================================================================================================
-- P8b · Restos conocidos de la prueba A10 del 28/9 (decisiones 14 y 15 de Pedro, 3/10/2026: se dejan como están y P8 los acepta por identificador).
--       Esperado el 3/10/2026: 0, 0, 0 en las tres primeras filas y 2, 2, 1 en las tres últimas. Cualquier otro valor = hay algo en curso que no es un resto conocido: PARAR y avisar.
-- ============================================================================================================================
select 'fuera de lo conocido: cuentas ABIERTA (esperado 0)' as que, count(*) as filas
  from public.cuentas_comerciales
 where estado = 'ABIERTA' and id::text not in ('528c0715-5026-4aa0-bbfa-6ff3db8e848a', '40431ef0-84f7-41d7-8e3e-bf06685d60b7')
union all
select 'fuera de lo conocido: pedidos BORRADOR, ABIERTO o ENVIADO (esperado 0)', count(*)
  from public.pedidos_tpv
 where estado in ('BORRADOR', 'ABIERTO', 'ENVIADO') and id::text not in ('79762954-51a8-4f81-8ef2-231259d2de22', 'c9d51daf-2b14-4642-a377-36aa9b79510f')
union all
select 'fuera de lo conocido: efectos PENDIENTE o EN_PROCESO (esperado 0)', count(*)
  from public.efectos_pendientes
 where estado in ('PENDIENTE', 'EN_PROCESO') and id::text <> '22ca6555-18b8-4d2f-8037-81ed2028fd6b'
union all
select 'resto conocido: cuentas aun ABIERTA (esperado 2)', count(*)
  from public.cuentas_comerciales
 where estado = 'ABIERTA' and id::text in ('528c0715-5026-4aa0-bbfa-6ff3db8e848a', '40431ef0-84f7-41d7-8e3e-bf06685d60b7')
union all
select 'resto conocido: pedidos aun ENVIADO (esperado 2)', count(*)
  from public.pedidos_tpv
 where estado = 'ENVIADO' and id::text in ('79762954-51a8-4f81-8ef2-231259d2de22', 'c9d51daf-2b14-4642-a377-36aa9b79510f')
union all
select 'resto conocido: comanda aun PENDIENTE (esperado 1)', count(*)
  from public.efectos_pendientes
 where estado = 'PENDIENTE' and id::text = '22ca6555-18b8-4d2f-8037-81ed2028fd6b'
order by 1;

-- ============================================================================================================================
-- P9 · Reglas de día operativo ya existentes (A11) y la última actividad (para no promocionar durante el servicio)
-- ============================================================================================================================
select 'ultimo_evento' as que, max(occurred_at)::text as valor from public.abc_eventos
union all
select 'ultima_sesion_caja', max(created_at)::text from public.caja_sesiones;
