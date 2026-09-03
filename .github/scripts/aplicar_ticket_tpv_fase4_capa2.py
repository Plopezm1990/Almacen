from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise RuntimeError(f'{label}: se esperaba 1 coincidencia y hay {n}')
    s = s.replace(old, new, 1)

# 1) Añadir helpers y render aislado justo antes del historial.
anchor = '  function renderHistorialVentas() {'
if s.count(anchor) != 1:
    raise RuntimeError(f'renderHistorialVentas: {s.count(anchor)}')

bloque = r'''  function fechaHoraTicketVista(v2) {
    const raw = v2 && v2.marcaTiempo;
    if (raw) {
      const d2 = new Date(raw);
      if (!isNaN(d2.getTime())) return d2.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }
    return v2 && v2.fecha ? v2.fecha : "—";
  }
  function desgloseIvaTicketVista(v2) {
    const mapa = new Map();
    (v2 && v2.lineas || []).forEach((l2) => {
      const cantidad = Math.abs(cantidadConSigno(l2));
      const base = cantidad * Math.abs(Number(l2.ingresoUnitario) || 0);
      const pct = Number(l2.ivaVentaAplicado) || 0;
      const actual = mapa.get(pct) || { pct, base: 0, iva: 0 };
      actual.base += base;
      actual.iva += base * pct / 100;
      mapa.set(pct, actual);
    });
    return [...mapa.values()].sort((a2, b2) => a2.pct - b2.pct);
  }
  function renderTicketVenta() {
    if (!ticketVenta) return null;
    const h = import_react4.default.createElement;
    const v2 = ticketVenta;
    return h(Modal, { onClose: () => setTicketVenta(null), title: `Ticket ${v2.referencia}` },
      h("div", { className: "rounded-xl p-4", style: { background: C2.surface, border: `1px solid ${C2.line}` } },
        h("div", { className: "text-center mb-3" },
          h("div", { className: "text-[15px] font-bold" }, local?.nombre || "TPV"),
          h("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, "TICKET / RECIBO INTERNO")
        ),
        v2.anulada ? h("div", { className: "text-center text-[11px] font-bold rounded-lg py-2 mb-3", style: { background: C2.redSoft || "#FCE8E6", color: C2.red } }, "VENTA ANULADA") : null,
        h("div", { className: "text-[11px] mb-3 pb-3", style: { borderBottom: `1px dashed ${C2.line}` } },
          h("div", { className: "flex justify-between gap-3" }, h("span", { style: { color: C2.inkSoft } }, "Referencia"), h("span", { className: "mono font-semibold text-right" }, v2.referencia)),
          h("div", { className: "flex justify-between gap-3 mt-1" }, h("span", { style: { color: C2.inkSoft } }, "Fecha"), h("span", { className: "text-right" }, fechaHoraTicketVista(v2))),
          v2.usuario ? h("div", { className: "flex justify-between gap-3 mt-1" }, h("span", { style: { color: C2.inkSoft } }, "Atendido por"), h("span", { className: "text-right" }, v2.usuario)) : null
        ),
        h("div", { className: "space-y-2 mb-3" }, (v2.lineas || []).map((l2, i3) => {
          const prod = productos.find((x3) => x3.id === l2.productoId);
          const cantidad = Math.abs(cantidadConSigno(l2));
          const iva = Number(l2.ivaVentaAplicado) || 0;
          const precio = Math.abs(Number(l2.ingresoUnitario) || 0) * (1 + iva / 100);
          return h("div", { key: l2.id || i3, className: "pb-2", style: { borderBottom: `1px dotted ${C2.line}` } },
            h("div", { className: "text-[12px] font-medium" }, prod?.nombre || "Producto"),
            h("div", { className: "flex justify-between gap-3 text-[11px] mt-1" },
              h("span", { className: "mono", style: { color: C2.inkSoft } }, `${fmt(cantidad)} × €${fmt(precio)} · IVA ${fmt(iva)}%`),
              h("span", { className: "mono font-semibold" }, `€${fmt(cantidad * precio)}`)
            )
          );
        })),
        h("div", { className: "py-2 mb-2", style: { borderTop: `1px dashed ${C2.line}`, borderBottom: `1px dashed ${C2.line}` } },
          desgloseIvaTicketVista(v2).map((r2) => h("div", { key: r2.pct, className: "text-[10.5px]" },
            h("div", { className: "flex justify-between gap-3" }, h("span", { style: { color: C2.inkSoft } }, `Base ${fmt(r2.pct)}%`), h("span", { className: "mono" }, `€${fmt(r2.base)}`)),
            h("div", { className: "flex justify-between gap-3" }, h("span", { style: { color: C2.inkSoft } }, `IVA ${fmt(r2.pct)}%`), h("span", { className: "mono" }, `€${fmt(r2.iva)}`))
          ))
        ),
        h("div", { className: "flex justify-between items-end mb-3" }, h("span", { className: "font-bold" }, "TOTAL"), h("span", { className: "mono font-bold text-[19px]" }, `€${fmt(v2.importe)}`)),
        h("div", { className: "flex justify-between gap-3 text-[11.5px] mb-3" }, h("span", { style: { color: C2.inkSoft } }, "Pago"), h("span", { className: "font-semibold" }, v2.medioPago || "—")),
        v2.medioPago === "Mixto" && v2.detallePago ? h("div", { className: "text-[10.5px] mb-3", style: { color: C2.inkSoft } }, `Tarjeta €${fmt(v2.detallePago.tarjeta || 0)} + Efectivo €${fmt(v2.detallePago.efectivo || 0)}`) : null,
        h("div", { className: "text-center pt-2", style: { borderTop: `1px dashed ${C2.line}` } },
          h("div", { className: "text-[11px] font-medium" }, "Gracias por su compra"),
          h("div", { className: "text-[9.5px] mono mt-2 break-all", style: { color: C2.inkSoft } }, `ID operación: ${v2.ventaId}`),
          h("div", { className: "text-[9.5px] mt-1", style: { color: C2.inkSoft } }, "Recibo interno del TPV")
        )
      ),
      h("div", { className: "mt-3" }, h(Btn, { variant: "ghost", onClick: () => setTicketVenta(null) }, "Cerrar ticket"))
    );
  }
'''
s = s.replace(anchor, bloque + anchor, 1)

# 2) Botón en el detalle. Al abrir ticket cierra el detalle para no superponer modales.
old = '      h("div", { className: "text-[10px] mb-3 break-all", style: { color: C2.inkSoft } }, `ID interno: ${v2.ventaId}`),\n      !v2.anulada && anularVenta ? h(Btn, { variant: "danger", onClick: () => { setVentaDetalle(null); setConfirmAnular(v2); } }, "Anular venta") : null'
new = '      h("div", { className: "text-[10px] mb-3 break-all", style: { color: C2.inkSoft } }, `ID interno: ${v2.ventaId}`),\n      h("div", { className: "flex gap-2 flex-wrap mb-3" }, h(Btn, { onClick: () => { setVentaDetalle(null); setTicketVenta(v2); } }, "Ver ticket / reimprimir")),\n      !v2.anulada && anularVenta ? h(Btn, { variant: "danger", onClick: () => { setVentaDetalle(null); setConfirmAnular(v2); } }, "Anular venta") : null'
replace_once(old, new, 'botón ticket detalle')

# 3) Hacer que el render del historial incluya la vista de ticket de forma aislada.
old_return = '    if (!ventaDetalle) return controles;'
new_return = '    if (!ventaDetalle) return h(import_react4.default.Fragment, null, controles, renderTicketVenta());'
replace_once(old_return, new_return, 'retorno sin detalle')

old_fragment = '    return h(import_react4.default.Fragment, null, controles, detalle);'
new_fragment = '    return h(import_react4.default.Fragment, null, controles, detalle, renderTicketVenta());'
replace_once(old_fragment, new_fragment, 'retorno con detalle')

# Guardas.
checks = [
    'function renderTicketVenta()',
    'Ver ticket / reimprimir',
    'TICKET / RECIBO INTERNO',
    'VENTA ANULADA',
    'Recibo interno del TPV',
]
for needle in checks:
    if needle not in s:
        raise RuntimeError(f'falta guarda: {needle}')

p.write_text(s, encoding='utf-8')
print('TICKET_TPV_FASE4_CAPA2_APLICADO=1')
