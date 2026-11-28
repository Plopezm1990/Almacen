import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Contrato de higiene visual para evitar que el cierre de Órbita vuelva a
// quedar mezclado con estilos de las capas históricas. No intenta prohibir
// cualquier literal del producto: las nueve propuestas, los estados fiscales
// y los puentes de compatibilidad necesitan valores de respaldo. Comprueba,
// en cambio, que las capas nuevas estén tokenizadas y que los únicos puentes
// que pisan inline legacy sigan acotados y visibles.

const apariencia = readFileSync('la-apariencia.css', 'utf8');
const pase = readFileSync('la-pase.css', 'utf8');
const dashboard = readFileSync('dashboard-premium-v2.js', 'utf8');
const plataforma = readFileSync('plataforma-panel.js', 'utf8');
const shell = readFileSync('la-orbita-shell.js', 'utf8');
const index = readFileSync('index.html', 'utf8');

// El dashboard es la capa nueva de Inicio: no debe necesitar !important ni
// volver a introducir colores de Sello/verde escritos en la hoja inyectada.
assert.equal((dashboard.match(/!important/g) || []).length, 0,
  'Inicio conserva !important en la capa nueva');
assert.equal((dashboard.match(/#[0-9A-Fa-f]{3,8}\b/g) || []).length, 0,
  'Inicio conserva colores HEX directos en su CSS nuevo');
const dashboardHash = createHash('sha256').update(readFileSync('dashboard-premium-v2.js')).digest('hex').slice(0, 16);
assert.match(index, /dashboard-premium-v2\.js\?v=qa-orbita-panel-v5-20261121/,
  'Inicio no ha renovado la marca de caché tras cambiar su capa visual');
assert.equal(dashboardHash, '253eef791a3443f3', 'La huella de la capa nueva de Inicio no coincide');
for (const token of ['--c-surface', '--c-bg', '--c-ink', '--c-accent', '--la-radius-', '--la-space-']) {
  assert.match(dashboard, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `Inicio no consume el token ${token}`);
}

// Pase comparte escala, radios y estados semánticos. Las únicas tres reglas
// !important son el remapeo de estados en la variante Órbita, necesario para
// vencer los estilos inline del componente histórico.
assert.equal((pase.match(/!important/g) || []).length, 3,
  'Pase tiene una sobrescritura !important fuera del puente de estados documentado');
assert.match(pase, /html\[data-la-diseno="orbita"\] \.la-orbita-pase/,
  'Pase no tiene una raíz de remapeo Órbita acotada');
for (const token of ['--la-space-', '--la-radius-', '--c-amber', '--c-focus-ring']) {
  assert.match(pase, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `Pase no consume el token ${token}`);
}
assert.match(pase, /min-height:\s*44px/, 'Pase ha perdido el mínimo táctil de 44 px');

// Plataforma ya no crea estilos inline para layout, espaciado u ocultación.
// La función h conserva el soporte genérico para datos externos, pero ninguna
// llamada de esta capa debe volver a usar style: o .style.display.
assert.doesNotMatch(plataforma, /\bstyle\s*:/, 'Plataforma vuelve a generar estilos inline');
assert.doesNotMatch(plataforma, /\.style\.(?:display|margin|padding|color|background|border)/,
  'Plataforma muta estilos visuales inline');
for (const clase of ['lap-fila-between', 'lap-mt-1', 'lap-mt-2', 'lap-mt-3', 'lap-hidden', 'lap-transport']) {
  assert.match(plataforma, new RegExp(`\\.${clase}\\b`), `Plataforma no declara ${clase}`);
}

// Las reglas legacy siguen existiendo solo como puentes explícitos: el shell
// marca y oculta las superficies antiguas y la hoja las remapea bajo
// html[data-la-diseno]. Una regla no puede reaparecer sin estas dos defensas.
for (const marca of ['la-orbita-legacy-header', 'la-orbita-legacy-mobile', 'la-orbita-legacy-tool']) {
  assert.match(shell, new RegExp(marca), `El shell no marca ${marca}`);
  assert.match(apariencia, new RegExp(`\\.${marca}`), `La hoja no aísla ${marca}`);
}
const remapeosInline = (apariencia.match(/\[style\*=/g) || []).length;
assert.ok(remapeosInline > 0, 'Desapareció el inventario de puentes inline de MFA/inventario');
assert.match(apariencia, /Compatibilidad legacy|puente[s]? de compatibilidad|remapean sus primitivas/i,
  'Los puentes legacy no están documentados en la hoja');

console.log(`REDISENO_CSS_ORBITA_CONTRACT=PASS dashboardImportant=0 paseImportant=3 puentesInline=${remapeosInline} plataformaInline=0`);
