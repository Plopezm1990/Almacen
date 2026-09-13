import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('index.html','utf8');
const source = fs.readFileSync('source-recovery/fuente-recuperado.js','utf8');
const backend = JSON.parse(fs.readFileSync('tests/pm05/backend-results.json','utf8'));

function ok(cond, msg){ if(!cond) throw new Error(msg); }

// PM05 (corrección aplicada en PM26 P03b): las assertions de proveedores y
// clientes ya NO dependen de nombres de variable locales elegidos por el
// bundler (p2/p22...) ni de la forma exacta en que se pasan los datos
// (data vs validacion.datos tras PM20 P02) -- comprueban estructuralmente
// las garantías reales: validación antes de mutar, empresaId fijado
// siempre, y el filtro de edición limitado a la empresa activa,
// cualquiera que sea el nombre que el bundler le dé al parámetro.

/** Extrae el cuerpo de una función top-level por nombre, balanceando
 * llaves y respetando comentarios/strings (no se deja engañar por '{' o
 * '}' dentro de literales). Lanza si no hay exactamente una declaración. */
function extraerFuncion(texto, nombre) {
  const patron = new RegExp(`(?:async\\s+)?function\\s+${nombre}\\s*\\(`, 'g');
  const coincidencias = [...texto.matchAll(patron)];
  if (coincidencias.length !== 1) throw new Error(`PM05_${nombre}_COUNT=${coincidencias.length}`);
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
  throw new Error(`PM05_${nombre}_SIN_CIERRE`);
}

/** Comprueba, sin presuponer ningún nombre de variable local, que una
 * función de alta (addProveedor/addCliente-like) valida antes de mutar,
 * detiene el alta si la validación falla, usa los datos ya validados
 * (no los crudos) al construir el registro, y fija empresaId de forma
 * incondicional (propiedad shorthand, no un valor derivado opcional).
 * Devuelve {ok, motivo} en vez de lanzar, para poder usarla también
 * sobre copias mutadas en memoria en las pruebas negativas. */
function verificarAltaValidadaConEmpresa(bloque, nombreValidador) {
  const llamada = bloque.match(new RegExp(`(\\w+)\\s*=\\s*${nombreValidador}\\s*\\(`));
  if (!llamada) return { ok: false, motivo: 'no_llama_al_validador' };
  const variableValidacion = llamada[1];
  const idxLlamada = llamada.index;

  const guardaRe = new RegExp(`if\\s*\\(\\s*!${variableValidacion}\\.ok\\s*\\)\\s*return\\s+${variableValidacion}`);
  const guarda = bloque.match(guardaRe);
  if (!guarda) return { ok: false, motivo: 'no_detiene_alta_si_validacion_falla' };
  const idxGuarda = guarda.index;

  const mutacionRe = /\bset\w+\s*\(/;
  const mutacion = bloque.match(mutacionRe);
  if (!mutacion) return { ok: false, motivo: 'no_se_encontro_mutacion_de_estado' };
  const idxMutacion = mutacion.index;

  if (!(idxLlamada < idxGuarda && idxGuarda < idxMutacion)) {
    return { ok: false, motivo: 'orden_incorrecto_validacion_guarda_mutacion' };
  }

  // El registro construido debe extender una propiedad del resultado ya
  // validado (...variableValidacion.algo), no los datos crudos de entrada.
  const usaDatosValidados = new RegExp(`\\.\\.\\.${variableValidacion}\\.\\w+`).test(bloque);
  if (!usaDatosValidados) return { ok: false, motivo: 'no_usa_los_datos_ya_validados' };

  // empresaId debe aparecer como propiedad shorthand (no opcional, no
  // renombrada) en algún objeto literal del bloque.
  const tieneShorthandEmpresaId = /[{,]\s*empresaId\s*[,}]/.test(bloque);
  if (!tieneShorthandEmpresaId) return { ok: false, motivo: 'no_fija_empresaId' };

  return { ok: true, motivo: null };
}

/** Comprueba, sin presuponer el nombre del parámetro, que una función de
 * edición (updateProveedor/updateCliente-like) limita la mutación a
 * registros de la MISMA empresa activa: el callback de map/filter debe
 * comparar tanto .id === id como .empresaId === empresaId sobre el mismo
 * parámetro. */
function verificarEdicionLimitadaAEmpresa(bloque) {
  const callback = bloque.match(/\.map\s*\(\s*\(?(\w+)\)?\s*=>/);
  if (!callback) return { ok: false, motivo: 'no_se_encontro_callback_de_edicion' };
  const p = callback[1];
  // Acepta tanto la forma "proceder solo si coincide" (===/&&) como la
  // forma "salir si no coincide" (!==/||) -- ambas expresan la misma
  // garantía de aislamiento por empresa, solo cambia el sentido lógico.
  const comparaId = new RegExp(`\\b${p}\\.id\\s*(?:===|!==)\\s*id\\b`).test(bloque);
  const comparaEmpresa = new RegExp(`\\b${p}\\.empresaId\\s*(?:===|!==)\\s*empresaId\\b`).test(bloque);
  if (!comparaId) return { ok: false, motivo: 'no_compara_id' };
  if (!comparaEmpresa) return { ok: false, motivo: 'no_compara_empresaId' };
  return { ok: true, motivo: null };
}

const bloqueAddProveedor = extraerFuncion(source, 'addProveedor');
const bloqueUpdateProveedor = extraerFuncion(source, 'updateProveedor');
const bloqueAddCliente = extraerFuncion(source, 'addCliente');
const bloqueUpdateCliente = extraerFuncion(source, 'updateCliente');

{
  const r = verificarAltaValidadaConEmpresa(bloqueAddProveedor, 'validarProveedorPM10');
  ok(r.ok, `alta proveedor no valida/fija empresa correctamente (${r.motivo})`);
}
{
  const r = verificarEdicionLimitadaAEmpresa(bloqueUpdateProveedor);
  ok(r.ok, `edición proveedor no limita por empresa (${r.motivo})`);
}
{
  const r = verificarEdicionLimitadaAEmpresa(bloqueUpdateCliente);
  ok(r.ok, `edición cliente no limita por empresa (${r.motivo})`);
}
// addCliente no pasa por un validador PM10 dedicado como addProveedor;
// se comprueba directamente que fija empresaId de forma incondicional.
ok(/[{,]\s*empresaId\s*[,}]/.test(bloqueAddCliente), 'alta cliente no fija empresaId');

// --- Pruebas negativas deliberadas sobre copias EN MEMORIA (nunca sobre
// la aplicación real): confirman que verificarAltaValidadaConEmpresa
// detecta cada garantía eliminada por separado. ---
{
  const sinEmpresaId = bloqueAddProveedor.replace(/,\s*empresaId\s*\}/, ' }');
  assert.notEqual(sinEmpresaId, bloqueAddProveedor, 'la mutación sintética no modificó nada -- prueba negativa inválida');
  const r = verificarAltaValidadaConEmpresa(sinEmpresaId, 'validarProveedorPM10');
  assert.equal(r.ok, false, 'la prueba negativa (empresaId eliminado) debía fallar y no falló');
  assert.equal(r.motivo, 'no_fija_empresaId');
  console.log('PM05_NEGATIVA_SIN_EMPRESAID=PASS (motivo esperado: no_fija_empresaId)');
}
{
  // Puentear la validación: usar los datos crudos (data) en vez de los
  // validados, simulando que alguien reemplaza "...validacion.datos" por
  // "...data" -- exactamente el defecto LA-016 que PM20 P02 corrigió.
  const validacionPuenteada = bloqueAddProveedor.replace(/\.\.\.validacion\.datos/, '...data');
  assert.notEqual(validacionPuenteada, bloqueAddProveedor, 'la mutación sintética no modificó nada -- prueba negativa inválida');
  const r = verificarAltaValidadaConEmpresa(validacionPuenteada, 'validarProveedorPM10');
  assert.equal(r.ok, false, 'la prueba negativa (validación puenteada) debía fallar y no falló');
  assert.equal(r.motivo, 'no_usa_los_datos_ya_validados');
  console.log('PM05_NEGATIVA_VALIDACION_PUENTEADA=PASS (motivo esperado: no_usa_los_datos_ya_validados)');
}
{
  // Eliminar la guarda que detiene el alta cuando la validación falla.
  const sinGuarda = bloqueAddProveedor.replace(/if\s*\(!validacion\.ok\)\s*return\s+validacion;\s*/, '');
  assert.notEqual(sinGuarda, bloqueAddProveedor, 'la mutación sintética no modificó nada -- prueba negativa inválida');
  const r = verificarAltaValidadaConEmpresa(sinGuarda, 'validarProveedorPM10');
  assert.equal(r.ok, false, 'la prueba negativa (guarda eliminada) debía fallar y no falló');
  assert.equal(r.motivo, 'no_detiene_alta_si_validacion_falla');
  console.log('PM05_NEGATIVA_SIN_GUARDA=PASS (motivo esperado: no_detiene_alta_si_validacion_falla)');
}
{
  // Edición sin límite de empresa: quitar la comparación de empresaId del
  // predicado de map.
  const sinLimiteEmpresa = bloqueUpdateProveedor.replace(/\s*&&\s*\w+\.empresaId\s*===\s*empresaId/, '');
  assert.notEqual(sinLimiteEmpresa, bloqueUpdateProveedor, 'la mutación sintética no modificó nada -- prueba negativa inválida');
  const r = verificarEdicionLimitadaAEmpresa(sinLimiteEmpresa);
  assert.equal(r.ok, false, 'la prueba negativa (edición sin límite de empresa) debía fallar y no falló');
  assert.equal(r.motivo, 'no_compara_empresaId');
  console.log('PM05_NEGATIVA_EDICION_SIN_LIMITE_EMPRESA=PASS (motivo esperado: no_compara_empresaId)');
}

ok(source.includes('crearLogicaProveedores({ proveedores, setProveedores, registrarAuditoria, empresaId })'), 'lógica de proveedores sin empresa');
ok(source.includes('crearLogicaClientes({ clientes, setClientes, registrarAuditoria, empresaId })'), 'lógica de clientes sin empresa');
ok(source.includes('empresaId: empresaDelLocalActivo?.id || null, localId: localActivoId || null'), 'evento auditoría sin contexto empresa/local');
ok(source.includes('p_empresa_id: entrada.empresaId'), 'RPC auditoría no recibe empresa');
ok(source.includes('p_local_id: entrada.localId'), 'RPC auditoría no recibe local');

ok(index.includes('proveedores: "proveedores_empresa"'), 'proveedores no usa tabla empresarial');
ok(index.includes('clientes: "clientes_empresa"'), 'clientes no usa tabla empresarial');
ok(index.includes('CLAVES_CACHE_POR_USUARIO'), 'cache sensible no está separada por identidad');
ok(index.includes('key + "::usuario:" + uid'), 'cache no incorpora uid');
ok(index.includes('sincronizarColeccionEmpresa'), 'falta sincronización empresarial');
ok(index.includes('Hay registros sin id/empresaId; se bloquea la sincronización'), 'falta fail-closed para registros sin empresa');
ok(index.includes('p_empresa_id: d.empresaId || null'), 'auditoría diferida no transmite empresa');
ok(index.includes('p_local_id: d.localId || null'), 'auditoría diferida no transmite local');

ok(backend.live_validation_initial.failed === 0 && backend.live_validation_initial.passed === 15, 'validación inicial PM05 no está verde');
ok(backend.live_validation_final.failed === 0 && backend.live_validation_final.passed === 18, 'validación final PM05 no está verde');
ok(backend.live_validation_final.fixture === 'PM05-FINAL-v1', 'fixture final PM05 inesperado');
ok(backend.pm04_negative_baseline_after_pm05.failed === 0 && backend.pm04_negative_baseline_after_pm05.passed === 5, 'baseline PM04 no quedó cerrado');
ok(backend.production_touched === false, 'la evidencia indica producción modificada');
ok(Array.isArray(backend.migrations) && backend.migrations.length === 3, 'migraciones PM05 incompletas');
ok(backend.temporary_validator.final_version === 4 && backend.temporary_validator.final_verify_jwt === true && backend.temporary_validator.final_behavior === '410 disabled', 'validador temporal no quedó neutralizado');
ok(backend.temporary_validator.temporary_users_remaining === 0, 'quedan usuarios temporales PM05');
ok(backend.temporary_validator.temporary_audit_rows_remaining === 0, 'quedan auditorías temporales PM05');
ok(backend.temporary_validator.temporary_proveedores_remaining === 0, 'quedan proveedores temporales PM05');
ok(backend.temporary_validator.temporary_clientes_remaining === 0, 'quedan clientes temporales PM05');

console.log('PM05_FRONTEND_CONTRACT_OK=1');
console.log('PM05_BACKEND_INITIAL_15_15=1');
console.log('PM05_BACKEND_FINAL_18_18=1');
console.log('PM05_PM04_NEGATIVOS_5_5=1');
