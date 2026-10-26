import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const RELEASE_BASE = '21ee66bdb52e4d5ad0af2341543f53720a4cf027';
const ALLOWED_DIFF = new Set([
  '.github/scripts/punto6-netlify-publicacion-recuperacion.mjs',
  'docs/plan-maestro/PUNTO6_NETLIFY_PUBLICACION_RECUPERACION_2026-09-21.md',
]);

const root = process.cwd();

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    cwd: opts.cwd ?? root,
    encoding: 'utf8',
    stdio: opts.stdio ?? ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function snapshot(dir, relative = '') {
  const out = new Map();
  const absolute = path.join(dir, relative);
  const entries = await readdir(absolute, { withFileTypes: true });

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = path.posix.join(relative.split(path.sep).join('/'), entry.name);
    const full = path.join(dir, rel);
    if (entry.isDirectory()) {
      const nested = await snapshot(dir, rel);
      for (const [key, value] of nested) out.set(key, value);
      continue;
    }
    assert(entry.isFile(), \`Tipo no soportado en payload: \${rel}\`);
    const bytes = await readFile(full);
    out.set(rel, createHash('sha256').update(bytes).digest('hex'));
  }
  return out;
}

function assertSameSnapshot(base, candidate) {
  assert(base.size === candidate.size,
    \`Número de archivos distinto: release=\${base.size}, candidato=\${candidate.size}\`);

  for (const [file, sha] of base) {
    assert(candidate.has(file), \`Falta archivo publicable: \${file}\`);
    assert(candidate.get(file) === sha,
      \`Payload distinto en \${file}: release=\${sha}, candidato=\${candidate.get(file)}\`);
  }
  for (const file of candidate.keys()) {
    assert(base.has(file), \`Archivo publicable nuevo no presente en release: \${file}\`);
  }
}

const head = run('git', ['rev-parse', 'HEAD']);
run('git', ['cat-file', '-e', \`\${RELEASE_BASE}^{commit}\`]);
run('git', ['merge-base', '--is-ancestor', RELEASE_BASE, head]);

const changed = run('git', ['diff', '--name-only', \`\${RELEASE_BASE}..HEAD\`])
  .split('\n')
  .map((x) => x.trim())
  .filter(Boolean);

for (const file of changed) {
  assert(ALLOWED_DIFF.has(file), \`Cambio fuera del alcance 6A: \${file}\`);
}
for (const file of ALLOWED_DIFF) {
  assert(changed.includes(file), \`Falta archivo esperado de 6A: \${file}\`);
}

const netlifyToml = await readFile(path.join(root, 'netlify.toml'), 'utf8');
assert(netlifyToml.includes('command = "node .github/scripts/build-netlify-publish.mjs"'),
  'netlify.toml ya no fija el exportador determinista');
assert(netlifyToml.includes('publish = ".netlify-dist"'),
  'netlify.toml ya no publica .netlify-dist');

const exporter = await readFile(path.join(root, '.github/scripts/build-netlify-publish.mjs'), 'utf8');
for (const excluded of [
  "'.git'",
  "'.github'",
  "'tests'",
  "'supabase'",
  "'source-recovery'",
  "'docs'",
  "'tools'",
  "'netlify.toml'",
]) {
  assert(exporter.includes(excluded), \`El exportador dejó de excluir \${excluded}\`);
}

const headers = await readFile(path.join(root, '_headers'), 'utf8');
const headerRoutes = headers
  .split('\n')
  .filter((line) => line.startsWith('/') && !line.startsWith('  '));
assert(headerRoutes.length === 7,
  \`Número inesperado de reglas en _headers: \${headerRoutes.length} (esperado 7)\`);

const tmp = await mkdtemp(path.join(os.tmpdir(), 'la-suite-punto6-'));
const baseWorktree = path.join(tmp, 'release-base');

try {
  run('git', ['worktree', 'add', '--detach', baseWorktree, RELEASE_BASE]);
  run('node', ['.github/scripts/build-netlify-publish.mjs'], { cwd: baseWorktree });
  run('node', ['.github/scripts/build-netlify-publish.mjs'], { cwd: root });

  const basePayload = await snapshot(path.join(baseWorktree, '.netlify-dist'));
  const candidatePayload = await snapshot(path.join(root, '.netlify-dist'));
  assertSameSnapshot(basePayload, candidatePayload);

  const forbidden = [
    '.github/',
    'tests/',
    'supabase/',
    'source-recovery/',
    'docs/',
    'tools/',
  ];
  for (const file of candidatePayload.keys()) {
    assert(!forbidden.some((prefix) => file.startsWith(prefix)),
      \`Ruta técnica publicada: \${file}\`);
  }

  console.log(\`PUNTO6_RELEASE_BASE=\${RELEASE_BASE}\`);
  console.log(\`PUNTO6_CANDIDATE_HEAD=\${head}\`);
  console.log(\`PUNTO6_CHANGED_FILES=\${changed.length}\`);
  console.log(\`PUNTO6_PUBLISH_FILES=\${candidatePayload.size}\`);
  console.log('PUNTO6_PAYLOAD_BYTE_PARITY=PASS');
  console.log('PUNTO6_NETLIFY_REPO_CONTRACT=PASS');
} finally {
  try {
    run('git', ['worktree', 'remove', '--force', baseWorktree]);
  } catch {}
  await rm(path.join(root, '.netlify-dist'), { recursive: true, force: true });
  await rm(tmp, { recursive: true, force: true });
}
