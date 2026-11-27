/**
 * Contrato de la Ola 5 de la corrección del TPV («resto»): H-16, H-25, H-30, H-32, H-34 y H-41 de la auditoría del 25-26/11/2026.
 *
 *   node tests/rediseno/ola5-resto-tpv-contract.mjs
 *   OLA5_FUENTE=/ruta/otra/fuente.js node tests/rediseno/ola5-...   (para comprobar que el código anterior falla)
 *
 * Quedan FUERA de esta ola, con su razón en CORRECCION_OLA5_RESTO_2026-11-27.md: H-28 y H-29 (cambian el servidor y mueven cuentas con dinero:
 * necesitan una decisión), H-35 (el historial no tiene los reembolsos: hay que diseñar de dónde salen) y H-47 (botón «Deshacer reparto»).
 *
 * Se ejecuta el código REAL de las ayudas (se extraen de fuente.js) y se fija por texto lo que no se puede ejecutar sin navegador.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const src = await readFile(process.env.OLA5_FUENTE || path.join(raiz, 'fuente.js'), 'utf8');
const espejo = await readFile(path.join(raiz, 'source-recovery/fuente-recuperado.js'), 'utf8');
const css = await readFile(path.join(raiz, 'la-apariencia.css'), 'utf8');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}
const extrae = (nombre) => src.match(new RegExp(`function ${nombre}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n`))?.[0] || null;

// ---------- A: H-30 (operaciones de cuenta recordadas) ----------
const fClave = extrae('claveOperacionesCuentaTpv');
const fLeer = extrae('leerOperacionesCuentaTpv');
const fGuardar = extrae('guardarOperacionesCuentaTpv');
check('A0 existen las tres ayudas de H-30', !!fClave && !!fLeer && !!fGuardar);
if (fClave && fLeer && fGuardar) {
  const almacen = new Map();
  const window = { localStorage: { getItem: (k) => (almacen.has(k) ? almacen.get(k) : null), setItem: (k, v) => almacen.set(k, String(v)), removeItem: (k) => almacen.delete(k) } };
  const { clave, leer, guardar } = new Function('window', `${fClave}\n${fLeer}\n${fGuardar}\nreturn { clave: claveOperacionesCuentaTpv, leer: leerOperacionesCuentaTpv, guardar: guardarOperacionesCuentaTpv };`)(window);
  check('A1 la clave es por empresa y local (y nula sin ellos)', clave('E1', 'L1') === 'la_suite_tpv_operaciones_cuenta_v1:E1:L1' && clave(null, 'L1') === null && clave('E1', '') === null);
  check('A2 por defecto, cerradas', leer('E1', 'L1') === false);
  guardar('E1', 'L1', true);
  check('A3 tras abrirlas se recuerdan (la recarga las encuentra abiertas)', leer('E1', 'L1') === true && leer('E1', 'L2') === false && leer('E2', 'L1') === false);
  guardar('E1', 'L1', false);
  check('A4 al ocultarlas se olvidan (no quedan activadas para siempre)', leer('E1', 'L1') === false && almacen.size === 0);
  const sinAlmacen = { localStorage: { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); }, removeItem() { throw new Error('bloqueado'); } } };
  const r = new Function('window', `${fClave}\n${fLeer}\n${fGuardar}\nguardarOperacionesCuentaTpv('E','L',true); return leerOperacionesCuentaTpv('E','L');`)(sinAlmacen);
  check('A5 sin almacenamiento (navegador bloqueado) no rompe y vale cerradas', r === false);
}

// ---------- B: H-32 (sin red) ----------
const fRed = extrae('esErrorDeRedTpv');
check('B0 existe esErrorDeRedTpv', !!fRed);
if (fRed) {
  const esRed = new Function(`${fRed}\nreturn esErrorDeRedTpv;`)();
  check('B1 reconoce los errores de red de Chrome, Firefox y Safari', esRed(new TypeError('Failed to fetch')) && esRed('NetworkError when attempting to fetch resource.') && esRed({ message: 'Load failed' }) && esRed('TypeError: fetch failed'));
  check('B2 no confunde un error de servidor con falta de red', !esRed('abc_caja_no_autorizado') && !esRed({ message: 'operation_id_conflict' }) && !esRed(null) && !esRed(''));
}
const literalRed = src.match(/var MENSAJE_SIN_RED_TPV = ("[^"]+");/)?.[1];
const mensajeRed = literalRed ? JSON.parse(literalRed) : '';
check('B3 el mensaje es comprensible y NO afirma que no haya cambiado nada (la petición pudo llegar)', /Sin conexi.n con el servidor/.test(mensajeRed) && /comprueba antes de repetirla/.test(mensajeRed) && !/no se ha cambiado nada/i.test(mensajeRed));

// ---------- C: cableado ----------
for (const [nombre, t] of [['fuente.js', src], ['source-recovery/fuente-recuperado.js', espejo]]) {
  const tiene = (id, x) => check(`${id} [${nombre}]`, t.includes(x));
  // H-30
  tiene('C1 el estado inicial de las operaciones de cuenta sale de lo recordado', 'useState)(() => leerOperacionesCuentaTpv(configEmpresa?.id, local?.id));');
  tiene('C2 si el contexto llega después, también se recupera', 'if (leerOperacionesCuentaTpv(configEmpresa?.id, local?.id)) setOperacionesCuentaAbiertas(true);');
  tiene('C3 solo se guarda cuando el usuario pulsa el botón (sin carreras con la carga)', 'guardarOperacionesCuentaTpv(configEmpresa?.id, local?.id, nuevo);');
  // H-32
  tiene('C4 el traductor de errores de cuenta reconoce la falta de red', '  function errorRpcA02(error) {\n    const msg = String(error?.message || error || "");\n    if (esErrorDeRedTpv(msg)) return MENSAJE_SIN_RED_TPV;');
  tiene('C5 el traductor de errores de cobro (donde salió «Cerrar cuenta pagada») también', '  function mensajeErrorCobroF4(error) {\n    const msg = String(error?.message || error || "");\n    if (esErrorDeRedTpv(msg)) return MENSAJE_SIN_RED_TPV;');
  // H-41
  tiene('C6 al Camarero/a se le dice que su cargo no puede ver la lista y por dónde ir', 'if (String(error?.message || error || "").includes("abc_caja_no_autorizado")) return { ok: false, error: "Tu cargo no puede ver la lista de cuentas abiertas de este local. Las mesas con cuenta se abren desde \\u00abSala y mesas\\u00bb." };');
  // H-34
  tiene('C7 la pantalla recibe si se puede anular: sin nube vale; con nube solo Propietario y Encargado', 'puedeAnularVenta: !(typeof window !== "undefined" && window.__nubeActiva === true) || ["Propietario", "Encargado"].includes(String(miPerfil?.rol || "")),');
  tiene('C8 «Anular venta» solo se muestra con permiso', 'v22.estado === "ACTIVA" && anularVenta && puedeAnularVenta ? h3(Btn, { variant: "danger", onClick: () => {');
  tiene('C9 sin permiso se explica en vez de mostrar un botón que no funciona', '"data-anular-sin-permiso": "1", className: "text-[11.5px]", style: { color: C2.inkSoft } }, "Solo el Propietario y el Encargado pueden anular una venta.")');
  // H-25
  tiene('C10 el arqueo tiene una entrada «Cerrar caja»', 'h3("div", { className: "text-[12.5px] font-semibold mb-1" }, "Cerrar caja"),');
  tiene('C11 la entrada lleva a Cocina con la gestión avanzada abierta (marca de sesión)', 'window.sessionStorage.setItem("la_suite_abrir_gestion_cocina_v1", "1");');
  tiene('C12 Cocina abre la gestión avanzada si llega con esa marca y la borra después', 'return window.sessionStorage.getItem("la_suite_abrir_gestion_cocina_v1") === "1";');
  // H-16
  tiene('C13 las columnas salen del ancho real de la rejilla (tarjetas de 140 px como mínimo)', 'Math.floor((el.clientWidth + hueco) / (140 + hueco))');
  tiene('C14 la paginación usa el mismo número de columnas que se pinta', 'const columnasPorPaginaTpv = !modoCajaTpv && columnasContenedorTpv ? columnasContenedorTpv : columnasRejilla;');
  tiene('C15 la rejilla recibe esas columnas fuera del modo caja', '!modoCajaTpv && columnasContenedorTpv ? { gridTemplateColumns: `repeat(${columnasContenedorTpv}, minmax(0, 1fr))` } : void 0');
}
check('C16 el nombre del producto se corta en dos líneas dentro de su tarjeta (CSS)', /\.tpv-rejilla > button > :first-child \{\s*display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; min-width: 0;[\s\S]*?white-space: normal;/.test(css));
check('C17 la tarjeta NO oculta su desbordamiento (la insignia de cantidad sale por su esquina)', /\.tpv-rejilla > button \{ min-width: 0; \}/.test(css) && !/\.tpv-rejilla > button \{[^}]*overflow: hidden/.test(css.slice(css.indexOf('H-16 (auditoría del TPV)'))));

console.log(fallos === 0 ? 'OLA5_RESTO_TPV_CONTRACT=PASS' : `OLA5_RESTO_TPV_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
