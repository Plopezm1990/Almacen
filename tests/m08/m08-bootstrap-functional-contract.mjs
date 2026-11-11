// M-08: reproducción local aislada del bootstrap de instalación.
// No toca QA ni producción. Usa PGlite PostgreSQL 18 WASM como apoyo local;
// la evidencia de PostgreSQL 16/QA sigue siendo necesaria para cerrar el
// hallazgo de entorno.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const packageRoot = process.env.A09_PGLITE_PACKAGE_ROOT ??
  resolve(tmpdir(), 'a09-pglite', 'node_modules', '@electric-sql', 'pglite');
const { PGlite } = require(packageRoot);
const { pgcrypto } = require(resolve(packageRoot, 'dist', 'contrib', 'pgcrypto.cjs'));
const root = resolve(import.meta.dirname, '../..');

async function expandPsql(path) {
  const absolute = resolve(root, path);
  const lines = (await readFile(absolute, 'utf8')).split(/\r?\n/);
  const expanded = [];
  for (const line of lines) {
    const nested = line.match(/^\\ir\s+(.+)$/);
    if (nested) expanded.push(await expandPsql(resolve(dirname(absolute), nested[1])));
    else if (!line.startsWith('\\set ')) expanded.push(line);
  }
  return expanded.join('\n');
}

const db = new PGlite({ extensions: { pgcrypto } });
try {
  await db.exec(await expandPsql('tests/bootstrap-owner-post-reset.sql'));

  const rows = (await db.query(`select
    (select count(*)::int from public.empresas) as empresas,
    (select count(*)::int from public.locales) as locales,
    (select count(*)::int from public.membresias_usuario) as membresias,
    (select public.obtener_estado_instalacion()->>'state') as estado`)).rows[0];
  assert.deepEqual(rows, { empresas: 0, locales: 0, membresias: 0, estado: 'needs_setup' },
    'el script local debe terminar con la limpieza de atomicidad aplicada');

  process.stdout.write('M08_BOOTSTRAP_LOCAL_FUNCTIONAL=PASS\n');
} catch (error) {
  process.stderr.write(`M08_BOOTSTRAP_LOCAL_FUNCTIONAL=FAIL ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await db.close();
}
