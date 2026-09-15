import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const distDir = path.join(here, 'dist');
const out = path.join(distDir, 'fuente.js');
const manifestPath = path.join(here, 'CURRENT_RELEASE_MANIFEST.json');
const patchPath = path.join(here, 'CURRENT_RELEASE.patch');
const targetBundle = path.join(repoRoot, 'fuente.js');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, {
    cwd: options.cwd ?? repoRoot,
    input: options.input,
    encoding: 'utf8',
    stdio: options.input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} terminó con código ${r.status}`);
  return r.stdout || '';
}

function requireString(obj, key) {
  if (!obj || typeof obj[key] !== 'string' || !obj[key]) {
    throw new Error(`Manifest inválido: falta ${key}`);
  }
  return obj[key];
}

if (!fs.existsSync(manifestPath)) throw new Error('Falta CURRENT_RELEASE_MANIFEST.json');
if (!fs.existsSync(patchPath)) throw new Error('Falta CURRENT_RELEASE.patch');
if (!fs.existsSync(targetBundle)) throw new Error('Falta ../fuente.js');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.format !== 'la-suite-current-release-rebuild-v2') {
  throw new Error(`Formato de manifiesto no reconocido: ${manifest.format}`);
}

const baseCommit = requireString(manifest, 'baseCommit');
const baseArtifactSha256 = requireString(manifest, 'baseArtifactSha256');
const targetFuenteCommit = requireString(manifest, 'targetFuenteCommit');
const targetArtifactSha256 = requireString(manifest, 'targetArtifactSha256');
const patchSha256 = requireString(manifest, 'patchSha256');

if (sha256(patchPath) !== patchSha256) {
  throw new Error('CURRENT_RELEASE.patch no coincide con el SHA fijado en el manifiesto');
}
if (sha256(targetBundle) !== targetArtifactSha256) {
  throw new Error('fuente.js actual no coincide con el artefacto objetivo fijado');
}

const actualTargetFuenteCommit = run(
  'git',
  ['log', '-1', '--format=%H', '--', 'fuente.js'],
  { cwd: repoRoot },
).trim();
if (actualTargetFuenteCommit !== targetFuenteCommit) {
  throw new Error(`Commit objetivo de fuente.js inesperado: ${actualTargetFuenteCommit} != ${targetFuenteCommit}`);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'la-suite-source-recovery-'));
const worktree = path.join(tempRoot, 'base');
let worktreeAdded = false;

try {
  // 1) Reconstruir el baseline desde la fuente recuperada histórica exacta.
  run('git', ['worktree', 'add', '--detach', worktree, baseCommit], { cwd: repoRoot });
  worktreeAdded = true;

  const baseRecovery = path.join(worktree, 'source-recovery');
  if (!fs.existsSync(path.join(baseRecovery, 'package-lock.json'))) {
    throw new Error(`El baseline ${baseCommit} no contiene source-recovery/package-lock.json`);
  }

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  run(npm, ['ci', '--no-audit', '--no-fund'], { cwd: baseRecovery });
  run(npm, ['run', 'check'], { cwd: baseRecovery });
  run(npm, ['run', 'build'], { cwd: baseRecovery });

  const baseOut = path.join(baseRecovery, 'dist', 'fuente.js');
  if (!fs.existsSync(baseOut)) throw new Error('El baseline no generó dist/fuente.js');

  const rebuiltBaseSha = sha256(baseOut);
  if (rebuiltBaseSha !== baseArtifactSha256) {
    throw new Error(`Baseline no reproducible: ${rebuiltBaseSha} != ${baseArtifactSha256}`);
  }

  // 2) Aplicar un único diff acumulado exacto desde el baseline hasta el
  // último commit que modificó fuente.js. --fuzz=0 evita aceptar drift.
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
  fs.copyFileSync(baseOut, out);

  const patch = fs.readFileSync(patchPath);
  run('patch', ['--batch', '--fuzz=0', '-p1', '-d', distDir], { cwd: repoRoot, input: patch });

  // 3) La salida debe coincidir por SHA y byte a byte con el runtime actual.
  const finalSha = sha256(out);
  if (finalSha !== targetArtifactSha256) {
    throw new Error(`Artefacto final no reproducible: ${finalSha} != ${targetArtifactSha256}`);
  }

  const rebuilt = fs.readFileSync(out);
  const target = fs.readFileSync(targetBundle);
  if (!rebuilt.equals(target)) {
    throw new Error('El artefacto reconstruido no coincide byte a byte con ../fuente.js');
  }

  run(process.execPath, ['--check', out], { cwd: repoRoot });

  console.log(`SOURCE_RECOVERY_BASE_COMMIT=${baseCommit}`);
  console.log(`SOURCE_RECOVERY_BASE_SHA=${rebuiltBaseSha}`);
  console.log(`SOURCE_RECOVERY_TARGET_FUENTE_COMMIT=${targetFuenteCommit}`);
  console.log(`SOURCE_RECOVERY_FINAL_SHA=${finalSha}`);
  console.log('SOURCE_RECOVERY_BYTE_PARITY=PASS');
  console.log('SOURCE_RECOVERY_REBUILD_CURRENT=PASS');
} finally {
  if (worktreeAdded) {
    const r = spawnSync('git', ['worktree', 'remove', '--force', worktree], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'inherit',
    });
    if (r.error) console.error(r.error);
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
