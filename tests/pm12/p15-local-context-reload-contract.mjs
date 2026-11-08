import assert from 'node:assert/strict';
import fs from 'node:fs';

const fuente = fs.readFileSync(new URL('../../fuente.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const recuperada = fs.readFileSync(new URL('../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function bootstrapBlock(source) {
  const start = source.indexOf('const [localActivoId, setLocalActivoId]');
  const end = source.indexOf('  }, []);', start);
  assert.ok(start >= 0 && end > start, 'no se encontró el bootstrap principal');
  return source.slice(start, end);
}

const bloque = bootstrapBlock(fuente);
assert.match(
  bloque,
  /setLocales\(localesFinales\);\s+setLocalActivoId\(localActivoFinal\);\s+\/\/ La vista de informes usa su propio selector\.[\s\S]*?setLocalInformeId\(localActivoFinal \|\| ""\);/,
  'la recarga debe hidratar el selector visible con el local activo validado'
);
assert.match(bloque, /if \(localActivoFinal !== \(lai \|\| null\)\) await saveKey\("localActivoId", localActivoFinal\);/);
assert.doesNotMatch(bloque, /setLocalInformeId\(lai/);

const bloqueRecuperado = bootstrapBlock(recuperada);
assert.equal(bloqueRecuperado, bloque, 'fuente recuperada y fuente principal deben mantener paridad en la hidratación');

console.log('PM12_P15_LOCAL_CONTEXT_RELOAD=PASS');
