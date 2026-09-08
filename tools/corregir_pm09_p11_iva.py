from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

marker = 'function LibroIva({ movimientos, productos, albaranes, proveedorPorId, facturasDirectas = [] }) {'
if marker not in s:
    raise SystemExit('PM09_P11_LIBROIVA_NO_ENCONTRADO')

helpers = r'''// PM-09 / Punto 11: proyección fiscal conciliada de ventas.
// No se usa la ficha actual del producto para reconstruir IVA histórico.
// REVERSO resta en la fecha de la corrección. Una DEVOLUCION_CLIENTE solo se
// proyecta fiscalmente cuando existe un reembolso registrado; SIN_REEMBOLSO
// queda explícitamente pendiente de criterio/documentación fiscal.
function datoFiscalVentaPM09(m22, clave) {
  if (!m22) return void 0;
  if (m22[clave] !== void 0 && m22[clave] !== null) return m22[clave];
  if (m22.datos && m22.datos[clave] !== void 0 && m22.datos[clave] !== null) return m22.datos[clave];
  return void 0;
}
function esReversoIvaPM09(m22) {
  if (!m22) return false;
  if (esMovimientoNuevo(m22)) return m22.tipo === "REVERSO";
  return m22.tipo === "entrada" && Number(m22.ingresoUnitario) < 0 && !!m22.anulaVentaId;
}
function esDevolucionIvaPM09(m22) {
  if (!m22) return false;
  if (esMovimientoNuevo(m22)) return m22.tipo === "DEVOLUCION_CLIENTE";
  return String(m22.motivo || "").toLowerCase().includes("devoluci") && Number(m22.ingresoUnitario) < 0 && !!m22.ventaId;
}
function movimientoOriginalFiscalPM09(m22, movimientos = []) {
  if (!m22) return null;
  const originalId = m22.movimientoOriginalId ?? datoFiscalVentaPM09(m22, "movimientoOriginalId");
  if (originalId !== void 0 && originalId !== null && originalId !== "") {
    const porId = (movimientos || []).find((x3) => String(x3.id) === String(originalId) || String(x3.movimientoId || "") === String(originalId));
    if (porId) return porId;
  }
  const ventaId = m22.anulaVentaId || m22.ventaId || datoFiscalVentaPM09(m22, "anulaVentaId") || datoFiscalVentaPM09(m22, "ventaId") || m22.documentoOrigenId || null;
  if (ventaId) {
    return (movimientos || []).find((x3) => esVenta(x3) && String(x3.operationId || x3.ventaId || x3.id) === String(ventaId)) || null;
  }
  return null;
}
function ivaHistoricoVentaPM09(m22, movimientos = []) {
  const directo = datoFiscalVentaPM09(m22, "ivaVentaAplicado");
  if (directo !== "" && directo !== void 0 && directo !== null && Number.isFinite(Number(directo))) return Number(directo);
  const original = movimientoOriginalFiscalPM09(m22, movimientos);
  const heredado = datoFiscalVentaPM09(original, "ivaVentaAplicado");
  if (heredado !== "" && heredado !== void 0 && heredado !== null && Number.isFinite(Number(heredado))) return Number(heredado);
  return null;
}
function ingresoHistoricoVentaPM09(m22, movimientos = []) {
  const directo = datoFiscalVentaPM09(m22, "ingresoUnitario");
  if (directo !== "" && directo !== void 0 && directo !== null && Number.isFinite(Number(directo))) return Math.abs(Number(directo));
  const original = movimientoOriginalFiscalPM09(m22, movimientos);
  const heredado = datoFiscalVentaPM09(original, "ingresoUnitario");
  if (heredado !== "" && heredado !== void 0 && heredado !== null && Number.isFinite(Number(heredado))) return Math.abs(Number(heredado));
  return null;
}
function aporteIvaVentaPM09(m22, movimientos = []) {
  const esV = esVenta(m22);
  const esR = esReversoIvaPM09(m22);
  const esD = esDevolucionIvaPM09(m22);
  if (!esV && !esR && !esD) return null;
  const tipo = ivaHistoricoVentaPM09(m22, movimientos);
  const ingreso = ingresoHistoricoVentaPM09(m22, movimientos);
  const cantidad = Math.abs(Number(m22.cantidad) || 0);
  const comun = {
    operationId: m22.operationId || m22.id || "",
    fecha: m22.fecha || "",
    tipoOperacion: esV ? "VENTA" : esR ? "REVERSO" : "DEVOLUCION_CLIENTE",
    medioPago: m22.medioPago || "",
    tipoIva: tipo
  };
  if (tipo === null || ingreso === null) return { ...comun, base: 0, cuota: 0, total: 0, pendiente: true, motivoPendiente: "FALTA_SNAPSHOT_IVA_HISTORICO" };
  const factor = 1 + tipo / 100;
  if (!Number.isFinite(factor) || factor <= 0) return { ...comun, base: 0, cuota: 0, total: 0, pendiente: true, motivoPendiente: "IVA_HISTORICO_INVALIDO" };
  if (esD) {
    const reembolsoRaw = datoFiscalVentaPM09(m22, "reembolso");
    const medioReembolso = datoFiscalVentaPM09(m22, "medioReembolso") || "";
    const reembolso = Number(reembolsoRaw);
    if (!Number.isFinite(reembolso) || reembolso <= 0 || String(medioReembolso).toUpperCase() === "SIN_REEMBOLSO") {
      return { ...comun, medioReembolso, base: 0, cuota: 0, total: 0, pendiente: true, motivoPendiente: "DEVOLUCION_SIN_REEMBOLSO" };
    }
    const brutoAsociado = cantidad * ingreso * factor;
    const brutoCorregido = Math.min(Math.max(0, reembolso), Math.max(0, brutoAsociado));
    const base = -(brutoCorregido / factor);
    const cuota = -(brutoCorregido + base);
    const diferencia = Math.abs(brutoAsociado - reembolso);
    return { ...comun, medioReembolso, base, cuota, total: -brutoCorregido, pendiente: diferencia > 0.01, motivoPendiente: diferencia > 0.01 ? "REEMBOLSO_DIFIERE_IMPORTE_ASOCIADO" : "" };
  }
  const baseAbs = cantidad * ingreso;
  const signo = esR ? -1 : 1;
  const base = signo * baseAbs;
  const cuota = signo * baseAbs * (tipo / 100);
  return { ...comun, base, cuota, total: base + cuota, pendiente: false, motivoPendiente: "" };
}
function resumenIvaVentasPM09(movimientos = [], desde = "", hasta = "") {
  const porTipo = {};
  const detalle = [];
  const pendientes = [];
  (movimientos || []).forEach((m22) => {
    if (!m22 || m22.fecha < desde || m22.fecha > hasta) return;
    const aporte = aporteIvaVentaPM09(m22, movimientos);
    if (!aporte) return;
    detalle.push(aporte);
    if (aporte.pendiente) pendientes.push(aporte);
    // Un ajuste pendiente no altera los totales fiscales hasta que su criterio
    // o documentación quede resuelto. Venta/REVERSO válidos sí se contabilizan.
    if (aporte.pendiente && aporte.motivoPendiente !== "REEMBOLSO_DIFIERE_IMPORTE_ASOCIADO") return;
    if (aporte.tipoIva === null) return;
    const clave = String(aporte.tipoIva);
    if (!porTipo[clave]) porTipo[clave] = { base: 0, cuota: 0 };
    porTipo[clave].base += aporte.base;
    porTipo[clave].cuota += aporte.cuota;
  });
  return { porTipo, detalle, pendientes };
}
'''
if 'function resumenIvaVentasPM09(' not in s:
    s = s.replace(marker, helpers + marker, 1)

old_rep = r'''  const repercutido = (0, import_react4.useMemo)(() => {
    const porTipo = {};
    movimientos.filter((m22) => esVenta(m22) && m22.fecha >= desde && m22.fecha <= hasta).forEach((m22) => {
      const base = Math.abs(Number(m22.cantidad) || 0) * (Number(m22.ingresoUnitario) || 0);
      const tipo = m22.ivaVentaAplicado != null ? m22.ivaVentaAplicado : productos.find((p22) => p22.id === m22.productoId)?.ivaVenta ?? 10;
      if (!porTipo[tipo]) porTipo[tipo] = { base: 0, cuota: 0 };
      porTipo[tipo].base += base;
      porTipo[tipo].cuota += base * (tipo / 100);
    });
    return porTipo;
  }, [movimientos, productos, desde, hasta]);'''
new_rep = r'''  const resumenIvaVentas = (0, import_react4.useMemo)(() => resumenIvaVentasPM09(movimientos, desde, hasta), [movimientos, desde, hasta]);
  const repercutido = resumenIvaVentas.porTipo;'''
if old_rep not in s:
    raise SystemExit('PM09_P11_REPERCUTIDO_NO_ENCONTRADO')
s = s.replace(old_rep, new_rep, 1)

old_det = r'''    const ventasDelPeriodo = movimientos.filter((m22) => esVenta(m22) && m22.fecha >= desde && m22.fecha <= hasta);
    const porTicket = /* @__PURE__ */ new Map();
    ventasDelPeriodo.forEach((m22) => {
      const clave = m22.operationId || m22.ventaId || m22.id;
      if (!porTicket.has(clave)) porTicket.set(clave, { fecha: m22.fecha, medioPago: m22.medioPago || "Efectivo", base: 0, iva: 0 });
      const fila = porTicket.get(clave);
      const base = Math.abs(Number(m22.cantidad) || 0) * (Number(m22.ingresoUnitario) || 0);
      const tipo = m22.ivaVentaAplicado != null ? m22.ivaVentaAplicado : productos.find((p22) => p22.id === m22.productoId)?.ivaVenta ?? 10;
      fila.base += base;
      fila.iva += base * (tipo / 100);
    });
    const detalleVentas = [...porTicket.values()].sort((a22, b2) => (a22.fecha || "").localeCompare(b2.fecha || "")).map((t22) => ({
      Fecha: t22.fecha,
      "Medio de pago": t22.medioPago,
      Base: Number(t22.base.toFixed(2)),
      IVA: Number(t22.iva.toFixed(2)),
      Total: Number((t22.base + t22.iva).toFixed(2))
    }));'''
new_det = r'''    const detalleVentas = resumenIvaVentas.detalle.slice().sort((a22, b2) => `${a22.fecha} ${a22.operationId}`.localeCompare(`${b2.fecha} ${b2.operationId}`)).map((t22) => ({
      Fecha: t22.fecha,
      "Tipo operación": t22.tipoOperacion,
      "ID operación": t22.operationId,
      "Medio de pago": t22.medioPago || t22.medioReembolso || "—",
      "Tipo IVA": t22.tipoIva == null ? "REVISAR" : `${t22.tipoIva}%`,
      Base: Number(t22.base.toFixed(2)),
      IVA: Number(t22.cuota.toFixed(2)),
      Total: Number(t22.total.toFixed(2)),
      Estado: t22.pendiente ? `REVISAR: ${t22.motivoPendiente}` : "CONCILIADO"
    }));'''
if old_det not in s:
    raise SystemExit('PM09_P11_DETALLE_EXCEL_NO_ENCONTRADO')
s = s.replace(old_det, new_det, 1)

old_intro = '"Resumen trimestral para tu declaraci\\xF3n (modelo 303): IVA repercutido de tus ventas e IVA soportado de tus compras, por tipo. Este programa no presenta el modelo por ti \\u2014 te da los n\\xFAmeros listos para que tu gestor\\xEDa los meta, o para revisarlos t\\xFA antes de d\\xE1rselos."'
new_intro = '"Resumen trimestral de control: concilia IVA repercutido de operaciones de venta e IVA soportado de compras por tipo. Es una proyecci\\xF3n interna, no sustituye la documentaci\\xF3n fiscal ni la revisi\\xF3n de tu gestor\\xEDa."'
if old_intro not in s:
    raise SystemExit('PM09_P11_INTRO_NO_ENCONTRADA')
s = s.replace(old_intro, new_intro, 1)

old_btn = r'''/* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: exportarExcel }, /* @__PURE__ */ import_react4.default.createElement(Download, { size: 14 }), " Exportar a Excel"),'''
new_btn = r'''resumenIvaVentas.pendientes.length > 0 ? /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.amberSoft || C2.bg } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] font-semibold" }, `${resumenIvaVentas.pendientes.length} corrección(es) requieren revisión fiscal`), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, "Las devoluciones sin reembolso, los importes de reembolso que no coinciden con el valor asociado o las operaciones sin IVA histórico no se convierten silenciosamente en una cifra fiscal definitiva.")) : null, /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: exportarExcel }, /* @__PURE__ */ import_react4.default.createElement(Download, { size: 14 }), " Exportar a Excel"),'''
if old_btn not in s:
    raise SystemExit('PM09_P11_BOTON_NO_ENCONTRADO')
s = s.replace(old_btn, new_btn, 1)

old_note = r'''"Solo cuentan las ventas registradas con motivo \"Venta\", los albaranes ya dados de entrada y las facturas directas registradas en Cuentas por pagar. Si falta algo por registrar, este libro tampoco lo ver\xE1."'''
new_note = r'''"Ventas y REVERSO usan su snapshot hist\xF3rico y la fecha de cada operaci\xF3n. Las devoluciones con reembolso se proyectan por el importe realmente corregido; SIN_REEMBOLSO queda pendiente de criterio/documentaci\xF3n fiscal. Caja y medio de pago no determinan por s\xED solos el IVA."'''
if old_note not in s:
    raise SystemExit('PM09_P11_NOTA_NO_ENCONTRADA')
s = s.replace(old_note, new_note, 1)

# Persistir en el movimiento sincronizado los datos necesarios para que una
# devolución siga siendo conciliable después de recargar la aplicación.
old_sync = r'''        medioPago: d2.medioPago || null,
        detallePago: d2.detallePago || null,
        fecha: creado ? creado.slice(0, 10) : todayISO(),'''
new_sync = r'''        medioPago: d2.medioPago || null,
        detallePago: d2.detallePago || null,
        reembolso: d2.reembolso !== void 0 && d2.reembolso !== null ? Number(d2.reembolso) || 0 : null,
        medioReembolso: d2.medioReembolso || null,
        fecha: creado ? creado.slice(0, 10) : todayISO(),'''
count_sync = s.count(old_sync)
if count_sync != 1:
    raise SystemExit(f'PM09_P11_SYNC_NO_UNICO:{count_sync}')
s = s.replace(old_sync, new_sync, 1)

p.write_text(s, encoding='utf-8')
print('PM09_P11_IVA_PATCH_OK=1')
