# PM26 P01 — Inventario y diagnóstico técnico

## Estado

**Inventario y diagnóstico. No se ha corregido nada todavía.** Este documento
registra lo encontrado en cada uno de los diez puntos exigidos, distinguiendo
hallazgos (observaciones, algunas sin acción necesaria) de defectos
reproducibles (problemas concretos, verificables, pendientes de decisión
antes de corregir). Ninguna corrección de este documento se ha aplicado.
Ningún archivo de producción, `main`, QA (más allá de lecturas de sus
asesores) o TPV fue modificado para producir este inventario.

## Precisiones registradas sobre la auditoría anterior (antes de PM26)

1. La ausencia de Functions/Edge Functions desplegadas **no demuestra que el
   build fuera incapaz de red o escritura** — solo que no se encontró
   evidencia de ello. En todo este documento se usa la fórmula "no se
   encontró evidencia de DDL/DML", nunca "era imposible".
2. La búsqueda de secretos de esta ronda cubre explícitamente **todo el
   JavaScript servido**, no solo el HTML (ver punto 3).
3. El script `/.netlify/scripts/hud?variant=public` fue **descargado e
   inspeccionado directamente** en esta ronda (no se repitió la afirmación
   anterior sin verificarla). Resultado en el punto 5.

## 1. Configuración real de build, comando, directorio publicado y scripts ejecutables

- No existe `netlify.toml` en el repositorio.
- No existe `package.json` en la raíz del repositorio (los únicos
  `package.json` están en `source-recovery/` y en subcarpetas de `tests/`,
  ninguno relacionado con el sitio publicado).
- Las herramientas de lectura de Netlify disponibles (`get-project`,
  `get-projects`, `get-deploy`, `get-deploy-for-site`) **no exponen un campo
  explícito de "build command" ni "publish directory"**. No pude leer ese
  valor directamente — lo dejo registrado como límite de herramienta, no
  como hecho confirmado.
- Evidencia indirecta observada en el despliegue actual: `framework:
  "unknown"`, `deploy_source: "api"`, `manual_deploy: false`, y el mensaje
  de resumen "All files already uploaded by a previous deploy with the same
  commits" sin ninguna fase de log de compilación distinta. Es consistente
  con una publicación estática directa del contenido del repositorio (sin
  comando de build), pero no es una confirmación directa de esa
  configuración.
- No existe ningún directorio `netlify/functions/` ni script de
  inicialización de servidor en el repositorio.

## 2. Nombres y ámbitos de variables de entorno (sin valores)

Consultado directamente vía la API de gestión de variables de entorno del
sitio (`manage-env-vars`, `getAllEnvVars: true`, sin lectura ni escritura de
ningún valor): **el sitio tiene 0 variables de entorno configuradas.**
No hay nombres que registrar. Esto es coherente con el punto 1: si no hay
variables de entorno, es más plausible que no haya una fase de build que
las necesite — pero, de nuevo, esto es una inferencia razonable, no una
confirmación directa del comando de build.

## 3. Secretos en todo el repositorio y en todos los recursos realmente servidos (incluidos JavaScript y sourcemaps)

**Recursos escaneados** (todos los que Netlify sirve desde la raíz del
sitio, no solo `index.html`): `fuente.js`, `index.html`, `manifest.json`,
`sw.js`, `edge-auth-patch.js`, `seleccion-neutral-patch.js` (ya no existe,
ver punto 7), `dashboard-premium-patch.js`, `dashboard-premium-v2.js`,
`pm11-compra-mobile-layout-v1.js`, `pm11-compra-mobile-p10-v1.js`,
`pm12-conteo-estados-v1.js`, `pm12-p09-historial-informes-movil-v1.js`,
`pm12-stock-atomico-v1.js`, `reset-pruebas-preview.js`,
`restablecer-contrasena.html`, y los 10 archivos compilados huérfanos del
punto 6 (`chunk-*.js`, `html2canvas-*.js`, `purify.es-*.js`,
`index.es-*.js`).

**Sourcemaps**: no hay ningún `.map` rastreado por git fuera de
`node_modules` locales (no publicados). No hay comentarios
`sourceMappingURL` en ningún archivo servido. Se comprobaron en vivo rutas
comunes de sourcemap (`fuente.js.map`, `index.html.map`,
`dashboard-premium-v2.js.map`, `edge-auth-patch.js.map`): las 4 devuelven
`404`. No se encontró ningún sourcemap publicado.

**Patrones de alto riesgo** (`service_role_key`, `SUPABASE_SERVICE_ROLE_KEY`,
`sb_secret_`, claves AWS `AKIA…`, bloques `-----BEGIN … PRIVATE KEY-----`,
JWT de 3 segmentos `eyJ…`): cada coincidencia fue inspeccionada en su
contexto real, no solo contada:

- Las apariciones de `service_role` y `sb_secret_` en `fuente.js` (23
  en total) son **código fuente y comentarios JSDoc del propio SDK
  `@supabase/supabase-js` empaquetado** (por ejemplo, la función interna
  `isNewApiKey`/`checkApiKeyFormat` que detecta el prefijo de una clave, y
  comentarios como "Never expose your `service_role` key in the browser").
  Ninguna es un valor de clave real.
- La coincidencia de `AKIA[0-9A-Z]{16}` en `html2canvas-5V7KZ5X4.js` es una
  subcadena casual dentro de una tabla binaria de compresión de fuentes en
  base64 (~66 KB de una sola línea) — falso positivo confirmado, no una
  clave de AWS.
- La coincidencia de `password` en el mismo archivo es la lógica propia de
  html2canvas para enmascarar visualmente los campos `<input
  type="password">` al dibujarlos en un `<canvas>` (`node.type ===
  PASSWORD ? "•".repeat(...)`) — no es una contraseña ni un secreto.
- Ninguna cadena con forma de JWT (`eyJ…´.…´.…`) aparece en ningún recurso
  servido, ni en la raíz del repositorio.
- No se encontró ningún `-----BEGIN … PRIVATE KEY-----` real en ningún
  archivo servido.

**Identificadores públicos legítimos encontrados** (no son secretos — se
documenta su naturaleza, no su valor, y no se reproduce ningún valor en
este informe):

- `index.html` contiene la URL del proyecto Supabase de **producción** y una
  clave con el prefijo de formato **`sb_publishable_…`** — la nueva
  clase de clave pública de Supabase, diseñada explícitamente para
  exponerse en el cliente (equivalente a la antigua "anon key"). Esperado y
  correcto para un cliente Supabase en el navegador.
- `reset-pruebas-preview.js` contiene, de forma análoga, la URL del proyecto
  **QA** y otra clave con el mismo prefijo `sb_publishable_…`. También es
  de clase pública, no secreta. Ver el defecto D del resumen: el problema
  no es que la clave sea pública, sino que este archivo se descarga sin
  condición en producción (ver punto 6).

**Conclusión de este punto**: no se encontró ningún secreto privado
(`service_role`, contraseña, clave privada, token de larga vida) embebido
en ningún recurso servido ni en el repositorio. Los únicos identificadores
públicos encontrados son claves de clase `publishable`, cuyo diseño asume
exposición en el cliente.

## 4. Dependencias, versiones fijadas y lockfiles

7 pares `package.json`/`package-lock.json` en el repositorio, ninguno en la
raíz:

| Ubicación | Dependencias | Fijación |
|---|---|---|
| `source-recovery/` | `@supabase/supabase-js`, `jspdf`, `jspdf-autotable`, `lucide-react`, `react`, `react-dom` (+ `esbuild` dev) | **Todas fijadas exactas** (sin `^`/`~`), coherente con su objetivo de reproducibilidad. |
| `tests/pm12/db/`, `tests/pm14/db/` | `pg` | Fijada exacta. |
| `tests/pm12/supabase-full/` | `pg`, `supabase` (dev) | Fijada exacta. |
| `tests/pm22/`, `tests/pm24/`, `tests/pm25/` | `playwright` | Declarada como rango (`^1.55.0`) en `package.json`, pero cada carpeta tiene su propio `package-lock.json` que fija la versión resuelta exacta. Los workflows de CI usan `npm ci`, que respeta el lockfile — el resultado de CI es reproducible aunque el rango del `package.json` por sí solo no lo garantizaría si alguien ejecutara `npm install` en vez de `npm ci`. |

No hay ninguna dependencia de la aplicación publicada (`fuente.js` y el
resto de archivos servidos) gestionada por un `package.json` — son
archivos ya compilados, committeados directamente.

## 5. Reproducibilidad del build y huellas de artefactos

`source-recovery/` (cerrado bajo PM-01, 2026-09-04) es la única base
recompilable existente. Se repitió hoy, en vivo, su procedimiento completo
desde una instalación limpia:

```
npm ci && npm run check && npm run build   → build 1
rm -rf dist && npm run build               → build 2
```

Resultado verificado ahora mismo: **build 1 y build 2 son idénticos byte a
byte** (mismo SHA-256, mismo tamaño, `node --check` correcto en ambos) —
la propiedad de reproducibilidad determinista sigue vigente hoy.

Sin embargo, dos hallazgos honestos sobre el alcance real de esa
reproducibilidad:

- El hash y el tamaño exactos documentados en `source-recovery/PM01_CIERRE.md`
  (2026-09-04) **ya no coinciden** con el contenido actual de
  `source-recovery/` (que el propio `README.md` de esa carpeta documenta
  como actualizado posteriormente para seguir al candidato del PR #4) ni,
  por supuesto, con el `fuente.js` actual. Es una desactualización de
  documentación esperada dado el propio historial del directorio, no un
  hallazgo de seguridad.
- Más importante: el build reproducible de `source-recovery/` (5.272.358
  bytes) **no coincide** con el `fuente.js` que sirve producción hoy
  (5.451.100 bytes) — 178.742 bytes de diferencia. Se confirmó por qué:
  marcadores de código añadidos en PM24/PM25 (`bloqueadoPorEnvioDuplicadoPM24`,
  `bloqueadoPorNubeActivaPM25`) están presentes en el `fuente.js` de la raíz
  y ausentes en el build recuperado, que quedó fijado en el estado previo a
  PM14. Ver defecto A.

## 6. Recursos compilados frente a sus fuentes

- `fuente.js` (5.451.100 bytes, servido en producción): sin fuente
  reproducible actual que lo cubra al 100 % (ver punto 5). `source-recovery/`
  es una aproximación parcial y desactualizada, no un pipeline vigente.
- **10 archivos JavaScript compilados, huérfanos, sin fuente ni receta de
  build en el repositorio**, añadidos todos en el primer commit del
  historial (`Add files via upload`, 2026-08-28), antes de cualquier
  paquete del Plan Maestro:
  `chunk-43ACCR2P.js`, `chunk-CZ7CSFO4.js`, `chunk-SULEHD65.js`,
  `chunk-WNPC2SID.js`, `html2canvas-5V7KZ5X4.js`,
  `html2canvas-5V7KZ5X4-UL42RKXS.js`, `purify.es-TSVPIOEK.js`,
  `purify.es-TSVPIOEK-6SSTY34W.js`, `index.es-SJCMKHSO.js`,
  `index.es-SJCMKHSO-5BY7EMAG.js` — 1.665.327 bytes en total.
  Confirmado que **ninguno está referenciado** por ningún `<script>` en
  `index.html` ni por ningún `import()` dinámico en `fuente.js`: las
  librerías `html2canvas` y `DOMPurify` (`purify.es`) que estos archivos
  contienen ya están **inlineadas de forma nativa dentro del propio
  `fuente.js`** (vía `require_html2canvas()`, un wrapper CommonJS del
  propio bundle). Se confirmó además que Netlify **sirve los 10 en vivo con
  HTTP 200** — ocupan ancho de banda y superficie pública sin cumplir
  ninguna función actual. Ver defecto B.
- `edge-auth-patch.js` en el repositorio es, según el diagnóstico ya
  documentado en `docs/plan-maestro/PM17_DIAGNOSTICO_PARCHES.md`, una copia
  histórica/fuente de un bloque que ahora corre inlineado de forma nativa
  dentro de `fuente.js` — no algo que el navegador descargue y ejecute por
  separado como módulo activo, aunque el archivo sí se sirve.

## 7. Las siete reglas de cabeceras y sus respuestas HTTP reales

Las 7 reglas de `_headers` fueron verificadas una a una contra la respuesta
HTTP real (`curl -D -`) del sitio publicado:

| Ruta | Regla `_headers` | Respuesta HTTP real |
|---|---|---|
| `/` | `no-cache, no-store, must-revalidate` | `200`, cabecera idéntica |
| `/index.html` | `no-cache, no-store, must-revalidate` | `200`, cabecera idéntica |
| `/manifest.json` | `no-cache, must-revalidate` | `200`, cabecera idéntica |
| `/fuente.js` | `no-cache, must-revalidate` | `200`, cabecera idéntica |
| `/edge-auth-patch.js` | `no-cache, must-revalidate` | `200`, cabecera idéntica |
| `/seleccion-neutral-patch.js` | `no-cache, must-revalidate` | **`404`** (cabecera de la regla igualmente aplicada al 404) |
| `/sw.js` | `no-cache, must-revalidate` | `200`, cabecera idéntica |

El `404` de `/seleccion-neutral-patch.js` **no es un defecto nuevo**: se
confirmó por historial de git que el archivo y su bloque de inyección en
tiempo de ejecución (`fuente.js` líneas ~43871-43888) fueron retirados
juntos, deliberadamente, en PM17 P04 (commit `71c7815`, release `a44f1c7`,
gate remoto verde ya obtenido entonces). `fuente.js` actual ya no contiene
ninguna referencia a `seleccion-neutral-patch.js`. El único resto es que
`_headers` sigue listando una regla para un archivo que ya no existe — sin
efecto funcional ni de seguridad. Ver defecto C (cosmético).

Los demás archivos servidos (los 10 huérfanos del punto 6,
`dashboard-premium-patch.js`, `dashboard-premium-v2.js`, los `pm11-`/`pm12-`
`*.js`, iconos, `manifest.json` sub-recursos) **no tienen regla explícita en
`_headers`** y quedan bajo el comportamiento de caché por defecto de la
plataforma Netlify para archivos estáticos — no caracterizado de forma
independiente en este punto; queda fuera del alcance literal de "las siete
reglas", se registra como límite del inventario, no como hallazgo.

## 8. Service worker, manifest, actualización PWA y caché

- `sw.js` no registra ningún listener `install`, `activate` ni `fetch` — solo
  `push` y `notificationclick`. No hay lógica de versión, no hay
  `skipWaiting()`/`clients.claim()`, no hay `caches.open()` en ningún punto.
  Confirmado leyendo el archivo completo: no intercepta ninguna petición de
  red.
- Consecuencia directa: el service worker **no influye en absoluto** en la
  frescura del contenido. Toda petición de red pasa sin intervención del SW,
  y la frescura queda gobernada enteramente por las cabeceras
  `Cache-Control` de `_headers` (todas `no-cache`, verificadas en vivo en el
  punto 7) — cada carga revalida contra el servidor. No hay riesgo de
  "versión pegada" por caché del service worker.
- `manifest.json`: identidad correcta ("L&A Suite" / "Gestión integral para
  tu negocio"), modo `standalone`, iconos presentes y accesibles
  (`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`,
  `apple-touch-icon.png`), sin anomalías.
- Hallazgo relacionado con el punto 6 (defecto D): `reset-pruebas-preview.js`
  se carga sin condición desde `index.html` (línea 50, sin `defer`, sin
  guarda de entorno en el propio `<script>`) en **todas** las cargas,
  incluida producción. Casi toda su lógica (bloqueo de peticiones directas
  al Supabase productivo, redirección de Edge Functions a QA, reinicio de
  `localStorage` con datos ficticios, y la clave pública QA del punto 3)
  está protegida internamente por una expresión regular que solo coincide
  con subdominios `deploy-preview-NNN--` o de 24 caracteres hexadecimales
  de Netlify — **se confirmó que el dominio de producción
  (`chic-entremet-9107cf.netlify.app`, sin prefijo) no coincide con esa
  expresión**, así que esa lógica no se ejecuta en producción. Lo que sí
  ocurre siempre, incluso en producción, es la primera parte del archivo
  (carga de `pm11-compra-mobile-layout-v1.js`), que es intencional según su
  propio comentario. El resto del archivo es código muerto descargado por
  cada visitante de producción sin necesidad.

## 9. Asesores de seguridad y rendimiento en QA/test (sin aplicar cambios)

Ejecutado `get_advisors` **solo contra el proyecto QA**
(`L&A Suite QA`) — nunca contra producción ni TPV, confirmando antes la
identidad de los tres proyectos vía `list_projects`. Ningún cambio
aplicado.

**Seguridad:**
- `rls_enabled_no_policy` (INFO, 3 tablas): `operaciones_procesadas`,
  `prefiltro_limites`, `prefiltros_candidatos` tienen RLS activado pero
  **ninguna política** — el efecto práctico es que esas tablas son
  inalcanzables vía la API REST para cualquier rol (RLS sin políticas deniega
  todo por defecto), no una sobre-exposición. Queda para revisión si es
  intencional o un olvido.
- `authenticated_security_definer_function_executable` (WARN, 39 funciones):
  el linter marca todas las RPC `SECURITY DEFINER` invocables por
  `authenticated` — que es, por diseño de este proyecto, el motor
  autoritativo de escritura mandatado (`registrar_*`/`revertir_*`, etc.). El
  linter no puede distinguir intención; se registra tal cual, sin
  calificarlo aquí como defecto.
- `auth_leaked_password_protection` (WARN): la verificación de contraseñas
  filtradas (HaveIBeenPwned) está desactivada en Auth de QA.

**Rendimiento:**
- `unindexed_foreign_keys` (INFO, 4): `auditoria_registro`,
  `movimientos_stock`, `pagos_encargo`, `suscripciones_push` tienen una FK
  sin índice de cobertura.
- `auth_rls_initplan` (WARN, 4 políticas): en `perfiles` (x2),
  `suscripciones_push`, `membresias_usuario` — políticas RLS que
  re-evalúan `auth.<función>()` por fila en vez de `(select
  auth.<función>())`.
- `unused_index` (INFO, 8): índices en `arqueos_caja`,
  `arqueos_caja_anulaciones`, `devoluciones_venta`,
  `devoluciones_proveedor`, `auditoria_registro`, `albaranes_empresa`,
  `gastos_empresa`, `pagos_encargo` sin uso registrado.

## 10. Configuración que vincula `main` con producción

Reconfirmado (ya establecido en la auditoría previa a PM26, sigue vigente):
el sitio `chic-entremet-9107cf` tiene desplegado continuo activo con `main`
como rama de contexto `production` — cada push/merge a `main` dispara
automáticamente una publicación, sin paso de aprobación manual intermedio.
0 variables de entorno configuradas (punto 2). Ningún archivo
`netlify.toml` que module esa regla. Esta es la causa raíz del defecto E.

## Script `/.netlify/scripts/hud?variant=public` — verificado directamente

A diferencia de la ronda anterior (que describió su comportamiento citando
solo documentación pública de Netlify), esta vez se **descargó el script
real servido en producción** (33.635 bytes) y se inspeccionó su contenido:

- No contiene ninguna llamada `fetch(`, `XMLHttpRequest`, `new WebSocket` ni
  `sendBeacon` en su propio código.
- No escribe `document.cookie`.
- Usa `localStorage` exactamente 3 veces, para una única clave que recuerda
  si el usuario descartó el badge visualmente — ningún dato del proyecto.
- Se monta en un `<iframe>` construido con `srcdoc` (contenido inline
  generado por el propio script), no con un `src` remoto — no dispara una
  petición de documento adicional al montarse.
- Referencia `app.netlify.com`/`app.netlifystg.com` únicamente como lista de
  hosts permitidos para el comportamiento de un enlace al hacer clic, no
  como origen de una carga.

Con esta inspección directa (no solo documentación de terceros): no se
encontró en el propio script ninguna llamada de red, cookie o telemetría
activa. Esto no descarta que el navegador realice peticiones adicionales al
renderizar el `<iframe>` en un contexto real (no se capturó una traza de
red en un navegador en vivo) — se deja registrado como el límite exacto de
esta verificación.

## Resumen de defectos reproducibles (sin corregir)

| Ref | Defecto | Severidad |
|---|---|---|
| A | No existe pipeline de build reproducible que coincida con el `fuente.js` actualmente servido en producción; `source-recovery/` quedó fijado antes de PM14 (178.742 bytes de diferencia). | Media — bloquea auditoría de build, no es una brecha de seguridad activa. |
| B | 10 archivos JS compilados, huérfanos y sin fuente en el repo (~1,66 MB), servidos públicamente sin estar referenciados por ningún flujo actual. | Baja — superficie pública innecesaria, sin secretos dentro. |
| C | `_headers` conserva una regla para `seleccion-neutral-patch.js`, retirado deliberadamente en PM17 P04. | Cosmética. |
| D | `reset-pruebas-preview.js` se descarga sin condición en producción; casi toda su lógica (y una clave pública QA) es código muerto allí. | Baja — sin secreto expuesto, pero innecesario en el bundle de producción. |
| E | Publicación a producción acoplada automáticamente a cada push/merge a `main`, sin aprobación manual intermedia. | Ya registrada y ya mitigada operativamente (congelación de `main` decidida por el usuario); pendiente de decisión sobre la propuesta técnica siguiente. |
| F | 3 tablas QA con RLS activado y sin ninguna política. | Por revisar — a confirmar si es intencional. |
| G | Protección de contraseñas filtradas desactivada en Auth de QA. | Baja en QA; a valorar si debe replicarse en producción cuando corresponda. |
| H | 4 FKs sin índice, 4 políticas RLS con re-evaluación por fila, 8 índices sin uso, en QA. | Rendimiento, no seguridad. |
| I | **Hallazgo incidental, fuera de los diez puntos pedidos pero descubierto al construir el propio gate de este paquete**: el paso "Sin secretos" de los workflows de CI ya cerrados (`pm24-p01-*`, `pm24-p02-*`, `pm25-p01-*`, `pm25-p02-*`) usa el patrón `! grep -Eqi '...'; echo PASS`. Bajo `set -e`, bash **no** aplica la salida por error a un comando negado con `!` — el step nunca abortaría aunque `grep` encontrara una coincidencia real; siempre imprime `PASS`. Verificado de forma aislada y reproducible (ver script de esta ronda). El workflow de este mismo punto (PM26 P01) usa en su lugar `if grep …; then exit 1; fi`, que sí aborta correctamente. Los gates ya cerrados de PM24/PM25 quedaron con esta comprobación concreta sin efecto real durante todo ese tiempo — el resto de sus pasos (contrato, regresión) sí eran gates reales y no se ven afectados. | Media — el gate específico de "sin secretos" de 4 workflows ya cerrados nunca abortó realmente, aunque no se encontró ningún secreto real en ninguno de ellos en las rondas de esta sesión. |

## Propuesta exacta para separar integración y publicación (NO aplicada)

**Mecanismo propuesto:**
1. En la configuración del sitio Netlify, cambiar la rama de contexto
   `production` de `main` a una rama dedicada nueva, p. ej. `release`.
2. `main` sigue siendo la única rama de integración (como ya exige el
   usuario) pero deja de disparar publicaciones por sí sola.
3. Publicar a producción pasa a requerir un paso explícito y separado:
   fusionar (fast-forward o merge) el commit ya validado de `main` hacia
   `release`, cada vez con autorización específica del usuario para esa
   publicación concreta — no para la fusión a `main`.
4. Alternativa/complemento: mantener `main → production` pero añadir
   `manual_deploy`/aprobación requerida en la configuración del sitio, si
   Netlify lo permite en el plan actual — a confirmar antes de elegir esta
   variante frente a la de rama dedicada.

**Riesgos de aplicarlo:**
- Un despliegue manual mal ejecutado (rama equivocada, commit equivocado)
  sigue siendo posible — el mecanismo separa la decisión, no la elimina
  como fuente de error humano.
- Si se olvida promover `release`, producción queda desactualizada respecto
  a `main` de forma silenciosa si nadie lo vigila — necesitaría un aviso o
  comprobación periódica.
- Cambiar la rama de contexto de producción en Netlify es en sí mismo un
  cambio de configuración de despliegue — requiere su propia autorización
  explícita y una ventana de verificación inmediatamente después (confirmar
  que el primer despliegue en `release` coincide con el commit esperado).

**Reversión:**
- Trivial: devolver la rama de contexto `production` a `main` en la
  configuración del sitio. No hay migración de datos ni cambio de esquema
  involucrado — es una única configuración de enrutamiento de despliegue.

Esta propuesta **no se ha aplicado**. Ningún archivo de configuración de
Netlify fue modificado para producir este documento.

## Qué NO se hizo (por precisión)

- No se fusionó ni se hizo push a `main`.
- No se cambió ninguna configuración de Netlify.
- No se creó ningún Deploy Preview ni despliegue productivo.
- No se hizo ningún rollback.
- No se ejecutó ninguna migración ni escritura en QA o producción — los
  asesores del punto 9 son lectura pura.
- No se tocó TPV.
- No se corrigió ninguno de los defectos A-H listados arriba.
- No se actualizó ninguna dependencia para silenciar avisos.

```
PM26_P01_ESTADO=INVENTARIO_COMPLETO_SIN_CORRECCIONES
PM26_P01_CORRECCIONES_APLICADAS=NO
PM26_P01_MAIN_TOCADO=NO
PM26_P01_NETLIFY_MODIFICADO=NO
PM26_P01_QA_ESCRITURA=NO
PM26_P01_PRODUCCION_ESCRITURA=NO
PM26_P01_TPV_TOCADO=NO
```

PM25 P02 sigue **PARCIAL/BLOQUEADO** (no probado, no aprobado, no
descartado, no cerrado) y se arrastra a la puerta final, como ya está
registrado en `tests/pm25/ESTADO_PM25.md`.

## Addenda tras PM26 P02 — criterio de "sin secretos" reabierto y reparado

El usuario detectó, tras revisar este documento, un defecto adicional (J):
los gates de CI de PM24/PM25 (y el de este mismo P01) comprobaban "sin
secretos" con un `grep` que escribía los project refs reales de forma
literal dentro del propio patrón de búsqueda — publicándolos en el propio
mecanismo pensado para impedir su publicación. El paso "Sin valores reales
de secreto" de este documento (más arriba, en la sección de secretos) fue,
sin saberlo entonces, un ejemplo más del mismo defecto.

**Los gates de PM24/PM25/PM26 P01 eran, en ese punto concreto, incompletos:**
comprobaban secretos reales correctamente, pero no comprobaban la
duplicación de identificadores internos que ellos mismos introducían.
PM26 P02 (`tests/pm26/P02_REPARACION_GATES_SECRETOS.md`) corrige los cinco
workflows afectados con un escáner centralizado, reabre y repara
específicamente ese criterio, e inventaría/clasifica el resto del
repositorio sin corregirlo (fuera del alcance autorizado para P02).

**Esta reparación NO cambia ni invalida la evidencia funcional obtenida en
los demás pasos de este documento** (los diez puntos del inventario, los
defectos A-H, la verificación en vivo del script HUD, la reproducibilidad
del build): esa evidencia se obtuvo por inspección directa del código y de
las herramientas Netlify/Supabase, no depende del mecanismo de "sin
secretos" de ningún workflow. Los defectos A-H permanecen exactamente
donde estaban, pendientes de corrección.
