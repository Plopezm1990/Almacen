import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, readlink } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outName = '.netlify-dist';
const outDir = path.join(root, outName);
const generatedTailwind = 'tailwind.generated.css';
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

async function snapshot(baseDir, relative = '') {
  const abs = path.join(baseDir, relative);
  const entries = await readdir(abs, { withFileTypes: true });
  const result = new Map();
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (relative === '' && excludedRootEntries.has(entry.name)) continue;
    const rel = path.posix.join(relative.split(path.sep).join('/'), entry.name);
    const full = path.join(baseDir, rel);
    const info = await lstat(full);
    if (info.isDirectory()) {
      result.set(`${rel}/`, 'dir');
      const nested = await snapshot(baseDir, rel);
      for (const [key, value] of nested) result.set(key, value);
    } else if (info.isSymbolicLink()) {
      result.set(rel, `symlink:${await readlink(full)}`);
    } else if (info.isFile()) {
      const digest = createHash('sha256').update(await readFile(full)).digest('hex');
      result.set(rel, `file:${digest}`);
    } else {
      throw new Error(`Unsupported filesystem entry: ${rel}`);
    }
  }
  return result;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const source = await snapshot(root);
const published = await snapshot(outDir);

assert(!source.has(generatedTailwind), 'Generated Tailwind CSS must not be tracked in source root');
assert(published.has(generatedTailwind), 'Generated Tailwind CSS missing from publish artifact');
assert(String(published.get(generatedTailwind)).startsWith('file:'), 'Generated Tailwind CSS is not a regular file');

const comparablePublished = new Map(published);
comparablePublished.delete(generatedTailwind);

assert(source.size === comparablePublished.size,
  `Publish entry count mismatch: source=${source.size}, published-static=${comparablePublished.size}`);
for (const [key, expected] of source) {
  assert(comparablePublished.has(key), `Missing publish entry: ${key}`);
  assert(comparablePublished.get(key) === expected, `Publish content mismatch: ${key}`);
}
for (const key of comparablePublished.keys()) {
  assert(source.has(key), `Unexpected publish entry: ${key}`);
}

const forbiddenPrefixes = ['.github/','node_modules/','tests/','supabase/','source-recovery/','docs/','tools/'];
for (const key of published.keys()) {
  assert(!forbiddenPrefixes.some((prefix) => key.startsWith(prefix)), `Forbidden technical path published: ${key}`);
}
for (const forbidden of ['.gitignore','package.json','package-lock.json','netlify.toml']) {
  assert(!published.has(forbidden), `${forbidden} must not be published`);
}

for (const required of [
  'index.html','fuente.js','edge-auth-patch.js','reset-pruebas-preview.js',
  'index-storage-bootstrap.js','index-loader.js','index-mounted.js',
  'restablecer-contrasena.js',generatedTailwind,'_headers',
]) {
  assert(published.has(required), `Required runtime file missing: ${required}`);
}

const css = await readFile(path.join(outDir, generatedTailwind), 'utf8');
assert(css.length >= 10000, `Generated Tailwind CSS too small: ${css.length}`);
assert(css.includes('.flex{display:flex}'), 'Generated Tailwind CSS lacks expected flex utility');
assert(css.includes('.hidden{display:none}'), 'Generated Tailwind CSS lacks expected hidden utility');

const index = await readFile(path.join(root, 'index.html'), 'utf8');
const recovery = await readFile(path.join(root, 'restablecer-contrasena.html'), 'utf8');
assert(!index.includes('cdn.tailwindcss.com'), 'Tailwind Play CDN remains in index.html');
assert(index.includes('tailwind.generated.css'), 'index.html does not load generated Tailwind CSS');
assert(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(index), 'index.html still contains inline script');
assert(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(recovery), 'restablecer-contrasena.html still contains inline script');

const headers = await readFile(path.join(root, '_headers'), 'utf8');
for (const expected of [
  'Content-Security-Policy:',
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'https://flqercbgpgmmfaakrwkc.supabase.co',
  'https://qjqorixtkilwsndqayyx.supabase.co',
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'Permissions-Policy: camera=(self)',
]) {
  assert(headers.includes(expected), `Missing security header contract fragment: ${expected}`);
}
assert(!/script-src[^\n;]*'unsafe-inline'/.test(headers), 'script-src must not permit unsafe-inline');

const config = await readFile(path.join(root, 'netlify.toml'), 'utf8');
assert(config.includes('command = "node .github/scripts/build-netlify-publish.mjs"'),
  'Netlify build command is not pinned to the deterministic exporter');
assert(config.includes('publish = ".netlify-dist"'), 'Netlify publish directory is not .netlify-dist');

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
assert(pkg?.devDependencies?.tailwindcss === '3.4.17', 'Tailwind build dependency must be pinned exactly to 3.4.17');

console.log(`NETLIFY_PUBLISH_BOUNDARY_PASS entries=${published.size} tailwind_bytes=${css.length}`);
