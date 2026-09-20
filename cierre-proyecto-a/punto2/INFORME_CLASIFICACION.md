# Punto 2 — Informe de clasificación (deuda de pruebas fallidas)

Rama: `claude/punto2-134-pruebas`, commit final **`3f8e1d0300cb16b99634c2ff04d3135ee37e29d3`**,
creada desde `release` vigente (`6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d`, el
mismo commit al que se promovió PM33). `release`, `main`, PR #38, QA, PROD y
Netlify **no se han tocado** en todo este trabajo.

**Estado: CERRADO. Puerta de CI en verde real: 133/133 contratos activos.**
[`run 35495409478`](https://github.com/Plopezm1990/Almacen/actions/runs/35495409478) — SUCCESS.

## 0. Corrección tras una auditoría independiente

Una primera entrega de este punto (commit `0234a2f`) fue revisada por una
auditoría independiente, que encontró dos problemas reales y confirmados:

1. **No era reproducible.** `ejecutar_bateria_no_db.sh` tenía `cd
   /home/user/Almacen` hardcodeado, dependía de un `mjs_list.txt` generado
   en `/tmp` (nunca versionado) y no verificaba el inventario antes de
   ejecutar. No podía correr desde otro clon.
2. **`preparar_postgres_local.sh` no podía haber producido la evidencia
   que decía tener.** Usaba `set -e`, que para el script entero en el
   primer fallo — y uno de los 10 archivos que ejecuta
   (`tests/pm33/db/p01-aislamiento-multiempresa-contract.mjs`) **falla a
   propósito** (es un registro histórico retirado). Con `set -e`, el
   script nunca pudo haber llegado a ejecutar los archivos posteriores a
   P01 en la misma corrida.

Además, la clasificación "contrato histórico obsoleto" (10 archivos) se
aceptó como diagnóstico correcto, pero **no se había corregido ningún
archivo real** — la entrega describía las causas sin dejar los tests en
verde, así que la batería seguía teniendo 12 archivos en rojo pese a que
el informe afirmaba "0 defectos".

Este documento y la matriz que lo acompaña reflejan el estado **después**
de corregir los dos problemas de reproducibilidad, actualizar los 9
contratos activos obsoletos y completar los 2 arneses de prueba
incompletos — todo verificado con una ejecución real en CI sobre el commit
final, no solo localmente.

## 1. El informe original de 134/116/18 no se encontró

Antes de construir nada, se buscó exhaustivamente el informe
`Proyecto_A_Pendientes_Verificados_2026-09-19` (corte ~11:24 UTC), citado
por nombre como fuente de "134 scripts / 116 PASS / 18 FAIL" en
`cierre-proyecto-a/SEGUIMIENTO_18_PUNTOS.md` desde su primer commit
(`517f443`, 19/09/2026). Resultado de la búsqueda:

- `git log --all -S` del nombre del informe y de los formatos que este
  propio repositorio usa para cifras de resultados sobre las 104 ramas
  remotas y todo el historial: **cero coincidencias**, salvo la cita
  textual que lo menciona sin adjuntarlo.
- El archivo `Proyecto_A_Pendientes_Verificados_2026-09-19` no existe en
  ningún árbol de ninguna rama.
- PR #38 y una búsqueda de issues del repositorio: sin coincidencias.
- Los workflows de GitHub Actions más parecidos a "ejecutar la batería
  completa y contar resultados" usan todos `set -euo pipefail` y **paran
  en el primer fallo** — ninguno puede, por diseño, generar un recuento
  tipo "116 PASS / 18 FAIL" en una misma ejecución.

**Conclusión, aceptada por el propietario**: el informe fue, con toda
probabilidad, una evaluación externa nunca versionada en este
repositorio. Por instrucción explícita, este punto se completa con **un
inventario nuevo y honesto**, sin pretender reproducir ni heredar el
número del informe perdido.

## 2. Criterio del inventario nuevo, ahora con manifiesto versionado

Unidad de prueba: cada archivo `.mjs` bajo `tests/` en el commit final.
Total: **142**, fijado en `cierre-proyecto-a/punto2/manifiesto_clasificacion.json`
— la fuente única de verdad que tanto el runner local como la puerta de CI
revalidan contra el árbol real antes de ejecutar nada:

- **133 contratos activos** — deben pasar siempre, sin excepción.
- **1 histórico, fallo esperado** —
  `tests/pm33/db/p01-aislamiento-multiempresa-contract.mjs`, marcado
  explícitamente `HISTORICAL_EXPECTED_FAIL` en el manifiesto. El propio
  repositorio documenta, en la cabecera de
  `tests/pm33/db/contrato-vigente-contract.mjs`, que este archivo "se
  conserva SIN modificar como registro histórico... no se toca ni se
  reutiliza como gate", porque P03 cambió deliberadamente el
  comportamiento que este archivo todavía comprueba (T14c). El contrato
  vigente real, `contrato-vigente-contract.mjs`, pasa 39/39. Ni el runner
  ni la puerta de CI lo cuentan jamás como activo; si algún día pasara,
  la puerta de CI fallaría explícitamente (`gate-final` revalida que su
  `classification` siga siendo `historical_expected_fail`).
- **3 utilidades**, no casos de prueba: `tests/pm12/p09-aplicar-index.mjs`
  (integra un script en `index.html`, idempotente),
  `tests/pm12/supabase-full/prepare-fixture.mjs` y
  `prepare-production-baseline.mjs` (preparan fixtures exclusivamente
  para el job `pm12-p08-supabase-full` de CI). Ninguna afirma PASS/FAIL.
- **5 diagnósticos** de solo lectura (`tests/pm13/p0{1,2,3,4,7}-diagnostico-*.mjs`):
  inspeccionan `fuente.js` por patrones de texto y escriben evidencia
  JSON/TXT; no contienen ninguna aserción PASS/FAIL. Al ejecutarlos se
  confirmó que la evidencia ya commiteada estaba desactualizada respecto
  al `fuente.js` actual — deuda anotada por separado (sección 6), no
  corregida en esta rama por quedar fuera de su alcance.

Que el número de contratos con semántica PASS/FAIL activa más el
histórico (134) coincida con la cifra citada en el informe perdido es una
coincidencia observada, **no una confirmación** de correspondencia: la
metodología es completamente distinta.

## 3. Resultado real, verificado en CI sobre el commit final

[`run 35495409478`](https://github.com/Plopezm1990/Almacen/actions/runs/35495409478)
— **SUCCESS**, los 4 jobs en verde. Salida real y completa del job
`gate-final` (que solo se ejecuta, y solo puede pasar, si los tres jobs
anteriores pasaron Y el manifiesto se revalida contra el árbol real):

```
ACTIVE_PASS=133
ACTIVE_FAIL=0
HISTORICAL_EXPECTED_FAIL=1
UTILITIES=3
DIAGNOSTICS=5
TOTAL_INVENTORY=142
PUNTO2_GATE_COMPLETA=PASS
```

Desglose por entorno, los tres reales (nunca simulados a nivel de
resultado):

- **121 contratos activos, Node puro** (incluye el build real de Netlify
  como prerrequisito de `tests/netlify-publish-boundary.mjs`) — job
  `node-y-postgres`, paso "121 contratos activos Node": **127/127**
  ejecutados sin fallo (121 activos + 3 utilidades + 5 diagnósticos +... 
  ver nota de conteo abajo), Node **v22.23.2**.
- **9 contratos activos + 1 histórico esperado, PostgreSQL real** — mismo
  job, paso "9 contratos activos Postgres + 1 histórico esperado en rojo
  (P01)": **9/9 activos PASS**, P01 falla exactamente donde se espera,
  contra un servicio PostgreSQL **16.15** real de GitHub Actions.
- **3 contratos, Auth + PostgREST + PostgreSQL 17 reales** (Docker, mismo
  patrón ya validado en el Punto 1 para PM33) — jobs
  `pm12-p08-supabase-full` y `pm33-p05-supabase-full`: **3/3 PASS**
  (`P08_SUPABASE_AUTH_POSTGREST_CONCURRENT_REPLAY=PASS`,
  `P08_SUPABASE_RLS_SCOPE_AND_DIRECT_WRITE_DENIED=PASS`,
  `P08_SUPABASE_AUTH_POSTGREST_CONCURRENT_CANCEL=PASS`,
  `PM12_PROD_BASELINE_MINIMAL=PASS` + 3 marcas más, `TOTAL PASS=15 FAIL=0`
  en PM33 P05). Supabase Storage confirmado en el log: **v1.72.1**.

Nota de conteo: el paso "121 contratos activos Node" del job ejecuta en
realidad 127 archivos (121 activos + 3 utilidades + 5 diagnósticos - 2
utilidades exclusivas de CI que no se ejecutan de forma aislada = 127),
porque utilidades y diagnósticos comparten el mismo entorno Node y el
script los ejecuta a todos para dejar registrado su comportamiento real,
aunque solo los 121 activos cuentan para `ACTIVE_PASS`. El desglose
archivo por archivo está en `MATRIZ_134_PRUEBAS.md`.

Evidencia bruta reproducible, descargada del propio run de CI (no
regenerada a mano): `cierre-proyecto-a/punto2/evidencia/resultado_bruto_no_db.tsv`
y `resultado_bruto_postgres.tsv`.

## 4. Los 12 archivos que estaban en rojo: causa raíz encontrada Y corregida

A diferencia de la entrega anterior (que solo diagnosticaba sin corregir),
los 9 contratos activos con aserciones obsoletas se **reescribieron** para
comprobar el comportamiento vigente de forma estructural (nombres de
variable agnósticos, prefijos de RPC tolerantes a sufijo de versión,
texto de usuario tolerante a reescritura, componentes de UI localizados
por nombre real) en vez de literales frágiles del bundle, y los 2 arneses
de prueba incompletos se completaron con las APIs de navegador que les
faltaban. Ninguno de los 12 resultó ser un defecto de producto:

1. **`tests/g1/p08-la004-gate-contract.mjs`** — exigía el literal
   `manifest.baseArtifactSha256`; el manifiesto real (formato v2) usa
   `requireString(manifest, 'baseArtifactSha256')`, con validación de
   tipo añadida. Corregido: el test ahora extrae el campo por cualquiera
   de las dos formas y verifica que la variable resultante participe
   después en una comparación estricta (`!==`/`===`) contra un hash
   calculado — valida el comportamiento real, no el literal.
2. **`tests/pm05/frontend-contract.mjs`** — 3 comprobaciones exigían
   variables de iteración literales (`p2`, `c2`) que el empaquetador
   renombró (`p22`, `x3`) en una ronda posterior; una además exigía
   `...data` donde el código real interpone `...validacion.datos` (una
   capa de validación añadida, `empresaId` se sigue fijando igual).
   Corregido con regexes agnósticas al nombre de variable (backreferencia
   `(\w+)...\1`) y al origen del spread.
3. **`tests/pm07/frontend-contract.mjs`** — 7 comprobaciones: 2 RPC
   renombradas con sufijo de versión (`registrar_venta_stock_carrito` →
   `..._pm09`, y su reverso) y 5 por el mismo renombrado de variables del
   empaquetador (`p2`→`p22`, `l2`→`l22`), incluida una comprobación
   NEGATIVA (`alertas_sin_precedencia_ambigua`) que había quedado
   vacíamente en verde por el mismo motivo — corregida para seguir
   detectando el patrón real bajo el nombre de variable actual.
4. **`tests/pm08/frontend-contract.mjs`** — 2 comprobaciones: mismo
   renombrado de variable (`a2`→`a22`) y el mismo texto de usuario
   reescrito que en el punto 5.
5. **`tests/pm09/p17-robustness-contract.mjs`** — el texto "Hay una
   operación anterior pendiente en este local" se reescribió a "Hay una
   operación sin confirmar..."; misma protección. Corregido para aceptar
   ambos textos.
6. **`tests/pm15/p02-mej01-contexto-modales-contract.mjs`** — PM29
   sustituyó el JSX inline de "Desactivar local" por el componente
   compartido `ConfirmarConContrasenaPM29` (añade confirmación con
   contraseña). Corregido: localiza la acción por `titulo: "Desactivar
   local"` y verifica que su `descripcion` siga mostrando "Empresa: "
   respaldado por una consulta real (`empresaDeLocal(...)`), no un texto
   fijo.
7. **`tests/pm15/p04-nr08-proteccion-borrador-navegacion-contract.mjs`**
   — el rediseño visual (PM28) sustituyó `TopBarC`/`BottomNavC` por
   `BarraSuperiorMovil`+`SidebarGrupos`/`NavInferior` y retiró el
   conmutador de diseño A/B. Corregido: verifica, por nombre de
   componente real, que `SidebarGrupos` y `NavInferior` reciban
   `setTab: cambiarTabPM15` (el setTab protegido) — confirmado presente
   en ambos, más `BusquedaGlobal` y el dashboard (sin cambios).
8. **`tests/pm17/p03-wiring-login-logout-contract.mjs`** — un enlace
   `<a href="...">` real sustituyó a un manejador de clic imperativo
   (`window.location.href = ...`); mismo destino. Corregido para aceptar
   ambas técnicas de navegación.
9. **`tests/pm20/p05-buscador-etiquetas-auditoria-contract.mjs`** — se
   añadió la prop `empresa` delante de las 3 originales, que siguen
   intactas. Corregido para tolerar props adicionales delante.
10. **`tests/pm12/p10-preview-smoke-contract.mjs`** y **`tests/pm26/defecto-l-context-hotfix.test.mjs`**
    — su `window` simulado no definía `setInterval` ni `sessionStorage`,
    APIs que una barrera de arranque añadida después (post-reset,
    hotfix legítimo) empezó a usar incluso en la ruta de producción. Un
    navegador real siempre las tiene. Completados ambos mocks; en PM26
    además hizo falta `window.__instalacionSyncPermitida = true`
    (la bandera que en un navegador real pone el script COMPAÑERO
    `edge-auth-patch.js` una vez validada la sincronización — ese test
    no lo carga porque no es lo que prueba, así que se simula el estado
    que dejaría tras validar correctamente).
11. **`tests/netlify-publish-boundary.mjs`** — fallaba con `ENOENT
    .netlify-dist`, un prerrequisito de build ausente
    (`node .github/scripts/build-netlify-publish.mjs`, el propio build
    command de `netlify.toml`). El runner ahora lo ejecuta siempre, al
    final (tras estabilizar el árbol), reconstruyendo `.netlify-dist`
    desde cero cada vez.
12. **`tests/pm33/db/p01-aislamiento-multiempresa-contract.mjs`** — no se
    "corrige": es un registro histórico retirado a propósito (ver
    sección 2). Se ejecuta siempre, marcado `HISTORICAL_EXPECTED_FAIL`,
    para dejar constancia real de que sigue fallando exactamente donde
    se espera — nunca contado como activo.

## 5. Hallazgo incidental: `cierre-proyecto-a/` y el build de Netlify

Al depurar el prerrequisito de `netlify-publish-boundary.mjs` se
encontró que `.github/scripts/build-netlify-publish.mjs` no excluye
`cierre-proyecto-a/` de la copia publicable — al vivir esta carpeta de
documentación ahora en una rama descendiente de `release` (a diferencia
de la rama de seguimiento general, que nunca toca `release`), si esta
rama llegara a promocionarse tal cual, `cierre-proyecto-a/` se
publicaría en el sitio de producción. No se ha modificado
`build-netlify-publish.mjs` (fuera del alcance de este punto, y toca la
ruta de publicación de Netlify, que la instrucción de esta ronda pidió
no tocar) — se deja anotado aquí y cruzado con el Punto 6
("certificar ruta de publicación/recuperación Netlify"), que es donde
corresponde decidir si excluirla.

## 6. Recorridos PM28–PM33 verificados especialmente

- **Fichaje**: `tests/pm13/p03-fichajes-contract.mjs`,
  `p03-backend-fichajes-contract.mjs` — **PASS**. No se encontró ningún
  identificador "VIS-17" en el repositorio (ni en el árbol actual ni en
  el historial completo de las 104 ramas) — este repo identifica sus
  casos como `LA-0xx`; si "VIS-17" vive en un catálogo distinto,
  conviene que el propietario confirme dónde.
- **Contexto empresa/local**: PM33 (39/39 Postgres + 15/15 Auth/PostgREST
  real), PM29 (`p01`/`p02`/`p03` — PASS), PM32 (selector empresa/local —
  PASS), PM15 (2 casos, ambos corregidos y en verde, ver sección 4).
- **Persistencia**: `tests/pm10/p10-autoridad-persistencia-contract.mjs`
  — PASS.
- **Red**: `tests/pm09/p17-robustness-contract.mjs` y la lógica de
  venta/traspaso offline de `tests/pm07/frontend-contract.mjs` — ambos
  corregidos y en verde.
- **Concurrencia**: `tests/g1/p07-concurrencia-replay-contract.mjs`,
  `tests/pm08/replay-scope-contract.mjs`,
  `tests/pm11-compra/p08-fallos-replay-concurrencia-contract.mjs`,
  `tests/pm12/p08-fallos-replay-concurrencia-contract.mjs`,
  `tests/pm12/db/p08-postgres-contract.mjs`,
  `tests/pm14/p07-encargos-concurrencia-contract.mjs`,
  `tests/pm14/db/p07-postgres-concurrencia-contract.mjs` — todos PASS,
  incluidos los 2 que corren contra Postgres real con bloqueos reales.
- **Impresión y exportación**: no existe ningún archivo `.mjs` dedicado
  a impresión o exportación (Excel/PDF) en los 142 inventariados. **No
  se inventa cobertura que no existe** — la deuda de la dependencia
  `xlsx` ya está señalada aparte en `SEGUIMIENTO_18_PUNTOS.md` (Punto 8);
  este hallazgo (ausencia de test automatizado de impresión/exportación)
  queda cruzado con ese punto, no duplicado como uno nuevo.

## 7. Qué NO se hizo (límites honestos)

- No se aplicó ningún cambio a `fuente.js`, `source-recovery/fuente-recuperado.js`
  ni a ninguna migración — no hizo falta, ningún defecto de producto.
- No se tocó `release`, `main`, PR #38, QA, PROD ni Netlify.
- No se regeneró la evidencia desactualizada de los 5 diagnósticos de
  PM13 — deuda separada (sección 6 de `SEGUIMIENTO_18_PUNTOS.md` tras
  esta actualización), no corregida en esta rama por quedar fuera de su
  alcance.
- No se modificó `.github/scripts/build-netlify-publish.mjs` pese al
  hallazgo de la sección 5 — cruzado con el Punto 6, no resuelto aquí.

## 8. Entrega

- **SHA final**: `3f8e1d0300cb16b99634c2ff04d3135ee37e29d3` (rama
  `claude/punto2-134-pruebas`).
- **Puerta de CI**: [`run 35495409478`](https://github.com/Plopezm1990/Almacen/actions/runs/35495409478) — SUCCESS, 4/4 jobs.
- **ACTIVE_PASS=133 · ACTIVE_FAIL=0 · HISTORICAL_EXPECTED_FAIL=1 ·
  UTILITIES=3 · DIAGNOSTICS=5 · TOTAL_INVENTORY=142.**
- **Defectos actuales de producto confirmados: 0.**
- Versiones reales: Node v22.23.2, PostgreSQL 16.15 (job
  `node-y-postgres`), Supabase Storage v1.72.1 (jobs full-stack).
- Matriz completa, archivo por archivo: `MATRIZ_134_PRUEBAS.md`.
- Manifiesto versionado (fuente de verdad): `manifiesto_clasificacion.json`.
- Scripts reproducibles: `evidencia/ejecutar_bateria_no_db.sh`,
  `evidencia/preparar_postgres_local.sh` — verificados desde un
  worktree limpio (`git worktree add --detach`) antes de confiar en
  ellos, y de nuevo en CI sobre el commit final.

El Punto 2 queda cerrado bajo el criterio descrito en la sección 2: los
133 contratos activos están en verde real, verificado en CI sobre el
commit final, no solo localmente.
