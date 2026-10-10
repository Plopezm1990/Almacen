import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

// Contrato estático de pantalla de la PIEZA 6e (modalidad al abrir cuenta en el TPV):
//  - la lógica de apertura (`venderCarritoA02`) decide la modalidad al crear el registro pendiente: la elegida o, si no,
//    Barra cuando está habilitada y, si no, la primera habilitada; si no se puede leer la lista, Barra como antes;
//  - la lectura de modalidades (`abc_obtener_modalidades_local`) y la apertura (`abc_abrir_cuenta`) con los nombres y parámetros
//    exactos de las migraciones; sin escrituras directas en tablas;
//  - el TPV: selector «Tipo de cuenta» en el carrito (solo con más de una habilitada), modalidad en la confirmación y aviso visible
//    de los errores de «Guardar pedido»;
//  - los mensajes de `modalidad_no_habilitada` y el desbloqueo de Barra en «Configuración».
// Lee `source-recovery/fuente-recuperado.js` y `fuente.js` (deben llevar exactamente lo mismo; la paridad completa de la lógica la exige
// además `python3 source-recovery/recuperar_candidato.py --check`). CFG6E_FUENTE_RECUPERADA y CFG6E_FUENTE_BUNDLE permiten probar variantes
// rotas en las comprobaciones de mutantes. La conducta la prueba tests/cfg/cfg6e-ui-runtime.mjs.
const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");
const lf = (t) => t.replace(/\r/g, "");

const recuperado = lf(process.env.CFG6E_FUENTE_RECUPERADA ? await readFile(process.env.CFG6E_FUENTE_RECUPERADA, "utf8") : await read("source-recovery/fuente-recuperado.js"));
const bundle = lf(process.env.CFG6E_FUENTE_BUNDLE ? await readFile(process.env.CFG6E_FUENTE_BUNDLE, "utf8") : await read("fuente.js"));

function entre(texto, ini, fin, nombre) {
  assert.equal(texto.split(ini).length, 2, `${nombre}: una única aparición de «${ini.slice(0, 50)}»`);
  const i = texto.indexOf(ini);
  const j = texto.indexOf(fin, i + ini.length);
  assert.ok(j > i, `${nombre}: no se encuentra el final «${fin.slice(0, 50)}»`);
  return texto.slice(i, j);
}

// 1. Los bloques nuevos son idénticos en el bundle y en el fuente recuperado.
const bloques = (t, nombre) => ({
  modulo: entre(t, 'var MODALIDADES_A02 = ["BARRA", "MESA", "TERRAZA", "TAKEAWAY", "OTRO"];', "function crearLogicaVenta(", nombre),
  ayudas: entre(t, "  // Modalidad de la cuenta al abrirla (pieza 6e)", "  async function venderCarritoA02(lineas, opciones = {}) {", nombre),
  venderCarrito: entre(t, "  async function venderCarritoA02(lineas, opciones = {}) {", "\n  async function enviarPedidoA05() {", nombre),
  traduccion: entre(t, "    const modalidadNoHab = msg.match(", '    if (msg.includes("cierre_definitivo_diferencia_pendiente"))', nombre),
  marcaError: entre(t, "  function respuestaErrorA06(error) {", "  function errorRpcA02(error) {", nombre)
});
// El estado del TPV va justo después de «showCobro»: se toma desde esa línea hasta el final del selector.
function bloquesTpv(t, nombre) {
  const i = t.indexOf("  const [showCobro, setShowCobro] = (0, import_react4.useState)(false);\n");
  assert.ok(i >= 0, nombre + ": falta showCobro");
  const j = t.indexOf("  const renderSelectorModalidadA02 = () => {", i);
  assert.ok(j > i, nombre + ": falta el selector");
  const k = t.indexOf("\n  };\n", j);
  return t.slice(i, k + 6);
}
const R = bloques(recuperado, "fuente recuperado");
const B = bloques(bundle, "bundle");
R.tpv = bloquesTpv(recuperado, "fuente recuperado");
B.tpv = bloquesTpv(bundle, "bundle");
R.guardar = entre(recuperado, "  async function confirmarCobro() {", "  async function enviarPedidoGuardadoA05() {", "fuente recuperado");
B.guardar = entre(bundle, "  async function confirmarCobro() {", "  async function enviarPedidoGuardadoA05() {", "bundle");
for (const k of Object.keys(R)) assert.equal(R[k], B[k], `el bloque «${k}» es idéntico en el bundle y en el fuente recuperado`);

// 2. Cableado en los dos archivos.
for (const [nombre, t] of [["fuente recuperado", recuperado], ["bundle", bundle]]) {
  const cuenta = (s) => t.split(s).length - 1;
  assert.equal(cuenta("local = null, configEmpresa, listarModalidadesA02, leerContextoCuentaA02, respuestaErrorA06 }) {"), 1, nombre + ": el TPV recibe la lectura de modalidades (al final de sus propiedades, sin tocar el orden de las anteriores)");
  assert.equal(cuenta("function VentaRapida({ productos, venderCarrito, enviarPedidoA05,"), 1, nombre + ": el TPV conserva el inicio de su firma (lo exigen los contratos A05.2 y A06.1)");
  assert.equal(cuenta("configEmpresa: empresaDelLocalActivo, listarModalidadesA02, leerContextoCuentaA02, respuestaErrorA06 })"), 1, nombre + ": la aplicación se la pasa (al final)");
  assert.equal(cuenta("venderCarrito: venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05"), 1, nombre + ": el montaje conserva su inicio (lo exige el contrato P07)");
  assert.equal(cuenta("  const { listarModalidadesA02, leerContextoCuentaA02, respuestaErrorA06, venderCarrito, venderLocal, anularVenta,"), 1, nombre + ": la aplicación la obtiene de la lógica (la primera de la lista: el final lo exige el contrato A08.1)");
  assert.equal(cuenta("listarCuentasRepartoA08, moverCantidadLineaCuentaA08 } = crearLogicaVenta("), 1, nombre + ": la lista que obtiene la aplicación conserva su final (lo exige el contrato A08.1)");
  assert.equal(cuenta("moverCantidadLineaCuentaA08, listarModalidadesA02, leerContextoCuentaA02, respuestaErrorA06, ensayarCierreSesionCajaC12 };"), 1, nombre + ": la lógica ofrece las ayudas del TPV y el ensayo C12 (al final de la lista)");
  assert.equal(cuenta("  return { venderCarrito, venderLocal, anularVenta,"), 1, nombre + ": la lista que devuelve la lógica conserva su inicio (lo exige el contrato A06.1)");
  assert.equal(cuenta('modalidad: "BARRA",'), 0, nombre + ": ya no hay una modalidad fija «BARRA» en el registro pendiente");
  assert.equal(cuenta("modalidad: modalidadApertura,"), 1, nombre + ": el registro pendiente usa la modalidad decidida");
  assert.equal(cuenta('rpcA02ConRecuperacion(supabase, "abc_abrir_cuenta", {'), 1, nombre + ": una única apertura de cuentas, con idempotencia");
  // Configuración: Barra ya no está bloqueada.
  assert.doesNotMatch(t, /siempre en Barra/, nombre + ": ya no se dice que el TPV abre siempre en Barra");
}

// 3. Llamadas al servidor con los nombres y parámetros exactos de las migraciones.
const migs = (await readdir(new URL("supabase/migrations/", root))).filter((n) => /abc_f3_a02_operating_day_a11|abc_config_pieza3_modalidades/.test(n)).sort();
assert.equal(migs.length, 2, "las migraciones de la apertura de cuentas (A11) y de las modalidades (pieza 3)");
const firmas = new Map();
for (const m of migs) {
  const t = lf(await read("supabase/migrations/" + m));
  for (const x of t.matchAll(/create (?:or replace )?function public\.([a-z_0-9]+)\(([\s\S]*?)\)\s*returns/g))
    firmas.set(x[1], x[2].split(",").map((p) => p.trim()).filter(Boolean).map((p) => p.split(/\s+/)[0]));
}
for (const n of ["abc_abrir_cuenta", "abc_obtener_modalidades_local"]) assert.ok(firmas.has(n), "no está en las migraciones: " + n);
const clavesDe = (texto, nombreLlamada) => {
  const m = texto.match(new RegExp(`"${nombreLlamada}", \\{([^}]*)\\}`));
  assert.ok(m, "no se encuentra la llamada a " + nombreLlamada);
  return [...m[1].matchAll(/\b(p_[a-z_0-9]+):/g)].map((k) => k[1]);
};
assert.match(R.ayudas, /supabase\.rpc\("abc_obtener_modalidades_local", \{ p_empresa_id: empresaId, p_local_id: localId \}\)/, "los valores de la lectura: empresa y local");
assert.deepEqual(clavesDe(R.ayudas, "abc_obtener_modalidades_local"), firmas.get("abc_obtener_modalidades_local"), "abc_obtener_modalidades_local: parámetros exactos");
assert.deepEqual(clavesDe(R.venderCarrito, "abc_abrir_cuenta"), firmas.get("abc_abrir_cuenta"), "abc_abrir_cuenta: parámetros exactos y en su orden");
assert.match(R.venderCarrito, /p_modalidad: pending\.modalidad,/, "la apertura envía la modalidad del registro pendiente");
assert.match(R.venderCarrito, /p_operating_day: null/, "el día operativo lo sigue dando el servidor");
assert.equal((R.ayudas.match(/\.rpc\(/g) || []).length, 1, "una única lectura directa en las ayudas");
assert.doesNotMatch(R.ayudas + R.venderCarrito.slice(0, 400), /\.from\(/, "las ayudas de modalidad no leen tablas");
for (const [nombre, t] of [["fuente recuperado", recuperado], ["bundle", bundle]])
  assert.doesNotMatch(t, /from\("cuentas_comerciales"\)\s*\.(insert|update|upsert|delete)/, nombre + ": ninguna escritura directa en cuentas");

// 4. La decisión de la modalidad.
assert.match(R.modulo, /var MODALIDADES_ETIQUETA_A02 = \{ BARRA: "Barra", MESA: "Mesa", TERRAZA: "Terraza", TAKEAWAY: "Para llevar", OTRO: "Otro" \};/);
const leer = entre(R.ayudas, "  async function leerModalidadesHabilitadasA02(", "  async function resolverModalidadAperturaA02(", "leerModalidadesHabilitadasA02");
assert.match(leer, /if \(error\) return null;/, "si el servidor la rechaza, no hay lista (se actúa como antes)");
assert.match(leer, /Array\.isArray\(data\?\.habilitadas\) \? data\.habilitadas\.filter\(\(m22\) => MODALIDADES_A02\.includes\(m22\)\) : \[\];/, "se ignora lo desconocido");
assert.match(leer, /return lista\.length > 0 \? lista : null;/, "una lista vacía es como no tener lista");
assert.match(leer, /\} catch \(e2\) \{\s+return null;/, "un fallo de lectura nunca rompe la apertura");
const resolver = entre(R.ayudas, "  async function resolverModalidadAperturaA02(", "  async function listarModalidadesA02() {", "resolverModalidadAperturaA02");
assert.match(resolver, /const pedida = MODALIDADES_A02\.includes\(elegida\) \? elegida : null;/, "una modalidad que no existe se ignora");
assert.match(resolver, /if \(!habilitadas\) return pedida \|\| "BARRA";/, "sin lista: la elegida o Barra, como antes");
assert.match(resolver, /if \(!habilitadas\.includes\(pedida\)\) throw new Error\("modalidad_no_habilitada:" \+ pedida\);/, "una elegida que no está habilitada no llega al servidor");
assert.match(resolver, /return habilitadas\.includes\("BARRA"\) \? "BARRA" : habilitadas\[0\];/, "automática: Barra si está habilitada y, si no, la primera");
const lista = entre(R.ayudas, "  async function listarModalidadesA02() {", "\n  }\n", "listarModalidadesA02");
assert.match(lista, /if \(!hayConexion\) return \{ ok: false, offline: true \};/);
assert.match(lista, /return habilitadas \? \{ ok: true, habilitadas \} : \{ ok: false \};/);
assert.match(lista, /leerModalidadesHabilitadasA02\(supabase, empresaId, localActivoId\)/, "se lee la lista del local activo");
// la modalidad se decide al CREAR el registro pendiente (un pedido pendiente conserva la suya)
assert.match(R.venderCarrito, /if \(!pending\) \{\s+const modalidadApertura = await resolverModalidadAperturaA02\(supabase, empresaId, localActivoId, opciones\?\.modalidad\);\s+const cuentaId = uuidA02\(\);/, "se decide solo al crear el registro pendiente");
assert.equal((R.venderCarrito.match(/resolverModalidadAperturaA02\(/g) || []).length, 1, "y en ningún otro sitio");
assert.match(R.venderCarrito, /async function venderCarritoA02\(lineas, opciones = \{\}\) \{/);
assert.match(R.venderCarrito, /modalidad: agregado\.modalidad \|\| pending\.modalidad,/, "el resultado dice la modalidad real");
// si el servidor rechaza la modalidad antes de abrir la cuenta, el pedido pendiente no se queda atascado
assert.match(R.venderCarrito, /if \(String\(error\?\.message \|\| error \|\| ""\)\.includes\("modalidad_no_habilitada"\)\) \{\s+try \{\s+const clavePendiente = clavePendienteA02\(empresaId, localActivoId\);\s+const pendiente = leerJsonLocalA02\(clavePendiente\);\s+if \(pendiente && !pendiente\.cuentaResultado\) localStorage\.removeItem\(clavePendiente\);/, "solo se descarta si todavía no se abrió ninguna cuenta");

// 5. Mensajes.
assert.match(R.traduccion, /La modalidad «" \+ \(MODALIDADES_ETIQUETA_A02\[modalidadNoHab\[1\]\] \|\| modalidadNoHab\[1\]\) \+ "» no está habilitada en este local\. Elige otra o pide al Propietario que la habilite en Configuración\./);
assert.match(R.traduccion, /Esa modalidad no está habilitada en este local\./);
assert.match(R.marcaError, /\.\.\.String\(error\?\.message \|\| error \|\| ""\)\.includes\("modalidad_no_habilitada"\) \? \{ modalidadNoHabilitada: true \} : \{\}/, "la marca solo aparece en ese error");
assert.ok(recuperado.indexOf("const modalidadNoHab = msg.match(") < recuperado.indexOf('msg.includes("contexto_no_autorizado") || msg.includes("no_autorizad")'), "la traducción va antes del genérico «no_autorizad»");

// 6. El TPV.
const t = R.tpv;
assert.match(t, /const cargarModalidadesA02 = async \(\) => \{\s+if \(typeof listarModalidadesA02 !== "function" \|\| !local\?\.id \|\| !configEmpresa\?\.id\) return;/, "sin la función o sin local no hace nada");
assert.match(t, /if \(r2\?\.ok && Array\.isArray\(r2\.habilitadas\)\) setModalidadesA02\(r2\.habilitadas\);/);
assert.match(t, /\(0, import_react4\.useEffect\)\(\(\) => \{\s+setModalidadesA02\(\[\]\);\s+setModalidadElegidaA02\(""\);\s+cargarModalidadesA02\(\);\s+\}, \[local\?\.id, configEmpresa\?\.id\]\);/, "se carga y se reinicia al cambiar de local");
assert.match(t, /const modalidadActualA02 = modalidadesA02\.includes\(modalidadElegidaA02\) \? modalidadElegidaA02 : modalidadesA02\.includes\("BARRA"\) \? "BARRA" : modalidadesA02\[0\] \|\| "";/, "por defecto Barra o la primera; una elegida que ya no está habilitada no vale");
assert.match(t, /if \(modalidadesA02\.length < 2\) return null;/, "el selector solo aparece con más de una modalidad habilitada");
assert.match(t, /"data-selector-modalidad": "1"/);
assert.match(t, /\{ color: C2\.inkSoft \} \}, "Tipo de cuenta"\),/, "el título visible del selector");
assert.match(t, /role: "group", "aria-label": "Tipo de cuenta"/, "el grupo se llama igual para lectores de pantalla");
assert.match(t, /"aria-pressed": m2 === modalidadActualA02,/, "se sabe cuál está elegida");
assert.match(t, /onClick: \(\) => setModalidadElegidaA02\(m2\), disabled: enviandoVenta,/, "no se cambia mientras se guarda");
assert.match(t, /minHeight: 44,/, "tamaño táctil");
assert.match(t, /MODALIDADES_ETIQUETA_A02\[m2\] \|\| m2\)\)\)/, "cada botón lleva el nombre en español de la modalidad");
const g = R.guardar;
assert.match(g, /\{ modalidad: modalidadActualA02 \|\| void 0 \}\s+\);/, "«Guardar pedido» envía la modalidad elegida");
assert.match(g, /if \(resultado\?\.modalidadNoHabilitada\) await cargarModalidadesA02\(\);\s+if \(await gestionarConflictoA06/, "si la modalidad ya no vale, se recarga la lista antes de explicarlo");
assert.match(g, /modalidad: resultado\.modalidad \|\| null\s+\}\);/, "la confirmación guarda la modalidad");
for (const [nombre, tx] of [["fuente recuperado", recuperado], ["bundle", bundle]]) {
  assert.equal(tx.split('"Cuenta ", confirmacion.cuentaId || "", " · Pedido ", confirmacion.pedidoId || "", confirmacion.modalidad ? " · Modalidad: " + (MODALIDADES_ETIQUETA_A02[confirmacion.modalidad] || confirmacion.modalidad) : ""').length - 1, 1, nombre + ": la confirmación dice la modalidad");
  const i = tx.indexOf("lineasCarrito.length > 0 && renderSelectorModalidadA02(), lineasCarrito.length > 0 && /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: confirmarCobro");
  assert.ok(i > 0, nombre + ": el selector va justo encima de «Guardar pedido»");
  const a = tx.lastIndexOf('"data-error-venta": "1"', i);
  assert.ok(a > 0 && i - a < 400, nombre + ": el aviso de error de «Guardar pedido» está en el carrito, justo antes del selector (no solo dentro de la ventana desactivada)");
  assert.match(tx.slice(a - 120, i), /errorVenta && \/\* @__PURE__ \*\/ import_react4\.default\.createElement\("div", \{ role: "alert", "data-error-venta": "1"/, nombre + ": solo si hay error");
  assert.ok(tx.slice(a, i).includes("style: { background: C2.redSoft, color: C2.red }"), nombre + ": el aviso usa los colores del tema (legible también en modo oscuro), no un rosa fijo");
}

// 7. El contrato de ejecución existe y cubre los casos exigidos.
const vivo = await read("tests/cfg/cfg6e-ui-runtime.mjs");
for (const marca of ["A1.1 con todo habilitado, la cuenta se abre en Barra", "A1.4 la apertura envía exactamente los parámetros de siempre", "A2.1 sin Barra, la primera habilitada es Mesa", "A2.5 solo Mesa habilitada",
  "A2.6 Barra y Otro: gana Barra", "A3.1 si no se puede leer la lista, se abre en Barra como antes", "A3.3 las modalidades desconocidas de la lista se ignoran", "A4.1 una modalidad habilitada elegida se respeta",
  "A4.2 una modalidad deshabilitada elegida se rechaza sin llamar a abrir cuenta", "A5.1 el rechazo del servidor se explica", "A5.2 no queda un pedido pendiente atascado", "A5.4 la segunda apertura usa otro identificador",
  "A6.2 el reintento, aunque se pida otra modalidad, conserva la del pedido pendiente", "A6.4 y reutiliza el mismo identificador", "A7.1 la lista pública devuelve las habilitadas", "B1.2 con productos en el carrito y todo habilitado",
  "B1.6 «Guardar pedido» abre la cuenta en la modalidad elegida", "B1.7 la confirmación dice la modalidad", "B3.3 «Guardar pedido» funciona con Barra deshabilitada", "B4.1 con una sola modalidad habilitada no se muestra el selector",
  "B5.1 si la modalidad elegida ya no está habilitada", "B5.2 la lista del selector se recarga", "B6.1 si no se puede leer la lista no hay selector", "B7.1 sin la función de modalidades", "B9.1 un fallo al guardar el pedido se muestra en el carrito",
  "A8.1 si leer la lista lanza una excepción", "A8.2 si el servidor contesta con error, se ignoran sus datos", "A8.3 Barra gana aunque la lista llegue en otro orden", "A9.1 un fallo que no es de modalidad no lleva la marca",
  "A9.2 si el rechazo llega cuando la cuenta ya está abierta", "B10.2 aunque Barra no sea la primera", "B10.3 cada botón mide al menos 44 px", "B11.1 mientras guarda, los botones de modalidad están desactivados",
  "B12.2 si la recarga falla, el selector sigue ahí", "B13.3 y la elección anterior no se arrastra", "B13.4 si no se puede leer la lista del local nuevo"])
  assert.ok(vivo.includes(marca), "falta el caso de ejecución: " + marca);

console.log("cfg6e-ui-contract: OK");
