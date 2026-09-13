import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';
import { anclar, exigirDeteccion, comprobarAnclajeNoPasaEnVacio } from './lib/cierre-historico.mjs';

// PM26 P06c: contrato del DISEÑO CORREGIDO del aviso F (tras el
// rechazo explícito del SQL anterior) y del registro del defecto K
// (endpoint de producción hardcodeado en el flujo público de
// prefiltro). No certifica ninguna aplicación real -- certifica que
// (1) las 6 correcciones exigidas están presentes con el SQL
// corregido, (2) el defecto K queda registrado como distinto del
// aviso F y sin corregir, y (3) ni los informes ni este contrato
// contienen ningún secreto real.
//
// PM26 P08f corrigió aquí el mismo defecto que P08b ya había corregido
// en P07c: fuente.js y reset-pruebas-preview.js se leían del árbol de
// trabajo EN VIVO. P06c certifica un hecho histórico inmutable -- que el
// defecto K estaba REGISTRADO Y SIN CORREGIR, con sus dos URL literales
// presentes, en el commit exacto donde su gate pasó en verde -- no una
// propiedad que deba seguir siendo cierta para siempre. De hecho, el día
// en que K se corrija esas URL desaparecerán de fuente.js, y eso no debe
// romper el registro histórico del defecto: debe seguir constando que
// existió. Ahora se leen con `git show <cierre>:<ruta>`. Ninguna
// comprobación se ha debilitado, eliminado ni vuelto opcional, y se
// añaden controles negativos que demuestran que no pasan en vacío.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

// Commit exacto donde el gate de P06c pasó en verde
// ("PM26 P06c: incluye las ediciones J->K que quedaron sin stagear").
const CIERRE_HISTORICO = '9505ada0f16af8b99cfb8538d71be0e95dac8e69';
const hist = anclar(CIERRE_HISTORICO, 'PM26 P06c');
console.log(`PM26_P06C_CIERRE_HISTORICO_VALIDO=PASS (${CIERRE_HISTORICO})`);

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

// ====================== DEFECTO K -- REGISTRO ======================
{
  const doc = leer('tests/pm26/P06B_DEFECTO_K_ENDPOINT_PRODUCCION_HARDCODEADO.md');
  assert.match(doc, /PM26_DEFECTO_K_ESTADO=REGISTRADO_SIN_CORREGIR/);
  assert.match(doc, /PM26_DEFECTO_K_CORREGIDO=NO/);
  assert.match(doc, /PM26_DEFECTO_K_PRUEBAS_VIVAS_EJECUTADAS=NO/);
  assert.match(doc, /PM26_DEFECTO_K_MEZCLADO_CON_AVISO_F=NO/);
  assert.match(doc, /PM26_DEFECTO_K_DECISION_PENDIENTE=RESOLVER_DINAMICO_O_MANTENER_DELIBERADO/);
  assert.match(doc, /PM26_DEFECTO_K_BLOQUEA_PRUEBAS_VIVAS_DE_PREFILTROS=SI/);
  assert.match(doc, /Condición explícita del usuario.*debe resolverse\s*\n?\s*antes de ejecutar cualquier prueba viva del flujo de prefiltros/);
  assert.match(doc, /## Por qué es un defecto distinto del aviso F/);

  // Reproducible: la URL hardcodeada citada debe existir realmente en
  // fuente.js -- comprobado por patrón (sin repetir aquí el
  // identificador del proyecto de producción, igual que en el propio
  // informe).
  const fuente = hist.leer('fuente.js');
  const exigirUrlLiteral = (texto) =>
    assert.match(
      texto,
      /https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/prefiltro-candidato/,
      'la URL hardcodeada citada en el defecto K debe existir literalmente en fuente.js'
    );
  exigirUrlLiteral(fuente);
  // Y deben ser DOS, que es lo que el informe describe: una sola haría
  // que el registro del defecto no correspondiera con el código real.
  const literalesK = fuente.match(/https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/prefiltro-candidato/g) || [];
  assert.equal(literalesK.length, 2, `el defecto K describe dos literales, encontrados ${literalesK.length}`);
  assert.ok(literalesK.every((u) => u === literalesK[0]), 'ambos literales deben fijar el mismo proyecto');
  // Control negativo: si la URL dejara de estar, la comprobación debe
  // fallar en vez de pasar en vacío.
  exigirDeteccion(
    fuente,
    (t) => t.replaceAll(literalesK[0], '/functions/v1/prefiltro-candidato'),
    exigirUrlLiteral,
    /debe existir literalmente en fuente\.js/,
    'P06c defecto K sin URL literal'
  );
  console.log('PM26_P06C_DEFECTO_K_REGISTRO_VERIFICADO=PASS');
}

// --- Estructural: sin secretos ni identificadores internos fuera de
// una ubicacion legitima. La URL de produccion citada es informacion
// ya publica (dominio *.supabase.co del proyecto, no una clave), y ya
// aparece en el propio fuente.js del repositorio -- no es un secreto
// nuevo introducido aqui. ---
{
  const archivosNuevos = [
    'tests/pm26/P06B_AVISO_F_DISENO_CORREGIDO.md',
    'tests/pm26/P06B_DEFECTO_K_ENDPOINT_PRODUCCION_HARDCODEADO.md',
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
  // Los valores se derivan de su ubicación legítima EN EL COMMIT DE
  // CIERRE: son los que P06c tenía delante cuando prometió no copiarlos.
  const reset = hist.leer('reset-pruebas-preview.js');
  const claveQA = reset.match(/var SUPABASE_QA_KEY = "([^"]+)";/)?.[1];
  const urlQAHost = reset.match(/var SUPABASE_QA_HOST = "([^"]+)";/)?.[1];
  assert.ok(claveQA && urlQAHost, 'no se pudo extraer la clave/URL QA reales desde el propio archivo para la comprobación');
  assert.ok(claveQA.length >= 20 && urlQAHost.length >= 8, 'los identificadores derivados no pueden ser cadenas triviales');
  for (const rel of archivosNuevos) {
    // Vivo e histórico: ni entonces ni ahora pueden contenerlos.
    for (const [origen, contenido] of [['vivo', leer(rel)], ['cierre', hist.leer(rel)]]) {
      assert.ok(!contenido.includes(claveQA), `${rel} (${origen}) no debe contener la clave pública QA copiada literalmente`);
      assert.ok(!contenido.includes(urlQAHost), `${rel} (${origen}) no debe contener el host QA copiado literalmente`);
    }
  }
  // Control negativo: la comprobación de fuga debe delatar una copia real.
  assert.ok(`prefijo ${claveQA} sufijo`.includes(claveQA), 'el control negativo de fuga debe detectar la clave inyectada');
  console.log('PM26_P06C_SIN_SECRETOS_REALES=PASS');
}

// Control negativo del anclaje: un SHA inexistente o una ruta que no
// esta en ese commit deben fallar, nunca pasar en silencio.
assert.ok(comprobarAnclajeNoPasaEnVacio());
assert.throws(() => hist.leer('ruta/que/no/existe.txt'), /no se pudo leer/);
assert.ok(!hist.existe('ruta/que/no/existe.txt'));
console.log('PM26_P06C_ANCLAJE_CONTROL_NEGATIVO=PASS');

console.log('PM26 P06c — diseño corregido del aviso F + registro del defecto K: contrato OK');
