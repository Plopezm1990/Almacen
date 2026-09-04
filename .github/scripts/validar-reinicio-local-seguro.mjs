import fs from 'node:fs';
import vm from 'node:vm';

const codigo = fs.readFileSync('reset-pruebas-preview.js', 'utf8');

function crearStorage(inicial = {}) {
  const mapa = new Map(Object.entries(inicial));
  return {
    get length() { return mapa.size; },
    key(i) { return [...mapa.keys()][i] ?? null; },
    getItem(k) { return mapa.has(k) ? mapa.get(k) : null; },
    setItem(k, v) { mapa.set(String(k), String(v)); },
    removeItem(k) { mapa.delete(k); },
    dump() { return Object.fromEntries(mapa.entries()); }
  };
}

async function ejecutar(hostname, inicial) {
  const localStorage = crearStorage(inicial);
  let red = 0;
  const window = {
    location: { hostname, href: `https://${hostname}/` },
    localStorage,
    fetch: async () => { red += 1; return { ok: true }; },
    URL
  };
  const contexto = vm.createContext({ window, localStorage, URL, console, Promise });
  vm.runInContext(codigo, contexto);
  return { window, localStorage, red };
}

const datos = {
  'almacen:empresas': '[{"id":"chocoloyos"}]',
  'almacen:locales': '[{"id":"centro"}]',
  'almacen:configEmpresa': '{"marca":"Chocoloyos"}',
  'almacen:productos': '[{"id":"p1"}]',
  'almacen:movimientos': '[{"id":"m1"}]',
  'almacen:pinPropietario': '1234',
  'almacen:temaOscuro': 'true',
  'almacen:usuarioActivoId': 'empleado-antiguo',
  'almacen__pendientes': '["productos"]',
  'almacen__borrados:productos': '["p1"]',
  'almacen__caducidades_avisadas': '["x"]',
  'la_suite_reset_pruebas_multilocal_v1': '1',
  'sb-flqercbgpgmmfaakrwkc-auth-token': 'SESION_TECNICA',
  'otra-app': 'NO_TOCAR'
};

for (const host of [
  'deploy-preview-99--chic-entremet-9107cf.netlify.app',
  '6a9a7afd0fe79b0009cac69b--chic-entremet-9107cf.netlify.app'
]) {
  const r = await ejecutar(host, datos);
  const fin = r.localStorage.dump();
  const prohibidas = Object.keys(fin).filter(k => k.startsWith('almacen:') || k.startsWith('almacen__') || k.startsWith('la_suite_reset_pruebas_'));
  if (prohibidas.length) throw new Error(`${host}: quedaron claves antiguas: ${prohibidas.join(', ')}`);
  if (fin['sb-flqercbgpgmmfaakrwkc-auth-token'] !== 'SESION_TECNICA') throw new Error(`${host}: se perdió la sesión técnica`);
  if (fin['otra-app'] !== 'NO_TOCAR') throw new Error(`${host}: se tocó una clave ajena`);
  if (fin['la_suite_reset_total_20260904_v2'] !== '1') throw new Error(`${host}: falta marcador v2`);
  if (r.window.__reinicioLocalSeguroVersion !== '20260904-v2') throw new Error(`${host}: no quedó versión de reinicio`);
  if (!r.window.__modoPruebasLocal || !r.window.__qaFetchProduccionBloqueado) throw new Error(`${host}: faltan barreras QA`);

  let bloqueo = '';
  try { await r.window.fetch('https://flqercbgpgmmfaakrwkc.supabase.co/rest/v1/almacen_kv'); }
  catch (e) { bloqueo = String(e?.message || e); }
  if (!bloqueo.includes('QA_BLOCKED_PRODUCTION_SUPABASE')) throw new Error(`${host}: no bloqueó Supabase productivo`);
}

for (const host of [
  'chic-entremet-9107cf.netlify.app',
  'main--chic-entremet-9107cf.netlify.app'
]) {
  const r = await ejecutar(host, datos);
  const fin = r.localStorage.dump();
  if (fin['almacen:productos'] !== datos['almacen:productos']) throw new Error(`${host}: producción/main fue modificada`);
  if (r.window.__reinicioLocalSeguroVersion) throw new Error(`${host}: se activó el reset fuera de Preview`);
}

console.log('REINICIO_LOCAL_TOTAL_OK=1');
console.log('SESION_TECNICA_CONSERVADA=1');
console.log('COLAS_ANTIGUAS_ELIMINADAS=1');
console.log('PRODUCCION_NO_AFECTADA=1');
