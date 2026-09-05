from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

marker = 'function ArqueoCaja({ movimientos = [], arqueos = [], addArqueo, deleteArqueo, encargos = [], movimientosCaja = [], registrarMovimientoCaja, eliminarMovimientoCaja, leerBorradorArqueo, leerBorradorMovimientoCaja }) {'
if marker not in s:
    raise SystemExit('PM09_P10_MARKER_ARQUEO_NO_ENCONTRADO')

helpers = r'''// PM-09 / Punto 10: una única lectura de medios de pago para Caja.
// Las ventas brutas suman por su medio; los REVERSO trazables restan en la
// fecha de la corrección. DEVOLUCION_CLIENTE no entra aquí porque su reembolso
// ya está representado por caja_operaciones y contarlo otra vez duplicaría caja.
function esReversoVentaCajaPM09(m22) {
  if (!m22) return false;
  if (esMovimientoNuevo(m22)) return m22.tipo === "REVERSO" && !!(m22.anulaVentaId || m22.ventaId || m22.documentoOrigenId || m22.movimientoOriginalId);
  return m22.tipo === "entrada" && Number(m22.ingresoUnitario) < 0 && !!m22.anulaVentaId;
}
function resumenMediosVentaCajaPM09(movs = [], fecha = "") {
  const cero = () => ({ Efectivo: 0, Tarjeta: 0, Transferencia: 0, Otro: 0 });
  const ventas = cero();
  const reversos = cero();
  let ventasIncluidas = 0;
  let reversosIncluidos = 0;
  const sumar = (destino, m22, signo) => {
    const medio = String(m22.medioPago || "Efectivo").trim().toUpperCase();
    const bruto = Math.abs(Number(m22.cantidad) || 0) * Math.abs(Number(m22.ingresoUnitario) || 0) * (1 + (Number(m22.ivaVentaAplicado) || 0) / 100);
    if (medio === "MIXTO" && m22.detallePago) {
      destino.Efectivo += signo * (Number(m22.detallePago.efectivo) || 0);
      destino.Tarjeta += signo * (Number(m22.detallePago.tarjeta) || 0);
      return;
    }
    if (medio === "EFECTIVO") destino.Efectivo += signo * bruto;
    else if (medio === "TARJETA") destino.Tarjeta += signo * bruto;
    else if (medio === "TRANSFERENCIA") destino.Transferencia += signo * bruto;
    else destino.Otro += signo * bruto;
  };
  (movs || []).forEach((m22) => {
    if (!m22 || m22.fecha !== fecha || m22.encargoId) return;
    if (esVenta(m22)) {
      sumar(ventas, m22, 1);
      ventasIncluidas++;
    } else if (esReversoVentaCajaPM09(m22)) {
      // Se guarda ya con signo negativo para que el consumidor solo tenga que sumar.
      sumar(reversos, m22, -1);
      reversosIncluidos++;
    }
  });
  const neto = cero();
  Object.keys(neto).forEach((k) => neto[k] = redondearDineroPM08((ventas[k] || 0) + (reversos[k] || 0)));
  Object.keys(ventas).forEach((k) => ventas[k] = redondearDineroPM08(ventas[k] || 0));
  Object.keys(reversos).forEach((k) => reversos[k] = redondearDineroPM08(reversos[k] || 0));
  return { ventas, reversos, neto, ventasIncluidas, reversosIncluidos };
}
'''

if 'function esReversoVentaCajaPM09(' not in s:
    s = s.replace(marker, helpers + marker, 1)

old_logic = r'''  const ventasDelDia = movimientos.filter((m22) => esVenta(m22) && m22.fecha === fecha && !m22.encargoId);
  const porMedio = { Efectivo: 0, Tarjeta: 0, Transferencia: 0, Otro: 0 };
  ventasDelDia.forEach((m22) => {
    const medio = m22.medioPago || "Efectivo";
    const importeVenta = Math.abs(Number(m22.cantidad) || 0) * (Number(m22.ingresoUnitario) || 0) * (1 + (Number(m22.ivaVentaAplicado) || 0) / 100);
    if (medio === "Mixto" && m22.detallePago) {
      porMedio.Efectivo += Number(m22.detallePago.efectivo) || 0;
      porMedio.Tarjeta += Number(m22.detallePago.tarjeta) || 0;
    } else {
      porMedio[medio] = (porMedio[medio] || 0) + importeVenta;
    }
  });
  encargos.forEach((e2) => {
    (e2.cobros || []).forEach((c22) => {
      if (c22.fecha !== fecha) return;
      const medio = c22.medioPago || "Efectivo";
      porMedio[medio] = (porMedio[medio] || 0) + (Number(c22.importe) || 0);
    });
  });
  const movimientosCajaDelDia = movimientosCaja.filter((m22) => m22.fecha === fecha);
  const netoCaja = movimientosCajaDelDia.reduce((acc, m22) => {
    const efecto = Number(m22.efectoEfectivo);
    if (Number.isFinite(efecto)) return acc + efecto;
    return acc + (String(m22.tipo).toUpperCase() === "ENTRADA" ? Number(m22.importe) || 0 : -(Number(m22.importe) || 0));
  }, 0);
  const efectivoBase = redondearDineroPM08(porMedio.Efectivo || 0);
  const efectivoEsperado = redondearDineroPM08(efectivoBase + netoCaja);'''

new_logic = r'''  const resumenVentasCaja = resumenMediosVentaCajaPM09(movimientos, fecha);
  const porMedioOtros = { Efectivo: 0, Tarjeta: 0, Transferencia: 0, Otro: 0 };
  encargos.forEach((e2) => {
    (e2.cobros || []).forEach((c22) => {
      if (c22.fecha !== fecha) return;
      const medioRaw = String(c22.medioPago || "Efectivo").trim().toUpperCase();
      const claveMedio = medioRaw === "EFECTIVO" ? "Efectivo" : medioRaw === "TARJETA" ? "Tarjeta" : medioRaw === "TRANSFERENCIA" ? "Transferencia" : "Otro";
      porMedioOtros[claveMedio] = (porMedioOtros[claveMedio] || 0) + (Number(c22.importe) || 0);
    });
  });
  const porMedio = { Efectivo: 0, Tarjeta: 0, Transferencia: 0, Otro: 0 };
  Object.keys(porMedio).forEach((k) => porMedio[k] = redondearDineroPM08((resumenVentasCaja.neto[k] || 0) + (porMedioOtros[k] || 0)));
  const movimientosCajaDelDia = movimientosCaja.filter((m22) => m22.fecha === fecha);
  const netoCaja = movimientosCajaDelDia.reduce((acc, m22) => {
    const efecto = Number(m22.efectoEfectivo);
    if (Number.isFinite(efecto)) return acc + efecto;
    return acc + (String(m22.tipo).toUpperCase() === "ENTRADA" ? Number(m22.importe) || 0 : -(Number(m22.importe) || 0));
  }, 0);
  const efectivoOtros = redondearDineroPM08(porMedioOtros.Efectivo || 0);
  // Base no negativa: ventas brutas en efectivo + fuentes externas declaradas.
  // Los REVERSO se muestran/aplican aparte, igual que hará el servidor PM09.
  const efectivoBase = redondearDineroPM08((resumenVentasCaja.ventas.Efectivo || 0) + efectivoOtros);
  const ajustesVentaEfectivo = redondearDineroPM08(resumenVentasCaja.reversos.Efectivo || 0);
  const efectivoEsperado = redondearDineroPM08(efectivoBase + ajustesVentaEfectivo + netoCaja);'''

if old_logic not in s:
    raise SystemExit('PM09_P10_BLOQUE_CAJA_NO_ENCONTRADO')
s = s.replace(old_logic, new_logic, 1)

old_snapshot = r'''        snapshot: { porMedio, ventasIncluidas: ventasDelDia.length, encargosIncluidos: encargos.filter((e2) => (e2.cobros || []).some((c22) => c22.fecha === fecha)).length }'''
new_snapshot = r'''        ajustesVentaEfectivo,
        snapshot: {
          porMedio,
          ventasIncluidas: resumenVentasCaja.ventasIncluidas,
          reversosVentaIncluidos: resumenVentasCaja.reversosIncluidos,
          encargosIncluidos: encargos.filter((e2) => (e2.cobros || []).some((c22) => c22.fecha === fecha)).length,
          pm09Caja: {
            version: 1,
            efectivoVentasCliente: redondearDineroPM08(resumenVentasCaja.ventas.Efectivo || 0),
            efectivoReversosCliente: ajustesVentaEfectivo,
            efectivoOtros,
            porMedioVentasNeto: resumenVentasCaja.neto
          }
        }'''
if old_snapshot not in s:
    raise SystemExit('PM09_P10_SNAPSHOT_NO_ENCONTRADO')
s = s.replace(old_snapshot, new_snapshot, 1)

old_ui = r'''      h3("div", { className: "text-[10.5px] mb-3", style: { color: C2.inkSoft } }, `Base efectivo \u20AC${fmt(efectivoBase)} \xB7 ajustes/reembolsos \u20AC${fmt(netoCaja)}`),'''
new_ui = r'''      h3("div", { className: "text-[10.5px] mb-3", style: { color: C2.inkSoft } }, `Base efectivo €${fmt(efectivoBase)} · anulaciones venta €${fmt(ajustesVentaEfectivo)} · ajustes/reembolsos caja €${fmt(netoCaja)}`),'''
if old_ui not in s:
    raise SystemExit('PM09_P10_UI_NO_ENCONTRADA')
s = s.replace(old_ui, new_ui, 1)

old_base = r'''    const efectivoBase = redondearDineroPM08(data?.efectivoBase ?? data?.efectivoEsperado ?? 0);
    const efectivoContado = redondearDineroPM08(data?.efectivoContado ?? data?.efectivoReal);
    if (!Number.isFinite(efectivoBase) || efectivoBase < 0) return { ok: false, error: "El efectivo base no es v\xE1lido." };'''
new_base = r'''    const efectivoBase = redondearDineroPM08(data?.efectivoBase ?? data?.efectivoEsperado ?? 0);
    const ajustesVentaEfectivo = redondearDineroPM08(data?.ajustesVentaEfectivo ?? 0);
    const efectivoContado = redondearDineroPM08(data?.efectivoContado ?? data?.efectivoReal);
    if (!Number.isFinite(efectivoBase) || efectivoBase < 0) return { ok: false, error: "El efectivo base no es v\xE1lido." };
    if (!Number.isFinite(ajustesVentaEfectivo)) return { ok: false, error: "El ajuste de anulaciones de venta no es v\xE1lido." };'''
if old_base not in s:
    raise SystemExit('PM09_P10_ADD_ARQUEO_BASE_NO_ENCONTRADO')
s = s.replace(old_base, new_base, 1)

old_payload = r'''      efectivoBase,
      efectivoContado,
      notas: String(data?.notas || "").trim(),'''
new_payload = r'''      efectivoBase,
      ajustesVentaEfectivo,
      efectivoContado,
      notas: String(data?.notas || "").trim(),'''
# only replace first occurrence inside addArqueo
if old_payload not in s:
    raise SystemExit('PM09_P10_PAYLOAD_ARQUEO_NO_ENCONTRADO')
s = s.replace(old_payload, new_payload, 1)

old_local = r'''      const esperado = redondearDineroPM08(efectivoBase + efectos);'''
new_local = r'''      const esperado = redondearDineroPM08(efectivoBase + ajustesVentaEfectivo + efectos);'''
if old_local not in s:
    raise SystemExit('PM09_P10_ESPERADO_LOCAL_NO_ENCONTRADO')
s = s.replace(old_local, new_local, 1)

p.write_text(s, encoding='utf-8')
print('PM09_P10_CAJA_PATCH_OK=1')
