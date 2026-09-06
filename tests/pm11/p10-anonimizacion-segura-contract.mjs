import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260906103000_pm11_anonimizacion_segura_empleado.sql', 'utf8');
const patch = fs.readFileSync('tools/corregir_pm11_p10_anonimizacion.py', 'utf8');

for (const token of [
  'public.pm11_anonimizar_empleado',
  'private.pm11_propietario_puede_gestionar_vinculo',
  "v_empleado.estado <> 'inactivo'",
  'empleado_anonimizacion_requiere_baja',
  "set activo = false",
  'set empleado_id = null',
  'nombre = null',
  "estado = 'anonimizado'",
  'anonimizado_at = v_ahora',
  'historialLaboralConservado',
  'datosIdentificativosEliminados',
  'cuentaAccesoRetirada',
  "'Personal · anonimizar empleado'",
  'yaAnonimizado',
  'grant execute on function public.pm11_anonimizar_empleado(text, text, text)',
  'to authenticated'
]) assert.ok(migration.includes(token), `falta contrato SQL P10: ${token}`);

// La anonimización autoritativa reconstruye datos desde whitelist; no conserva
// directamente colecciones o identificadores personales del JSON heredado.
for (const forbidden of [
  "'dni', v_empleado.datos->'dni'",
  "'email', v_empleado.datos->'email'",
  "'telefono', v_empleado.datos->'telefono'",
  "'direccion', v_empleado.datos->'direccion'",
  "'pin', v_empleado.datos->'pin'",
  "'documentos', v_empleado.datos->'documentos'",
  "'ausencias', v_empleado.datos->'ausencias'",
  "'epis', v_empleado.datos->'epis'"
]) assert.ok(!migration.includes(forbidden), `PII/colección no debe conservarse: ${forbidden}`);

// No puede quedar ejecución anónima expuesta.
assert.match(migration, /revoke all on function public\.pm11_anonimizar_empleado\(text, text, text\)\s+from public, anon;/);

// El frontend cloud usa la nueva RPC; ya no conserva el bloqueo provisional P06.
const logicIni = src.indexOf('function pm11UsarSqlPersonal()');
const logicFin = src.indexOf('function crearLogicaTurnos({', logicIni);
assert.ok(logicIni >= 0 && logicFin > logicIni, 'frontera Personal disponible');
const logic = src.slice(logicIni, logicFin);
const anonIni = logic.indexOf('function anonimizarEmpleado(id)');
const anonFin = logic.indexOf('function registrarAusencia(', anonIni);
assert.ok(anonIni >= 0 && anonFin > anonIni, 'anonimizarEmpleado disponible');
const anon = logic.slice(anonIni, anonFin);
assert.ok(anon.includes('pm11_anonimizar_empleado'), 'frontend cloud llama RPC P10');
assert.ok(anon.includes('e2.activo !== false'), 'frontend exige baja previa');
assert.ok(anon.includes('e2.estado === "anonimizado"'), 'frontend trata estado terminal');
assert.ok(!anon.includes('La anonimización SQL se habilitará'), 'retirado bloqueo provisional P06');

// La UI solo ofrece Anonimizar sobre bajas no anonimizadas y pide confirmación irreversible.
const personalIni = src.indexOf('function Personal({');
const personalFin = src.indexOf('\nfunction inicioSemana(', personalIni);
assert.ok(personalIni >= 0 && personalFin > personalIni, 'UI Personal disponible');
const ui = src.slice(personalIni, personalFin);
assert.ok(ui.includes('"Anonimizar"'), 'acción Anonimizar visible');
assert.ok(ui.includes('e2.activo === false && !e2.anonimizado && e2.estado !== "anonimizado"'), 'acción limitada a baja no anonimizada');
assert.ok(ui.includes('Anonimizar es irreversible.'), 'confirmación irreversible visible');
assert.ok(ui.includes('se retirará su acceso'), 'confirmación informa retirada de cuenta');
assert.ok(ui.includes('await Promise.resolve(anonimizarEmpleado(e2.id))'), 'UI espera resultado async');

// El parche debe ser reproducible e idempotente.
assert.ok(patch.includes("MARCADOR = 'pm11_anonimizar_empleado'"));
assert.ok(patch.includes('Bloque anonimizarEmpleado inesperado'));
assert.ok(patch.includes('Acciones Reactivar/Editar inesperadas'));

console.log('PM11 P10 anonimización segura: contrato OK');
