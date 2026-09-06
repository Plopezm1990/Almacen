from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

if 'const reversosVentaPeriodo = movimientos.filter' in s:
    raise SystemExit('LA007: la corrección ya parece aplicada; se aborta para no duplicarla')

# El bundle contiene fórmulas parecidas en más de un informe. PM09 modifica
# exclusivamente el texto comprendido entre function Resultados(...) y la
# siguiente función de nivel superior. Esto evita confundir fórmulas gemelas.
needle = 'function Resultados('
if s.count(needle) != 1:
    raise SystemExit(f'LA007 Resultados: esperaba 1 función y hay {s.count(needle)}')
start = s.index(needle)
end = s.find('\nfunction ', start + len(needle))
if end < 0:
    raise SystemExit('LA007 Resultados: no se encontró la siguiente función')
bloque = s[start:end]

old_ventas = 'const ventas = salidasPeriodo.filter((m22) => esVenta(m22));'
if bloque.count(old_ventas) != 1:
    raise SystemExit(f'LA007 ventas Resultados: esperaba 1 y hay {bloque.count(old_ventas)}')
new_ventas = '''const ventas = salidasPeriodo.filter((m22) => esVenta(m22));\n  // PM-09 / LA-007: una anulación es una corrección económica trazable.\n  // No se elimina la venta original ni se reescribe su periodo: el REVERSO\n  // resta ingreso y coste en la fecha en la que ocurrió la corrección.\n  const reversosVentaPeriodo = movimientos.filter((m22) => m22 && m22.anulaVentaId && (m22.tipo === "REVERSO" || m22.tipo === "entrada") && m22.fecha >= desde && m22.fecha <= hasta);'''
bloque = bloque.replace(old_ventas, new_ventas, 1)

old_ing = 'const ingresos = ventas.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * (Number(m22.ingresoUnitario) || 0), 0);'
new_ing = 'const ingresos = ventas.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * Math.abs(Number(m22.ingresoUnitario) || 0), 0) - reversosVentaPeriodo.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * Math.abs(Number(m22.ingresoUnitario) || 0), 0);'
if bloque.count(old_ing) != 1:
    raise SystemExit(f'LA007 ingresos Resultados: esperaba 1 y hay {bloque.count(old_ing)}')
bloque = bloque.replace(old_ing, new_ing, 1)

old_cost = 'const costeVentas = ventas.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * (Number(m22.costoUnitario) || 0), 0);'
new_cost = 'const costeVentas = ventas.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * Math.abs(Number(m22.costoUnitario) || 0), 0) - reversosVentaPeriodo.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * Math.abs(Number(m22.costoUnitario) || 0), 0);'
if bloque.count(old_cost) != 1:
    raise SystemExit(f'LA007 coste Resultados: esperaba 1 y hay {bloque.count(old_cost)}')
bloque = bloque.replace(old_cost, new_cost, 1)

s = s[:start] + bloque + s[end:]
if s.count('const reversosVentaPeriodo = movimientos.filter') != 1:
    raise SystemExit('LA007: marcador de reversos no quedó exactamente una vez')

p.write_text(s, encoding='utf-8')
print('PM09_LA007_PATCH_OK=1')
