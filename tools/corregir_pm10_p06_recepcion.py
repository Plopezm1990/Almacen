from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

# Helpers compartidos: toda recepción ligada a pedido se valida completa antes de tocar stock.
if 'function validarRecepcionPedidoPM10(' not in s:
    pos = s.find('function crearLogicaPedidos(')
    if pos < 0:
        raise SystemExit('No se encontró crearLogicaPedidos')
    helper = r'''function unidadesRecepcionLineaPM10(linea, campo, modo = "directo") {
  const cantidadR = numeroPM10(linea?.cantidad, `${campo}.cantidad`, { minimo: 0, estrictoMinimo: true });
  if (!cantidadR.ok) return cantidadR;
  if (modo === "directo" || linea?.tipoUnidad === "peso") {
    return { ok: true, cantidad: cantidadR.valor, udsPorCaja: 1, unidades: cantidadR.valor };
  }
  let udsPorCaja = 1;
  if (linea?.udsPorCaja !== null && linea?.udsPorCaja !== void 0 && String(linea.udsPorCaja).trim() !== "") {
    const udsR = numeroPM10(linea.udsPorCaja, `${campo}.udsPorCaja`, { minimo: 0, estrictoMinimo: true });
    if (!udsR.ok) return udsR;
    udsPorCaja = udsR.valor;
  }
  const unidades = cantidadR.valor * udsPorCaja;
  if (!Number.isFinite(unidades) || unidades <= 0) return errorValidacionPM10("numero_no_finito", `${campo}.cantidad`, "La cantidad total a recibir no es válida.");
  return { ok: true, cantidad: cantidadR.valor, udsPorCaja, unidades };
}
function validarRecepcionPedidoPM10({ pedido, lineas, productos = [], localActivoId = null, modo = "directo" } = {}) {
  if (!localActivoId) return errorValidacionPM10("contexto_no_autorizado", "localId", "Selecciona un local activo para recibir mercancía.");
  if (!pedido || pedido.localId !== localActivoId) return errorValidacionPM10("contexto_no_autorizado", "pedidoId", "El pedido no pertenece al local activo.");
  if (!Array.isArray(lineas) || lineas.length === 0) return errorValidacionPM10("campo_obligatorio", "lineas", "Indica al menos una cantidad a recibir.");

  const pendientesPorProducto = new Map();
  for (let i33 = 0; i33 < (pedido.items || []).length; i33 += 1) {
    const item = pedido.items[i33] || {};
    const productoId = String(item.productoId ?? "").trim();
    const pedida = Number(item.cantidad);
    const recibida = Number(item.cantidadRecibida ?? 0);
    if (!productoId || !Number.isFinite(pedida) || pedida <= 0 || !Number.isFinite(recibida) || recibida < 0 || recibida > pedida + 1e-9) {
      return errorValidacionPM10("conflicto_estado_previo", `pedido.items.${i33}`, "El pedido tiene una cantidad pedida/recibida incoherente.");
    }
    pendientesPorProducto.set(productoId, (pendientesPorProducto.get(productoId) || 0) + Math.max(0, pedida - recibida));
  }

  const solicitadasPorProducto = new Map();
  const normalizadas = [];
  for (let i33 = 0; i33 < lineas.length; i33 += 1) {
    const linea = lineas[i33] && typeof lineas[i33] === "object" ? lineas[i33] : {};
    const campo = `lineas.${i33}`;
    const productoId = String(linea.productoId ?? "").trim();
    if (!productoId) return errorValidacionPM10("campo_obligatorio", `${campo}.productoId`, "Cada línea recibida debe estar enlazada a un producto.");
    const producto = productos.find((p22) => p22 && p22.id === productoId);
    if (!producto) return errorValidacionPM10("referencia_inexistente", `${campo}.productoId`, "El producto recibido no existe.");
    if (producto.localId !== localActivoId) return errorValidacionPM10("referencia_otro_contexto", `${campo}.productoId`, "El producto recibido pertenece a otro local.");
    if (!pendientesPorProducto.has(productoId)) return errorValidacionPM10("referencia_inexistente", `${campo}.productoId`, "El producto no forma parte del pedido enlazado.");

    const unidadesR = unidadesRecepcionLineaPM10(linea, campo, modo);
    if (!unidadesR.ok) return unidadesR;
    solicitadasPorProducto.set(productoId, (solicitadasPorProducto.get(productoId) || 0) + unidadesR.unidades);

    if (modo === "directo") {
      let precio = producto.costo;
      if (linea.precioBruto !== null && linea.precioBruto !== void 0 && String(linea.precioBruto).trim() !== "") {
        const precioR = numeroPM10(linea.precioBruto, `${campo}.precioBruto`, { minimo: 0 });
        if (!precioR.ok) return precioR;
        precio = precioR.valor;
      }
      if (!Number.isFinite(Number(precio)) || Number(precio) < 0) return errorValidacionPM10("numero_no_finito", `${campo}.precioBruto`, "El precio unitario no es válido.");
      let iva = producto.ivaCompra ?? 10;
      if (linea.ivaPct !== null && linea.ivaPct !== void 0 && String(linea.ivaPct).trim() !== "") {
        const ivaR = numeroPM10(linea.ivaPct, `${campo}.ivaPct`, { minimo: 0 });
        if (!ivaR.ok) return ivaR;
        iva = ivaR.valor;
      }
      if (!Number.isFinite(Number(iva)) || Number(iva) < 0 || Number(iva) > 100) return errorValidacionPM10("valor_fuera_rango", `${campo}.ivaPct`, "El IVA debe estar entre 0 y 100.");
      normalizadas.push({
        ...linea,
        productoId,
        cantidad: unidadesR.unidades,
        udsPorCaja: 1,
        tipoUnidad: "unidad",
        precioBruto: Number(precio),
        importe: Number(precio) * unidadesR.unidades,
        ivaPct: Number(iva),
        descripcion: producto.nombre || "",
        unidad: producto.unidad || "unidad"
      });
    } else {
      normalizadas.push({ ...linea, productoId, cantidad: unidadesR.cantidad, udsPorCaja: unidadesR.udsPorCaja });
    }
  }

  for (const [productoId, solicitadas] of solicitadasPorProducto.entries()) {
    const pendiente = pendientesPorProducto.get(productoId) || 0;
    if (solicitadas > pendiente + 1e-9) {
      return errorValidacionPM10("exceso_sobre_cantidad_pendiente", "lineas", `No puedes recibir ${solicitadas} unidades: quedan ${pendiente} pendientes para este producto.`);
    }
  }
  return { ok: true, lineas: normalizadas, solicitadasPorProducto, pendientesPorProducto };
}
function aplicarRecepcionPedidoPM10(pedido, lineasResueltas) {
  const disponibles = new Map();
  for (const linea of lineasResueltas || []) {
    const unidades = Number(linea?.unidadesEntradas);
    if (!linea?.productoId || !Number.isFinite(unidades) || unidades <= 0) continue;
    disponibles.set(linea.productoId, (disponibles.get(linea.productoId) || 0) + unidades);
  }
  const items = (pedido.items || []).map((item) => {
    const pedida = Number(item.cantidad);
    const recibida = Number(item.cantidadRecibida ?? 0);
    const restante = Math.max(0, pedida - recibida);
    const disponible = disponibles.get(item.productoId) || 0;
    const aplicar = Math.min(restante, disponible);
    disponibles.set(item.productoId, Math.max(0, disponible - aplicar));
    return aplicar > 0 ? { ...item, cantidadRecibida: recibida + aplicar } : item;
  });
  const completo = items.length > 0 && items.every((item) => Math.abs(Number(item.cantidadRecibida ?? 0) - Number(item.cantidad)) <= 1e-9);
  const algo = items.some((item) => Number(item.cantidadRecibida ?? 0) > 0);
  return { ...pedido, items, estado: completo ? "Recibido" : algo ? "Parcial" : "Pendiente" };
}
'''
    s = s[:pos] + helper + s[pos:]

# Reemplazar recibirPedido: validar TODO antes de procesarRecepcion; cantidad directa = unidades.
ini = s.find('  function recibirPedido(pedidoId, lineas) {')
fin = s.find('  return { crearPedido, actualizarPedido, eliminarPedido, recibirPedido, cerrarPedido };', ini)
if ini < 0 or fin < 0:
    raise SystemExit('No se encontró recibirPedido de Pedidos')
new_recibir = r'''  function recibirPedido(pedidoId, lineas) {
    if (almacenCongelado) return errorValidacionPM10("conflicto_estado_previo", "almacen", "El almacén está congelado por un conteo en curso.");
    const pedido = pedidos2.find((pe2) => pe2.id === pedidoId);
    if (!pedidoEsDelLocalActivo(pedido)) return errorValidacionPM10("contexto_no_autorizado", "pedidoId", "Pedido fuera del local activo.");
    const validacion = validarRecepcionPedidoPM10({ pedido, lineas, productos, localActivoId, modo: "directo" });
    if (!validacion.ok) return validacion;
    const resultado = procesarRecepcion({
      lineas: validacion.lineas,
      proveedorId: pedido.proveedorId,
      fecha: todayISO(),
      documentoTipo: "pedido",
      documentoId: pedido.id,
      documentoNumero: pedido.id.slice(-6)
    });
    if (!resultado || !Array.isArray(resultado.lineasResueltas)) return errorValidacionPM10("conflicto_estado_previo", "recepcion", "No se pudo completar la recepción.");
    setPedidos((s22) => s22.map((pe2) => pe2.id === pedidoId ? aplicarRecepcionPedidoPM10(pe2, resultado.lineasResueltas) : pe2));
    return { ok: true, avisos: resultado.avisos || [], lineasResueltas: resultado.lineasResueltas };
  }
'''
s = s[:ini] + new_recibir + s[fin:]

# Albaranes necesita leer el pedido actual para validar antes de tocar stock.
alb_ini = s.find('function crearLogicaAlbaranes({')
if alb_ini < 0:
    raise SystemExit('No se encontró crearLogicaAlbaranes')
alb_sig_end = s.find('}) {', alb_ini)
sig = s[alb_ini:alb_sig_end]
if '\n  pedidos,\n' not in sig:
    target = '  setMovimientos,\n  setPedidos,'
    pos = s.find(target, alb_ini, alb_sig_end)
    if pos < 0:
        raise SystemExit('No se encontró setPedidos en firma Albaranes')
    s = s[:pos] + '  setMovimientos,\n  pedidos,\n  setPedidos,' + s[pos+len(target):]

# Confirmación de albarán enlazado: misma barrera antes de procesarRecepcion.
conf_ini = s.find('  function confirmarAlbaran(alb) {', alb_ini)
conf_fin = s.find('  function anularAlbaran(alb) {', conf_ini)
if conf_ini < 0 or conf_fin < 0:
    raise SystemExit('No se encontró confirmarAlbaran')
new_conf = r'''  function confirmarAlbaran(alb) {
    if (!albaranEsDelLocalActivo(alb, true)) return errorValidacionPM10("contexto_no_autorizado", "localId", "Albarán fuera del local activo.");
    let pedidoLigado = null;
    let lineasEntrada = alb.lineas;
    if (alb.pedidoId) {
      pedidoLigado = (pedidos || []).find((pe2) => pe2.id === alb.pedidoId) || null;
      if (!pedidoEsDelLocalActivoAlbaran(pedidoLigado)) return errorValidacionPM10("contexto_no_autorizado", "pedidoId", "El pedido enlazado no pertenece al local activo.");
      const validacion = validarRecepcionPedidoPM10({ pedido: pedidoLigado, lineas: alb.lineas, productos, localActivoId, modo: "albaran" });
      if (!validacion.ok) return validacion;
      lineasEntrada = validacion.lineas;
    }
    const { lineasResueltas, avisos } = procesarRecepcion({
      lineas: lineasEntrada,
      proveedorId: alb.proveedorId,
      fecha: alb.fecha,
      documentoTipo: "albaran",
      documentoId: alb.id,
      documentoNumero: alb.numero
    });
    if (pedidoLigado) {
      setPedidos((prev) => prev.map((pe2) => pe2.id === alb.pedidoId ? aplicarRecepcionPedidoPM10(pe2, lineasResueltas) : pe2));
    }
    guardarAlbaran({ ...alb, lineas: lineasResueltas, estado: "confirmado", avisosPrecio: avisos });
    if (avisos.length) {
      registrarAuditoria(
        "Variación de precio en albarán",
        `${proveedorPorId(alb.proveedorId)?.nombre || "—"} · ${avisos.map((a22) => `${a22.nombre} ${a22.variacion > 0 ? "+" : ""}${fmt(a22.variacion)}%`).join(", ")}`
      );
    }
    return avisos;
  }
'''
s = s[:conf_ini] + new_conf + s[conf_fin:]

# Inyectar pedidos actuales en crearLogicaAlbaranes.
call_ini = s.find('crearLogicaAlbaranes({')
call_end = s.find('  });', call_ini)
if call_ini < 0 or call_end < 0:
    raise SystemExit('No se encontró llamada crearLogicaAlbaranes')
call = s[call_ini:call_end]
if 'pedidos: pedidos2' not in call:
    target = '    setMovimientos,\n    setPedidos,'
    pos = s.find(target, call_ini, call_end)
    if pos < 0:
        raise SystemExit('No se encontró setPedidos en llamada Albaranes')
    s = s[:pos] + '    setMovimientos,\n    pedidos: pedidos2,\n    setPedidos,' + s[pos+len(target):]

# UI Recepción: no filtrar silenciosamente entradas inválidas, no limpiar si falla y mostrar error.
rec_ui = s.find('function Recepcion({')
rec_ui_end = s.find('function textoHojaConteo(', rec_ui)
if rec_ui < 0 or rec_ui_end < 0:
    raise SystemExit('No se encontró componente Recepcion')
segment = s[rec_ui:rec_ui_end]
if 'erroresRecepcion' not in segment:
    old_state = '  const [cerrando, setCerrando] = (0, import_react4.useState)(null);'
    new_state = old_state + '\n  const [erroresRecepcion, setErroresRecepcion] = (0, import_react4.useState)({});'
    if old_state not in segment:
        raise SystemExit('No se encontró estado cerrando en Recepcion')
    segment = segment.replace(old_state, new_state, 1)

old_click_start = '/* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => {\n      const lineas = pe2.items.filter((it2) => Number((activos[pe2.id] || {})[it2.productoId]?.cantidad) > 0).map((it2) => {'
click_pos = segment.find(old_click_start)
if click_pos < 0:
    if 'const porProducto = new Map();' not in segment:
        raise SystemExit('No se encontró botón Recibir sin albarán')
else:
    click_end_marker = '} }, /* @__PURE__ */ import_react4.default.createElement(CircleCheck, { size: 14 }), " Recibir sin albar\\xE1n")'
    click_end = segment.find(click_end_marker, click_pos)
    if click_end < 0:
        raise SystemExit('No se encontró fin botón Recibir sin albarán')
    click_end += len(click_end_marker)
    new_click = r'''/* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => {
      const porProducto = new Map();
      pe2.items.forEach((it2) => {
        if (porProducto.has(it2.productoId)) return;
        const campo = (activos[pe2.id] || {})[it2.productoId] || {};
        if (String(campo.cantidad ?? "").trim() === "") return;
        const p22 = productoPorId(it2.productoId);
        porProducto.set(it2.productoId, {
          productoId: it2.productoId,
          cantidad: campo.cantidad,
          precioBruto: campo.precio !== void 0 ? campo.precio : p22 ? p22.costo : 0,
          ivaPct: campo.iva !== void 0 ? campo.iva : p22 ? p22.ivaCompra : 10
        });
      });
      const resultado = recibirPedido(pe2.id, [...porProducto.values()]);
      if (!resultado || resultado.ok === false) {
        setErroresRecepcion((s22) => ({ ...s22, [pe2.id]: resultado?.error || "No se pudo registrar la recepción." }));
        return;
      }
      setErroresRecepcion((s22) => ({ ...s22, [pe2.id]: "" }));
      setActivos((s22) => ({ ...s22, [pe2.id]: {} }));
    } }, /* @__PURE__ */ import_react4.default.createElement(CircleCheck, { size: 14 }), " Recibir sin albarán")'''
    segment = segment[:click_pos] + new_click + segment[click_end:]

if 'erroresRecepcion[pe2.id] &&' not in segment:
    marker = '    }), /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-3 flex flex-wrap gap-2" }'
    pos = segment.find(marker)
    if pos < 0:
        raise SystemExit('No se encontró zona de botones Recepcion')
    replacement = '    }), erroresRecepcion[pe2.id] && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mt-2", style: { color: C2.red } }, erroresRecepcion[pe2.id]), /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-3 flex flex-wrap gap-2" }'
    segment = segment[:pos] + replacement + segment[pos+len(marker):]
s = s[:rec_ui] + segment + s[rec_ui_end:]

# UI Albaranes: para pedido enlazado, una línea poblada inválida no se descarta; error mantiene editor abierto.
dar_ini = s.find('  function darEntrada() {')
dar_fin = s.find('  if (modo === "lista") {', dar_ini)
if dar_ini < 0 or dar_fin < 0:
    raise SystemExit('No se encontró darEntrada de Albaranes')
new_dar = r'''  function darEntrada() {
    if (procesandoEntrada) return;
    if (!alb.proveedorId) {
      setError("Selecciona el proveedor.");
      return;
    }
    const pobladas = alb.lineas.filter((ln2) => !!String(ln2.productoId || ln2.descripcion || ln2.codigoProveedor || ln2.cantidad || "").trim());
    const validas = alb.lineas.filter((ln2) => (ln2.descripcion || ln2.codigoProveedor) && Number(ln2.cantidad) > 0);
    const candidatas = alb.pedidoId ? pobladas : validas;
    if (!candidatas.length) {
      setError("Añade al menos una línea con descripción y cantidad.");
      return;
    }
    setError("");
    setProcesandoEntrada(true);
    try {
      const limpio = {
        ...alb,
        lineas: candidatas.map((ln2) => ({ ...ln2, importe: ln2.importe !== "" ? Number(ln2.importe) : Number(importeCalculado(ln2).toFixed(4)) }))
      };
      const resultado = confirmarAlbaran(limpio);
      if (resultado && resultado.ok === false) {
        setError(resultado.error || "No se pudo registrar la recepción del pedido.");
        return;
      }
      setAvisos(resultado && resultado.length ? resultado : []);
      setModo("lista");
      setAlb(null);
      setFotoRevisionIA("");
    } finally {
      setProcesandoEntrada(false);
    }
  }
'''
s = s[:dar_ini] + new_dar + s[dar_fin:]

p.write_text(s, encoding='utf-8')
print('PM10 P06 LA-013 Recepción: patch aplicado/idempotente')
