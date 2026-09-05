from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

old = r'''  const ventas = salidasPeriodo.filter((m22) => esVenta(m22));
  // PM-09 / LA-007: una anulación es una corrección económica trazable.
  // No se elimina la venta original ni se reescribe su periodo: el REVERSO
  // resta ingreso y coste en la fecha en la que ocurrió la corrección.
  const reversosVentaPeriodo = movimientos.filter((m22) => m22 && m22.anulaVentaId && (m22.tipo === "REVERSO" || m22.tipo === "entrada") && m22.fecha >= desde && m22.fecha <= hasta);
  const autoconsumo = salidasPeriodo.filter((m22) => m22.motivo === "Autoconsumo");
  const roturas = salidasPeriodo.filter((m22) => m22.motivo === "Rotura");
  const mermas = salidasPeriodo.filter((m22) => esMerma(m22) && m22.motivo !== "Autoconsumo" && m22.motivo !== "Rotura");
  const aceite = salidasPeriodo.filter((m22) => m22.motivo === "Cambio de aceite" || m22.motivo === "Relleno de aceite");
  const ingresos = ventas.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * Math.abs(Number(m22.ingresoUnitario) || 0), 0) - reversosVentaPeriodo.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * Math.abs(Number(m22.ingresoUnitario) || 0), 0);
  const costeVentas = ventas.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * Math.abs(Number(m22.costoUnitario) || 0), 0) - reversosVentaPeriodo.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * Math.abs(Number(m22.costoUnitario) || 0), 0);'''

new = r'''  const ventas = salidasPeriodo.filter((m22) => esVenta(m22));
  // PM-09 / LA-007 + Punto 12: Resultados trabaja con hechos económicos
  // trazables. La venta original permanece; REVERSO y DEVOLUCION_CLIENTE
  // corrigen ingreso/coste en la fecha propia de la corrección.
  const reversosVentaPeriodo = movimientos.filter((m22) => m22 && m22.anulaVentaId && (m22.tipo === "REVERSO" || m22.tipo === "entrada") && m22.fecha >= desde && m22.fecha <= hasta);
  const devolucionesVentaPeriodo = movimientos.filter((m22) => m22 && esCorreccionVentaPM09(m22) && (m22.tipo === "DEVOLUCION_CLIENTE" || (m22.tipo === "entrada" && !m22.anulaVentaId && !!m22.ventaId)) && m22.fecha >= desde && m22.fecha <= hasta);
  const autoconsumo = salidasPeriodo.filter((m22) => m22.motivo === "Autoconsumo");
  const roturas = salidasPeriodo.filter((m22) => m22.motivo === "Rotura");
  const mermas = salidasPeriodo.filter((m22) => esMerma(m22) && m22.motivo !== "Autoconsumo" && m22.motivo !== "Rotura");
  const aceite = salidasPeriodo.filter((m22) => m22.motivo === "Cambio de aceite" || m22.motivo === "Relleno de aceite");
  const ingresos = ventas.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * Math.abs(Number(m22.ingresoUnitario) || 0), 0) - reversosVentaPeriodo.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * Math.abs(Number(m22.ingresoUnitario) || 0), 0) - devolucionesVentaPeriodo.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * Math.abs(Number(m22.ingresoUnitario) || 0), 0);
  const costeVentas = ventas.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * costoUnitarioHistoricoVentaPM09(m22, movimientos), 0) - reversosVentaPeriodo.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * costoUnitarioHistoricoVentaPM09(m22, movimientos), 0) - devolucionesVentaPeriodo.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * costoUnitarioHistoricoVentaPM09(m22, movimientos), 0);'''

if 'const devolucionesVentaPeriodo = movimientos.filter' in s:
    print('PM09_P12_YA_APLICADO=1')
else:
    if old not in s:
        raise SystemExit('PM09_P12_BLOQUE_RESULTADOS_NO_ENCONTRADO')
    s = s.replace(old, new, 1)
    p.write_text(s, encoding='utf-8')
    print('PM09_P12_RESULTADOS_APLICADO=1')
