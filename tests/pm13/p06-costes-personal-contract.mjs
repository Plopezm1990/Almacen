import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const start = src.indexOf('const parseFechaCostePersonalPM13 = (valor) => {');
const end = src.indexOf('const costePersonalPeriodoInfo = resumenCostePersonalPeriodoPM13', start);
assert.ok(start >= 0 && end > start, 'P06 debe exponer el motor temporal de costes dentro de Resultados');
const snippet = src.slice(start, end) + `\nresultadoP06 = { parseFechaCostePersonalPM13, costeMensualEmpleadoPM13, diasCosteEmpleadoEnPeriodoPM13, resumenCostePersonalPeriodoPM13 };`;
const ctx = { Date, Number, Math, String, resultadoP06: null };
vm.runInNewContext(snippet, ctx);
const { costeMensualEmpleadoPM13, diasCosteEmpleadoEnPeriodoPM13, resumenCostePersonalPeriodoPM13 } = ctx.resultadoP06;

const exacto = costeMensualEmpleadoPM13({ costeEmpresaMensual: 1800, salarioBrutoMensual: 1200, pagas: 14 });
assert.equal(exacto.costeMensual, 1800);
assert.equal(exacto.estimado, false);
assert.equal(exacto.incompleto, false);

const estimado14 = costeMensualEmpleadoPM13({ costeEmpresaMensual: '', salarioBrutoMensual: 1200, pagas: 14 });
assert.ok(Math.abs(estimado14.costeMensual - 1848) < 1e-9, '14 pagas deben anualizarse antes del 1,32');
assert.equal(estimado14.estimado, true);
assert.equal(estimado14.incompleto, false);

const estimadoLegacy = costeMensualEmpleadoPM13({ costeEmpresaMensual: '', salarioBrutoMensual: 1200 });
assert.ok(Math.abs(estimadoLegacy.costeMensual - 1584) < 1e-9, 'sin pagas legadas se usa 12 como fallback conservador');
assert.equal(estimadoLegacy.incompleto, true, 'el fallback legado debe declararse incompleto');

const tramo = diasCosteEmpleadoEnPeriodoPM13(
  { activo: false, fechaAlta: '2026-01-11', fechaBaja: '2026-01-20' },
  '2026-01-01', '2026-01-30'
);
assert.equal(tramo.dias, 10, 'debe contar solo días de relación laboral dentro del periodo');
assert.equal(tramo.incompleto, false);

const historico = resumenCostePersonalPeriodoPM13([
  { activo: false, fechaAlta: '2026-01-11', fechaBaja: '2026-01-20', costeEmpresaMensual: 3000, salarioBrutoMensual: 0, pagas: 14 },
  { activo: true, fechaAlta: '2026-02-01', fechaBaja: '', costeEmpresaMensual: 4000, salarioBrutoMensual: 0, pagas: 14 }
], '2026-01-01', '2026-01-30');
assert.ok(Math.abs(historico.total - 1000) < 1e-9, 'una baja actual debe conservar su coste histórico y un alta futura no contaminarlo');
assert.equal(historico.incompleto, false);

const legadoBaja = resumenCostePersonalPeriodoPM13([
  { activo: false, fechaAlta: '2026-01-01', fechaBaja: '', costeEmpresaMensual: 2000, salarioBrutoMensual: 0, pagas: 14 }
], '2026-01-01', '2026-01-30');
assert.equal(legadoBaja.total, 0, 'una baja sin fecha no debe inventar días de coste');
assert.equal(legadoBaja.incompleto, true);

const invalido = costeMensualEmpleadoPM13({ costeEmpresaMensual: 'abc', salarioBrutoMensual: 1200, pagas: 14 });
assert.equal(invalido.costeMensual, 0);
assert.equal(invalido.incompleto, true, 'un coste exacto legado inválido no debe convertirse silenciosamente en estimación');

assert.ok(src.includes('Salario bruto por paga (\\u20AC)'), 'la UI debe aclarar que el bruto se expresa por paga');
assert.ok(src.includes('Coste medio mensual para la empresa (\\u20AC, opcional)'), 'la UI debe aclarar la semántica del coste exacto');
assert.ok(src.includes('Coste de personal incompleto:'), 'la UI debe advertir cuando faltan fechas o costes');
assert.ok(src.includes('fmt(costePersonalPeriodo)'), 'Resultados debe mostrar el coste temporal, no mensual × días sin historia');
assert.ok(!src.includes('const coste = e2.costeEmpresaMensual !== "" && e2.costeEmpresaMensual != null ? Number(e2.costeEmpresaMensual) : bruto * 1.32;'), 'debe desaparecer la estimación antigua que ignoraba pagas');

console.log('PM13_P06_COSTES_PERSONAL=PASS');
console.log('PAGAS_ANUALIZADAS=1');
console.log('ALTAS_BAJAS_TEMPORALES=1');
console.log('EXACTO_VS_ESTIMADO=1');
console.log('LEGADOS_INCOMPLETOS_HONESTOS=1');
console.log('RESULTADOS_PERIODO=1');
