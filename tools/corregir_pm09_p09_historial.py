from pathlib import Path

path = Path('fuente.js')
src = path.read_text(encoding='utf-8')

start_marker = '  const historialVentas = (0, import_react4.useMemo)(() => {'
end_marker = '  function aplicarPeriodoVentas(tipo) {'
if src.count(start_marker) != 1:
    raise SystemExit(f'P09_historial_inicio_count={src.count(start_marker)}')
start = src.index(start_marker)
end = src.index(end_marker, start)

new_block = r'''  function datoCorreccionHistorialPM09(m22, clave) {
    if (!m22) return void 0;
    if (m22[clave] !== void 0 && m22[clave] !== null) return m22[clave];
    if (m22.datos && m22.datos[clave] !== void 0 && m22.datos[clave] !== null) return m22.datos[clave];
    return void 0;
  }
  function esDevolucionClienteHistorialPM09(m22) {
    if (!m22) return false;
    if (esMovimientoNuevo(m22)) return m22.tipo === "DEVOLUCION_CLIENTE";
    return m22.tipo === "entrada" && Number(m22.ingresoUnitario) < 0 && !m22.anulaVentaId && !!(m22.ventaId || m22.documentoOrigenId || m22.movimientoOriginalId);
  }
  function etiquetaEstadoVentaHistorialPM09(estado) {
    if (estado === "ANULADA") return "ANULADA";
    if (estado === "DEVUELTA_TOTAL") return "DEVUELTA TOTAL";
    if (estado === "DEVUELTA_PARCIAL") return "DEVUELTA PARCIAL";
    return "ACTIVA";
  }
  function colorEstadoVentaHistorialPM09(estado) {
    if (estado === "ANULADA") return C2.red;
    if (estado === "DEVUELTA_TOTAL" || estado === "DEVUELTA_PARCIAL") return C2.amber;
    return C2.accent;
  }
  const historialVentas = (0, import_react4.useMemo)(() => {
    const todos = movimientos || [];
    const anuladasPorId = new Set(todos.filter((m22) => m22.anulaVentaId).map((m22) => m22.anulaVentaId));
    const reversiones = new Set(todos.filter((m22) => m22.revierteMovimientoId).map((m22) => m22.revierteMovimientoId));
    const porVenta = {};
    const correccionesPorVenta = {};
    todos.filter((m22) => esCorreccionVentaPM09(m22)).forEach((m22) => {
      const ventaRaiz = idVentaRaizPM09(m22) || datoCorreccionHistorialPM09(m22, "ventaId") || datoCorreccionHistorialPM09(m22, "anulaVentaId") || datoCorreccionHistorialPM09(m22, "documentoOrigenId");
      if (!ventaRaiz) return;
      if (!correccionesPorVenta[ventaRaiz]) correccionesPorVenta[ventaRaiz] = [];
      correccionesPorVenta[ventaRaiz].push(m22);
    });
    todos.filter((m22) => esVenta(m22) && !m22.anulaVentaId && cantidadConSigno(m22) < 0).forEach((m22) => {
      const ventaId = m22.ventaId || m22.operationId || m22.documentoOrigenId;
      if (!ventaId) return;
      if (!porVenta[ventaId]) porVenta[ventaId] = [];
      porVenta[ventaId].push(m22);
    });
    return Object.entries(porVenta).map(([ventaId, lineas]) => {
      const fecha = lineas.map((l22) => l22.fecha || "").filter(Boolean).sort().slice(-1)[0] || "";
      const marcaTiempo = lineas.map((l22) => l22.timestamp || l22.createdAt || l22.created_at || l22.fechaHora || l22.fecha_hora || l22.marcaTiempo || "").filter(Boolean).sort().slice(-1)[0] || "";
      const importeOriginal = lineas.reduce((a22, l22) => a22 + Math.abs(cantidadConSigno(l22)) * Math.abs(Number(l22.ingresoUnitario) || 0) * (1 + (Number(l22.ivaVentaAplicado) || 0) / 100), 0);
      const nombres = lineas.map((l22) => {
        const p22 = productos.find((x3) => x3.id === l22.productoId);
        return `${fmt(Math.abs(cantidadConSigno(l22)))}× ${p22 ? p22.nombre : "Producto"}`;
      });
      const detallePago = lineas.reduce((acc, l22) => {
        if (!l22.detallePago) return acc;
        acc.efectivo += Number(l22.detallePago.efectivo) || 0;
        acc.tarjeta += Number(l22.detallePago.tarjeta) || 0;
        return acc;
      }, { efectivo: 0, tarjeta: 0 });
      const correcciones = correccionesPorVenta[ventaId] || [];
      const devolucionesCliente = correcciones.filter((m22) => esDevolucionClienteHistorialPM09(m22));
      const anulada = anuladasPorId.has(ventaId) || lineas.some((l22) => reversiones.has(l22.id)) || correcciones.some((m22) => m22.tipo === "REVERSO" || datoCorreccionHistorialPM09(m22, "anulaVentaId") === ventaId);
      const unidadesOriginales = lineas.reduce((a22, l22) => a22 + Math.abs(cantidadConSigno(l22)), 0);
      const unidadesDevueltasSinTope = devolucionesCliente.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0), 0);
      const unidadesDevueltas = Math.min(unidadesOriginales, unidadesDevueltasSinTope);
      const unidadesNetas = anulada ? 0 : Math.max(0, unidadesOriginales - unidadesDevueltas);
      const importeAsociadoDevuelto = devolucionesCliente.reduce((a22, m22) => {
        const cantidad = Math.abs(Number(m22.cantidad) || 0);
        const ingreso = Math.abs(Number(datoCorreccionHistorialPM09(m22, "ingresoUnitario")) || 0);
        const iva = Number(datoCorreccionHistorialPM09(m22, "ivaVentaAplicado")) || 0;
        return a22 + cantidad * ingreso * (1 + iva / 100);
      }, 0);
      const importeNetoGestion = anulada ? 0 : Math.max(0, importeOriginal - importeAsociadoDevuelto);
      const reembolsoAcumulado = devolucionesCliente.reduce((a22, m22) => a22 + Math.max(0, Number(datoCorreccionHistorialPM09(m22, "reembolso")) || 0), 0);
      const estado = anulada ? "ANULADA" : unidadesDevueltas <= 1e-9 ? "ACTIVA" : unidadesOriginales > 0 && unidadesDevueltas >= unidadesOriginales - 1e-9 ? "DEVUELTA_TOTAL" : "DEVUELTA_PARCIAL";
      const trazabilidad = correcciones.map((m22) => {
        const esDev = esDevolucionClienteHistorialPM09(m22);
        return {
          tipo: esDev ? "DEVOLUCION_CLIENTE" : "ANULACION",
          operationId: m22.operationId || m22.id || "",
          movimientoOriginalId: m22.movimientoOriginalId || datoCorreccionHistorialPM09(m22, "movimientoOriginalId") || "",
          fecha: m22.fecha || m22.createdAt || m22.created_at || "",
          productoId: m22.productoId || "",
          cantidad: Math.abs(Number(m22.cantidad) || 0),
          motivo: datoCorreccionHistorialPM09(m22, "motivo") || "",
          reembolso: Math.max(0, Number(datoCorreccionHistorialPM09(m22, "reembolso")) || 0),
          medioReembolso: datoCorreccionHistorialPM09(m22, "medioReembolso") || "",
          importeAsociado: esDev ? Math.abs(Number(datoCorreccionHistorialPM09(m22, "ingresoUnitario")) || 0) * Math.abs(Number(m22.cantidad) || 0) * (1 + (Number(datoCorreccionHistorialPM09(m22, "ivaVentaAplicado")) || 0) / 100) : importeOriginal
        };
      }).sort((a22, b2) => `${a22.fecha} ${a22.operationId}`.localeCompare(`${b2.fecha} ${b2.operationId}`));
      const medioPago2 = lineas[0]?.medioPago || "—";
      const usuario = lineas[0]?.usuario || lineas[0]?.empleado || "";
      const referencia = `V-${(fecha || "SINFECHA").replaceAll("-", "")}-${String(ventaId).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`;
      return { ventaId, referencia, fecha, marcaTiempo, lineas, resumen: nombres.slice(0, 3).join(", ") + (nombres.length > 3 ? ` y ${nombres.length - 3} más` : ""), importe: importeOriginal, importeOriginal, importeNetoGestion, importeAsociadoDevuelto, reembolsoAcumulado, unidadesOriginales, unidadesDevueltas, unidadesNetas, estado, trazabilidad, medioPago: medioPago2, detallePago, usuario, anulada, mesa: lineas[0]?.mesa || lineas[0]?.mesaNumero || "", zona: lineas[0]?.zona || lineas[0]?.sala || lineas[0]?.ubicacion || "", numeroFiscal: lineas[0]?.numeroFiscal || lineas[0]?.numeroFactura || "", entregado: lineas[0]?.importeEntregado ?? lineas[0]?.entregado ?? null, cambio: lineas[0]?.cambioEntregado ?? lineas[0]?.cambio ?? null };
    }).sort((a22, b2) => `${b2.fecha} ${b2.marcaTiempo}`.localeCompare(`${a22.fecha} ${a22.marcaTiempo}`));
  }, [movimientos, productos]);
  const ventasFiltradas = (0, import_react4.useMemo)(() => {
    const q2 = filtroVentasTexto.trim().toLowerCase();
    return historialVentas.filter((v22) => {
      if (filtroVentasDesde && v22.fecha < filtroVentasDesde) return false;
      if (filtroVentasHasta && v22.fecha > filtroVentasHasta) return false;
      if (filtroVentasPago !== "Todos" && v22.medioPago !== filtroVentasPago) return false;
      if (filtroVentasEstado === "Activas" && v22.estado !== "ACTIVA") return false;
      if (filtroVentasEstado === "Anuladas" && v22.estado !== "ANULADA") return false;
      if (filtroVentasEstado === "Dev. parcial" && v22.estado !== "DEVUELTA_PARCIAL") return false;
      if (filtroVentasEstado === "Dev. total" && v22.estado !== "DEVUELTA_TOTAL") return false;
      if (!q2) return true;
      const productosTexto = v22.lineas.map((l22) => productos.find((p22) => p22.id === l22.productoId)?.nombre || "").join(" ");
      const correccionesTexto = (v22.trazabilidad || []).map((c2) => `${c2.tipo} ${c2.operationId} ${c2.motivo} ${c2.medioReembolso}`).join(" ");
      return `${v22.referencia} ${v22.ventaId} ${v22.fecha} ${v22.medioPago} ${v22.usuario} ${v22.estado} ${productosTexto} ${correccionesTexto}`.toLowerCase().includes(q2);
    });
  }, [historialVentas, filtroVentasTexto, filtroVentasDesde, filtroVentasHasta, filtroVentasPago, filtroVentasEstado, productos]);
  const resumenHistorialVentas = (0, import_react4.useMemo)(() => {
    const vigentes = ventasFiltradas.filter((v22) => v22.estado === "ACTIVA" || v22.estado === "DEVUELTA_PARCIAL");
    const total2 = ventasFiltradas.reduce((a22, v22) => a22 + (Number(v22.importeNetoGestion) || 0), 0);
    return { n: ventasFiltradas.length, activas: vigentes.length, total: total2, ticketMedio: vigentes.length ? total2 / vigentes.length : 0 };
  }, [ventasFiltradas]);
'''

src = src[:start] + new_block + src[end:]

def replace_once(old, new, label):
    global src
    count = src.count(old)
    if count != 1:
        raise SystemExit(f'P09_{label}_count={count}')
    src = src.replace(old, new, 1)

replace_once(
    '["Todas", "Activas", "Anuladas"].map((x3) => h3("option", { key: x3, value: x3 }, x3))',
    '["Todas", "Activas", "Anuladas", "Dev. parcial", "Dev. total"].map((x3) => h3("option", { key: x3, value: x3 }, x3))',
    'filtros_estado'
)

old_row = 'h3("div", null, h3("div", { className: "text-[12.5px] font-semibold" }, v23.referencia, v23.anulada ? h3(Pill2, { color: C2.red }, "anulada") : null), h3("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, `${v23.fecha || "Sin fecha"} \\xB7 ${v23.medioPago}${v23.usuario ? " \\xB7 " + v23.usuario : ""}`)),\n          h3("div", { className: "mono font-bold text-[13px]" }, "\\u20AC", fmt(v23.importe))'
new_row = 'h3("div", null, h3("div", { className: "text-[12.5px] font-semibold" }, v23.referencia, h3(Pill2, { color: colorEstadoVentaHistorialPM09(v23.estado) }, etiquetaEstadoVentaHistorialPM09(v23.estado))), h3("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, `${v23.fecha || "Sin fecha"} \\xB7 ${v23.medioPago}${v23.usuario ? " \\xB7 " + v23.usuario : ""}`)),\n          h3("div", { className: "text-right" }, h3("div", { className: "mono font-bold text-[13px]" }, "\\u20AC", fmt(v23.importeNetoGestion)), v23.estado !== "ACTIVA" ? h3("div", { className: "text-[9.5px]", style: { color: C2.inkSoft } }, `Original \\u20AC${fmt(v23.importeOriginal)}`) : null)'
replace_once(old_row, new_row, 'fila_historial')

old_detail_header = 'h3("div", { className: "flex items-center justify-between mb-3" }, h3("div", { className: "text-[12px]", style: { color: C2.inkSoft } }, `${v22.fecha || "Sin fecha"} \\xB7 ${v22.medioPago}`), v22.anulada ? h3(Pill2, { color: C2.red }, "ANULADA") : h3(Pill2, { color: C2.accent }, "ACTIVA"))'
new_detail_header = 'h3("div", { className: "flex items-center justify-between mb-3" }, h3("div", { className: "text-[12px]", style: { color: C2.inkSoft } }, `${v22.fecha || "Sin fecha"} \\xB7 ${v22.medioPago}`), h3(Pill2, { color: colorEstadoVentaHistorialPM09(v22.estado) }, etiquetaEstadoVentaHistorialPM09(v22.estado)))'
replace_once(old_detail_header, new_detail_header, 'cabecera_detalle')

old_total = 'h3("div", { className: "flex justify-between py-2 mb-2 font-bold", style: { borderTop: `1px solid ${C2.line}` } }, h3("span", null, "Total"), h3("span", { className: "mono" }, "\\u20AC", fmt(v22.importe))),'
new_total = '''h3("div", { className: "py-2 mb-2", style: { borderTop: `1px solid ${C2.line}` } },
        h3("div", { className: "flex justify-between font-bold" }, h3("span", null, "Total original"), h3("span", { className: "mono" }, "\\u20AC", fmt(v22.importeOriginal))),
        v22.estado !== "ACTIVA" ? h3("div", { className: "flex justify-between mt-1 text-[12px]" }, h3("span", null, "Neto de gestión"), h3("span", { className: "mono font-semibold" }, "\\u20AC", fmt(v22.importeNetoGestion))) : null,
        v22.unidadesDevueltas > 0 ? h3("div", { className: "flex justify-between mt-1 text-[11px]", style: { color: C2.inkSoft } }, h3("span", null, `Unidades: ${fmt(v22.unidadesNetas)} netas de ${fmt(v22.unidadesOriginales)}`), h3("span", null, `Reembolso: \\u20AC${fmt(v22.reembolsoAcumulado)}`)) : null
      ),
      v22.trazabilidad && v22.trazabilidad.length ? h3("div", { className: "rounded-lg p-2.5 mb-3", style: { background: C2.surface2 || C2.surface, border: `1px solid ${C2.line}` } },
        h3("div", { className: "text-[11px] font-bold mb-1.5" }, "Trazabilidad de correcciones"),
        v22.trazabilidad.map((c2, i33) => h3("div", { key: c2.operationId || i33, className: "text-[10.5px] py-1", style: { borderTop: i33 ? `1px dotted ${C2.line}` : "none" } },
          h3("div", { className: "font-semibold" }, c2.tipo === "ANULACION" ? "Anulación vinculada" : `Devolución cliente ×${fmt(c2.cantidad)}`),
          h3("div", { style: { color: C2.inkSoft } }, `${c2.fecha || "Sin fecha"}${c2.motivo ? " · " + c2.motivo : ""}${c2.tipo === "DEVOLUCION_CLIENTE" ? ` · reembolso \\u20AC${fmt(c2.reembolso)}${c2.medioReembolso ? " " + c2.medioReembolso : ""}` : ""}`),
          h3("div", { className: "break-all", style: { color: C2.inkSoft } }, `Operación: ${c2.operationId || "—"}${c2.movimientoOriginalId ? " · origen: " + c2.movimientoOriginalId : ""}`)
        ))
      ) : null,'''
replace_once(old_total, new_total, 'detalle_total_trazabilidad')

replace_once('!v22.anulada && anularVenta ? h3(Btn, { variant: "danger", onClick: () => {', 'v22.estado === "ACTIVA" && anularVenta ? h3(Btn, { variant: "danger", onClick: () => {', 'boton_anular')

old_ticket_banner = 'v22.anulada ? h3("div", { className: "text-center text-[11px] font-bold rounded-lg py-2 mb-3", style: { background: C2.redSoft || "#FCE8E6", color: C2.red } }, "VENTA ANULADA") : null,'
new_ticket_banner = 'v22.estado !== "ACTIVA" ? h3("div", { className: "text-center text-[11px] font-bold rounded-lg py-2 mb-3", style: { background: v22.estado === "ANULADA" ? C2.redSoft || "#FCE8E6" : C2.amberSoft || C2.surface2, color: colorEstadoVentaHistorialPM09(v22.estado) } }, etiquetaEstadoVentaHistorialPM09(v22.estado)) : null,'
replace_once(old_ticket_banner, new_ticket_banner, 'ticket_banner')

replace_once('h3("div", { className: "font-bold text-[12px] mt-3" }, v22.anulada ? "VENTA ANULADA" : pieEmpresa),', 'h3("div", { className: "font-bold text-[12px] mt-3" }, v22.estado !== "ACTIVA" ? etiquetaEstadoVentaHistorialPM09(v22.estado) : pieEmpresa),', 'ticket_pie')

path.write_text(src, encoding='utf-8')
print('PM09_P09_HISTORIAL_PATCH_OK=1')
