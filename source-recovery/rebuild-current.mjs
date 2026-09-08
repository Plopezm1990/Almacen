import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(here, 'dist');
const out = path.join(distDir, 'fuente.js');
const patchDir = path.join(here, 'post-pm08-patches');
const manifestPath = path.join(patchDir, 'PATCH_SERIES.json');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, {
    cwd: options.cwd ?? here,
    encoding: 'utf8',
    input: options.input,
    stdio: options.input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} terminó con código ${r.status}`);
}

if (!fs.existsSync(manifestPath)) throw new Error('Falta post-pm08-patches/PATCH_SERIES.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.format !== 'la-suite-post-pm08-patch-series-v1') throw new Error('Formato de patch series no reconocido');

// 1) Generar desde la fuente recuperada. Este paso sobrescribe cualquier build previo.
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build']);

const baseSha = sha256(out);
if (baseSha !== manifest.baseArtifactSha256) {
  throw new Error(`Baseline no reproducible: ${baseSha} != ${manifest.baseArtifactSha256}`);
}
console.log(`G1_REBUILD_BASE_COMMIT=${manifest.baseCommit}`);
console.log(`G1_REBUILD_BASE_SHA=${baseSha}`);

// 2) Aplicar literalmente los cambios históricos PM09/PM10 en el orden congelado.
const patches = fs.readdirSync(patchDir).filter(x => x.endsWith('.patch')).sort();
if (patches.length !== manifest.patchCount) {
  throw new Error(`Patch count inesperado: ${patches.length} != ${manifest.patchCount}`);
}

const manifestCommits = manifest.commits.map(x => x.commit);
const fileCommits = patches.map(x => x.replace(/^\d+-/, '').replace(/\.patch$/, ''));
if (JSON.stringify(fileCommits) !== JSON.stringify(manifestCommits)) {
  throw new Error('Los nombres/orden de los parches no coinciden con el manifiesto');
}

for (const p of patches) {
  const patch = fs.readFileSync(path.join(patchDir, p));
  run('patch', ['--batch', '--fuzz=0', '-p1', '-d', distDir], { input: patch });
}

// 3) El resultado esperado está fijado en el manifiesto, no se toma de ../fuente.js.
const finalSha = sha256(out);
if (finalSha !== manifest.targetArtifactSha256) {
  throw new Error(`Artefacto final no reproducible: ${finalSha} != ${manifest.targetArtifactSha256}`);
}
console.log(`G1_REBUILD_PATCH_COUNT=${patches.length}`);
console.log(`G1_REBUILD_TARGET_FUENTE_COMMIT=${manifest.targetFuenteCommit}`);
console.log(`G1_REBUILD_FINAL_SHA=${finalSha}`);
console.log('G1_REBUILD_CURRENT=PASS');
