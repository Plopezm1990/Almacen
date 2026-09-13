import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function git(args, { allowFailure = false } = {}) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  if (!allowFailure) {
    assert.equal(r.status, 0, `git ${args.join(' ')} falló: ${r.stderr}`);
  }
  return r;
}

// PM27: P05b es un contrato histórico de preparación que exigía
// release === main. Ese invariante dejó de ser válido cuando el hotfix
// del Defecto L fue autorizado y aplicado posteriormente en release.
// Este test NO mueve ninguna rama: verifica que la divergencia actual
// siga siendo un fast-forward controlado y limitado al hotfix conocido.

git(['fetch', 'origin', 'main', 'release', '--quiet']);

const shaMain = git(['rev-parse', 'origin/main']).stdout.trim();
const shaRelease = git(['rev-parse', 'origin/release']).stdout.trim();
assert.notEqual(shaRelease, shaMain, 'PM27 espera que release conserve el hotfix autorizado posterior a P05b');

const ancestro = git(['merge-base', '--is-ancestor', 'origin/main', 'origin/release'], { allowFailure: true });
assert.equal(ancestro.status, 0, 'release debe ser un fast-forward de main; no se admite historia divergente');

const commitsAdicionales = Number(git(['rev-list', '--count', 'origin/main..origin/release']).stdout.trim());
assert.equal(commitsAdicionales, 2, 'release debe contener exactamente los dos commits autorizados del hotfix posterior a PM26 P05b');

const archivosEsperados = [
  '.github/workflows/pm26-defecto-l-hotfix.yml',
  'fuente.js',
  'reset-pruebas-preview.js',
  'source-recovery/fuente-recuperado.js',
  'tests/pm26/defecto-l-context-hotfix.test.mjs',
].sort();

const archivosReales = git(['diff', '--name-only', 'origin/main..origin/release'])
  .stdout
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean)
  .sort();

assert.deepEqual(
  archivosReales,
  archivosEsperados,
  'la diferencia main..release debe limitarse exactamente al hotfix autorizado del Defecto L'
);

console.log('PM27_RELEASE_HOTFIX_FAST_FORWARD=PASS');
console.log('PM27_RELEASE_HOTFIX_ALCANCE_EXACTO=PASS');
