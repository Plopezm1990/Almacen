import fs from 'node:fs';
import assert from 'node:assert/strict';

const doc = fs.readFileSync('docs/plan-abc/F5_C03_CONTRATO_ARQUEO_SERVIDOR_2026-10-01.md', 'utf8');
const pm08 = fs.readFileSync('supabase/migrations/20260904204500_pm08_caja_devolucion_indivisible.sql', 'utf8');
const pm09 = fs.readFileSync('supabase/migrations/20260905105500_pm09_conciliacion_caja.sql', 'utf8');

for (const term of [
  'Cálculo autoritativo',
  'efectivo_esperado',
  'efectivo_contado',
  'diferencia',
  'Identidad y estados',
  'operation_id',
  'replay',
  'Concurrencia',
  'Anulación',
  'Fuera de alcance',
]) {
  assert.match(doc, new RegExp(term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i'), `C03 falta ${term}`);
}
assert.match(doc, /CONTRATO_C03_PREPARADO_NO_APLICADO/);
assert.match(doc, /no aplica migraciones/i);
assert.match(doc, /no se permite “todos los locales”/i);

for (const source of [pm08, pm09]) {
  assert.match(source, /registrar_arqueo_caja/);
  assert.match(source, /operation_id/);
  assert.match(source, /efectivo_esperado/);
  assert.match(source, /diferencia/);
}
assert.match(pm08, /diferencia\s*=\s*efectivo_contado\s*-\s*efectivo_esperado/i);
assert.match(pm08, /where estado\s*=\s*'ACTIVO'/i);
assert.match(pm09, /return jsonb_build_object\('ok',true,'replayed',true/i);
assert.match(pm09, /from public\.caja_operaciones/i);

console.log('ABC_F5_C03_CASH_CONTRACT=PASS');
