import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (ruta) => readFileSync(ruta, 'utf8');
const informe = leer('tests/pm26/P09F_QA_AUTORIZACION_AUDITORIA.md');
const ensayo = leer('tests/pm26/p09f-qa-aislado/ensayo-auditoria-transaccional.sql');

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

const prohibidos = /(service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY|[a-z]{20}\.supabase\.co)/i;
assert.equal(prohibidos.test(informe), false);
assert.equal(prohibidos.test(ensayo), false);
console.log('PM26_P09F_A_TRANSACCION_REVERSIBLE=PASS');
console.log('PM26_P09F_A_CASOS_AUTORIZACION=PASS');
console.log('PM26_P09F_A_ALCANCE_HONESTO=PASS');
