import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P06c: contrato del DISEÑO CORREGIDO del aviso F (tras el
// rechazo explícito del SQL anterior) y del registro del defecto J
// (endpoint de producción hardcodeado en el flujo público de
// prefiltro). No certifica ninguna aplicación real -- certifica que
// (1) las 6 correcciones exigidas están presentes con el SQL
// corregido, (2) el defecto J queda registrado como distinto del
// aviso F y sin corregir, y (3) ni los informes ni este contrato
// contienen ningún secreto real.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}

// ====================== AVISO F -- DISEÑO CORREGIDO ======================
{
  const doc = leer('tests/pm26/P06B_AVISO_F_DISENO_CORREGIDO.md');

  assert.match(doc, /PM26_P06B_AVISO_F_DISENO_CORREGIDO=SI/);
  assert.match(doc, /PM26_P06B_AVISO_F_GRANT_SELECT_EXPLICITO=SI/);
  assert.match(doc, /PM26_P06B_AVISO_F_MUTACIONES_REVOCADAS_EXPLICITAMENTE=SI/);
  assert.match(doc, /PM26_P06B_AVISO_F_RPC_USA_PM11_PUEDE_MUTAR_PERSONAL=SI/);
  assert.match(doc, /PM26_P06B_AVISO_F_SEARCH_PATH_VACIO_CUALIFICADO=SI/);
  assert.match(doc, /PM26_P06B_AVISO_F_PRODUCCION_CONSULTADA=NO/);
  assert.match(doc, /PM26_P06B_AVISO_F_MATRIZ_PRUEBAS_PRESENTE=SI/);
  assert.match(doc, /PM26_P06B_AVISO_F_MIGRACION_REAL_PREPARADA=NO/);
  assert.match(doc, /PM26_P06B_AVISO_F_APLICADO_EN_QA=NO/);

  // Las 6 correcciones deben estar presentes como secciones.
  const correcciones = [
    /## Corrección 1 — `GRANT SELECT` explícito a `authenticated`/,
    /## Corrección 2 — mutaciones directas revocadas explícitamente/,
    /## Corrección 3 — RPC de escritura con `private\.pm11_puede_mutar_personal`/,
    /## Corrección 4 — `SECURITY DEFINER`, `search_path` y `EXECUTE` endurecidos/,
    /## Corrección 5 — filas existentes, backfill, nulabilidad, aislamiento/,
    /## Corrección 6 — pruebas positivas y negativas de roles, empresas, locales y tokens/,
  ];
  for (const patron of correcciones) assert.match(doc, patron, 'falta una corrección exigida: ' + patron);

  // El SQL debe usar el helper de mutar, no el de ver, en las RPC de escritura.
  assert.match(doc, /private\.pm11_puede_mutar_personal\(p_empresa_id, p_local_id\)/g);
  const usosEnRpc = [...doc.matchAll(/private\.pm11_puede_mutar_personal/g)].length;
  assert.ok(usosEnRpc >= 2, 'pm11_puede_mutar_personal debe usarse en ambas RPC de escritura');

  // GRANT/REVOKE explicitos presentes.
  assert.match(doc, /grant select on public\.prefiltros_candidatos to authenticated;/);
  assert.match(doc, /revoke insert, update, delete on public\.prefiltros_candidatos from authenticated, anon, public;/);

  // search_path vacio + cualificacion completa (patron mas endurecido,
  // no la lista de esquemas), una vez por cada una de las 2 RPC nuevas.
  const searchPathVacio = [...doc.matchAll(/set search_path to ''/g)].length;
  assert.ok(searchPathVacio >= 2, `las 2 RPC nuevas deben usar search_path vacío -- encontrado ${searchPathVacio}`);

  // No debe existir ninguna migracion real para el aviso F todavia.
  const migraciones = fs.readdirSync(path.join(RAIZ_REPO, 'supabase/migrations'));
  assert.ok(
    !migraciones.some((m) => /prefiltro/i.test(m)),
    'el aviso F no debe tener ninguna migracion real todavia'
  );

  // La matriz de pruebas debe cubrir al menos los 13 casos.
  for (let n = 1; n <= 13; n += 1) {
    assert.match(doc, new RegExp(`\\| ${n} \\|`), `falta el caso ${n} de la matriz de pruebas`);
  }

  console.log('PM26_P06C_AVISO_F_DISENO_CORREGIDO_VERIFICADO=PASS');
}

// ====================== DEFECTO J -- REGISTRO ======================
{
  const doc = leer('tests/pm26/P06B_DEFECTO_J_ENDPOINT_PRODUCCION_HARDCODEADO.md');
  assert.match(doc, /PM26_DEFECTO_J_ESTADO=REGISTRADO_SIN_CORREGIR/);
  assert.match(doc, /PM26_DEFECTO_J_CORREGIDO=NO/);
  assert.match(doc, /PM26_DEFECTO_J_PRUEBAS_VIVAS_EJECUTADAS=NO/);
  assert.match(doc, /PM26_DEFECTO_J_MEZCLADO_CON_AVISO_F=NO/);
  assert.match(doc, /PM26_DEFECTO_J_DECISION_PENDIENTE=RESOLVER_DINAMICO_O_MANTENER_DELIBERADO/);
  assert.match(doc, /## Por qué es un defecto distinto del aviso F/);

  // Reproducible: la URL hardcodeada citada debe existir realmente en
  // fuente.js -- comprobado por patrón (sin repetir aquí el
  // identificador del proyecto de producción, igual que en el propio
  // informe).
  const fuente = leer('fuente.js');
  assert.match(
    fuente,
    /https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/prefiltro-candidato/,
    'la URL hardcodeada citada en el defecto J debe existir literalmente en fuente.js'
  );
  console.log('PM26_P06C_DEFECTO_J_REGISTRO_VERIFICADO=PASS');
}

// --- Estructural: sin secretos ni identificadores internos fuera de
// una ubicacion legitima. La URL de produccion citada es informacion
// ya publica (dominio *.supabase.co del proyecto, no una clave), y ya
// aparece en el propio fuente.js del repositorio -- no es un secreto
// nuevo introducido aqui. ---
{
  const archivosNuevos = [
    'tests/pm26/P06B_AVISO_F_DISENO_CORREGIDO.md',
    'tests/pm26/P06B_DEFECTO_J_ENDPOINT_PRODUCCION_HARDCODEADO.md',
    'tests/pm26/p06c-contract.mjs',
  ];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevos, ubicacionesLegitimas: [] });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadoresNoAdmitidos = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretosReales.length, 0, 'los archivos nuevos de P06c no deben contener ningún secreto real');
  assert.equal(
    identificadoresNoAdmitidos.length,
    0,
    'los archivos nuevos de P06c no deben contener ningún candidato a identificador interno real -- encontrado en: ' +
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
  console.log('PM26_P06C_SIN_SECRETOS_REALES=PASS');
}

console.log('PM26 P06c — diseño corregido del aviso F + registro del defecto J: contrato OK');
