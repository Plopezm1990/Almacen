import fs from 'node:fs';
import assert from 'node:assert/strict';

const files = {
  migrationTodos: 'supabase/migrations/20260905183353_g1_p05_bloquear_todos_locales_mutacion.sql',
  migrationAnon: 'supabase/migrations/20260905183514_g1_p05_restringir_rpc_stock_anon.sql',
  evidence: 'tests/g1/P05_PERMISOS_AISLAMIENTO_EVIDENCIA.md',
  decisions: 'docs/plan-maestro/PM03_CONTRATOS_MINIMOS_PROPUESTA.md',
  pm05: 'docs/plan-maestro/PM05_EVIDENCIA.md',
  pm09: 'tests/pm09/P16_AISLAMIENTO_CONTEXTO_EVIDENCIA.json'
};

for (const path of Object.values(files)) {
  assert.equal(fs.existsSync(path), true, `Falta archivo requerido: ${path}`);
}

const migrationTodos = fs.readFileSync(files.migrationTodos, 'utf8');
const migrationAnon = fs.readFileSync(files.migrationAnon, 'utf8');
const evidence = fs.readFileSync(files.evidence, 'utf8');
const decisions = fs.readFileSync(files.decisions, 'utf8');
const pm05 = fs.readFileSync(files.pm05, 'utf8');
const pm09 = fs.readFileSync(files.pm09, 'utf8');

const checks = {
  todos_bloqueado_en_helper: migrationTodos.includes("upper(btrim(p_local)) <> 'TODOS'")
    && migrationTodos.includes("nullif(btrim(p_local), '') is not null")
    && migrationTodos.includes('m.todos_locales = true or m.local_id = p_local'),
  anon_revocado_carrito: /revoke\s+execute\s+on\s+function\s+public\.registrar_venta_stock_carrito/i.test(migrationAnon),
  anon_revocado_traslado: /revoke\s+execute\s+on\s+function\s+public\.trasladar_stock_entre_locales/i.test(migrationAnon),
  authenticated_no_revocado: !/from\s+authenticated/i.test(migrationAnon),
  dec01_todos_solo_lectura: decisions.includes('**Todos los locales**')
    && decisions.includes('Solo lectura consolidada dentro de la empresa activa')
    && decisions.includes('Toda mutación exige un local destino explícito.'),
  dec01_local_inactivo: decisions.includes('**Local inactivo/cerrado**')
    && decisions.includes('No admite nuevas operaciones ordinarias.'),
  historial_pm05_aislamiento: pm05.includes('18/18 PASS · 0 fallos')
    && pm05.includes('A1 no ve A2/B1'),
  historial_pm09_todos: pm09.includes('todosLocalesComoDestinoMutacion')
    && pm09.includes('Todos los locales consolida lectura dentro de la empresa activa; las mutaciones requieren un local real y explícito.'),
  evidencia_hallazgo_y_fix: evidence.includes('Resultado inicial: **la RPC aceptó la operación**')
    && evidence.includes('`contexto_no_autorizado`')
    && evidence.includes('`42501` RLS'),
  evidencia_anon: evidence.includes('anon_exec=false')
    && evidence.includes('auth_exec=true'),
  evidencia_limpieza: ['caja_operaciones', 'almacen_kv', 'stock_operaciones', 'devoluciones_venta']
    .every((name) => evidence.includes('- `' + name + '` with prefijo') || evidence.includes('- `' + name + '` con prefijo')),
  decision_explicita: evidence.includes('G1_P05_PERMISOS_AISLAMIENTO=PASS')
    && evidence.includes('SIGUIENTE=G1.6_CIFRAS_CONCILIACIONES')
};

for (const [name, passed] of Object.entries(checks)) {
  console.log(`G1_P05_${name.toUpperCase()}=${passed ? 1 : 0}`);
  if (!passed) process.exitCode = 1;
}

if (process.exitCode) throw new Error('G1_P05_PERMISOS_AISLAMIENTO_CONTRACT_FAIL');
console.log(`G1_P05_CHECKS=${Object.keys(checks).length}`);
console.log('G1_P05_PERMISOS_AISLAMIENTO_CONTRACT_OK=1');
