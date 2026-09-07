import fs from 'node:fs';
import assert from 'node:assert/strict';

const fuente = fs.readFileSync('fuente.js', 'utf8');
const inicioPersonal = fuente.indexOf('function Personal({');
const finPersonal = fuente.indexOf('function Turnos({', inicioPersonal);
assert.ok(inicioPersonal >= 0 && finPersonal > inicioPersonal, 'Debe existir UI Personal');
const personal = fuente.slice(inicioPersonal, finPersonal);

for (const token of [
  'function fechaVacacionesPM13(',
  'function tramoVacacionesEnAnioPM13(',
  'function resumenVacacionesPM13(',
  'resumenVacaciones.disfrutados',
  'resumenVacaciones.programados',
  'resumenVacaciones.saldo',
  'resumenVacaciones.exceso'
]) assert.ok(personal.includes(token), `Falta ${token}`);

assert.ok(!personal.includes('new Date(a22.fechaInicio).getFullYear() === anioActual'), 'No debe atribuir toda la ausencia al año de inicio');
assert.ok(!personal.includes('"Vacaciones: ", usados, " / ", total, " d\\xEDas usados este a\\xF1o"'), 'No debe mezclar programadas con disfrutadas bajo la etiqueta usadas');

const ini = personal.indexOf('  function fechaVacacionesPM13(');
const fin = personal.indexOf('  return /* @__PURE__ */', ini);
assert.ok(ini >= 0 && fin > ini, 'No se pudo aislar el motor de vacaciones');
const bloque = personal.slice(ini, fin);
const api = new Function('todayISO', 'anioActual', `${bloque}\nreturn { resumenVacacionesPM13, vacacionesUsadas };`)(() => '2026-09-07', 2026);

const empleado = {
  diasVacacionesAnuales: 30,
  ausencias: [
    { id: 'pasada', tipo: 'Vacaciones', fechaInicio: '2026-09-01', fechaFin: '2026-09-03', estado: 'ACTIVA' },
    { id: 'hoy', tipo: 'Vacaciones', fechaInicio: '2026-09-07', fechaFin: '2026-09-09', estado: 'ACTIVA' },
    { id: 'cruce', tipo: 'Vacaciones', fechaInicio: '2026-12-30', fechaFin: '2027-01-02', estado: 'ACTIVA' },
    { id: 'anulada', tipo: 'Vacaciones', fechaInicio: '2026-10-01', fechaFin: '2026-10-05', estado: 'ANULADA' },
    { id: 'baja', tipo: 'Baja médica', fechaInicio: '2026-11-01', fechaFin: '2026-11-10', estado: 'ACTIVA' }
  ]
};

const r2026 = api.resumenVacacionesPM13(empleado, 2026, '2026-09-07');
assert.deepEqual(r2026, {
  total: 30,
  reservados: 8,
  disfrutados: 3,
  enCurso: 1,
  programados: 4,
  saldo: 22,
  disponibles: 22,
  exceso: 0
});
assert.equal(api.vacacionesUsadas(empleado), 8, 'Compatibilidad: vacacionesUsadas debe devolver reservados activos del año');

const r2027 = api.resumenVacacionesPM13(empleado, 2027, '2026-09-07');
assert.deepEqual(r2027, {
  total: 30,
  reservados: 2,
  disfrutados: 0,
  enCurso: 0,
  programados: 2,
  saldo: 28,
  disponibles: 28,
  exceso: 0
});

const exceso = api.resumenVacacionesPM13({
  diasVacacionesAnuales: 2,
  ausencias: [{ tipo: 'Vacaciones', fechaInicio: '2026-12-01', fechaFin: '2026-12-03', estado: 'ACTIVA' }]
}, 2026, '2026-09-07');
assert.equal(exceso.reservados, 3);
assert.equal(exceso.saldo, -1);
assert.equal(exceso.disponibles, 0);
assert.equal(exceso.exceso, 1);

const defensivo = api.resumenVacacionesPM13({
  diasVacacionesAnuales: -5,
  ausencias: [
    { tipo: 'Vacaciones', fechaInicio: '2026-02-30', fechaFin: '2026-03-02', estado: 'ACTIVA' },
    { tipo: 'Vacaciones', fechaInicio: '2026-05-01', fechaFin: '2026-04-30', estado: 'ACTIVA' }
  ]
}, 2026, '2026-09-07');
assert.equal(defensivo.total, 0);
assert.equal(defensivo.reservados, 0);
assert.equal(defensivo.saldo, 0);

console.log('PM13_P05_VACACIONES=PASS');
console.log('CRUCE_ANUAL_CORRECTO=1');
console.log('ANULADAS_EXCLUIDAS=1');
console.log('DISFRUTADAS_PROGRAMADAS_SEPARADAS=1');
console.log('SALDO_Y_EXCESO_HONESTOS=1');
console.log('SIN_DERIVA_ZONA_HORARIA=1');
