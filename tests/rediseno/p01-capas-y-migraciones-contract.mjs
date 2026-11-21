import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';

// Por qué existe este contrato.
//
// El rediseño de la apariencia se hace con siete capas sobre el paquete, no
// editándolo: dos hojas de estilo y cinco guiones, enlazados desde
// `index.html`. Hasta hoy, 14/11/2026, **ninguna de las siete aparecía en ningún
// contrato ni en ningún flujo de trabajo**. Se comprobó midiendo: una búsqueda
// de cada nombre de archivo en `tests/`, en `.github/` y en los guiones de
// `docs/rediseno` no devolvía nada para las siete.
//
// Peor: `tests/cfg/f7-preflight-static-contract.mjs` excluye las dos
// migraciones del rediseño de su foto histórica diciendo que «se valida con su
// propio contrato» y que la segunda usa «el mismo contrato propio». Ese
// contrato no existía. Es el mismo patrón que el bucle de regresiones
// heredadas que se saltaba en silencio los contratos ausentes: una nota que
// hace que una ausencia parezca cobertura. Este archivo es ese contrato, y
// ahora el comentario dice la verdad.
//
// Lo que vigila, y por qué cada cosa:
//
//   1. Las siete capas existen, están enlazadas desde `index.html` una sola vez
//      y ninguna queda huérfana en el árbol.
//   2. Cada enlace lleva su marca `?v=`. Una capa sin marca se sirve desde la
//      caché vieja del CDN y el despliegue miente.
//   3. La huella de cada capa está fijada junto a su marca. Esto es lo que
//      impide repetir el fallo del 13/11: cambié `la-apariencia.css`, no subí
//      su marca, y el preview sirvió la copia anterior. Lo peor no fue el fallo
//      sino que `fetch` me dio un verde falso, porque `fetch` se salta la caché
//      que el navegador sí estaba usando. Un contrato estático no se deja
//      engañar por eso.
//   4. Las dos migraciones del rediseño existen y su superficie pública es la
//      que es: seis funciones, cada una retirada de `public` y `anon` y
//      concedida solo a `authenticated`.
//
// El coste, dicho claro: **cambiar una capa obliga a tocar este archivo.** Es a
// propósito. La fricción es exactamente el paso que me salté, y dos líneas aquí
// son más baratas que un despliegue que sirve lo de ayer y lo da por bueno.

const CAPAS = [
  { archivo: 'la-apariencia.css', marca: 'qa-orbita-modules-v65-20261121', huella: '43b32a4afb679641', etiqueta: 'link' },
  { archivo: 'la-pase.css', marca: 'qa-orbita-pase-v2-20261121', huella: '4b14613f8923c353', etiqueta: 'link' },
  { archivo: 'la-apariencia.js', marca: 'qa-apariencia-contexto-v2-20261121', huella: '787e3036904bc526', etiqueta: 'script' },
  { archivo: 'la-apariencia-editor.js', marca: 'qa-apariencia-contexto-20261113', huella: '423e462949e5edea', etiqueta: 'script' },
  { archivo: 'la-orbita-shell.js', marca: 'qa-orbita-shell-v19-20261121', huella: '8b9ab5c5aedf7c75', etiqueta: 'script' },
  { archivo: 'la-pase-panel.js', marca: 'qa-orbita-pase-20261118', huella: '00a951bb2691a431', etiqueta: 'script' },
  { archivo: 'la-tablas-fichas.js', marca: 'qa-tablas-fichas-20261113', huella: 'bea4568d3b696332', etiqueta: 'script' },
];

const html = readFileSync('index.html', 'utf8');
const huella = (ruta) => createHash('sha256').update(readFileSync(ruta)).digest('hex').slice(0, 16);

// ---- 1. Ninguna capa huérfana: lo que hay en el árbol es lo que está fijado. ----
const enElArbol = readdirSync('.')
  .filter((f) => /^la-[\w-]+\.(css|js)$/.test(f))
  .sort();
assert.deepEqual(
  enElArbol,
  CAPAS.map((c) => c.archivo).sort(),
  'Las capas del rediseño que hay en el árbol no son las que este contrato fija. ' +
    'Si has añadido una capa, añádela aquí con su marca y su huella; si has retirado una, ' +
    'quítala también de index.html.',
);

for (const { archivo, marca, huella: esperada, etiqueta } of CAPAS) {
  // ---- 2. Enlazada una sola vez, y con su marca. ----
  const enlaces = [...html.matchAll(new RegExp(`\\./${archivo.replace('.', '\\.')}(\\?v=([\\w-]+))?`, 'g'))];
  assert.equal(
    enlaces.length,
    1,
    `${archivo} aparece ${enlaces.length} veces en index.html; se esperaba exactamente una`,
  );
  assert.ok(
    enlaces[0][2],
    `${archivo} se enlaza sin marca ?v=. Sin marca, el CDN puede servir la copia anterior ` +
      'y el despliegue dice que aplicó algo que no aplicó.',
  );

  const etiquetaCorrecta = etiqueta === 'link'
    ? new RegExp(`<link[^>]+href="\\./${archivo.replace('.', '\\.')}\\?v=`)
    : new RegExp(`<script[^>]+src="\\./${archivo.replace('.', '\\.')}\\?v=`);
  assert.ok(etiquetaCorrecta.test(html), `${archivo} no se enlaza con una etiqueta <${etiqueta}>`);

  // ---- 3. Marca y huella, fijadas juntas. ----
  assert.equal(
    enlaces[0][2],
    marca,
    `La marca de ${archivo} en index.html es «${enlaces[0][2]}» y aquí está fijada «${marca}». ` +
      'Si has cambiado la marca, actualiza también la huella en este contrato.',
  );
  const actual = huella(archivo);
  assert.equal(
    actual,
    esperada,
    `${archivo} ha cambiado (huella ${actual}, fijada ${esperada}) y su marca sigue siendo «${marca}». ` +
      'Sube la marca en index.html y actualiza aquí la pareja marca + huella. ' +
      'Desplegar una capa cambiada con la marca vieja hace que el navegador sirva la de antes.',
  );
}

// ---- 4. Las dos migraciones del rediseño, y su superficie pública. ----
const MIGRACIONES = {
  '20261113090000_rediseno_apariencia_empresa.sql': [
    'abc_apariencia_leer',
    'abc_apariencia_guardar',
    'abc_apariencia_restaurar',
  ],
  '20261113140000_rediseno_apariencia_delegaciones.sql': [
    'abc_apariencia_delegar',
    'abc_apariencia_listar_delegaciones',
    'abc_apariencia_retirar_delegacion',
  ],
};

for (const [archivo, funciones] of Object.entries(MIGRACIONES)) {
  const sql = readFileSync(`supabase/migrations/${archivo}`, 'utf8');
  for (const fn of funciones) {
    assert.ok(
      new RegExp(`create or replace function public\\.${fn}\\b`).test(sql),
      `${archivo} ya no define public.${fn}`,
    );
    // Retirada de public y anon antes de conceder: es el orden que deja la
    // función sin alcance anónimo aunque alguien añada un grant por encima.
    //
    // El `\(` de los dos patrones de abajo no es adorno. Sin él, el `[^;]*` se
    // tragaba el sufijo del nombre y `abc_apariencia_guardar_otro` colaba como
    // si fuera `abc_apariencia_guardar`. Lo descubrió la prueba negativa, que
    // se quedó en verde cuando tenía que caer: la primera versión de este
    // contrato vigilaba mal justo lo que decía vigilar.
    assert.ok(
      new RegExp(`revoke all on function public\\.${fn}\\s*\\([^;]*from public, anon`).test(sql),
      `public.${fn} no retira el permiso de public y anon`,
    );
    assert.ok(
      new RegExp(`grant execute on function public\\.${fn}\\s*\\([^;]*to authenticated`).test(sql),
      `public.${fn} no concede ejecución a authenticated`,
    );
  }
}

// La comprobación previa F7 excluye estas dos de su foto histórica apoyándose
// en este contrato. Si alguien renombra el archivo, que se entere aquí.
const preflight = readFileSync('tests/cfg/f7-preflight-static-contract.mjs', 'utf8');
for (const archivo of Object.keys(MIGRACIONES)) {
  assert.ok(
    preflight.includes(archivo),
    `f7-preflight ya no excluye ${archivo}; o lo ha vuelto a incluir en su foto o lo renombró`,
  );
}
assert.ok(
  preflight.includes('tests/rediseno/p01-capas-y-migraciones-contract.mjs'),
  'f7-preflight excluye las migraciones del rediseño pero ya no nombra este contrato. ' +
    'Decir «se valida con su propio contrato» sin nombrarlo es como estaba antes: ' +
    'una nota que hace que una ausencia parezca cobertura.',
);

console.log(
  `REDISENO_P01_CAPAS_Y_MIGRACIONES_OK=1 capas=${CAPAS.length} migraciones=${Object.keys(MIGRACIONES).length}`,
);
