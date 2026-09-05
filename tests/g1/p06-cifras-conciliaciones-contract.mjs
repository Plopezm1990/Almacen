import fs from 'node:fs';
import assert from 'node:assert/strict';

const evidencePath = 'tests/g1/P06_CIFRAS_CONCILIACIONES_EVIDENCIA.md';
const cajaPath = 'tests/pm09/P10_CAJA_EVIDENCIA.json';
const ivaPath = 'tests/pm09/P11_IVA_EVIDENCIA.json';
const resultadosPath = 'tests/pm09/P12_RESULTADOS_EVIDENCIA.json';
const la007Path = 'tests/pm09/LA007_RESULTADOS_EVIDENCIA.json';
const la008Path = 'tests/pm09/LA008_ROTACION_MARGEN_EVIDENCIA.json';

for (const p of [evidencePath, cajaPath, ivaPath, resultadosPath, la007Path, la008Path]) {
  assert.equal(fs.existsSync(p), true, `Falta archivo requerido: ${p}`);
}

const evidence = fs.readFileSync(evidencePath, 'utf8');
const caja = JSON.parse(fs.readFileSync(cajaPath, 'utf8'));
const iva = JSON.parse(fs.readFileSync(ivaPath, 'utf8'));
const resultados = JSON.parse(fs.readFileSync(resultadosPath, 'utf8'));
const la007 = JSON.parse(fs.readFileSync(la007Path, 'utf8'));
const la008 = JSON.parse(fs.readFileSync(la008Path, 'utf8'));

const checks = {
  evidencia_declara_pass: evidence.includes('G1_P06_CIFRAS_CONCILIACIONES=PASS'),
  stock_neto_22: evidence.includes('total: **22**') && evidence.includes('Neto frente al stock inicial 23: **-1 unidad**'),
  caja_servidor_ignora_999: evidence.includes('efectivo_base: **12,00 €**') && evidence.includes('efectivo_esperado: **6,00 €**') && evidence.includes('diferencia: **0,00 €**'),
  resultados_5_45_3_2_45: evidence.includes('ingresos netos: **5,45 €**') && evidence.includes('coste de ventas neto: **3,00 €**') && evidence.includes('margen bruto: **2,45 €**') && evidence.includes('margen: **45,00 %**'),
  iva_5_45_0_55: evidence.includes('base repercutida neta: **5,45 €**') && evidence.includes('IVA repercutido neto: **0,55 €**'),
  limpieza_total: evidence.includes('`stock_operaciones` con `G1-P06-%`: 0') && evidence.includes('`arqueos_caja` con `G1-P06-%`: 0'),
  pm09_caja_historica_ok: caja.estado === 'VALIDADO' && caja.validacionAutomatica?.resultado === 'success' && caja.validacionQAPM09?.efectivoEsperadoServidor === 2,
  pm09_iva_historica_ok: iva.estado === 'VALIDADO' && iva.validacionAutomatica?.resultado === 'success' && iva.validacionQALedger?.proyeccionConciliadaPrudente?.ivaRepercutido === 1.09,
  pm09_resultados_historico_ok: resultados.estado === 'VALIDADO' && resultados.validacionQAReadOnly?.escenarioDevolucionParcial?.margenBruto === 2.45,
  la007_ok: la007.estado === 'VALIDADO',
  la008_ok: la008.estado === 'VALIDADO'
};

for (const [name, ok] of Object.entries(checks)) {
  console.log(`G1_P06_${name.toUpperCase()}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

if (process.exitCode) throw new Error('G1_P06_CIFRAS_CONCILIACIONES_CONTRACT_FAIL');
console.log(`G1_P06_CHECKS=${Object.keys(checks).length}`);
console.log('G1_P06_CIFRAS_CONCILIACIONES_CONTRACT_OK=1');
