import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const index = read('index.html');
const shell = read('la-orbita-shell.js');
const templates = read('la-plantillas-orbita.js');
const pase = read('la-pase-panel.js');
const css = read('la-apariencia.css');
const paseCss = read('la-pase.css');
const tables = read('la-tablas-fichas.js');
const matrix = read('docs/rediseno/MATRIZ-MIGRACION-MODULOS-ORBITA-2026-11-21.md');
const acta = read('docs/rediseno/ACTA_CIERRE_OBJETIVO_4_ORBITA_2026-11-21.md');
const traspaso = read('docs/rediseno/TRASPASO_QA_CLAUDE_2026-11-17.md');

const modules = [
  'inicio', 'tpv', 'pase', 'cocina', 'caja', 'clientes', 'compras',
  'inventario', 'personal', 'configuracion', 'plataforma', 'acceso',
];

for (const moduleName of modules) {
  assert.match(templates, new RegExp(`${moduleName}:\\s*['"][a-z-]+['"]`), `falta el módulo móvil ${moduleName}`);
}

assert.match(index, /la-orbita-shell\.js\?v=/);
assert.match(index, /la-plantillas-orbita\.js\?v=/);
assert.match(shell, /marcarBarraInferior/);
assert.match(shell, /data-la-orbita-nav-item/);
assert.match(shell, /la-orbita-search-dialog/);
assert.match(shell, /contexto|selector|select/i);

// Contrato transversal de geometría móvil.
assert.match(css, /@media\s*\(max-width:\s*767px\)/);
assert.match(css, /la-orbita-bottom-nav/);
assert.match(css, /min-height:\s*(?:var\(--la-control-height|44px)/);
assert.match(css, /overflow-x:\s*clip/);
assert.match(css, /max-width:\s*100%/);
assert.match(css, /max-height:\s*calc\(100dvh/);
assert.match(css, /la-ui-filter/);
assert.match(css, /la-ui-pagination/);
assert.match(css, /la-ui-empty/);
assert.match(css, /loading-state|la-ui-loading/);
assert.match(css, /error-state|la-ui-error/);
assert.match(tables, /data-etiqueta/);
assert.match(tables, /MutationObserver/);

// Pase ofrece búsqueda, no solo una muestra silenciosa de ocho filas.
assert.match(pase, /data-la-pase-cola-busqueda/);
assert.match(pase, /colaBusqueda/);
assert.match(pase, /Buscar (?:comanda|pedido)/);
assert.match(paseCss, /la-pase-cola-busqueda/);
assert.match(paseCss, /min-height:\s*44px/);

// La evidencia distingue viewport y estado: no se da por verificada una
// pantalla solo porque exista su plantilla.
assert.match(matrix, /Cierre de recorridos móviles Órbita/);
assert.match(matrix, /390×844/);
assert.match(matrix, /1440×900/);
assert.match(matrix, /overflow=false/);
assert.match(matrix, /44(?:×|x)44/);
for (const moduleName of modules) assert.match(matrix, new RegExp(moduleName, 'i'));
assert.match(acta, /Revisión móvil transversal|recorridos móviles Órbita/);
assert.match(traspaso, /recorridos móviles Órbita|Cierre de recorridos móviles/);

console.log('REDISENO_MOVIL_RECORRIDOS_ORBITA_CONTRACT=PASS modulos=12 shell=PASS pase-busqueda=PASS overflow=PASS touch=44');
