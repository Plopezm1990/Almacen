import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPaths = [
  new URL(
    '../../../supabase/migrations/20261022140000_abc_f3_a10_route_recovery.sql',
    import.meta.url,
  ),
  new URL(
    '../../../supabase/migrations/20261022150000_abc_f3_a10_route_recovery_merge.sql',
    import.meta.url,
  ),
];

const loadMigrations = async () => (
  await Promise.all(migrationPaths.map((path) => readFile(path, 'utf8')))
).join('\n');

test('A10 reencamina solo comandas bloqueadas completas del producto reparado', async () => {
  const migration = await loadMigrations();

  assert.match(migration, /private\.abc_a10_reencolar_bloqueadas/);
  assert.match(migration, /c\.estado='BLOQUEADA'/);
  assert.match(migration, /c\.route_key='SIN_RUTA'/);
  assert.match(migration, /c\.estacion_id is null/);
  assert.match(migration, /cl\.producto_id=p_producto_id/);
  assert.match(migration, /count\(\*\) filter/);
  assert.match(migration, /estado='PENDIENTE'/);
  assert.match(migration, /route_key=p_estacion_id::text/);
  assert.match(migration, /private\.abc_a10_encolar_comanda\(v_comanda_id\)/);
  assert.match(migration, /comandas_reencoladas/);
});

test('A10 fusiona con la comanda destino sin crear un duplicado de ruta', async () => {
  const migration = await loadMigrations();

  assert.match(migration, /v_destino_id/);
  assert.match(migration, /route_key=p_estacion_id::text/);
  assert.match(migration, /update public\.comanda_lineas/);
  assert.match(migration, /delete from public\.comandas_preparacion/);
  assert.match(migration, /dedupe_key='comanda:'\|\|v_destino_id::text/);
  assert.match(migration, /estado in \('PENDIENTE','ERROR'\)/);
  assert.match(migration, /estado='PENDIENTE'/);
});

test('A10 mantiene la protección de la RPC de configuración', async () => {
  const migration = await loadMigrations();

  assert.match(migration, /comanda_configurar_no_autorizado/);
  assert.match(migration, /terminal_sesion_no_operativa/);
  assert.match(migration, /grant execute on function public\.abc_asignar_producto_estacion/);
  assert.doesNotMatch(migration, /grant execute on function private\.abc_a10_reencolar_bloqueadas/);
});
