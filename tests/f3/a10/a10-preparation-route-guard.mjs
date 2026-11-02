import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../../supabase/migrations/20261102100000_abc_f3_a10c_preparation_route_guard.sql', import.meta.url);

test('A10C clasifica productos y valida rutas antes de cambiar el pedido', async () => {
  const migration = await readFile(migrationPath, 'utf8');
  assert.match(migration, /add column if not exists requiere_preparacion boolean/i);
  assert.match(migration, /private\.abc_a10_validar_rutas_envio\(/i);
  assert.match(migration, /producto_preparacion_clasificacion_pendiente/i);
  assert.match(migration, /producto_preparacion_sin_ruta/i);
  assert.match(
    migration,
    /perform private\.abc_a10_validar_rutas_envio\([\s\S]*?insert into public\.pedido_linea_transiciones/i,
  );
});

test('A10C evita comandas artificiales para entrega directa', async () => {
  const migration = await readFile(migrationPath, 'utf8');
  assert.match(migration, /abc_a10_producto_requiere_preparacion/i);
  assert.match(
    migration,
    /abc_a10_producto_requiere_preparacion\([\s\S]*?\) is true/i,
  );
  assert.match(migration, /directas completan A05 sin crear una comanda artificial/i);
});

test('A10C expone mensajes accionables en las dos fuentes del TPV', async () => {
  const [runtime, recovery] = await Promise.all([
    readFile(new URL('../../../fuente.js', import.meta.url), 'utf8'),
    readFile(new URL('../../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8'),
  ]);
  for (const source of [runtime, recovery]) {
    assert.match(source, /producto_preparacion_clasificacion_pendiente/);
    assert.match(source, /productos sin clasificar como preparación o entrega directa/);
    assert.match(source, /producto_preparacion_sin_ruta/);
    assert.match(source, /requiere preparación pero no tiene una ruta activa/);
  }
});

console.log('ABC_F3_A10C_PREPARATION_ROUTE_GUARD=PASS');
