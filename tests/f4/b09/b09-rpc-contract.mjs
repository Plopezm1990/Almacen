import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = 'supabase/migrations/20260930233000_abc_f4_b09_import_resolution.sql';
const sql = fs.readFileSync(path, 'utf8');

for (const fn of [
  'abc_b09_importar_liquidacion',
  'abc_b09_vincular_linea',
  'abc_b09_resolver_disputa'
]) assert.match(sql, new RegExp(`create function public\\.${fn}\\b`));

assert.match(sql, /create table public\.abc_b09_operaciones/);
assert.match(sql, /private\.abc_b09_requerir_service_role/);
assert.match(sql, /grant execute on function public\.abc_b09_importar_liquidacion[\s\S]*to service_role/);
assert.match(sql, /grant execute on function public\.abc_b09_vincular_linea[\s\S]*to service_role/);
assert.match(sql, /grant execute on function public\.abc_b09_resolver_disputa[\s\S]*to service_role/);
assert.match(sql, /revoke all on function public\.abc_b09_importar_liquidacion[\s\S]*from public,anon,authenticated,service_role/);
assert.match(sql, /private\.abc_b09_iniciar_operacion/);
assert.match(sql, /private\.abc_b09_completar_operacion/);
assert.match(sql, /from public\.pagos/);
assert.match(sql, /from public\.pago_intentos/);
assert.match(sql, /update public\.abc_b09_liquidacion_lineas/);
assert.match(sql, /update public\.abc_b09_disputas/);
assert.doesNotMatch(sql, /insert into public\.(pagos|pago_intentos|ventas_fiscales|caja_operaciones)/i);
assert.doesNotMatch(sql, /insert into public\.movimientos_stock/i);
assert.doesNotMatch(sql, /\bpan\b|\bcvv\b|\bcvc\b|secret_value/i);

console.log('ABC_F4_B09_RPC=PASS');
