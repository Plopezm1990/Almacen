import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ui = await readFile(new URL('../../../pm09-qa-session-smoke-v1.js', import.meta.url), 'utf8');
const sql = await readFile(new URL('./pm09-qa-session-smoke.sql', import.meta.url), 'utf8');

assert.match(ui, /deploy-preview-126--chic-entremet-9107cf\.netlify\.app/);
assert.match(ui, /client\.auth\.getUser\(\)/);
assert.match(ui, /pm09_qa_session_smoke_20261006/);
assert.doesNotMatch(ui, /QA-EMP|QA-A1|QA-CAT|service_role|supabaseUrl/);

assert.match(sql, /v_uid uuid := auth\.uid\(\)/);
assert.match(sql, /abc_f5_pm09_security_hardening/);
assert.match(sql, /registrar_venta_stock_pm09/);
assert.match(sql, /revertir_venta_stock_pm09/);
assert.match(sql, /PM09_QA_SMOKE_PASS_ROLLBACK/);
assert.match(sql, /security invoker/);
assert.match(sql, /revoke all on function public\.pm09_qa_session_smoke_20261006\(\) from public, anon, authenticated, service_role/);
assert.match(sql, /grant execute on function public\.pm09_qa_session_smoke_20261006\(\) to authenticated/);

console.log('PM09_QA_SESSION_SMOKE_CONTRACT=PASS');
