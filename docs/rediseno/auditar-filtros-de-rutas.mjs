/**
 * Auditoria de los filtros de rutas de los flujos de trabajo.
 * ---------------------------------------------------------------------------
 * La regla que comprueba es una sola: todo archivo que un contrato LEE tiene
 * que estar en el filtro `paths:` del flujo que lo ejecuta. Si falta, el
 * contrato no es un contrato: solo se dispara cuando el PR toca por casualidad
 * algun otro archivo de la lista.
 *
 * No es una hipotesis. El PR #220 cambio la rama del propietario en
 * `edge-auth-patch.js`, que no estaba en el filtro de `p2-p06` aunque su
 * contrato hace seis aserciones sobre ese archivo. El contrato no se entero,
 * siguio exigiendo la forma vieja y salto en rojo semanas despues, en una rama
 * que si tocaba `index.html`.
 *
 * Solo lee. No escribe nada y no toca la configuracion.
 *
 *   node docs/rediseno/auditar-filtros-de-rutas.mjs            # resumen
 *   node docs/rediseno/auditar-filtros-de-rutas.mjs --detalle  # con los huecos
 *   node docs/rediseno/auditar-filtros-de-rutas.mjs --paquete  # solo el bundle
 *
 * Sale con codigo 0 siempre: es una auditoria para leer, no una puerta.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR_FLUJOS = '.github/workflows';
const PAQUETE = new Set(['fuente.js', 'source-recovery/fuente-recuperado.js']);
const detalle = process.argv.includes('--detalle');
const soloPaquete = process.argv.includes('--paquete');

/* Se extrae el bloque `paths:` a mano en vez de con un analizador de YAML para
   no anadir una dependencia a un script de diagnostico. El bloque es una lista
   plana de cadenas entrecomilladas, que es facil de aislar sin ambiguedad. */
function rutasDelFiltro(texto) {
  const inicio = texto.indexOf('\n    paths:\n');
  if (inicio < 0) return null;
  const rutas = [];
  const lineas = texto.slice(inicio + '\n    paths:\n'.length).split('\n');
  for (const linea of lineas) {
    const m = linea.match(/^\s+- ['"]?(.+?)['"]?\s*$/);
    if (m) { rutas.push(m[1]); continue; }
    if (linea.trim().startsWith('#')) continue;
    break;
  }
  return rutas;
}

function cubierto(archivo, patrones) {
  for (const p of patrones) {
    if (archivo === p) return true;
    if (p.endsWith('/**') && archivo.startsWith(p.slice(0, -2))) return true;
    if (p.includes('*')) {
      const re = new RegExp('^' + p.split('*').map(x => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
      if (re.test(archivo)) return true;
    }
  }
  return false;
}

function archivosQueLee(texto) {
  const scripts = new Set();
  for (const re of [/(\.github\/scripts\/[\w\-./]+\.(?:mjs|js|sh))/g, /(tests\/[\w\-./]+\.(?:mjs|js))/g]) {
    for (const m of texto.matchAll(re)) scripts.add(m[1]);
  }
  const leidos = new Set();
  for (const s of scripts) {
    if (!fs.existsSync(s)) continue;
    const src = fs.readFileSync(s, 'utf8');
    for (const m of src.matchAll(/readFileSync\(\s*'([^']+)'/g)) {
      leidos.add(m[1].replace(/^\.\//, ''));
    }
  }
  return leidos;
}

let conFiltro = 0, sinFiltro = 0, leenPaquete = 0;
const ciegosAlPaquete = [];
const huecos = [];

for (const nombre of fs.readdirSync(DIR_FLUJOS).sort()) {
  if (!nombre.endsWith('.yml') && !nombre.endsWith('.yaml')) continue;
  const ruta = path.join(DIR_FLUJOS, nombre);
  const texto = fs.readFileSync(ruta, 'utf8');
  const filtro = rutasDelFiltro(texto);
  if (filtro === null) { sinFiltro++; continue; }
  conFiltro++;

  const leidos = [...archivosQueLee(texto)].filter(f => fs.existsSync(f));
  const faltan = leidos.filter(f => !cubierto(f, filtro)).sort();
  const delPaquete = leidos.filter(f => PAQUETE.has(f));
  if (delPaquete.length) {
    leenPaquete++;
    if (delPaquete.some(f => !cubierto(f, filtro))) ciegosAlPaquete.push(nombre);
  }
  if (faltan.length) huecos.push({ nombre, faltan });
}

console.log(`FLUJOS_CON_FILTRO=${conFiltro}`);
console.log(`FLUJOS_SIN_FILTRO=${sinFiltro}`);
console.log(`FLUJOS_QUE_LEEN_EL_PAQUETE=${leenPaquete}`);
console.log(`FLUJOS_CIEGOS_AL_PAQUETE=${ciegosAlPaquete.length}`);
console.log(`FLUJOS_CON_ALGUN_HUECO=${huecos.length}`);

if (soloPaquete || detalle) {
  console.log('\nCiegos al paquete (su contrato lo lee, su filtro no lo incluye):');
  for (const n of ciegosAlPaquete) console.log('  -', n);
}
if (detalle && !soloPaquete) {
  console.log('\nTodos los huecos:');
  for (const { nombre, faltan } of huecos) {
    console.log('  ' + nombre);
    for (const f of faltan) console.log('      falta:', f);
  }
}
