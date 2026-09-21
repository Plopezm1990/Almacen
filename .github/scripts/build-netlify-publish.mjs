import { cp, mkdir, readdir, rm, access, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const outName = '.netlify-dist';
const outDir = path.join(root, outName);
const tailwindOut = path.join(outDir, 'tailwind.generated.css');

const excludedRootEntries = new Set([
  '.git',
  '.github',
  '.gitignore',
  outName,
  'node_modules',
  'package.json',
  'package-lock.json',
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
  await cp(path.join(root, entry.name), path.join(outDir, entry.name), {
    recursive: true,
    force: true,
    preserveTimestamps: true,
    verbatimSymlinks: true,
  });
  copied.push(entry.name);
}

const tailwindCli = path.join(root, 'node_modules', 'tailwindcss', 'lib', 'cli.js');
await access(tailwindCli);
await execFileAsync(process.execPath, [
  tailwindCli,
  '-c', path.join(root, '.github', 'tailwind', 'tailwind.config.cjs'),
  '-i', path.join(root, '.github', 'tailwind', 'input.css'),
  '-o', tailwindOut,
  '--minify',
], { cwd: root, maxBuffer: 16 * 1024 * 1024 });

const css = await readFile(tailwindOut, 'utf8');
if (css.length < 10000) throw new Error(`Tailwind output is unexpectedly small: ${css.length} bytes`);

for (const required of [
  'index.html',
  'fuente.js',
  'edge-auth-patch.js',
  'reset-pruebas-preview.js',
  'index-storage-bootstrap.js',
  'index-loader.js',
  'index-mounted.js',
  'restablecer-contrasena.js',
  'tailwind.generated.css',
  '_headers',
]) {
  await access(path.join(outDir, required));
}

console.log(`NETLIFY_PUBLISH_DIR=${outName}`);
console.log(`TAILWIND_CSS_BYTES=${css.length}`);
console.log(`COPIED_ROOT_ENTRIES=${copied.sort().join(',')}`);
console.log(`EXCLUDED_ROOT_ENTRIES=${excluded.sort().join(',')}`);
