import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM21 P02: confirma que las dos correcciones autorizadas (movimientos_registro,
// Storage qa-pruebas) están trackeadas en el repositorio con el contenido real que se
// aplicó en QA -- no solo aplicadas de forma efímera contra el proyecto.

const migMovimientos = 'supabase/migrations/20260908210800_pm21_p01_movimientos_registro_aislamiento.sql';
const migStorage = 'supabase/migrations/20260908210900_pm21_p01_storage_qa_pruebas_aislamiento.sql';

assert.ok(fs.existsSync(migMovimientos), 'migración de movimientos_registro trackeada');
assert.ok(fs.existsSync(migStorage), 'migración de storage trackeada');

const sqlMovimientos = fs.readFileSync(migMovimientos, 'utf8');
assert.match(sqlMovimientos, /add column if not exists empresa_id text/);
assert.match(sqlMovimientos, /add column if not exists local_id text/);
assert.match(sqlMovimientos, /drop policy if exists qa_authenticated_movimientos/);
assert.match(sqlMovimientos, /create policy movimientos_registro_select/);
assert.match(sqlMovimientos, /private\.la_tiene_empresa\(empresa_id\)/);
assert.match(sqlMovimientos, /QA-MOV-A1-INIT/);
assert.match(sqlMovimientos, /QA-MOV-A2-INIT/);
assert.match(sqlMovimientos, /QA-MOV-B1-INIT/);
// Sin política de escritura para clientes: solo debe existir la policy de SELECT.
assert.doesNotMatch(sqlMovimientos, /create policy .*for insert/i);
assert.doesNotMatch(sqlMovimientos, /create policy .*for update/i);
assert.doesNotMatch(sqlMovimientos, /create policy .*for delete/i);
console.log('PM21_P02_MIGRACION_MOVIMIENTOS_REGISTRO_VERIFICADA=PASS');

const sqlStorage = fs.readFileSync(migStorage, 'utf8');
for (const politica of ['qa_storage_authenticated_delete', 'qa_storage_authenticated_insert', 'qa_storage_authenticated_read', 'qa_storage_authenticated_update']) {
  assert.match(sqlStorage, new RegExp('drop policy if exists ' + politica));
}
for (const nueva of ['qa_storage_empresa_select', 'qa_storage_empresa_insert', 'qa_storage_empresa_update', 'qa_storage_empresa_delete']) {
  assert.match(sqlStorage, new RegExp('create policy ' + nueva));
}
// Las 4 políticas nuevas deben exigir pertenencia a la empresa del primer segmento de ruta.
const ocurrencias = sqlStorage.match(/private\.la_tiene_empresa\(\(storage\.foldername\(name\)\)\[1\]\)/g) || [];
assert.ok(ocurrencias.length >= 4, 'las 4 políticas deben exigir la empresa del primer segmento de ruta');
console.log('PM21_P02_MIGRACION_STORAGE_VERIFICADA=PASS');

// No debe publicarse ningún ref/host de Supabase ni claves en ninguno de los dos artefactos.
const doc = fs.readFileSync('tests/pm21/P02_CIERRE_MOVIMIENTOS_REGISTRO_STORAGE.md', 'utf8');
for (const secreto of [/[a-z]{20}\.supabase\.co/i, /service_role_key/i, /SUPABASE_SERVICE_ROLE_KEY/, /sb_secret_/i, /qjqorixtkilwsndqayyx/, /flqercbgpgmmfaakrwkc/, /cqtghwiuxrqrxupyonqf/]) {
  assert.doesNotMatch(sqlMovimientos + sqlStorage + doc, secreto, 'no debe publicarse un identificador interno o secreto: ' + secreto);
}
console.log('PM21_P02_SIN_SECRETOS=PASS');

console.log('PM21 P02 — correcciones autorizadas (movimientos_registro, Storage) trackeadas y verificadas: contrato OK');
