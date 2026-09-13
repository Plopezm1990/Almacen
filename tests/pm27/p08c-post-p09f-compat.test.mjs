import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';

const CIERRE_P08B = 'ab1ba8aaaef05ad3908e6c311af3eec9362cf755';
const COMMIT_P09F_B3 = '9185eb8ce03c8439e26abb53b5ae7a5ce4fc7dde';
const MIGRACION_P09F_B3 = 'supabase/migrations/20260912120000_pm26_p09f_b3_pagos_encargo_operation_id_global.sql';
const MIGRACION_C13 = 'supabase/migrations/20260913190500_pm27_c13_security_definer_tenant_guard.sql';
const HARDENING_C13 = 'supabase/migrations/20260913193500_pm27_c13_private_helper_hardening.sql';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

const tocadosSupabase = git(['diff', '--name-only', CIERRE_P08B, '--', 'supabase'])
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

// El contrato historico sigue siendo estricto por defecto. Solo el gate C13,
// que declara PM27_C13_REGRESSION=1, admite ademas las dos migraciones C13
// auditadas por su propio contrato PostgreSQL. No se abre un comodin para
// otras evoluciones bajo supabase/.
const evolucionAutorizada = process.env.PM27_C13_REGRESSION === '1'
  ? [MIGRACION_P09F_B3, MIGRACION_C13, HARDENING_C13]
  : [MIGRACION_P09F_B3];

assert.deepEqual(
  tocadosSupabase,
  evolucionAutorizada,
  process.env.PM27_C13_REGRESSION === '1'
    ? 'desde P08b solo se permiten P09f-B3 y las dos migraciones C13 auditadas bajo supabase/'
    : 'desde P08b, la unica evolucion posterior permitida bajo supabase/ es la migracion P09f-B3 autorizada'
);
assert.ok(fs.existsSync(MIGRACION_P09F_B3), 'debe existir la migracion P09f-B3 esperada');
if (process.env.PM27_C13_REGRESSION === '1') {
  assert.ok(fs.existsSync(MIGRACION_C13), 'debe existir la migracion funcional C13 auditada');
  assert.ok(fs.existsSync(HARDENING_C13), 'debe existir el hardening C13 auditado');
}

const ancestro = spawnSync('git', ['merge-base', '--is-ancestor', COMMIT_P09F_B3, 'HEAD']);
assert.equal(ancestro.status, 0, 'el commit tecnico P09f-B3 debe seguir siendo ancestro del candidato PM27');

const contenidoEnCommit = execFileSync('git', ['show', `${COMMIT_P09F_B3}:${MIGRACION_P09F_B3}`]);
const contenidoActual = fs.readFileSync(MIGRACION_P09F_B3);
assert.ok(
  contenidoActual.equals(contenidoEnCommit),
  'la migracion P09f-B3 debe seguir byte a byte igual al commit tecnico autorizado'
);

console.log('PM27_P08C_POST_P09F_UNICA_EVOLUCION_SUPABASE=PASS');
console.log('PM27_P08C_POST_P09F_MIGRACION_INTACTA=PASS');
