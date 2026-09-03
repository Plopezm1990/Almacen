from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise RuntimeError(f'{label}: se esperaba 1 coincidencia y hay {n}')
    s = s.replace(old, new, 1)

# 1) El TPV recibe el local concreto. El contenedor ya pasa esta prop.
replace_once(
    'function VentaRapida({ productos, venderCarrito, anularVenta, movimientos = [], registrarAuditoria }) {',
    'function VentaRapida({ productos, venderCarrito, anularVenta, movimientos = [], registrarAuditoria, local = null }) {',
    'firma VentaRapida'
)

# 2) Estado pequeño y aislado para el ticket.
state_anchor = '  const [ventaDetalle, setVentaDetalle] = (0, import_react4.useState)(null);'
replace_once(
    state_anchor,
    state_anchor + '\n  const [ticketVenta, setTicketVenta] = (0, import_react4.useState)(null);',
    'estado ticketVenta'
)

# 3) Abrir ticket desde el detalle ya validado.
detail_anchor = '''      h("div", { className: "text-[10px] mb-3 break-all", style: { color: C2.inkSoft } }, `ID interno: ${v2.ventaId}`),
      !v2.anulada && anularVenta ? h(Btn, { variant: "danger", onClick: () => { setVentaDetalle(null); setConfirmAnular(v2); } }, "Anular venta") : null'''
detail_replacement = '''      h("div", { className: "text-[10px] mb-3 break-all", style: { color: C2.inkSoft } }, `ID interno: ${v2.ventaId}`),
      h("div", { className: "flex gap-2 flex-wrap mb-3" }, h(Btn, { onClick: () => setTicketVenta(v2) }, "Ver ticket / reimprimir")),
      !v2.anulada && anularVenta ? h(Btn, { variant: "danger", onClick: () => { setVentaDetalle(null); setConfirmAnular(v2); } }, "Anular venta") : null'''
replace_once(detail_anchor, detail_replacement, 'boton ticket en detalle')

# 4) Render del ticket deliberadamente aislado y pequeño.
confirm_anchor = '  async function confirmarAnulacion() {'
if s.count(confirm_anchor) != 1:
    raise RuntimeError(f'confirmarAnulacion: {s.count(confirm_anchor)}')

ticket_helper = r'''  function renderTicketVenta() {
    if (!ticketVenta) return null;
    const h = import_react4.default.createElement;
    const filasIva = new Map();
    (ticketVenta.lineas || []).forEach((l2) => {
      const cantidad = Math.abs(cantidadConSigno(l2));
      const neto = Math.abs(Number(l2.ingresoUnitario) || 0);
      const pct = Number(l2.ivaVentaAplicado) || 0;
      const base = cantidad * neto;
      const actual = filasIva.get(pct) || { pct, base: 0, iva: 0 };
      actual.base += base;
      actual.iva += base * pct / 100;
      filasIva.set(pct, actual);
    });
    const fechaTicket = ticketVenta.marcaTiempo && !isNaN(new Date(ticketVenta.marcaTiempo).getTime()) ? new Date(ticketVenta.marcaTiempo).toLocaleString("es-ES") : ticketVenta.fecha || "—";
    return h(Modal, { onClose: () => setTicketVenta(null), title: `Ticket ${ticketVenta.referencia}` },
      h("div", { className: "flex gap-2 flex-wrap mb-3 no-imprimir" },
        h(Btn, { onClick: () => window.print() }, "Imprimir / PDF"),
        h(Btn, { variant: "ghost", onClick: () => setTicketVenta(null) }, "Cerrar")
      ),
      h("div", { className: "zona-impresion", style: { maxWidth: "80mm", width: "100%", margin: "0 auto", padding: 14, background: "#fff", color: "#1c2822", fontSize: 11, lineHeight: 1.4 } },
        h("div", { className: "text-center mb-3" },
          h("div", { className: "font-bold text-[15px]" }, local && local.nombre ? local.nombre : "TPV"),
          h("div", { className: "text-[10px] font-semibold mt-1" }, "TICKET / RECIBO INTERNO")
        ),
        ticketVenta.anulada ? h("div", { className: "text-center font-bold py-1.5 mb-3", style: { borderTop: "1px dashed #999", borderBottom: "1px dashed #999" } }, "VENTA ANULADA") : null,
        h("div", { className: "pb-2 mb-2", style: { borderBottom: "1px dashed #999" } },
          h("div", { className: "flex justify-between gap-3" }, h("span", null, "Referencia"), h("span", { className: "mono text-right" }, ticketVenta.referencia)),
          h("div", { className: "flex justify-between gap-3 mt-1" }, h("span", null, "Fecha"), h("span", { className: "text-right" }, fechaTicket))
        ),
        h("div", { className: "mb-2" }, (ticketVenta.lineas || []).map((l2, i3) => {
          const p2 = productos.find((x3) => x3.id === l2.productoId);
          const cantidad = Math.abs(cantidadConSigno(l2));
          const pct = Number(l2.ivaVentaAplicado) || 0;
          const precio = Math.abs(Number(l2.ingresoUnitario) || 0) * (1 + pct / 100);
          return h("div", { key: l2.id || i3, className: "py-1.5", style: { borderBottom: "1px dotted #ccc" } },
            h("div", { className: "font-medium" }, p2 ? p2.nombre : "Producto"),
            h("div", { className: "flex justify-between gap-3" }, h("span", { className: "mono" }, `${fmt(cantidad)} × €${fmt(precio)}`), h("span", { className: "mono font-semibold" }, `€${fmt(cantidad * precio)}`))
          );
        })),
        h("div", { className: "py-2 mb-2", style: { borderTop: "1px dashed #999", borderBottom: "1px dashed #999" } }, [...filasIva.values()].sort((a2, b2) => a2.pct - b2.pct).map((r) => h(import_react4.default.Fragment, { key: r.pct },
          h("div", { className: "flex justify-between gap-3" }, h("span", null, `Base ${fmt(r.pct)}%`), h("span", { className: "mono" }, `€${fmt(r.base)}`)),
          h("div", { className: "flex justify-between gap-3" }, h("span", null, `IVA ${fmt(r.pct)}%`), h("span", { className: "mono" }, `€${fmt(r.iva)}`))
        ))),
        h("div", { className: "flex justify-between gap-3 font-bold text-[15px] mb-2" }, h("span", null, "TOTAL"), h("span", { className: "mono" }, `€${fmt(ticketVenta.importe)}`)),
        h("div", { className: "flex justify-between gap-3 pt-2", style: { borderTop: "1px dashed #999" } }, h("span", null, "Pago"), h("span", { className: "font-semibold" }, ticketVenta.medioPago || "—")),
        ticketVenta.medioPago === "Mixto" && ticketVenta.detallePago ? h("div", { className: "text-[10px] text-right mt-1" }, `Tarjeta €${fmt(ticketVenta.detallePago.tarjeta || 0)} + Efectivo €${fmt(ticketVenta.detallePago.efectivo || 0)}`) : null,
        h("div", { className: "text-center mt-3 pt-2", style: { borderTop: "1px dashed #999" } },
          h("div", { className: "font-medium" }, "Gracias por su compra"),
          h("div", { className: "text-[9px] mono mt-2 break-all" }, `ID operación: ${ticketVenta.ventaId}`),
          h("div", { className: "text-[9px] mt-1" }, "Recibo interno del TPV")
        )
      )
    );
  }
'''
s = s.replace(confirm_anchor, ticket_helper + confirm_anchor, 1)

# 5) Renderizar el ticket como hermano del historial, sin incrustarlo en el gran return compilado.
replace_once(
    'renderHistorialVentas(), confirmAnular &&',
    'renderHistorialVentas(), renderTicketVenta(), confirmAnular &&',
    'render ticket en return'
)

checks = [
    'const [ticketVenta, setTicketVenta]',
    'function renderTicketVenta()',
    'Ver ticket / reimprimir',
    'TICKET / RECIBO INTERNO',
    'Imprimir / PDF',
    'Recibo interno del TPV'
]
for needle in checks:
    if needle not in s:
        raise RuntimeError(f'falta guarda: {needle}')

p.write_text(s, encoding='utf-8')
print('TICKET_TPV_FASE4_V2_APLICADO=1')
