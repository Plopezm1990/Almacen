import fs from 'node:fs';

const src = fs.readFileSync('fuente.js', 'utf8');

function bloque(desde, hasta, nombre, max = 24000) {
  const ini = src.indexOf(desde);
  const fin = src.indexOf(hasta, ini >= 0 ? ini : 0);
  console.log(`\n===== ${nombre} =====`);
  console.log(`INI=${ini} FIN=${fin}`);
  if (ini < 0 || fin <= ini) {
    console.log('NO_LOCALIZADO');
    return;
  }
  const text = src.slice(ini, Math.min(fin, ini + max));
  console.log(text);
  if (fin - ini > max) console.log(`\n[TRUNCADO ${fin - ini - max} chars]`);
}

bloque('function crearLogicaPersonal({', 'function crearLogicaTurnos({', 'LOGICA_PERSONAL', 32000);
bloque('function Personal({', 'function Turnos({', 'UI_PERSONAL', 32000);

for (const needle of [
  'const [empleados',
  'useLocalStorage("empleados"',
  '"empleados", []',
  'setEmpleados',
  'empresaDelLocalActivo',
  'supabase.from("empleados")',
  '.from("empleados")',
  'pm11_alta_empleado',
  'deleteEmpleado('
]) {
  console.log(`\n===== NEEDLE ${needle} =====`);
  let pos = 0;
  let n = 0;
  while ((pos = src.indexOf(needle, pos)) >= 0 && n < 8) {
    const a = Math.max(0, pos - 1000);
    const b = Math.min(src.length, pos + needle.length + 1800);
    console.log(`\n--- occurrence ${n + 1} @${pos} ---\n${src.slice(a, b)}`);
    pos += needle.length;
    n += 1;
  }
  if (!n) console.log('NO_LOCALIZADO');
}
