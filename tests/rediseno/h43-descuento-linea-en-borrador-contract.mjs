/**
 * Contrato de H-43 (auditoría del TPV, lote L4): «El descuento no encuentra líneas aptas en una cuenta con un producto recibido por reparto».
 *
 *   node tests/rediseno/h43-descuento-linea-en-borrador-contract.mjs
 *   H43_FUENTE=/ruta/otra/fuente.js node tests/rediseno/h43-...   (para comprobar que el código anterior falla)
 *
 * Causa (leída en la función VIVA de QA y en la migración 20260924160739, no reproducida con datos):
 *   abc_aplicar_descuento_cuenta recorre todas las líneas de la cuenta, INCLUIDAS las recibidas por reparto (`r.cuenta_id = p_cuenta_id`
 *   con reparto ACTIVO), y si alguna está en BORRADOR lanza `descuento_linea_no_apta` para todo el descuento. En la cuenta de la auditoría
 *   había además una línea propia en borrador; la pantalla traducía el error como «sin líneas aptas» y parecía culpar a la línea recibida.
 *   No es un límite de la pantalla ni del servidor sobre los productos recibidos.
 *
 * Qué se corrige (solo la pantalla; el servidor, que mueve dinero, no se toca):
 *   A. el aviso se separa en dos mensajes: «sin productos» y «línea en borrador o sin importe calculado», que dice qué hacer;
 *   B. el panel de descuento avisa antes de intentarlo si el pedido de la cuenta tiene líneas en borrador.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const src = await readFile(process.env.H43_FUENTE || path.join(raiz, 'fuente.js'), 'utf8');
const espejo = await readFile(path.join(raiz, 'source-recovery/fuente-recuperado.js'), 'utf8');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

// ---------- A: mensajes ----------
const sinLineas = src.match(/if \(msg\.includes\("descuento_cuenta_sin_lineas"\)\)[^\n]*/)?.[0] || '';
const noApta = src.match(/if \(msg\.includes\("descuento_linea_no_apta"\)\)[^\n]*/)?.[0] || '';
check('A1 «sin productos» y «línea no apta» ya no comparten mensaje', !!sinLineas && !!noApta);
check('A2 el mensaje de línea no apta nombra el borrador y dice qué hacer (enviar o cancelar el pedido)', /borrador/.test(noApta) && /Envía o cancela/.test(noApta));
check('A3 el mensaje aclara que los productos recibidos por reparto sí admiten descuento', /recibidos por reparto sí admiten descuento/.test(noApta));
check('A4 ya no se culpa a «líneas aptas» de forma genérica', !/líneas aptas/.test(src));

// ---------- B: aviso previo ----------
const m = src.match(/function lineasEnBorradorParaDescuentoA09\(pedido\) \{[\s\S]*?\n\}\n/);
check('B0 existe lineasEnBorradorParaDescuentoA09', !!m);
if (m) {
  const cuenta = new Function(`${m[0]}\nreturn lineasEnBorradorParaDescuentoA09;`)();
  check('B1 sin pedido o sin líneas: 0', cuenta(null) === 0 && cuenta({}) === 0 && cuenta({ lineas: [] }) === 0);
  check('B2 cuenta solo las líneas en BORRADOR', cuenta({ lineas: [{ estado: 'ENVIADA' }, { estado: 'BORRADOR' }, { estado: 'SERVIDA' }, { estado: 'BORRADOR' }, { estado: 'CANCELADA' }] }) === 2);
  check('B3 una línea sin estado no cuenta como borrador', cuenta({ lineas: [{}] }) === 0);
}
for (const [nombre, t] of [['fuente.js', src], ['source-recovery/fuente-recuperado.js', espejo]]) {
  const ini = t.indexOf('function renderDescuentoCuentaA09() {');
  const fin = t.indexOf('\n  function ', ini + 10);
  const panel = ini >= 0 && fin > ini ? t.slice(ini, fin) : '';
  check(`B4 el panel de descuento avisa de las líneas en borrador antes del formulario [${nombre}]`, /lineasEnBorradorParaDescuentoA09\(pedido\) > 0 \? [^\n]*"data-descuento-borrador": "1"[^\n]*\) : null,\s*\n\s*\/\* @__PURE__ \*\/ import_react4\.default\.createElement\(Field, \{ label: "Tipo" \}/.test(panel));
  check(`B5 el aviso es un estado accesible (role=status) y dice que el servidor no descuenta con borradores [${nombre}]`, /role: "status", "data-descuento-borrador"/.test(panel) && /El servidor no aplica descuentos mientras haya productos en borrador/.test(panel));
}
check('B6 el espejo lleva el mismo ayudante', !!m && espejo.includes(m[0]));

console.log(fallos === 0 ? 'H43_DESCUENTO_LINEA_EN_BORRADOR_CONTRACT=PASS' : `H43_DESCUENTO_LINEA_EN_BORRADOR_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
