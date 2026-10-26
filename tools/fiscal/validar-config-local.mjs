// Ejecución desechable del mismo contrato SQL usado por C07 en PostgreSQL 16.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { bootstrapA08 } from '../../tests/f3/a09/local-pglite-bootstrap.mjs';

const root = resolve(import.meta.dirname, '../..');
const db = await bootstrapA08();
try {
  await db.exec(await readFile(resolve(root, 'supabase/migrations/20261026175245_abc_fiscal_multiempresa_borradores.sql'), 'utf8'));
  const results = await db.exec(await readFile(resolve(root, 'tests/f5/c07/fiscal-config-multiempresa.sql'), 'utf8'));
  const checks = results.flatMap(r => r.rows).find(row => row.fiscal_config_checks !== undefined)?.fiscal_config_checks;
  if (!Number.isInteger(checks) || checks < 30) throw new Error('Contrato incompleto');
  console.log(`FISCAL_CONFIG_MULTIEMPRESA_CHECKS=${checks}`);
  console.log('FISCAL_CONFIG_MULTIEMPRESA_LOCAL=PASS');
  console.log('MOTOR=PGlite; PostgreSQL nativo en CI sigue pendiente');
} catch (error) {
  console.error(`FISCAL_CONFIG_MULTIEMPRESA_LOCAL=FAIL ${error.code ?? ''} ${error.message}`);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
} finally {
  await db.close();
}
