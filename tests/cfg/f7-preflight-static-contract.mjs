// Contrato estático del paquete de promoción a producción (F7, 3/10/2026): el archivo de comprobaciones previas es de SOLO LECTURA y sus listas
// (objetos que crea cada migración, huellas md5 exigidas, funciones reemplazadas) coinciden con las migraciones reales del repositorio; y el documento
// de preparación lista todas las migraciones candidatas.
//
// Por qué: el archivo `docs/plan-abc/F7_PROMOCION_PRODUCCION_PREFLIGHT_SOLO_LECTURA_2026-10-03.sql` se ejecutará algún día contra producción. Si una
// migración nueva (o una huella) cambia y el archivo no se actualiza, la foto previa mentiría; y si alguien le añadiera una sentencia que escribe,
// dejaría de ser de solo lectura. No necesita librerías ni base de datos:
//   node tests/cfg/f7-preflight-static-contract.mjs
// F7_PREFLIGHT_SQL y F7_DOC (opcionales) permiten probar otras versiones (mutantes).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const sqlRuta = process.env.F7_PREFLIGHT_SQL || join(REPO, 'docs/plan-abc/F7_PROMOCION_PRODUCCION_PREFLIGHT_SOLO_LECTURA_2026-10-03.sql');
const docRuta = process.env.F7_DOC || join(REPO, 'docs/plan-abc/F7_PROMOCION_PRODUCCION_PREPARACION_2026-10-03.md');
const sql = readFileSync(sqlRuta, 'utf8');
const doc = readFileSync(docRuta, 'utf8');
const PRIMERA = '20260924160739'; // A09: primera migración candidata
const EXCLUIDAS = new Set([
  // Los paquetes PM09, P3c y D09-D11 se promueven en ventanas separadas y no forman parte de la foto F7.
  '20261006040009_abc_f5_pm09_reconcile_prod_baseline.sql',
  '20261004201358_abc_p3c_concurrencia_productos.sql',
  '20261005060000_abc_p3c_titularidad_productos.sql',
  '20261005100000_abc_p3c_lista_confirmada.sql',
  '20261010150000_abc_d09_d11_stock_order_integration.sql',
  '20261029210000_abc_d09_d11_economic_snapshot.sql',
  '20261010153000_abc_d10_legacy_refund_guard.sql',
  '20261009120000_plataforma_f1_administrador_y_empresas.sql',
  '20261009130000_plataforma_f2_eliminar_empresa.sql',
  '20261009140000_plataforma_f4_colecciones_por_empresa.sql',
  '20261009150000_plataforma_f4b_lista_productos_inicial.sql',
  '20261009160000_plataforma_f4c_lista_sin_contexto_fiscal.sql',
  '20261009170000_plataforma_f4d_empresas_vigentes.sql',
  '20261009180000_plataforma_f4e_perfiles_movimientos_push_por_empresa.sql',
  // El permiso de lookup de F5 se aplicó en una ventana separada de la foto F7.
  '20261010191547_plataforma_f5_permiso_lookup_empresa.sql',
  // Este ajuste de permisos se aplicó únicamente en QA; no forma parte de la foto F7 de promoción.
  '20261015041000_qa_revoke_authenticated_empresas_locales_20261015.sql',
  // La idempotencia y el control optimista de PM13 se validan únicamente en QA en este subcaso.
  '20261017210000_pm13_p05_idempotencia_version.sql',
  // El gate RLS de empleados de PM13 P05 se valida únicamente en QA en este subcaso,
  // misma ventana que idempotencia_version; no forma parte de la foto F7 de promoción.
  '20261017185011_pm13_p05_empleados_rls_gate.sql',
  // D01 decisión 3 (blindaje de la contraseña inicial, 16/10/2026): ventana de promoción separada,
  // igual que el resto de migraciones plataforma_f*; no forma parte de la foto F7.
  '20261016120000_plataforma_password_inicial_pendiente.sql',
  '20261016130000_plataforma_password_inicial_bloqueo_filtros.sql',
  '20261016140000_plataforma_password_inicial_bloqueo_push.sql',
  // Reconstrucción de la ventana D01 P5; se verifica y promueve por separado.
  '20261020120000_plataforma_password_inicial_bloqueo_almacen_alta_reconstruida.sql',
  // PM13 P05 de pantallas de roles fijos: se valida y aplica en QA por separado antes de decidir su promoción.
  '20261020140000_pm13_p05_roles_fijos_pantallas.sql',
  // Paquete F5 de notas TPV y recuperación A10: ventana de promoción separada,
  // con preflight propio y sin escritura PROD en esta etapa.
  '20261022130000_abc_f5_tpv_line_notes.sql',
  '20261022140000_abc_f3_a10_route_recovery.sql',
  '20261022150000_abc_f3_a10_route_recovery_merge.sql',
  // T6, propina en efectivo (24/10/2026): posterior a la foto F7 del 3/10 y parte del
  // rediseño, que todavía no se ha promovido. Su `abc_registrar_propina_efectivo` no está
  // ni debe estar en el preflight histórico; cuando esa ventana se promueva llevará el suyo.
  '20261024070000_t6_propina_efectivo.sql',
  // C07-A: borradores por emisor, con preflight propio. No forma parte de la ventana F7 del 3/10.
  '20261026175245_abc_fiscal_multiempresa_borradores.sql',
  // C07-B: panel configurable multiempresa, validación y promoción separadas del paquete F7 histórico.
  '20261026182012_abc_fiscal_multiempresa_panel.sql',
  // C07-C/D: ventanas QA separadas; no forman parte de la foto F7 histórica.
  '20261027110000_abc_fiscal_multiempresa_delegacion.sql',
  '20261027111500_abc_fiscal_multiempresa_delegacion_accept.sql',
  '20261027113000_abc_fiscal_multiempresa_representacion_read.sql',
  '20261027114500_abc_fiscal_multiempresa_delegacion_lifecycle_checks.sql',
  '20261027130000_abc_f7_c07d_c05_reconcile.sql',
  '20261027131500_abc_f7_c07d_fiscal_chain_queue.sql',
  '20261027133000_abc_f7_c07d_chain_hardening.sql',
  '20261027134500_abc_f7_c07d_fk_indexes.sql',
  '20261027135000_abc_f7_c07d_entity_fk_index.sql',
  '20261027143000_abc_f7_c07d_checkout_emit_qa.sql',
  '20261027150000_abc_f7_c07d_d2_emission_config.sql',
  '20261027150403_abc_f7_c07d_d3_pilot_sandbox.sql',
  '20261027151000_abc_f7_c07d_d2_emission_config_fix.sql',
  '20261027152000_abc_f7_c07d_d2_adapter_scope_fix.sql',
  '20261027160000_abc_f7_c07d_d2_emission_wiring.sql',
  '20261027161000_abc_f7_c07d_d2_emission_resolver_lock_fix.sql',
  '20261027162000_abc_f7_c07d_d2_emission_config_indexes.sql',
  // A-01 (seguridad): la baja de empleado retira la membresia. Es posterior a
  // la foto F7 del 3/10 y se promueve en su propia ventana, con el contrato
  // tests/pm11/db/a01-baja-revoca-acceso-contract.mjs contra Postgres real.
  '20261108100000_a01_baja_empleado_revoca_acceso.sql',
  // A-02: la venta fiscal se cierra y se sella al saldar la cuenta. Posterior
  // a la foto F7 del 3/10, con contrato propio contra Postgres real en
  // tests/f5/c07/db/a02-venta-fiscal-sellada-contract.mjs.
  '20261108170000_a02_cerrar_y_sellar_venta_fiscal.sql',
  // M-01: el PIN de empleado pasa a una tabla privada y a RPC server-side;
  // es una ventana posterior con contrato propio contra Postgres real.
  '20261108120000_m01_server_pin_authentication.sql',
  // M-01 follow-up: activa RLS sobre la tabla privada del PIN; es posterior
  // a la foto F7 histórica y tiene contrato propio.
  '20261110190000_m01_enable_pin_rls.sql',
  // N-02: reconciliación de funciones ya versionadas para corregir la
  // divergencia histórica entre QA y producción; queda fuera de la foto F7.
  '20261108193000_n02_reconcile_deployed_db_functions.sql',
  // N-02 follow-up: alinea en QA el ACL histórico de obtener_contexto_operativo;
  // es posterior a la foto F7 y se valida en su propia ventana.
  '20261110200000_n02_context_acl_parity.sql',
  // N-02 follow-up: replica en QA tres utilidades de infraestructura observadas
  // en producción; no forma parte de la foto F7 histórica.
  '20261110210000_n02_legacy_infrastructure_parity.sql',
  // N-02 follow-up: replica en QA guards y triggers de infraestructura activos;
  // no forma parte de la foto F7 histórica.
  '20261110220000_n02_remaining_infrastructure_parity.sql',
  '20261027163000_abc_f7_c07d_d2_3_frontend_config_status.sql',
  // F8 C04: alta de terminal/caja por propietario, con preflight propio.
  '20261027200000_abc_f8_c04_terminal_caja_propietario.sql',
  // Corrección posterior de F8 C04 aplicada primero en QA; no forma parte de la foto F7 histórica.
  '20261028193000_abc_f8_c04_defer_terminal_fk.sql',
  // Ventanas QA posteriores a F7: recepción, rutas bloqueadas y cierre de cuenta.
  '20261028170000_pm10_recepcion_stock_atomica.sql',
  '20261028180000_abc_f3_a10_requeue_blocked_routes.sql',
  '20261028190000_abc_f4_cuenta_cierre_pagada.sql',
  // Correcciones A10 de rutas y preparación: ventana QA posterior a la foto F7.
  '20261101093000_abc_f3_a10_disable_auto_route_requeue.sql',
  '20261101094000_abc_f3_a10_assignment_without_historical_requeue.sql',
  '20261102100000_abc_f3_a10c_preparation_route_guard.sql',
  // A10 preparación: ventana QA posterior a la foto F7 histórica.
  '20261029190000_abc_f3_a10_preparation_mode.sql',
  '20261029200000_abc_f3_a10_preparation_mode_prod_candidate.sql',
  // Corrección contextual P3c aplicada en una ventana separada; no forma parte de la foto F7 histórica.
  '20261029200000_abc_p3c_contexto_productos_production_fix.sql',
  // Autoridad del stock en la ruta contextual P3c; ventana separada de la foto F7 histórica.
  '20261030130000_abc_p3c_stock_authority.sql',
  // Atajo seguro para cambios automáticos de stock/contexto; misma ventana separada.
  '20261030143000_abc_p3c_stock_only_fast_path.sql',
  // Presentación de categorías del TPV (orden y color por local): se valida en QA
  // y se promueve en su propia ventana, con el contrato
  // tests/cfg/tpv-categorias-presentacion-db-contract.mjs. No forma parte de la
  // foto F7 histórica del 3/10.
  '20261031120000_abc_tpv_categorias_presentacion.sql',
  '20261031150000_abc_tpv_categorias_puede_configurar.sql',
  // Apertura del cobro con el pedido en cocina: se valida en QA y se promueve en su
  // propia ventana, con el contrato tests/f4/b02-b03/cobro-pedido-en-cocina-contract.sql.
  // No forma parte de la foto F7 histórica del 3/10.
  '20261031170000_abc_f4_cobro_pedido_en_cocina.sql',
  // Corrección de aislamiento Storage de Issue #190, exclusiva de QA; no forma parte de la foto F7 histórica.
  '20261107220000_issue190_qa_storage_local_isolation.sql',
  // B-02: índice posterior para el historial de errores; no forma parte de la foto F7 cerrada del 3/10.
  '20261109120000_b02_errores_sistema_fecha_idx.sql',
  // A-03/A-04: APPCC histórico y atribución server-side; ventana de Fase 3
  // posterior a la foto F7 cerrada del 3/10, con contrato propio.
  '20261109150000_a03_a04_appcc_y_atribucion.sql',
  '20261109170000_a03_appcc_cancelacion_append_only.sql',
  '20261109180000_a03_appcc_puntos_server_side.sql',
  // Corrección incremental de la respuesta de APPCC; se aplica en la ventana
  // de Fase 3 y no forma parte de la foto F7 cerrada del 3/10.
  '20261109201101_a03_appcc_correction_response.sql',
  // M-03: exige aal2 server-side para roles sensibles; posterior a la foto F7
  // histórica y se valida mediante el contrato MFA y una ventana QA propia.
  '20261110230000_m03_server_aal2_gate.sql',
  // A-04: sesión de empleado server-side para atribución en terminal compartido;
  // es posterior a la foto F7 histórica y se valida con contrato propio.
  '20261111220000_a04_server_employee_session.sql',
  // Apariencia por empresa y su delegacion pertenecen al rediseño posterior y no forman
  // parte de la foto F7 cerrada del 3/10. Hasta el 14/11/2026 este comentario decia que
  // se validaban «con su propio contrato» y ese contrato no existia: la nota hacia que una
  // ausencia pareciera cobertura. Ahora existe y se nombra, que es la unica forma de que
  // una exclusion se pueda comprobar:
  //   tests/rediseno/p01-capas-y-migraciones-contract.mjs
  // Ese contrato fija las seis funciones publicas de las dos migraciones, con su retirada
  // de public y anon y su concesion a authenticated, y ademas comprueba que esta exclusion
  // sigue nombrandolo. Si alguien quita el nombre, se pone rojo.
  '20261113090000_rediseno_apariencia_empresa.sql',
  '20261113140000_rediseno_apariencia_delegaciones.sql',
  // Politica opcional de verificacion en dos pasos (15/11/2026): reescribe la
  // puerta maestra private.la_usuario_activo() que M-03 habia dejado exigiendo
  // el segundo factor a tres cargos fijos. Ventana de promocion propia, porque
  // cambia quien puede entrar y eso no se promueve dentro de la foto F7 del
  // 3/10 sin decidirlo aparte. Lo que promete esta exclusion lo prueban:
  //   tests/rediseno/p04-mfa-politica-pglite-contract.mjs  (Postgres de verdad)
  //   tests/m03/m03-mfa-enforcement-contract.mjs            (los cinco puntos)
  '20261115120000_mfa_politica_opcional.sql',
  // Tarifas por horario de org-33 (20/11/2026): reconstruye en el repositorio dos
  // tablas y dos funciones que el 18/11 se habian creado a mano directamente en QA.
  // Es del rediseño, posterior a la foto F7 del 3/10, y ademas es de reconciliacion
  // (idempotente), asi que no se promueve dentro de esa foto. Lo que promete esta
  // exclusion lo prueba, contra un Postgres de verdad y partiendo de cero:
  //   tests/rediseno/org33-tarifas-pglite-contract.mjs
  '20261120120000_rediseno_org33_tarifas_horario.sql',
  // Emision del documento fiscal por capacidad de cobro (26/11/2026, hallazgo H-38 de la
  // auditoria del TPV): quien puede iniciar un cobro puede emitir el documento de ese cobro y
  // leer el estado de la emision. Antes lo exigian ABC_EMISOR_CAMBIAR (Propietario y
  // Encargado) y un cobro del Cajero/a se cerraba sin documento. Es posterior a la foto F7 del
  // 3/10 y cambia quien puede emitir, asi que se promueve aparte. Lo que promete esta
  // exclusion lo prueba, contra un Postgres de verdad:
  //   tests/rediseno/c07d-emision-cobro-pglite-contract.mjs
  '20261126120000_abc_f7_c07d_emision_por_capacidad_de_cobro.sql',
  // Segunda parte de H-38: la entrada de emision llama a tres primitivos de numeracion que
  // volvian a exigir ABC_EMISOR_CAMBIAR. La entrada marca la transaccion y solo esa marca
  // abre los primitivos; llamados directamente siguen cerrados al Cajero/a. Mismo contrato.
  '20261126130000_abc_f7_c07d_emision_cobro_acceso_interno.sql',
  // H-38b: el cierre de caja no detectaba ventas cobradas sin documento fiscal. Anade el
  // bloqueo VENTAS_SIN_DOCUMENTO al punto unico de bloqueos del cierre y lo clasifica como
  // BLOQUEADO en el ensayo C12. Lo prueba, contra un Postgres de verdad:
  //   tests/rediseno/c04-bloqueo-ventas-sin-documento-pglite-contract.mjs
  '20261126140000_abc_f5_c04_bloqueo_ventas_sin_documento.sql',
  // H-38b: lectura de las ventas que producen ese bloqueo, para el boton «Emitir documento
  // pendiente» del cierre. Solo lectura. Mismo contrato que la anterior.
  '20261126150000_abc_f5_c04_listar_ventas_sin_documento.sql',
  // H-21 / H-42 (decision del 27/11): cancelar el ultimo pedido vivo de una cuenta sin nada mas
  // la cierra. Parchea abc_cancelar_pedido; lo prueba, contra un Postgres de verdad:
  //   tests/rediseno/h21-cancelar-pedido-cierra-cuenta-pglite-contract.mjs
  '20261127100000_abc_f5_cancelar_pedido_cierra_cuenta_vacia.sql',
  // H-37 (decision del 27/11): la venta rapida del Cajero/a se completa por una entrada unica con el
  // permiso de cobro (solo cuentas de BARRA); las transiciones directas siguen cerradas. Contrato:
  //   tests/rediseno/h37-venta-rapida-por-cobro-pglite-contract.mjs
  '20261127110000_abc_f5_venta_rapida_completar_por_cobro.sql',
  // H-48 (verificacion en el navegador de QA, 27/11): «Cerrar cuenta pagada» no cerraba una cuenta cobrada
  // si el checkout conservaba un pago RECHAZADO o CANCELADO (tarjeta rechazada y repetida). Parchea
  // abc_cerrar_cuenta_pagada; lo prueba, contra un Postgres de verdad:
  //   tests/rediseno/h48-cerrar-cuenta-ignora-pagos-rechazados-pglite-contract.mjs
  '20261127120000_abc_f4_cerrar_cuenta_ignora_pagos_rechazados.sql',
  // H-49 (verificacion en el navegador de QA, 27/11): cancelar el pedido tras iniciar el cobro dejaba la cuenta ABIERTA para siempre
  // (H-21 exigia que no hubiera ningun checkout y no existe funcion para cancelarlo). Parchea abc_cancelar_pedido: un checkout sin
  // dinero (sin pagos o solo RECHAZADO/CANCELADO, sin incidencia abierta) deja de bloquear y se cancela con la cuenta. Lo prueba,
  // contra un Postgres de verdad:
  //   tests/rediseno/h49-cancelar-pedido-cancela-cobro-sin-dinero-pglite-contract.mjs
  '20261128130000_abc_f6_cancelar_pedido_cancela_cobro_sin_dinero.sql',
  // F6 cargos y permisos: paquete QA separado del cierre de #225; se llevará a un
  // PR propio posterior al cierre, con contratos PM13 y sin aplicar migraciones aquí.
  '20261129100000_abc_f6_cargos_propietario_permisos_libres.sql',
  '20261129110000_abc_f6_cargos_nombres_navegacion_excepciones.sql',
  '20261129120000_abc_f6_cargos_estado_eliminacion.sql',
  // H-04 / H-18 (Ola 2): encargos y pagos de encargo solo por funciones de servidor; quita TRUNCATE/REFERENCES/TRIGGER
  // sobrantes. Lo prueba, contra un Postgres de verdad:
  //   tests/rediseno/h04-h18-encargos-solo-funciones-pglite-contract.mjs
  '20261128100000_abc_f6_encargos_solo_funciones_y_privilegios.sql',
  // H-36 (Ola 2): la cuenta de empleado nueva queda con la contraseña inicial pendiente. Parchea
  // pm11_finalizar_creacion_cuenta_empleado; lo prueba:
  //   tests/rediseno/h36-cuenta-empleado-password-inicial-pglite-contract.mjs
  '20261128110000_abc_f6_cuenta_empleado_password_inicial_pendiente.sql',
  // H-17 (Ola 2): un disparador siembra la politica de segundo factor del Propietario en cada empresa nueva. Lo prueba:
  //   tests/rediseno/h17-empresa-nueva-politica-mfa-pglite-contract.mjs
  '20261128120000_abc_f6_empresa_nueva_con_politica_mfa_propietario.sql',
]);

// ---- La justificación de cada exclusión, comprobable ----
//
// Varias exclusiones de arriba se apoyan en que la migración «tiene contrato
// propio». Hasta el 15/11/2026 eso era prosa: no se podía comprobar, y una de
// las notas era directamente falsa —la del rediseño afirmaba un contrato que no
// existía—. Se barrieron las demás y resultaron ciertas, pero ninguna era
// verificable: si mañana alguien renombra o borra uno de esos contratos, la
// exclusión sigue funcionando y la migración se queda sin red sin que nada lo
// diga. Es el mismo patrón que el `return` mudo de asignar mesa y que el
// `if [ -f "$f" ]` de las regresiones heredadas: lo que falta pasa por aprobado.
//
// Aquí se nombra el contrato de cada una y se exige que exista Y que el
// manifiesto de CI lo tenga como contrato activo. Existir no basta: un contrato
// que no está en el manifiesto tampoco se ejecuta.
//
// Las exclusiones que NO aparecen en esta tabla son las que no prometen
// contrato: dicen solo que no forman parte de la foto F7, y eso no hay que
// respaldarlo con nada.
const JUSTIFICACION = {
  '20261108100000_a01_baja_empleado_revoca_acceso.sql': [
    'tests/pm11/db/a01-baja-revoca-acceso-contract.mjs',
  ],
  '20261108170000_a02_cerrar_y_sellar_venta_fiscal.sql': [
    'tests/f5/c07/db/a02-venta-fiscal-sellada-contract.mjs',
  ],
  '20261108120000_m01_server_pin_authentication.sql': [
    'tests/m01/m01-server-pin-contract.mjs',
    'tests/m01/db/m01-server-pin-postgres-contract.mjs',
  ],
  '20261110190000_m01_enable_pin_rls.sql': [
    'tests/m01/m01-pin-rls-contract.mjs',
  ],
  '20261109150000_a03_a04_appcc_y_atribucion.sql': [
    'tests/f3/a03-a04/a03-a04-appcc-atribucion-contract.mjs',
  ],
  '20261109170000_a03_appcc_cancelacion_append_only.sql': [
    'tests/f3/a03-a04/a03-a04-appcc-cancelacion-contract.mjs',
  ],
  '20261109180000_a03_appcc_puntos_server_side.sql': [
    'tests/f3/a03-a04/a03-a04-appcc-puntos-contract.mjs',
  ],
  '20261110230000_m03_server_aal2_gate.sql': [
    'tests/m03/m03-mfa-role-gate-contract.mjs',
    'tests/m03/m03-mfa-enforcement-contract.mjs',
  ],
  '20261111220000_a04_server_employee_session.sql': [
    'tests/f3/a03-a04/a04-server-attribution-contract.mjs',
  ],
  '20261113090000_rediseno_apariencia_empresa.sql': [
    'tests/rediseno/p01-capas-y-migraciones-contract.mjs',
  ],
  '20261113140000_rediseno_apariencia_delegaciones.sql': [
    'tests/rediseno/p01-capas-y-migraciones-contract.mjs',
  ],
  '20261115120000_mfa_politica_opcional.sql': [
    'tests/rediseno/p04-mfa-politica-pglite-contract.mjs',
    'tests/m03/m03-mfa-enforcement-contract.mjs',
  ],
  '20261120120000_rediseno_org33_tarifas_horario.sql': [
    'tests/rediseno/org33-tarifas-pglite-contract.mjs',
  ],
  '20261126120000_abc_f7_c07d_emision_por_capacidad_de_cobro.sql': [
    'tests/rediseno/c07d-emision-cobro-pglite-contract.mjs',
  ],  '20261126130000_abc_f7_c07d_emision_cobro_acceso_interno.sql': [
    'tests/rediseno/c07d-emision-cobro-pglite-contract.mjs',
  ],
  '20261126140000_abc_f5_c04_bloqueo_ventas_sin_documento.sql': [
    'tests/rediseno/c04-bloqueo-ventas-sin-documento-pglite-contract.mjs',
  ],  '20261126150000_abc_f5_c04_listar_ventas_sin_documento.sql': [
    'tests/rediseno/c04-bloqueo-ventas-sin-documento-pglite-contract.mjs',
  ],
  '20261127100000_abc_f5_cancelar_pedido_cierra_cuenta_vacia.sql': [
    'tests/rediseno/h21-cancelar-pedido-cierra-cuenta-pglite-contract.mjs',
  ],
  '20261127110000_abc_f5_venta_rapida_completar_por_cobro.sql': [
    'tests/rediseno/h37-venta-rapida-por-cobro-pglite-contract.mjs',
  ],
  '20261127120000_abc_f4_cerrar_cuenta_ignora_pagos_rechazados.sql': [
    'tests/rediseno/h48-cerrar-cuenta-ignora-pagos-rechazados-pglite-contract.mjs',
  ],
  '20261128100000_abc_f6_encargos_solo_funciones_y_privilegios.sql': [
    'tests/rediseno/h04-h18-encargos-solo-funciones-pglite-contract.mjs',
  ],
  '20261128110000_abc_f6_cuenta_empleado_password_inicial_pendiente.sql': [
    'tests/rediseno/h36-cuenta-empleado-password-inicial-pglite-contract.mjs',
  ],
  '20261128120000_abc_f6_empresa_nueva_con_politica_mfa_propietario.sql': [
    'tests/rediseno/h17-empresa-nueva-politica-mfa-pglite-contract.mjs',
  ],
  '20261128130000_abc_f6_cancelar_pedido_cancela_cobro_sin_dinero.sql': [
    'tests/rediseno/h49-cancelar-pedido-cancela-cobro-sin-dinero-pglite-contract.mjs',
  ],
  '20261129100000_abc_f6_cargos_propietario_permisos_libres.sql': [
    'tests/pm13/p18-cargo-action-resolver-contract.mjs',
  ],
  '20261129110000_abc_f6_cargos_nombres_navegacion_excepciones.sql': [
    'tests/pm13/p12-cargo-propietario-contract.mjs',
  ],
  '20261129120000_abc_f6_cargos_estado_eliminacion.sql': [
    'tests/pm13/p11-cargo-estado-contract.mjs',
  ],
};

const manifiesto = JSON.parse(
  readFileSync(join(REPO, 'tests/ci/manifiesto_clasificacion.json'), 'utf8'),
);
const clasificacion = new Map(manifiesto.entries.map((e) => [e.path, e.classification]));

for (const [migracion, contratos] of Object.entries(JUSTIFICACION)) {
  assert.ok(
    EXCLUIDAS.has(migracion),
    `la tabla de justificación nombra ${migracion}, que ya no está excluida: ` +
      'o vuelve a la foto F7 y entonces sobra aquí, o se renombró',
  );
  for (const contrato of contratos) {
    assert.doesNotThrow(
      () => readFileSync(join(REPO, contrato)),
      `${migracion} se excluye de la foto F7 apoyándose en ${contrato}, y ese archivo no existe. ` +
        'O se restituye el contrato, o la migración vuelve a la foto, o se cambia la justificación ' +
        'por la verdadera. Lo que no vale es dejar la exclusión apoyada en nada.',
    );
    assert.equal(
      clasificacion.get(contrato),
      'active_contract',
      `${migracion} se apoya en ${contrato}, que en el manifiesto de CI es ` +
        `«${clasificacion.get(contrato) ?? 'no está'}» y no «active_contract». ` +
        'Un contrato que el manifiesto no declara activo no lo ejecuta ningún entorno, ' +
        'así que la exclusión se apoyaría en algo que no corre.',
    );
  }
}

const archivos = readdirSync(join(REPO, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql') && f.slice(0, 14) >= PRIMERA && !EXCLUIDAS.has(f))
  .sort();
const leer = (f) => readFileSync(join(REPO, 'supabase/migrations', f), 'utf8');
const sinComentarios = (s) => s.replace(/--[^\n]*/g, '');
const sinCadenas = (s) => s.replace(/'(?:[^']|'')*'/g, "''");

// ---- 1. Solo lectura: ninguna palabra de escritura y toda sentencia empieza por select o with ----
const codigo = sinCadenas(sinComentarios(sql));
const PROHIBIDAS = ['insert', 'update', 'delete', 'create', 'alter', 'drop', 'grant', 'revoke', 'truncate', 'copy', 'call', 'execute', 'do', 'set', 'vacuum', 'refresh', 'comment', 'lock', 'listen', 'notify', 'reindex', 'cluster', 'reset', 'begin', 'commit', 'rollback', 'savepoint', 'prepare', 'declare', 'merge', 'import', 'security', 'discard'];
for (const p of PROHIBIDAS) {
  const m = codigo.match(new RegExp(`\\b${p}\\b`, 'i'));
  assert.ok(!m, `el archivo de comprobaciones previas debe ser de solo lectura: contiene «${p}»`);
}
const sentencias = codigo.split(';').map((x) => x.trim()).filter(Boolean);
assert.ok(sentencias.length >= 10, 'faltan consultas');
for (const x of sentencias) assert.match(x, /^(select|with)\b/i, `toda sentencia debe empezar por select o with: «${x.slice(0, 60)}»`);
for (const b of ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9']) assert.ok(new RegExp(`-- ${b} ·`).test(sql), `falta el bloque ${b}`);

// ---- 2. P2: los objetos nuevos de cada migración candidata ----
const esperadoObj = new Set();
for (const f of archivos) {
  const s = sinComentarios(leer(f));
  const tag = f.slice(0, 14);
  const nombre = f.slice(15, -4);
  for (const m of s.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z0-9_.]+)/gi)) { const [e, n] = m[1].includes('.') ? m[1].toLowerCase().split('.') : ['public', m[1].toLowerCase()]; esperadoObj.add(`${tag}|${nombre}|tabla|${e}|${n}`); }
  for (const m of s.matchAll(/create\s+function\s+([a-z0-9_.]+)\s*\(/gi)) { const [e, n] = m[1].includes('.') ? m[1].toLowerCase().split('.') : ['public', m[1].toLowerCase()]; esperadoObj.add(`${tag}|${nombre}|funcion|${e}|${n}`); }
}
const enSql = new Set([...sql.matchAll(/\('(\d{14})','([a-z0-9_]+)','(tabla|funcion)','([a-z_]+)','([a-z0-9_]+)'\)/g)].map((m) => m.slice(1, 6).join('|')));
assert.deepEqual([...esperadoObj].filter((x) => !enSql.has(x)), [], 'P2: faltan objetos nuevos de alguna migración candidata');
assert.deepEqual([...enSql].filter((x) => !esperadoObj.has(x)), [], 'P2: hay objetos que ninguna migración candidata crea');

// ---- 3. P3: las huellas md5 son exactamente las que exigen las migraciones ----
const huellasMig = new Set();
const firmasMig = new Set();
for (const f of archivos) {
  const s = leer(f);
  const pre = (s.match(/do \$\$.*?end \$\$;/s) || [''])[0];
  if (!/md5\(/.test(pre)) continue;
  for (const m of pre.matchAll(/'([0-9a-f]{32})'/g)) huellasMig.add(m[1]);
  for (const m of pre.matchAll(/p\.oid='([^']+)'::regprocedure/g)) firmasMig.add(m[1]);
}
const p3 = sql.slice(sql.indexOf('-- P3 ·'), sql.indexOf('-- P4 ·'));
const huellasSql = new Set([...p3.matchAll(/'([0-9a-f]{32})'/g)].map((m) => m[1]));
const firmasSql = new Set([...p3.matchAll(/\('(?:pieza\d|d13|pm07fix)[^']*', '([^']+)', '[0-9a-f]{32}'/g)].map((m) => m[1]));
// La corrección de PM07 comprueba su función con to_regprocedure y p.oid=v_oid (no con p.oid='…'::regprocedure): se añade a mano, verificando el texto.
const PM07_FIRMA = 'private.pm07_numero_catalogo(text,numeric)';
assert.ok(leer('20261003130000_abc_pm07_correccion_numero_catalogo.sql').includes(`to_regprocedure('${PM07_FIRMA}')`), 'la corrección de PM07 debe comprobar su función');
firmasMig.add(PM07_FIRMA);
assert.ok(huellasMig.size === 13 && firmasMig.size === 12, `se esperaban 13 huellas y 12 funciones en las migraciones: ${huellasMig.size}/${firmasMig.size}`);
assert.deepEqual([...huellasMig].sort(), [...huellasSql].sort(), 'P3: las huellas md5 no coinciden con las de las migraciones');
assert.deepEqual([...firmasMig].sort(), [...firmasSql].sort(), 'P3: las funciones comprobadas no coinciden con las de las migraciones');

// ---- 4. P4: las funciones que se reemplazan ----
const reemp = new Set();
for (const f of archivos) for (const m of sinComentarios(leer(f)).matchAll(/create\s+or\s+replace\s+function\s+([a-z0-9_.]+)\s*\(/gi)) reemp.add(m[1].toLowerCase());
// La RPC de navegación efectiva pertenece al paquete de cargos excluido de F7,
// pero queda registrada en P4 para que su respaldo sea explícito si se promueve
// en una ventana posterior.
reemp.add('public.pm13_listar_pantallas_efectivas');
const p4 = sql.slice(sql.indexOf('-- P4 ·'), sql.indexOf('-- P5 ·'));
const enP4 = new Set([...p4.matchAll(/^\s+'((?:public|private)\.[a-z0-9_]+)'/gm)].map((m) => m[1]));
assert.deepEqual([...reemp].sort(), [...enP4].sort(), 'P4: las funciones reemplazadas no coinciden con las de las migraciones');

// ---- 5. P5: las 28 tablas que el navegador no puede leer en QA ----
const tablasQa = readFileSync(join(REPO, 'tests/cfg/lib/tablas-sin-acceso-qa.mjs'), 'utf8').match(/SIN_ACCESO_QA = \[(.*?)\];/s)[1].match(/'([^']+)'/g).map((x) => x.slice(1, -1));
const p5 = sql.slice(sql.indexOf('-- P5 ·'), sql.indexOf('-- P6 ·'));
const enP5 = [...p5.matchAll(/^\s+\('([a-z0-9_]+)'\)/gm)].map((m) => m[1]);
assert.deepEqual(enP5.sort(), [...tablasQa].sort(), 'P5: las tablas no coinciden con tests/cfg/lib/tablas-sin-acceso-qa.mjs');

// ---- 6. El documento lista todas las migraciones candidatas y las cifras que cita ----
for (const f of archivos) assert.ok(doc.includes(`\`${f.slice(0, 14)}\``) && doc.includes(`\`${f.slice(15, -4)}\``), `el documento no lista la migración ${f}`);
const filasTabla = doc.split('\n').filter((l) => /^\| \d+ \| `\d{14}` \|/.test(l));
assert.equal(filasTabla.length, archivos.length, 'la tabla del apéndice A debe tener una fila por migración candidata');
assert.ok(doc.includes(`${archivos.length} migraciones candidatas`) || doc.includes(`Las ${archivos.length} migraciones candidatas`) || doc.includes(`${archivos.length} archivos desde`), 'el documento debe citar el número de migraciones candidatas');
assert.ok(doc.includes(`**${reemp.size} funciones**`), `el documento debe citar las ${reemp.size} funciones reemplazadas`);
console.log(`f7-preflight-static-contract: OK (${archivos.length} migraciones, ${esperadoObj.size} objetos, ${huellasMig.size} huellas, ${reemp.size} funciones reemplazadas, ${tablasQa.length} tablas)`);
