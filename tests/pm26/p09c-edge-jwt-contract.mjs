import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// P09c no modifica la aplicación: prueba el adaptador JWT ya presente en el
// fuente.js publicado. Todo token y toda respuesta son sintéticos.
const __filename = fileURLToPath(import.meta.url);
const RAIZ = path.resolve(path.dirname(__filename), '..', '..');
const SNAPSHOT = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/pm26/p09b-compatibilidad-release-produccion/snapshot-saneado.json'), 'utf8'));
const DOC = fs.readFileSync(path.join(RAIZ, 'tests/pm26/P09C_RECTIFICACION_EDGE_JWT.md'), 'utf8');
const PROTEGIDAS = ['entrevista-personal', 'enviar-notificacion', 'importar-albaran', 'importar-nomina'];

class HeadersSinteticos {
  constructor(origen = {}) {
    this.valores = new Map();
    if (origen instanceof HeadersSinteticos) origen.valores.forEach((v, k) => this.valores.set(k, v));
    else if (origen && typeof origen.forEach === 'function') origen.forEach((v, k) => this.valores.set(String(k).toLowerCase(), String(v)));
    else Object.entries(origen || {}).forEach(([k, v]) => this.valores.set(k.toLowerCase(), String(v)));
  }
  has(nombre) { return this.valores.has(nombre.toLowerCase()); }
  set(nombre, valor) { this.valores.set(nombre.toLowerCase(), String(valor)); }
  get(nombre) { return this.valores.get(nombre.toLowerCase()) || null; }
}

class ResponseSintetica {
  constructor(body, init = {}) { this.body = body; this.status = init.status || 200; this.headers = new HeadersSinteticos(init.headers); }
}

class RequestSintetica { constructor(url, headers = {}) { this.url = url; this.headers = new HeadersSinteticos(headers); } }

function extraerAdaptador(fuente) {
  const inicio = fuente.indexOf('// ../edge-auth-patch.js');
  assert.notEqual(inicio, -1, 'falta el adaptador Edge JWT en fuente.js de release');
  const fin = fuente.indexOf('\n})();', inicio);
  assert.notEqual(fin, -1, 'adaptador Edge JWT sin cierre');
  return fuente.slice(inicio, fin + 6);
}

function ejecutarAdaptador(adaptador, token) {
  const llamadas = [];
  let lecturasSesion = 0;
  const window = {
    fetch: async (input, init) => { llamadas.push({ input, init }); return new ResponseSintetica('{}', { status: 204 }); },
    getSupabaseClient: async () => ({ auth: { getSession: async () => { lecturasSesion++; return { data: { session: token ? { access_token: token } : null } }; } } })
  };
  vm.runInNewContext(adaptador, { window, Headers: HeadersSinteticos, Response: ResponseSintetica, Request: RequestSintetica });
  return { window, llamadas, lecturasSesion: () => lecturasSesion };
}

function selfTest() {
  const adaptador = `(function(){ var original = window.fetch.bind(window); window.fetch = async function(url, init) { var h = new Headers(init.headers); if (url === 'protegida') { var s = await window.getSupabaseClient(); var r = await s.auth.getSession(); if (!r.data.session) return new Response('{}', {status:401}); if (!h.has('Authorization')) h.set('Authorization', 'Bearer ' + r.data.session.access_token); init = Object.assign({}, init, {headers:h}); } return original(url, init); }; })();`;
  const e = ejecutarAdaptador(adaptador, 'token-sintetico');
  e.window.fetch('protegida', { headers: { 'Content-Type': 'application/json' } }).then(() => {
    assert.equal(e.llamadas[0].init.headers.get('Authorization'), 'Bearer token-sintetico');
    console.log('PM26_P09C_SELF_TEST=PASS');
  });
}

if (process.env.PM26_P09C_SELF_TEST === '1') { selfTest(); await new Promise(resolve => setTimeout(resolve, 0)); process.exit(0); }

const releaseSha = SNAPSHOT.release.commit;
execFileSync('git', ['cat-file', '-e', `${releaseSha}^{commit}`], { cwd: RAIZ });
const fuente = execFileSync('git', ['show', `${releaseSha}:fuente.js`], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const adaptador = extraerAdaptador(fuente);
const origen = adaptador.match(/https:\/\/[^"']+\/functions\/v1\//)?.[0];
assert.ok(origen, 'adaptador Edge JWT sin origen de funciones');
for (const nombre of PROTEGIDAS) assert.match(adaptador, new RegExp(`"${nombre}": true`));

const conSesion = ejecutarAdaptador(adaptador, 'token-sintetico');
for (const nombre of PROTEGIDAS) {
  await conSesion.window.fetch(`${origen}${nombre}`, { headers: { 'Content-Type': 'application/json' } });
}
assert.equal(conSesion.llamadas.length, 4);
for (const llamada of conSesion.llamadas) assert.equal(llamada.init.headers.get('Authorization'), 'Bearer token-sintetico');

const existente = ejecutarAdaptador(adaptador, 'token-sintetico');
await existente.window.fetch(`${origen}importar-nomina`, { headers: { Authorization: 'Bearer aportado-por-llamador' } });
assert.equal(existente.llamadas[0].init.headers.get('Authorization'), 'Bearer aportado-por-llamador');

const sinSesion = ejecutarAdaptador(adaptador, null);
const respuesta = await sinSesion.window.fetch(`${origen}entrevista-personal`, { headers: {} });
assert.equal(respuesta.status, 401);
assert.equal(sinSesion.llamadas.length, 0);

const publica = ejecutarAdaptador(adaptador, null);
await publica.window.fetch(`${origen}prefiltro-candidato`, { headers: {} });
assert.equal(publica.llamadas.length, 1);
assert.equal(publica.lecturasSesion(), 0);

assert.match(DOC, /CORRECCIÓN DE DIAGNÓSTICO, SIN CAMBIO FUNCIONAL/i);
assert.match(DOC, /0 de\s+6 integraciones Edge incompatibles por JWT/i);
console.log('PM26_P09C_ADAPTADOR_EXTRAIDO_DE_RELEASE=PASS');
console.log('PM26_P09C_CUATRO_RUTAS_LLEVAN_JWT=PASS');
console.log('PM26_P09C_CABECERA_EXISTENTE_SE_CONSERVA=PASS');
console.log('PM26_P09C_SIN_SESION_NO_ENVIA_PETICION=PASS');
console.log('PM26_P09C_RUTA_PUBLICA_NO_SE_INTERCEPTA=PASS');
