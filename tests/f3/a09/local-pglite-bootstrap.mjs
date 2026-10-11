// Reproducible PostgreSQL 18 WASM bootstrap for the A09 compatibility smoke.
// The CI runner loads the pinned package from tests/f3/a09; this is not a
// substitute for the real PostgreSQL 16/17 contract gate.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageRoot = process.env.A09_PGLITE_PACKAGE_ROOT ??
  join(tmpdir(), 'a09-pglite', 'node_modules', '@electric-sql', 'pglite');
const { PGlite } = require(packageRoot);
const { pgcrypto } = require(join(packageRoot, 'dist', 'contrib', 'pgcrypto.cjs'));
const root = resolve(import.meta.dirname, '../../..');

async function fixture(path) {
  const absolute = resolve(root, path);
  const lines = (await readFile(absolute, 'utf8')).split(/\r?\n/);
  const expanded = [];
  for (const line of lines) {
    const nested = line.match(/^\\ir\s+(.+)$/);
    if (nested) expanded.push(await fixture(resolve(dirname(absolute), nested[1])));
    else if (!line.startsWith('\\set ')) expanded.push(line);
  }
  return expanded.join('\n');
}

const migrations = [
  '20260923210000_abc_f2_m01_base_transaccional_caja.sql',
  '20260923210100_abc_f2_m01b_acl_hardening.sql',
  '20260923220000_abc_f2_m02a_core_comercial_fiscal.sql',
  '20260923230000_abc_f2_m02b_pagos_reservas_reembolsos.sql',
  '20260923233000_abc_f2_m03a_autoridad_transaccional.sql',
  '20260923234500_abc_f2_m03b_checkout_cobro.sql',
  '20260923235900_abc_f2_m03c_reembolsos_transaccionales.sql',
  '20260924001000_abc_f2_m04a_caja_sesiones.sql',
  '20260924002000_abc_f2_m04b_movimientos_caja.sql',
  '20260924003000_abc_f2_m04c_outbox_persistente.sql',
  '20260924004000_abc_f2_m04d_acl_parity.sql',
  '20260924010000_abc_f3_a03_server_authority.sql',
  '20260924020000_abc_f3_a04_variants_modifiers.sql',
  '20260924030000_abc_f3_a05_order_state_machine.sql',
  '20260924040000_abc_f3_a06_account_recovery.sql',
  '20260924050000_abc_f3_a07_tables_zones.sql',
  '20260924060000_abc_f3_a08_account_split_merge.sql',
];

export async function bootstrapA08({ verbose = false } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(await fixture('tests/f3/a08/fixture-a08.sql'));
    for (const migration of migrations) {
      await db.exec(await readFile(resolve(root, 'supabase/migrations', migration), 'utf8'));
      if (verbose) process.stdout.write(`PASS ${migration}\n`);
    }
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const db = await bootstrapA08({ verbose: true });
    process.stdout.write('A08_SCHEMA_BOOTSTRAP=PASS\n');
    await db.close();
  } catch (error) {
    process.stderr.write(`A08_SCHEMA_BOOTSTRAP=FAIL ${error.message}\n`);
    process.exitCode = 1;
  }
}
