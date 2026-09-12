import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (ruta) => readFileSync(ruta, 'utf8');
const informe = leer('tests/pm26/P09F_QA_AUTORIZACION_AUDITORIA.md');
const ensayo = leer('tests/pm26/p09f-qa-aislado/ensayo-auditoria-transaccional.sql');
const migracionB3 = leer('supabase/migrations/20260912120000_pm26_p09f_b3_pagos_encargo_operation_id_global.sql');

// P09f-A: conserva intacto el contrato de auditoria transaccional ya cerrado.
assert.match(ensayo, /^begin;/m);
assert.match(ensayo, /on commit drop/i);
assert.match(ensayo, /\nrollback;\s*$/i);
assert.doesNotMatch(ensayo, /\ncommit;/i);
for (const caso of [
  'propietario_mismo_local',
  'empresa_ajena_bloqueada',
  'local_ajeno_bloqueado',
  'sin_sesion_bloqueada'
]) assert.match(ensayo, new RegExp(caso));
for (const marcador of [
  'PM26_P09F_A_QA_AUTORIZACION=PASS',
  'PM26_P09F_A_RESIDUOS=0',
  'No valida todavía las otras doce RPC'
]) assert.ok(informe.includes(marcador), 'Falta evidencia o limite: ' + marcador);

// P09f-B3: pagos_encargo debe entrar en el UNICO ledger global ya existente.
assert.match(migracionB3, /^begin;/m);
assert.match(migracionB3, /\ncommit;\s*$/i);
assert.match(migracionB3, /set local lock_timeout\s*=\s*'5s'/i);
assert.match(migracionB3, /set local statement_timeout\s*=\s*'30s'/i);
assert.match(migracionB3, /to_regclass\('private\.g1_operation_ids_global'\)/i);
assert.match(migracionB3, /to_regprocedure\('private\.g1_claim_operation_id\(\)'\)/i);
assert.match(migracionB3, /lock table public\.pagos_encargo in share row exclusive mode/i);
assert.match(migracionB3, /lock table private\.g1_operation_ids_global in share row exclusive mode/i);
assert.match(migracionB3, /g\.ledger <> 'pagos_encargo'/i);
assert.match(migracionB3, /insert into private\.g1_operation_ids_global\s*\(operation_id,\s*ledger\)/i);
assert.match(migracionB3, /select p\.operation_id, 'pagos_encargo'/i);
assert.match(migracionB3, /left join private\.g1_operation_ids_global/i);
assert.match(migracionB3, /create trigger g1_operation_id_global\s+before insert on public\.pagos_encargo\s+for each row execute function private\.g1_claim_operation_id\(\)/i);
assert.match(migracionB3, /PREFLIGHT_FALLO: operation_id de pagos_encargo ya reclamado por otro ledger/i);
assert.match(migracionB3, /POSTCHECK_FALLO: backfill global incompleto para pagos_encargo/i);
assert.doesNotMatch(migracionB3, /create\s+table\s+(?:if\s+not\s+exists\s+)?private\.g1_operation_ids_global/i);
assert.doesNotMatch(migracionB3, /create\s+(?:or\s+replace\s+)?function\s+private\.g1_claim_operation_id/i);

const prohibidos = /(service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY|[a-z]{20}\.supabase\.co)/i;
assert.equal(prohibidos.test(informe), false);
assert.equal(prohibidos.test(ensayo), false);
assert.equal(prohibidos.test(migracionB3), false);
console.log('PM26_P09F_A_TRANSACCION_REVERSIBLE=PASS');
console.log('PM26_P09F_A_CASOS_AUTORIZACION=PASS');
console.log('PM26_P09F_A_ALCANCE_HONESTO=PASS');
console.log('PM26_P09F_B3_LEDGER_GLOBAL_UNICO=PASS');
console.log('PM26_P09F_B3_PREFLIGHT_COLISION=PASS');
console.log('PM26_P09F_B3_TRIGGER_PAGOS_ENCARGO=PASS');
