/**
 * Contrato de H-15 (auditoría del TPV, decisión E2 del 26/11/2026): venta con stock insuficiente en el piso.
 *
 *   node tests/rediseno/h15-venta-sin-piso-aviso-y-pendiente-contract.mjs
 *   H15_FUENTE=/ruta/otra/fuente.js node tests/rediseno/h15-...   (para comprobar que el código anterior falla)
 *
 * Qué ocurría (VIVO + SERVIDOR, 25/11): «Agua 50 cl (QA)» tenía el piso de venta a 0 y 73 en el almacén. La tarjeta decía «sin stock», el ticket NO
 * avisaba (el aviso comparaba con el stock TOTAL) y el servidor dejó guardar, enviar y cobrar, descontando del almacén sin tocar el piso.
 *
 * Qué ya hacía el servidor (leído en la función viva `registrar_venta_stock` de QA, y 41 ventas así en `movimientos_stock`): toma primero del piso y
 * después del almacén, rechaza solo si piso + almacén no alcanzan (`stock_insuficiente`) y deja cada venta anotada con `delta_almacen < 0`. Es decir,
 * el «déficit del piso» ya queda registrado; faltaba decirlo en el ticket y mostrarlo al Encargado. Por eso H-15 no necesita migración.
 *
 * Se fija, ejecutando el código REAL (las funciones se extraen de fuente.js):
 *   A. el reparto entre piso, almacén y lo que no hay;
 *   B. los textos del aviso;
 *   C. el pendiente «Piso por reponer» (lo vendido hoy desde el almacén, menos los reversos de esas ventas);
 *   D. el cableado: el ticket y la tarjeta usan el reparto, el aviso antiguo solo vale para productos locales, y el pendiente llega al panel de inicio
 *      del Propietario y del Encargado.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const src = await readFile(process.env.H15_FUENTE || path.join(raiz, 'fuente.js'), 'utf8');
const espejo = await readFile(path.join(raiz, 'source-recovery/fuente-recuperado.js'), 'utf8');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}
const extrae = (nombre, t = src) => t.match(new RegExp(`function ${nombre}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n`))?.[0] || null;

const fReparto = extrae('repartoStockDeVentaTpv');
const fTexto = extrae('textoAvisoStockVentaTpv');
const fPendiente = extrae('pisoPorReponerDeMovimientosTpv');
check('A0 existen las tres funciones', !!fReparto && !!fTexto && !!fPendiente);

if (fReparto && fTexto && fPendiente) {
  const { reparto, texto, pendiente } = new Function(`${fReparto}\n${fTexto}\n${fPendiente}\nreturn { reparto: repartoStockDeVentaTpv, texto: textoAvisoStockVentaTpv, pendiente: pisoPorReponerDeMovimientosTpv };`)();
  const agua = { id: 'QA-CAT-A1-AGUA', nombre: 'Agua 50 cl (QA)', _pm07Servidor: true, stock: 73, stockPisoVenta: 0 };

  // A. reparto
  const a1 = reparto(agua, 1);
  check('A1 producto del servidor sin piso y con almacén (el caso de la auditoría): 1 ud sale del almacén, nada sin stock', a1.delPiso === 0 && a1.delAlmacen === 1 && a1.sinStock === 0, JSON.stringify(a1));
  const a2 = reparto({ ...agua, stock: 10, stockPisoVenta: 4 }, 6);
  check('A2 piso 4 y almacén 6, pides 6: 4 del piso y 2 del almacén', a2.delPiso === 4 && a2.delAlmacen === 2 && a2.sinStock === 0, JSON.stringify(a2));
  const a3 = reparto({ ...agua, stock: 10, stockPisoVenta: 4 }, 3);
  check('A3 pides menos que el piso: nada sale del almacén (sin aviso)', a3.delPiso === 3 && a3.delAlmacen === 0 && a3.sinStock === 0);
  const a4 = reparto({ ...agua, stock: 3, stockPisoVenta: 1 }, 5);
  check('A4 pides más que el total: lo que falta es «sin stock» (el servidor lo rechaza)', a4.delPiso === 1 && a4.delAlmacen === 2 && a4.sinStock === 2, JSON.stringify(a4));
  const a5 = reparto({ id: 'x', nombre: 'Local', stock: 8, stockPisoVenta: 2 }, 5);
  check('A5 producto local (sin servidor): solo cuenta el piso, y lo que pasa de él es «sin stock» (el aviso de siempre)', a5.servidor === false && a5.delPiso === 2 && a5.delAlmacen === 0 && a5.sinStock === 3, JSON.stringify(a5));
  check('A6 cantidad 0, negativa o sin producto: nada', reparto(agua, 0).pedida === 0 && reparto(agua, -2).delAlmacen === 0 && reparto(null, 3).sinStock === 0);
  const a7 = reparto({ ...agua, stock: 2.5, stockPisoVenta: 0 }, 1.5);
  check('A7 cantidades fraccionadas (queso al peso)', a7.delAlmacen === 1.5 && a7.sinStock === 0, JSON.stringify(a7));
  check('A8 un piso mayor que el total (dato incoherente) no inventa existencias', reparto({ ...agua, stock: 3, stockPisoVenta: 9 }, 5).delPiso === 3 && reparto({ ...agua, stock: 3, stockPisoVenta: 9 }, 5).sinStock === 2);

  // B. textos
  check('B1 el aviso del almacén dice cuánto hay en el piso, cuánto sale del almacén y que queda anotado', /Agua 50 cl \(QA\): el piso de venta tiene 0 y 1 saldrá del almacén\. La venta queda anotada para reponer el piso\./.test(texto(agua.nombre, a1)), texto(agua.nombre, a1));
  check('B2 el aviso de falta total dice el total, lo pedido y que el servidor no dejará guardar', /solo hay 3 en total .* pides 5\. El servidor no dejará guardar este pedido\./.test(texto('X', a4)), texto('X', a4));
  check('B3 sin nada que avisar, el texto es vacío', texto('X', a3) === '');

  // C. pendiente
  const mov = [
    { id: 1, producto_id: 'AGUA', tipo: 'VENTA', delta_almacen: -2, delta_piso: 0 },
    { id: 2, producto_id: 'AGUA', tipo: 'VENTA', delta_almacen: -1, delta_piso: 0 },
    { id: 3, producto_id: 'CAFE', tipo: 'VENTA', delta_almacen: 0, delta_piso: -3 },
    { id: 4, producto_id: 'AGUA', tipo: 'REVERSO', delta_almacen: 1, movimiento_original_id: 2 },
    { id: 5, producto_id: 'COLA', tipo: 'VENTA', delta_almacen: -1, delta_piso: -2 },
    { id: 6, producto_id: 'COLA', tipo: 'REVERSO', delta_almacen: 1, movimiento_original_id: 5 },
    { id: 7, producto_id: 'VINO', tipo: 'REVERSO', delta_almacen: 4, movimiento_original_id: 999 },
  ];
  const p = pendiente(mov, [{ id: 'AGUA', nombre: 'Agua 50 cl (QA)' }, { id: 'COLA', nombre: 'Cola' }]);
  check('C1 lo vendido desde el almacén, menos los reversos de esas ventas: Agua 2 (3 − 1)', p.length === 1 && p[0].id === 'AGUA' && p[0].cantidad === 2 && p[0].nombre === 'Agua 50 cl (QA)', JSON.stringify(p));
  check('C2 una venta servida solo del piso no genera pendiente (Café); una revertida del todo tampoco (Cola)', !p.some((x) => x.id === 'CAFE' || x.id === 'COLA'));
  check('C3 un reverso de una venta que no está en la lista (otro día) no resta ni crea pendiente (Vino)', !p.some((x) => x.id === 'VINO'));
  check('C4 sin movimientos: nada', pendiente([], []).length === 0 && pendiente(null, null).length === 0);
  const orden = pendiente([{ id: 1, producto_id: 'A', tipo: 'VENTA', delta_almacen: -1 }, { id: 2, producto_id: 'B', tipo: 'VENTA', delta_almacen: -5 }], []);
  check('C5 ordenado de más a menos; sin ficha usa el identificador como nombre', orden[0].id === 'B' && orden[0].nombre === 'B' && orden[1].id === 'A');
}

// D. cableado (fuente.js y su espejo)
for (const [nombre, t] of [['fuente.js', src], ['source-recovery/fuente-recuperado.js', espejo]]) {
  const tiene = (id, x) => check(`${id} [${nombre}]`, t.includes(x));
  tiene('D1 el aviso antiguo («Vas a dejar en negativo») solo vale para productos locales', '.filter((l22) => l22 && !l22.producto._pm07Servidor && l22.cantidadNum > (Number(l22.producto.stockPisoVenta) || 0));');
  tiene('D2 el ticket avisa del reparto entre piso y almacén de los productos del servidor', 'const avisosStockServidorTpv = [...cantidadesProductoA04.entries()]');
  tiene('D3 el aviso del ticket es un estado accesible y rojo solo si falta stock total', '"data-aviso-stock-piso": "1", className: "text-[11px] mb-2" }, avisosStockServidorTpv.map((l22) => /* @__PURE__ */ import_react4.default.createElement("div", { key: l22.producto.id, style: { color: l22.reparto.sinStock > 0 ? C2.red : C2.amber } }, textoAvisoStockVentaTpv(l22.producto.nombre, l22.reparto)))');
  tiene('D4 la tarjeta dice «sin piso · sale del almacén» si hay en el almacén y «sin stock» si no', 'p22._pm07Servidor && (Number(p22.stock) || 0) > 0 ? "sin piso · sale del almac\\u00e9n" : "sin stock"');
  tiene('D5 el padre carga lo vendido hoy desde el almacén solo para Propietario y Encargado, con la sesión del servidor', '!["Propietario", "Encargado"].includes(String(rolServidor || ""))');
  tiene('D6 se lee de movimientos_stock (VENTA y REVERSO de hoy)', '.from("movimientos_stock").select("id,producto_id,tipo,delta_almacen,movimiento_original_id")');
  tiene('D7 el pendiente llega al panel de inicio', 'pisoPorReponer: pisoPorReponerTpv,');
  tiene('D8 el pendiente «Piso por reponer» va el primero y lleva al traspaso', 'titulo: "Piso por reponer",');
  tiene('D9 el panel lo recibe en Dashboard y en PanelDiseno', 'stockBajo, pisoPorReponer,');
  // Regresión encontrada en el navegador (27/11/2026): llamar a setState al montar (aunque devolviera el mismo valor) dejaba la carga inicial del modo
  // local en «Cargando almacén…». El pendiente solo actualiza el estado cuando cambia algo, comparando con una referencia.
  tiene('D12 la lista actual se lleva en una referencia', 'const pisoPorReponerRef = (0, import_react4.useRef)([]);');
  check(`D13 nunca se llama a setState sin cambio al montar (sin actualizaciones funcionales que devuelven el mismo valor) [${nombre}]`, !/setPisoPorReponerTpv\(\(previo\)/.test(t));
  tiene('D14 solo se actualiza el estado si hay algo que vaciar', 'if (pisoPorReponerRef.current.length) {\n        pisoPorReponerRef.current = [];\n        setPisoPorReponerTpv([]);\n      }\n      return;');
  check(`D10 no se escribe nada en el servidor desde este cambio [${nombre}]`, !/pisoPorReponerTpv[\s\S]{0,600}\.(insert|update|upsert|delete)\(/.test(t));
}
check('D11 el espejo lleva las mismas funciones', ['repartoStockDeVentaTpv', 'textoAvisoStockVentaTpv', 'pisoPorReponerDeMovimientosTpv'].every((f) => extrae(f) && espejo.includes(extrae(f))));

console.log(fallos === 0 ? 'H15_VENTA_SIN_PISO_AVISO_Y_PENDIENTE_CONTRACT=PASS' : `H15_VENTA_SIN_PISO_AVISO_Y_PENDIENTE_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
