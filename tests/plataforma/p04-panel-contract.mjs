// Contrato del panel «Plataforma» y de la pantalla «Elige tu contraseña» (fase 3 del plan de altas y bajas de empresas).
//
// Sin navegador ni librerías: carga plataforma-panel.js en un contexto aislado y prueba
//   · las reglas puras (contraseñas, identificadores de operación, validación del alta, estados y botones, textos de error),
//     comparándolas con las del servidor para que cliente y servidor no se separen;
//   · que los canales del arranque solo dejan pasar las funciones de plataforma previstas (y ninguna más);
//   · que el gancho del arranque pregunta por la contraseña inicial y por el administrador ANTES de la instalación;
//   · que el panel no usa innerHTML ni guarda contraseñas en el navegador;
//   · que la pantalla de Empresas del programa no ofrece «Añadir empresa» cuando la plataforma está activa.
// Las pruebas con pantalla montada están en p05 y p06 (necesitan jsdom).
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import assert from 'node:assert/strict';
import { motivoContrasenaDebil } from '../../supabase/functions/_shared/plataforma-propietario.js';

const leer = (f) => fs.readFileSync(f, 'utf8');
// Las variables de entorno permiten probar variantes rotas (mutantes) de cada archivo.
const panelSrc = leer(process.env.PLATAFORMA_PANEL || 'plataforma-panel.js');
const prelock = leer(process.env.PLATAFORMA_PRELOCK || 'owner-bootstrap-prelock.js');
const flujo = leer(process.env.PLATAFORMA_FLUJO || 'owner-bootstrap-post-reset.js');
const index = leer('index.html');
const headers = leer('_headers');
const migracion = leer(process.env.PLATAFORMA_MIGRACION || 'supabase/migrations/20261009120000_plataforma_f1_administrador_y_empresas.sql');

function cargar() {
  const ventana = { crypto: webcrypto };
  const ctx = { window: ventana, document: {}, console, setTimeout, Uint8Array, Date, Promise };
  vm.createContext(ctx);
  vm.runInContext(panelSrc, ctx, { filename: 'plataforma-panel.js' });
  return ventana.__laPlataforma;
}
const P = cargar();
const puro = P._puro;
// Lo que sale del contexto aislado tiene otros prototipos: se compara por su forma JSON.
const J = (x) => JSON.parse(JSON.stringify(x));

// ---- 1. Contraseñas: el cliente avisa con la misma regla que el servidor ----
{
  const casos = [
    ['', 'a@b.com'], ['abc', 'a@b.com'], ['abcdef12', 'a@b.com'], ['abcdefg12', 'a@b.com'], ['abcdefghij', 'a@b.com'], ['1234567890', 'a@b.com'],
    ['abcdefg123', 'a@b.com'], ['Abcdefg1234', 'a@b.com'], ['pedro.garcia12', 'pedro.garcia@x.com'],
    ['PEDRO.GARCIA12', 'pedro.garcia@x.com'], ['ana1234567', 'ana@x.com'], ['contraseña12', 'z@x.com'],
    ['a'.repeat(199) + '1', 'z@x.com'], ['a'.repeat(200) + '1', 'z@x.com'], ['abcde-12345', ''], [null, 'a@b.com'], [12345678901, 'a@b.com'],
    ['xxxx-xxxx-1111', 'xxxx@x.com'], ['Ñandú12345', 'q@x.com']
  ];
  for (const [pass, email] of casos) {
    assert.equal(puro.contrasenaDebil(pass, email), motivoContrasenaDebil(pass, email), `cliente y servidor discrepan con ${JSON.stringify(pass)} / ${email}`);
  }
  assert.equal(puro.contrasenaDebil('abcdefg123', 'a@b.com'), null);
  assert.match(puro.contrasenaDebil('corta1', 'a@b.com'), /al menos 10/);
  assert.match(puro.contrasenaDebil('abcdefg12', 'a@b.com'), /al menos 10/, 'nueve caracteres no bastan');
  assert.equal(puro.contrasenaDebil('abcdefgh12', 'a@b.com'), null, 'diez sí');
  assert.match(puro.contrasenaDebil('sololetrasaqui', 'a@b.com'), /letras y números/);
  console.log('P04_CONTRASENA_IGUAL_QUE_SERVIDOR=PASS');
}

// ---- 2. Contraseña inicial generada ----
{
  const LEGIBLE = /^[a-km-zA-HJ-NP-Z2-9]{4}-[a-km-zA-HJ-NP-Z2-9]{4}-[a-km-zA-HJ-NP-Z2-9]{4}$/;
  const vistas = new Set();
  for (let i = 0; i < 400; i++) {
    const p = puro.generarContrasena('dueno@empresa.com');
    assert.match(p, LEGIBLE, 'formato legible, sin caracteres ambiguos');
    assert.equal(motivoContrasenaDebil(p, 'dueno@empresa.com'), null, 'siempre pasa la regla del servidor');
    assert.ok(!vistas.has(p), 'no se repite');
    vistas.add(p);
  }
  // Determinista con bytes controlados.
  assert.equal(puro.generarContrasena('', (n) => new Uint8Array(n)), 'aaa2-aaa2-aaa2');
  // Si la primera sale débil (contiene el correo), se vuelve a intentar con otros bytes.
  let llamadas = 0;
  const rng = (n) => { llamadas++; return new Uint8Array(n).fill(llamadas === 1 ? 0 : 1); };
  assert.equal(puro.generarContrasena('aaa2-aaa2-aaa2@x.com', rng), 'bbb3-bbb3-bbb3');
  assert.equal(llamadas, 2);
  // Sin números aleatorios seguros no inventa una contraseña.
  const sinCrypto = vm.createContext({ window: {}, document: {}, console });
  vm.runInContext(panelSrc, sinCrypto);
  assert.throws(() => sinCrypto.window.__laPlataforma._puro.generarContrasena(''), /aleatorios seguros/);
  console.log('P04_CONTRASENA_GENERADA=PASS');
}

// ---- 3. Identificadores de operación ----
{
  const vistos = new Set();
  for (let i = 0; i < 200; i++) {
    const id = puro.idOperacion('alta');
    assert.match(id, /^alta:[0-9a-f]{24}$/);
    assert.match(id, /^[A-Za-z0-9._:-]{8,120}$/, 'cumple la regla del servidor');
    assert.ok(!vistos.has(id));
    vistos.add(id);
  }
  console.log('P04_ID_OPERACION=PASS');
}

// ---- 4. Validación del alta y del cambio de contraseña ----
{
  const bueno = { nombre: ' Bar La Esquina ', local: 'Centro', cif: 'B12345678', dueno: 'Ana', email: ' ANA@Empresa.COM ', password: 'abcd-efgh-2345' };
  const ok = puro.validarAlta(bueno);
  assert.equal(ok.ok, true);
  assert.deepEqual(J(ok.datos), { nombre: 'Bar La Esquina', local: 'Centro', cif: 'B12345678', dueno: 'Ana', email: 'ana@empresa.com', password: 'abcd-efgh-2345' });
  assert.equal(puro.validarAlta({ ...bueno, cif: '' }).ok, true, 'el CIF es opcional');

  const malos = [
    [{ nombre: '' }, 'nombre'], [{ nombre: 'A' }, 'nombre'], [{ local: ' ' }, 'local'], [{ cif: '!!' }, 'cif'],
    [{ dueno: 'A' }, 'dueno'], [{ email: 'sin-arroba' }, 'email'], [{ email: 'a@b' }, 'email'],
    [{ password: 'corta1' }, 'password'], [{ password: 'sololetrasaquiii' }, 'password'], [{ password: 'ana.perez123', email: 'ana.perez@x.com' }, 'password']
  ];
  for (const [cambio, campo] of malos) {
    const v = puro.validarAlta({ ...bueno, ...cambio });
    assert.equal(v.ok, false, JSON.stringify(cambio));
    assert.ok(v.errores[campo], `debe señalar ${campo} con ${JSON.stringify(cambio)}`);
  }
  assert.deepEqual(J(puro.validarDueno({ dueno: 'Ana', email: 'ana@x.com', password: 'abcd-efgh-2345' })), {});
  assert.deepEqual(Object.keys(puro.validarDueno({ dueno: '', email: 'x', password: '1' })).sort(), ['dueno', 'email', 'password']);

  assert.match(puro.validarCambioContrasena('corta1', 'corta1', 'a@b.com'), /al menos 10/);
  assert.match(puro.validarCambioContrasena('sololetrasaqui', 'sololetrasaqui', 'a@b.com'), /letras y números/);
  assert.match(puro.validarCambioContrasena('abcdefghij1', 'abcdefghij2', 'a@b.com'), /no coinciden/);
  assert.match(puro.validarCambioContrasena('maria.lopez123', 'maria.lopez123', 'maria.lopez@x.com'), /correo/);
  assert.equal(puro.validarCambioContrasena('Nueva-clave-2026', 'Nueva-clave-2026', 'a@b.com'), null);
  console.log('P04_VALIDACIONES=PASS');
}

// ---- 5. Botones por estado, textos y errores ----
{
  assert.deepEqual(J(puro.accionesDe({ activa: true })), ['desactivar', 'anadir_dueno']);
  assert.deepEqual(J(puro.accionesDe({ activa: false, baja_en: '2026-10-01T10:00:00Z' })), ['reactivar', 'copia', 'eliminar']);
  assert.deepEqual(J(puro.accionesDe({ activa: false, baja_en: null })), ['reactivar', 'registrar_baja'], 'sin baja registrada no se ofrece borrar');
  assert.deepEqual(J(puro.accionesDe(null)), []);
  assert.ok(!puro.accionesDe({ activa: true }).includes('eliminar'), 'una empresa activa nunca ofrece eliminar');

  assert.match(puro.textoBloqueo('plazo_de_gracia', { dias_gracia: 30, plazo_hasta: '2026-11-08T12:00:00Z' }), /30 días.*08\/11\/2026/);
  assert.match(puro.textoBloqueo('empresa_activa', {}), /desactivarla/);
  assert.match(puro.textoBloqueo('sin_registro_de_baja', {}), /Registrar la baja/);
  assert.match(puro.textoBloqueo('sin_copia', {}), /copia de seguridad/);

  assert.match(puro.traducirError(new Error('plataforma_nombre_no_coincide')), /nombre escrito/);
  assert.match(puro.traducirError(new Error('plataforma_codigo_no_valido')), /caducado/);
  assert.match(puro.traducirError(new Error('plataforma_bloqueada: plazo_de_gracia')), /plazo de gracia/);
  assert.match(puro.traducirError(new Error('plataforma_restos_tras_borrado')), /No se ha borrado nada/);
  assert.match(puro.traducirError(new Error('Failed to fetch')), /conexión/);
  assert.match(puro.traducirError(new Error('JWT expired')), /sesión ha caducado/);
  assert.equal(puro.traducirError(new Error('Ya existe una empresa con ese nombre')), 'Ya existe una empresa con ese nombre');
  assert.equal(puro.traducirError(null), 'Ha ocurrido un error inesperado.');

  assert.equal(puro.esFuncionInexistente(new Error('Could not find the function public.plataforma_estado without parameters in the schema cache')), true);
  assert.equal(puro.esFuncionInexistente(new Error('RPC bootstrap HTTP 404')), true);
  assert.equal(puro.esFuncionInexistente(new Error('RPC bootstrap HTTP 500')), false);
  assert.equal(puro.esFuncionInexistente(new Error('Administrador de plataforma requerido')), false);

  assert.equal(puro.nombreFicheroCopia('Bar Ñandú S.L.', new Date('2026-10-09T10:00:00Z')), 'copia-bar-nandu-s-l-2026-10-09.json');
  assert.equal(puro.nombreFicheroCopia('', new Date('2026-10-09T10:00:00Z')), 'copia-empresa-2026-10-09.json');
  assert.equal(puro.fechaCorta('2026-11-08T12:00:00Z'), '08/11/2026');
  assert.equal(puro.fechaCorta(null), '');
  assert.equal(puro.fechaCorta('no es fecha'), '');

  assert.equal(P.debeCambiarContrasena({ user: { user_metadata: { debe_cambiar_contrasena: true } } }), true);
  assert.equal(P.debeCambiarContrasena({ user: { user_metadata: { debe_cambiar_contrasena: false } } }), false);
  assert.equal(P.debeCambiarContrasena({ user: { user_metadata: { debe_cambiar_contrasena: 'true' } } }), false, 'solo el valor booleano true obliga');
  assert.equal(P.debeCambiarContrasena({ user: {} }), false);
  assert.equal(P.debeCambiarContrasena(null), false);
  console.log('P04_ESTADOS_Y_TEXTOS=PASS');
}

// ---- 6. Canales del arranque: solo lo previsto ----
{
  const bloque = prelock.match(/var RPC_PERMITIDOS = \{([\s\S]*?)\n  \};/)[1];
  const permitidos = [...bloque.matchAll(/^\s*([a-z_0-9]+):\s*true/gm)].map((m) => m[1]).sort();
  assert.deepEqual(permitidos, [
    'bootstrap_owner_instalacion', 'obtener_contexto_instalacion_ui', 'obtener_estado_instalacion',
    'plataforma_crear_empresa', 'plataforma_desactivar_empresa', 'plataforma_eliminar_empresa', 'plataforma_estado',
    'plataforma_exportar_empresa', 'plataforma_listar_empresas', 'plataforma_preparar_eliminacion',
    'plataforma_reactivar_empresa', 'plataforma_resumen_eliminacion'
  ]);
  assert.ok(!permitidos.includes('plataforma_asignar_propietario'), 'asignar dueño solo lo llama la función de servidor, nunca el navegador');

  const fun = prelock.match(/var FUNCIONES_PERMITIDAS = \{([\s\S]*?)\n  \};/)[1];
  assert.deepEqual([...fun.matchAll(/"([a-z0-9-]+)":\s*true/g)].map((m) => m[1]), ['plataforma-crear-propietario']);
  // La lista blanca se comprueba antes de cualquier fetch y la URL solo se arma con el nombre ya validado.
  const cuerpo = prelock.slice(prelock.indexOf('window.__laOwnerBootstrapFunction'));
  assert.ok(cuerpo.indexOf('FUNCIONES_PERMITIDAS[nombre]') < cuerpo.indexOf('fetchNativo('));
  assert.match(cuerpo, /\/functions\/v1\/" \+ nombre/);
  assert.match(cuerpo, /supabase\\\.co\$\/i\.test\(base\)/, 'solo contra un backend Supabase');

  // Lo que el panel llama tiene que estar permitido, y nada más.
  const llamadasRpc = new Set([...panelSrc.matchAll(/\brpc\("([a-z_]+)"/g)].map((m) => m[1]));
  for (const n of llamadasRpc) assert.ok(permitidos.includes(n), `${n} no está en la lista blanca`);
  assert.deepEqual([...llamadasRpc].sort(), [
    'plataforma_crear_empresa', 'plataforma_desactivar_empresa', 'plataforma_eliminar_empresa', 'plataforma_exportar_empresa',
    'plataforma_listar_empresas', 'plataforma_preparar_eliminacion', 'plataforma_reactivar_empresa', 'plataforma_resumen_eliminacion'
  ]);
  assert.match(panelSrc, /var FUNCION_PROPIETARIO = "plataforma-crear-propietario";/);
  const llamadasFuncion = [...panelSrc.matchAll(/await funcion\(([A-Za-z_"-]+)/g)].map((m) => m[1]);
  assert.deepEqual(llamadasFuncion, ['FUNCION_PROPIETARIO', 'FUNCION_PROPIETARIO'], 'solo se llama a la función de crear dueño');
  console.log('P04_CANALES_SOLO_LO_PREVISTO=PASS');
}

// ---- 7. El panel no es un riesgo en sí mismo ----
{
  for (const prohibido of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function', 'localStorage', 'service_role', 'SERVICE_ROLE']) {
    assert.ok(!panelSrc.includes(prohibido), `plataforma-panel.js no debe contener ${prohibido}`);
  }
  // Lo único que se guarda en el navegador es la elección «abrir mi aplicación» (el id de usuario), en sessionStorage.
  const usosSesion = [...panelSrc.matchAll(/sessionStorage\.(getItem|setItem|removeItem)\(((?:[^()]|\([^()]*\))*)\)/g)].map((m) => [m[1], m[2]]);
  assert.ok(usosSesion.length >= 3);
  for (const [metodo, args] of usosSesion) {
    assert.match(args, /^CLAVE_MODO_APP(, String\(userId\))?$/, `sessionStorage.${metodo}(${args}): solo la marca del modo aplicación`);
  }
  assert.match(panelSrc, /var CLAVE_MODO_APP = "la_plataforma_modo_app";/);
  assert.doesNotMatch(panelSrc, /eyJ[A-Za-z0-9_-]{20,}/, 'ninguna clave dentro del archivo');
  assert.doesNotMatch(panelSrc, /sb_(publishable|secret)_/, 'ninguna clave dentro del archivo');
  // La contraseña del administrador se comprueba aparte, sin tocar la sesión abierta ni guardarla.
  assert.match(panelSrc, /\/auth\/v1\/token\?grant_type=password/);
  assert.ok(!/signInWithPassword/.test(panelSrc), 'comprobar la contraseña no debe reiniciar la sesión del cliente');
  // Cada acción destructiva pide la contraseña del administrador.
  assert.ok(panelSrc.indexOf('verificarContrasena(iPass.value)') > 0);
  assert.equal([...panelSrc.matchAll(/await verificarContrasena\(/g)].length, 2, 'desactivar y preparar el borrado');
  console.log('P04_PANEL_SIN_RIESGOS=PASS');
}

// ---- 8. Gancho del arranque ----
{
  const iV = flujo.indexOf('async function validarSesion');
  const cuerpo = flujo.slice(iV);
  const iGuarda = cuerpo.indexOf('plat.panelAbierto');
  const iSeq = cuerpo.indexOf('++secuencia');
  assert.ok(iGuarda > 0 && iGuarda < iSeq, 'un panel abierto no se reconstruye por una renovación de sesión');
  const iPass = cuerpo.indexOf('plat.sigueDebiendoCambiar');
  const iEstado = cuerpo.indexOf('plat.consultarEstado');
  const iPanel = cuerpo.indexOf('plat.mostrarPanel');
  const iInstalacion = cuerpo.indexOf('rpcP4("obtener_estado_instalacion"');
  assert.ok(iPass > 0 && iPass < iEstado && iEstado < iPanel && iPanel < iInstalacion, 'contraseña inicial, luego administrador, luego instalación');
  assert.match(cuerpo, /__laPlataformaActiva = estadoPlat\.plataforma_activa === true/);
  assert.match(cuerpo, /estadoPlat\.es_admin === true && !plat\.enModoAplicacion/);
  assert.match(cuerpo, /plat\.montarAtajo\(/);
  const quitar = flujo.slice(flujo.indexOf('function quitarSetup'), flujo.indexOf('function iniciarComprobacion'));
  assert.match(quitar, /__laPlataforma\.cerrarTodo\(\)/);
  // Cada cambio de pantalla recarga la página: el programa cargado por detrás tenía la barrera cerrada y daría avisos falsos.
  assert.match(flujo, /function recargarPagina\(\) \{\s*window\.location\.reload\(\);\s*\}/);
  assert.match(cuerpo, /plat\.mostrarCambioContrasena\(supabase, sesion, \{ recargar: recargarPagina \}\)/);
  assert.match(cuerpo, /plat\.mostrarPanel\(supabase, sesion, estadoPlat, \{ recargar: recargarPagina \}\)/);
  assert.match(cuerpo, /plat\.montarAtajo\(sesion\.user\.id, recargarPagina\)/);
  assert.doesNotMatch(flujo, /revalidarSesionActual/, 'ya no se revalida sobre la página vieja');
  assert.match(cuerpo, /plat\.olvidarModoAplicacion\(\)/, 'sin sesión se olvida la elección');
  // El panel recarga al abrir la aplicación, al cerrar sesión y tras elegir la contraseña.
  assert.equal([...panelSrc.matchAll(/o\.recargar\(\)/g)].length, 3, 'abrir aplicación, cerrar sesión desde la contraseña y contraseña elegida');
  assert.match(panelSrc, /cerrarSesion\(o\.recargar, sesion\.user\.id\)/);
  console.log('P04_GANCHO_ARRANQUE=PASS');
}

// ---- 9. Orden de scripts y política de contenido ----
{
  const pos = (s) => index.indexOf(s);
  assert.ok(pos('./ui-context-bridge.js') < pos('./plataforma-panel.js') && pos('./plataforma-panel.js') < pos('./owner-bootstrap-post-reset.js') && pos('./owner-bootstrap-post-reset.js') < pos('./fuente.js'));
  assert.ok(pos('./owner-bootstrap-prelock.js') < pos('./plataforma-panel.js'), 'el candado previo se carga antes');
  assert.match(headers, /script-src 'self'/);
  assert.match(headers, /connect-src 'self' https:\/\/flqercbgpgmmfaakrwkc\.supabase\.co[^;]*https:\/\/qjqorixtkilwsndqayyx\.supabase\.co/);
  console.log('P04_ORDEN_Y_CSP=PASS');
}

// ---- 10. Pantalla de Empresas del programa y servidor ----
{
  const B = String.fromCharCode(92);
  const boton = 'createElement(Btn, { small: true, variant: "ghost", onClick: () => setMostrarNueva(true) }, "+ A' + B + 'xF1adir empresa")';
  for (const f of (process.env.PLATAFORMA_BUNDLES ? process.env.PLATAFORMA_BUNDLES.split(',') : ['fuente.js', 'source-recovery/fuente-recuperado.js'])) {
    const s = leer(f);
    assert.equal(s.split(boton).length - 1, 1, `${f}: el botón existe una vez`);
    const i = s.indexOf(boton);
    const antes = s.slice(Math.max(0, i - 400), i);
    assert.ok(/window\.__laPlataformaActiva === true \? [^?]*"Las empresas las da de alta el administrador de la plataforma\."\) : [^:]*$/.test(antes) || antes.includes('window.__laPlataformaActiva === true ?'), `${f}: el botón solo se ofrece si la plataforma no está activa`);
    assert.equal(s.split('window.__laPlataformaActiva').length - 1, 1, `${f}: una sola referencia`);
  }
  assert.match(migracion, /'plataforma_activa', exists \(select 1 from private\.plataforma_admins\)/);
  assert.match(migracion, /'mis_empresas'/);
  console.log('P04_PANTALLA_EMPRESAS=PASS');
}

console.log('PLATAFORMA_P04_PANEL_CONTRATO=PASS');
