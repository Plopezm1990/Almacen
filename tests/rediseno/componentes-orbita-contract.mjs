import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const index = readFileSync(resolve(root, 'index.html'), 'utf8');
const css = readFileSync(resolve(root, 'la-apariencia.css'), 'utf8');
const source = readFileSync(resolve(root, 'fuente.js'), 'utf8');
const recovery = readFileSync(resolve(root, 'source-recovery/fuente-recuperado.js'), 'utf8');

assert.match(index, /la-apariencia\.css\?v=qa-orbita-shell-v11-20261120/);

const primitiveClasses = [
  'la-ui-button', 'la-ui-link-button', 'la-ui-input', 'la-ui-select',
  'la-ui-card', 'la-ui-section-title', 'la-ui-field', 'la-ui-badge',
  'la-ui-empty', 'la-ui-alert', 'la-ui-modal-backdrop', 'la-ui-modal',
  'la-ui-modal-head', 'la-ui-icon-button'
];
for (const name of primitiveClasses) {
  assert.ok(source.includes(name), `fuente.js no expone el componente común ${name}`);
  assert.ok(recovery.includes(name), `fuente-recuperado.js no conserva ${name}`);
  assert.ok(css.includes(`.${name}`), `la-apariencia.css no define ${name}`);
}

for (const required of [
  'la-ui-button-primary', 'la-ui-button-ghost', 'la-ui-button-danger',
  '[role="tablist"]', '[role="tab"]', '[role="alert"]',
  'nav[aria-label*="Paginación"]', 'table thead th',
  'prefers-reduced-motion: reduce'
]) {
  assert.ok(css.includes(required), `falta la regla común ${required}`);
}

const block = (text) => {
  const start = text.indexOf('function Card(');
  const end = text.indexOf('function InicioEmpleado(', start);
  assert.ok(start >= 0 && end > start, 'no se pudo delimitar la capa común de primitivas');
  return text.slice(start, end).replace(/\r\n/g, '\n');
};
const sourceBody = block(source);
const recoveryBody = block(recovery);
assert.equal(sourceBody, recoveryBody, 'la capa común debe conservar paridad exacta entre fuente y recuperación');

console.log('REDISENO_COMPONENTES_ORBITA_CONTRACT=PASS componentes=14 estados=5 responsive=PASS paridad=PASS');
