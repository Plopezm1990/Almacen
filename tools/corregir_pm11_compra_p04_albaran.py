from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

# P04: identidad documental e idempotencia de confirmación de albarán.
# La recepción física ya usa un operationId estable en PM10; aquí se evita que,
# tras rerender/recarga, un albarán ya confirmado vuelva a avanzar el pedido o
# pueda reinterpretarse con el mismo id y contenido distinto.
if 'function firmaConfirmacionAlbaranPM11(' not in s:
    pos = s.find('function crearLogicaAlbaranes({')
    if pos < 0:
        raise SystemExit('No se encontró crearLogicaAlbaranes')
    helper = r'''const confirmacionesAlbaranPM11Memoria = /* @__PURE__ */ new Map();
function valorCanonicoNumeroAlbaranPM11(valor, defecto = null) {
  if (valor === null || valor === void 0 || String(valor).trim() === "") return defecto;
  const n = Number(valor);
  return Number.isFinite(n) ? n : String(valor);
}
function firmaConfirmacionAlbaranPM11(alb, empresaIdEfectiva = null, localIdEfectivo = null) {
  const lineas = Array.isArray(alb?.lineas) ? alb.lineas : [];
  return JSON.stringify({
    id: String(alb?.id || "").trim(),
    pedidoId: String(alb?.pedidoId || "").trim(),
    empresaId: String(alb?.empresaId || empresaIdEfectiva || "").trim(),
    localId: String(alb?.localId || localIdEfectivo || "").trim(),
    proveedorId: String(alb?.proveedorId || "").trim(),
    fecha: String(alb?.fecha || "").trim(),
    numero: String(alb?.numero || "").trim(),
    lineas: lineas.map((ln2) => ({
      productoId: String(ln2?.productoId || "").trim(),
      descripcion: String(ln2?.descripcion || "").trim(),
      codigoProveedor: String(ln2?.codigoProveedor || "").trim(),
      cantidad: valorCanonicoNumeroAlbaranPM11(ln2?.cantidad),
      udsPorCaja: valorCanonicoNumeroAlbaranPM11(ln2?.udsPorCaja, 1),
      tipoUnidad: String(ln2?.tipoUnidad || "").trim(),
      precioBruto: valorCanonicoNumeroAlbaranPM11(ln2?.precioBruto),
      ivaPct: valorCanonicoNumeroAlbaranPM11(ln2?.ivaPct)
    }))
  });
}
function claveConfirmacionAlbaranPM11(alb, empresaIdEfectiva = null, localIdEfectivo = null) {
  return `${String(alb?.empresaId || empresaIdEfectiva || "sin-empresa")}:${String(alb?.localId || localIdEfectivo || "sin-local")}:${String(alb?.id || "sin-id")}`;
}
function resolverConfirmacionAlbaranPM11({ alb, existente = null, memoria = null, empresaId = null, localActivoId = null } = {}) {
  const id = String(alb?.id || "").trim();
  if (!id) return { ok: false, codigo: "campo_obligatorio", campo: "id", error: "El albarán necesita una identidad estable antes de confirmarse." };
  const firma = firmaConfirmacionAlbaranPM11(alb, empresaId, localActivoId);
  const clave = claveConfirmacionAlbaranPM11(alb, empresaId, localActivoId);
  if (memoria) {
    if (memoria.firma !== firma) return { ok: false, codigo: "operation_id_conflict", campo: "id", error: "El mismo albarán no puede confirmarse con contenido distinto." };
    return { ok: true, replayed: true, firma, clave, avisos: Array.isArray(memoria.avisos) ? memoria.avisos : [] };
  }
  if (existente && existente.estado === "confirmado") {
    const firmaPersistida = existente.confirmacionPM11?.firma || null;
    if (!firmaPersistida) {
      return { ok: false, codigo: "documento_ya_confirmado", campo: "id", error: "Este albarán legado ya está confirmado; se bloquea una nueva entrada para no duplicar stock ni recepción." };
    }
    if (firmaPersistida !== firma) return { ok: false, codigo: "operation_id_conflict", campo: "id", error: "El mismo albarán confirmado no puede reinterpretarse con contenido distinto." };
    return { ok: true, replayed: true, firma, clave, avisos: Array.isArray(existente.avisosPrecio) ? existente.avisosPrecio : [] };
  }
  return { ok: true, replayed: false, firma, clave, avisos: [] };
}
function resultadoReplayAlbaranPM11(avisos, albaranId) {
  const salida = Array.isArray(avisos) ? avisos.slice() : [];
  salida.replayed = true;
  salida.operationId = `pm11-albaran:${albaranId}`;
  return salida;
}
'''
    s = s[:pos] + helper + s[pos:]

alb_ini = s.find('function crearLogicaAlbaranes({')
if alb_ini < 0:
    raise SystemExit('No se encontró crearLogicaAlbaranes')
conf_ini = s.find('  function confirmarAlbaran(alb) {', alb_ini)
conf_fin = s.find('  function anularAlbaran(alb) {', conf_ini)
if conf_ini < 0 or conf_fin < 0:
    raise SystemExit('No se encontró confirmarAlbaran/anularAlbaran')

# Solo sustituir si P04 todavía no está integrado en la función.
actual = s[conf_ini:conf_fin]
if 'resolverConfirmacionAlbaranPM11' not in actual:
    nueva = r'''  function confirmarAlbaran(alb) {
    const contexto = validarContextoEscrituraPM10({ localActivoId, locales, empresaId });
    if (!contexto.ok) return contexto;
    if (!albaranEsDelLocalActivo(alb, true)) return errorValidacionPM10("contexto_no_autorizado", "localId", "Albarán fuera del local activo.");

    const albaranId = String(alb?.id || "").trim();
    if (!albaranId) return errorValidacionPM10("campo_obligatorio", "id", "El albarán necesita una identidad estable antes de confirmarse.");
    const clavePM11 = claveConfirmacionAlbaranPM11(alb, empresaId, localActivoId);
    const memoriaPM11 = confirmacionesAlbaranPM11Memoria.get(clavePM11) || null;
    const existentePM11 = (albaranes || []).find((a22) => a22 && a22.id === albaranId) || null;
    const guardiaPM11 = resolverConfirmacionAlbaranPM11({ alb, existente: existentePM11, memoria: memoriaPM11, empresaId, localActivoId });
    if (!guardiaPM11.ok) return errorValidacionPM10(guardiaPM11.codigo, guardiaPM11.campo, guardiaPM11.error);
    if (guardiaPM11.replayed) {
      if (!memoriaPM11) confirmacionesAlbaranPM11Memoria.set(clavePM11, { firma: guardiaPM11.firma, avisos: guardiaPM11.avisos || [] });
      return resultadoReplayAlbaranPM11(guardiaPM11.avisos, albaranId);
    }

    let pedidoLigado = null;
    let lineasEntrada = alb.lineas;
    if (alb.pedidoId) {
      pedidoLigado = (pedidos || []).find((pe2) => pe2.id === alb.pedidoId) || null;
      if (!pedidoEsDelLocalActivoAlbaran(pedidoLigado)) return errorValidacionPM10("contexto_no_autorizado", "pedidoId", "El pedido enlazado no pertenece al local activo.");
      if (String(pedidoLigado.proveedorId || "") !== String(alb.proveedorId || "")) {
        return errorValidacionPM10("referencia_otro_contexto", "proveedorId", "El proveedor del albarán no coincide con el proveedor del pedido enlazado.");
      }
      const localAlbaranPM11 = String(alb.localId || localActivoId || "");
      if (!localAlbaranPM11 || String(pedidoLigado.localId || "") !== localAlbaranPM11) {
        return errorValidacionPM10("contexto_no_autorizado", "localId", "El albarán y el pedido enlazado deben pertenecer al mismo local.");
      }
      const validacion = validarRecepcionPedidoPM10({ pedido: pedidoLigado, lineas: alb.lineas, productos, localActivoId, locales, empresaId, modo: "albaran" });
      if (!validacion.ok) return validacion;
      lineasEntrada = validacion.lineas;
    }

    const resultadoRecepcionPM11 = procesarRecepcion({
      lineas: lineasEntrada,
      proveedorId: alb.proveedorId,
      fecha: alb.fecha,
      documentoTipo: "albaran",
      documentoId: alb.id,
      documentoNumero: alb.numero,
      operationId: `pm10-recepcion-albaran:${alb.id}`
    });
    if (!resultadoRecepcionPM11 || !Array.isArray(resultadoRecepcionPM11.lineasResueltas)) {
      return errorValidacionPM10("conflicto_estado_previo", "recepcion", "No se pudo completar la recepción del albarán.");
    }
    const { lineasResueltas, avisos } = resultadoRecepcionPM11;
    const replayedRecepcionPM10 = !!resultadoRecepcionPM11.replayed || !!procesarRecepcion._pm10UltimoReplay;
    if (pedidoLigado && !replayedRecepcionPM10) {
      setPedidos((prev) => prev.map((pe2) => pe2.id === alb.pedidoId ? aplicarRecepcionPedidoPM10(pe2, lineasResueltas) : pe2));
    }

    const confirmacionPM11 = {
      version: 1,
      firma: guardiaPM11.firma,
      operationId: `pm11-albaran:${albaranId}`,
      pedidoId: String(alb.pedidoId || "") || null,
      empresaId: alb.empresaId || empresaId || null,
      localId: alb.localId || localActivoId || null,
      proveedorId: alb.proveedorId || null
    };
    const guardadoPM11 = guardarAlbaran({ ...alb, lineas: lineasResueltas, estado: "confirmado", avisosPrecio: avisos || [], confirmacionPM11 });
    if (guardadoPM11 === false) {
      return errorValidacionPM10("conflicto_persistencia", "albaran", "No se pudo guardar el albarán confirmado.");
    }
    confirmacionesAlbaranPM11Memoria.set(clavePM11, { firma: guardiaPM11.firma, avisos: avisos || [] });

    if ((avisos || []).length && !replayedRecepcionPM10) {
      registrarAuditoria(
        "Variación de precio en albarán",
        `${proveedorPorId(alb.proveedorId)?.nombre || "—"} · ${(avisos || []).map((a22) => `${a22.nombre} ${a22.variacion > 0 ? "+" : ""}${fmt(a22.variacion)}%`).join(", ")}`
      );
    }
    const salidaPM11 = Array.isArray(avisos) ? avisos : [];
    salidaPM11.replayed = replayedRecepcionPM10;
    salidaPM11.operationId = `pm11-albaran:${albaranId}`;
    return salidaPM11;
  }
'''
    s = s[:conf_ini] + nueva + s[conf_fin:]

p.write_text(s, encoding='utf-8')
print('PM11 Compra P04: trazabilidad e idempotencia de albarán aplicadas')
