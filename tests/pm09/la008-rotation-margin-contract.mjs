import fs from 'node:fs';

const s = fs.readFileSync('fuente.js', 'utf8');

function check(name, ok) {
  console.log(`PM09_LA008_${name.toUpperCase()}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

check('helper_correccion_unico', (s.match(/function esCorreccionVentaPM09/g) || []).length === 1);
check('helper_unidades_unico', (s.match(/function unidadesVentaConSignoPM09/g) || []).length === 1);
check('helper_coste_historico_unico', (s.match(/function costoUnitarioHistoricoVentaPM09/g) || []).length === 1);
check('helper_consumo_unico', (s.match(/function resumenConsumoProductoPM09/g) || []).length === 1);
check('corrige_reverso', s.includes('m22.tipo === "REVERSO"'));
check('corrige_devolucion_cliente', s.includes('m22.tipo === "DEVOLUCION_CLIENTE"'));
check('margen_usa_operaciones_con_signo', s.includes('const operacionesVenta = movimientos.filter') && s.includes('unidadesVentaConSignoPM09(m22) * Math.abs(Number(m22.ingresoUnitario) || 0)'));
check('margen_usa_coste_historico', s.includes('costoUnitarioHistoricoVentaPM09(m22, movimientos)'));
check('margen_no_depende_precio_actual', !/const margenPorProducto =[\s\S]{0,2200}margenDe\(p22\)/.test(s));
check('rotacion_usa_familia_venta', s.includes('const resumen = resumenConsumoProductoPM09(movimientosProducto);'));
check('abc_global_y_local_con_signo', (s.match(/aporteConsumoInventarioPM09\(m22\)/g) || []).length >= 2);

// Oraculo independiente del bundle: dos ramas alternativas coexistiendo solo
// para la reproduccion LA-008: A cancelada 2/2 y B vendida 2 con devolucion 1.
const unitNet = 5.4545454545;
const unitCost = 3;
const movs = [
  { id: 'pm07-33', operationId: 'A', tipo: 'VENTA', cantidad: -2, productoId: 'P', ingresoUnitario: unitNet, costoUnitario: unitCost, fecha: '2026-09-01' },
  { id: 'pm07-34', operationId: 'A-R', tipo: 'REVERSO', cantidad: 2, productoId: 'P', ingresoUnitario: -unitNet, costoUnitario: unitCost, anulaVentaId: 'A', ventaId: 'A', movimientoOriginalId: 33, fecha: '2026-09-01' },
  { id: 'pm07-35', operationId: 'B', tipo: 'VENTA', cantidad: -2, productoId: 'P', ingresoUnitario: unitNet, costoUnitario: unitCost, fecha: '2026-09-02' },
  { id: 'pm07-36', operationId: 'B-D1', tipo: 'DEVOLUCION_CLIENTE', cantidad: 1, productoId: 'P', ingresoUnitario: -unitNet, costoUnitario: null, ventaId: 'B', movimientoOriginalId: 35, fecha: '2026-09-03' },
];

const legacySales = movs.filter(m => m.tipo === 'VENTA');
const legacyUnits = legacySales.reduce((a, m) => a + Math.abs(m.cantidad), 0);
const legacyIncome = legacySales.reduce((a, m) => a + Math.abs(m.cantidad) * m.ingresoUnitario, 0);
const legacyCost = legacySales.reduce((a, m) => a + Math.abs(m.cantidad) * m.costoUnitario, 0);
const legacyRotation = movs.filter(m => m.cantidad < 0).reduce((a, m) => a + Math.abs(m.cantidad), 0);
check('reproduce_legacy_units_4', legacyUnits === 4);
check('reproduce_legacy_income_21_82', Number(legacyIncome.toFixed(2)) === 21.82);
check('reproduce_legacy_cost_12', Number(legacyCost.toFixed(2)) === 12);
check('reproduce_legacy_rotation_4', legacyRotation === 4);

function signedUnits(m) {
  if (m.tipo === 'VENTA') return Math.abs(m.cantidad);
  if (m.tipo === 'REVERSO' || m.tipo === 'DEVOLUCION_CLIENTE') return -Math.abs(m.cantidad);
  return 0;
}
function histCost(m) {
  if (m.costoUnitario !== null && m.costoUnitario !== undefined && m.costoUnitario !== '') return Math.abs(Number(m.costoUnitario));
  const original = movs.find(x => x.id === `pm07-${m.movimientoOriginalId}`);
  return original ? Math.abs(Number(original.costoUnitario)) : 0;
}
const netUnits = movs.reduce((a, m) => a + signedUnits(m), 0);
const netIncome = movs.reduce((a, m) => a + signedUnits(m) * Math.abs(Number(m.ingresoUnitario) || 0), 0);
const netCost = movs.reduce((a, m) => a + signedUnits(m) * histCost(m), 0);
const benefit = netIncome - netCost;
const marginPct = netIncome > 0 ? benefit / netIncome * 100 : null;
check('net_units_1', netUnits === 1);
check('net_income_5_45', Number(netIncome.toFixed(2)) === 5.45);
check('net_cost_3', Number(netCost.toFixed(2)) === 3);
check('benefit_2_45', Number(benefit.toFixed(2)) === 2.45);
check('margin_45_pct', Number(marginPct.toFixed(2)) === 45);

// Rotacion por familia: la venta A queda en cero y desaparece del consumo;
// la B conserva una unidad neta tras la devolucion parcial.
const families = new Map();
for (const m of movs) {
  const root = m.tipo === 'VENTA' ? m.operationId : (m.anulaVentaId || m.ventaId);
  const f = families.get(root) || 0;
  families.set(root, f + signedUnits(m));
}
const rotationNet = [...families.values()].reduce((a, n) => a + Math.max(0, n), 0);
check('rotation_net_1', rotationNet === 1);
check('cancelled_family_zero', families.get('A') === 0);
check('partial_return_family_one', families.get('B') === 1);

if (process.exitCode) throw new Error('PM09_LA008_CONTRACT_FAIL');
console.log('PM09_LA008_CONTRACT_OK=1');
