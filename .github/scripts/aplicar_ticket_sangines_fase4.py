from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

old_return = 'return { ventaId, referencia, fecha, marcaTiempo, lineas, resumen: nombres.slice(0, 3).join(", ") + (nombres.length > 3 ? ` y ${nombres.length - 3} más` : ""), importe, medioPago, detallePago, usuario, anulada };'
new_return = 'return { ventaId, referencia, fecha, marcaTiempo, lineas, resumen: nombres.slice(0, 3).join(", ") + (nombres.length > 3 ? ` y ${nombres.length - 3} más` : ""), importe, medioPago, detallePago, usuario, anulada, mesa: lineas[0]?.mesa || lineas[0]?.mesaNumero || "", zona: lineas[0]?.zona || lineas[0]?.sala || lineas[0]?.ubicacion || "", numeroFiscal: lineas[0]?.numeroFiscal || lineas[0]?.numeroFactura || "", entregado: lineas[0]?.importeEntregado ?? lineas[0]?.entregado ?? null, cambio: lineas[0]?.cambioEntregado ?? lineas[0]?.cambio ?? null };'
if s.count(old_return) != 1:
    raise SystemExit(f'guard normalized return: {s.count(old_return)}')
s = s.replace(old_return, new_return, 1)

inicio = s.index('  function renderTicketVenta() {')
fin = s.index('  function renderHistorialVentas() {', inicio)

nuevo = r'''  function renderTicketVenta() {
    if (!ticketVenta) return null;
    const h = import_react4.default.createElement;
    const v2 = ticketVenta;
    const desglose = desgloseIvaTicketVista(v2);
    const subtotal = desglose.reduce((a2, r2) => a2 + r2.base, 0);
    const nombreLocal = local?.nombre || "Local sin nombre";
    const numeroDocumento = v2.numeroFiscal || v2.referencia;
    const tieneNumeroFiscal = !!v2.numeroFiscal;
    const entregado = v2.entregado == null ? null : Number(v2.entregado);
    const cambioTicket = v2.cambio == null ? null : Number(v2.cambio);
    return h(Modal, { onClose: () => setTicketVenta(null), title: `Ticket ${v2.referencia}` },
      h("div", { className: "rounded-xl p-4 mono", style: { background: C2.surface, border: `1px solid ${C2.line}` } },
        h("div", { className: "text-center mb-3" },
          h("div", { className: "text-[10px] font-bold tracking-[0.18em]" }, "CHOCOLATERÍA"),
          h("div", { className: "text-[27px] font-black leading-none mt-1" }, "San Ginés"),
          h("div", { className: "text-[10px] font-bold tracking-[0.22em] mt-1" }, "MADRID 1894")
        ),
        h("div", { className: "text-center text-[10.5px] leading-5 mb-3" },
          h("div", { className: "font-bold" }, "CHOCOLOYOS, S.L."),
          h("div", null, "N.I.F.: B87342077"),
          h("div", null, "LÓPEZ DE HOYOS, 81"),
          h("div", null, "28002 MADRID (ESPAÑA)"),
          h("div", null, "Tfno.: 91 603 43 19"),
          h("div", { className: "mt-1 font-semibold" }, `LOCAL: ${nombreLocal}`)
        ),
        h("div", { className: "text-center text-[12px] font-bold my-3" }, tieneNumeroFiscal ? "FACTURA SIMPLIFICADA" : "TICKET / RECIBO INTERNO"),
        v2.anulada ? h("div", { className: "text-center text-[11px] font-bold rounded-lg py-2 mb-3", style: { background: C2.redSoft || "#FCE8E6", color: C2.red } }, "VENTA ANULADA") : null,
        h("div", { className: "text-[10.5px] mb-3 pb-3", style: { borderBottom: `1px dashed ${C2.line}` } },
          h("div", { className: "flex justify-between gap-3" }, h("span", null, fechaHoraTicketVista(v2)), h("span", { className: "font-semibold text-right" }, `${tieneNumeroFiscal ? "N.º" : "Ref."} ${numeroDocumento}`)),
          h("div", { className: "mt-1" }, `CAMARERO: ${v2.usuario || "—"}`),
          h("div", { className: "flex justify-between gap-3 mt-1" }, h("span", null, `MESA: ${v2.mesa || "—"}`), h("span", { className: "text-right" }, `ZONA: ${v2.zona || "—"}`))
        ),
        h("div", { className: "grid grid-cols-[1fr_44px_58px_62px] gap-1 text-[9.5px] font-bold pb-1", style: { borderBottom: `1px dashed ${C2.line}` } },
          h("span", null, "CONCEPTO"), h("span", { className: "text-right" }, "CANT."), h("span", { className: "text-right" }, "PRECIO"), h("span", { className: "text-right" }, "TOTAL")
        ),
        h("div", { className: "mb-3" }, (v2.lineas || []).map((l2, i3) => {
          const prod = productos.find((x3) => x3.id === l2.productoId);
          const cantidad = Math.abs(cantidadConSigno(l2));
          const iva = Number(l2.ivaVentaAplicado) || 0;
          const precio = Math.abs(Number(l2.ingresoUnitario) || 0) * (1 + iva / 100);
          return h("div", { key: l2.id || i3, className: "grid grid-cols-[1fr_44px_58px_62px] gap-1 text-[10.5px] py-1.5", style: { borderBottom: `1px dotted ${C2.line}` } },
            h("span", { className: "font-medium break-words" }, prod?.nombre || "Producto"),
            h("span", { className: "text-right" }, fmt(cantidad)),
            h("span", { className: "text-right" }, fmt(precio)),
            h("span", { className: "text-right font-semibold" }, fmt(cantidad * precio))
          );
        })),
        h("div", { className: "text-[10.5px] py-2", style: { borderTop: `1px dashed ${C2.line}`, borderBottom: `1px dashed ${C2.line}` } },
          h("div", { className: "flex justify-between gap-3" }, h("span", null, "SUBTOTAL:"), h("span", null, `€${fmt(subtotal)}`)),
          desglose.map((r2) => h("div", { key: r2.pct, className: "flex justify-between gap-3" }, h("span", null, `${fmt(r2.pct)}% I.V.A.:`), h("span", null, `€${fmt(r2.iva)}`)))
        ),
        h("div", { className: "flex justify-between items-end py-3", style: { borderBottom: `1px dashed ${C2.line}` } },
          h("span", { className: "font-black text-[17px]" }, "TOTAL:"),
          h("span", { className: "font-black text-[24px]" }, `€${fmt(v2.importe)}`)
        ),
        h("div", { className: "text-center text-[11px] font-semibold mt-3" }, `Cobrado en ${(v2.medioPago || "—").toUpperCase()}`),
        h("div", { className: "text-[10.5px] mt-3 mb-3" },
          h("div", { className: "flex justify-between gap-3" }, h("span", null, "ENTREGADO:"), h("span", null, entregado == null || !Number.isFinite(entregado) ? "—" : `€${fmt(entregado)}`)),
          h("div", { className: "flex justify-between gap-3" }, h("span", null, "CAMBIO:"), h("span", null, cambioTicket == null || !Number.isFinite(cambioTicket) ? "—" : `€${fmt(cambioTicket)}`)),
          v2.medioPago === "Mixto" && v2.detallePago ? h("div", { className: "mt-2 text-center" }, `TARJETA €${fmt(v2.detallePago.tarjeta || 0)} · EFECTIVO €${fmt(v2.detallePago.efectivo || 0)}`) : null
        ),
        h("div", { className: "text-center text-[10px] pt-3", style: { borderTop: `1px dashed ${C2.line}` } },
          h("div", null, "Si quieres obtener ofertas especiales"),
          h("div", null, "y comunicarte con nosotros"),
          h("div", null, "síguenos en @ChocoSanGines"),
          h("div", { className: "font-bold text-[12px] mt-3" }, v2.anulada ? "VENTA ANULADA" : "GRACIAS POR SU VISITA"),
          h("div", { className: "font-semibold mt-1" }, "I.V.A. INCLUIDO"),
          h("div", { className: "text-[8.5px] mt-3 break-all", style: { color: C2.inkSoft } }, `ID operación: ${v2.ventaId}`),
          !tieneNumeroFiscal ? h("div", { className: "text-[8.5px] mt-1", style: { color: C2.inkSoft } }, "Documento interno del TPV · pendiente de numeración fiscal") : null
        )
      ),
      h("div", { className: "mt-3" }, h(Btn, { variant: "ghost", onClick: () => setTicketVenta(null) }, "Cerrar ticket"))
    );
  }
'''

s = s[:inicio] + nuevo + s[fin:]

if 'CHOCOLOYOS, S.L.' not in s or 'B87342077' not in s or 'LÓPEZ DE HOYOS, 81' not in s:
    raise SystemExit('guard fiscal header failed')
if s.count('function renderTicketVenta()') != 1:
    raise SystemExit('guard renderTicketVenta count')

p.write_text(s, encoding='utf-8')
print('TICKET_SANGINES_FASE4_APLICADO=1')
