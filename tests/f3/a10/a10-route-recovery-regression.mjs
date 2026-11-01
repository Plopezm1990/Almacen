import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsDir = fileURLToPath(new URL('../../../supabase/migrations/', import.meta.url));

async function readLocalMigrations() {
  const names = await readdir(migrationsDir);
  const sqlNames = names.filter((name) => name.endsWith('.sql'));
  return Promise.all(sqlNames.map(async (name) => ({
    name,
    source: await readFile(join(migrationsDir, name), 'utf8'),
  })));
}

test('A10 local canonical migrations no reencolan comandas históricas por trigger', async () => {
  const migrations = await readLocalMigrations();
  const combined = migrations.map(({ source }) => source).join('\n');

  assert.doesNotMatch(combined, /create\s+(?:or\s+replace\s+)?function\s+private\.abc_a10_reencolar_bloqueadas_route/i);
  assert.doesNotMatch(combined, /create\s+(?:or\s+replace\s+)?function\s+private\.abc_a10_reencolar_bloqueadas_por_producto/i);
  assert.doesNotMatch(combined, /create\s+trigger\s+a10_requeue_blocked_routes/i);
  assert.doesNotMatch(combined, /min\(\s*private\.abc_a10_estacion_producto/);
});

test('A10 incluye la reparación idempotente del trigger heredado de QA', async () => {
  const migrations = await readLocalMigrations();
  const repair = migrations.find(({ name }) => name.includes('a10_disable_auto_route_requeue'));
  assert.ok(repair, 'falta la migración correctiva del trigger remoto de QA');
  assert.match(repair.source, /drop\s+trigger\s+if\s+exists\s+a10_requeue_blocked_routes/i);
  assert.match(repair.source, /drop\s+function\s+if\s+exists\s+private\.abc_a10_reencolar_bloqueadas_route\(\)/i);
  assert.match(repair.source, /drop\s+function\s+if\s+exists\s+private\.abc_a10_reencolar_bloqueadas_por_producto\(\s*text\s*,\s*text\s*,\s*text\s*\)/i);
});

test('A10 reemplaza la RPC remota que reencolaba comandas históricas', async () => {
  const migrations = await readLocalMigrations();
  const repair = migrations.find(({ name }) => name.includes('a10_assignment_without_historical_requeue'));
  assert.ok(repair, 'falta la migración correctiva de la RPC A10');
  const definition = repair.source.split(/drop\s+function/i)[0];
  assert.doesNotMatch(definition, /abc_a10_reencolar_bloqueadas\s*\(/i);
  assert.doesNotMatch(repair.source, /v_reencoladas|comandas_reencoladas/i);
  assert.match(repair.source, /create\s+or\s+replace\s+function\s+public\.abc_asignar_producto_estacion/i);
  assert.match(repair.source, /drop\s+function\s+if\s+exists\s+private\.abc_a10_reencolar_bloqueadas\(/i);
});

test('A10 local conserva la política de no reenvío automático en las dos fuentes', async () => {
  const [runtime, recovery] = await Promise.all([
    readFile(new URL('../../../fuente.js', import.meta.url), 'utf8'),
    readFile(new URL('../../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8'),
  ]);

  for (const source of [runtime, recovery]) {
    assert.match(source, /Esta asignación no reenvía automáticamente la comanda existente/);
    assert.match(source, /las comandas bloqueadas existentes no se reenvían automáticamente/);
  }
});

console.log('ABC_F3_A10_ROUTE_RECOVERY_REGRESSION=PASS');
