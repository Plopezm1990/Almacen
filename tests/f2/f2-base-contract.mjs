import fs from 'node:fs';
import assert from 'node:assert/strict';

const contract = fs.readFileSync('docs/plan-abc/F2_1_BASE_TRANSACCIONAL_CONTRATO_2026-10-01.md', 'utf8');

for (const term of [
  'operation_id', 'resultado externo desconocido', 'efectos pendientes', 'RLS',
  'user_metadata', 'service_role', 'security_invoker', 'Data API',
  'Orden de una operación protegida', 'Puerta de aplicación', 'QA o PROD',
]) {
  assert.match(contract, new RegExp(term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i'), `F2 falta ${term}`);
}

assert.match(contract, /CANDIDATO_DOCUMENTAL_NO_APLICADO/);
assert.match(contract, /no se crea migration SQL/i);
assert.match(contract, /no se usa `db push`/i);
assert.match(contract, /no se conecta a\s+QA\/PROD/i);
assert.match(contract, /no se hace deploy de Netlify/i);

console.log('ABC_F2_BASE_CONTRACT=PASS');
