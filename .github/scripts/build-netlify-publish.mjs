import { cp, mkdir, readdir, rm, access } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outName = '.netlify-dist';
const outDir = path.join(root, outName);

// Keep the deployed site byte-for-byte equivalent to the repository root except
// for development, CI, database, recovery, internal documentation and tooling
// material that is not web runtime.
const excludedRootEntries = new Set([
  '.git',
  '.github',
  outName,
  'tests',
  'supabase',
  'source-recovery',
  'docs',
  'tools',
  'netlify.toml',
]);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const entries = await readdir(root, { withFileTypes: true });
const copied = [];
const excluded = [];

for (const entry of entries) {
  if (excludedRootEntries.has(entry.name)) {
    excluded.push(entry.name);
    continue;
  }

  await cp(
    path.join(root, entry.name),
    path.join(outDir, entry.name),
    {
      recursive: true,
      force: true,
      preserveTimestamps: true,
      verbatimSymlinks: true,
    },
  );
  copied.push(entry.name);
}

// Fail closed if the exporter ever produces something that cannot be served.
for (const required of ['index.html', 'fuente.js', 'edge-auth-patch.js', 'reset-pruebas-preview.js', '_headers']) {
  await access(path.join(outDir, required));
}

console.log(`NETLIFY_PUBLISH_DIR=${outName}`);
console.log(`COPIED_ROOT_ENTRIES=${copied.sort().join(',')}`);
console.log(`EXCLUDED_ROOT_ENTRIES=${excluded.sort().join(',')}`);
