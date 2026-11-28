/**
 * Contrato de ejecución de H-33 (auditoría del TPV, 25/11/2026): el código llevaba fijas direcciones de funciones Edge de
 * PRODUCCIÓN en 12 sitios; en una Deploy Preview solo las contenían la política de seguridad del navegador y la barrera de
 * reset-pruebas-preview.js. Ahora las funciones se llaman en el mismo proyecto que la base de datos (`window.NUBE_URL`).
 *
 *   node tests/rediseno/h33-funciones-edge-del-mismo-proyecto-contract.mjs
 *   H33_FUENTE=/ruta/otra/fuente.js node tests/rediseno/h33-...   (para comprobar que el código anterior falla)
 *
 *   A. Estático: en fuente.js y en el espejo no queda ninguna dirección de producción salvo la de `crear-cuenta-empleado`
 *      (rama de producción de un enrutado ya existente, fijado por p11-create-account-routing-contract.mjs); ni en edge-auth-patch.js.
 *   B. `urlFuncionNubeA` (ejecutada): producción → producción; QA → QA; sin nube → dirección .invalid, nunca de producción ni relativa.
 *   C. El adaptador de sesión (edge-auth-patch.js y su copia embebida, ejecutados con un `window` simulado) añade el token a las
 *      funciones protegidas del proyecto CONFIGURADO, sea producción o QA, y no a otro origen.
 */
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const PROD = 'https://flqercbgpgmmfaakrwkc.supabase.co';
const QA = 'https://qjqorixtkilwsndqayyx.supabase.co';
const fuente = await readFile(process.env.H33_FUENTE || path.join(raiz, 'fuente.js'), 'utf8');
const espejo = await readFile(path.join(raiz, 'source-recovery/fuente-recuperado.js'), 'utf8');
const parche = await readFile(path.join(raiz, 'edge-auth-patch.js'), 'utf8');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

// ---------- A ----------
const lineasProd = (t) => t.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => l.includes('flqercbgpgmmfaakrwkc'));
for (const [nombre, texto] of [['fuente.js', fuente], ['source-recovery/fuente-recuperado.js', espejo]]) {
  const restantes = lineasProd(texto).filter(([, l]) => !l.includes('crear-cuenta-empleado'));
  check(`A ${nombre}: ninguna dirección de producción salvo la de crear-cuenta-empleado`, restantes.length === 0, restantes.map(([n]) => n).join(','));
}
check('A edge-auth-patch.js no lleva ninguna dirección de producción', lineasProd(parche).length === 0);

// ---------- B ----------
const m = fuente.match(/function urlFuncionNubeA\(nombre\) \{[\s\S]*?\n\}\n/);
check('B0 existe urlFuncionNubeA', !!m);
if (m) {
  const con = (win) => new Function('window', `${m[0]}\nreturn urlFuncionNubeA;`)(win);
  check('B1 producción: la función va a producción', con({ NUBE_URL: PROD })('enviar-notificacion') === `${PROD}/functions/v1/enviar-notificacion`);
  check('B2 Deploy Preview (QA): va a QA', con({ NUBE_URL: QA })('importar-albaran') === `${QA}/functions/v1/importar-albaran`);
  check('B3 una barra final no duplica la separación', con({ NUBE_URL: QA + '/' })('importar-nomina') === `${QA}/functions/v1/importar-nomina`);
  const sin = con({ NUBE_URL: '' })('prefiltro-candidato');
  check('B4 sin nube (modo local): dirección que no resuelve, ni de producción ni relativa', /^https:\/\/sin-nube\.invalid\//.test(sin) && !sin.includes('flqercbgp'), sin);
  check('B5 sin window.NUBE_URL: igual', /^https:\/\/sin-nube\.invalid\//.test(con({})('entrevista-personal')));
}

// ---------- C ----------
async function ejecutaAdaptador(codigo, nubeUrl, urlLlamada) {
  const llamadas = [];
  const win = {
    NUBE_URL: nubeUrl,
    fetch: async (input, init) => { llamadas.push({ url: typeof input === 'string' ? input : input.url, headers: init && init.headers }); return { ok: true, fake: true }; },
    getSupabaseClient: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'TOKEN-DE-PRUEBA' } } }) } })
  };
  win.window = win;
  const ctx = vm.createContext({ window: win, Headers, Response, Request, console });
  vm.runInContext(codigo, ctx);
  await win.fetch(urlLlamada, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  const h = llamadas[llamadas.length - 1];
  const cab = h && h.headers ? new Headers(h.headers) : new Headers();
  return cab.get('Authorization');
}
const adaptadorEmbebido = (() => {
  const a = fuente.indexOf('// ../edge-auth-patch.js\n(function() {');
  const b = fuente.indexOf('})();', a);
  return a >= 0 && b > a ? fuente.slice(a, b + 5) : '';
})();
// Del archivo suelto se toma solo el primer adaptador (el resto del archivo es otra barrera).
const adaptadorSuelto = (() => {
  const a = parche.indexOf('(function () {');
  const b = parche.indexOf('})();', a);
  return a >= 0 && b > a ? parche.slice(a, b + 5) : '';
})();
for (const [nombre, codigo] of [['edge-auth-patch.js', adaptadorSuelto], ['copia embebida en fuente.js', adaptadorEmbebido]]) {
  check(`C0 se localizó el adaptador (${nombre})`, codigo.length > 300);
  if (codigo.length <= 300) continue;
  check(`C1 ${nombre}: producción configurada → añade el token a una función protegida de producción`, (await ejecutaAdaptador(codigo, PROD, `${PROD}/functions/v1/enviar-notificacion`)) === 'Bearer TOKEN-DE-PRUEBA');
  check(`C2 ${nombre}: QA configurado → añade el token a la función protegida de QA`, (await ejecutaAdaptador(codigo, QA, `${QA}/functions/v1/importar-albaran`)) === 'Bearer TOKEN-DE-PRUEBA');
  check(`C3 ${nombre}: QA configurado → NO toca una llamada a la dirección de producción`, (await ejecutaAdaptador(codigo, QA, `${PROD}/functions/v1/enviar-notificacion`)) === null);
  check(`C4 ${nombre}: una función no protegida no recibe el token`, (await ejecutaAdaptador(codigo, QA, `${QA}/functions/v1/otra-cosa`)) === null);
  check(`C5 ${nombre}: sin nube configurada no hace nada`, (await ejecutaAdaptador(codigo, '', `${QA}/functions/v1/importar-albaran`)) === null);
}

console.log(fallos === 0 ? 'H33_FUNCIONES_EDGE_DEL_MISMO_PROYECTO_CONTRACT=PASS' : `H33_FUNCIONES_EDGE_DEL_MISMO_PROYECTO_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
