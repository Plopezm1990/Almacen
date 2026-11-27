/**
 * Contrato de la pantalla de H-28 / H-29: «Cerrar cuentas sin actividad» en «Cuentas abiertas y aparcadas».
 *
 *   node tests/rediseno/h28-h29-cerrar-cuentas-ui-contract.mjs
 *   H28_FUENTE=/ruta/otra/fuente.js node tests/rediseno/h28-h29-...   (para comprobar que el código anterior falla)
 *
 * El servidor (migración 20261128140000, con su propio contrato PGlite) decide qué cuentas se cierran y cuáles no; la pantalla solo lo pide, con permiso y
 * confirmación, y cuenta lo que pasó. Se ejecuta el código REAL de `cerrarCuentasSinActividadA06` con dependencias falsas y se fija el cableado.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const src = await readFile(process.env.H28_FUENTE || path.join(raiz, 'fuente.js'), 'utf8');
const espejo = await readFile(path.join(raiz, 'source-recovery/fuente-recuperado.js'), 'utf8');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

// ---------- A: la llamada ----------
const ini = src.indexOf('  async function cerrarCuentasSinActividadA06() {');
const fin = ini >= 0 ? src.indexOf('\n  async function listarCuentasAparcadasA06(', ini) : -1;
check('A0 existe cerrarCuentasSinActividadA06 en la lógica de venta', ini > 0 && fin > ini);
if (ini > 0 && fin > ini) {
  const cuerpo = src.slice(ini, fin);
  const crea = new Function('localActivoId', 'empresaDelLocalActivo', 'window', 'uid', 'esErrorDeRedTpv', 'MENSAJE_SIN_RED_TPV', `${cuerpo}\nreturn cerrarCuentasSinActividadA06;`);
  const esRed = (v) => /failed to fetch/i.test(String(v?.message || v || ''));
  function entorno({ local = 'L1', empresa = { id: 'E1' }, nube = true, rpc = async () => ({ data: { ok: true, cerradas: 3, omitidas: 7 }, error: null }) } = {}) {
    const llamadas = [];
    const window = { __nubeActiva: nube, getSupabaseClient: async () => ({ rpc: async (...a) => { llamadas.push(a); return rpc(...a); } }) };
    return { fn: crea(local, empresa, window, () => 'u1', esRed, 'SIN RED'), llamadas };
  }
  let { fn, llamadas } = entorno();
  let r = await fn();
  check('A1 llama a la función de servidor con la empresa, el local, un identificador propio y 60 minutos', r.ok && llamadas.length === 1 && llamadas[0][0] === 'abc_cerrar_cuentas_sin_actividad' && llamadas[0][1].p_empresa_id === 'E1' && llamadas[0][1].p_local_id === 'L1' && llamadas[0][1].p_operation_id === 'abc.cerrar_sin_actividad.u1' && llamadas[0][1].p_sin_pedido_minutos === 60, JSON.stringify(llamadas[0]));
  check('A2 devuelve lo cerrado y lo omitido que dice el servidor', r.cerradas === 3 && r.omitidas === 7);
  ({ fn, llamadas } = entorno({ local: null }));
  r = await fn();
  check('A3 sin local no llama', r.ok === false && llamadas.length === 0);
  ({ fn, llamadas } = entorno({ nube: false }));
  r = await fn();
  check('A4 sin nube no llama y dice que no se tocó nada', r.ok === false && /No se ha tocado nada/.test(r.error) && llamadas.length === 0);
  ({ fn, llamadas } = entorno({ rpc: async () => ({ data: null, error: { message: 'cuentas_limpieza_no_autorizada' } }) }));
  r = await fn();
  check('A5 si el servidor rechaza por permiso (p. ej. un Cajero/a) lo explica', r.ok === false && /Solo el Propietario y el Encargado/.test(r.error));
  ({ fn, llamadas } = entorno({ rpc: async () => { throw new TypeError('Failed to fetch'); } }));
  r = await fn();
  check('A6 sin red usa el mensaje de falta de conexión (H-32)', r.ok === false && r.error === 'SIN RED');
  ({ fn, llamadas } = entorno({ rpc: async () => ({ data: { ok: false }, error: null }) }));
  r = await fn();
  check('A7 una respuesta inválida no se da por buena', r.ok === false && /No se ha dado nada por hecho/.test(r.error));
}

// ---------- B: cableado (fuente.js y su espejo) ----------
for (const [nombre, t] of [['fuente.js', src], ['source-recovery/fuente-recuperado.js', espejo]]) {
  const tiene = (id, x) => check(`${id} [${nombre}]`, t.includes(x));
  tiene('B1 la lógica de venta la expone', 'listarCuentasAparcadasA06, cerrarCuentasSinActividadA06, unirCuentasA08, ensayarCierreSesionCajaC12 };');
  tiene('B2 el padre la pasa a la pantalla solo con la nube activa y para Propietario o Encargado', 'puedeLimpiarCuentasA06: typeof window !== "undefined" && window.__nubeActiva === true && ["Propietario", "Encargado"].includes(String(miPerfil?.rol || "")),');
  tiene('B3 el botón solo sale con permiso, con la lista cargada y con cuentas', 'cargado && cuentas.length > 0 && puedeLimpiarCuentasA06 && typeof cerrarCuentasSinActividadA06 === "function"');
  tiene('B4 pide confirmación antes de cerrar (diálogo de alerta con lo que se cierra y lo que no)', 'role: "alertdialog", "aria-label": "Cerrar cuentas sin actividad", "data-cerrar-cuentas-confirmacion": "1"');
  tiene('B5 la confirmación avisa de que las demás no se tocan', 'Las dem\\u00e1s no se tocan.');
  tiene('B6 mientras cierra no deja pulsar dos veces', 'if (limpiandoA06 || typeof cerrarCuentasSinActividadA06 !== "function") return;');
  tiene('B7 tras cerrar se recarga la lista y se cuenta lo que quedó abierto y por qué', 'siguen abiertas porque tienen un pedido sin cobrar, dinero pendiente o un reparto: hay que resolverlas una a una.');
  tiene('B8 el aviso de las cuentas de días cerrados ya no dice que las cierra «el servidor» sin más', 'se pueden cerrar con \\u00abCerrar cuentas sin actividad\\u00bb (Propietario y Encargado)');
  check(`B9 la pantalla no cierra cuentas por su cuenta (solo llama a la función de servidor) [${nombre}]`, !/update\(\{[^}]*estado: ?"CERRADA"/.test(t));
}

console.log(fallos === 0 ? 'H28_H29_CERRAR_CUENTAS_UI_CONTRACT=PASS' : `H28_H29_CERRAR_CUENTAS_UI_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
