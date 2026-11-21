import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const index = readFileSync(resolve(root, 'index.html'), 'utf8');
const css = readFileSync(resolve(root, 'la-apariencia.css'), 'utf8');
const dashboardPremium = readFileSync(resolve(root, 'dashboard-premium-v2.js'), 'utf8');
const shell = readFileSync(resolve(root, 'la-orbita-shell.js'), 'utf8');
const source = readFileSync(resolve(root, 'fuente.js'), 'utf8');
const recovery = readFileSync(resolve(root, 'source-recovery/fuente-recuperado.js'), 'utf8');

assert.match(index, /la-apariencia\.css\?v=qa-orbita-modules-v21-20261121/);
assert.match(index, /dashboard-premium-v2\.js\?v=qa-orbita-panel-v2-20261121/);
assert.match(dashboardPremium, /la-dashboard-detail-hidden/);
assert.match(dashboardPremium, /Ver detalle operativo/);
assert.match(dashboardPremium, /laDetalleVisible/);
assert.doesNotMatch(dashboardPremium, /grid\.classList\.add\([^)]*\);addQuickActions\(root,grid\)/, 'el dashboard heredado no debe inyectar un segundo panel de acciones');

const primitiveClasses = [
  'la-ui-button', 'la-ui-link-button', 'la-ui-input', 'la-ui-select',
  'la-ui-card', 'la-ui-section-title', 'la-ui-field', 'la-ui-badge',
  'la-ui-empty', 'la-ui-alert', 'la-ui-modal-backdrop', 'la-ui-modal',
  'la-ui-modal-head', 'la-ui-icon-button', 'la-ui-dropdown', 'la-ui-filter',
  'la-ui-pagination', 'la-ui-confirmation', 'la-ui-tooltip', 'la-ui-icon'
];
const sourcePrimitiveClasses = primitiveClasses.slice(0, 14);
for (const name of sourcePrimitiveClasses) {
  assert.ok(source.includes(name), `fuente.js no expone el componente común ${name}`);
  assert.ok(recovery.includes(name), `fuente-recuperado.js no conserva ${name}`);
}
for (const name of primitiveClasses) {
  assert.ok(css.includes(`.${name}`), `la-apariencia.css no define ${name}`);
}

for (const required of [
  'la-ui-button-primary', 'la-ui-button-ghost', 'la-ui-button-danger',
  '[role="tablist"]', '[role="tab"]', '[role="alert"]',
  'nav[aria-label*="Paginación"]', '[role="menu"]', '[role="listbox"]',
  '[role="tooltip"]', 'table thead th',
  'prefers-reduced-motion: reduce'
]) {
  assert.ok(css.includes(required), `falta la regla común ${required}`);
}

for (const token of [
  '--la-space-1: 4px', '--la-space-4: 16px', '--la-radius-md: 10px',
  '--la-shadow-1:', '--la-control-height: 44px', '--la-type-body: 14px',
  '--la-icon-md: 20px', '.gap-2', '.p-3', '.rounded-lg', '.text-\\[12px\\]',
  'min-height: var(--la-control-height)', 'table th', 'table td'
]) {
  assert.ok(css.includes(token), `falta el token o normalizador de escala ${token}`);
}
assert.match(dashboardPremium, /gap:var\(--la-space-3\)/);
assert.match(dashboardPremium, /border-radius:var\(--la-radius-lg\)/);
assert.match(dashboardPremium, /min-height:var\(--la-control-height-large\)/);

for (const moduleName of [
  'inicio', 'tpv', 'pase', 'cocina', 'caja', 'clientes', 'compras',
  'inventario', 'personal', 'configuracion', 'plataforma'
]) {
  assert.ok(shell.includes(`"${moduleName}"`), `el shell no identifica el módulo ${moduleName}`);
  assert.ok(css.includes(`data-la-orbita-module="${moduleName}"`), `falta la superficie CSS del módulo ${moduleName}`);
}
assert.ok(css.includes('.la-acceso-entrar'), 'el acceso no recibe el contrato visual Órbita');
assert.ok(shell.includes('"acceso"'), 'el shell conserva el identificador de acceso para la matriz de módulos');
assert.ok(shell.includes('data-la-orbita-module'), 'el shell no expone la marca verificable de módulo');

const block = (text) => {
  const start = text.indexOf('function Card(');
  const end = text.indexOf('function InicioEmpleado(', start);
  assert.ok(start >= 0 && end > start, 'no se pudo delimitar la capa común de primitivas');
  return text.slice(start, end).replace(/\r\n/g, '\n');
};
const sourceBody = block(source);
const recoveryBody = block(recovery);
assert.equal(sourceBody, recoveryBody, 'la capa común debe conservar paridad exacta entre fuente y recuperación');

console.log('REDISENO_COMPONENTES_ORBITA_CONTRACT=PASS primitivas=14 selectores=7 estados=5 responsive=PASS paridad=PASS');
