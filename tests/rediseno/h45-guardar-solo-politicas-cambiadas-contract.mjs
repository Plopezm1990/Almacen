/**
 * Contrato de ejecución de H-45 (auditoría del TPV, lote L5): «Guardar» en las políticas de descuentos y cortesías
 * enviaba TODAS las políticas del formulario y el servidor reescribía también las que no cambiaban (cambiaba su fecha de
 * actualización y registraba un evento «configurada» sin cambio real).
 *
 *   node tests/rediseno/h45-guardar-solo-politicas-cambiadas-contract.mjs
 *   H45_FUENTE=/ruta/otra/fuente.js node tests/rediseno/h45-...   (para comprobar que el código anterior falla)
 *
 * El servidor ya registra el valor anterior (`before`) y el nuevo (`after`) en cada evento
 * `DESCUENTO_POLITICA_CONFIGURADA`; lo que faltaba era no enviar lo que no cambia.
 *
 * Se fija, ejecutando el código REAL (la función se extrae de fuente.js):
 *   A. `politicaCambiadaA09` distingue cambio real de no cambio (el porcentaje se compara como número: "20" = 20.0000).
 *   B. «Guardar» recorre solo las políticas que cambian y avisa si no hay ninguna; no recorre ya todo el formulario.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const src = await readFile(process.env.H45_FUENTE || path.join(raiz, 'fuente.js'), 'utf8');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

// ---------- A: la función de comparación ----------
const m = src.match(/const politicaCambiadaA09 = \(actual, servidor\) => \{[\s\S]*?\n  \};/);
check('A0 existe politicaCambiadaA09 en fuente.js', !!m);
if (m) {
  const politicaCambiadaA09 = new Function(`${m[0]}\nreturn politicaCambiadaA09;`)();
  const servidor = { id: 'x', rol: 'Propietario', user_id: null, max_percent: '100.0000', permite_cortesia: true, puede_solicitar: true,
    puede_aplicar: true, puede_autorizar: true, permite_escalado: false, requiere_doble_aprobacion: false, activa: true, updated_at: '2026-11-25T10:00:00Z' };
  const formIgual = { rol: 'Propietario', max_percent: '100', permite_cortesia: true, puede_solicitar: true, puede_aplicar: true,
    puede_autorizar: true, permite_escalado: false, requiere_doble_aprobacion: false, activa: true };
  check('A1 formulario igual al servidor (el porcentaje "100" frente a "100.0000"): no hay cambio', politicaCambiadaA09(formIgual, servidor) === false);
  check('A2 cambia el máximo: hay cambio', politicaCambiadaA09({ ...formIgual, max_percent: '90' }, servidor) === true);
  check('A3 cambia una casilla: hay cambio', politicaCambiadaA09({ ...formIgual, puede_autorizar: false }, servidor) === true);
  check('A4 cambia «Activa»: hay cambio', politicaCambiadaA09({ ...formIgual, activa: false }, servidor) === true);
  check('A5 sin fila en el servidor (rol nuevo o primera configuración): se envía', politicaCambiadaA09(formIgual, undefined) === true);
  check('A6 valores nulos del servidor cuentan como falso', politicaCambiadaA09({ ...formIgual, permite_cortesia: false }, { ...servidor, permite_cortesia: null }) === false);
}

// ---------- B: «Guardar» ----------
const ini = src.indexOf('const guardar = async () => {', src.indexOf('const politicaCambiadaA09'));
const fin = src.indexOf('const campo = (rol, clave, etiqueta)', ini);
const guardar = ini >= 0 && fin > ini ? src.slice(ini, fin) : '';
check('B0 se localizó «guardar» de las políticas', guardar.length > 500);
check('B1 calcula las políticas modificadas antes de guardar', /const rolesAGuardar = Object\.keys\(form\)\.filter\(/.test(guardar));
check('B2 solo llama al servidor por cada política modificada', /for \(const rol of rolesAGuardar\)\s*\{\s*const p3 = form\[rol\];\s*const \{ error: rpcError \} = await supabase\.rpc\("abc_configurar_descuento_politica"/.test(guardar));
check('B3 ya no recorre todo el formulario para enviarlo', !/for \(const rol of Object\.keys\(form\)\)\s*\{\s*const p3 = form\[rol\];/.test(guardar));
check('B4 sin cambios, avisa y no llama al servidor', /rolesAGuardar\.length === 0[\s\S]{0,200}return;/.test(guardar) && guardar.indexOf('rolesAGuardar.length === 0') < guardar.indexOf('abc_configurar_descuento_politica'));
check('B5 la validación sigue cubriendo todas las políticas del formulario', /for \(const rol of Object\.keys\(form\)\)\s*\{\s*const validacion = validarPolitica\(rol, form\[rol\]\)/.test(guardar));

console.log(fallos === 0 ? 'H45_GUARDAR_SOLO_POLITICAS_CAMBIADAS_CONTRACT=PASS' : `H45_GUARDAR_SOLO_POLITICAS_CAMBIADAS_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
