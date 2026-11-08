import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

function cargarMotor(path) {
  const src = fs.readFileSync(path, 'utf8');
  const start = src.indexOf('const MINUTOS_DIA_PM13 = 24 * 60;');
  const end = src.indexOf('function horasDeEmpleadoEnMes', start);
  assert.ok(start >= 0 && end > start, `${path}: motor temporal presente`);
  const snippet = src.slice(start, end) + '\nglobalThis.__resumenFichajesPM13 = resumenFichajesPM13;';
  const contexto = { Date, String, Number, Map, Array, Math };
  contexto.globalThis = contexto;
  vm.runInNewContext(snippet, contexto);
  return { src, resumenFichajesPM13: contexto.__resumenFichajesPM13 };
}

const fichajes = [
  { id: 'e1', empleadoId: 'e1', tipo: 'entrada', fecha: '2026-10-15', hora: '09:00' },
  { id: 's1', empleadoId: 'e1', tipo: 'salida', fecha: '2026-10-15', hora: '12:00' },
  { id: 'e2', empleadoId: 'e1', tipo: 'entrada', fecha: '2026-10-15', hora: '13:00' },
  { id: 's2', empleadoId: 'e1', tipo: 'salida', fecha: '2026-10-15', hora: '17:00' },
  { id: 'e3', empleadoId: 'e1', tipo: 'entrada', fecha: '2026-10-31', hora: '23:00' },
  { id: 's3', empleadoId: 'e1', tipo: 'salida', fecha: '2026-11-01', hora: '01:30' }
];

for (const path of ['fuente.js', 'source-recovery/fuente-recuperado.js']) {
  const { src, resumenFichajesPM13 } = cargarMotor(path);
  const resumen = resumenFichajesPM13(fichajes);
  assert.equal(resumen.pares.length, 3, `${path}: conserva tres parejas válidas`);
  assert.deepEqual(Array.from(resumen.pares, (p) => p.minutos), [180, 240, 150], `${path}: calcula cada intervalo sin mezclar descansos`);
  assert.equal(resumen.pares[2].fecha, '2026-10-31', `${path}: la jornada pertenece a la fecha de entrada`);
  assert.equal(resumen.pares[2].fechaFin, '2026-11-01', `${path}: conserva la fecha de salida al cruzar medianoche`);
  assert.equal(resumen.abiertos.length, 0, `${path}: una salida del día siguiente cierra la jornada anterior`);

  const abierto = resumenFichajesPM13([
    { id: 'e4', empleadoId: 'e1', tipo: 'entrada', fecha: '2026-11-02', hora: '22:00' }
  ]);
  assert.equal(abierto.abiertos.length, 1, `${path}: detecta una entrada realmente abierta`);

  const anulado = resumenFichajesPM13([
    { id: 'e5', empleadoId: 'e1', tipo: 'entrada', fecha: '2026-11-03', hora: '09:00', anulado: true },
    { id: 's5', empleadoId: 'e1', tipo: 'salida', fecha: '2026-11-03', hora: '17:00' }
  ]);
  assert.equal(anulado.pares.length, 0, `${path}: ignora fichajes anulados`);
  assert.equal(anulado.abiertos.length, 0, `${path}: una salida huérfana no se convierte en jornada abierta`);

  assert.match(src, /resumenFichajesPM13\(fichajes\)\.abiertos/, `${path}: el aviso usa parejas entre fechas`);
  assert.match(src, /const resumen = resumenFichajesPM13\(fichajesVigentesPM13\)/, `${path}: el historial usa el mismo motor temporal`);
  assert.match(src, /fechaFin/, `${path}: el historial conserva la fecha final de una jornada nocturna`);
}

console.log('PM13_P07_FICHAJES_TEMPORALES_UI=PASS');
console.log('MULTIPLE_VALID_PAIRS=1');
console.log('CROSS_MIDNIGHT_UI=1');
console.log('OPEN_STATE_ACROSS_DATES=1');
console.log('ANULLED_IGNORED=1');
