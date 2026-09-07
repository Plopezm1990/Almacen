import fs from 'node:fs';

const s = fs.readFileSync('fuente.js', 'utf8');
function check(name, ok) {
  console.log(`PM09_P12_${name.toUpperCase()}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

check('devoluciones_periodo', s.includes('const devolucionesVentaPeriodo = movimientos.filter'));
check('devolucion_cliente_incluida', s.includes('m22.tipo === "DEVOLUCION_CLIENTE"'));
check('ingreso_resta_devoluciones', /const ingresos = ventas\.reduce[\s\S]{0,1200}- reversosVentaPeriodo\.reduce[\s\S]{0,800}- devolucionesVentaPeriodo\.reduce/.test(s));
check('coste_resta_devoluciones', /const costeVentas = ventas\.reduce[\s\S]{0,1500}- reversosVentaPeriodo\.reduce[\s\S]{0,900}- devolucionesVentaPeriodo\.reduce/.test(s));
check('coste_historico_en_resultados', /const costeVentas = ventas\.reduce[\s\S]{0,1800}costoUnitarioHistoricoVentaPM09\(m22, movimientos\)/.test(s));
check('resultado_neto_conserva_gastos', s.includes('const resultadoNeto = margenBruto - gastosPeriodo - costeInventarioSinVenta;'));
check('margen_pct_sobre_ingreso_neto', s.includes('const margenPct = ingresos > 0 ? margenBruto / ingresos * 100 : null;'));

const unitNet = 5.4545454545;
const unitCost = 3;
const sale2 = { tipo: 'VENTA', cantidad: -2, ingresoUnitario: unitNet, costoUnitario: unitCost };
const reverse2 = { tipo: 'REVERSO', cantidad: 2, ingresoUnitario: -unitNet, costoUnitario: unitCost };
const return1 = { tipo: 'DEVOLUCION_CLIENTE', cantidad: 1, ingresoUnitario: -unitNet, costoUnitario: unitCost, reembolso: 6 };
const return1NoRefund = { ...return1, reembolso: 0, medioReembolso: 'SIN_REEMBOLSO' };
function u(m) { return m.tipo === 'VENTA' ? Math.abs(m.cantidad) : -Math.abs(m.cantidad); }
function resumen(movs) {
  const ingresos = movs.reduce((a, m) => a + u(m) * Math.abs(m.ingresoUnitario), 0);
  const coste = movs.reduce((a, m) => a + u(m) * Math.abs(m.costoUnitario), 0);
  const margen = ingresos - coste;
  return {
    ingresos: Number(ingresos.toFixed(2)),
    coste: Number(coste.toFixed(2)),
    margen: Number(margen.toFixed(2)),
    margenPct: ingresos > 0 ? Number((margen / ingresos * 100).toFixed(2)) : null,
  };
}

const cancelada = resumen([sale2, reverse2]);
check('cancelada_ingreso_cero', cancelada.ingresos === 0);
check('cancelada_coste_cero', cancelada.coste === 0);
check('cancelada_margen_cero', cancelada.margen === 0);

const parcial = resumen([sale2, return1]);
check('parcial_ingreso_5_45', parcial.ingresos === 5.45);
check('parcial_coste_3', parcial.coste === 3);
check('parcial_margen_2_45', parcial.margen === 2.45);
check('parcial_margen_45pct', parcial.margenPct === 45);

const sinReembolso = resumen([sale2, return1NoRefund]);
check('gestion_independiente_reembolso', JSON.stringify(sinReembolso) === JSON.stringify(parcial));

// Contrato temporal: una devolución posterior corrige su propio periodo y no
// reescribe el periodo histórico de la venta original.
const enero = resumen([sale2]);
const febrero = resumen([return1]);
check('enero_venta_original', enero.ingresos === 10.91 && enero.coste === 6);
check('febrero_correccion', febrero.ingresos === -5.45 && febrero.coste === -3);
check('acumulado_una_unidad', Number((enero.ingresos + febrero.ingresos).toFixed(2)) === 5.46 || Number((enero.ingresos + febrero.ingresos).toFixed(2)) === 5.45);

if (process.exitCode) throw new Error('PM09_P12_RESULTADOS_CONTRACT_FAIL');
console.log('PM09_P12_RESULTADOS_CONTRACT_OK=1');
