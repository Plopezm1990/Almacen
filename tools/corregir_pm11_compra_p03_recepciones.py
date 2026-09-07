from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

MARKER = 'function firmaSolicitudRecepcionPM11('
if MARKER not in s:
    pos = s.find('function crearLogicaPedidos(')
    if pos < 0:
        raise SystemExit('No se encontró crearLogicaPedidos')
    helpers = r'''const operacionesRecepcionPM11Memoria = /* @__PURE__ */ new Map();
function valorFirmaRecepcionPM11(valor) {
  if (valor === null || valor === void 0 || String(valor).trim() === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : String(valor).trim();
}
function firmaSolicitudRecepcionPM11(pedido, lineas) {
  const canon = (Array.isArray(lineas) ? lineas : []).map((linea) => ({
    productoId: String(linea?.productoId ?? "").trim(),
    cantidad: valorFirmaRecepcionPM11(linea?.cantidad),
    precioBruto: valorFirmaRecepcionPM11(linea?.precioBruto),
    ivaPct: valorFirmaRecepcionPM11(linea?.ivaPct),
    udsPorCaja: valorFirmaRecepcionPM11(linea?.udsPorCaja),
    tipoUnidad: String(linea?.tipoUnidad ?? "").trim()
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify({
    pedidoId: String(pedido?.id ?? ""),
    localId: String(pedido?.localId ?? ""),
    proveedorId: String(pedido?.proveedorId ?? ""),
    lineas: canon
  });
}
function resolverOperationIdRecepcionPM11(operationId) {
  if (operationId === null || operationId === void 0) return { ok: true, operationId: `rx-${uid()}`, legado: true };
  const id = String(operationId).trim();
  if (!id) return errorValidacionPM10("campo_obligatorio", "operationId", "La recepción necesita una identidad de operación.");
  if (id.length > 180) return errorValidacionPM10("valor_fuera_rango", "operationId", "La identidad de operación es demasiado larga.");
  return { ok: true, operationId: id, legado: false };
}
function eventoRecepcionPM11EnPedidos(pedidos, operationId) {
  for (const pedido of pedidos || []) {
    for (const evento of Array.isArray(pedido?.recepcionesPM11) ? pedido.recepcionesPM11 : []) {
      if (evento?.operationId === operationId) return { pedido, evento };
    }
  }
  return null;
}
function eventoRecepcionPM11(operationId, firmaSolicitud, lineasResueltas, fecha) {
  return {
    operationId,
    firmaSolicitud,
    tipo: "pedido_directo",
    fecha,
    lineas: (lineasResueltas || []).map((linea) => ({
      productoId: linea?.productoId || null,
      unidadesEntradas: Number(linea?.unidadesEntradas) || 0,
      precioBruto: Number(linea?.precioBruto) || 0,
      ivaPct: Number(linea?.ivaPct) || 0
    }))
  };
}
'''
    s = s[:pos] + helpers + s[pos:]

ini = s.find('  function recibirPedido(pedidoId, lineas) {')
if ini < 0:
    ini = s.find('  function recibirPedido(pedidoId, lineas, operationId')
fin = s.find('  return { crearPedido, actualizarPedido, eliminarPedido, recibirPedido, cerrarPedido };', ini)
if ini < 0 or fin < 0:
    raise SystemExit('No se encontró recibirPedido')

new_recibir = r'''  function recibirPedido(pedidoId, lineas, operationId = null) {
    if (almacenCongelado) return errorValidacionPM10("conflicto_estado_previo", "almacen", "El almacén está congelado por un conteo en curso.");
    const pedido = pedidos2.find((pe2) => pe2.id === pedidoId);
    if (!pedidoEsDelLocalActivo(pedido)) return errorValidacionPM10("contexto_no_autorizado", "pedidoId", "Pedido fuera del local activo.");

    const operacionR = resolverOperationIdRecepcionPM11(operationId);
    if (!operacionR.ok) return operacionR;
    const opId = operacionR.operationId;
    const firmaSolicitud = firmaSolicitudRecepcionPM11(pedido, lineas);

    const persistido = eventoRecepcionPM11EnPedidos(pedidos2, opId);
    if (persistido) {
      if (persistido.pedido.id !== pedido.id || persistido.evento.firmaSolicitud !== firmaSolicitud) {
        return errorValidacionPM10("operation_id_conflict", "operationId", "La identidad de recepción ya pertenece a otra operación.");
      }
      return { ok: true, replayed: true, operationId: opId, lineasResueltas: persistido.evento.lineas || [], avisos: [] };
    }

    const memoria = operacionesRecepcionPM11Memoria.get(opId);
    if (memoria) {
      if (memoria.pedidoId !== pedido.id || memoria.firmaSolicitud !== firmaSolicitud) {
        return errorValidacionPM10("operation_id_conflict", "operationId", "La identidad de recepción ya pertenece a otra operación.");
      }
      return { ok: true, replayed: true, operationId: opId, lineasResueltas: memoria.lineasResueltas || [], avisos: memoria.avisos || [] };
    }

    const validacion = validarRecepcionPedidoPM10({ pedido, lineas, productos, localActivoId, modo: "directo" });
    if (!validacion.ok) return validacion;

    operacionesRecepcionPM11Memoria.set(opId, { pedidoId: pedido.id, firmaSolicitud, estado: "procesando" });
    let resultado;
    try {
      resultado = procesarRecepcion({
        lineas: validacion.lineas,
        proveedorId: pedido.proveedorId,
        fecha: todayISO(),
        documentoTipo: "pedido",
        documentoId: pedido.id,
        documentoNumero: pedido.id.slice(-6)
      });
    } catch (error) {
      operacionesRecepcionPM11Memoria.delete(opId);
      throw error;
    }
    if (!resultado || !Array.isArray(resultado.lineasResueltas)) {
      operacionesRecepcionPM11Memoria.delete(opId);
      return errorValidacionPM10("conflicto_estado_previo", "recepcion", "No se pudo completar la recepción.");
    }

    const fecha = todayISO();
    const evento = eventoRecepcionPM11(opId, firmaSolicitud, resultado.lineasResueltas, fecha);
    operacionesRecepcionPM11Memoria.set(opId, {
      pedidoId: pedido.id,
      firmaSolicitud,
      estado: "confirmado",
      lineasResueltas: evento.lineas,
      avisos: resultado.avisos || []
    });

    setPedidos((prev) => prev.map((pe2) => {
      if (pe2.id !== pedidoId) return pe2;
      const existente = (Array.isArray(pe2.recepcionesPM11) ? pe2.recepcionesPM11 : []).find((ev) => ev?.operationId === opId);
      if (existente) return pe2;
      const actualizado = aplicarRecepcionPedidoPM10(pe2, resultado.lineasResueltas);
      return { ...actualizado, recepcionesPM11: [...(Array.isArray(pe2.recepcionesPM11) ? pe2.recepcionesPM11 : []), evento] };
    }));
    return { ok: true, replayed: false, operationId: opId, avisos: resultado.avisos || [], lineasResueltas: resultado.lineasResueltas };
  }
'''
s = s[:ini] + new_recibir + s[fin:]

# La UI conserva una operationId estable mientras el mismo intento siga visible.
rec_ini = s.find('function Recepcion({')
rec_fin = s.find('function textoHojaConteo(', rec_ini)
if rec_ini < 0 or rec_fin < 0:
    raise SystemExit('No se encontró Recepcion')
seg = s[rec_ini:rec_fin]

if 'operacionesRecepcionRef' not in seg:
    anchor = '  const [erroresRecepcion, setErroresRecepcion] = (0, import_react4.useState)({});'
    if anchor not in seg:
        raise SystemExit('No se encontró erroresRecepcion')
    seg = seg.replace(anchor, anchor + '\n  const operacionesRecepcionRef = (0, import_react4.useRef)(/* @__PURE__ */ new Map());', 1)

old = '      const resultado = recibirPedido(pe2.id, [...porProducto.values()]);'
if old in seg:
    new = r'''      const lineasIntento = [...porProducto.values()];
      const firmaIntento = JSON.stringify({
        pedidoId: pe2.id,
        recibido: pe2.items.map((it2) => [it2.productoId, Number(it2.cantidadRecibida) || 0]),
        lineas: lineasIntento.map((ln2) => [ln2.productoId, String(ln2.cantidad), String(ln2.precioBruto), String(ln2.ivaPct)])
      });
      let intento = operacionesRecepcionRef.current.get(pe2.id);
      if (!intento || intento.firma !== firmaIntento) {
        intento = { firma: firmaIntento, operationId: `rx-ui-${uid()}` };
        operacionesRecepcionRef.current.set(pe2.id, intento);
      }
      const resultado = recibirPedido(pe2.id, lineasIntento, intento.operationId);'''
    seg = seg.replace(old, new, 1)
elif 'recibirPedido(pe2.id, lineasIntento, intento.operationId)' not in seg:
    raise SystemExit('No se encontró llamada UI recibirPedido')

s = s[:rec_ini] + seg + s[rec_fin:]
p.write_text(s, encoding='utf-8')
print('PM11 Compra P03: recepciones múltiples e idempotencia directa aplicadas')
