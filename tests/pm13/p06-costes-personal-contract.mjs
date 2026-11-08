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

function loadTemporalEngine(path) {
  const temporalSrc = fs.readFileSync(path, 'utf8');
  const temporalStart = temporalSrc.indexOf('const MINUTOS_DIA_PM13 = 24 * 60;');
  const temporalEnd = temporalSrc.indexOf('function costePorHoraEquipoEnMes', temporalStart);
  assert.ok(temporalStart >= 0 && temporalEnd > temporalStart, `${path} debe exponer el motor temporal PM13`);
  const temporalSnippet = temporalSrc.slice(temporalStart, temporalEnd) + '\nresultadoTemporal = { parseFechaHoraFichajePM13, intervaloFichajePM13, horasDeEmpleadoEnMes };';
  const temporalContext = { Date, String, Number, Math, resultadoTemporal: null };
  vm.runInNewContext(temporalSnippet, temporalContext);
  return { src: temporalSrc, ...temporalContext.resultadoTemporal };
}

for (const path of ['fuente.js', 'source-recovery/fuente-recuperado.js']) {
  const { src: temporalSrc, parseFechaHoraFichajePM13, intervaloFichajePM13, horasDeEmpleadoEnMes } = loadTemporalEngine(path);
  assert.deepEqual(parseFechaHoraFichajePM13('2026-02-30', '09:00'), null, `${path}: fecha imposible rechazada`);
  assert.equal(intervaloFichajePM13(
    { fecha: '2026-10-31', hora: '23:00' },
    { fecha: '2026-11-01', hora: '01:30' }
  ).minutos, 150, `${path}: cruce de medianoche conservado`);
  assert.equal(horasDeEmpleadoEnMes([
    { id: 'a', empleadoId: 'e1', tipo: 'entrada', fecha: '2026-10-31', hora: '23:00' },
    { id: 'b', empleadoId: 'e1', tipo: 'salida', fecha: '2026-11-01', hora: '01:30' },
    { id: 'c', empleadoId: 'e1', tipo: 'entrada', fecha: '2026-10-15', hora: '09:00' },
    { id: 'd', empleadoId: 'e1', tipo: 'salida', fecha: '2026-10-15', hora: '17:00' }
  ], 'e1', '2026-10'), 10.5, `${path}: el periodo se atribuye al mes de la entrada`);
  assert.equal(horasDeEmpleadoEnMes([
    { id: 'a', empleadoId: 'e1', tipo: 'entrada', fecha: '2026-10-15', hora: '09:00' },
    { id: 'b', empleadoId: 'e1', tipo: 'entrada', fecha: '2026-10-15', hora: '10:00' },
    { id: 'c', empleadoId: 'e1', tipo: 'salida', fecha: '2026-10-15', hora: '17:00' }
  ], 'e1', '2026-10'), 8, `${path}: no se cuentan dos entradas como dos jornadas`);
  assert.match(temporalSrc, /valores de pared almacenados por el servidor/);
  assert.match(temporalSrc, /const cruzaMedianoche = fin <= inicio\.minutos/);
}

const turnosStart = src.indexOf('const intervaloTurnoPM13 = (turno) => {');
const turnosEnd = src.indexOf('const equivalenteTurnoPM13', turnosStart);
assert.ok(turnosStart >= 0 && turnosEnd > turnosStart, 'debe existir el intervalo de turnos');
const turnosContext = src.slice(src.indexOf('const parseFechaTurnoPM13'), turnosEnd);
assert.match(turnosContext, /Date\.UTC\(/, 'los turnos deben usar una base calendaria independiente de la zona local');
assert.match(turnosContext, /if \(hasta <= desde\) hasta \+= 1440;/, 'los turnos nocturnos deben cruzar medianoche explícitamente');
assert.match(src, /operatingDay/, 'el flujo operativo ya recibe el día operativo resuelto por servidor');

console.log('MULTIPLE_ENTRIES_EXITS=1');
console.log('CROSS_MIDNIGHT=1');
console.log('MONTH_PERIOD_BY_ENTRY=1');
console.log('WALL_CLOCK_NO_SILENT_TIMEZONE_REWRITE=1');
console.log('OPERATING_DAY_SERVER_CONTEXT=1');
