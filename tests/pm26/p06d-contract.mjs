import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P06d: contrato de la verificación de solo lectura en producción
// para el aviso F, autorizada por el usuario con alcance estricto
// (estructura, conteo total, políticas/grants, existencia de
// columnas -- nunca filas individuales). No certifica ninguna
// decisión de diseño -- certifica que el informe documenta con
// precisión que no se aplicó ningún cambio, que no se leyó ninguna
// fila individual, y que la divergencia encontrada frente al diseño
// propuesto para QA queda registrada sin resolverse aquí.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}

const doc = leer('tests/pm26/P06D_AVISO_F_PRODUCCION_SOLO_LECTURA.md');

assert.match(doc, /PM26_P06D_ESTADO=SOLO_LECTURA_COMPLETO/);
assert.match(doc, /PM26_P06D_PRODUCCION_FILAS_TOTALES=0/);
assert.match(doc, /PM26_P06D_PRODUCCION_TIENE_POLITICAS_REALES=SI/);
assert.match(doc, /PM26_P06D_PRODUCCION_DISEÑO_DIVERGE_DEL_PROPUESTO_PARA_QA=SI/);
assert.match(doc, /PM26_P06D_PRODUCCION_AISLAMIENTO_EMPRESA_LOCAL=NO/);
assert.match(doc, /PM26_P06D_COLUMNAS_EMPRESA_LOCAL_EXISTEN_EN_PRODUCCION=NO/);
assert.match(doc, /PM26_P06D_FILAS_INDIVIDUALES_LEIDAS=NO/);
assert.match(doc, /PM26_P06D_ESCRITURA_APLICADA=NO/);
assert.match(doc, /PM26_P06D_DECISION_TOMADA=NO/);
console.log('PM26_P06D_ESTADO_DOC_VERIFICADO=PASS');

// Las 4 secciones de la verificacion autorizada deben estar presentes.
const secciones = [
  /## 1\. Estructura de `prefiltros_candidatos` en producción/,
  /## 2\. Número total de filas/,
  /## 3\. Políticas, RLS y permisos reales en producción/,
  /## 4\. Columnas `empresa_id`\/`local_id`/,
];
for (const patron of secciones) assert.match(doc, patron, 'falta una sección obligatoria: ' + patron);

// Las 3 politicas reales de produccion deben quedar documentadas.
for (const politica of ['prefiltros - propietario lee', 'prefiltros - propietario crea', 'prefiltros - propietario borra']) {
  assert.ok(doc.includes(politica), `falta documentar la política real de producción: ${politica}`);
}

// Las 3 opciones de decision deben estar presentes sin elegir ninguna.
assert.match(doc, /\*\*Opción A/);
assert.match(doc, /\*\*Opción B/);
assert.match(doc, /\*\*Opción C\*\*/);
assert.match(doc, /No se ha tocado nada en producción ni en QA para este punto\. No se\s*\n?\s*elige ninguna opción aquí\./);

console.log('PM26_P06D_DIVERGENCIA_DOCUMENTADA=PASS');

// --- Estructural: sin secretos ni identificadores internos. ---
{
  const archivosNuevos = ['tests/pm26/P06D_AVISO_F_PRODUCCION_SOLO_LECTURA.md', 'tests/pm26/p06d-contract.mjs'];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevos, ubicacionesLegitimas: [] });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadoresNoAdmitidos = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretosReales.length, 0, 'los archivos nuevos de P06d no deben contener ningún secreto real');
  assert.equal(
    identificadoresNoAdmitidos.length,
    0,
    'los archivos nuevos de P06d no deben contener ningún candidato a identificador interno real -- encontrado en: ' +
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
  console.log('PM26_P06D_SIN_SECRETOS_NI_IDENTIFICADORES=PASS');
}

console.log('PM26 P06d — verificación de solo lectura en producción para el aviso F: contrato OK');
