import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, readlink } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outName = '.netlify-dist';
const outDir = path.join(root, outName);
const excludedRootEntries = new Set([
  '.git',
  '.github',
  outName,
  'tests',
  'supabase',
  'source-recovery',
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

assert(source.size === published.size,
  `Publish entry count mismatch: source=${source.size}, published=${published.size}`);

for (const [key, expected] of source) {
  assert(published.has(key), `Missing publish entry: ${key}`);
  assert(published.get(key) === expected, `Publish content mismatch: ${key}`);
}
for (const key of published.keys()) {
  assert(source.has(key), `Unexpected publish entry: ${key}`);
}

const forbiddenPrefixes = ['.github/', 'tests/', 'supabase/', 'source-recovery/'];
for (const key of published.keys()) {
  assert(!forbiddenPrefixes.some((prefix) => key.startsWith(prefix)),
    `Forbidden technical path published: ${key}`);
}
assert(!published.has('netlify.toml'), 'netlify.toml must not be published');

for (const required of ['index.html', 'fuente.js', 'edge-auth-patch.js', '_headers']) {
  assert(published.has(required), `Required runtime file missing: ${required}`);
}

const config = await readFile(path.join(root, 'netlify.toml'), 'utf8');
assert(config.includes('command = "node .github/scripts/build-netlify-publish.mjs"'),
  'Netlify build command is not pinned to the deterministic exporter');
assert(config.includes('publish = ".netlify-dist"'),
  'Netlify publish directory is not .netlify-dist');

console.log(`NETLIFY_PUBLISH_BOUNDARY_PASS entries=${published.size}`);
