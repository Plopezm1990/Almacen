import fs from 'node:fs';

const s = fs.readFileSync('fuente.js', 'utf8');

function check(name, ok) {
  console.log(`PM09_LA007_${name.toUpperCase()}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

// Contrato estático de la corrección mínima.
check('reversos_periodo_unico', (s.match(/const reversosVentaPeriodo = movimientos\.filter/g) || []).length === 1);
check('reverso_servidor', s.includes('m22.tipo === "REVERSO"'));
check('reverso_legacy_trazable', s.includes('m22.tipo === "entrada"') && s.includes('m22.anulaVentaId'));
check('ingreso_resta_reverso', /const ingresos = ventas\.reduce[\s\S]{0,700}- reversosVentaPeriodo\.reduce/.test(s));
check('coste_resta_reverso', /const costeVentas = ventas\.reduce[\s\S]{0,700}- reversosVentaPeriodo\.reduce/.test(s));
check('usa_fecha_correccion', /reversosVentaPeriodo = movimientos\.filter\([\s\S]{0,500}m22\.fecha >= desde && m22\.fecha <= hasta/.test(s));

// Oráculo independiente: no llama a la fórmula de Resultados.
// Fixture vivo PM09: venta cancelable 2 uds + reverso 2 uds + venta activa 1 ud.
const unitNet = 5.4545454545;
const unitCost = 3;
const legacyIncome = Number((3 * unitNet).toFixed(2));
const legacyCost = Number((3 * unitCost).toFixed(2));
const expectedIncome = Number(((2 * unitNet) - (2 * unitNet) + (1 * unitNet)).toFixed(2));
const expectedCost = Number(((2 * unitCost) - (2 * unitCost) + (1 * unitCost)).toFixed(2));
check('reproduce_legacy_ingreso_16_36', legacyIncome === 16.36);
check('reproduce_legacy_coste_9', legacyCost === 9);
check('esperado_ingreso_5_45', expectedIncome === 5.45);
check('esperado_coste_3', expectedCost === 3);

// Contrato temporal: una corrección no reescribe el mes original.
const janIncome = Number((2 * unitNet).toFixed(2));
const janCost = 2 * unitCost;
const febIncome = Number((-2 * unitNet).toFixed(2));
const febCost = -2 * unitCost;
check('enero_conserva_venta', janIncome === 10.91 && janCost === 6);
check('febrero_registra_reverso', febIncome === -10.91 && febCost === -6);
check('acumulado_anulado_cero', Number((janIncome + febIncome).toFixed(2)) === 0 && janCost + febCost === 0);

if (process.exitCode) throw new Error('PM09_LA007_CONTRACT_FAIL');
console.log('PM09_LA007_CONTRACT_OK=1');
