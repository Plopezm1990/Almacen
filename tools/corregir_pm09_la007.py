from pathlib import Path
import re

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

if 'const reversosVentaPeriodo = movimientos.filter' in s:
    raise SystemExit('LA007: la corrección ya parece aplicada; se aborta para no duplicarla')

# 1) Añadir las correcciones de venta como flujo separado del periodo.
pat_ventas = re.compile(
    r'(const ventas = salidasPeriodo\.filter\(\(m22\) => esVenta\(m22\)\);)'
)
ms = list(pat_ventas.finditer(s))
if len(ms) != 1:
    raise SystemExit(f'LA007 ventas: esperaba 1 coincidencia y hay {len(ms)}')
insert = '''\\1\n  // PM-09 / LA-007: una anulación es una corrección económica trazable.\n  // No se elimina la venta original ni se reescribe su periodo: el REVERSO\n  // resta ingreso y coste en la fecha en la que ocurrió la corrección.\n  const reversosVentaPeriodo = movimientos.filter((m22) => m22 && m22.anulaVentaId && (m22.tipo === "REVERSO" || m22.tipo === "entrada") && m22.fecha >= desde && m22.fecha <= hasta);'''
s = pat_ventas.sub(insert, s, count=1)

# 2) Sustituir ingreso y coste por venta bruta menos reversos del periodo.
old_ing = 'const ingresos = ventas.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * (Number(m22.ingresoUnitario) || 0), 0);'
new_ing = 'const ingresos = ventas.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * Math.abs(Number(m22.ingresoUnitario) || 0), 0) - reversosVentaPeriodo.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * Math.abs(Number(m22.ingresoUnitario) || 0), 0);'
if s.count(old_ing) != 1:
    raise SystemExit(f'LA007 ingresos: esperaba 1 coincidencia y hay {s.count(old_ing)}')
s = s.replace(old_ing, new_ing, 1)

old_cost = 'const costeVentas = ventas.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * (Number(m22.costoUnitario) || 0), 0);'
new_cost = 'const costeVentas = ventas.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * Math.abs(Number(m22.costoUnitario) || 0), 0) - reversosVentaPeriodo.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * Math.abs(Number(m22.costoUnitario) || 0), 0);'
if s.count(old_cost) != 1:
    raise SystemExit(f'LA007 coste: esperaba 1 coincidencia y hay {s.count(old_cost)}')
s = s.replace(old_cost, new_cost, 1)

# Guardas de alcance: no tocar la semántica de unidades/rotación/devoluciones en este punto.
if s.count('const reversosVentaPeriodo = movimientos.filter') != 1:
    raise SystemExit('LA007: marcador de reversos no quedó exactamente una vez')

p.write_text(s, encoding='utf-8')
print('PM09_LA007_PATCH_OK=1')
