import assert from 'node:assert/strict';
import fs from 'node:fs';

const doc = fs.readFileSync('docs/plan-maestro/C07_D_PREPARACION_SERIES_HASH_COLA_2026-10-27.md', 'utf8');
const sql = fs.readFileSync('docs/plan-maestro/C07_D_PREFLIGHT_SOLO_LECTURA.sql', 'utf8');

for (const marker of [
  'empresa_id + entidad_fiscal_id',
  'entidad_fiscal_id',
  'abc_c07d_registros_fiscales',
  'abc_c07d_cola_fiscal',
  'DESCONOCIDO',
  'respuesta desconocida',
  'no se llamará a AEAT',
  'abc_configurar_serie_documental',
  'mapeos ambiguos',
]) assert.ok(doc.toLowerCase().includes(marker.toLowerCase()), `falta ${marker}`);

assert.match(sql, /to_regclass\('public\.abc_c05_series_documentales'\)/i);
assert.match(sql, /to_regclass\('public\.abc_c07d_registros_fiscales'\)/i);
assert.match(sql, /has_function_privilege\('anon'/i);
assert.doesNotMatch(sql, /\b(create|alter|drop|insert|update|delete|truncate)\b/i);

console.log('ABC_F5_C07D_PREFLIGHT_CONTRACT=PASS');
