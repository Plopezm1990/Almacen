// El cliente no puede llamar a cosas que el repositorio no sabe crear.
//
// Esto nació el 20/11/2026 de un hallazgo concreto. La gestión de sala de
// org-33 llama a `abc_guardar_tarifa_horario` y `abc_guardar_tarifa_precio`, y
// lee `catalogo_tpv_tarifas_horario` y `catalogo_tpv_tarifa_precios`. Ninguna de
// las cuatro cosas existe en `supabase/migrations`. En QA sí existen: al
// preguntarles responden «permission denied for table», no «Could not find the
// table», que es la diferencia entre una tabla protegida y una que no está.
//
// Es decir, están hechas a mano en el servidor de QA. La fila figura como
// «Pasa» con evidencia live, y lo es —en QA—. Lo que no hay es forma de
// reproducirlo en ningún otro sitio: una promoción llevaría la pantalla y no lo
// que la pantalla necesita.
//
// El mismo agujero ya había aparecido con `prefiltros_candidatos`, y antes, al
// revés, con `abc_unir_cuentas`: una función que llevaba meses escrita en las
// migraciones y que nadie llamaba. Mirar sólo un lado engaña en las dos
// direcciones.
//
// Este contrato es un trinquete: la lista de huecos conocidos está abajo, con
// el motivo de cada uno, y no puede crecer sin que alguien lo escriba. Cuando
// una de esas piezas tenga su migración, se borra de la lista y el contrato se
// aprieta solo.

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const MIGRACIONES = 'supabase/migrations';

// Lo que viene con la librería de Supabase empaquetada dentro de `fuente.js`:
// ejemplos de su propia documentación, no llamadas del programa. Se nombran una
// a una a propósito; no se filtran por un patrón que pudiera tragarse una
// llamada de verdad.
const EJEMPLOS_DE_LA_LIBRERIA = new Set([
  'add_one_each', 'echo', 'function_a', 'hello_world', 'list_stored_countries',
]);

// Huecos conocidos. Cada uno con quién lo necesita y por qué sigue aquí.
const HUECOS_CONOCIDOS = new Map([
  // 20/11/2026: `abc_guardar_tarifa_horario` y `abc_guardar_tarifa_precio` ya no
  // están aquí. Se volcó su definición desde los catálogos del sistema de QA y se
  // escribió 20261120120000_rediseno_org33_tarifas_horario.sql con el texto del
  // volcado, probada contra un Postgres de verdad en
  // tests/rediseno/org33-tarifas-pglite-contract.mjs. El trinquete se aprieta solo:
  // si alguien las vuelve a sacar de las migraciones, esto se pone rojo.
  ['abc_preparar_ticket_fiscal_qa', 'C07-D, ensayo fiscal de QA: vive solo en el proyecto de pruebas'],
  // H-27 (27/11/2026): simulador de tarjeta de QA. Solo QA por diseno (barrera QA-EMP-A / QA-A1 y Propietario) y solo se
  // llaman desde resolverTarjetaSimuladaQa, bajo el interruptor de QA. Versionadas en supabase/qa-only (NO son migraciones) y
  // vigiladas por tests/rediseno/h06-funciones-qa-versionadas-contract.mjs.
  ['abc_qa_confirmar_pago_simulado', 'simulador de tarjeta de QA (H-27): vive solo en el proyecto de pruebas, versionada en supabase/qa-only'],
  ['abc_qa_rechazar_pago_simulado', 'simulador de tarjeta de QA (H-27): vive solo en el proyecto de pruebas, versionada en supabase/qa-only'],
]);

// Tablas que el programa lee y que tampoco crea ninguna migración. Aquí no se
// listan las de la documentación de la librería ni las anteriores a este juego
// de migraciones: sólo las que entraron con trabajo de esta rama y deberían
// haber traído su migración.
// 20/11/2026: esta lista quedó vacía. Las dos tablas de tarifas de org-33, que
// eran las únicas que había, las crea ya
// 20261120120000_rediseno_org33_tarifas_horario.sql. Se deja la lista (y no se
// borra el mecanismo) porque es el sitio donde hay que apuntar la próxima tabla
// que entre sin migración, con su motivo, en vez de dejarla sin nombrar.
const TABLAS_SIN_MIGRACION = new Map([]);

const fuente = fs.readFileSync('fuente.js', 'utf8');

let funcionesDeMigraciones = new Set();
let tablasDeMigraciones = new Set();
for (const f of fs.readdirSync(MIGRACIONES)) {
  if (!f.endsWith('.sql')) continue;
  const s = fs.readFileSync(path.join(MIGRACIONES, f), 'utf8');
  for (const m of s.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.|private\.)?([a-z0-9_]+)\s*\(/gi)) {
    funcionesDeMigraciones.add(m[1].toLowerCase());
  }
  for (const m of s.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.|private\.)?([a-z0-9_]+)/gi)) {
    tablasDeMigraciones.add(m[1].toLowerCase());
  }
}

assert.ok(funcionesDeMigraciones.size > 300, `se leyeron ${funcionesDeMigraciones.size} funciones de las migraciones: parece que el barrido falló`);
assert.ok(tablasDeMigraciones.size > 100, `se leyeron ${tablasDeMigraciones.size} tablas de las migraciones: parece que el barrido falló`);

// ---- 1. Cada RPC que llama el cliente, o está en una migración, o está en la lista ----
const llamadas = new Set();
for (const m of fuente.matchAll(/(?:^|[^a-zA-Z_])(?:configRpc|rpc)\(\s*["']([a-z][a-z0-9_]*)["']/g)) {
  llamadas.add(m[1]);
}
assert.ok(llamadas.size > 90, `se encontraron ${llamadas.size} llamadas: parece que el barrido falló`);

const sinRespaldo = [...llamadas]
  .filter((n) => !funcionesDeMigraciones.has(n))
  .filter((n) => !EJEMPLOS_DE_LA_LIBRERIA.has(n))
  .sort();

const nuevos = sinRespaldo.filter((n) => !HUECOS_CONOCIDOS.has(n));
assert.deepEqual(
  nuevos,
  [],
  `el cliente llama a ${nuevos.join(', ')} y ninguna migración de este repositorio la crea. ` +
  'Si es una pieza nueva, escribe su migración; si de verdad vive sólo en el servidor, añádela a HUECOS_CONOCIDOS con el motivo.'
);

// Y al revés: un hueco que ya se cerró no puede quedarse en la lista fingiendo
// que sigue abierto.
const cerrados = [...HUECOS_CONOCIDOS.keys()].filter((n) => funcionesDeMigraciones.has(n));
assert.deepEqual(cerrados, [], `${cerrados.join(', ')} ya tiene migración: quítalo de HUECOS_CONOCIDOS`);

console.log(`REDISENO_RPC_SIN_MIGRACION=${sinRespaldo.length} (conocidos, con motivo escrito)`);

// ---- 2. Las tablas de org-33 que entraron sin migración ----
for (const [tabla, motivo] of TABLAS_SIN_MIGRACION) {
  assert.ok(
    new RegExp(`\\.from\\(\\s*["']${tabla}["']`).test(fuente),
    `${tabla} ya no se lee desde el cliente: quítala de TABLAS_SIN_MIGRACION (${motivo})`
  );
  assert.ok(
    !tablasDeMigraciones.has(tabla),
    `${tabla} ya tiene migración: quítala de TABLAS_SIN_MIGRACION y celébralo`
  );
}

console.log(`REDISENO_TABLAS_SIN_MIGRACION=${TABLAS_SIN_MIGRACION.size} (org-33, pendientes de migración)`);
console.log('Rediseño — lo que el cliente llama existe en las migraciones, o está escrito por qué no: contrato OK');
