import fs from 'node:fs';
import assert from 'node:assert/strict';

const path = 'supabase/migrations/20260907205000_pm13_p03_fichajes_seguros.sql';
const sql = fs.readFileSync(path, 'utf8');

assert.match(sql, /to_regclass\('public\.fichajes_registro'\)/, 'reutiliza tabla existente');
assert.doesNotMatch(sql, /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.fichajes_registro/i, 'no crea segunda tabla de fichajes');
assert.doesNotMatch(sql, /DELETE\s+FROM\s+public\.fichajes_registro/i, 'no borra fichajes históricos');
assert.doesNotMatch(sql, /DROP\s+TABLE/i, 'sin drop de tabla');

for (const fn of ['pm13_fichar', 'pm13_fichaje_manual', 'pm13_corregir_fichaje', 'pm13_anular_fichaje']) {
  assert.match(sql, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`));
}
assert.match(sql, /CREATE OR REPLACE FUNCTION private\.pm13_fichaje_actor_es_empleado/);
assert.match(sql, /CREATE OR REPLACE FUNCTION private\.pm13_fichaje_secuencia_valida/);

const securityDefiners = [...sql.matchAll(/SECURITY DEFINER\s*\nSET search_path = ''/g)].length;
assert.ok(securityDefiners >= 6, `todas las funciones P03 fijan search_path seguro (${securityDefiners})`);
assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\('pm13:fichaje:' \|\| v_emp\.id, 0\)\)/, 'serializa por empleado');
assert.match(sql, /pm13_fichajes_operation_id_empleado_uq/, 'operationId indexado');
assert.match(sql, /datos->>'operationId'/, 'replay sobre operationId existente');
assert.match(sql, /RETURN jsonb_build_object\('ok', true, 'replay', true/, 'replay explícito');

assert.match(sql, /DROP POLICY IF EXISTS qa_authenticated_fichajes/, 'retira RLS permisiva previa');
assert.match(sql, /CREATE POLICY pm13_fichajes_select_scope/);
assert.match(sql, /FOR SELECT\s*\nTO authenticated/);
assert.match(sql, /REVOKE ALL ON TABLE public\.fichajes_registro FROM anon/);
assert.match(sql, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.fichajes_registro FROM authenticated/);
assert.match(sql, /GRANT SELECT ON TABLE public\.fichajes_registro TO authenticated/);

for (const fn of ['pm13_fichar\(text,text,text,text\)', 'pm13_fichaje_manual\(text,text,date,text,text,text,text\)', 'pm13_corregir_fichaje\(text,date,text,text,text,text\)', 'pm13_anular_fichaje\(text,text,text\)']) {
  assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn.replace(/[()]/g, (m) => '\\' + m)} FROM PUBLIC, anon`));
}
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.pm13_fichar\(text,text,text,text\) TO authenticated/);

assert.match(sql, /private\.la_usuario_activo\(\)/);
assert.match(sql, /private\.pm11_puede_mutar_personal/);
assert.match(sql, /private\.pm11_puede_ver_personal/);
assert.match(sql, /private\.pm11_auditar_empleado/);
assert.match(sql, /v_emp\.estado <> 'activo'/, 'solo empleado activo');
assert.match(sql, /p_tipo NOT IN \('entrada', 'salida'\)/, 'tipo cerrado');
assert.match(sql, /p_hora !~ '\^\(\[01\]\\d\|2\[0-3\]\):\[0-5\]\\d\$'/, 'hora validada');
assert.match(sql, /p_fecha > current_date/, 'manual futuro bloqueado');
assert.match(sql, /FICHAJE_SECUENCIA_INVALIDA/);

assert.match(sql, /'original', v_original/);
assert.match(sql, /'historialCorrecciones', v_historial/);
assert.match(sql, /'anulado', true/);
assert.match(sql, /FICHAJE_ANULACION_ROMPE_SECUENCIA/);
assert.doesNotMatch(sql, /service_role|SUPABASE_SERVICE_ROLE_KEY|sb_secret_/i);

console.log('PM13_P03_FICHAJES_BACKEND=PASS');
console.log('TABLA_EXISTENTE_SIN_BORRADO=1');
console.log('RLS_LECTURA_SCOPE_RPC_MUTACION=1');
console.log('LOCK_REPLAY_SECUENCIA=1');
console.log('CORRECCION_ANULACION_TRAZABLE=1');
