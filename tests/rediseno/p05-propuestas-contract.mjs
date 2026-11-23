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

assert.match(fuente, /orbita:\s*\{\s*titulo:\s*"El turno,",\s*destacado:\s*"en movimiento\."/);
assert.match(fuente, /orbita:[^\n]*indicadores:\s*\["ventas"/);
assert.ok(fuente.includes('id: "ventas"') && fuente.includes('unidadesVentaConSignoPM09(movimiento)'), 'Órbita debe usar ventas reales del ledger, no una cifra inventada.');
assert.ok(fuente.includes('la-operacion la-operacion-cocina'), 'Cocina debe exponer la raíz visual compartida de Órbita.');
assert.ok(fuente.includes('la-operacion la-operacion-caja'), 'Caja debe exponer la raíz visual compartida de Órbita.');
assert.ok(css.includes('html[data-la-diseno="orbita"] .tpv-layout'), 'TPV debe tener composición Órbita explícita.');
assert.ok(css.includes('html[data-la-diseno="orbita"] #la-pase:not(.la-ascua)'), 'Pase debe heredar la composición Órbita cuando sea el marco activo.');
// 23/11/2026: esPanelServicio ya no incluye "orbita". Hasta esa fecha montaba
// el panel de servicio de Pase ENCIMA del panel nativo de Inicio de Órbita
// (PANELES_REDISENO.orbita, en fuente.js), duplicando el turno en dos
// tarjetas en la misma pantalla -algo que la maqueta no muestra. Ver
// docs/rediseno/CORRECCION_CIERRE_FINAL_ORBITA_2026-11-23.md. La composición
// `la-orbita-pase` sigue en el fichero para cuando Pase es el diseño activo
// dentro del marco Órbita (línea 51 de este contrato); lo que ya no ocurre es
// que se monte también sobre el Inicio nativo de Órbita.
assert.match(panel, /diseno === "pase" \|\| diseno === "ascua"/);
assert.doesNotMatch(panel, /return diseno === "pase" \|\| diseno === "ascua" \|\| diseno === "orbita"/, 'Pase no debe volver a activarse para el Inicio nativo de Órbita');
assert.ok(panel.includes('la-orbita-pase'), 'Pase debe montarse dentro del marco Órbita.');
assert.ok(html.includes('la-apariencia.css?v='), 'La hoja de apariencia no tiene marca de caché.');

console.log('REDISENO_P05_PROPUESTAS_OK=1 disenos=9 paletas=6 rumbo=PASS pase=PASS responsive=PASS reduced_motion=PASS');
