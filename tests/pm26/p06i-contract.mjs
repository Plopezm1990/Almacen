import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P06i: contrato documental del cierre real del aviso H en QA.
// La verificacion remota se hizo desde el chat con herramientas de
// Supabase. Este contrato no escribe ni consulta ningun proyecto:
// valida el artefacto exacto aplicado, su hash, el alcance declarado y
// vuelve a ejecutar todo el contrato aislado P06f.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}

const rutaDoc = 'tests/pm26/P06I_AVISO_H_APLICADO_QA.md';
const rutaMigracion = 'supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql';
const doc = leer(rutaDoc);
const migracion = leer(rutaMigracion);

for (const marcador of [
  'PM26_P06I_ESTADO=CERRADO',
  'PM26_P06I_PROYECTO=L&A_SUITE_QA',
  'PM26_P06I_PREFLIGHT_ANTES=PASS',
  'PM26_P06I_APPLY_MIGRATION=SUCCESS',
  'PM26_P06I_MIGRACION_REGISTRADA=SI',
  'PM26_P06I_INDICES_CREADOS=4',
  'PM26_P06I_POLITICAS_OPTIMIZADAS=4',
  'PM26_P06I_UNINDEXED_FOREIGN_KEYS_DESPUES=0',
  'PM26_P06I_AUTH_RLS_INITPLAN_DESPUES=0',
  'PM26_P06I_PREFLIGHT_DESPUES=RECHAZADO_COMO_ESPERADO',
  'PM26_P06I_AVISO_F_APLICADO=NO',
  'PM26_P06I_PRODUCCION_ESCRITURA=NO',
  'PM26_P06I_TPV_TOCADO=NO',
  'PM26_P06I_MAIN_RELEASE_NETLIFY_TOCADOS=NO',
]) {
  assert.ok(doc.includes(marcador), `falta el marcador ${marcador}`);
}
console.log('PM26_P06I_ESTADO_DOCUMENTADO=PASS');

const hash = crypto.createHash('sha256').update(Buffer.from(migracion)).digest('hex');
assert.ok(doc.includes(hash), 'el cierre debe identificar el hash exacto del archivo aplicado');
assert.ok(doc.includes('pm26_p06i_aviso_h_rendimiento_qa'), 'falta el nombre registrado de la migracion');
assert.ok(doc.includes('20260910063716'), 'falta la version registrada por Supabase');
assert.ok(doc.includes('a2f6f2c474b67eeb93079a99bdd6455c868375c0'), 'falta el commit endurecido validado antes de aplicar');
console.log('PM26_P06I_ARTEFACTO_Y_REGISTRO_IDENTIFICADOS=PASS');

assert.match(migracion, /^begin;/m);
assert.match(migracion, /^set local lock_timeout = '5s';/m);
assert.match(migracion, /^set local statement_timeout = '30s';/m);
assert.doesNotMatch(migracion, /create\s+index\s+if\s+not\s+exists/i);
assert.ok(migracion.indexOf('begin;') < migracion.indexOf('set local lock_timeout'));
assert.ok(migracion.indexOf('set local lock_timeout') < migracion.indexOf('do $$'));

for (const indice of [
  'idx_auditoria_registro_actor_user_id',
  'idx_movimientos_stock_operation_id',
  'idx_pagos_encargo_revierte_pago_id',
  'idx_suscripciones_push_user_id',
]) {
  assert.ok(migracion.includes(`create index ${indice}`), `falta ${indice} en la migracion`);
  assert.ok(doc.includes(`\`${indice}\``), `falta ${indice} en la verificacion posterior`);
}

for (const politica of [
  'qa_perfil_propio_select',
  'qa_perfil_propio_update',
  'qa_push_propio',
  'membresia_propia_select',
]) {
  assert.ok(migracion.includes(`alter policy ${politica}`), `falta ${politica} en la migracion`);
  assert.ok(doc.includes(`\`${politica}\``), `falta ${politica} en la verificacion posterior`);
}
console.log('PM26_P06I_OCHO_CAMBIOS_ACOTADOS=PASS');

// La migracion de F continua sin aplicar y fuente.js sin la Fase B.
assert.ok(doc.includes('No se aplicó la migración del aviso F.'));
const fuente = leer('fuente.js');
assert.equal(fuente.includes('pm11_crear_prefiltro_candidato'), false);
assert.equal(fuente.includes('pm11_eliminar_prefiltro_candidato'), false);
console.log('PM26_P06I_F_K_L_FUERA_DE_ALCANCE=PASS');

// Reproduce el contrato fuerte anterior: Postgres aislado, bloqueo
// concurrente, rollback total, reaplicacion rechazada y exclusion CLI.
const contratoP06f = path.join(RAIZ_REPO, 'tests/pm26/p06f-contract.mjs');
const r = spawnSync(process.execPath, [contratoP06f], {
  cwd: RAIZ_REPO,
  encoding: 'utf8',
  timeout: 180000,
});
if (r.status !== 0) {
  console.error(r.stdout);
  console.error(r.stderr);
}
assert.equal(r.status, 0, 'el contrato P06f debe seguir en verde');
assert.ok(r.stdout.includes('PM26 P06f — aviso H endurecido'));
console.log('PM26_P06I_REGRESION_P06F=PASS');

// Los nuevos archivos no deben publicar secretos ni identificadores
// internos. El project ref de QA no se documenta: se derivo en vivo.
const archivosNuevos = [
  rutaDoc,
  'tests/pm26/p06i-contract.mjs',
  '.github/workflows/pm26-p06i-aviso-h-aplicado-qa.yml',
];
const hallazgos = escanearArbol({
  raiz: RAIZ_REPO,
  archivos: archivosNuevos,
  ubicacionesLegitimas: [],
});
const secretos = hallazgos.filter((h) => h.tipo === 'secreto_real');
const identificadores = hallazgos.filter(
  (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
);
assert.equal(secretos.length, 0, 'P06i no debe contener secretos reales');
assert.equal(
  identificadores.length,
  0,
  'P06i no debe contener identificadores internos: ' +
    identificadores.map((h) => `${h.archivo}:${h.linea}`).join(', ')
);
console.log('PM26_P06I_SIN_SECRETOS_NI_IDENTIFICADORES=PASS');

console.log('PM26 P06i — aviso H aplicado y verificado en QA: contrato OK');
