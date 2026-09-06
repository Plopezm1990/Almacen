import fs from 'node:fs';

const src = fs.readFileSync('fuente.js', 'utf8');

function contexto(needle, antes = 1600, despues = 3000, limite = 12) {
  console.log(`\n===== NEEDLE ${needle} =====`);
  let pos = 0;
  let n = 0;
  while ((pos = src.indexOf(needle, pos)) >= 0 && n < limite) {
    const a = Math.max(0, pos - antes);
    const b = Math.min(src.length, pos + needle.length + despues);
    console.log(`\n--- occurrence ${n + 1} @${pos} ---\n${src.slice(a, b)}`);
    pos += needle.length;
    n += 1;
  }
  if (!n) console.log('NO_LOCALIZADO');
}

for (const needle of [
  'saveKey("empleados"',
  'empleadosDelLocalActivo',
  'skipSaveRef',
  'saveKey(k',
  'saveKey(key',
  'const pares',
  'const pairs',
  '["empleados"',
  'empleados, setEmpleados',
  'sincronizarStockPm07',
  'function sincronizarStockPm07',
  'function sincronizarCajaPm08',
  'window.__nubeActiva',
  'Personal,',
  'empleados: empleadosDelLocalActivo',
  'empleados: empleados'
]) contexto(needle);
