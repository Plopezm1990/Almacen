import fs from 'node:fs';
import assert from 'node:assert/strict';

const evidencePath = 'tests/pm12/P01_CHECKPOINT_INVENTARIO.md';
assert.ok(fs.existsSync(evidencePath), 'evidencia P01 existe');
const evidence = fs.readFileSync(evidencePath, 'utf8');

for (const marker of [
  'PM12_P01_CHECKPOINT_INVENTARIO=PASS',
  'LA-020',
  'BORRADOR',
  'EN_CURSO',
  'PARCIAL',
  'COMPLETADO',
  'CANCELADO',
  'Vacío no equivale a completado',
  'numérico',
  '7f792925d6a3d27334ee0e7335ba635b4ed79b6b'
]) {
  assert.ok(evidence.includes(marker), 'P01 conserva ' + marker);
}

const src = fs.readFileSync('fuente.js', 'utf8');
for (const symbol of [
  'function crearLogicaConteos(',
  'function iniciarConteo(ambito = "total")',
  'function actualizarConteoItem(',
  'function actualizarResponsable(',
  'function finalizarConteo(',
  'function aplicarAjustes(',
  'function InventarioCiego('
]) {
  assert.ok(src.includes(symbol), 'lógica heredada presente: ' + symbol);
}

// Baseline LA-020: P01 demuestra el defecto antes de corregirlo.
// P02 sustituirá esta aserción por el contrato de estados canónicos.
// PM12 P05 añadió un segundo parámetro (opciones = {}) a finalizarConteo y alejó
// "completado: true" dentro del cuerpo; se amplía el literal y el presupuesto de
// distancia sin cambiar lo que este baseline documenta (ya superado por el contrato
// de estados canónicos de P02).
assert.match(
  src,
  /function finalizarConteo\(conteoId[\s\S]{0,2000}completado: true/,
  'baseline: finalizarConteo aún puede marcar completado sin cobertura'
);

assert.match(src, /responsables: \{ contadoPor: "", revisor: "" \}/);
assert.match(src, /items: productosDelConteo\.map\(\(p22\) => \(\{ productoId: p22\.id, conteo: "" \}\)\)/);

console.log('PM12_P01_CONTRACT=PASS');
