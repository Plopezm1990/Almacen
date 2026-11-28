/**
 * Contrato de H-51: la venta rápida con tarjeta pendiente ya no dice que el cobro está confirmado.
 *
 *   node tests/rediseno/h51-venta-rapida-tarjeta-pendiente-contract.mjs
 *   H51_FUENTE=/ruta/otra/fuente.js node tests/rediseno/h51-...   (para comprobar que el código anterior falla)
 *
 * Hallado en la verificación en QA del 28/11/2026: con tarjeta el pago queda PENDIENTE hasta que se resuelve, pero la pantalla mostraba «El cobro está confirmado, pero la cuenta no se ha cerrado
 * formalmente» y el aviso seguía allí aunque luego se aprobara el pago y se cerrara la cuenta. El texto ya existía en `release`.
 * Se ejecuta el código REAL del ayudante que decide el aviso y se fija el cableado.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const src = await readFile(process.env.H51_FUENTE || path.join(raiz, 'fuente.js'), 'utf8');
const espejo = await readFile(path.join(raiz, 'source-recovery/fuente-recuperado.js'), 'utf8');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

// ---------- A: el ayudante ----------
const ini = src.indexOf('function avisoVentaRapidaSinCierreTpv(medio, cobro) {');
const fin = ini >= 0 ? src.indexOf('\nvar FILAS_REJILLA_TPV = 4;', ini) : -1;
check('A0 existe el ayudante avisoVentaRapidaSinCierreTpv', ini > 0 && fin > ini);
if (ini > 0 && fin > ini) {
  const aviso = new Function(`${src.slice(ini, fin)}\nreturn avisoVentaRapidaSinCierreTpv;`)();
  const pend = aviso('TARJETA', { cobroIncierto: true, saldo: 1 });
  check('A1 tarjeta con cobro incierto: pendiente y el aviso NO dice «confirmado»', pend.pendiente === true && /pendiente de confirmar/.test(pend.error) && !/está confirmado/.test(pend.error), pend.error);
  check('A2 el aviso de pendiente manda a resolverlo en Sala (Cobro) y a no volver a cobrar', /Sala \(Cobro\)/.test(pend.error) && /no vuelvas a cobrar/.test(pend.error));
  const saldo = aviso('tarjeta', { cobroIncierto: false, saldo: 0.5 });
  check('A3 tarjeta con saldo pendiente (aunque no haya intento incierto): también pendiente', saldo.pendiente === true);
  const conf = aviso('TARJETA', { cobroIncierto: false, saldo: 0 });
  check('A4 tarjeta ya confirmada y saldo 0 pero cuenta sin cerrar: conserva el aviso de «confirmado, pero la cuenta no se ha cerrado»', conf.pendiente === false && /está confirmado, pero la cuenta no se ha cerrado formalmente/.test(conf.error));
  const efe = aviso('EFECTIVO', { cobroIncierto: true, saldo: 1 });
  check('A5 el efectivo nunca se trata como tarjeta pendiente', efe.pendiente === false);
  check('A6 sin datos de cobro no falla y no marca pendiente', aviso('TARJETA', null).pendiente === false && aviso(undefined, undefined).pendiente === false);
}

// ---------- B: cableado (fuente.js y su espejo) ----------
for (const [nombre, t] of [['fuente.js', src], ['source-recovery/fuente-recuperado.js', espejo]]) {
  const tiene = (id, x) => check(`${id} [${nombre}]`, t.includes(x));
  tiene('B1 la venta rápida pide el aviso al ayudante con el medio y el estado real del cobro', 'const avisoRapida = avisoVentaRapidaSinCierreTpv(pagoRapida, cobro);');
  tiene('B2 el resultado de la venta rápida ya no se da por pagado si la tarjeta está pendiente', 'paid: !avisoRapida.pendiente,');
  tiene('B3 y el error mostrado es el del ayudante', 'setErrorVenta(avisoRapida.error);');
  check(`B4 el texto fijo «El cobro está confirmado…» ya solo vive en el ayudante [${nombre}]`, (t.match(/no se ha cerrado formalmente\. Contin/g) || []).length === 1);
  tiene('B5 al cerrar la cuenta desde el cobro se limpia el aviso y el estado de la venta rápida', 'if (String(resultado.cuentaEstado || "").toUpperCase() === "CERRADA") {\n      setErrorVenta("");\n      setResultadoVentaRapida(null);\n    }');
  tiene('B6 al aprobar o rechazar la tarjeta simulada se limpia el aviso', 'Tarjeta simulada rechazada en QA. Puedes volver a cobrar.");\n    setErrorVenta("");');
}

console.log(fallos === 0 ? 'H51_VENTA_RAPIDA_TARJETA_PENDIENTE_CONTRACT=PASS' : `H51_VENTA_RAPIDA_TARJETA_PENDIENTE_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
