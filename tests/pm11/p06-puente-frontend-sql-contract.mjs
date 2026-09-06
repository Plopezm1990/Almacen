import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260906084500_pm11_rpc_ciclo_vida_empleados.sql', 'utf8');

const logicIni = src.indexOf('function pm11UsarSqlPersonal()');
const logicFin = src.indexOf('function crearLogicaTurnos({', logicIni);
assert.ok(logicIni >= 0 && logicFin > logicIni, 'puente PM11 y frontera Personal disponibles');
const logic = src.slice(logicIni, logicFin);

for (const token of [
  'function pm11NormalizarEmpleadoSql(',
  'function pm11FusionarEmpleados(',
  'async function pm11CargarEmpleadosSql(',
  'async function pm11RpcPersonal(',
  'pm11_alta_empleado',
  'pm11_editar_empleado',
  'pm11_baja_empleado',
  'pm11_reactivar_empleado',
  'function reactivarEmpleado(id)',
  'return { addEmpleado, updateEmpleado, deleteEmpleado, reactivarEmpleado, anonimizarEmpleado'
]) assert.ok(logic.includes(token), `falta ${token}`);

// El nombre histórico deleteEmpleado queda como adaptador de compatibilidad,
// pero ya no puede borrar la ficha ni sus nóminas: representa baja lógica.
const bajaIni = logic.indexOf('function deleteEmpleado(id)');
const bajaFin = logic.indexOf('function reactivarEmpleado(id)', bajaIni);
assert.ok(bajaIni >= 0 && bajaFin > bajaIni, 'adaptador de baja disponible');
const baja = logic.slice(bajaIni, bajaFin);
assert.ok(baja.includes('pm11_baja_empleado'), 'baja cloud pasa por RPC');
assert.ok(baja.includes('estado: "inactivo"'), 'fallback local es baja lógica');
assert.doesNotMatch(baja, /\.filter\(\(e22\) => e22\.id !== id\)/, 'no borrado físico de ficha');
assert.doesNotMatch(baja, /setNominas/, 'la baja no elimina nóminas');

// Hijos Personal que siguen dentro de PM11 se persisten por la misma edición SQL.
for (const fn of ['registrarAusencia', 'eliminarAusencia', 'registrarEpi', 'eliminarEpi']) {
  const pos = logic.indexOf(`function ${fn}(`);
  assert.ok(pos >= 0, `${fn} existe`);
  const siguiente = logic.indexOf('\n  function ', pos + 10);
  const bloque = logic.slice(pos, siguiente > pos ? siguiente : logic.length);
  assert.ok(bloque.includes('updateEmpleado('), `${fn} delega en edición autoritativa`);
}

// P06 no improvisó anonimización: en su cierre quedó bloqueada hasta una RPC dedicada.
// Los paquetes posteriores pueden sustituir legítimamente ese bloqueo solo cuando la
// migración P10 existe y el frontend usa explícitamente la RPC autoritativa.
const p10Path = 'supabase/migrations/20260906103000_pm11_anonimizacion_segura_empleado.sql';
if (fs.existsSync(p10Path)) {
  const p10 = fs.readFileSync(p10Path, 'utf8');
  assert.ok(p10.includes('public.pm11_anonimizar_empleado'), 'P10 aporta RPC dedicada de anonimización');
  assert.ok(logic.includes('pm11_anonimizar_empleado'), 'frontend posterior usa RPC dedicada de anonimización');
  assert.doesNotMatch(logic, /La anonimización SQL se habilitará en su operación transaccional específica/);
} else {
  assert.match(logic, /La anonimización SQL se habilitará en su operación transaccional específica/);
}

// Sincronización SQL hacia el estado React, conservando compatibilidad con legados KV.
assert.match(src, /pm11CargarEmpleadosSql\(localActivoId\)/);
assert.match(src, /setEmpleados\(\(actuales\) => pm11FusionarEmpleados\(actuales, resultado\.empleados\)\)/);

// Montaje y UI de ciclo de vida.
const personalIni = src.indexOf('function Personal({');
const personalFin = src.indexOf('\nfunction inicioSemana(', personalIni);
assert.ok(personalIni >= 0 && personalFin > personalIni, 'UI Personal disponible');
const ui = src.slice(personalIni, personalFin);
assert.match(ui, /reactivarEmpleado/);
assert.match(ui, /Dar de baja empleado/);
assert.ok(ui.includes('}, "Dar de baja")'), 'acción Dar de baja visible');
assert.ok(ui.includes('}, "Reactivar")'), 'acción Reactivar visible');
assert.doesNotMatch(ui, /Eliminar del todo/);
assert.doesNotMatch(ui, /Se borra la ficha completa/);

// La UI puede recibir retorno síncrono en modo local o Promise en modo cloud sin
// perder el formulario cuando el backend rechaza la operación.
assert.match(ui, /const resultado = editingId \? updateEmpleado\(editingId, datos\) : addEmpleado\(datos\);/);
assert.match(ui, /const resultadoResuelto = await Promise\.resolve\(resultado\);/);
assert.match(ui, /resultadoResuelto\.ok === false/);

// P05 sigue siendo la autoridad backend del ciclo implementado en P06.
for (const rpc of [
  'public.pm11_alta_empleado',
  'public.pm11_editar_empleado',
  'public.pm11_baja_empleado',
  'public.pm11_reactivar_empleado'
]) assert.ok(migration.includes(rpc), `RPC P05 presente: ${rpc}`);

console.log('PM11 P06 puente frontend SQL Personal: contrato OK');
