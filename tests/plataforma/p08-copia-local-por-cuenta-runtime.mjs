// Prueba de ejecución de la copia local separada por cuenta (D01, producto multiempresa).
//
// Motivo (prueba con Cowork, 9/10/2026): la copia local del navegador (almacen:*, almacen__*) no pertenece a ninguna cuenta.
// Una cuenta de otra empresa que entra en el mismo navegador la heredaba: el programa, al no recibir nada de la nube (la regla de
// acceso lo niega), caía a la copia local y mostraba datos de la otra empresa («Local recuperado» inventados a partir de sus
// productos y un aviso rojo al intentar guardarlos).
//
// Aquí se cargan los archivos REALES (candado previo, barrera temprana post-reset de producción, parche de generación) en un
// navegador simulado (jsdom) y se comprueba, con la barrera cerrada como en producción:
//   · una cuenta nueva no hereda nada de la anterior y la anterior recupera su copia INTACTA (byte a byte) al volver;
//   · la cola de subidas pendientes viaja con su cuenta (no se sube nada ajeno);
//   · copias anteriores a la mejora (sin marca) se reconocen por la cuenta que sembró el contexto, o se apartan sin dueño;
//   · en la vista previa de QA, los datos de demostración que siembra el navegador no los hereda otra empresa;
//   · interrupciones a medias, falta de espacio (se descarta la copia apartada más antigua, nunca la viva), cambio de generación;
//   · fallar cerrado: si no se puede separar, no se abre la sincronización ni se pierde nada.
//
// Necesita jsdom: CFG6_UI_DEPS (o CFG6E_UI_DEPS) = carpeta con node_modules que contenga jsdom.
//   CFG6_UI_DEPS=/tmp/cfg6deps node tests/plataforma/p08-copia-local-por-cuenta-runtime.mjs
// PLATAFORMA_PRELOCK y PLATAFORMA_EDGE (opcionales) permiten probar variantes rotas (mutantes).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const depsDir = process.env.CFG6E_UI_DEPS || process.env.CFG6_UI_DEPS;
if (!depsDir) {
  console.error('CFG6_UI_DEPS no está definido: indica una carpeta con node_modules (react@18.3.1, react-dom@18.3.1 y jsdom).');
  process.exit(2);
}
const require = createRequire(join(resolve(depsDir), 'package.json'));
const { JSDOM, VirtualConsole } = require('jsdom');

const REPO = resolve(new URL('../../', import.meta.url).pathname);
const leer = (f) => readFileSync(resolve(REPO, f), 'utf8');
const PRELOCK = leer(process.env.PLATAFORMA_PRELOCK || 'owner-bootstrap-prelock.js');
const BARRERA = leer('reset-pruebas-preview.js');
const EDGE = leer(process.env.PLATAFORMA_EDGE || 'edge-auth-patch.js');

const resultados = [];
const ventanas = []; // las páginas simuladas dejan temporizadores vivos (la barrera temprana vigila cada 25 ms): se cierran al terminar
const ok = (nombre, cond, det) => resultados.push({ nombre, ok: !!cond, det: cond ? undefined : det });
const A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const C = 'cccccccc-0000-4000-8000-00000000000c';

const GENERACION = 'gen-1';

// Una «página»: candado previo → barrera temprana real → parche de generación real, sobre un localStorage de jsdom.
async function pagina({ url = 'https://app.cliente.test/', almacenInicial = {}, cuota = null, generacionLocal = GENERACION } = {}) {
  const consola = new VirtualConsole();
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>',
    { url, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: consola, ...(cuota ? { storageQuota: cuota } : {}) });
  const w = dom.window;
  ventanas.push(w);
  // Primitivas del navegador ANTES de cargar ningún script: así el test lee lo que hay de verdad, sin pasar por la barrera.
  const crudoGet = w.Storage.prototype.getItem;
  const crudoSet = w.Storage.prototype.setItem;
  const crudoRemove = w.Storage.prototype.removeItem;
  for (const [k, v] of Object.entries(almacenInicial)) crudoSet.call(w.localStorage, k, v);
  if (generacionLocal) crudoSet.call(w.localStorage, 'la_suite_installation_generation_v1', generacionLocal);
  w.NUBE_URL = 'https://qjqorixtkilwsndqayyx.supabase.co';
  w.NUBE_CLAVE = 'clave-de-prueba';
  w.fetch = async () => ({ ok: true, status: 200, text: async () => '{}', json: async () => ({}) });
  w.eval(PRELOCK);
  w.eval(BARRERA);
  w.getSupabaseClient = async () => ({ auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; } } });
  w.eval(EDGE);
  const supabase = { rpc: async (n) => (n === 'obtener_generacion_instalacion' ? { data: { generation: GENERACION }, error: null } : { data: null, error: { message: 'no previsto' } }) };
  const crudo = {
    todo: () => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = crudoGet.call(w.localStorage, k); } return o; },
    get: (k) => crudoGet.call(w.localStorage, k),
    set: (k, v) => crudoSet.call(w.localStorage, k, v),
    remove: (k) => crudoRemove.call(w.localStorage, k),
    vivas: () => { const o = {}; const t = crudo.todo(); for (const k of Object.keys(t)) if (/^(almacen:|almacen__|chocoloyos_contexto_operativo_seguro_v1$)/.test(k)) o[k] = t[k]; return o; },
    apartadas: (cuenta) => { const o = {}; const t = crudo.todo(); const p = `la_suite_copia_cuenta_v1:${cuenta}:`; for (const k of Object.keys(t)) if (k.startsWith(p)) o[k.slice(p.length)] = t[k]; return o; }
  };
  return {
    w, crudo, supabase,
    entrar: (uid) => w.__prepararSesionPostReset(supabase, { user: { id: uid } }),
    // Lo que vería el programa (con la barrera temprana puesta, como en producción hasta validar la sesión).
    leyendoComoElPrograma: (k) => w.localStorage.getItem(k)
  };
}

const COPIA_A = {
  'almacen:productos': JSON.stringify([{ id: 'p1', nombre: 'Agua', localId: 'LOC-A1', empresaId: 'EMP-A' }, { id: 'p2', nombre: 'Vino', localId: 'LOC-A2', empresaId: 'EMP-A' }]),
  'almacen:locales': JSON.stringify([{ id: 'LOC-A1', empresaId: 'EMP-A', nombre: 'Local A1' }]),
  'almacen:empresas': JSON.stringify([{ id: 'EMP-A', razonSocial: 'Empresa A' }]),
  'almacen:conteos': JSON.stringify([{ id: 'c1', total: 12 }]),
  'almacen__pendientes': JSON.stringify(['productos', 'conteos']),
  'almacen__borrados:movimientos': JSON.stringify(['m1']),
  'almacen__denegados': JSON.stringify({ traspasos: 1 }),
  'almacen__ui_context_seed': JSON.stringify({ generation: GENERACION, userId: A, seededAt: 1 }),
  'chocoloyos_contexto_operativo_seguro_v1': JSON.stringify({ usuarioId: A, rol: 'Propietario' })
};

// ---- 1. Otra cuenta no hereda nada y la primera recupera su copia intacta ----
{
  const p = await pagina({ almacenInicial: { ...COPIA_A, la_suite_copia_cuenta_dueno_v1: A } });
  const antes = p.crudo.vivas();
  ok('1a. punto de partida: la copia viva es de A y el programa (con la barrera) no la ve', Object.keys(antes).length === Object.keys(COPIA_A).length && p.leyendoComoElPrograma('almacen:productos') === null, Object.keys(antes));

  const r = await p.entrar(B);
  ok('1b. entra B: se pide recargar la página y la sincronización NO se abre en esta pasada', r.generacionCambiada === true && r.copiaLocalCambiada === true && p.w.__laOwnerBootstrapSyncState().syncSolicitada === false, JSON.stringify(r));
  ok('1c. B no tiene ni una clave del programa heredada', Object.keys(p.crudo.vivas()).length === 0, Object.keys(p.crudo.vivas()));
  const apartadaA = p.crudo.apartadas(A);
  ok('1d. la copia de A está apartada ENTERA y sin cambiar un solo byte', JSON.stringify(apartadaA) === JSON.stringify(COPIA_A), Object.keys(apartadaA));

  // Tras recargar, B ya es la dueña de la copia viva y no vuelve a haber cambio.
  const r2 = await p.entrar(B);
  ok('1e. segunda pasada de B: nada que cambiar, ya se solicita abrir la sincronización', r2.copiaLocalCambiada === false && r2.generacionCambiada === false && p.w.__laOwnerBootstrapSyncState().syncSolicitada === true, JSON.stringify(r2));

  // B trabaja con su propia copia.
  p.crudo.set('almacen:productos', JSON.stringify([{ id: 'b1', localId: 'LOC-B1' }]));
  p.crudo.set('almacen__pendientes', JSON.stringify(['productos']));
  const copiaB = p.crudo.vivas();

  // Vuelve A: recupera la suya exacta; la de B queda apartada.
  const r3 = await p.entrar(A);
  ok('1f. vuelve A: se pide recargar', r3.copiaLocalCambiada === true, JSON.stringify(r3));
  ok('1g. A recupera su copia viva IDÉNTICA (incluida la cola de subidas pendientes)', JSON.stringify(p.crudo.vivas()) === JSON.stringify(COPIA_A) || (Object.keys(COPIA_A).every((k) => p.crudo.vivas()[k] === COPIA_A[k]) && Object.keys(p.crudo.vivas()).length === Object.keys(COPIA_A).length), Object.keys(p.crudo.vivas()));
  ok('1h. la copia de B quedó apartada intacta y A ya no tiene nada apartado', JSON.stringify(p.crudo.apartadas(B)) === JSON.stringify(copiaB) && Object.keys(p.crudo.apartadas(A)).length === 0);
  ok('1i. la cola de subidas de B no se mezcla con la de A', JSON.parse(p.crudo.vivas()['almacen__pendientes']).join() === 'productos,conteos' && JSON.parse(p.crudo.apartadas(B)['almacen__pendientes']).join() === 'productos');

  // Ida y vuelta varias veces: nada se pierde ni se duplica.
  for (let i = 0; i < 3; i++) { await p.entrar(B); await p.entrar(B); await p.entrar(A); await p.entrar(A); }
  ok('1j. varias idas y vueltas: la copia de A sigue idéntica', Object.keys(COPIA_A).every((k) => p.crudo.vivas()[k] === COPIA_A[k]) && Object.keys(p.crudo.vivas()).length === Object.keys(COPIA_A).length);
}

// ---- 2. Mismo usuario: no se toca nada ----
{
  const p = await pagina({ almacenInicial: { ...COPIA_A, la_suite_copia_cuenta_dueno_v1: A } });
  const r = await p.entrar(A);
  ok('2a. la misma cuenta no cambia nada y abre la sincronización', r.copiaLocalCambiada === false && r.generacionCambiada === false && p.crudo.vivas()['almacen:productos'] === COPIA_A['almacen:productos'] && Object.keys(p.crudo.apartadas(A)).length === 0, JSON.stringify(r));
  const q = await pagina({});
  const r2 = await q.entrar(A);
  ok('2b. navegador limpio: la primera cuenta se queda con la copia viva sin recargar', r2.copiaLocalCambiada === false && q.crudo.get('la_suite_copia_cuenta_dueno_v1') === A, JSON.stringify(r2));
}

// ---- 3. Copias anteriores a la mejora (sin marca de dueño) ----
{
  const p = await pagina({ almacenInicial: { ...COPIA_A } }); // trae almacen__ui_context_seed de A, pero ninguna marca propia
  const r = await p.entrar(B);
  ok('3a. sin marca, la copia se reconoce como de A por la cuenta que sembró el contexto y se aparta', r.copiaLocalCambiada === true && JSON.stringify(p.crudo.apartadas(A)) === JSON.stringify(COPIA_A) && Object.keys(p.crudo.vivas()).length === 0, JSON.stringify(r));
  const q = await pagina({ almacenInicial: { 'almacen:productos': '[1,2,3]', 'almacen__pendientes': '["productos"]' } }); // ni marca ni semilla
  const r2 = await q.entrar(B);
  ok('3b. sin marca ni semilla, se aparta como «sin dueño» (nunca se borra) y B arranca limpia', r2.copiaLocalCambiada === true && q.crudo.apartadas('sin-dueno')['almacen:productos'] === '[1,2,3]' && Object.keys(q.crudo.vivas()).length === 0);
  const r3 = await q.entrar(C);
  ok('3c. «sin dueño» no se devuelve a ninguna cuenta', r3.copiaLocalCambiada === false && Object.keys(q.crudo.vivas()).length === 0 && q.crudo.apartadas('sin-dueno')['almacen:productos'] === '[1,2,3]');
}

// ---- 4. Vista previa de QA: los datos de demostración que siembra el navegador ----
{
  const p = await pagina({ url: 'https://deploy-preview-118--chic-entremet-9107cf.netlify.app/' }); // el navegador ya conocía la generación vigente
  const sembrado = p.crudo.vivas();
  ok('4a. la vista previa siembra productos de demostración de QA-EMP-A en el navegador', !!sembrado['almacen:productos'] && /QA-A1/.test(sembrado['almacen:productos']), Object.keys(sembrado));
  const r = await p.entrar(C); // la dueña de una empresa nueva
  ok('4b. una cuenta de otra empresa NO hereda los productos de demostración (esto causaba los «Local recuperado»)', Object.keys(p.crudo.vivas()).length === 0 && /QA-A1/.test(p.crudo.apartadas('sin-dueno')['almacen:productos'] || ''));
  ok('4c. se pide recargar para que el programa arranque con la copia limpia', r.generacionCambiada === true, JSON.stringify(r));
}

// ---- 5. Interrupciones a medias ----
{
  // 5a. Se cortó el apartado: parte de la copia de A ya está apartada, parte sigue viva, y la marca sigue siendo A.
  const medio = { ...COPIA_A, la_suite_copia_cuenta_dueno_v1: A };
  const p = await pagina({ almacenInicial: medio });
  p.crudo.set(`la_suite_copia_cuenta_v1:${A}:almacen:productos`, COPIA_A['almacen:productos']);
  p.crudo.remove('almacen:productos');
  await p.entrar(B);
  ok('5a. apartado interrumpido: la siguiente pasada lo termina sin perder nada', Object.keys(p.crudo.vivas()).length === 0 && JSON.stringify(p.crudo.apartadas(A)) === JSON.stringify(COPIA_A));

  // 5b. Se cortó la devolución: la marca ya es A, parte de su copia sigue apartada.
  const q = await pagina({ almacenInicial: { la_suite_copia_cuenta_dueno_v1: A, 'almacen:conteos': COPIA_A['almacen:conteos'], [`la_suite_copia_cuenta_v1:${A}:almacen:productos`]: COPIA_A['almacen:productos'], [`la_suite_copia_cuenta_v1:${A}:almacen:conteos`]: '[{"viejo":true}]' } });
  const r = await q.entrar(A);
  ok('5b. devolución interrumpida: se completa; lo ya vivo manda (es más reciente)', q.crudo.vivas()['almacen:productos'] === COPIA_A['almacen:productos'] && q.crudo.vivas()['almacen:conteos'] === COPIA_A['almacen:conteos'] && Object.keys(q.crudo.apartadas(A)).length === 0 && r.copiaLocalCambiada === true, JSON.stringify(r));
}

// ---- 6. Cambio de generación (reinstalación): también se descartan las copias apartadas ----
{
  const p = await pagina({ almacenInicial: { ...COPIA_A, la_suite_copia_cuenta_dueno_v1: A }, generacionLocal: 'gen-antigua' });
  p.crudo.set(`la_suite_copia_cuenta_v1:${B}:almacen:productos`, '[1]');
  p.crudo.set('la_suite_copia_cuenta_indice_v1', JSON.stringify({ [B]: 5 }));
  const r = await p.entrar(C);
  const resto = p.crudo.todo();
  ok('6a. con generación nueva se borra todo lo de la instalación anterior, también lo apartado y las marcas', r.generacionCambiada === true && Object.keys(resto).filter((k) => k.startsWith('la_suite_copia_cuenta_v1:')).length === 0 && !resto.la_suite_copia_cuenta_indice_v1 && Object.keys(p.crudo.vivas()).length === 0, Object.keys(resto));
  ok('6b. y la cuenta que entra queda como dueña de la copia viva', p.crudo.get('la_suite_copia_cuenta_dueno_v1') === C);
}

// ---- 7. Falta de espacio ----
{
  const grande = (c) => c.repeat(1200);
  const base = {
    'almacen:productos': grande('a'), 'almacen:locales': '[]', la_suite_copia_cuenta_dueno_v1: A,
    [`la_suite_copia_cuenta_v1:${B}:almacen:productos`]: grande('b'), [`la_suite_copia_cuenta_v1:${B}:almacen:locales`]: '[]',
    [`la_suite_copia_cuenta_v1:${C}:almacen:productos`]: grande('c'), [`la_suite_copia_cuenta_v1:${C}:almacen:locales`]: '[]',
    la_suite_copia_cuenta_indice_v1: JSON.stringify({ [B]: 100, [C]: 200 })
  };
  const total = Object.entries(base).reduce((n, [k, v]) => n + k.length + v.length, 0);
  // Cabe lo que hay y poco más: apartar la copia de A (≈1.2k, y mientras se aparta existen las dos) obliga a descartar la apartada más antigua.
  const p = await pagina({ almacenInicial: base, cuota: total + 700, generacionLocal: GENERACION });
  const r = await p.entrar('dddddddd-0000-4000-8000-00000000000d');
  ok('7a. sin espacio se descarta la copia apartada MÁS ANTIGUA (B), no la de A ni la más reciente (C)',
    r.copiaLocalCambiada === true && Object.keys(p.crudo.apartadas(B)).length === 0 && p.crudo.apartadas(C)['almacen:productos'] === grande('c') && p.crudo.apartadas(A)['almacen:productos'] === grande('a'),
    JSON.stringify({ B: Object.keys(p.crudo.apartadas(B)), C: Object.keys(p.crudo.apartadas(C)), A: Object.keys(p.crudo.apartadas(A)) }));

  // Si no hay nada que descartar y no cabe, falla cerrado: no se abre la sincronización y la copia viva sigue intacta.
  const q = await pagina({ almacenInicial: { 'almacen:productos': grande('z'), la_suite_copia_cuenta_dueno_v1: A }, cuota: 1300 + 60, generacionLocal: GENERACION });
  let error = null;
  try { await q.entrar(B); } catch (e) { error = e; }
  ok('7b. si no cabe y no hay nada que descartar, falla cerrado: error, sincronización cerrada y la copia de A intacta', !!error && q.w.__instalacionSyncPermitida !== true && q.crudo.vivas()['almacen:productos'] === grande('z') && q.crudo.get('la_suite_copia_cuenta_dueno_v1') === A, error && error.message);
}

// ---- 7c. Falta de espacio con una copia a medio apartar: nunca se descarta lo ya apartado de la propia cuenta ----
{
  const grande = (c) => c.repeat(1200);
  const base = {
    'almacen:productos': grande('a'), la_suite_copia_cuenta_dueno_v1: A,
    [`la_suite_copia_cuenta_v1:${A}:almacen:conteos`]: grande('q'), // ya apartado antes de una interrupción
    [`la_suite_copia_cuenta_v1:${C}:almacen:productos`]: grande('c'),
    la_suite_copia_cuenta_indice_v1: JSON.stringify({ [C]: 200 })
  };
  const total = Object.entries(base).reduce((n, [k, v]) => n + k.length + v.length, 0);
  const p = await pagina({ almacenInicial: base, cuota: total + 700, generacionLocal: GENERACION });
  const r = await p.entrar(B);
  ok('7c. al terminar de apartar una copia a medias, si falta espacio se descarta la de OTRA cuenta (C) y no lo ya apartado de A',
    r.copiaLocalCambiada === true && p.crudo.apartadas(A)['almacen:conteos'] === grande('q') && p.crudo.apartadas(A)['almacen:productos'] === grande('a') && Object.keys(p.crudo.apartadas(C)).length === 0,
    JSON.stringify({ A: Object.keys(p.crudo.apartadas(A)), C: Object.keys(p.crudo.apartadas(C)) }));
}

// ---- 8. Entradas no válidas y contrato del candado ----
{
  const p = await pagina({});
  const sep = p.w.__laOwnerBootstrapSepararCopiaLocal;
  const falla = (f) => { try { f(); return null; } catch (e) { return e.message; } };
  ok('8a. rechaza cuentas no válidas', /no válida/.test(falla(() => sep(''))) && /no válida/.test(falla(() => sep(null))) && /no válida/.test(falla(() => sep('a:b'))));
  ok('8b. sin sesión, prepararSesionPostReset ni lo intenta', /Sesión no disponible/.test(await p.w.__prepararSesionPostReset(p.supabase, null).then(() => '', (e) => e.message)));
  const prelockFuente = PRELOCK;
  const cuerpo = prelockFuente.slice(prelockFuente.indexOf('window.__laOwnerBootstrapSepararCopiaLocal = function'), prelockFuente.indexOf('// Canal estrecho que conserva acceso a fetch'));
  ok('8c. la función usa SOLO las primitivas originales (la barrera temprana devolvería null y descartaría escrituras)', !/localStorage\.(getItem|setItem|removeItem)\(/.test(cuerpo) && /leerNativo\(/.test(cuerpo) && /quitarNativo\(/.test(cuerpo));
}

const fallos = resultados.filter((r) => !r.ok);
for (const r of resultados) console.log(`${r.ok ? 'OK ' : 'FALLO'} ${r.nombre}${r.ok ? '' : ' → ' + (typeof r.det === 'string' ? r.det : JSON.stringify(r.det))}`);
console.log(`PLATAFORMA_P08_COPIA_LOCAL: ${resultados.length - fallos.length}/${resultados.length}`);
for (const w of ventanas) { try { w.close(); } catch {} }
if (fallos.length) process.exit(1);
console.log('PLATAFORMA_P08_COPIA_LOCAL_POR_CUENTA_RUNTIME=PASS');
