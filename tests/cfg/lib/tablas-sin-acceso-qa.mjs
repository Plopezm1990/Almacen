// Tablas del esquema public que el navegador (rol authenticated) NO puede leer en QA (proyecto qjqorixtkilwsndqayyx), comprobado el 3/10/2026
// con has_table_privilege('authenticated', tabla, 'select'). La aplicación solo puede obtener sus datos por funciones del servidor (RPC).
// Lo usan tests/cfg/cobro-lectura-runtime.mjs (el servidor falso devuelve «permission denied») y tests/cfg/cobro-lectura-static-contract.mjs.
export const SIN_ACCESO_QA = [
  'abc_c05_documentos_emitidos', 'abc_c05_series_documentales', 'abc_c06_documentos_clasificados', 'abc_c07_evaluaciones_fiscales',
  'abc_c07_modalidades_fiscales', 'abc_c08_correcciones_documentales', 'abc_c08_documento_versiones', 'abc_c09_impresiones_documentales',
  'abc_c10_entregas_documentales', 'abc_c11_conciliaciones_documentales', 'abc_c12_ensayos_cierre', 'abc_capacidades_rol', 'abc_cobro_incidencias',
  'abc_config_ajustes', 'abc_descuento_politicas', 'abc_eventos', 'abc_local_equipos', 'abc_local_modalidades', 'abc_operaciones',
  'caja_cierre_diferencias', 'efectos_pendientes', 'operaciones_procesadas', 'pago_aplicaciones', 'pago_intentos', 'pm29_res', 'prefiltro_limites',
  'reembolso_aplicaciones', 'reservas_saldo'
];
// Lecturas directas que la aplicación todavía hace a una de esas tablas (fallo conocido y anotado, fuera del arreglo del cobro):
// el historial de descuentos del TPV lee abc_eventos y recibiría «permission denied». Cuando se arregle, se quita de aquí.
export const LECTURAS_DIRECTAS_CONOCIDAS = { abc_eventos: 1 };
