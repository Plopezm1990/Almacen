import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20261109170000_a03_appcc_cancelacion_append_only.sql', 'utf8').toLowerCase();
const runtime = readFileSync('fuente.js', 'utf8');
const recovered = readFileSync('source-recovery/fuente-recuperado.js', 'utf8');
const bridge = readFileSync('appcc-authority-storage-bridge.js', 'utf8');

for (const fragment of [
  'create table if not exists public.appcc_lectura_cancelaciones',
  'lectura_id uuid not null unique references public.appcc_lecturas(id)',
  'alter table public.appcc_lectura_cancelaciones enable row level security',
  'revoke all on table public.appcc_lectura_cancelaciones',
  'appcc_cancelar_lectura',
  'auth.uid()',
  'select p.empleado_id, p.nombre',
  'on conflict (id) do nothing'
]) assert.ok(migration.includes(fragment), `falta contrato de cancelación APPCC: ${fragment}`);

for (const source of [runtime, recovered]) {
  assert.match(source, /appcc_cancelar_lectura/, 'la cancelación debe ir por RPC');
  assert.match(source, /appcc_cancelacion_rpc_error/, 'la UI debe propagar el error remoto de cancelación');
}
assert.match(bridge, /appcc_lectura_cancelaciones/, 'la lectura del historial debe incorporar cancelaciones');

console.log('A03_A04_APPCC_CANCELACION_APPEND_ONLY_CONTRACT=PASS');
