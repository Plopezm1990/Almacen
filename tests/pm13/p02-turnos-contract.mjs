import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const start = src.indexOf('function crearLogicaTurnos({ turnos, setTurnos, empleados, localActivoId }) {');
const end = src.indexOf('\nfunction crearLogicaAppcc(', start);
assert.ok(start >= 0 && end > start, 'No se localizó crearLogicaTurnos');
const code = src.slice(start, end) + '\nglobalThis.__crearLogicaTurnos = crearLogicaTurnos;';
let seq = 0;
const sandbox = { uid: () => `pm13-turno-${++seq}` };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const crearLogicaTurnos = sandbox.__crearLogicaTurnos;

const empleados = [
  { id: 'a1', nombre: 'Activo A1', activo: true, localId: 'local-a' },
  { id: 'a2', nombre: 'Activo A2', activo: true, localId: 'local-a' },
  { id: 'b1', nombre: 'Activo B1', activo: true, localId: 'local-b' },
  { id: 'inactivo', nombre: 'Baja A', activo: false, localId: 'local-a' }
];

function entorno(inicial = [], localActivoId = 'local-a', listaEmpleados = empleados) {
  let estado = inicial.map((x) => ({ ...x }));
  const setTurnos = (updater) => {
    estado = typeof updater === 'function' ? updater(estado) : updater;
  };
  const nuevaLogica = () => crearLogicaTurnos({ turnos: estado, setTurnos, empleados: listaEmpleados, localActivoId });
  return { get estado() { return estado; }, nuevaLogica };
}

const turnoBase = {
  empleadoId: 'a1',
  fecha: '2026-09-07',
  tipo: 'Mañana',
  horaInicio: '08:00',
  horaFin: '14:00',
  notas: ''
};

{
  const e = entorno();
  assert.equal(e.nuevaLogica().addTurno({ ...turnoBase, empleadoId: 'inactivo' }), false);
  assert.equal(e.nuevaLogica().addTurno({ ...turnoBase, empleadoId: 'b1' }), false);
  assert.equal(e.nuevaLogica().addTurno({ ...turnoBase, fecha: '2026-02-30' }), false);
  assert.equal(e.nuevaLogica().addTurno({ ...turnoBase, horaInicio: '25:00' }), false);
  assert.equal(e.nuevaLogica().addTurno({ ...turnoBase, horaInicio: '', horaFin: '14:00' }), false);
  assert.equal(e.nuevaLogica().addTurno({ ...turnoBase, horaInicio: '08:00', horaFin: '08:00' }), false);
  assert.equal(e.estado.length, 0);
  assert.equal(e.nuevaLogica().addTurno(turnoBase), true);
  assert.equal(e.estado.length, 1);
  assert.equal(e.estado[0].localId, 'local-a');
}

{
  const e = entorno();
  assert.equal(e.nuevaLogica().addTurno({ ...turnoBase, tipo: 'Libre', horaInicio: '', horaFin: '' }), true);
  assert.equal(e.estado.length, 1);
}

{
  const e = entorno();
  assert.equal(e.nuevaLogica().addTurno({ ...turnoBase, horaInicio: '22:00', horaFin: '02:00' }), true);
  assert.equal(e.nuevaLogica().addTurno({ ...turnoBase, fecha: '2026-09-08', horaInicio: '01:00', horaFin: '03:00' }), false);
  assert.equal(e.nuevaLogica().addTurno({ ...turnoBase, empleadoId: 'a2', fecha: '2026-09-08', horaInicio: '01:00', horaFin: '03:00' }), true);
  assert.equal(e.estado.length, 2);
}

{
  const e = entorno();
  assert.equal(e.nuevaLogica().addTurno(turnoBase), true);
  assert.equal(e.nuevaLogica().addTurno(turnoBase), false);
  assert.equal(e.estado.length, 1);
}

{
  const inicial = [
    { id: 't1', ...turnoBase, localId: 'local-a' },
    { id: 't2', empleadoId: 'a1', fecha: '2026-09-07', tipo: 'Tarde', horaInicio: '15:00', horaFin: '20:00', notas: '', localId: 'local-a' },
    { id: 'tb', empleadoId: 'b1', fecha: '2026-09-07', tipo: 'Otro local', horaInicio: '10:00', horaFin: '12:00', notas: '', localId: 'local-b' }
  ];
  const e = entorno(inicial);
  assert.equal(e.nuevaLogica().updateTurno('tb', { horaInicio: '11:00' }), false);
  assert.equal(e.nuevaLogica().updateTurno('t1', { empleadoId: 'b1' }), false);
  assert.equal(e.nuevaLogica().updateTurno('t1', { empleadoId: 'inactivo' }), false);
  assert.equal(e.nuevaLogica().updateTurno('t1', { horaInicio: '16:00', horaFin: '18:00' }), false);
  assert.equal(e.nuevaLogica().updateTurno('t1', { horaInicio: '09:00', horaFin: '13:00' }), true);
  assert.equal(e.estado.find((x) => x.id === 't1').horaInicio, '09:00');
}

{
  const inicial = [
    { id: 'ta', ...turnoBase, localId: 'local-a' },
    { id: 'tb', empleadoId: 'b1', fecha: '2026-09-07', tipo: 'B', horaInicio: '08:00', horaFin: '12:00', notas: '', localId: 'local-b' }
  ];
  const e = entorno(inicial);
  assert.equal(e.nuevaLogica().deleteTurno('tb'), false);
  assert.equal(e.estado.length, 2);
  assert.equal(e.nuevaLogica().deleteTurno('ta'), true);
  assert.deepEqual(e.estado.map((x) => x.id), ['tb']);
}

{
  const desde = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'];
  const hacia = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'];
  const inicial = [
    { id: 'src1', empleadoId: 'a1', fecha: '2026-08-31', tipo: 'Mañana', horaInicio: '08:00', horaFin: '14:00', notas: '', localId: 'local-a' },
    { id: 'src2', empleadoId: 'inactivo', fecha: '2026-09-01', tipo: 'Mañana', horaInicio: '08:00', horaFin: '14:00', notas: '', localId: 'local-a' }
  ];
  const e = entorno(inicial);
  assert.equal(e.nuevaLogica().copiarSemana(desde, hacia), 1);
  assert.equal(e.estado.filter((x) => x.fecha === '2026-09-07').length, 1);
  assert.equal(e.estado.some((x) => x.fecha === '2026-09-08' && x.empleadoId === 'inactivo'), false);
  assert.equal(e.nuevaLogica().copiarSemana(desde, hacia), 0);
  assert.equal(e.estado.filter((x) => x.fecha === '2026-09-07').length, 1);
}

{
  const desde = ['2026-08-31'];
  const hacia = ['2026-09-07'];
  const inicial = [
    { id: 'src', empleadoId: 'a1', fecha: '2026-08-31', tipo: 'Mañana', horaInicio: '08:00', horaFin: '14:00', notas: '', localId: 'local-a' },
    { id: 'dst', empleadoId: 'a1', fecha: '2026-09-07', tipo: 'Especial', horaInicio: '10:00', horaFin: '12:00', notas: '', localId: 'local-a' }
  ];
  const e = entorno(inicial);
  assert.equal(e.nuevaLogica().copiarSemana(desde, hacia), 0);
  assert.equal(e.estado.length, 2);
}

const uiStart = src.indexOf('function Turnos({ empleados, turnos, addTurno, updateTurno, deleteTurno, copiarSemana }) {');
const uiEnd = src.indexOf('\nfunction MapaAlmacen(', uiStart);
assert.ok(uiStart >= 0 && uiEnd > uiStart, 'No se localizó UI Turnos');
const ui = src.slice(uiStart, uiEnd);
assert.match(ui, /const guardado = addTurno\(\{/);
assert.match(ui, /if \(!guardado\) \{[\s\S]*setError\("No se pudo guardar el turno\./);
assert.match(ui, /No hay turnos nuevos que copiar\./);
assert.match(ui, /empleados\.filter\(\(e2\) => e2\.activo !== false\)/);

console.log('PM13_P02_TURNOS_SEGUROS=PASS');
console.log('ACTIVOS_Y_SCOPE=1');
console.log('FECHAS_HORAS_VALIDAS=1');
console.log('NOCHES_Y_SOLAPAMIENTOS=1');
console.log('EDICION_FAIL_CLOSED=1');
console.log('COPIA_SEMANA_IDEMPOTENTE=1');
console.log('UI_NO_CIERRA_EN_ERROR=1');
