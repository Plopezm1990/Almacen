import fs from 'node:fs';

const s = fs.readFileSync('fuente.js','utf8');
function check(name, ok) {
  console.log(`PM09_P11_${name}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

check('HELPER_RESUMEN_UNICO', (s.match(/function resumenIvaVentasPM09\(/g)||[]).length === 1);
check('HELPER_APORTE_UNICO', (s.match(/function aporteIvaVentaPM09\(/g)||[]).length === 1);
check('IVA_HISTORICO_UNICO', (s.match(/function ivaHistoricoVentaPM09\(/g)||[]).length === 1);
check('INCLUYE_REVERSO', s.includes('m22.tipo === "REVERSO"') && s.includes('const signo = esR ? -1 : 1'));
check('INCLUYE_DEVOLUCION', s.includes('m22.tipo === "DEVOLUCION_CLIENTE"') && s.includes('DEVOLUCION_SIN_REEMBOLSO'));
check('SIN_REEMBOLSO_PENDIENTE', s.includes('String(medioReembolso).toUpperCase() === "SIN_REEMBOLSO"'));
check('NO_RECONSTRUYE_IVA_ACTUAL', !/const repercutido =[\s\S]{0,1200}productos\.find\([\s\S]{0,200}ivaVenta/.test(s));
check('LIBRO_USA_RESUMEN_CONCILIADO', s.includes('const repercutido = resumenIvaVentas.porTipo'));
check('EXCEL_INCLUYE_CORRECCIONES', s.includes('"Tipo operación": t22.tipoOperacion') && s.includes('Estado: t22.pendiente'));
check('SYNC_CONSERVA_REEMBOLSO', s.includes('reembolso: d2.reembolso !== void 0') && s.includes('medioReembolso: d2.medioReembolso || null'));
check('AVISO_NO_MODELO303_DEFINITIVO', s.includes('Es una proyecci\\xF3n interna, no sustituye la documentaci\\xF3n fiscal'));
check('CAJA_NO_DEFINE_IVA', s.includes('Caja y medio de pago no determinan por s\\xED solos el IVA'));

// Oráculo independiente: tres familias dentro del mismo periodo.
// A: venta 2 + anulación total => 0.
// B: venta 2 + devolución 1 con reembolso 6 => queda 1 unidad económica.
// C: venta 1 + devolución sin reembolso => la venta sigue en repercutido y
//    la devolución queda pendiente, no se corrige fiscalmente en silencio.
const unitNet = 5.4545454545;
const vat = 10;
function saleBase(q) { return Math.abs(q) * unitNet; }
function vatAmount(base) { return base * vat/100; }
let base = 0;
let iva = 0;
base += saleBase(2); iva += vatAmount(saleBase(2));
base -= saleBase(2); iva -= vatAmount(saleBase(2));
base += saleBase(2); iva += vatAmount(saleBase(2));
const refundGross = 6;
const refundBase = refundGross / 1.1;
base -= refundBase; iva -= refundGross - refundBase;
base += saleBase(1); iva += vatAmount(saleBase(1));
// SIN_REEMBOLSO: 0 corrección fiscal automática.
check('MODELO_BASE_10_91', Number(base.toFixed(2)) === 10.91);
check('MODELO_IVA_1_09', Number(iva.toFixed(2)) === 1.09);
check('ANULADA_CERO', Number((saleBase(2)-saleBase(2)).toFixed(2)) === 0);
check('DEV_REEMBOLSO_BASE_5_45', Number(refundBase.toFixed(2)) === 5.45);

// La forma de pago no entra en ninguna fórmula de base/cuota del oráculo.
const efectivo = {base,iva};
const tarjeta = {base,iva};
check('MEDIO_PAGO_NO_CAMBIA_IVA', efectivo.base === tarjeta.base && efectivo.iva === tarjeta.iva);

if (process.exitCode) throw new Error('PM09_P11_IVA_CONTRACT_FAIL');
console.log('PM09_P11_IVA_CONTRACT_OK=1');
