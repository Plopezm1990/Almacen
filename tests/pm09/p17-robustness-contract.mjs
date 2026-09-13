import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('fuente.js','utf8');
const recovered = fs.readFileSync('source-recovery/fuente-recuperado.js','utf8');
const p17 = fs.readFileSync('supabase/migrations/20260905120500_pm09_operation_id_global_hardening.sql','utf8');
const p15 = fs.readFileSync('supabase/migrations/20260905115000_pm09_fecha_operacion_economica.sql','utf8');
const p07 = fs.readFileSync('supabase/migrations/20260904135838_pm07_stock_ubicacion_y_reversos.sql','utf8');
const p08 = fs.readFileSync('supabase/migrations/20260904204500_pm08_caja_devolucion_indivisible.sql','utf8');

function check(name, ok) {
  console.log(`PM09_P17_${name}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

// PM09 (corrección aplicada en PM26 P03b): las 4 comprobaciones del
// frontend usaban "source.includes(X) || recovered.includes(Y)" -- un OR
// que dejaba pasar el contrato con que UNO SOLO de los dos lados
// cumpliera. Eso permitía que fuente-recuperado.js, congelado desde
// antes de PM09, ocultara indefinidamente que fuente.js (el código vivo
// real) llevaba tiempo sin cumplir su mitad del OR (el mensaje de
// conflicto de idempotencia se escribe con escapes \xNN en fuente.js
// desde hace tiempo, no con el carácter acentuado literal). Ahora se
// exige que AMBOS -- la fuente canónica y el artefacto actual -- superen
// cada garantía de forma independiente.

/** Extrae el cuerpo de una función top-level por nombre, balanceando
 * llaves y respetando comentarios/strings. */
function extraerFuncion(texto, nombre) {
  const patron = new RegExp(`(?:async\\s+)?function\\s+${nombre}\\s*\\(`, 'g');
  const coincidencias = [...texto.matchAll(patron)];
  if (coincidencias.length !== 1) throw new Error(`PM09_${nombre}_COUNT=${coincidencias.length}`);
  const inicio = coincidencias[0].index;
  const apertura = texto.indexOf('{', texto.indexOf('(', inicio));
  let profundidad = 0, comilla = null, escapado = false, lineComment = false, blockComment = false;
  for (let i = apertura; i < texto.length; i++) {
    const c = texto[i], sig = texto[i + 1] || '';
    if (lineComment) { if (c === '\n') lineComment = false; continue; }
    if (blockComment) { if (c === '*' && sig === '/') { blockComment = false; i++; } continue; }
    if (comilla) {
      if (escapado) escapado = false;
      else if (c === '\\') escapado = true;
      else if (c === comilla) comilla = null;
      continue;
    }
    if (c === '/' && sig === '/') { lineComment = true; i++; continue; }
    if (c === '/' && sig === '*') { blockComment = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { comilla = c; continue; }
    if (c === '{') profundidad++;
    if (c === '}' && --profundidad === 0) return texto.slice(inicio, i + 1);
  }
  throw new Error(`PM09_${nombre}_SIN_CIERRE`);
}

/** Igual criterio que PM08: comprueba el conflicto de idempotencia por su
 * rama/resultado funcional (comparación de payload + forma del objeto
 * devuelto), no por el texto visible del mensaje de error -- inmune a si
 * el carácter acentuado se escribe literal o como escape \xNN. */
function verificarConflictoIdempotenciaPorResultado(bloque) {
  const capturaExistente = bloque.match(/const\s+(\w+)\s*=\s*leerPendientePM08\(/);
  if (!capturaExistente) return false;
  const v = capturaExistente[1];
  const reConflicto = new RegExp(
    `JSON\\.stringify\\(${v}\\.payload\\)\\s*!==\\s*JSON\\.stringify\\(payload\\)\\s*\\)\\s*\\{\\s*return\\s*\\{\\s*ok:\\s*false,\\s*pendiente:\\s*${v},`
  );
  if (!reConflicto.test(bloque)) return false;
  const reReplay = new RegExp(`return\\s*\\{\\s*ok:\\s*true,\\s*pendiente:\\s*${v},\\s*recuperada:\\s*true\\s*\\}`);
  return reReplay.test(bloque);
}

check('GLOBAL_HELPER_VALIDATES_ID', p17.includes('private.pm08_validar_operation_id(p_operation_id)'));
check('GLOBAL_HELPER_SERIALIZES_ID', p17.includes('private.pm08_bloquear_operation_id(v_operation_id)'));
check('GLOBAL_HELPER_CHECKS_CAJA', p17.includes('public.caja_operaciones where operation_id=v_operation_id'));
check('GLOBAL_HELPER_CHECKS_ARQUEOS', p17.includes('public.arqueos_caja where operation_id=v_operation_id'));
check('GLOBAL_HELPER_CHECKS_ANULACIONES', p17.includes('public.arqueos_caja_anulaciones where operation_id=v_operation_id'));
check('GLOBAL_HELPER_CONFLICT', p17.includes("raise exception 'operation_id_conflict'"));
check('FOUR_STOCK_WRAPPERS_LOCKED', (p17.match(/private\.pm09_bloquear_operation_id_stock\(p_operation_id\)/g) || []).length === 4);
check('VENTAS_PRESERVE_ECONOMIC_DATE', (p17.match(/jsonb_build_object\('fechaOperacion',p_fecha\)/g) || []).length >= 8);
check('BASE_SALE_REPLAY', p07.includes("return jsonb_build_object('ok',true,'replayed',true,'movimiento',to_jsonb(mov));"));
check('BASE_SALE_PAYLOAD_CONFLICT', p07.includes("raise exception 'operation_id_conflict'"));
check('RETURN_REPLAY', p08.includes("v_operacion_existente.tipo='DEVOLUCION_CLIENTE'") && p08.includes("'replayed',true"));
check('RETURN_CROSS_LEDGER_CONFLICT', p08.includes('exists(select 1 from public.caja_operaciones where operation_id=v_operation_id)') && p08.includes('exists(select 1 from public.arqueos_caja where operation_id=v_operation_id)'));
check('PM09_REVERSO_DATE_CONFLICT', p15.includes("v_fecha_existente<>p_fecha") && p15.includes("raise exception 'operation_id_conflict'"));

// A partir de aquí: AMBOS lados (fuente.js real y fuente-recuperado.js)
// deben superar cada garantía de forma independiente -- sin OR.
check('FRONTEND_TRANSIENT_ERROR_DETECTED_SOURCE', source.includes('function esErrorTransitorioPM08'));
check('FRONTEND_TRANSIENT_ERROR_DETECTED_RECOVERED', recovered.includes('function esErrorTransitorioPM08'));
check('FRONTEND_PENDING_DRAFT_SOURCE', source.includes('pendiente: true'));
check('FRONTEND_PENDING_DRAFT_RECOVERED', recovered.includes('pendiente: true'));
check('FRONTEND_PENDING_PAYLOAD_CONFLICT_SOURCE', verificarConflictoIdempotenciaPorResultado(extraerFuncion(source, 'prepararPendientePM08')));
check('FRONTEND_PENDING_PAYLOAD_CONFLICT_RECOVERED', verificarConflictoIdempotenciaPorResultado(extraerFuncion(recovered, 'prepararPendientePM08')));
check('FRONTEND_DOUBLE_CLICK_GUARD_SOURCE', source.includes('if (enviando) return'));
check('FRONTEND_DOUBLE_CLICK_GUARD_RECOVERED', recovered.includes('if (enviando) return'));

if (process.exitCode) throw new Error('PM09_P17_ROBUSTNESS_CONTRACT_FAIL');
console.log('PM09_P17_ROBUSTNESS_CONTRACT_OK=1');

// --- Prueba negativa deliberada sobre una copia EN MEMORIA (nunca sobre
// la aplicación real): confirma que verificarConflictoIdempotenciaPorResultado
// detecta un puenteo del conflicto de idempotencia. ---
{
  const bloqueReal = extraerFuncion(recovered, 'prepararPendientePM08');
  const puenteado = bloqueReal.replace(
    /!==\s*JSON\.stringify\(payload\)\s*\)\s*\{\s*return\s*\{\s*ok:\s*false,\s*pendiente:\s*existente,/,
    '!== JSON.stringify(payload)) { return { ok: true, pendiente: existente,'
  );
  assert.notEqual(puenteado, bloqueReal, 'mutación sintética sin efecto -- prueba negativa inválida');
  assert.equal(verificarConflictoIdempotenciaPorResultado(puenteado), false, 'la prueba negativa (conflicto puenteado) debía fallar y no falló');
  console.log('PM09_NEGATIVA_CONFLICTO_IDEMPOTENCIA_PUENTEADO=PASS');
}
