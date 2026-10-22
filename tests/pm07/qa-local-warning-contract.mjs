import fs from 'node:fs';
import assert from 'node:assert/strict';

const fuente = fs.readFileSync('fuente.js', 'utf8');
const recuperado = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8');

for (const [nombre, src] of [['fuente.js', fuente], ['fuente-recuperado.js', recuperado]]) {
  assert.match(src, /soloLocal: !!e2\.detail\.soloLocal/, `${nombre}: conserva el motivo solo-local del aviso`);
  assert.match(src, /falloGuardadoVisible\.soloLocal \? C2\.amber : C2\.red/, `${nombre}: el aviso solo-local usa estado informativo`);
  assert.match(src, /Guardado solo en este equipo/, `${nombre}: explica el comportamiento QA`);
  assert.match(src, /!falloGuardadoVisible\.soloLocal &&/, `${nombre}: condiciona el reintento al fallo real`);
  assert.match(src, /\}, "Reintentar"\)/, `${nombre}: conserva el reintento para fallos recuperables`);
}

console.log('QA_LOCAL_WARNING_SEMANTICS=PASS');
