from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

# PM11 Compra P08 — fallos, replay y concurrencia dentro del modelo KV actual.
# Corrige una regresión real de P03: recibirPedido dejó de pasar una identidad
# física/versionada a procesarRecepcion, por lo que dos recepciones reales del
# mismo pedido podían chocar con la caché PM10 y reutilizar el primer efecto.

# 1) Helpers: versión física del pedido + firma del efecto que protege el replay.
if 'function operationIdEfectoRecepcionPedidoPM11(' not in s:
    pos = s.find('function crearLogicaPedidos(')
    if pos < 0:
        raise SystemExit('No se encontró crearLogicaPedidos')
    helpers = r'''function snapshotRecepcionPedidoPM11(pedido) {
  return (Array.isArray(pedido?.items) ? pedido.items : []).map((it2, idx) => [
    idx,
    String(it2?.productoId || ""),
    Number(it2?.cantidadRecibida) || 0
  ]);
}
function operationIdEfectoRecepcionPedidoPM11(pedido) {
  return `pm11-efecto-recepcion-pedido:${String(pedido?.id || "sin-id")}:${JSON.stringify(snapshotRecepcionPedidoPM11(pedido))}`;
}
function firmaEfectoRecepcionPM11({ lineas, proveedorId, fecha, documentoTipo, documentoId, documentoNumero } = {}) {
  return JSON.stringify({
    proveedorId: String(proveedorId || ""),
    fecha: String(fecha || ""),
    documentoTipo: String(documentoTipo || ""),
    documentoId: String(documentoId || ""),
    documentoNumero: String(documentoNumero || ""),
    lineas: (Array.isArray(lineas) ? lineas : []).map((ln2) => ({
      productoId: String(ln2?.productoId || ""),
      cantidad: valorFirmaRecepcionPM11(ln2?.cantidad),
      udsPorCaja: valorFirmaRecepcionPM11(ln2?.udsPorCaja),
      precioBruto: valorFirmaRecepcionPM11(ln2?.precioBruto),
      ivaPct: valorFirmaRecepcionPM11(ln2?.ivaPct),
      lote: String(ln2?.lote || "")
    }))
  });
}
'''
    s = s[:pos] + helpers + s[pos:]

# 2) Recepción directa: el operationId de intento P03 sigue siendo la identidad
# documental; concurrencyKey representa la versión física del pedido.
ped_ini = s.find('function crearLogicaPedidos(')
ped_fin = s.find('function crearLogicaFichasCosto', ped_ini)
if ped_ini < 0 or ped_fin < 0:
    raise SystemExit('No se encontró bloque de pedidos')
ped = s[ped_ini:ped_fin]
rec_ini = ped.find('  function recibirPedido(')
rec_fin = ped.find('  return { crearPedido, actualizarPedido, eliminarPedido, recibirPedido, cerrarPedido };', rec_ini)
if rec_ini < 0 or rec_fin < 0:
    raise SystemExit('No se encontró recibirPedido')
rec = ped[rec_ini:rec_fin]

if 'concurrencyKey: operationIdEfectoRecepcionPedidoPM11(pedido)' not in rec:
    old = '''        documentoTipo: "pedido",\n        documentoId: pedido.id,\n        documentoNumero: pedido.id.slice(-6)\n      });'''
    new = '''        documentoTipo: "pedido",\n        documentoId: pedido.id,\n        documentoNumero: pedido.id.slice(-6),\n        operationId: opId,\n        concurrencyKey: operationIdEfectoRecepcionPedidoPM11(pedido)\n      });'''
    if old not in rec:
        raise SystemExit('No se encontró llamada directa a procesarRecepcion')
    rec = rec.replace(old, new, 1)

if 'La versión del pedido usada por esta recepción ya fue procesada' not in rec:
    old = '''    if (!resultado || !Array.isArray(resultado.lineasResueltas)) {\n      operacionesRecepcionPM11Memoria.delete(opId);\n      return errorValidacionPM10("conflicto_estado_previo", "recepcion", "No se pudo completar la recepción.");\n    }'''
    new = '''    if (resultado?.ok === false) {\n      operacionesRecepcionPM11Memoria.delete(opId);\n      return resultado;\n    }\n    if (resultado?.replayed) {\n      operacionesRecepcionPM11Memoria.delete(opId);\n      return errorValidacionPM10("conflicto_estado_previo", "recepcion", "La versión del pedido usada por esta recepción ya fue procesada. Recarga el pedido antes de registrar una nueva recepción.");\n    }\n    if (!resultado || !Array.isArray(resultado.lineasResueltas)) {\n      operacionesRecepcionPM11Memoria.delete(opId);\n      return errorValidacionPM10("conflicto_estado_previo", "recepcion", "No se pudo completar la recepción.");\n    }'''
    if old not in rec:
        raise SystemExit('No se encontró validación del resultado de recepción directa')
    rec = rec.replace(old, new, 1)

ped = ped[:rec_ini] + rec + ped[rec_fin:]
s = s[:ped_ini] + ped + s[ped_fin:]

# 3) procesarRecepcion: el replay se indexa por concurrencyKey (si existe) y
# compara una firma completa. Mismo key + payload distinto => conflicto.
alb_ini = s.find('function crearLogicaAlbaranes({')
if alb_ini < 0:
    raise SystemExit('No se encontró crearLogicaAlbaranes')
proc_ini = s.find('  function procesarRecepcion({', alb_ini)
proc_fin = s.find('  function confirmarAlbaran(alb) {', proc_ini)
if proc_ini < 0 or proc_fin < 0:
    raise SystemExit('No se encontró procesarRecepcion/confirmarAlbaran')
proc = s[proc_ini:proc_fin]

if 'concurrencyKey = null' not in proc.split('\n', 1)[0]:
    proc = proc.replace(
        '  function procesarRecepcion({ lineas, proveedorId, fecha, documentoTipo, documentoId, documentoNumero, operationId = null }) {',
        '  function procesarRecepcion({ lineas, proveedorId, fecha, documentoTipo, documentoId, documentoNumero, operationId = null, concurrencyKey = null }) {',
        1
    )

old_start = '''    const operationIdRecepcionPM10 = operationId || `pm10-recepcion:${documentoTipo || "doc"}:${documentoId || documentoNumero || "sin-id"}`;\n    if (!procesarRecepcion._pm10Resultados) procesarRecepcion._pm10Resultados = /* @__PURE__ */ new Map();\n    const replayInmediatoPM10 = procesarRecepcion._pm10Resultados.get(operationIdRecepcionPM10);\n    if (replayInmediatoPM10) { procesarRecepcion._pm10UltimoReplay = true; return { ...replayInmediatoPM10, replayed: true }; }\n    procesarRecepcion._pm10UltimoReplay = false;'''
new_start = '''    const operationIdRecepcionPM10 = operationId || `pm10-recepcion:${documentoTipo || "doc"}:${documentoId || documentoNumero || "sin-id"}`;\n    const claveEfectoRecepcionPM11 = concurrencyKey || operationIdRecepcionPM10;\n    const firmaEfectoPM11 = firmaEfectoRecepcionPM11({ lineas, proveedorId, fecha, documentoTipo, documentoId, documentoNumero });\n    if (!procesarRecepcion._pm10Resultados) procesarRecepcion._pm10Resultados = /* @__PURE__ */ new Map();\n    const replayInmediatoPM10 = procesarRecepcion._pm10Resultados.get(claveEfectoRecepcionPM11);\n    if (replayInmediatoPM10) {\n      if (replayInmediatoPM10.firmaEfectoPM11 !== firmaEfectoPM11) {\n        procesarRecepcion._pm10UltimoReplay = false;\n        return errorValidacionPM10("operation_id_conflict", "operationId", "La misma versión física de recepción ya fue usada con otro contenido.");\n      }\n      procesarRecepcion._pm10UltimoReplay = true;\n      return { ...replayInmediatoPM10, replayed: true };\n    }\n    procesarRecepcion._pm10UltimoReplay = false;'''
if 'claveEfectoRecepcionPM11' not in proc:
    if old_start not in proc:
        raise SystemExit('No se encontró cabecera de replay de procesarRecepcion')
    proc = proc.replace(old_start, new_start, 1)

# Los IDs físicos se deduplican por versión/concurrencyKey, no solo por documento.
proc = proc.replace('${operationIdRecepcionPM10}:linea:${idxRecepcionPM10}:producto:${prod.id}', '${claveEfectoRecepcionPM11}:linea:${idxRecepcionPM10}:producto:${prod.id}')
proc = proc.replace('${operationIdRecepcionPM10}:producto-auto:${idxRecepcionPM10}', '${claveEfectoRecepcionPM11}:producto-auto:${idxRecepcionPM10}')
proc = proc.replace('${operationIdRecepcionPM10}:linea:${idxRecepcionPM10}:auto', '${claveEfectoRecepcionPM11}:linea:${idxRecepcionPM10}:auto')

if 'firmaEfectoPM11' not in proc[proc.rfind('const resultadoRecepcionPM10'):]:
    old = '    const resultadoRecepcionPM10 = { lineasResueltas, avisos, operationId: operationIdRecepcionPM10, replayed: false };\n    procesarRecepcion._pm10Resultados.set(operationIdRecepcionPM10, resultadoRecepcionPM10);'
    new = '    const resultadoRecepcionPM10 = { lineasResueltas, avisos, operationId: operationIdRecepcionPM10, concurrencyKey: claveEfectoRecepcionPM11, firmaEfectoPM11, replayed: false };\n    procesarRecepcion._pm10Resultados.set(claveEfectoRecepcionPM11, resultadoRecepcionPM10);'
    if old not in proc:
        raise SystemExit('No se encontró persistencia de resultado de procesarRecepcion')
    proc = proc.replace(old, new, 1)

s = s[:proc_ini] + proc + s[proc_fin:]

# 4) Albarán ligado: conserva su operationId documental P04, pero serializa el
# efecto contra la versión del pedido. Un replay físico no reconocido antes por
# la barrera documental significa snapshot obsoleto y falla cerrado.
alb_ini = s.find('function crearLogicaAlbaranes({')
conf_ini = s.find('  function confirmarAlbaran(alb) {', alb_ini)
conf_fin = s.find('  function anularAlbaran(alb) {', conf_ini)
conf = s[conf_ini:conf_fin]
if conf_ini < 0 or conf_fin < 0:
    raise SystemExit('No se encontró confirmarAlbaran')

if 'concurrencyKey: pedidoLigado ? operationIdEfectoRecepcionPedidoPM11(pedidoLigado) : null' not in conf:
    old = '''      documentoNumero: alb.numero,\n      operationId: `pm10-recepcion-albaran:${alb.id}`\n    });'''
    new = '''      documentoNumero: alb.numero,\n      operationId: `pm10-recepcion-albaran:${alb.id}`,\n      concurrencyKey: pedidoLigado ? operationIdEfectoRecepcionPedidoPM11(pedidoLigado) : null\n    });'''
    if old not in conf:
        raise SystemExit('No se encontró operationId de albarán P04')
    conf = conf.replace(old, new, 1)

if 'La versión del pedido enlazado ya fue usada por otra recepción' not in conf:
    old = '''    if (!resultadoRecepcionPM11 || !Array.isArray(resultadoRecepcionPM11.lineasResueltas)) {\n      return errorValidacionPM10("conflicto_estado_previo", "recepcion", "No se pudo completar la recepción del albarán.");\n    }\n    const { lineasResueltas, avisos } = resultadoRecepcionPM11;\n    const replayedRecepcionPM10 = !!resultadoRecepcionPM11.replayed || !!procesarRecepcion._pm10UltimoReplay;'''
    new = '''    if (resultadoRecepcionPM11?.ok === false) {\n      return errorValidacionPM10(resultadoRecepcionPM11.codigo || "conflicto_estado_previo", resultadoRecepcionPM11.campo || "recepcion", resultadoRecepcionPM11.error || "No se pudo completar la recepción del albarán.");\n    }\n    if (!resultadoRecepcionPM11 || !Array.isArray(resultadoRecepcionPM11.lineasResueltas)) {\n      return errorValidacionPM10("conflicto_estado_previo", "recepcion", "No se pudo completar la recepción del albarán.");\n    }\n    const { lineasResueltas, avisos } = resultadoRecepcionPM11;\n    const replayedRecepcionPM10 = !!resultadoRecepcionPM11.replayed || !!procesarRecepcion._pm10UltimoReplay;\n    if (replayedRecepcionPM10) {\n      return errorValidacionPM10("conflicto_estado_previo", "recepcion", "La versión del pedido enlazado ya fue usada por otra recepción. Recarga antes de confirmar otro albarán.");\n    }'''
    if old not in conf:
        raise SystemExit('No se encontró control de resultado de albarán')
    conf = conf.replace(old, new, 1)

s = s[:conf_ini] + conf + s[conf_fin:]

p.write_text(s, encoding='utf-8')
print('PM11 Compra P08: hardening de replay/concurrencia aplicado')
