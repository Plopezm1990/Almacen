from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise RuntimeError(f'{label}: se esperaba 1 coincidencia y hay {n}')
    s = s.replace(old, new, 1)

# Componente: recibe el local concreto para que el recibo quede identificado.
replace_once(
    'function VentaRapida({ productos, venderCarrito, anularVenta, movimientos = [], registrarAuditoria }) {',
    'function VentaRapida({ productos, venderCarrito, anularVenta, movimientos = [], registrarAuditoria, local = null }) {',
    'firma VentaRapida'
)

# Estado independiente del detalle de gestión de la venta.
state_anchor = '  const [ventaDetalle, setVentaDetalle] = (0, import_react4.useState)(null);'
replace_once(
    state_anchor,
    state_anchor + '\n  const [ticketVenta, setTicketVenta] = (0, import_react4.useState)(null);',
    'estado ticketVenta'
)

# Funciones del recibo sobre el mismo modelo normalizado que ya usa el historial validado.
render_anchor = '  function renderHistorialVentas() {'
if s.count(render_anchor) != 1:
    raise RuntimeError(f'renderHistorialVentas: {s.count(render_anchor)}')
helpers = r'''  function fechaHoraTicket(v2) {
    const d2 = v2 && v2.marcaTiempo ? new Date(v2.marcaTiempo) : null;
    if (d2 && !isNaN(d2.getTime())) {
      return d2.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }
    return v2 && v2.fecha ? v2.fecha : "—";
  }
  function resumenIvaTicket(v2) {
    const mapa = new Map();
    (v2 && v2.lineas || []).forEach((l2) => {
      const cantidad = Math.abs(cantidadConSigno(l2));
      const base = cantidad * Math.abs(Number(l2.ingresoUnitario) || 0);
      const pct = Number(l2.ivaVentaAplicado) || 0;
      const iva = base * pct / 100;
      const actual = mapa.get(pct) || { pct, base: 0, iva: 0 };
      actual.base += base;
      actual.iva += iva;
      mapa.set(pct, actual);
    });
    return [...mapa.values()].sort((a2, b2) => a2.pct - b2.pct);
  }
  function imprimirTicketTermico() {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    const anterior = document.getElementById("tpv-ticket-page-style");
    if (anterior) anterior.remove();
    const estilo = document.createElement("style");
    estilo.id = "tpv-ticket-page-style";
    estilo.textContent = "@media print { @page { size: 80mm auto; margin: 2mm; } }";
    document.head.appendChild(estilo);
    const limpiar = () => {
      const actual = document.getElementById("tpv-ticket-page-style");
      if (actual) actual.remove();
      window.removeEventListener("afterprint", limpiar);
    };
    window.addEventListener("afterprint", limpiar);
    window.print();
    setTimeout(limpiar, 4000);
  }
'''
s = s.replace(render_anchor, helpers + render_anchor, 1)

# Botón desde el detalle ya validado por el usuario.
id_anchor = '      h("div", { className: "text-[10px] mb-3 break-all", style: { color: C2.inkSoft } }, `ID interno: ${v2.ventaId}`),\n'
if s.count(id_anchor) != 1:
    raise RuntimeError(f'anchor ID interno: {s.count(id_anchor)}')
button = '      h("div", { className: "flex gap-2 flex-wrap mb-3" }, h(Btn, { onClick: () => setTicketVenta(v2) }, "Ver ticket / reimprimir")),\n'
s = s.replace(id_anchor, id_anchor + button, 1)

# Vista del ticket antes del modal de anulación.
main_anchor = 'renderHistorialVentas(), confirmAnular && /* @__PURE__ */ import_react4.default.createElement(Modal'
if s.count(main_anchor) != 1:
    raise RuntimeError(f'anchor retorno TPV: {s.count(main_anchor)}')

ticket_expr = r'''renderHistorialVentas(), ticketVenta && /* @__PURE__ */ import_react4.default.createElement(
  "div",
  { className: "fixed inset-0 z-[60] overflow-y-auto", style: { background: "rgba(20,32,28,0.52)" } },
  /* @__PURE__ */ import_react4.default.createElement(
    "div",
    { className: "min-h-full p-3 flex items-start justify-center pt-6" },
    /* @__PURE__ */ import_react4.default.createElement(
      Card,
      { style: { maxWidth: 440, width: "100%", background: C2.surface } },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-start justify-between mb-3 no-imprimir" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[15px] font-semibold" }, "Ticket ", ticketVenta.referencia), /* @__PURE__ */ import_react4.default.createElement("button", { onClick: () => setTicketVenta(null), "aria-label": "Cerrar ticket" }, /* @__PURE__ */ import_react4.default.createElement(X, { size: 19 }))),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2 flex-wrap mb-3 no-imprimir" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: () => window.print() }, "Imprimir / PDF"), /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: imprimirTicketTermico }, "Térmica 80 mm"), /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setTicketVenta(null) }, "Cerrar")),
      /* @__PURE__ */ import_react4.default.createElement(
        "div",
        { className: "zona-impresion ticket-tpv-impresion", style: { ...ESTILO_IMPRESION_CLARO, maxWidth: "80mm", margin: "0 auto", padding: "14px 12px", fontSize: 11, lineHeight: 1.35 } },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-center mb-3" }, /* @__PURE__ */ import_react4.default.createElement("img", { src: LOGO, alt: "", style: { height: 48, width: "auto", margin: "0 auto 6px" } }), /* @__PURE__ */ import_react4.default.createElement("div", { className: "font-semibold text-[14px]" }, local && local.nombre ? local.nombre : "TPV"), local && local.direccion && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px]", style: { color: "#647267" } }, local.direccion), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px] font-semibold mt-2 tracking-wide" }, "TICKET / RECIBO INTERNO")),
        ticketVenta.anulada && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-center font-bold mb-3 py-1.5", style: { borderTop: "1px dashed #B5473A", borderBottom: "1px dashed #B5473A", color: "#B5473A" } }, "VENTA ANULADA"),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-3 pb-2", style: { borderBottom: "1px dashed #9AA5A0" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ import_react4.default.createElement("span", null, "Ref."), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono font-semibold text-right" }, ticketVenta.referencia)), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex justify-between gap-3 mt-1" }, /* @__PURE__ */ import_react4.default.createElement("span", null, "Fecha"), /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-right" }, fechaHoraTicket(ticketVenta))), ticketVenta.usuario && /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex justify-between gap-3 mt-1" }, /* @__PURE__ */ import_react4.default.createElement("span", null, "Atendido por"), /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-right" }, ticketVenta.usuario))),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-3" }, (ticketVenta.lineas || []).map((l2, i3) => {
          const p2 = productos.find((x3) => x3.id === l2.productoId);
          const cantidad = Math.abs(cantidadConSigno(l2));
          const ivaPct = Number(l2.ivaVentaAplicado) || 0;
          const precioUnidad = Math.abs(Number(l2.ingresoUnitario) || 0) * (1 + ivaPct / 100);
          const subtotal = cantidad * precioUnidad;
          return /* @__PURE__ */ import_react4.default.createElement("div", { key: l2.id || i3, className: "py-1.5", style: { borderBottom: "1px dotted #D8D2C3" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "font-medium" }, p2 ? p2.nombre : "Producto"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex justify-between gap-3 mt-0.5" }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono" }, fmt(cantidad), " × €", fmt(precioUnidad)), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono font-semibold" }, "€", fmt(subtotal))));
        })),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-3 py-2", style: { borderTop: "1px dashed #9AA5A0", borderBottom: "1px dashed #9AA5A0" } }, resumenIvaTicket(ticketVenta).map((r) => /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, { key: r.pct }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ import_react4.default.createElement("span", null, "Base ", fmt(r.pct), "%"), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono" }, "€", fmt(r.base))), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ import_react4.default.createElement("span", null, "IVA ", fmt(r.pct), "%"), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono" }, "€", fmt(r.iva))))))),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-end justify-between gap-3 mb-3" }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "font-bold text-[13px]" }, "TOTAL"), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono font-bold text-[18px]" }, "€", fmt(ticketVenta.importe))),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-3 pt-2", style: { borderTop: "1px dashed #9AA5A0" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ import_react4.default.createElement("span", null, "Pago"), /* @__PURE__ */ import_react4.default.createElement("span", { className: "font-semibold text-right" }, ticketVenta.medioPago || "—")), ticketVenta.medioPago === "Mixto" && (ticketVenta.detallePago.efectivo > 0 || ticketVenta.detallePago.tarjeta > 0) && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px] mt-1", style: { color: "#647267" } }, "Tarjeta €", fmt(ticketVenta.detallePago.tarjeta), " + Efectivo €", fmt(ticketVenta.detallePago.efectivo))),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-center pt-2", style: { borderTop: "1px dashed #9AA5A0" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "font-medium" }, "Gracias por su compra"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[9px] mono mt-2", style: { color: "#647267", overflowWrap: "anywhere" } }, "ID operación: ", ticketVenta.ventaId), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[9px] mt-1", style: { color: "#647267" } }, "Recibo interno del TPV · no sustituye a una factura cuando corresponda"))
      )
    )
  )
), confirmAnular && /* @__PURE__ */ import_react4.default.createElement(Modal'''
s = s.replace(main_anchor, ticket_expr, 1)

# Propagar el local operativo al TPV.
call_anchor = 'import_react4.default.createElement(VentaRapida, {'
if s.count(call_anchor) != 1:
    raise RuntimeError(f'llamada VentaRapida: {s.count(call_anchor)}')
s = s.replace(call_anchor, call_anchor + ' local: locales.find((l2) => l2.id === localActivoId) || null,', 1)

# El contenido del ticket se mantiene en 80 mm también si se imprime en A4/PDF.
css_anchor = '          .zona-impresion thead { display: table-header-group; }'
if s.count(css_anchor) != 1:
    raise RuntimeError(f'CSS impresión: {s.count(css_anchor)}')
css_extra = '''\n          .zona-impresion.ticket-tpv-impresion {\n            width: 80mm !important;\n            max-width: 80mm !important;\n            left: 0 !important;\n            right: 0 !important;\n            margin-left: auto !important;\n            margin-right: auto !important;\n            padding: 4mm !important;\n            box-sizing: border-box !important;\n          }'''
s = s.replace(css_anchor, css_anchor + css_extra, 1)

# Guardas finales del bloque.
for label, needle in {
    'state': 'const [ticketVenta, setTicketVenta]',
    'view': 'Ver ticket / reimprimir',
    'receipt': 'TICKET / RECIBO INTERNO',
    'normal print': 'Imprimir / PDF',
    'thermal print': 'Térmica 80 mm',
    'vat': 'function resumenIvaTicket(v2)',
    'local': 'local: locales.find((l2) => l2.id === localActivoId) || null',
    'print class': 'zona-impresion ticket-tpv-impresion'
}.items():
    if needle not in s:
        raise RuntimeError(f'falta guarda {label}')

p.write_text(s, encoding='utf-8')
print('TICKET_TPV_FASE4_V2_APLICADO=1')
