from pathlib import Path
p=Path('fuente.js')
s=p.read_text(encoding='utf-8')

def uno(txt,a,b,n):
    c=txt.count(a)
    assert c==1, f'{n}: esperado 1, encontrado {c}'
    print('OK',n)
    return txt.replace(a,b,1)

# 1. El RPC ya conoce ventaId; devolverlo también a la UI.
s=uno(s,
'''      return { ok: true, n: lineasParaRpc.length, modo: "atomico" };''',
'''      return { ok: true, n: lineasParaRpc.length, modo: "atomico", ventaId };''',
'RPC ventaId éxito')
s=uno(s,
'''        return { ok: true, n: lineasParaRpc.length, modo: "atomico", reintentada: true };''',
'''        return { ok: true, n: lineasParaRpc.length, modo: "atomico", reintentada: true, ventaId };''',
'RPC ventaId reintento')

# Trabajar únicamente dentro de VentaRapida.
ini=s.index('function VentaRapida(')
fin=s.index('function Traspasos(',ini)
b=s[ini:fin]

# 2. Sustituir el listado defectuoso de ventas de hoy por un historial robusto.
i=b.index('  const ventasDeHoy =')
j=b.index('  function confirmarAnulacion()',i)
nuevo='''  const [ventaDetalle, setVentaDetalle] = (0, import_react4.useState)(null);
  const [filtroVentasTexto, setFiltroVentasTexto] = (0, import_react4.useState)("");
  const [filtroVentasDesde, setFiltroVentasDesde] = (0, import_react4.useState)("");
  const [filtroVentasHasta, setFiltroVentasHasta] = (0, import_react4.useState)("");
  const [filtroVentasPago, setFiltroVentasPago] = (0, import_react4.useState)("Todos");
  const [filtroVentasEstado, setFiltroVentasEstado] = (0, import_react4.useState)("Todas");
  const historialVentas = (0, import_react4.useMemo)(() => {
    const todos = movimientos || [];
    const anuladasPorId = new Set(todos.filter((m2) => m2.anulaVentaId).map((m2) => m2.anulaVentaId));
    const reversiones = new Set(todos.filter((m2) => m2.revierteMovimientoId).map((m2) => m2.revierteMovimientoId));
    const porVenta = {};
    todos.filter((m2) => esVenta(m2) && !m2.anulaVentaId && cantidadConSigno(m2) < 0).forEach((m2) => {
      const ventaId = m2.ventaId || m2.operationId || m2.documentoOrigenId;
      if (!ventaId) return;
      if (!porVenta[ventaId]) porVenta[ventaId] = [];
      porVenta[ventaId].push(m2);
    });
    return Object.entries(porVenta).map(([ventaId, lineas]) => {
      const fecha = lineas.map((l2) => l2.fecha || "").filter(Boolean).sort().slice(-1)[0] || "";
      const marcaTiempo = lineas.map((l2) => l2.timestamp || l2.createdAt || l2.fechaHora || "").filter(Boolean).sort().slice(-1)[0] || "";
      const importe = lineas.reduce((a2, l2) => a2 + Math.abs(cantidadConSigno(l2)) * Math.abs(Number(l2.ingresoUnitario) || 0) * (1 + (Number(l2.ivaVentaAplicado) || 0) / 100), 0);
      const nombres = lineas.map((l2) => {
        const p2 = productos.find((x3) => x3.id === l2.productoId);
        return `${fmt(Math.abs(cantidadConSigno(l2)))}× ${p2 ? p2.nombre : "Producto"}`;
      });
      const detallePago = lineas.reduce((acc, l2) => {
        if (!l2.detallePago) return acc;
        acc.efectivo += Number(l2.detallePago.efectivo) || 0;
        acc.tarjeta += Number(l2.detallePago.tarjeta) || 0;
        return acc;
      }, { efectivo: 0, tarjeta: 0 });
      const anulada = anuladasPorId.has(ventaId) || lineas.some((l2) => reversiones.has(l2.id));
      const medioPago = lineas[0]?.medioPago || "—";
      const usuario = lineas[0]?.usuario || lineas[0]?.empleado || "";
      const referencia = `V-${(fecha || "SINFECHA").replaceAll("-", "")}-${String(ventaId).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`;
      return { ventaId, referencia, fecha, marcaTiempo, lineas, resumen: nombres.slice(0, 3).join(", ") + (nombres.length > 3 ? ` y ${nombres.length - 3} más` : ""), importe, medioPago, detallePago, usuario, anulada };
    }).sort((a2, b2) => `${b2.fecha} ${b2.marcaTiempo}`.localeCompare(`${a2.fecha} ${a2.marcaTiempo}`));
  }, [movimientos, productos]);
  const ventasFiltradas = (0, import_react4.useMemo)(() => {
    const q2 = filtroVentasTexto.trim().toLowerCase();
    return historialVentas.filter((v2) => {
      if (filtroVentasDesde && v2.fecha < filtroVentasDesde) return false;
      if (filtroVentasHasta && v2.fecha > filtroVentasHasta) return false;
      if (filtroVentasPago !== "Todos" && v2.medioPago !== filtroVentasPago) return false;
      if (filtroVentasEstado === "Activas" && v2.anulada) return false;
      if (filtroVentasEstado === "Anuladas" && !v2.anulada) return false;
      if (!q2) return true;
      const productosTexto = v2.lineas.map((l2) => productos.find((p2) => p2.id === l2.productoId)?.nombre || "").join(" ");
      return `${v2.referencia} ${v2.ventaId} ${v2.fecha} ${v2.medioPago} ${v2.usuario} ${productosTexto}`.toLowerCase().includes(q2);
    });
  }, [historialVentas, filtroVentasTexto, filtroVentasDesde, filtroVentasHasta, filtroVentasPago, filtroVentasEstado, productos]);
  const resumenHistorialVentas = (0, import_react4.useMemo)(() => {
    const activas = ventasFiltradas.filter((v2) => !v2.anulada);
    const total = activas.reduce((a2, v2) => a2 + v2.importe, 0);
    return { n: ventasFiltradas.length, activas: activas.length, total, ticketMedio: activas.length ? total / activas.length : 0 };
  }, [ventasFiltradas]);
  function aplicarPeriodoVentas(tipo) {
    const hoy = todayISO();
    if (tipo === "hoy") { setFiltroVentasDesde(hoy); setFiltroVentasHasta(hoy); }
    else if (tipo === "mes") { setFiltroVentasDesde(primerDiaMes(hoy)); setFiltroVentasHasta(ultimoDiaMes(hoy)); }
    else { setFiltroVentasDesde(""); setFiltroVentasHasta(""); }
  }
  function renderHistorialVentas() {
    const h = import_react4.default.createElement;
    const controles = h(Card, { className: "mt-5" },
      h("div", { className: "flex items-center justify-between gap-2 mb-1" },
        h("div", { className: "text-[14px] font-semibold" }, "Historial de ventas"),
        h("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, `${historialVentas.length} registrada(s)`)
      ),
      h("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Registro interno del TPV. Las anulaciones permanecen visibles y el histórico nunca se borra."),
      h("div", { className: "grid grid-cols-3 gap-2 mb-3" },
        h("div", { className: "rounded-lg p-2", style: { background: C2.surface2 || C2.surface } }, h("div", { className: "text-[10px]", style: { color: C2.inkSoft } }, "Ventas"), h("div", { className: "font-bold mono text-[14px]" }, resumenHistorialVentas.activas)),
        h("div", { className: "rounded-lg p-2", style: { background: C2.surface2 || C2.surface } }, h("div", { className: "text-[10px]", style: { color: C2.inkSoft } }, "Total vigente"), h("div", { className: "font-bold mono text-[14px]" }, "€", fmt(resumenHistorialVentas.total))),
        h("div", { className: "rounded-lg p-2", style: { background: C2.surface2 || C2.surface } }, h("div", { className: "text-[10px]", style: { color: C2.inkSoft } }, "Ticket medio"), h("div", { className: "font-bold mono text-[14px]" }, "€", fmt(resumenHistorialVentas.ticketMedio)))
      ),
      h("div", { className: "flex gap-1.5 mb-3 flex-wrap" },
        h(Btn, { small: true, variant: "ghost", onClick: () => aplicarPeriodoVentas("hoy") }, "Hoy"),
        h(Btn, { small: true, variant: "ghost", onClick: () => aplicarPeriodoVentas("mes") }, "Este mes"),
        h(Btn, { small: true, variant: "ghost", onClick: () => aplicarPeriodoVentas("todo") }, "Todo")
      ),
      h("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2" },
        h(Input, { value: filtroVentasTexto, onChange: (e) => setFiltroVentasTexto(e.target.value), placeholder: "Buscar venta, producto, pago o empleado…" }),
        h("select", { value: filtroVentasPago, onChange: (e) => setFiltroVentasPago(e.target.value), className: "w-full rounded-lg px-3 py-2 text-[12.5px]", style: { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink } }, ["Todos", "Efectivo", "Tarjeta", "Mixto", "Transferencia", "Otro"].map((x3) => h("option", { key: x3, value: x3 }, x3 === "Todos" ? "Todos los pagos" : x3)))
      ),
      h("div", { className: "grid grid-cols-3 gap-2 mb-3" },
        h(Input, { type: "date", value: filtroVentasDesde, onChange: (e) => setFiltroVentasDesde(e.target.value) }),
        h(Input, { type: "date", value: filtroVentasHasta, onChange: (e) => setFiltroVentasHasta(e.target.value) }),
        h("select", { value: filtroVentasEstado, onChange: (e) => setFiltroVentasEstado(e.target.value), className: "w-full rounded-lg px-2 py-2 text-[12px]", style: { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink } }, ["Todas", "Activas", "Anuladas"].map((x3) => h("option", { key: x3, value: x3 }, x3)))
      ),
      ventasFiltradas.length === 0 ? h(Empty, { text: historialVentas.length ? "No hay ventas que coincidan con estos filtros." : "Todavía no hay ventas registradas en este local." }) :
      h("div", { className: "space-y-1.5" }, ventasFiltradas.slice(0, 100).map((v2) => h("button", { key: v2.ventaId, onClick: () => setVentaDetalle(v2), className: "w-full text-left rounded-lg p-2.5", style: { border: `1px solid ${C2.line}`, background: C2.surface } },
        h("div", { className: "flex items-center justify-between gap-2" },
          h("div", null, h("div", { className: "text-[12.5px] font-semibold" }, v2.referencia, v2.anulada ? h(Pill2, { color: C2.red }, "anulada") : null), h("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, `${v2.fecha || "Sin fecha"} · ${v2.medioPago}${v2.usuario ? " · " + v2.usuario : ""}`)),
          h("div", { className: "mono font-bold text-[13px]" }, "€", fmt(v2.importe))
        ),
        h("div", { className: "text-[11px] mt-1", style: { color: C2.inkSoft } }, v2.resumen)
      )))
    );
    if (!ventaDetalle) return controles;
    const v2 = ventaDetalle;
    const detalle = h(Modal, { onClose: () => setVentaDetalle(null), title: `Venta ${v2.referencia}` },
      h("div", { className: "flex items-center justify-between mb-3" }, h("div", { className: "text-[12px]", style: { color: C2.inkSoft } }, `${v2.fecha || "Sin fecha"} · ${v2.medioPago}`), v2.anulada ? h(Pill2, { color: C2.red }, "ANULADA") : h(Pill2, { color: C2.accent }, "ACTIVA")),
      h("div", { className: "space-y-2 mb-3" }, v2.lineas.map((l2) => { const p2 = productos.find((x3) => x3.id === l2.productoId); const cant = Math.abs(cantidadConSigno(l2)); const precio = Math.abs(Number(l2.ingresoUnitario) || 0) * (1 + (Number(l2.ivaVentaAplicado) || 0) / 100); return h("div", { key: l2.id || `${l2.productoId}-${cant}`, className: "flex justify-between gap-3 text-[12.5px]" }, h("div", null, h("div", { className: "font-medium" }, p2?.nombre || "Producto"), h("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, `${fmt(cant)} × €${fmt(precio)} · IVA ${fmt(Number(l2.ivaVentaAplicado) || 0)}%`)), h("div", { className: "mono font-semibold" }, "€", fmt(cant * precio))); })),
      h("div", { className: "flex justify-between py-2 mb-2 font-bold", style: { borderTop: `1px solid ${C2.line}` } }, h("span", null, "Total"), h("span", { className: "mono" }, "€", fmt(v2.importe))),
      v2.medioPago === "Mixto" && (v2.detallePago.efectivo > 0 || v2.detallePago.tarjeta > 0) ? h("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, `Tarjeta €${fmt(v2.detallePago.tarjeta)} + Efectivo €${fmt(v2.detallePago.efectivo)}`) : null,
      h("div", { className: "text-[10px] mb-3 break-all", style: { color: C2.inkSoft } }, `ID interno: ${v2.ventaId}`),
      !v2.anulada && anularVenta ? h(Btn, { variant: "danger", onClick: () => { setVentaDetalle(null); setConfirmAnular(v2); } }, "Anular venta") : null
    );
    return h(import_react4.default.Fragment, null, controles, detalle);
  }
'''
b=b[:i]+nuevo+b[j:]
print('OK historial robusto')

# 3. Guardar ventaId en la confirmación para futuros ticket/reimpresión.
b=uno(b,
'''    setConfirmacion({ total, n: resultado.n, medioPago, cambio, detallePago });''',
'''    setConfirmacion({ total, n: resultado.n, medioPago, cambio, detallePago, ventaId: resultado.ventaId || null });''',
'Confirmación conserva ventaId')

# 4. Sustituir la tarjeta antigua de "Ventas de hoy" por el nuevo historial.
i=b.index('ventasDeHoy.length > 0 &&')
j=b.index('confirmAnular &&',i)
b=b[:i]+'renderHistorialVentas(), '+b[j:]
print('OK render historial')

s=s[:ini]+b+s[fin:]
p.write_text(s,encoding='utf-8')

# Guardas finales del parche.
t= p.read_text(encoding='utf-8')
for x in [
  'const historialVentas =',
  'const ventasFiltradas =',
  'function renderHistorialVentas()',
  'Historial de ventas',
  'Total vigente',
  'Ticket medio',
  'ID interno:',
  'modo: "atomico", ventaId',
  'resultado.ventaId || null'
]: assert x in t, x
assert 'm2.fecha === hoy && m2.ventaId && m2.tipo === "salida"' not in t
print('HISTORIAL_VENTAS_FASE4_PATCH_OK')
