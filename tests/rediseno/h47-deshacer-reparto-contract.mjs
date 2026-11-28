/**
 * Contrato de H-47: «Deshacer reparto» en el panel «Repartir productos».
 *
 *   node tests/rediseno/h47-deshacer-reparto-contract.mjs
 *   H47_FUENTE=/ruta/otra/fuente.js node tests/rediseno/h47-...   (para comprobar que el código anterior falla)
 *
 * Deshacer un reparto es devolver a la cuenta que tenía el pedido la parte que se movió. El servidor ya lo permite con `abc_mover_cantidad_linea_cuenta`
 * (también lo valida: cuentas abiertas, mismo día, sin reparto por importe, parte fiscalizada inmóvil); la pantalla solo lo ofrece con un botón.
 * Se ejecuta el código REAL del ayudante que decide qué líneas se pueden devolver y se fija el cableado.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const src = await readFile(process.env.H47_FUENTE || path.join(raiz, 'fuente.js'), 'utf8');
const espejo = await readFile(path.join(raiz, 'source-recovery/fuente-recuperado.js'), 'utf8');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

// ---------- A: qué líneas se pueden devolver ----------
const ini = src.indexOf('function lineasRecibidasRepartoTpv(estado) {');
const fin = ini >= 0 ? src.indexOf('\nvar FILAS_REJILLA_TPV = 4;', ini) : -1;
check('A0 existe el ayudante lineasRecibidasRepartoTpv', ini > 0 && fin > ini);
if (ini > 0 && fin > ini) {
  const fn = new Function(`${src.slice(ini, fin)}\nreturn lineasRecibidasRepartoTpv;`)();
  const linea = (o = {}) => ({ source_line_id: 'L1', producto_id: 'P1', estado_linea: 'ENVIADA', linea_version: 3, cuenta_origen_pedido: 'A', cuenta_reparto_id: 'B', cantidad: 2, cantidad_fiscalizada: 0, ...o });
  const estado = (lineas, destinos = [{ cuenta_id: 'A', version: 7 }], actual = 'B') => ({ origen: { cuenta_id: actual, version: 5, reparto: { lineas } }, destinos });

  let r = fn(estado([linea()]));
  check('A1 una línea recibida de otra cuenta se puede devolver entera, con su cuenta de origen', r.length === 1 && r[0].devolvible === 2 && r[0].destino?.cuenta_id === 'A');
  r = fn(estado([linea({ cuenta_origen_pedido: 'B' })]));
  check('A2 una línea del pedido de esta misma cuenta no se ofrece (no se recibió de nadie)', r.length === 0);
  r = fn(estado([linea({ cantidad: 3, cantidad_fiscalizada: 1 })]));
  check('A3 la parte ya fiscalizada no se devuelve (se queda)', r.length === 1 && r[0].devolvible === 2 && r[0].fiscalizada === 1);
  r = fn(estado([linea({ cantidad: 2, cantidad_fiscalizada: 2 })]));
  check('A4 si todo está fiscalizado no hay nada que devolver', r.length === 0);
  r = fn(estado([linea({ estado_linea: 'CANCELADA' }), linea({ source_line_id: 'L2', estado_linea: 'BORRADOR' })]));
  check('A5 las líneas canceladas o en borrador no se ofrecen', r.length === 0);
  r = fn(estado([linea()], []));
  check('A6 si la cuenta de origen ya no admite el reparto (cerrada, otro día) la línea sale sin destino, para avisar y no ofrecer botón', r.length === 1 && r[0].destino === null);
  r = fn(estado([linea({ cuenta_reparto_id: 'C' })]));
  check('A7 solo cuentan las líneas cuyo reparto está en esta cuenta', r.length === 0);
  check('A8 sin estado o sin cuenta actual no devuelve nada ni falla', fn(null).length === 0 && fn({ origen: { reparto: { lineas: [linea()] } } }).length === 0);
}

// ---------- B: cableado (fuente.js y su espejo) ----------
for (const [nombre, t] of [['fuente.js', src], ['source-recovery/fuente-recuperado.js', espejo]]) {
  const tiene = (id, x) => check(`${id} [${nombre}]`, t.includes(x));
  tiene('B1 la acción devuelve la parte con la misma función de servidor de mover cantidad, hacia la cuenta de origen y con las versiones leídas', 'await moverCantidadLineaCuentaA08(linea.source_line_id, item.devolvible, destino.cuenta_id, origenVersion, destino.version, linea.linea_version, "")');
  tiene('B2 no deja pulsar dos veces ni sin permiso', 'if (typeof moverCantidadLineaCuentaA08 !== "function" || moviendoLineaA08 || !puedeDeshacerRepartoA08) return;');
  tiene('B3 el permiso es el del cierre de cuentas (Propietario o Encargado con la nube activa)', 'const puedeDeshacerRepartoA08 = puedeLimpiarCuentasA06 === true;');
  tiene('B4 el panel enseña las líneas recibidas', 'const recibidasA08 = typeof lineasRecibidasRepartoTpv === "function" ? lineasRecibidasRepartoTpv(estadoRepartoA08) : [];');
  tiene('B5 el botón solo sale con permiso y con cuenta de origen disponible', 'puedeDeshacerRepartoA08 && item.destino ? ');
  tiene('B6 el botón se llama «Deshacer reparto» y dice a qué producto afecta', '"Deshacer reparto de " + (producto?.nombre || "producto")');
  tiene('B7 si la cuenta de origen no admite recibirlo, lo explica en lugar de ofrecer el botón', ' · su cuenta de origen ya no admite recibirlo');
  tiene('B8 tras deshacer recarga ambas cuentas desde el servidor y lo dice', 'Reparto deshecho: el producto ha vuelto a su cuenta de origen. Ambas cuentas se han recargado desde el servidor.');
  tiene('B9 un conflicto de versión recarga el estado antes de avisar', 'const fresco = await listarCuentasRepartoA08();\n        if (fresco?.ok) aplicarEstadoRepartoA08(fresco);\n      }\n      setErrorRepartoA08(resultado?.error || "No se pudo deshacer el reparto.");');
}

console.log(fallos === 0 ? 'H47_DESHACER_REPARTO_CONTRACT=PASS' : `H47_DESHACER_REPARTO_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
