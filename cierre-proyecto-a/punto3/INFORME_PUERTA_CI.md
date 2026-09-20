# Punto 3 — Puerta de CI sobre el candidato final a `release`

**Estado: FASE A EJECUTADA — la puerta de CI está incorporada a
`release` (`release` avanzó de `6e26391` a `8540bd0`, fast-forward puro,
autorizado explícitamente el 20/09/2026 — ver sección 6-ter). FASE B
AUTORIZADA pero BLOQUEADA: las herramientas de GitHub disponibles en
esta sesión no incluyen configuración de protección de rama — ver
sección 6-quater. `release` sigue sin ninguna regla de protección. El
Punto 3 NO se marca cerrado.**

**Dos ramas, con propósitos distintos**:

- **Rama de trabajo `claude/punto3-puerta-ci-final`**, creada desde
  `origin/release@6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d` (punto de
  partida corregido: `release` ya NO está en `f313bc0`). Contiene 7
  commits y conserva, a propósito, la evidencia histórica completa del
  proceso: el diseño de la puerta, la demostración real en rojo
  (`16b3c22`) y su reversión (`96457de`), y el vaivén del informe de
  cierre (añadido en `5bf2dec`, retirado en `ea9f76b`). SHA final:
  `ea9f76bb71414cd92534121e19cabbe35087ea8b`. Secciones 1-7 de este
  informe describen el trabajo hecho en esta rama.
- **Rama limpia de promoción `claude/punto3-promocion-final`**, creada a
  petición explícita tras una auditoría independiente: incorporar los 7
  commits de la rama de trabajo a `release` habría dejado en el historial
  de producción un fallo introducido deliberadamente (`16b3c22`) y su
  reversión (`96457de`), algo que no debe llegar a producción aunque el
  estado final sea correcto. Un solo commit
  (`8540bd06d5555cf260aa4599144ed6c64f3ca029`) directamente sobre
  `origin/release@6e26391`, con el estado final por **contenido** (no por
  cherry-pick de historia) de los mismos 17 archivos de `ea9f76b`. Sección
  8 de este informe documenta su construcción y verificación completas.

> **Nota sobre la ubicación de este informe**: se escribió originalmente
> dentro de la propia rama candidata de trabajo, lo que hacía su diff
> frente a `release` de 18 archivos en vez de 17 — una auditoría
> independiente lo detectó. Se corrigió: el contenido se trasladó aquí, a
> la rama de seguimiento, y se retiró por completo de ambas candidatas
> (nunca llegó a existir en `claude/punto3-promocion-final`).

---

## 1. Revalidación inicial (contra `release@6e26391`, no heredada del Punto 3 anterior)

- **SHA de `main`**: `93a570badba1c5375febfbddc1dffdbcef003dcd`.
- **SHA de `release`**: `6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d` (confirmado
  vía `git rev-parse origin/release` y vía `list_branches` de la API de
  GitHub).
- **Workflows existentes en `release@6e26391`**: 179 archivos bajo
  `.github/workflows/`. Se analizaron programáticamente los `on:` de los 179
  (parseo YAML real, no búsqueda de texto). Únicamente **2** tienen algún
  disparador que pueda alcanzar a `release`:
  - `pm05-regresion.yml`: `pull_request` **sin filtro de rama** (por tanto
    también dispara sobre PR dirigidos a `release`), pero con filtro de
    rutas muy estrecho: `index.html`, `fuente.js`,
    `source-recovery/fuente-recuperado.js`, `tests/pm05/**`,
    `docs/plan-maestro/PM05_*`. `permissions: contents: read`. Un solo job,
    3 pasos de sintaxis/contrato PM05.
  - `pm26-defecto-l-hotfix.yml`: `push` con `branches: [release]` (dispara
    solo tras la fusión, nunca en el propio PR), filtro de rutas también
    estrecho: `reset-pruebas-preview.js`,
    `tests/pm26/defecto-l-context-hotfix.test.mjs`, el propio workflow.
    `permissions: contents: read`.
  - Ningún otro workflow del repositorio dispara con `pull_request`/`push`
    sin filtro de rama que alcance a `release`, ni con `pull_request_target`.
- **Checks que se ejecutan hoy sobre un PR dirigido a `release`**: solo
  `pm05-regresion.yml`, y solo si el PR toca alguna de sus 5 rutas. Ninguna
  batería general.
- **Reglas de protección de `release`**: **ninguna**. `list_branches`
  devuelve `"protected": false` para `release`. No hay required status
  checks, no hay revisión obligatoria, no hay restricción de quién puede
  empujar.
- **¿Puede un commit llegar a `release` sin ejecutar ninguna prueba
  general?** **Sí, confirmado.** Con la rama sin proteger, un push directo
  o la fusión de un PR que no toque las 5 rutas de `pm05-regresion.yml` no
  dispara ni un solo workflow. Incluso tocando esas rutas, lo único que se
  ejecuta son 3 comprobaciones de sintaxis/contrato PM05 — nunca la batería
  de 133 contratos activos.
- **¿Algún workflow puede publicar en Netlify o escribir en Supabase?**
  **No, para ninguno de los 179.** Búsqueda de `secrets\.[A-Z_]+` en todo
  `.github/workflows/` de `release@6e26391`: **cero coincidencias** — ningún
  workflow del repositorio usa un solo secreto, por lo que ninguno puede
  tener credenciales para desplegar en Netlify ni escribir en un proyecto
  Supabase remoto. Los stacks de Supabase que sí se arrancan en CI
  (`pm12-p08-replay-concurrencia-fallos.yml`,
  `pm12-p08-produccion-segura.yml`, etc.) son siempre instancias locales
  desechables (`supabase start --workdir`), nunca el proyecto remoto. El
  despliegue real a Netlify ocurre fuera de GitHub Actions, por la propia
  integración de Netlify con el repositorio (ya observado y documentado en
  el Punto 1/PM33 Fase B: el `push` a `release` dispara el deploy de
  Netlify directamente, sin pasar por ningún workflow ni depender de que
  algún check pase) — un dato más a favor de proteger `release` con checks
  obligatorios, porque hoy nada se interpone entre un push y la
  publicación.

## 2. Rama aislada

`claude/punto3-puerta-ci-final`, creada con
`git checkout -b claude/punto3-puerta-ci-final origin/release` (merge-base
con `origin/release` = `6e26391`, confirmado). No se tocó `release` en
ningún momento; la rama no quedó con upstream apuntando a `release` (se
verificó y se corrigió antes de cualquier operación de red).

## 3. Diseño de la puerta general

Infraestructura generalizada a partir de la validada en el Punto 2
(`cierre-proyecto-a/punto2/`), ahora bajo rutas de repositorio, no de cierre
de un punto:

- `tests/ci/manifiesto_clasificacion.json` — mismas 142 entradas, mismo
  esquema (renombrado a `la-suite-puerta-ci-inventario-v1`).
- `tests/ci/ejecutar_bateria_no_db.sh` — 121 contratos activos Node, mismos
  7 pasos y misma garantía real (conteos calculados y exigidos, nunca
  declarados; veredicto impreso antes de la comprobación de árbol limpio).
  La comprobación de árbol limpio ya no necesita ninguna exclusión: la
  evidencia bruta vive en `tests/ci/evidencia/`, ignorada vía
  `tests/ci/.gitignore`.
- `tests/ci/preparar_postgres_local.sh` — 9 contratos activos Postgres + 1
  histórico esperado en rojo (PM33 P01), misma lógica de conteo real.
- `.github/workflows/puerta-ci-release.yml` — los mismos 4 jobs
  (`node-y-postgres`, `pm12-p08-supabase-full`, `pm33-p05-supabase-full`,
  `gate-final`) ya validados en el Punto 2, apuntando a las rutas
  generales. Se retiraron los pasos "verificar rama dedicada y
  release/main sin tocar" (comprobaban un SHA de `main` congelado
  específico de la ventana temporal del Punto 2, sin sentido para PR
  futuros) y se sustituyeron por una guarda general: el workflow nunca debe
  dispararse por `push` directo sobre `release` o `main`.
- Se eligió `tests/ci/` (no `cierre-proyecto-a/`) precisamente porque
  `.github/scripts/build-netlify-publish.mjs` ya excluye el directorio
  `tests/` en bloque del contenido publicable — así esta infraestructura
  nunca puede terminar publicada en Netlify, sin tocar esa lista de
  exclusión.
- Se conservan las **11 correcciones de tests** ya verificadas en el Punto 2
  (más el `.gitignore` de `tests/pm33/db/`), portadas tal cual porque
  `claude/punto2-134-pruebas` es descendiente directo de
  `release@6e26391` sin más commits de `release` entre medias — mismos
  archivos, mismas rutas, sin reescritura.
- PM33 P01 (`tests/pm33/db/p01-aislamiento-multiempresa-contract.mjs`) se
  mantiene `historical_expected_fail`, separado de la batería activa, tanto
  en el manifiesto como en `gate-final` (que revalida esa clasificación
  contra el árbol real en cada ejecución).
- Dependencias: `npm ci` en todos los pasos de instalación (confirmado
  `package-lock.json` presente en `tests/pm12/supabase-full/` y
  `tests/pm33/supabase-full/`).
- Sin credenciales ni entornos remotos: cero `secrets.*` en todo el
  workflow (confirmado por grep); los dos stacks de Supabase son locales
  desechables, parados siempre al final del job.
- Disparo: `workflow_dispatch` (manual), `pull_request` contra `release`
  (para poder proponerla como required status check), y `push` sobre la
  propia rama aislada (para poder validarla). **Deliberadamente sin**
  `push: branches: [release]` — ningún disparador de producción todavía.

## 4. Verificación

1. **Rojo real**: se forzó el fallo de un contrato activo no relacionado
   con esta ronda (`tests/g1/p02-evidence-map-contract.mjs`, un `throw`
   insertado como primera línea), commit `16b3c22`, empujado a la rama
   aislada. Run
   [`35503815182`](https://github.com/Plopezm1990/Almacen/actions/runs/35503815182)
   — **FAILURE real**. El job `node-y-postgres` terminó en rojo con causa
   exacta en su log:
   ```
   tests/g1/p02-evidence-map-contract.mjs [active_contract] -> exit=1 (37ms) resultado=FAIL
   NODE_ACTIVE_TOTAL=121
   NODE_ACTIVE_PASS=120
   NODE_ACTIVE_FAIL=1
   NODE_ACTIVE_FAIL_DETECTADO (1):
     - tests/g1/p02-evidence-map-contract.mjs (exit=1)
   BATERIA_NO_DB_FALLO
   ```
   El job `9 contratos activos Postgres...` se saltó correctamente (el
   paso previo ya había fallado) y el workflow completo terminó en
   `FAILURE` — el bloqueo es real, no solo un aviso.

2. **Verde real**: se revirtió el fallo forzado (`git revert --no-edit
   16b3c22` → commit `96457de`), empujado a la misma rama. Run
   [`35503941267`](https://github.com/Plopezm1990/Almacen/actions/runs/35503941267)
   — **SUCCESS real**, 4/4 jobs, con los conteos calculados (extraídos del
   log de `gate-final`, no del estado):
   ```
   NODE_ACTIVE_TOTAL=121  NODE_ACTIVE_PASS=121  NODE_ACTIVE_FAIL=0
   POSTGRES_ACTIVE_TOTAL=9  POSTGRES_ACTIVE_PASS=9  POSTGRES_ACTIVE_FAIL=0
   HISTORICAL_EXPECTED_FAIL=1
   PM12_FULL_STACK_PASS=2 (de 2)   PM33_FULL_STACK_PASS=1 (de 1)
   CALCULO_TOTAL_ACTIVOS=133 (121 Node + 9 Postgres + 3 full-stack)
   ACTIVE_PASS=133  ACTIVE_FAIL=0
   UTILITIES=3  DIAGNOSTICS=5  TOTAL_INVENTORY=142
   PUERTA_CI_RELEASE_GATE=PASS
   ```
   (Confirmado también un primer verde real, previo a la demostración en
   rojo, sobre el commit base de la puerta:
   [`35503667838`](https://github.com/Plopezm1990/Almacen/actions/runs/35503667838),
   commit `c8e4356`, mismos conteos.)

   **Confirmación final, sobre el SHA realmente entregado** (tras retirar
   `cierre-proyecto-a/punto3/INFORME_PUERTA_CI.md` del árbol de la
   candidata -- ver nota al inicio de este informe): commit
   `ea9f76bb71414cd92534121e19cabbe35087ea8b`, run
   [`35504771758`](https://github.com/Plopezm1990/Almacen/actions/runs/35504771758)
   — **SUCCESS real**, 4/4 jobs, mismos conteos calculados extraídos del log
   de `gate-final`:
   ```
   NODE_ACTIVE_TOTAL=121  NODE_ACTIVE_PASS=121  NODE_ACTIVE_FAIL=0
   POSTGRES_ACTIVE_TOTAL=9  POSTGRES_ACTIVE_PASS=9  POSTGRES_ACTIVE_FAIL=0
   HISTORICAL_EXPECTED_FAIL=1
   PM12_FULL_STACK_PASS=2 (de 2)   PM33_FULL_STACK_PASS=1 (de 1)
   CALCULO_TOTAL_ACTIVOS=133 (121 Node + 9 Postgres + 3 full-stack)
   ACTIVE_PASS=133  ACTIVE_FAIL=0
   UTILITIES=3  DIAGNOSTICS=5  TOTAL_INVENTORY=142
   PUERTA_CI_RELEASE_GATE=PASS
   ```

3. **El workflow no despliega en Netlify**: cero pasos que invoquen
   `netlify`, `netlify-cli` o cualquier acción de despliegue; cero
   `secrets.*` de ningún tipo en todo el archivo.

4. **El workflow no escribe en Supabase remoto**: los dos jobs
   full-stack (`pm12-p08-supabase-full`, `pm33-p05-supabase-full`) arrancan
   siempre un stack de Supabase **local y desechable**
   (`supabase start --workdir tests/.../supabase-full`), sin ningún
   `project-ref` ni credencial remota, y lo paran siempre al final del job
   (`if: always()`).

5. **El SHA probado es exactamente el HEAD de la rama**: `git log -1` local
   = `git ls-remote origin claude/punto3-puerta-ci-final` = SHA del run
   verde final = `ea9f76bb71414cd92534121e19cabbe35087ea8b`.

6. **`git diff --check` limpio**: `git diff --check origin/release HEAD`
   termina en código 0, sin hallazgos, sobre el diff completo de esta rama
   frente a `release`.

7. **Fusión simulada sin conflictos**: `git merge --no-commit --no-ff
   claude/punto3-puerta-ci-final` sobre una copia desechable de
   `origin/release` (worktree separado, descartado después) — fusión
   automática limpia, sin un solo conflicto, exactamente los 17 archivos
   esperados en el índice. Repetida tras retirar el informe de la
   candidata (SHA `ea9f76b`): mismo resultado, limpio, 17 archivos.

8. **Payload de Netlify byte a byte idéntico entre `release` y la
   candidata**: se construyó `.netlify-dist` (`node
   .github/scripts/build-netlify-publish.mjs`) en dos worktrees separados y
   desechables, uno desde `origin/release@6e26391` y otro desde el HEAD
   final de la candidata (`ea9f76b`). Resultado:
   - Mismas listas `COPIED_ROOT_ENTRIES` / `EXCLUDED_ROOT_ENTRIES` en
     ambos (`tests` y `.github` quedan excluidos en los dos casos; ninguno
     contiene `cierre-proyecto-a`, que además ya no existe en el árbol de
     la candidata tras retirar el informe).
   - **33 archivos** en cada `.netlify-dist`, **mismas rutas relativas**
     (`diff` entre los listados de rutas: sin diferencias).
   - **Mismos SHA-256** archivo por archivo (`sha256sum` de los 33
     archivos de cada lado, comparados con `diff`: sin diferencias) —
     payload publicable **byte a byte idéntico**.
   - Confirmado con `find -iname '*cierre-proyecto-a*'` sobre ambos
     `.netlify-dist`: ninguna coincidencia en ninguno de los dos.

   Esto confirma que, si se incorporase esta candidata a `release` hoy, el
   contenido que Netlify serviría en producción no cambiaría ni un solo
   byte respecto al que sirve ahora mismo con `release@6e26391` — el único
   efecto de ese push sería disparar un nuevo deploy de Netlify (la
   integración de Netlify despliega en cada push a `release`,
   independientemente de si el payload cambia), no un cambio de contenido
   servido. Ver aviso explícito en la solicitud de autorización A
   (sección 6).

## 5. Archivos modificados (17, frente a `release@6e26391`)

```
 .github/workflows/puerta-ci-release.yml            | 418 ++++++++++++
 tests/ci/.gitignore                                |   3 +
 tests/ci/ejecutar_bateria_no_db.sh                 | 295 +++++++++
 tests/ci/manifiesto_clasificacion.json             | 723 +++++++++++++++++++++
 tests/ci/preparar_postgres_local.sh                | 172 +++++
 tests/g1/p08-la004-gate-contract.mjs               |  19 +-
 tests/pm05/frontend-contract.mjs                   |  15 +-
 tests/pm07/frontend-contract.mjs                   |  24 +-
 tests/pm08/frontend-contract.mjs                   |  14 +-
 tests/pm09/p17-robustness-contract.mjs             |   8 +-
 tests/pm12/p10-preview-smoke-contract.mjs          |   9 +
 tests/pm15/p02-mej01-contexto-modales-contract.mjs |  13 +-
 tests/pm15/p04-nr08-proteccion-borrador-navegacion-contract.mjs | 16 +-
 tests/pm17/p03-wiring-login-logout-contract.mjs    |   5 +-
 tests/pm20/p05-buscador-etiquetas-auditoria-contract.mjs |   6 +-
 tests/pm26/defecto-l-context-hotfix.test.mjs       |  21 +
 tests/pm33/db/.gitignore                           |   1 +
 17 files changed, 1739 insertions(+), 23 deletions(-)
```

Este es el diff **completo y real** de la candidata frente a `release`
(`git diff --name-only origin/release HEAD` sobre el SHA final
`ea9f76b`, verificado tras retirar el informe): exactamente 17 archivos,
todos bajo `.github/workflows/` o `tests/`. Este propio informe
(`cierre-proyecto-a/punto3/INFORME_PUERTA_CI.md`) vive en la rama de
seguimiento (`claude/proyecto-a-la-suite-cierre-3xs7l3`), no en la
candidata — no forma parte del diff anterior.

Ningún cambio toca `fuente.js`, `index.html`, migraciones de
`supabase/migrations/`, ni ningún archivo de producto — solo tests
(correcciones ya verificadas en el Punto 2) e infraestructura de CI.

## 6-bis. Rama limpia de promoción: `claude/punto3-promocion-final`

Construida a petición explícita, tras una auditoría independiente: los 7
commits de `claude/punto3-puerta-ci-final` (secciones 1-6 de este
informe) incluyen un fallo introducido deliberadamente (`16b3c22`) y su
reversión (`96457de`) para demostrar el rojo/verde real de la puerta --
evidencia necesaria, pero que no debe llegar al historial de `release` si
esta candidata se incorpora.

**Construcción** (por contenido, sin cherry-pick de historia):
1. `git checkout -b claude/punto3-promocion-final origin/release` (base:
   `6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d`).
2. `git checkout ea9f76b -- <los 17 archivos>` -- trae el contenido final
   ya validado, sin ningún commit intermedio de la rama de trabajo.
3. Cambio de contenido único y explícitamente permitido: en
   `.github/workflows/puerta-ci-release.yml`, el trigger `push` pasa de
   `branches: [claude/punto3-puerta-ci-final]` a
   `branches: [claude/punto3-promocion-final]` -- necesario para poder
   validar esta rama en su propio nombre. `git diff ea9f76b` sobre los 17
   archivos confirma que es el único cambio.
4. Un solo commit: `8540bd06d5555cf260aa4599144ed6c64f3ca029`.

**Comprobado antes del push** (los 9 requisitos exigidos, todos con
resultado positivo):

| # | Comprobación | Resultado |
|---|---|---|
| 1 | `origin/release` ancestro directo de `HEAD` | OK (`git merge-base --is-ancestor`) |
| 2 | Exactamente 1 commit entre `origin/release` y `HEAD` | `git rev-list --count` = 1 |
| 3 | Diff de exactamente 17 archivos | `git diff --name-only` = 17 líneas |
| 4 | Todos bajo `.github/workflows/` o `tests/` | sin excepciones |
| 5 | Nada bajo `cierre-proyecto-a/` | sin coincidencias |
| 6 | Archivos idénticos a `ea9f76b` salvo el trigger permitido | `git diff ea9f76b` -- 1 línea, la del trigger |
| 7 | `git diff --check` | limpio, código 0 |
| 8 | Fusión simulada sobre copia desechable de `release` | sin conflictos, 17 archivos en el índice |
| 9 | Payload `.netlify-dist` byte a byte idéntico | 33 archivos, mismas rutas, mismos SHA-256, sin `cierre-proyecto-a` (worktrees limpios de `release` y de esta candidata, comparación independiente de la de la sección 4.8) |

**Confirmado después del push, con logs (no solo el estado)**: run
[`35505508683`](https://github.com/Plopezm1990/Almacen/actions/runs/35505508683)
— **SUCCESS real, 4/4 jobs**. Extraído del log de `gate-final`:
```
NODE_ACTIVE_TOTAL=121  NODE_ACTIVE_PASS=121  NODE_ACTIVE_FAIL=0
POSTGRES_ACTIVE_TOTAL=9  POSTGRES_ACTIVE_PASS=9  POSTGRES_ACTIVE_FAIL=0
HISTORICAL_EXPECTED_FAIL=1
PM12_FULL_STACK_PASS=2 (de 2)   PM33_FULL_STACK_PASS=1 (de 1)
CALCULO_TOTAL_ACTIVOS=133 (121 Node + 9 Postgres + 3 full-stack)
ACTIVE_PASS=133  ACTIVE_FAIL=0
UTILITIES=3  DIAGNOSTICS=5  TOTAL_INVENTORY=142
PUERTA_CI_RELEASE_GATE=PASS
```

No se demostró de nuevo el rojo en esta rama a propósito -- esa
demostración ya existe, real y verificada, en `claude/punto3-puerta-ci-final`
(sección 4); repetirla aquí solo añadiría otro commit temporal a limpiar.

## 6-ter. Fase A — EJECUTADA (autorizada explícitamente, 20/09/2026)

**Autorización recibida**: incorporar
`claude/punto3-promocion-final@8540bd06d5555cf260aa4599144ed6c64f3ca029`
a `release` mediante fast-forward exacto, sin `--force`, sin merge commit,
sin tocar `main` ni PR #38.

**Reconfirmado inmediatamente antes del movimiento** (los 4 puntos
exigidos):
1. `release` seguía exactamente en
   `6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d`.
2. La candidata seguía exactamente en
   `8540bd06d5555cf260aa4599144ed6c64f3ca029`.
3. El run
   [`35505508683`](https://github.com/Plopezm1990/Almacen/actions/runs/35505508683)
   seguía en `SUCCESS` (consultado de nuevo vía la API de GitHub Actions).
4. `git merge-base --is-ancestor origin/release origin/claude/punto3-promocion-final`
   confirmó que el fast-forward seguía siendo posible, y
   `git rev-list --count origin/release..origin/claude/punto3-promocion-final`
   devolvió `1` (el commit `8540bd0`, único).

**Movimiento**: `git push origin claude/punto3-promocion-final:release` →
`6e26391..8540bd0`. La notación `..` (no `...`) en la salida del propio
`git push` es la confirmación de que fue un fast-forward puro, sin
`--force` (no habría hecho falta: un push normal ya lo rechaza si no es
fast-forward) y sin ningún merge commit.

**Verificado después del push**:
- `release` = `8540bd06d5555cf260aa4599144ed6c64f3ca029` (`git fetch` +
  `git rev-parse origin/release`).
- `main` intacto: `93a570badba1c5375febfbddc1dffdbcef003dcd`.
- PR #38 sin tocar: `state=open`, `draft=true`, `mergeable_state=clean`,
  base `main@93a570b`, head `claude/pm26-preparacion-tecnica@f297be0` —
  ningún campo cambió.
- `.github/workflows/puerta-ci-release.yml` presente en `release`
  (`git show origin/release:...`), con su trigger
  `pull_request: branches: [release]` intacto.

**Despliegue automático de Netlify, supervisado hasta estado final**
(proyecto `chic-entremet-9107cf`, id
`472295da-601a-43df-a4bc-8171f2fc668b`):

| | Deploy anterior (baseline) | Deploy nuevo (tras el push) |
|---|---|---|
| `deploy_id` | `6aaf17545a7196000883d14d` | `6aafbc029d58a60008d41f3c` |
| `commit_ref` | `6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d` | `8540bd06d5555cf260aa4599144ed6c64f3ca029` |
| `branch` | `release` | `release` |
| `context` | `production` | `production` |
| `state` | `ready` | `ready` |
| `error_message` | `null` | `null` |
| secretos detectados | 0 (687 archivos escaneados) | 0 (693 archivos escaneados) |

**Demostración de la igualdad del payload**: la comparación local ya
hecha antes del push (sección 6-bis) -- 33 archivos, mismas rutas,
mismos SHA-256 entre `release@6e26391` y `8540bd0` -- es la prueba real
de que el contenido publicable no cambió.

El resumen del deploy de Netlify,
`"All files already uploaded by a previous deploy with the same
commits"`, es **evidencia corroborativa de reutilización**: Netlify
detectó los mismos archivos y no los volvió a subir, lo cual es
consistente con el resultado ya demostrado localmente. No se trata como
una segunda demostración independiente ni como sustituto de la
comparación SHA-256 -- es un mensaje de optimización interna de
subida de Netlify (deduplicación de assets ya conocidos), no una
garantía criptográfica publicada por Netlify sobre el contenido.

Esto confirma exactamente lo anticipado en el aviso de la propuesta
original (más abajo, sección A): el push disparó un deploy real y nuevo
(`deploy_id` distinto), pero sin ningún cambio de contenido servido en
producción.

**Resultado**: `release` avanzó de
`6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d` a
`8540bd06d5555cf260aa4599144ed6c64f3ca029`. La puerta de CI general
(`puerta-ci-release.yml`, 133/133 contratos activos) queda incorporada a
`release` y activa en los PR dirigidos a ella.

## 6. Propuesta de incorporación y de required status check

### A. Incorporar la candidata limpia a `release` — EJECUTADO (ver sección 6-ter)

Fusionar `claude/punto3-promocion-final` (commit `8540bd0`, un solo
commit sobre `release`, sin el historial de trabajo de
`claude/punto3-puerta-ci-final`) a `release`.

**Aviso explícito, confirmado en la práctica** (sección 6-ter): `release`
está conectada a Netlify por integración directa del repositorio (fuera
de GitHub Actions). Cualquier push a `release` dispara un deploy
automático de Netlify, y este push lo disparó (`deploy_id`
`6aafbc029d58a60008d41f3c`), aunque el payload publicable resultante fue
**byte a byte idéntico** al que Netlify servía antes desde
`release@6e26391` -- demostrado por la comparación local (33 archivos,
mismas rutas, mismos SHA-256), con el propio resumen del deploy de
Netlify ("All files already uploaded by a previous deploy with the same
commits") como evidencia corroborativa de reutilización, no como la
demostración en sí. El efecto visible en producción fue nulo a nivel de
contenido, pero sí quedó un nuevo deploy en el historial de Netlify
(nuevo `commit_ref`, nuevo `deploy_id`) — no fue una operación sin
efecto observable, solo sin cambio de contenido servido.

### B. Configurar protección de rama y required status check — PENDIENTE, no ejecutado

- **Check propuesto**: el job `gate-final` del workflow
  `Puerta de CI general -- candidato a release (133/133 contratos
  activos)` (`.github/workflows/puerta-ci-release.yml`). Al abrir el primer
  PR real contra `release` con este workflow ya en la rama base, GitHub
  mostrará el nombre exacto del check en la lista de checks del PR (job
  `gate-final`); ese es el nombre que habría que seleccionar en
  `Settings → Branches → Branch protection rules → release → Require
  status checks to pass before merging`.
- **Prerrequisito**: `release` no tiene ninguna regla de protección hoy
  (`protected: false`). Activar un required status check implica primero
  crear una regla de protección de rama para `release` (aunque sea mínima)
  y añadir ese check a la lista.
- **Efecto de aplicarlo**: ningún PR podría fusionarse a `release` sin que
  los 133 contratos activos (121 Node + 9 Postgres + 3 Auth/PostgREST/
  Postgres reales) terminen en verde, recalculados en cada ejecución — deja
  de ser posible que un commit llegue a `release` sin haber ejecutado
  ninguna prueba general (el hallazgo del punto 1). Un push directo a
  `release` (sin PR) seguiría siendo posible salvo que la regla de
  protección también restrinja quién puede empujar directamente — esa es
  una decisión de alcance mayor, no incluida en esta propuesta mínima.
- **Reversión**: quitar el check de la lista de required status checks (o
  desactivar la regla de protección) revierte el efecto de inmediato; es
  un cambio de configuración de GitHub, no de código — no requiere revert
  de ningún commit.
- **No incluido en esta propuesta** (fuera de alcance del Punto 3): añadir
  `push: branches: [release]` como disparador de producción del propio
  workflow. Eso permitiría verificar también el HEAD de `release` tras cada
  fusión, no solo en el PR, pero es una decisión operativa aparte que
  tampoco se activa sin autorización explícita.

## 6-quater. Fase B — AUTORIZADA, BLOQUEADA por falta de herramienta (20/09/2026)

**Autorización recibida**: aplicar la protección mínima descrita en la
sección B anterior -- required status check `gate-final`,
`strict=true`, aplicar a administradores, impedir force-push, impedir
borrado de `release`, sin aprobaciones de terceros ni reglas
adicionales.

**Preflight de solo lectura -- completado**:

| # | Comprobación | Resultado |
|---|---|---|
| 1 | `release` sigue en `8540bd06d5555cf260aa4599144ed6c64f3ca029` | OK (`git fetch` + `git rev-parse origin/release`) |
| 2 | `.github/workflows/puerta-ci-release.yml` existe en `release` | OK (`git show origin/release:...`) |
| 3 | Conserva el trigger `pull_request: branches: [release]` | OK |
| 4 | `gate-final` existe entre los checks reales del run `35505508683` | OK -- job `gate-final`, `conclusion=success` (API de GitHub Actions) |
| 5 | Configuración de protección actual capturada antes de modificar | `release` → `"protected": false`, sin ninguna regla (API de GitHub, `list_branches`) |

**Bloqueado antes de aplicar ningún cambio**: el servidor MCP de GitHub
disponible en esta sesión no expone ninguna herramienta para configurar
reglas de protección de rama (`branch protection rules` /
`required status checks`) -- se buscó explícitamente por nombre y por
dominio (protection, required status checks, repository settings/admin)
entre las herramientas disponibles y no existe ninguna con esa
capacidad. Tampoco hay acceso a `gh` CLI ni a la API REST de GitHub por
otra vía en este entorno de trabajo. Aplicar la Fase B tal como se
autorizó **no es posible con las herramientas disponibles en esta
sesión** -- es una limitación de capacidad técnica, no de autorización
ni de las comprobaciones anteriores (todas pasaron).

**No se aplicó ningún cambio de configuración**, ni se intentó ningún
rodeo. `release` sigue exactamente como estaba antes de esta fase: sin
ninguna regla de protección.

**Camino recomendado para completar la Fase B**:
1. **Manual, vía la interfaz de GitHub**:
   `https://github.com/Plopezm1990/Almacen/settings/branches` → "Add
   branch protection rule" → patrón de rama `release` → activar
   únicamente "Require status checks to pass before merging" (con
   "Require branches to be up to date before merging" marcado) y añadir
   `gate-final` a la lista de checks obligatorios (ya aparece disponible
   para seleccionar, porque el run `35505508683` y los runs posteriores
   sobre `release` ya lo registraron como check real) + "Do not allow
   bypassing the above settings" (para que aplique también a
   administradores -- si el plan/rol del propietario no permite marcar
   esa opción, GitHub lo indicará explícitamente en la propia interfaz,
   y esa sería la respuesta honesta a exigir en la verificación
   posterior) + "Restrict deletions" + dejar desactivado cualquier
   permiso de force-push. Sin "Require a pull request before merging"
   con aprobaciones, sin revisores obligatorios, sin ninguna otra regla.
2. **O** conceder a esta sesión una vía de acceso a la API de GitHub que
   cubra `branch protection rules` (por ejemplo, una herramienta MCP
   adicional, o credenciales de `gh api`), y repetir esta fase
   reutilizando el mismo preflight ya documentado arriba.

## 7. Confirmación de límites respetados

- `release` avanzó **solo** mediante el fast-forward explícitamente
  autorizado (sección 6-ter): de `6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d`
  a `8540bd06d5555cf260aa4599144ed6c64f3ca029`. Sin `--force`, sin merge
  commit, sin ningún otro cambio.
- `main` no se tocó: sigue en `93a570badba1c5375febfbddc1dffdbcef003dcd`.
- PR #38 no se tocó: `state=open`, `draft=true`, sin cambios de ningún
  campo.
- Supabase (proyecto real) no se tocó: ningún paso del workflow ni ninguna
  acción de esta tarea le hizo ninguna llamada.
- Netlify: el despliegue automático que se produjo tras el fast-forward
  fue el efecto esperado y avisado de antemano de mover `release` (su
  integración despliega en cada push, fuera de GitHub Actions) -- se
  supervisó hasta `ready`, sin errores, sin secretos, con payload
  confirmado byte a byte idéntico. No se hizo ninguna otra acción sobre
  Netlify (no se cambió configuración, no se disparó ningún deploy
  manual).
- No se aplicó ninguna regla de protección de rama ni required status
  check: la Fase B fue autorizada, su preflight de solo lectura pasó
  íntegro, pero quedó bloqueada por falta de herramienta disponible en
  esta sesión (sección 6-quater) -- no se intentó ningún rodeo.
- `claude/punto3-puerta-ci-final` y `claude/punto3-promocion-final` no se
  tocaron más allá de lo ya documentado; el contenido de la segunda es
  ahora, además, el HEAD de `release`.
- No se empezaron los puntos 4-18.
