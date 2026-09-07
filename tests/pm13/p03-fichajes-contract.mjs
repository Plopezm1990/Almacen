import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const start = src.indexOf('function crearLogicaFichaje({ fichajes, setFichajes, empleados, localActivoId }) {');
const end = src.indexOf('\nfunction redondearDineroPM06(', start);
assert.ok(start >= 0 && end > start, 'No se localizó crearLogicaFichaje');
const code = src.slice(start, end) + '\nglobalThis.__crearLogicaFichaje = crearLogicaFichaje;';

const empleados = [
  { id: 'a1', nombre: 'Activo A', activo: true, localId: 'local-a' },
  { id: 'a2', nombre: 'Activo A2', activo: true, localId: 'local-a' },
  { id: 'b1', nombre: 'Activo B', activo: true, localId: 'local-b' },
  { id: 'inactivo', nombre: 'Baja', activo: false, localId: 'local-a' }
];

function cargar(extra = {}) {
  let seq = 0;
  const sandbox = {
    uid: () => `uid-${++seq}`,
    todayISO: () => '2026-09-07',
    Date,
    Promise,
    console,
    ...extra
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.__crearLogicaFichaje;
}

function entorno(inicial = [], localActivoId = 'local-a', extra = {}) {
  let estado = inicial.map((x) => ({ ...x }));
  const crear = cargar(extra);
  const setFichajes = (updater) => { estado = typeof updater === 'function' ? updater(estado) : updater; };
  const nueva = () => crear({ fichajes: estado, setFichajes, empleados, localActivoId });
  return { get estado() { return estado; }, nueva };
}

const baseEntrada = { empleadoId: 'a1', fecha: '2026-09-06', tipo: 'entrada', hora: '09:00' };

// Dominio local: empleado activo y local concreto.
{
  const e = entorno();
  assert.equal(e.nueva().addFichajeManual({ ...baseEntrada, empleadoId: 'inactivo' }), false);
  assert.equal(e.nueva().addFichajeManual({ ...baseEntrada, empleadoId: 'b1' }), false);
  assert.equal(e.nueva().addFichajeManual({ ...baseEntrada, tipo: 'pausa' }), false);
  assert.equal(e.nueva().addFichajeManual({ ...baseEntrada, fecha: '2026-02-30' }), false);
  assert.equal(e.nueva().addFichajeManual({ ...baseEntrada, fecha: '2026-09-08' }), false, 'manual futuro bloqueado');
  assert.equal(e.nueva().addFichajeManual({ ...baseEntrada, hora: '25:00' }), false);
  assert.equal(e.estado.length, 0);
}

// Secuencia: empieza por entrada, alterna entrada/salida y no duplica mismo minuto.
{
  const e = entorno();
  assert.equal(e.nueva().addFichajeManual({ ...baseEntrada, tipo: 'salida' }), false);
  assert.equal(e.nueva().addFichajeManual(baseEntrada), true);
  assert.equal(e.nueva().addFichajeManual(baseEntrada), false, 'replay/duplicado local no duplica');
  assert.equal(e.nueva().addFichajeManual({ ...baseEntrada, hora: '10:00' }), false, 'doble entrada bloqueada');
  assert.equal(e.nueva().addFichajeManual({ ...baseEntrada, tipo: 'salida', hora: '17:00' }), true);
  assert.equal(e.nueva().addFichajeManual({ ...baseEntrada, tipo: 'salida', hora: '18:00' }), false, 'doble salida bloqueada');
  assert.equal(e.estado.length, 2);
}

// Corrección conserva identidad/original, exige motivo y no rompe secuencia.
{
  const inicial = [
    { id: 'e1', ...baseEntrada, localId: 'local-a', anulado: false },
    { id: 's1', ...baseEntrada, tipo: 'salida', hora: '17:00', localId: 'local-a', anulado: false }
  ];
  const e = entorno(inicial);
  assert.equal(e.nueva().updateFichaje('s1', { hora: '18:00' }), false, 'corrección sin motivo bloqueada');
  assert.equal(e.nueva().updateFichaje('s1', { empleadoId: 'a2', hora: '18:00', motivo: 'ajuste' }), false, 'empleado inmutable');
  assert.equal(e.nueva().updateFichaje('s1', { hora: '18:00', motivo: 'ajuste' }), true);
  const corregido = e.estado.find((x) => x.id === 's1');
  assert.equal(corregido.hora, '18:00');
  assert.equal(corregido.original.hora, '17:00');
  assert.equal(corregido.historialCorrecciones.length, 1);
}

// Anulación es lógica/conservadora: no borra y no puede romper una pareja válida.
{
  const inicial = [
    { id: 'e1', ...baseEntrada, localId: 'local-a', anulado: false },
    { id: 's1', ...baseEntrada, tipo: 'salida', hora: '17:00', localId: 'local-a', anulado: false }
  ];
  const e = entorno(inicial);
  assert.equal(e.nueva().eliminarFichaje('e1', { motivo: 'error' }), false, 'no deja salida huérfana');
  assert.equal(e.nueva().eliminarFichaje('s1', { motivo: 'error' }), true);
  assert.equal(e.estado.length, 2, 'anular no borra físicamente');
  assert.equal(e.estado.find((x) => x.id === 's1').anulado, true);
}

// Fichar automático rechaza baja/local/tipo inválido y coalescing remoto evita doble RPC.
{
  assert.equal(entorno().nueva().fichar('inactivo', 'entrada'), false);
  assert.equal(entorno().nueva().fichar('b1', 'entrada'), false);
  assert.equal(entorno().nueva().fichar('a1', 'pausa'), false);

  let rpcCount = 0;
  let rpcName = null;
  let rpcArgs = null;
  const remoto = entorno([], 'local-a', {
    window: {
      getSupabaseClient: async () => ({
        rpc: async (nombre, args) => {
          rpcCount += 1;
          rpcName = nombre;
          rpcArgs = args;
          await new Promise((resolve) => setTimeout(resolve, 5));
          return { data: { ok: true, fichaje: { id: 'remote-1', empleadoId: 'a1', localId: 'local-a', fecha: '2026-09-07', hora: '12:00', tipo: 'entrada', anulado: false } }, error: null };
        }
      })
    },
    setTimeout
  });
  const logica = remoto.nueva();
  const p1 = logica.fichar('a1', 'entrada');
  const p2 = logica.fichar('a1', 'entrada');
  assert.equal(typeof p1?.then, 'function');
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1, true);
  assert.equal(r2, true);
  assert.equal(rpcCount, 1, 'doble clic comparte una RPC');
  assert.equal(rpcName, 'pm13_fichar');
  assert.equal(rpcArgs.p_empleado_id, 'a1');
  assert.equal(rpcArgs.p_local_id, 'local-a');
  assert.equal(rpcArgs.p_tipo, 'entrada');
  assert.ok(String(rpcArgs.p_operation_id).includes('a1'));
  assert.equal(remoto.estado.length, 1, 'caché muta solo tras confirmación remota');
}

// Fallo remoto: no hay efecto local parcial.
{
  const remoto = entorno([], 'local-a', {
    window: {
      getSupabaseClient: async () => ({ rpc: async () => ({ data: { ok: false, codigo: 'FICHAJE_YA_ABIERTO' }, error: null }) })
    }
  });
  assert.equal(await remoto.nueva().fichar('a1', 'entrada'), false);
  assert.equal(remoto.estado.length, 0);
}

// Barreras estáticas de UI y cálculo global.
const uiStart = src.indexOf('function RegistroHorario({ empleados, fichajes, fichar, addFichajeManual, updateFichaje, eliminarFichaje, fichajesAbiertos }) {');
assert.ok(uiStart >= 0, 'RegistroHorario presente');
const uiNext = src.indexOf('\nfunction ', uiStart + 30);
const ui = src.slice(uiStart, uiNext > uiStart ? uiNext : uiStart + 160000);
assert.match(ui, /fichajesVigentesPM13/);
assert.match(ui, /async function submitManual\(\)/);
assert.match(ui, /const guardado = await Promise\.resolve\(addFichajeManual\(\{/);
const guardPos = ui.indexOf('const guardado = await Promise.resolve(addFichajeManual({');
const rejectPos = ui.indexOf('if (!guardado)', guardPos);
const closePos = ui.indexOf('setShowManual(false)', guardPos);
assert.ok(guardPos >= 0 && rejectPos > guardPos && closePos > rejectPos, 'modal solo cierra tras guardado confirmado');
assert.match(ui, /fichajesVigentesPM13\.filter\(\(f22\) => f22\.fecha >= desde/);

const openPos = src.indexOf('const fichajesAbiertos =');
assert.ok(openPos >= 0, 'cálculo global de fichajes abiertos presente');
const openSlice = src.slice(openPos, openPos + 2200);
assert.match(openSlice, /fichajes\.filter\(\(f22\) => f22\?\.anulado !== true/);

const logicText = src.slice(start, end);
assert.doesNotMatch(logicText, /setFichajes\(\(s22\) => s22\.filter\(\(f22\) => f22\.id !== id/);
assert.match(logicText, /pm13_fichar/);
assert.match(logicText, /pm13_fichaje_manual/);
assert.match(logicText, /pm13_corregir_fichaje/);
assert.match(logicText, /pm13_anular_fichaje/);

console.log('PM13_P03_FICHAJES_FRONTEND=PASS');
console.log('ACTIVOS_SCOPE_SECUENCIA=1');
console.log('REPLAY_DOBLE_CLIC=1');
console.log('CORRECCION_TRAZABLE=1');
console.log('ANULACION_SIN_BORRADO=1');
console.log('UI_FAIL_CLOSED=1');
