from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise RuntimeError(f'{label}: se esperaba 1 coincidencia y hay {n}')
    s = s.replace(old, new, 1)

# 1) El componente recibe el local concreto para identificar correctamente el ticket.
replace_once(
    'function VentaRapida({ productos, venderCarrito, anularVenta, movimientos = [], registrarAuditoria }) {',
    'function VentaRapida({ productos, venderCarrito, anularVenta, movimientos = [], registrarAuditoria, local = null }) {',
    'firma VentaRapida'
)

# 2) Estado dedicado al ticket, separado del detalle de gestión.
state_anchor = '  const [ventaDetalle, setVentaDetalle] = (0, import_react4.useState)(null);'
replace_once(
    state_anchor,
    state_anchor + '\n  const [ticketVenta, setTicketVenta] = (0, import_react4.useState)(null);',
    'estado ticketVenta'
)

# 3) Helpers de fecha, IVA y desglose de pago. No inventan datos legacy ausentes.
filter_anchor = '  const ventasFiltradas = (0, import_react4.useMemo)(() => {'
if s.count(filter_anchor) != 1:
    raise RuntimeError(f'anchor ventasFiltradas: {s.count(filter_anchor)}')
helpers = r'''  function fechaHoraTicket(venta) {
    const d2 = venta && venta.marcaTiempo ? new Date(venta.marcaTiempo) : null;
    if (d2 && !isNaN(d2.getTime())) {
      return d2.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }
    return venta && venta.fecha ? venta.fecha : "—";
  }
  function resumenIvaTicket(venta) {
    const mapa = new Map();
    (venta && venta.lineas || []).forEach((m2) => {
      const cantidad = Math.abs(cantidadConSigno(m2));
      const base = cantidad * (Number(m2.ingresoUnitario) || 0);
      const pct = Number(m2.ivaVentaAplicado) || 0;
      const iva = base * pct / 100;
      const actual = mapa.get(pct) || { pct, base: 0, iva: 0 };
      actual.base += base;
      actual.iva += iva;
      mapa.set(pct, actual);
    });
    return [...mapa.values()].sort((a2, b2) => a2.pct - b2.pct);
  }
  function detallePagoTicket(venta) {
    const d2 = venta && venta.detallePago;
    if (!d2) return [];
    return [
      ["Efectivo", Number(d2.efectivo) || 0],
      ["Tarjeta", Number(d2.tarjeta) || 0],
      ["Bizum", Number(d2.bizum) || 0],
      ["Otro", Number(d2.otro) || 0]
    ].filter(([, importe]) => importe > 0);
  }
'''
s = s.replace(filter_anchor, helpers + filter_anchor, 1)

# 4) Desde el detalle se puede abrir/reimprimir el recibo sin modificar la venta.
id_anchor = '/* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mono mt-2", style: { color: C2.inkSoft } }, "ID interno: ", ventaDetalle.id), !ventaDetalle.anulada &&'
if s.count(id_anchor) != 1:
    raise RuntimeError(f'anchor detalle venta: {s.count(id_anchor)}')
id_replacement = '/* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mono mt-2", style: { color: C2.inkSoft } }, "ID interno: ", ventaDetalle.id), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2 flex-wrap mt-3" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: () => setTicketVenta(ventaDetalle) }, "Ver ticket / reimprimir")), !ventaDetalle.anulada &&'
s = s.replace(id_anchor, id_replacement, 1)

# 5) Modal de ticket. Usa exclusivamente los datos de la venta seleccionada.
confirm_anchor = 'confirmAnular && /* @__PURE__ */ import_react4.default.createElement(Modal'
idx = s.find(confirm_anchor)
if idx < 0 or s.find(confirm_anchor, idx + 1) >= 0:
    raise RuntimeError('anchor confirmAnular no es único')
if s[max(0, idx - 4):idx].find(',') < 0:
    raise RuntimeError('contexto inesperado antes de confirmAnular')

ticket_expr = r'''ticketVenta && /* @__PURE__ */ import_react4.default.createElement(
  "div",
  { className: "fixed inset-0 z-[60] overflow-y-auto", style: { background: "rgba(20,32,28,0.52)" } },
  /* @__PURE__ */ import_react4.default.createElement(
    "div",
    { className: "min-h-full p-3 flex items-start justify-center pt-6" },
    /* @__PURE__ */ import_react4.default.createElement(
      Card,
      { style: { maxWidth: 440, width: "100%", background: C2.surface } },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-start justify-between mb-3 no-imprimir" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[15px] font-semibold" }, "Ticket ", ticketVenta.referencia), /* @__PURE__ */ import_react4.default.createElement("button", { onClick: () => setTicketVenta(null), "aria-label": "Cerrar ticket" }, /* @__PURE__ */ import_react4.default.createElement(X, { size: 19 }))),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2 flex-wrap mb-3 no-imprimir" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: () => window.print() }, "Imprimir / Guardar PDF"), /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setTicketVenta(null) }, "Cerrar")),
      /* @__PURE__ */ import_react4.default.createElement(
        "div",
        { className: "zona-impresion ticket-tpv-impresion", style: { ...ESTILO_IMPRESION_CLARO, maxWidth: "80mm", margin: "0 auto", padding: "14px 12px", fontSize: 11, lineHeight: 1.35 } },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-center mb-3" }, /* @__PURE__ */ import_react4.default.createElement("img", { src: LOGO, alt: "", style: { height: 48, width: "auto", margin: "0 auto 6px" } }), /* @__PURE__ */ import_react4.default.createElement("div", { className: "font-semibold text-[14px]" }, local && local.nombre ? local.nombre : "TPV"), local && local.direccion && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px]", style: { color: "#647267" } }, local.direccion), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px] font-semibold mt-2 tracking-wide" }, "TICKET / RECIBO INTERNO")),
        ticketVenta.anulada && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-center font-bold mb-3 py-1.5", style: { borderTop: "1px dashed #B5473A", borderBottom: "1px dashed #B5473A", color: "#B5473A" } }, "VENTA ANULADA"),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-3 pb-2", style: { borderBottom: "1px dashed #9AA5A0" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ import_react4.default.createElement("span", null, "Ref."), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono font-semibold text-right" }, ticketVenta.referencia)), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex justify-between gap-3 mt-1" }, /* @__PURE__ */ import_react4.default.createElement("span", null, "Fecha"), /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-right" }, fechaHoraTicket(ticketVenta))), ticketVenta.usuario && /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex justify-between gap-3 mt-1" }, /* @__PURE__ */ import_react4.default.createElement("span", null, "Atendido por"), /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-right" }, ticketVenta.usuario))),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-3" }, (ticketVenta.lineas || []).map((m2, i3) => {
          const p2 = productos.find((x3) => x3.id === m2.productoId);
          const cantidad = Math.abs(cantidadConSigno(m2));
          const ivaPct = Number(m2.ivaVentaAplicado) || 0;
          const precioUnidad = (Number(m2.ingresoUnitario) || 0) * (1 + ivaPct / 100);
          const subtotal = cantidad * precioUnidad;
          return /* @__PURE__ */ import_react4.default.createElement("div", { key: m2.id || i3, className: "py-1.5", style: { borderBottom: "1px dotted #D8D2C3" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "font-medium" }, p2 ? p2.nombre : m2.productoId || "Producto"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex justify-between gap-3 mt-0.5" }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono" }, fmt(cantidad), " × €", fmt(precioUnidad)), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono font-semibold" }, "€", fmt(subtotal))));
        })),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-3 py-2", style: { borderTop: "1px dashed #9AA5A0", borderBottom: "1px dashed #9AA5A0" } }, resumenIvaTicket(ticketVenta).map((r) => /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, { key: r.pct }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ import_react4.default.createElement("span", null, "Base ", fmt(r.pct), "%"), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono" }, "€", fmt(r.base))), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ import_react4.default.createElement("span", null, "IVA ", fmt(r.pct), "%"), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono" }, "€", fmt(r.iva))))))),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-end justify-between gap-3 mb-3" }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "font-bold text-[13px]" }, "TOTAL"), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono font-bold text-[18px]" }, "€", fmt(ticketVenta.total))),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-3 pt-2", style: { borderTop: "1px dashed #9AA5A0" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ import_react4.default.createElement("span", null, "Pago"), /* @__PURE__ */ import_react4.default.createElement("span", { className: "font-semibold text-right" }, etiquetaPago(ticketVenta))), detallePagoTicket(ticketVenta).length > 1 && detallePagoTicket(ticketVenta).map(([nombre, importe]) => /* @__PURE__ */ import_react4.default.createElement("div", { key: nombre, className: "flex justify-between gap-3 text-[10px] mt-0.5", style: { color: "#647267" } }, /* @__PURE__ */ import_react4.default.createElement("span", null, nombre), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono" }, "€", fmt(importe))))),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-center pt-2", style: { borderTop: "1px dashed #9AA5A0" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "font-medium" }, "Gracias por su compra"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[9px] mono mt-2", style: { color: "#647267", overflowWrap: "anywhere" } }, "ID operación: ", ticketVenta.id), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[9px] mt-1", style: { color: "#647267" } }, "Recibo interno del TPV"))
      )
    )
  )
)'''
s = s[:idx] + ticket_expr + ', ' + s[idx:]

# 6) El TPV recibe el local operativo concreto desde el contenedor.
call_anchor = 'import_react4.default.createElement(VentaRapida, {'
if s.count(call_anchor) != 1:
    raise RuntimeError(f'llamada VentaRapida: {s.count(call_anchor)}')
s = s.replace(call_anchor, call_anchor + ' local: locales.find((l2) => l2.id === localActivoId) || null,', 1)

# 7) Formato estrecho que funciona en 80 mm y también queda centrado en A4/PDF.
css_anchor = '          .zona-impresion thead { display: table-header-group; }'
if s.count(css_anchor) != 1:
    raise RuntimeError(f'CSS impresion: {s.count(css_anchor)}')
css_extra = '''\n          .zona-impresion.ticket-tpv-impresion {\n            width: 80mm !important;\n            max-width: 80mm !important;\n            margin-left: auto !important;\n            margin-right: auto !important;\n            right: 0 !important;\n            padding: 4mm !important;\n            box-sizing: border-box !important;\n          }'''
s = s.replace(css_anchor, css_anchor + css_extra, 1)

# Guardas semánticas.
checks = {
    'ticket state': 'const [ticketVenta, setTicketVenta]',
    'ticket printable': 'ticket-tpv-impresion',
    'ticket label': 'TICKET / RECIBO INTERNO',
    'print action': '"Imprimir / Guardar PDF"',
    'VAT helper': 'function resumenIvaTicket(venta)',
    'local prop': 'local: locales.find((l2) => l2.id === localActivoId) || null',
    'receipt disclaimer': 'Recibo interno del TPV'
}
for label, needle in checks.items():
    if needle not in s:
        raise RuntimeError(f'falta guarda {label}')

p.write_text(s, encoding='utf-8')
print('TICKET_TPV_FASE4_APLICADO=1')
