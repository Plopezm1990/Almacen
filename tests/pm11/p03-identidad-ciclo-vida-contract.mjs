import fs from 'node:fs';
import assert from 'node:assert/strict';

const contrato = fs.readFileSync('tests/pm11/P03_CONTRATO_IDENTIDAD_CICLO_VIDA_PERSONAL.md', 'utf8');
const mapa = fs.readFileSync('tests/pm11/P02_MAPA_PERSONAL_ACTUAL.md', 'utf8');
const src = fs.readFileSync('fuente.js', 'utf8');

// P03 congela arquitectura y semántica; no implementa todavía tabla/RLS/RPC.
for (const marker of [
  'PM11_P03_CONTRATO_IDENTIDAD_CICLO_VIDA=PASS',
  'SIGUIENTE=PM11_P04_ENTIDAD_SQL_EMPLEADOS_RLS',
  '`public.empleados`',
  '`activo`',
  '`inactivo`',
  '`anonimizado`',
  '`Todos los locales` nunca es un `local_id` válido para mutaciones.',
  'empresa_id` es inmutable',
  'baja lógica',
  'Un empleado no puede estar vinculado a dos usuarios de acceso.',
  'auth.users.user_id ↔ perfiles.user_id ↔ perfiles.empleado_id ↔ empleados.id',
  'La creación de cuenta por Encargado queda denegada por defecto',
  'Fichajes, turnos y nóminas permanecen fuera de PM11',
  'P03 no implementa:'
]) {
  assert.ok(contrato.includes(marker), `contrato P03 incompleto: ${marker}`);
}

// El P03 debe partir explícitamente de los huecos mapeados en P02.
for (const marker of [
  'No existe en QA una tabla `empleados` dedicada.',
  '`perfiles.empleado_id` no tiene integridad referencial',
  'El borrado físico actual entra en tensión con trazabilidad histórica'
]) {
  assert.ok(mapa.includes(marker), `P02 ya no contiene precondición requerida: ${marker}`);
}

// Fronteras funcionales heredadas que P03 no debe borrar ni renombrar todavía.
for (const marker of [
  'function validarEmpleadoPM10(',
  'function crearLogicaPersonal({',
  'function addEmpleado(',
  'function updateEmpleado(',
  'function deleteEmpleado(',
  'function anonimizarEmpleado(',
  'function crearLogicaTurnos({'
]) {
  assert.ok(src.includes(marker), `frontera heredada ausente: ${marker}`);
}

assert.ok(fs.existsSync('tests/pm10/p07-personal-contract.mjs'), 'debe conservarse LA-017');
assert.ok(fs.existsSync('tests/pm11/p02-mapa-personal-contract.mjs'), 'debe conservarse P02');
assert.ok(fs.existsSync('tests/pm11/p01-checkpoint-contract.mjs'), 'debe conservarse P01');

console.log('PM11 P03 identidad/ciclo de vida: contrato OK');
