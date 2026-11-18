import fs from 'node:fs';
import assert from 'node:assert/strict';

// Contrato estático de la integración visual. El banco de navegador cubre las
// combinaciones, pero no evita que una propuesta quede registrada en el editor
// y pierda su bloque de tokens, navegación o composición al tocar la capa.
// Este contrato fija la superficie que debe existir antes de medir el preview.

const apariencia = fs.readFileSync('la-apariencia.js', 'utf8');
const css = fs.readFileSync('la-apariencia.css', 'utf8') + '\n' + fs.readFileSync('la-pase.css', 'utf8');
const panel = fs.readFileSync('la-pase-panel.js', 'utf8');
const fuente = fs.readFileSync('fuente.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

const disenos = ['oliva', 'claro', 'pulso', 'patio', 'rumbo', 'sello', 'orbita', 'ascua', 'pase'];
const paletas = ['bosque', 'cafe-tostado', 'azul-ambar', 'amatista', 'granada', 'ascua'];

for (const id of disenos) {
  assert.ok(apariencia.includes(`id: "${id}"`), `El catálogo no registra el diseño ${id}.`);
  assert.ok(css.includes(`html[data-la-diseno="${id}"]`), `Faltan tokens CSS para el diseño ${id}.`);
}
for (const id of paletas) {
  assert.ok(css.includes(`html[data-la-paleta="${id}"]`), `Falta la paleta ${id}.`);
}

for (const regla of [
  'prefers-reduced-motion: no-preference',
  '@media (max-width: 480px)',
  '@media (max-width: 620px)',
  '@media (max-width: 1023px)',
]) {
  assert.ok(css.includes(regla), `La capa no fija la regla responsive/movimiento ${regla}.`);
}

for (const pieza of [
  'la-rumbo:v1:', 'ctrlKey', 'metaKey', 'la-rumbo-guardadas', 'la-rumbo-fijar',
]) {
  assert.ok(fuente.includes(pieza), `Rumbo ha perdido la pieza ${pieza}.`);
}

for (const pieza of ['mesaId', 'cuentaId', 'operatingDay', 'destinoMesa', 'destinoCuenta']) {
  assert.ok(panel.includes(pieza), `Pase ha perdido la protección de destino ${pieza}.`);
}

assert.match(fuente, /orbita:\s*\{\s*titulo:\s*"El pulso"/);
assert.match(fuente, /orbita:[^\n]*indicadores:\s*\["ventas"/);
assert.ok(fuente.includes('id: "ventas"') && fuente.includes('unidadesVentaConSignoPM09(movimiento)'), 'Órbita debe usar ventas reales del ledger, no una cifra inventada.');
assert.ok(fuente.includes('la-operacion la-operacion-cocina'), 'Cocina debe exponer la raíz visual compartida de Órbita.');
assert.ok(fuente.includes('la-operacion la-operacion-caja'), 'Caja debe exponer la raíz visual compartida de Órbita.');
assert.ok(css.includes('html[data-la-diseno="orbita"] .tpv-layout'), 'TPV debe tener composición Órbita explícita.');
assert.ok(css.includes('html[data-la-diseno="orbita"] #la-pase:not(.la-ascua)'), 'Pase debe heredar la composición Órbita cuando sea el marco activo.');
assert.ok(html.includes('la-apariencia.css?v='), 'La hoja de apariencia no tiene marca de caché.');

console.log('REDISENO_P05_PROPUESTAS_OK=1 disenos=9 paletas=6 rumbo=PASS pase=PASS responsive=PASS reduced_motion=PASS');
