import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = 'supabase/migrations/20260930230000_abc_f4_b09_settlements_disputes.sql';
const sql = fs.readFileSync(path, 'utf8');

for (const table of [
  'abc_b09_liquidaciones',
  'abc_b09_liquidacion_lineas',
  'abc_b09_disputas'
]) {
  assert.match(sql, new RegExp(`create table public\\.${table}\\b`));
}

for (const field of [
  'importe_vendido',
  'importe_cobrado',
  'importe_devuelto',
  'importe_comision',
  'importe_liquidado',
  'provider_account_id',
  'provider_dispute_reference',
  'responsable_user_id',
  'documentacion'
]) {
  assert.match(sql, new RegExp(`\\b${field}\\b`));
}

assert.match(sql, /foreign key \(empresa_id,local_id,pago_id,payment_currency_code\)/);
assert.match(sql, /foreign key \(empresa_id,local_id,pago_id,intento_id,payment_currency_code\)/);
assert.match(sql, /alter table public\.abc_b09_liquidaciones enable row level security/);
assert.match(sql, /alter table public\.abc_b09_liquidacion_lineas enable row level security/);
assert.match(sql, /alter table public\.abc_b09_disputas enable row level security/);
assert.match(sql, /grant all on table public\.abc_b09_disputas to service_role/);
assert.doesNotMatch(sql, /insert into public\.(pagos|pago_intentos|ventas_fiscales)/i);
assert.doesNotMatch(sql, /stock_ubicacion|movimientos_stock|devoluciones_venta|movimientos_caja/i);

console.log('ABC_F4_B09_SCHEMA=PASS');
