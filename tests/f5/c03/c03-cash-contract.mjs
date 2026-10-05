import fs from 'node:fs';
import assert from 'node:assert/strict';

const doc = fs.readFileSync('docs/plan-abc/F5_C03_CONTRATO_ARQUEO_SERVIDOR_2026-10-01.md', 'utf8');
const pm08 = fs.readFileSync('supabase/migrations/20260904204500_pm08_caja_devolucion_indivisible.sql', 'utf8');
const pm09 = fs.readFileSync('supabase/migrations/20260905105500_pm09_conciliacion_caja.sql', 'utf8');
const c03 = fs.readFileSync('supabase/migrations/20261005160403_abc_f5_c03_arqueo_sesion.sql', 'utf8');
const cliente = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8');
const bundle = fs.readFileSync('fuente.js', 'utf8');

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

for (const source of [c03]) {
  assert.match(source, /security definer\s+set search_path=''/i);
  assert.match(source, /auth\.uid\(\) is null/i);
  assert.match(source, /abc_tiene_capacidad\(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR'\)/i);
  assert.match(source, /st\.session_id=p_session_id and st\.terminal_id=p_terminal_id/i);
  assert.match(source, /co\.session_id=p_session_id/i);
  assert.match(source, /co\.categoria='FONDO_INICIAL'/i);
  assert.match(source, /v_fondo\+v_entradas-v_salidas/i);
  assert.match(source, /revoke all on function public\.abc_previsualizar_arqueo_caja\(text,text,uuid,uuid,text\)[\s\S]*?from public,anon,authenticated,service_role;/i);
  assert.match(source, /grant execute on function public\.abc_previsualizar_arqueo_caja\(text,text,uuid,uuid,text\)[\s\S]*?to authenticated;/i);
}
for (const source of [cliente, bundle]) {
  assert.match(source, /rpc\("abc_previsualizar_arqueo_caja"/);
  assert.match(source, /Esperado por el servidor/);
  assert.doesNotMatch(source, /p_efectivo_esperado:/);
}

console.log('ABC_F5_C03_CASH_CONTRACT=PASS');
