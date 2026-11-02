import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('fuente.js', 'utf8');
const recovered = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261102120000_abc_f4_b08_separar_devolucion_reembolso.sql', 'utf8');

for (const text of [source, recovered]) {
  assert.match(text, /Los reembolsos econ.{0,8}micos deben tramitarse desde la vista Reembolso econ.{0,8}mico con un pago confirmado/);
  assert.match(text, /La devoluci.{0,8}n f.{0,8}sica no mueve dinero/);
  assert.match(text, /La devoluci.{0,8}n f.{0,8}sica ajusta el stock; el reembolso econ.{0,8}mico se solicita por separado sobre un pago confirmado/);
  assert.doesNotMatch(text, /Stock y reembolso se confirman juntos/);
  assert.match(text, /Reembolso econ.{0,8}mico/);
}

const refundFunctionStart = source.indexOf('async function registrarDevolucionCliente');
const refundFunctionEnd = source.indexOf('async function registrarDevolucionProveedor', refundFunctionStart);
assert.ok(refundFunctionStart >= 0 && refundFunctionEnd > refundFunctionStart, 'No se delimitó registrarDevolucionCliente');
const refundFunction = source.slice(refundFunctionStart, refundFunctionEnd);
assert.match(refundFunction, /if \(reembolsoNum > 0\) return \{ ok: false/);

assert.match(migration, /revoke all on function public\.registrar_devolucion_venta\([\s\S]*?\) from authenticated, service_role;/);
assert.match(migration, /p_reembolso is not null and p_reembolso <> 0/);
assert.match(migration, /reembolso_devolucion_separado/);
assert.match(migration, /p_cantidad,0,'SIN_REEMBOLSO'/);
assert.match(migration, /grant execute on function public\.registrar_devolucion_venta_pm09/);

const sourceBody = source.slice(source.indexOf('var C2 = {'));
const runtimeBody = recovered.slice(recovered.indexOf('var C2 = {'));
assert.equal(runtimeBody, sourceBody, 'fuente.js y fuente recuperada deben seguir materializados');

console.log('ABC_F4_B08_PHYSICAL_REFUND_SEPARATION=PASS');
