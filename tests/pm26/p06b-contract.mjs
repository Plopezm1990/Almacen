import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P06b: contrato de los tres sub-paquetes autorizados sobre los
// avisos F, G y H. No certifica que F o G esten resueltos (siguen sin
// aplicarse) ni que H este aplicado en QA (solo preparado y validado en
// aislamiento) -- certifica que (1) los tres informes documentan con
// precision su estado real, (2) la migracion de H es exactamente la
// que se valido (hash), (3) la validacion aislada de H es reproducible
// de verdad (se re-ejecuta aqui, no se toma como afirmacion), y (4) ni
// los informes ni este contrato contienen ningun secreto real.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}

// ============================= AVISO F =============================
{
  const doc = leer('tests/pm26/P06B_AVISO_F_INVESTIGACION.md');
  assert.match(doc, /PM26_P06B_AVISO_F_INVESTIGACION_COMPLETA=SI/);
  assert.match(doc, /PM26_P06B_AVISO_F_CAMBIOS_APLICADOS=NO/);
  assert.match(doc, /PM26_P06B_AVISO_F_GRANTS_FALTANTES_CONFIRMADOS=SI/);
  assert.match(doc, /PM26_P06B_AVISO_F_EMPRESA_LOCAL_AUSENTES_CONFIRMADO=SI/);
  assert.match(doc, /PM26_P06B_AVISO_F_CONSUMIDOR_CANDIDATO_VIA_EDGE_FUNCTION_CONFIRMADO=SI/);
  assert.match(doc, /PM26_P06B_AVISO_F_RECOMENDACION=HIBRIDA_RLS_LECTURA_RPC_ESCRITURA/);
  assert.match(doc, /PM26_P06B_AVISO_F_OPCION_AMPLIA_AUTHENTICATED_DESCARTADA=SI/);
  assert.match(doc, /PM26_P06B_AVISO_F_OTRAS_DOS_TABLAS_JUSTIFICADAS_SIN_CAMBIO=SI/);

  // Los 7 puntos exigidos deben estar presentes como secciones.
  const puntos = [
    /## 1\. Inventario de `prefiltros_candidatos`/,
    /## 2\. Consumidores reales/,
    /## 3\. ¿Empresa, local, o ambos\? ¿Existe una clave fiable\?/,
    /## 4\. Roles autorizados/,
    /## 5\. Comparación: RLS directo \/ RPC autoritativa \/ híbrida/,
    /## 6\. Por qué no usar `SECURITY DEFINER` para esquivar RLS/,
    /## 7\. Por qué `operaciones_procesadas` y `prefiltro_limites` deben seguir sin políticas/,
  ];
  for (const patron of puntos) assert.match(doc, patron, 'falta un punto obligatorio del aviso F: ' + patron);

  // La politica amplia debe quedar explicitamente descartada, no solo omitida.
  assert.match(doc, /Descartada explícitamente la política amplia/i);

  // El SQL propuesto no debe existir como migracion real -- solo en el documento.
  const migraciones = fs.readdirSync(path.join(RAIZ_REPO, 'supabase/migrations'));
  assert.ok(
    !migraciones.some((m) => /prefiltro/i.test(m)),
    'el aviso F no debe tener ninguna migracion real todavia -- solo el aviso H fue autorizado a prepararla'
  );
  console.log('PM26_P06B_AVISO_F_DOC_VERIFICADO=PASS');
}

// ============================= AVISO G =============================
{
  const doc = leer('tests/pm26/P06B_AVISO_G_CORRECCION.md');
  assert.match(doc, /PM26_P06B_AVISO_G_ESTADO=BLOQUEADO_POR_PLAN/);
  assert.match(doc, /PM26_P06B_AVISO_G_PLAN_ORGANIZACION_VERIFICADO=free/);
  assert.match(doc, /PM26_P06B_AVISO_G_CAMBIO_DE_PLAN_APLICADO=NO/);
  assert.match(doc, /PM26_P06B_AVISO_G_FACTURACION_GENERADA=NO/);
  assert.match(doc, /PM26_P06B_AVISO_G_CONTROL_SUSTITUTO_DECLARADO_EQUIVALENTE=NO/);
  assert.match(doc, /PM26_P06B_AVISO_G_ACTIVABLE_HOY=NO/);
  assert.match(doc, /No se pide al usuario activarlo en el panel/i);
  console.log('PM26_P06B_AVISO_G_DOC_VERIFICADO=PASS');
}

// ============================= AVISO H =============================
{
  const doc = leer('tests/pm26/P06B_AVISO_H_VALIDACION_AISLADA.md');
  assert.match(doc, /PM26_P06B_AVISO_H_MIGRACION_CREADA=SI/);
  assert.match(doc, /PM26_P06B_AVISO_H_MIGRACION_APLICADA_EN_QA=NO/);
  assert.match(doc, /PM26_P06B_AVISO_H_VALIDADA_EN_AISLAMIENTO=SI/);
  assert.match(doc, /PM26_P06B_AVISO_H_PERMISOS_IDENTICOS_ANTES_DESPUES=SI/);
  assert.match(doc, /PM26_P06B_AVISO_H_REVERSION_VALIDADA=SI/);
  assert.match(doc, /PM26_P06B_AVISO_H_INDICES_SIN_USO_TOCADOS=NO/);
  assert.match(doc, /PM26_P06B_AVISO_F_MEZCLADO=NO/);

  // La migracion se relocalizo en PM26 P06e a supabase/qa-solo (fuera
  // de supabase/migrations, para que la CLI de Supabase nunca pueda
  // aplicarla a ningun proyecto por convencion de carpeta). Este
  // informe (P06b) queda como narrativa historica del momento en que
  // se creo -- la ruta y el hash vigentes se verifican contra el
  // informe de P06e, no reescribiendo este.
  const rutaMigracion = 'supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql';
  const migracionAbs = path.join(RAIZ_REPO, rutaMigracion);
  assert.ok(fs.existsSync(migracionAbs), `debe existir ${rutaMigracion}`);
  const hashReal = crypto.createHash('sha256').update(fs.readFileSync(migracionAbs)).digest('hex');
  const docP06e = leer('tests/pm26/P06E_AVISO_H_AISLAMIENTO_QA_SOLO.md');
  assert.match(docP06e, new RegExp(hashReal), 'el hash SHA-256 documentado en P06e no coincide con el archivo real de la migracion');
  assert.match(doc, /relocaliz/i, 'el informe de P06b debe señalar que la migración se relocalizó en P06e');

  const migracionTexto = fs.readFileSync(migracionAbs, 'utf8');
  // Exactamente los 4 indices y las 4 politicas, nada mas -- ninguna
  // mencion a prefiltros_candidatos (aviso F no debe mezclarse aqui).
  for (const nombre of [
    'idx_auditoria_registro_actor_user_id',
    'idx_movimientos_stock_operation_id',
    'idx_pagos_encargo_revierte_pago_id',
    'idx_suscripciones_push_user_id',
  ]) {
    assert.ok(migracionTexto.includes(nombre), `falta el indice ${nombre} en la migracion`);
  }
  for (const politica of ['qa_perfil_propio_select', 'qa_perfil_propio_update', 'qa_push_propio', 'membresia_propia_select']) {
    assert.ok(migracionTexto.includes(politica), `falta la politica ${politica} en la migracion`);
  }
  assert.ok(!/prefiltro/i.test(migracionTexto), 'la migracion de H no debe mencionar prefiltros_candidatos (aviso F)');
  assert.ok(!/drop\s+index/i.test(migracionTexto), 'la migracion de H no debe eliminar ningun indice existente');
  console.log('PM26_P06B_AVISO_H_DOC_Y_MIGRACION_VERIFICADOS=PASS');

  // --- Re-ejecuta de verdad la validacion aislada (no se toma como afirmacion) ---
  const script = path.join(RAIZ_REPO, 'tests/pm26/p06b-h-aislado/validar.sh');
  assert.ok(fs.existsSync(script), 'falta tests/pm26/p06b-h-aislado/validar.sh');
  const r = spawnSync('bash', [script], { cwd: RAIZ_REPO, encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
  }
  assert.equal(r.status, 0, 'la validacion aislada de H (validar.sh) debe terminar con exito');
  const salida = r.stdout;
  for (const marcador of [
    'PM26_P06B_H_AISLADO_SCHEMA=PASS',
    'PM26_P06B_H_AISLADO_SEED=PASS',
    'PM26_P06B_H_AISLADO_BATERIA_ANTES=PASS',
    'PM26_P06B_H_AISLADO_INDICES_AUSENTES_ANTES=PASS',
    'PM26_P06B_H_AISLADO_MIGRACION_APLICADA=PASS',
    'PM26_P06B_H_AISLADO_PERMISOS_IDENTICOS_ANTES_DESPUES=PASS',
    'PM26_P06B_H_AISLADO_SOLO_4_INDICES_NUEVOS_NINGUNO_ELIMINADO=PASS',
    'PM26_P06B_H_AISLADO_INITPLAN_CONFIRMADO=PASS',
    'PM26_P06B_H_AISLADO_REVERSION_EXACTA=PASS',
    'PM26_P06B_H_AISLADO_REPETICION_CONTROLADA_IDEMPOTENTE=PASS',
    'PM26_P06B_H_AISLADO_BLOQUEO_SHARELOCK_CONFIRMADO=PASS',
    'PM26_P06B_H_AISLADO_VALIDACION_COMPLETA=PASS',
  ]) {
    assert.ok(salida.includes(marcador), `falta el marcador ${marcador} en la salida real de validar.sh`);
  }
  console.log('PM26_P06B_AVISO_H_VALIDACION_AISLADA_REPRODUCIDA=PASS');
}

// --- Estructural: ni los informes ni este contrato ni los artefactos
// de H contienen ningun secreto real ni identificador interno fuera de
// una ubicacion legitima. ---
{
  const archivosNuevos = [
    'tests/pm26/P06B_AVISO_F_INVESTIGACION.md',
    'tests/pm26/P06B_AVISO_G_CORRECCION.md',
    'tests/pm26/P06B_AVISO_H_VALIDACION_AISLADA.md',
    'tests/pm26/p06b-contract.mjs',
    'supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql',
    'tests/pm26/p06b-h-aislado/schema.sql',
    'tests/pm26/p06b-h-aislado/seed.sql',
    'tests/pm26/p06b-h-aislado/comportamiento.sql',
    'tests/pm26/p06b-h-aislado/revertir.sql',
    'tests/pm26/p06b-h-aislado/validar.sh',
  ];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevos, ubicacionesLegitimas: [] });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadoresNoAdmitidos = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretosReales.length, 0, 'los archivos nuevos de P06b no deben contener ningún secreto real');
  assert.equal(
    identificadoresNoAdmitidos.length,
    0,
    'los archivos nuevos de P06b no deben contener ningún candidato a identificador interno real -- encontrado en: ' +
      identificadoresNoAdmitidos.map((h) => `${h.archivo}:${h.linea} (${h.categoria})`).join(', ')
  );
  const reset = leer('reset-pruebas-preview.js');
  const claveQA = reset.match(/var SUPABASE_QA_KEY = "([^"]+)";/)?.[1];
  const urlQAHost = reset.match(/var SUPABASE_QA_HOST = "([^"]+)";/)?.[1];
  assert.ok(claveQA && urlQAHost, 'no se pudo extraer la clave/URL QA reales desde el propio archivo para la comprobación');
  for (const rel of archivosNuevos) {
    const contenido = leer(rel);
    assert.ok(!contenido.includes(claveQA), `${rel} no debe contener la clave pública QA copiada literalmente`);
    assert.ok(!contenido.includes(urlQAHost), `${rel} no debe contener el host QA copiado literalmente`);
  }
  console.log('PM26_P06B_SIN_SECRETOS_NI_IDENTIFICADORES_QA_COPIADOS=PASS');
}

console.log('PM26 P06b — avisos F (investigación), G (corrección) y H (preparado y validado en aislamiento): contrato OK');
