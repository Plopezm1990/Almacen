/**
 * Contrato de H-05 (auditoría del TPV, decisión E3 del 26/11/2026): «Devolver anticipo» en Encargos.
 *
 *   node tests/rediseno/h05-devolver-anticipo-encargo-contract.mjs
 *   H05_FUENTE=/ruta/otra/fuente.js node tests/rediseno/h05-...   (para comprobar que el código anterior falla)
 *
 * Qué había: la matriz marcaba «Revertir anticipo» como no construida y devolver la señal de un encargo sin cancelarlo no tenía camino operativo
 * (solo se reembolsaba al cancelar o devolver el encargo entero), con el riesgo de resolverlo a mano en caja y contabilizarlo dos veces.
 *
 * Qué se comprobó en el servidor (QA, 27/11/2026) y por qué la pantalla usa `revertir_pago_encargo` y no `abc_registrar_movimiento_anticipo`:
 *   · `abc_registrar_movimiento_anticipo` opera sobre `abc_cobros_no_venta` con concepto ANTICIPO, y en QA esa tabla solo tiene PROPINAS (ninguna
 *     función crea anticipos ahí): no hay nada que devolver con ella.
 *   · Las señales de los encargos viven en `pagos_encargo` (CONFIRMADO) y se anulan con `revertir_pago_encargo`: SECURITY DEFINER, solo Propietario y
 *     Encargado, motivo obligatorio, identificador de operación fijo (repetir no duplica). Es el reverso que ya usan «Cancelar» y «Devolver» encargo.
 *
 * Se ejecuta el código REAL de `devolverAnticipoEncargo` (extraído de fuente.js) con dependencias falsas, y se fija el cableado de la pantalla.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const src = await readFile(process.env.H05_FUENTE || path.join(raiz, 'fuente.js'), 'utf8');
const espejo = await readFile(path.join(raiz, 'source-recovery/fuente-recuperado.js'), 'utf8');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

// ---------- A: la lógica ----------
const ini = src.indexOf('  async function devolverAnticipoEncargo(encargoOrId, motivo) {');
const fin = ini >= 0 ? src.indexOf('\n  return { addEncargo, updateEncargo,', ini) : -1;
check('A0 existe devolverAnticipoEncargo en la lógica de encargos', ini > 0 && fin > ini);
if (ini > 0 && fin > ini) {
  const cuerpo = src.slice(ini, fin);
  const crea = new Function('encargos', 'encargoEsDelLocalActivo', 'revertirAnticipoEncargo', 'updateEncargo', 'registrarAuditoria',
    `${cuerpo}\nreturn devolverAnticipoEncargo;`);
  function entorno({ encargos, delLocal = () => true, revertir = async () => ({ ok: true, replayed: false }), actualizar = () => true } = {}) {
    const llamadas = { revertir: [], actualizar: [], auditoria: [] };
    const fn = crea(
      encargos,
      delLocal,
      async (...a) => { llamadas.revertir.push(a); return revertir(...a); },
      (...a) => { llamadas.actualizar.push(a); return actualizar(...a); },
      (...a) => { llamadas.auditoria.push(a); }
    );
    return { fn, llamadas };
  }
  const E = { id: 'E1', numero: 'ENC-7', señal: 20 };

  let { fn, llamadas } = entorno({ encargos: [E] });
  let r = await fn('E1', 'El cliente cancela la fecha');
  check('A1 devuelve la señal: revierte EL pago de la señal de ese encargo, con el motivo', r.ok === true && r.importe === 20 && llamadas.revertir.length === 1 && llamadas.revertir[0][0] === 'pago-encargo:E1:senal' && llamadas.revertir[0][1] === 'Devolución de anticipo: El cliente cancela la fecha', JSON.stringify({ r, rev: llamadas.revertir }));
  check('A2 después deja la señal del encargo a 0 (el encargo sigue pendiente, no se cancela) y lo anota en la auditoría', llamadas.actualizar.length === 1 && llamadas.actualizar[0][0] === 'E1' && JSON.stringify(llamadas.actualizar[0][1]) === '{"señal":0}' && llamadas.auditoria.length === 1 && /Devolver anticipo/.test(llamadas.auditoria[0][0]) && /20\.00/.test(llamadas.auditoria[0][1]));

  ({ fn, llamadas } = entorno({ encargos: [E] }));
  r = await fn('E1', '   ');
  check('A3 sin motivo no se llama al servidor', r.ok === false && r.codigo === 'motivo_requerido' && llamadas.revertir.length === 0 && llamadas.actualizar.length === 0);

  ({ fn, llamadas } = entorno({ encargos: [{ id: 'E1', señal: 0 }] }));
  r = await fn('E1', 'x');
  check('A4 un encargo sin señal cobrada no tiene nada que devolver (sin llamada)', r.ok === false && r.codigo === 'sin_anticipo' && llamadas.revertir.length === 0);

  ({ fn, llamadas } = entorno({ encargos: [E], delLocal: () => false }));
  r = await fn('E1', 'x');
  check('A5 un encargo de otro local no se toca', r.ok === false && r.codigo === 'contexto_no_autorizado' && llamadas.revertir.length === 0);

  ({ fn, llamadas } = entorno({ encargos: [E] }));
  r = await fn('NO-EXISTE', 'x');
  check('A6 un encargo que no existe se rechaza', r.ok === false && r.codigo === 'referencia_inexistente' && llamadas.revertir.length === 0);

  ({ fn, llamadas } = entorno({ encargos: [E], revertir: async () => ({ ok: false, codigo: 'no_autorizado', error: 'No tienes permiso para anular este cobro.' }) }));
  r = await fn('E1', 'x');
  check('A7 si el servidor lo rechaza (p. ej. un Cajero/a), la ficha NO cambia y no hay auditoría', r.ok === false && r.codigo === 'no_autorizado' && llamadas.actualizar.length === 0 && llamadas.auditoria.length === 0);

  ({ fn, llamadas } = entorno({ encargos: [E], revertir: async () => ({ ok: true, replayed: true }) }));
  r = await fn('E1', 'x');
  check('A8 una repetición (el servidor repite el resultado) vale y deja la ficha a 0 una sola vez', r.ok === true && r.replayed === true && llamadas.actualizar.length === 1);

  ({ fn, llamadas } = entorno({ encargos: [E], actualizar: () => ({ ok: false }) }));
  r = await fn('E1', 'x');
  check('A9 si el servidor devolvió pero la ficha no se pudo actualizar, lo dice (no se calla ni se repite la devolución)', r.ok === false && r.codigo === 'devuelto_sin_actualizar' && llamadas.auditoria.length === 0);

  // no doble devolución: tras actualizar la ficha (señal 0) un segundo intento ya no llama al servidor
  const lista = [{ id: 'E1', señal: 20 }];
  ({ fn, llamadas } = entorno({ encargos: lista, actualizar: (id) => { lista.find((e) => e.id === id).señal = 0; return true; } }));
  await fn('E1', 'x');
  r = await fn('E1', 'x');
  check('A10 una segunda pulsación, ya con la ficha a 0, no vuelve a llamar al servidor (no hay doble devolución)', llamadas.revertir.length === 1 && r.ok === false && r.codigo === 'sin_anticipo');
}

// ---------- B: el cableado (fuente.js y su espejo) ----------
for (const [nombre, t] of [['fuente.js', src], ['source-recovery/fuente-recuperado.js', espejo]]) {
  const tiene = (id, x) => check(`${id} [${nombre}]`, t.includes(x));
  tiene('B1 la lógica de encargos la expone', 'revertirAnticipoEncargo, devolverAnticipoEncargo };');
  tiene('B2 se usa el reverso de pagos de encargo que ya usan Cancelar y Devolver (pago de la señal de ese encargo)', 'revertirAnticipoEncargo(`pago-encargo:${actual.id}:senal`, "Devoluci\\u00f3n de anticipo: " + motivoTexto)');
  tiene('B3 el padre la pasa a la pantalla solo con la nube activa y para Propietario o Encargado', 'puedeDevolverAnticipoEncargo: typeof window !== "undefined" && window.__nubeActiva === true && ["Propietario", "Encargado"].includes(String(miPerfil?.rol || "")),');
  tiene('B4 el botón «Devolver anticipo» solo sale con permiso y con señal cobrada', 'puedeDevolverAnticipoEncargo && devolverAnticipoEncargo && Number(e2.se\\u00F1al) > 0 &&');
  tiene('B5 el diálogo pide el motivo y no deja confirmar sin él ni dos veces seguidas', 'disabled: procesandoAnticipo || !motivoAnticipo.trim(), onClick: async () => {\n      if (procesandoAnticipo) return;');
  tiene('B6 el diálogo avisa de que solo se puede devolver una vez y de que el encargo sigue pendiente', 'El encargo sigue pendiente y el cobro queda anulado con su motivo. Solo se puede devolver una vez.');
  tiene('B7 el diálogo llama a la lógica nueva con el motivo escrito', 'await devolverAnticipoEncargo(devolverAnticipoId, motivoAnticipo)');
  check(`B8 no se usa abc_registrar_movimiento_anticipo desde la pantalla (no hay anticipos en abc_cobros_no_venta) [${nombre}]`, !/rpc\("abc_registrar_movimiento_anticipo"/.test(t));
}

console.log(fallos === 0 ? 'H05_DEVOLVER_ANTICIPO_ENCARGO_CONTRACT=PASS' : `H05_DEVOLVER_ANTICIPO_ENCARGO_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
