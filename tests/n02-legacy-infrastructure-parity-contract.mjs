// N-02 — contrato de paridad para los objetos de infraestructura heredados.
// Verifica que la migración candidata conserva las definiciones medidas en
// producción y que los triggers/event trigger se crean de forma idempotente.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const migration = readFileSync(
  join(repo, 'supabase/migrations/20261110210000_n02_legacy_infrastructure_parity.sql'),
  'utf8'
).replace(/\r\n/g, '\n');

assert.match(migration, /create or replace function public\.actualizar_fecha\(\)[\s\S]*?new\.updated_at\s*=\s*now\(\)/i);
assert.match(migration, /create or replace function public\.actualizar_fecha_perfil\(\)[\s\S]*?new\.updated_at\s*=\s*now\(\)/i);
assert.match(migration, /create or replace function public\.rls_auto_enable\(\)[\s\S]*?returns event_trigger/i);
assert.match(migration, /set search_path to 'pg_catalog'/i);
assert.match(migration, /security definer/i);
assert.match(migration, /create trigger almacen_kv_actualizar_fecha/i);
assert.match(migration, /create trigger perfiles_actualizar_fecha/i);
assert.match(migration, /create event trigger ensure_rls/i);
assert.match(migration, /when tag in \('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO'\)/i);
assert.match(migration, /if not exists \([\s\S]*?pg_event_trigger[\s\S]*?ensure_rls/i);
assert.match(migration, /revoke all on function public\.rls_auto_enable\(\) from public, anon, authenticated, service_role/i);
assert.doesNotMatch(migration, /insert\s+into|update\s+[^\s]+\s+set|delete\s+from/i);

console.log('N02_LEGACY_INFRASTRUCTURE_PARITY_CONTRACT=PASS');
