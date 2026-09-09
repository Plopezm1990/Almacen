# PM26 P04a — Inspección de solo lectura: defectos B, C y D

## Estado

**Solo lectura. Nada modificado ni eliminado.** No se ha tocado
`index.html`, `_headers`, `reset-pruebas-preview.js`, ninguno de los 10
archivos huérfanos, ni ningún recurso servido. No se mezcla aquí el
defecto E ni los avisos F–H. PM05–PM09 no se reabren: sus garantías ya
quedaron revalidadas en PM26 P03b con contratos estructurales.

---

## 1. Defecto B — 10 archivos JavaScript compilados huérfanos

### 1.1 Nombre, tamaño, hash y procedencia

| Archivo | Bytes | SHA-256 |
|---|---|---|
| `chunk-43ACCR2P.js` | 1.570 | `541492525590388f0d1010255260d179d3c63e5651a8575cc8109385a7b36f99` |
| `chunk-CZ7CSFO4.js` | 1.581 | `83030edcc76942df399df7e666987079e4a925134c7a7c9fb918032f5d7ca970` |
| `chunk-SULEHD65.js` | 416 | `d4c325af2847bcb5bb6de23eedfdaf74b2d4a660c42c1da295d4004de3e0c191` |
| `chunk-WNPC2SID.js` | 384 | `ee7fe09c7062aff5b6339d51d44a03b3eb698559bae0b3655bdaccb806a7b671` |
| `html2canvas-5V7KZ5X4.js` | 399.382 | `99d13a41ca9083cba8a9089c3a8c722c543952e1cf28505bbce70ac7a3df3998` |
| `html2canvas-5V7KZ5X4-UL42RKXS.js` | 399.465 | `44e74583ebe23a3994f05629d917a6507cd9356c3c810c0e5a7fa5bb97b925f9` |
| `purify.es-TSVPIOEK.js` | 67.380 | `79300a99e47aa14ecbae71c0c9bec903bacda265e885bffb58961bea61dea7bd` |
| `purify.es-TSVPIOEK-6SSTY34W.js` | 67.390 | `7f89a5122b839941bd3377405419b62da888f083290afa57cf0963e6732b166b` |
| `index.es-SJCMKHSO.js` | 368.729 | `2c67512914599fc38296eed9396b3b6705b72576a82ed0ef27cc6d6b0212d87a` |
| `index.es-SJCMKHSO-5BY7EMAG.js` | 359.030 | `1332ca8a31063f882fc7b9c327b4c146536f2f38379dacb14cd1c91864e77186` |

Total: 1.665.327 bytes (coincide con el punto 6 de PM26 P01).

**Procedencia**: los 10 fueron añadidos en el mismo commit,
`95d3c3d` ("Add files via upload", 2026-08-28 11:50:50), **antes de
cualquier paquete del Plan Maestro**. Verificado con
`git log --follow --diff-filter=A` sobre cada archivo. Cuatro de ellos
(`chunk-43ACCR2P.js` y otros) fueron borrados y vueltos a subir 2–3 veces
el 2026-08-29, en una sesión de experimentación manual del propietario
del repositorio (autor `Plopezm1990`, no un paquete PM) — verificado
comparando el blob de contenido (`git rev-parse <commit>:<archivo>`) de
cada evento "Add": **es el mismo blob exacto en todos los casos**, y
coincide con el `HEAD` actual. El contenido no ha cambiado nunca desde el
primer commit.

### 1.2 Contenido y licencias

Identificados por su contenido, no por el nombre:

- `html2canvas-5V7KZ5X4.js` / `html2canvas-5V7KZ5X4-UL42RKXS.js`:
  **html2canvas**, licencia MIT, `Copyright (c) 2022 Niklas von Hertzen`.
- `purify.es-TSVPIOEK.js` / `purify.es-TSVPIOEK-6SSTY34W.js`:
  **DOMPurify** (`node_modules/dompurify/dist/purify.es.mjs`), doble
  licencia Apache-2.0/Mozilla Public License.
- `index.es-SJCMKHSO.js` / `index.es-SJCMKHSO-5BY7EMAG.js`: **canvg**
  (`node_modules/canvg/lib/index.es.js`) más polyfills de `core-js` y
  helpers de `@babel/runtime` — licencia MIT.
- `chunk-43ACCR2P.js`, `chunk-CZ7CSFO4.js`, `chunk-SULEHD65.js`,
  `chunk-WNPC2SID.js`: fragmentos internos de esbuild (helpers
  `__commonJS`/`__toESM`, y en el caso de `chunk-SULEHD65.js`/`chunk-WNPC2SID.js`,
  el helper `_typeof` de `@babel/runtime`) — sin licencia propia
  (código de infraestructura de bundling, no una librería de terceros).

Todas son librerías con licencia permisiva estándar; no hay conflicto de
licencia en retirarlas (los tres paquetes reales -- html2canvas,
DOMPurify, canvg -- siguen presentes y licenciados correctamente dentro
de `fuente.js`, ver 1.4).

### 1.3 Grafo de referencias (búsqueda completa en el árbol rastreado)

Búsqueda con `git grep` del nombre exacto de cada uno de los 10 archivos
sobre **todo** el árbol rastreado por git (HTML, JS, CSS, manifest,
service worker, `_headers`, `supabase/`, workflows):

**Ninguno de los 10 está referenciado desde fuera del propio grupo.**
`index.html`, `fuente.js`, `sw.js`, `manifest.json`, `_headers`,
`netlify.toml` (no existe; ver PM26 P01 punto 1) y `supabase/` no
mencionan ninguno de los 10 nombres, ni con la ruta completa ni con un
prefijo genérico (`html2canvas`, `purify`, `index.es-`) que sugiera una
referencia construida dinámicamente. Se buscó también `import()` dinámico
en `fuente.js`/`index.html`: las dos únicas coincidencias son el texto
literal de un mensaje de error interno de React (`lazy(() =>
import('./MyComponent'))`), sin relación con estos archivos.

Los 10 **sí se referencian entre sí**, formando dos sub-grafos
paralelos y completamente aislados (aparenta ser dos salidas de compilación
distintas del mismo conjunto de librerías, ninguna conectada al `fuente.js`
actual):

```
purify.es-TSVPIOEK.js          → chunk-CZ7CSFO4.js
purify.es-TSVPIOEK-6SSTY34W.js → chunk-43ACCR2P.js, chunk-CZ7CSFO4.js
html2canvas-5V7KZ5X4.js          → chunk-CZ7CSFO4.js
html2canvas-5V7KZ5X4-UL42RKXS.js → chunk-43ACCR2P.js, chunk-CZ7CSFO4.js
index.es-SJCMKHSO.js          → chunk-CZ7CSFO4.js, chunk-SULEHD65.js
index.es-SJCMKHSO-5BY7EMAG.js → chunk-43ACCR2P.js, chunk-WNPC2SID.js, chunk-CZ7CSFO4.js

chunk-CZ7CSFO4.js  → import "./edge-auth-patch.js"   (ÚNICA dependencia externa al grupo)
chunk-43ACCR2P.js, chunk-SULEHD65.js, chunk-WNPC2SID.js → sin imports (hojas)
```

**Hallazgo relevante**: `chunk-CZ7CSFO4.js` contiene literalmente
`import "./edge-auth-patch.js";` en su primera línea — es el mismo
encadenamiento histórico `fuente.js -> chunk-CZ7CSFO4.js ->
edge-auth-patch.js` ya documentado en
`docs/plan-maestro/PM17_DIAGNOSTICO_PARCHES.md` y en
`source-recovery/entrada-recuperada.js` (como comentario explicativo, no
como import real). Como `chunk-CZ7CSFO4.js` no está referenciado por
nada fuera del grupo de 10 (confirmado arriba), este `import` nunca se
ejecuta hoy — es un remanente muerto, no una dependencia activa.

Los otros comentarios de sección tipo `// chunk-CZ7CSFO4.js` o
`// chunk-SULEHD65.js` al inicio de algunos archivos son artefactos de
esbuild (marcan de qué módulo original procede el código impreso, igual
fenómeno que el documentado en PM26 P03a/P03b) — **no son imports reales**,
solo comentarios.

Menciones fuera de código (no ejecutables, sin efecto funcional):
`source-recovery/README.md` (diagrama histórico de cómo se componía el
bundle original) y `tests/pm26/P01_INVENTARIO_DIAGNOSTICO.md` (el propio
inventario que originó el defecto B).

### 1.4 Redundancia confirmada contra `fuente.js`

Las tres librerías reales están **inlineadas de forma nativa** dentro del
`fuente.js` que sirve producción hoy, confirmado por sus propios
comentarios de sección de esbuild:

- `fuente.js:23615` → `// node_modules/html2canvas/dist/html2canvas.js`
  (`require_html2canvas = __commonJS(...)`, con las mismas cadenas
  (`html2canvas-container`, `data-html2canvas-debug`, etc.) que la copia
  huérfana).
- `fuente.js:31400` → `// node_modules/dompurify/dist/purify.es.mjs`
  (`createDOMPurify()`, `DOMPurify.version = "3.4.14"`).
- `fuente.js:38160` → `// node_modules/canvg/lib/index.es.js`.

Es decir: los 10 archivos no son solo "no referenciados", son
**duplicados completos y funcionalmente redundantes** de código que ya
existe, activo, dentro del propio `fuente.js`.

### 1.5 Dependencia de proceso: ledger del escáner de seguridad

4 de los 10 archivos **sí tienen una entrada activa** en
`tools/seguridad/linea-base-aceptada.json` (la línea base aceptada del
gate de PM26 P02), todas clasificadas `falso_positivo` (coincidencias
casuales de 20 caracteres alfanuméricos dentro del código vendorizado,
sin relación con ningún project ref real):

| Archivo | categoría | cantidad | huellas |
|---|---|---|---|
| `index.es-SJCMKHSO-5BY7EMAG.js` | `falso_positivo` | 1 | `ab4eeda43e545149` |
| `index.es-SJCMKHSO.js` | `falso_positivo` | 1 | `ab4eeda43e545149` |
| `purify.es-TSVPIOEK-6SSTY34W.js` | `falso_positivo` | 2 | `d85b2d645bf7db44`, `e4bcca595cb58f11` |
| `purify.es-TSVPIOEK.js` | `falso_positivo` | 2 | `d85b2d645bf7db44`, `e4bcca595cb58f11` |

Esto significa que **eliminar estos 4 archivos sin regenerar el ledger
haría fallar el gate PM26 P02** (`registrado_en_ledger_pero_ya_no_aparece`).
No es un bloqueo para retirarlos, pero es un archivo real
(`tools/seguridad/linea-base-aceptada.json`) que P04b tendría que tocar
junto con la retirada, regenerando el ledger con el escáner ya existente
(`regenerar-ledgers`), no editándolo a mano.

`html2canvas-5V7KZ5X4.js` contiene una coincidencia casual de forma
`AKIA[0-9A-Z]{16}` (documentada ya en PM26 P01 como subcadena de una
tabla binaria de compresión de fuentes) que **no** aparece en ningún
ledger porque no dispara el patrón de secreto real del escáner tal como
está definido — verificado indirectamente: el gate `verificar` pasa hoy
en todo el repositorio con estos 10 archivos presentes.

Ningún test funcional (los que se ejecutan de verdad, ver defecto D más
abajo para la distinción entre tests vivos y muertos) lee ni ejecuta el
contenido de estos 10 archivos. Ninguna URL pública documentada, receta
de build, ni el pipeline de recuperación de `source-recovery/` dependen
de ellos.

### 1.6 Efecto y reversión exactos de retirarlos

**Efecto de eliminarlos** (no aplicado, descrito):
- Sin cambio funcional para ningún usuario real: no están en ninguna
  ruta de carga alcanzable hoy.
- Netlify pasaría a devolver `404` en las 10 rutas, igual que ya ocurre
  hoy con `/seleccion-neutral-patch.js` (defecto C) — comportamiento ya
  precedented, sin caracterizar como riesgo.
- El gate PM26 P02 (`verificar-secretos-e-identificadores.mjs`) fallaría
  si no se regenera `tools/seguridad/linea-base-aceptada.json` a la vez
  (4 de los 10 archivos tienen entrada allí).
- `source-recovery/README.md` seguiría mencionando `chunk-WNPC2SID.js`,
  `chunk-43ACCR2P.js`, `chunk-CZ7CSFO4.js` en un diagrama histórico —
  documentación sobre el pasado, sigue siendo cierta aunque los archivos
  ya no estén; no es un error introducido por la retirada.

**Reversión**: trivial — `git revert` del commit de borrado, o
`git checkout <commit-anterior> -- <archivo>`; el contenido permanece
para siempre en el historial de git independientemente de que se retire
del árbol de trabajo actual.

---

## 2. Defecto C — regla residual de `_headers`

### 2.1 Confirmación: `seleccion-neutral-patch.js` no existe ni tiene consumidores

`git ls-files | grep -i seleccion-neutral` → sin resultados. El archivo
no existe en el árbol actual. Búsqueda de referencias en todo el árbol
rastreado:

- `_headers:16` → la regla residual (ver 2.2).
- `docs/plan-maestro/PM17_DIAGNOSTICO_PARCHES.md` → documentación
  histórica sobre su retirada en PM17 P04, no sugiere que siga activo.
- `source-recovery/README.md`, `source-recovery/P03A_DETECCION_LIMITE.md`,
  `source-recovery/PM26_P03B_CIERRE.md` → todas confirman, como parte de
  su propio diagnóstico, que ya no existe ninguna referencia activa.
- **`edge-auth-patch.js:410`** → ver 2.3, hallazgo relacionado pero
  fuera del alcance literal del defecto C.

`fuente.js` (el único código realmente ejecutado en producción) no
contiene ninguna referencia a `seleccion-neutral-patch.js` — confirmado
de nuevo aquí, de forma independiente a PM26 P01.

### 2.2 La regla `_headers` no protege ninguna ruta válida

Contenido completo de `_headers` (21 líneas):

```
/
  Cache-Control: no-cache, no-store, must-revalidate

/index.html
  Cache-Control: no-cache, no-store, must-revalidate

/manifest.json
  Cache-Control: no-cache, must-revalidate

/fuente.js
  Cache-Control: no-cache, must-revalidate

/edge-auth-patch.js
  Cache-Control: no-cache, must-revalidate

/seleccion-neutral-patch.js
  Cache-Control: no-cache, must-revalidate

/sw.js
  Cache-Control: no-cache, must-revalidate
```

La regla de las líneas 15–17 (`/seleccion-neutral-patch.js` + su
`Cache-Control`) se aplica, según confirmó PM26 P01 contra la respuesta
HTTP real, a una ruta que devuelve `404` — la cabecera de caché de una
regla `_headers` de Netlify se adjunta a la respuesta exista o no el
archivo, así que la regla "funciona" en el sentido técnico de Netlify,
pero no protege ni cachea ningún contenido real: no hay ningún archivo
detrás.

### 2.3 Hallazgo relacionado (fuera del alcance de defecto C): `edge-auth-patch.js` standalone contiene código muerto

El archivo **standalone** `edge-auth-patch.js` (servido en la raíz,
distinto de la copia inlineada dentro de `fuente.js`) **todavía
contiene**, en las líneas 406–414, el bloque IIFE original que inyecta
`<script src="./seleccion-neutral-patch.js?v=2">`, y en las líneas
419–427 el que inyecta `<script src="./auth-ux-patch.js?v=1">` — el
mismo bloque que sí fue retirado de la copia **inlineada** dentro de
`fuente.js` en PM17 P04 (confirmado: `fuente.js` no contiene ninguna de
las dos cadenas). El archivo standalone nunca se actualizó en el mismo
commit.

**Verificado que esto no tiene efecto en producción hoy**: `index.html`
no tiene ningún `<script src="./edge-auth-patch.js">`; el único
`import "./edge-auth-patch.js"` real en todo el árbol está dentro de
`chunk-CZ7CSFO4.js`, que a su vez no está referenciado por nada
(defecto B, 1.3). El archivo standalone se sirve (`200`, verificado en
PM26 P01) porque Netlify sirve cualquier archivo del repositorio sin
build step, pero **nadie lo carga ni ejecuta** — no hay ningún intento
en vivo de pedir `seleccion-neutral-patch.js` desde el navegador de un
usuario real hoy.

Esto se registra como hallazgo nuevo, no como parte del defecto C
(que es específicamente sobre la regla de `_headers`) y no como algo a
corregir aquí — tocar `edge-auth-patch.js` no está autorizado en este
paquete.

### 2.4 Propuesta acotada (no aplicada)

Retirar únicamente las líneas 15–17 de `_headers` (la regla de
`/seleccion-neutral-patch.js` y su línea en blanco de separación),
dejando las otras 6 reglas exactamente como están. Ningún otro archivo
necesita cambios para este punto concreto.

---

## 3. Defecto D — `reset-pruebas-preview.js`

### 3.1 Separación: comportamiento universal vs. exclusivo de Deploy Preview

El archivo (119 líneas) tiene una frontera explícita y ya comentada por
un PM anterior:

- **Líneas 1–14 — universal (todos los entornos, incluida producción)**:
  carga `pm11-compra-mobile-layout-v1.js` mediante un guard de
  idempotencia (`window.__pm11CompraMobileLoaderV1`), **sin ningún guard
  de host**. El propio comentario (línea 4) dice explícitamente: "el
  parche visual de compras es parte de la app y debe cargarse también
  fuera de QA".
- **Línea 18 — la frontera**: `HOST_PREVIEW =
  /^(?:deploy-preview-\d+|[a-f0-9]{24})--chic-entremet-9107cf\.netlify\.app$/i`
- **Línea 19 — el guard**: `if (... || !HOST_PREVIEW.test(hostname)) return;`
  — todo lo que sigue (líneas 21–119) es exclusivo de Deploy Preview.
- **Líneas 21–119 — exclusivo QA/Deploy Preview**: constantes de
  URL/clave pública QA, activación de `window.__modoPruebasQA`,
  interceptor de `fetch`, y reinicio + siembra de `localStorage`.

### 3.2 Inventario completo

**Orden de carga**: `index.html:50`, `<script src="./reset-pruebas-preview.js">`
— sin `defer` ni `async`, **antes** del bloque de configuración de
almacenamiento (línea 52+) y muy antes de `<script type="module"
src="./fuente.js">` (línea 847). Es un script síncrono clásico: bloquea
el parseo del HTML hasta terminar. El script de layout PM11 que él mismo
inyecta se crea con `async = false` explícito (preserva orden relativo,
pero al ser insertado dinámicamente no bloquea el parseo del documento
igual que un `<script>` estático).

**Guardas de hostname**: una sola, `HOST_PREVIEW` (línea 18) — coincide
solo con `deploy-preview-<NNN>--` o un slug hexadecimal de 24 caracteres
de Netlify, seguido del dominio del sitio. El dominio de producción sin
prefijo no coincide (confirmado en PM26 P01 contra el hostname real).

**Efectos sobre `localStorage`** (todos dentro del bloque exclusivo QA):
- Lee un marcador de versión (`la_suite_reset_total_20260904_v6_qa`) y
  si ya está puesto, no hace nada más (idempotente, una sola vez por
  navegador).
- Si no está puesto: borra todas las claves que empiecen por
  `almacen:`/`almacen__`, y cualquier marcador antiguo de reset
  (`la_suite_reset_pruebas_`/`la_suite_reset_total_`).
- Siembra un bootstrap fijo: 1 empresa QA, 3 locales QA (uno inactivo),
  2 productos QA, movimientos vacíos — datos sintéticos, ningún dato
  real.
- Pone el marcador de versión nuevo y dos flags globales
  (`window.__resetPruebasEjecutado`, `window.__reinicioLocalSeguroVersion`).

**Redirecciones**: **ninguna** redirección de página
(`window.location.href` no se usa en ningún punto del archivo). Lo que
sí hace es **reescribir el destino de peticiones `fetch`** (ver
siguiente punto) — una forma distinta de "redirección" a nivel de red,
no de navegación.

**Llamadas de red**: sustituye `window.fetch` globalmente (con guard de
idempotencia `window.__qaFetchProduccionBloqueado`). Ante cualquier
`fetch` cuyo host sea el de producción: si la ruta es una Edge Function
conocida (tabla fija de 6 slugs), la reescribe hacia el proyecto QA y
deja pasar la petición; si es cualquier otra ruta hacia producción, la
**bloquea** devolviendo una promesa rechazada
(`QA_BLOCKED_PRODUCTION_SUPABASE`) sin ejecutar la petición real.

**Dependencias**: ninguna externa — es una IIFE autocontenida, sin
`import`, sin depender de que otro script se haya cargado antes.

### 3.3 Grafo real de consumidores (tests y workflows)

Búsqueda completa de `reset-pruebas-preview` en todo el árbol rastreado.
Se distinguen, verificando cada uno por ejecución real, los que están
**vivos** (parte del bucle de regresión que se ejecuta en esta rama) de
los que están **muertos** (en ramas antiguas, nunca disparados aquí):

**Vivos — deben seguir pasando después de cualquier cambio en P04b:**

| Archivo | Qué comprueba | Estado verificado ahora |
|---|---|---|
| `tests/pm12/p10-preview-smoke-contract.mjs` | Ejecuta el archivo real en una sandbox `vm` con `document`/`localStorage`/`fetch` simulados; comprueba bootstrap QA, bloqueo de producción, redirección de Edge Functions conocidas, y que producción no se altera. También verifica que todo script local citado en `index.html` existe en disco. | **PASA** (parte del bucle de regresión ya ejecutado repetidamente en PM26). |
| `tests/pm11-compra/p10-regresion-integral-contract.mjs` | Comprueba textualmente que la posición del loader del layout móvil PM11 (línea 10 del archivo) está **antes** que la línea del guard de host QA (línea 19) — exactamente la frontera universal/QA-only de la sección 3.1. | **PASA** (mismo bucle). |
| `tools/seguridad/verificar-secretos-e-identificadores.mjs` | `reset-pruebas-preview.js` está en `UBICACIONES_RUNTIME_LEGITIMAS` — la URL y clave pública QA del archivo están admitidas allí como configuración pública legítima. | **PASA** (gate PM26 P02, ya cerrado). |

**Muertos — en ramas antiguas nunca disparadas en `claude/pm26-preparacion-tecnica`, uno de ellos ya roto hoy por una evolución posterior del archivo que nunca se le repercutió:**

| Archivo / workflow | Rama de disparo | Estado real verificado ahora |
|---|---|---|
| `.github/scripts/auditar-reset-preview.mjs` (workflow `auditar-reset-preview-funcional.yml`) | `la-suite-identidad` | **Falla con excepción** (`ReferenceError: document is not defined`) al ejecutarlo hoy: su sandbox no define `document`, y el bloque universal PM11 (línea 9, añadido después de que este script se congelara) sí lo usa. Nunca se ha notado porque este workflow no dispara en ninguna rama activa del Plan Maestro. |
| `.github/scripts/pm02-validar-barrera.mjs` (workflow `pm02-cerrar-backend-qa.yml`) | `reinicio-local-seguro` | Comprueba `window.__modoPruebasLocal === true` en preview — el archivo actual pone `__modoPruebasLocal = false` (usa nube QA real, no modo local) desde que cambió el diseño; este script quedó obsoleto por esa evolución, congelado en una rama que no corre aquí. |
| `.github/scripts/validar-reinicio-local-seguro.mjs` (workflow `validar-reinicio-local-seguro.yml`) | `reinicio-local-seguro` | Mismo origen que el anterior, misma rama muerta. |
| `tests/pm26/P01_INVENTARIO_DIAGNOSTICO.md`, `tests/pm26/P02_REPARACION_GATES_SECRETOS.md`, `docs/plan-maestro/PM-02-aislamiento-qa-2026-09-04.md` | — | Documentación, sin comportamiento ejecutable. |

Ningún script muerto bloquea el gate de esta rama (confirmado: ninguno
de esos tres workflows tiene `claude/pm26-preparacion-tecnica` en su
lista de ramas). Se registran aquí porque **cualquier diseño de P04b
debe decidir conscientemente si los ignora (documentado) o los
actualiza** — no arreglarlos silenciosamente ni fingir que no existen.

### 3.4 Diseño mínimo para que producción no descargue la lógica QA (propuesta para P04b — NO aplicada)

Objetivo: que producción deje de descargar y parsear las ~100 líneas de
lógica exclusiva de Deploy Preview (interceptor de `fetch`, reinicio de
`localStorage`, clave pública QA), conservando exactamente:
(a) el layout móvil PM11 en todos los entornos, y
(b) el comportamiento actual de Deploy Preview, sin regresión.

Propuesta (a decidir/autorizar en P04b, no en P04a):

1. **Separar en dos archivos**: `pm11-compra-mobile-loader.js` (líneas
   1–14 actuales, universal, sin ningún dato QA) y
   `reset-pruebas-preview.js` (se queda solo con las líneas 16–119,
   exclusivo Deploy Preview) — el nombre del segundo archivo no cambia,
   así ningún consumidor que ya lo referencia por nombre (sección 3.3)
   necesita saber que existe un segundo archivo.
2. **`index.html`** cargaría el nuevo `pm11-compra-mobile-loader.js`
   igual de temprano y sin condición (universal), y
   `reset-pruebas-preview.js` seguiría cargándose igual que hoy — el
   propio `reset-pruebas-preview.js`, ya reducido a exclusivo-QA,
   seguiría teniendo su primera línea el guard de host (línea 19
   actual), así que en producción se descarga (una petición HTTP
   pequeña) pero termina inmediatamente sin ejecutar nada más — **no
   elimina la petición de red en sí**, solo el trabajo y los datos QA
   que hoy sí llegan al navegador de producción.
   - Alternativa más fuerte, a valorar en P04b: mover también la
     comprobación de host a `index.html` (antes del `<script src=
     "./reset-pruebas-preview.js">`) para que producción ni siquiera
     pida el archivo — cambia el "orden de carga" documentado en 3.2 y
     tendría que revisarse contra `tests/pm12/p10-preview-smoke-contract.mjs`
     (que hoy asume que el archivo se ejecuta siempre y decide él mismo
     si actúa).
3. **No copiar** la URL/clave pública QA a ningún archivo nuevo — se
   quedan exactamente donde están hoy, dentro del `reset-pruebas-preview.js`
   ya reducido.
4. Actualizar `tools/seguridad/verificar-secretos-e-identificadores.mjs`
   (`UBICACIONES_RUNTIME_LEGITIMAS`) solo si el archivo que contiene la
   URL/clave cambia de nombre o de ruta — con el diseño de arriba no
   cambia, así que no haría falta tocarlo.
5. Actualizar `tests/pm11-compra/p10-regresion-integral-contract.mjs`
   (su aserción sobre "el layout se carga antes del guard QA" pasaría a
   comprobar el nuevo archivo universal en vez de una posición dentro
   del mismo archivo) y `tests/pm12/p10-preview-smoke-contract.mjs` (si
   dejase de asumir que el bootstrap PM11 ocurre dentro de la misma
   ejecución de `reset-pruebas-preview.js`).
6. Los 3 scripts/workflows muertos de la sección 3.3 no se tocarían —
   siguen muertos, en ramas que no corren aquí; se documentaría la
   decisión de dejarlos así.

### 3.5 Restricción respetada en este documento

Este informe **no reproduce** la URL ni la clave pública QA de
`reset-pruebas-preview.js` — se refiere a ellas de forma descriptiva.
Ninguna prueba ni workflow nuevo de P04a las contiene tampoco (verificado
estructuralmente en el contrato de este mismo paquete, igual método que
en PM26 P02/P03a/P03b).

---

## 4. Riesgos y reversión (consolidado B + C + D)

- **B**: bajo. Sin consumidores activos verificados por búsqueda
  exhaustiva; reversión trivial vía git; único efecto colateral real es
  el ledger de seguridad, que P04b regeneraría con la herramienta
  existente, no a mano.
- **C**: mínimo/cosmético, ya calificado así en PM26 P01; cambio de una
  sola regla, reversión trivial.
- **D**: el de mayor superficie. Riesgo principal: romper
  `tests/pm12/p10-preview-smoke-contract.mjs` o
  `tests/pm11-compra/p10-regresion-integral-contract.mjs` (ambos vivos,
  ambos en el bucle de regresión de esta rama) si el split de P04b no
  preserva exactamente las garantías que ya comprueban. Mitigación: la
  propuesta de la sección 3.4 mantiene el archivo `reset-pruebas-preview.js`
  con el mismo nombre y el mismo contenido QA-only, minimizando el radio
  de cambio real. Reversión: trivial vía git, ningún cambio de esquema
  ni de backend.

## 5. Qué NO se ha tocado

`index.html`, `_headers`, `reset-pruebas-preview.js`, los 10 archivos
huérfanos del defecto B, `edge-auth-patch.js`, `fuente.js`, `main`,
Netlify, Supabase, QA, producción, TPV. No se ha aplicado ningún cambio
de P04b — queda pendiente de autorización específica, punto por punto o
en bloque, a decidir por el usuario.

```
PM26_P04A_ESTADO=INSPECCION_SOLO_LECTURA_COMPLETA
PM26_P04A_DEFECTO_B_10_ARCHIVOS_ANALIZADOS=SI
PM26_P04A_DEFECTO_B_REFERENCIAS_EXTERNAS_ENCONTRADAS=NO
PM26_P04A_DEFECTO_B_LEDGER_SEGURIDAD_DEPENDIENTE=SI_4_ARCHIVOS
PM26_P04A_DEFECTO_C_ARCHIVO_CONFIRMADO_AUSENTE=SI
PM26_P04A_DEFECTO_C_HALLAZGO_RELACIONADO_EDGE_AUTH_PATCH=SI_FUERA_DE_ALCANCE
PM26_P04A_DEFECTO_D_SEPARACION_UNIVERSAL_QA_IDENTIFICADA=SI
PM26_P04A_DEFECTO_D_TESTS_VIVOS_IDENTIFICADOS=2
PM26_P04A_DEFECTO_D_SCRIPTS_MUERTOS_IDENTIFICADOS=3
PM26_P04A_ARCHIVOS_ELIMINADOS=0
PM26_P04A_INDEX_HTML_TOCADO=NO
PM26_P04A_HEADERS_TOCADO=NO
PM26_P04A_RESET_PRUEBAS_PREVIEW_TOCADO=NO
PM26_P04A_IDENTIFICADORES_QA_COPIADOS_A_ARCHIVOS_NUEVOS=NO
PM26_P04A_P04B_APLICADO=NO
```

PM25 P02 continúa PARCIAL/BLOQUEADO. Defecto E y avisos F–H no se tratan
en este paquete.
