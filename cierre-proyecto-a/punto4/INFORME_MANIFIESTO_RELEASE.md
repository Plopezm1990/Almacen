# Punto 4 — Manifiesto de reconstrucción del release

**Estado: PREPARADO Y VALIDADO — NO promocionado a `release`.** La
promoción requiere autorización separada (ver sección 6).

Rama de trabajo: `claude/punto4-manifiesto-release`, creada desde
`origin/release@8540bd06d5555cf260aa4599144ed6c64f3ca029` (el HEAD real y
vigente de `release`; la sección anterior de este punto en el seguimiento
referenciaba `f313bc0`, que ya no es el HEAD desde el Punto 1/PM33).

SHA final validado: **`4127d39945d49f51c33e4b13a1ec8d69cc6a872e`** (único
commit sobre `release`; coincide con el HEAD local, el HEAD remoto
empujado, y el SHA sobre el que corrieron ambos workflows).

---

## 1. Diagnóstico de partida

`source-recovery/CURRENT_RELEASE_MANIFEST.json` y
`CURRENT_RELEASE_EVIDENCE.json` en `release@8540bd0` seguían certificando:

```
targetFuenteCommit:   9d54fc7ba76bd1285625f37b2940f99d26777ab8
targetArtifactSha256: 0e45bc8d4175771b8bfd1e74ad0aa12fd39853a1431dc6ca702470882ae6c4c2
```

Desactualizado tras las promociones del Punto 1 (PM33) y el Punto 3
(puerta de CI). El commit real más reciente que modifica `fuente.js` es
otro:

```
$ git log -1 --format=%H -- fuente.js     # sobre release@8540bd0
70ccfd54d673f20584fe3d37f3791de0b2455270

$ git show 70ccfd54d673f20584fe3d37f3791de0b2455270:fuente.js | sha256sum
9367617cb34600966a5e726e6a16b1bb2a537b220aba0c54d6fdd53e53c1eb8a
```

**No se asumió** que `targetFuenteCommit` debía ser el HEAD de `release`
(`8540bd0` es un commit de infraestructura de CI, no toca `fuente.js`):
se calculó con `git log -1 --format=%H -- fuente.js`, el mismo método que
ya usan internamente `recuperar_candidato.py --sync-current` y el propio
workflow de certificación -- ninguno de los dos necesitó cambios de
lógica, porque ya calculan el commit objetivo dinámicamente.

## 2. Revisión de los archivos del mecanismo

- **`source-recovery/README.md`**: documenta las dos garantías (paridad
  de cuerpo de aplicación vía `recuperar_candidato.py --check`, y
  reconstrucción byte a byte vía `rebuild-current.mjs`/`npm run
  build:current`) y el contrato de certificación remota. No requirió
  ningún cambio.
- **`source-recovery/rebuild-current.mjs`**: reconstruye el baseline
  histórico (`baseCommit`) en un worktree desechable, exige
  `baseArtifactSha256`, aplica `CURRENT_RELEASE.patch` con `patch
  --batch --fuzz=0 -p1`, exige `targetArtifactSha256` e igualdad byte a
  byte contra `../fuente.js`. Sin cambios: no depende de ningún SHA
  hardcodeado propio, todo viene del manifiesto.
- **`source-recovery/recuperar_candidato.py`**: `--sync-current` recalcula
  `target_fuente_commit` con `git log -1 --format=%H -- fuente.js` y
  remapea la frontera del cuerpo de aplicación desde un baseline
  histórico fijo (`CURRENT_SYNC_BASELINE = bd0dc4a8...`, sin relación con
  `baseCommit` de `rebuild-current.mjs`) mediante desplazamiento de hunks
  del diff. `--check` valida paridad sin escribir nada. Sin cambios.
- **`CURRENT_RELEASE_MANIFEST.json`** / **`CURRENT_RELEASE_EVIDENCE.json`**:
  regenerados (sección 3).
- **`.github/workflows/validate-source-recovery-release.yml`**:
  actualizado (sección 4) -- único archivo con lógica que sí dependía de
  valores fijos desactualizados.

## 3. Regeneración determinista

Mismo mecanismo ya existente, sin cambios de lógica, solo de valores:

- **`source-recovery/fuente-recuperado.js`**: re-sincronizado desde el
  mismo baseline histórico certificado (`bd0dc4a8...`, sin cambios).
  Cuerpo de aplicación idéntico al ya versionado (mismo SHA256,
  `7b74ffb2...`) -- el desplazamiento de línea cambió (los commits
  PM30-PM33 no movieron la frontera de forma que alterara el cuerpo
  certificado), pero el contenido resultante es el mismo.
- **`source-recovery/CURRENT_RELEASE.patch`**: diff binario acumulado
  desde `baseCommit=7b2aa0f1500ecfc5dce551196f5434655411a314` (conservado
  -- es el mismo baseline histórico que ya certificaba el manifiesto
  anterior; ninguna razón técnica para cambiarlo, ver sección 5) hasta el
  nuevo `targetFuenteCommit`.
- **`CURRENT_RELEASE_MANIFEST.json`**:
  ```json
  {
    "format": "la-suite-current-release-rebuild-v2",
    "baseCommit": "7b2aa0f1500ecfc5dce551196f5434655411a314",
    "baseArtifactSha256": "372813f2230054306b0d37eb3825938832b68f62ea88a484dde0b1dfcdb075ed",
    "releaseBaseCommit": "8540bd06d5555cf260aa4599144ed6c64f3ca029",
    "targetFuenteCommit": "70ccfd54d673f20584fe3d37f3791de0b2455270",
    "targetArtifactSha256": "9367617cb34600966a5e726e6a16b1bb2a537b220aba0c54d6fdd53e53c1eb8a",
    "patch": "CURRENT_RELEASE.patch",
    "patchSha256": "942a74a7e63240ea3717e14af43378fda8e2750d9e5b38be4f17c1461d85289a",
    "patchBytes": 1193558,
    "fuenteRecuperadoSha256": "7b74ffb26cd29cbfe4eb7c217bcb7f5a3fe7376719a542cca1a44bd3f41740cc"
  }
  ```
- **`CURRENT_RELEASE_EVIDENCE.json`**: mismos campos actualizados, más los
  hashes reales de las dos reconstrucciones (build directo y
  `build:current`), calculados por el propio workflow, nunca escritos a
  mano.

## 4. Workflow actualizado

`.github/workflows/validate-source-recovery-release.yml`:

- Trigger `push` restringido a `claude/punto4-manifiesto-release`
  (antes: `claude/source-recovery-release-20260915`, una rama de una
  ronda anterior).
- `RELEASE_BASE=8540bd06d5555cf260aa4599144ed6c64f3ca029` en la guarda de
  alcance/ancla (antes: `d2eec9dfbada9778fe4e787cd841790281bc5f7f`) y en
  la generación del manifiesto.
- `releaseBaseCommit` en la escritura de evidencia actualizado al mismo
  valor.
- **Sin cambios** en `baseCommit` (`7b2aa0f1...`, ver sección 5), en
  `syncBaselineCommit` (`bd0dc4a8...`), ni en la guarda de alcance que
  rechaza cualquier cambio fuera de `source-recovery/` y del propio
  archivo de workflow (`grep -Ev
  '^(source-recovery/|\.github/workflows/validate-source-recovery-release\.yml$)'`)
  -- ya estaba correctamente parametrizada.

## 5. Por qué se mantiene `baseCommit=7b2aa0f...`

El `baseCommit` fija el punto de partida histórico reproducible desde el
que se aplica el patch acumulado. Es independiente del `releaseBaseCommit`
(que solo identifica contra qué `release` se certificó por última vez).
No hay ninguna razón técnica para moverlo: el propio `rebuild-current.mjs`
demuestra en cada ejecución que ese commit sigue siendo reproducible byte
a byte (`baseArtifactSha256` se re-verifica, no se declara), y cambiarlo
solo invalidaría un patch más largo sin aportar nada -- el mecanismo está
diseñado precisamente para no necesitar mover el baseline en cada
release. Se mantiene sin cambios: `7b2aa0f1500ecfc5dce551196f5434655411a314`.

## 6. Validación local, antes de empujar

Ejecutado desde el árbol de trabajo (misma secuencia que ejecuta el
workflow), antes del commit `4127d39`:

1. `python3 source-recovery/recuperar_candidato.py --sync-current` →
   `SOURCE_RECOVERY_TARGET_FUENTE_COMMIT=70ccfd54d673f20584fe3d37f3791de0b2455270`,
   `PARIDAD_CUERPO_EXACTA=1`, `SOURCE_RECOVERY_SYNC_CURRENT=PASS`.
2. `python3 source-recovery/recuperar_candidato.py --check` →
   `PARIDAD_CUERPO_EXACTA=1`, `SOURCE_RECOVERY_CHECK=PASS`.
3. Generación de `CURRENT_RELEASE.patch` y `CURRENT_RELEASE_MANIFEST.json`
   con los mismos comandos que ejecuta el workflow.
4. `npm ci --no-audit --no-fund` limpio en `source-recovery/`.
5. **Build directo ejecutado dos veces**: mismo SHA
   (`41e359a826c115...`), mismo tamaño (4900319 bytes), `cmp -s` idéntico
   entre ambas ejecuciones.
6. **Reconstrucción exacta (`npm run build:current`) ejecutada dos
   veces**: cada ejecución levanta un worktree desechable del baseline
   histórico, reproduce `baseArtifactSha256`
   (`372813f2230054306b0d37eb3825938832b68f62ea88a484dde0b1dfcdb075ed`),
   aplica el parche con `patch --batch --fuzz=0`, y exige
   `targetArtifactSha256`. Resultado: mismo SHA
   (`9367617cb34600966a5e726e6a16b1bb2a537b220aba0c54d6fdd53e53c1eb8a`),
   mismo tamaño (5500891 bytes), `cmp -s` idéntico entre ambas
   ejecuciones **y contra `fuente.js`**.
7. `node --check` sobre el artefacto final: sintaxis válida.
8. Los 5 marcadores esenciales presentes (`function GestionAlmacen`,
   `function crearLogicaCaja`, `SelectorLocalInformes`,
   `ErroresSistema`, `obtener_contexto_operativo`).

`git diff --check origin/release..HEAD` **termina en código `2`, no
PASS**. Tiene exactamente un hallazgo:

```
source-recovery/CURRENT_RELEASE.patch:6272: trailing whitespace.
++    esPropietario && activasPM29.length <= 1 && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mt-2", style: { color: C2.inkSoft } }, "Para desactivar una empresa tiene que haber al menos dos activas: el programa necesita siempre una en uso."),
```
(el espacio final que señala `git diff --check` se omite aquí, al final
de la cita en este documento, solo por higiene de este propio archivo de
prosa; el byte real permanece intacto, sin tocar, en
`CURRENT_RELEASE.patch` y en `fuente.js`.)

Esa línea pertenece al **contenido histórico real de `fuente.js`** -- un
espacio final dentro de un literal de texto JSX ya presente en el bundle
servido ("...siempre una en uso. ", línea 112361 del `fuente.js` actual;
el patch ya commiteado anteriormente contenía dos casos equivalentes) --
y debe conservarse tal cual para mantener la reconstrucción byte a byte.
**No se modifica `fuente.js` ni se sanitiza el parche**: hacerlo
invalidaría `patchSha256`, rompería `patch --batch --fuzz=0` contra el
hash fijado, y dejaría de reproducir `fuente.js` byte a byte -- el
propósito entero del mecanismo.

Control acotado, excluyendo únicamente el artefacto generado que
reproduce ese contenido histórico:

```
$ git diff --check origin/release..HEAD -- . ':(exclude)source-recovery/CURRENT_RELEASE.patch'
$ echo $?
0
```

**Termina en código `0`.** El resto del cambio (el workflow y los otros
dos archivos JSON) no tiene ningún hallazgo de espacios.

**Por qué la excepción es segura, no una omisión**: el propio commit
demuestra, con evidencia generada y no declarada, que ese contenido es
exacto y no accidental --
- `patchSha256` queda fijado en el manifiesto y se reverifica en cada
  ejecución (`rebuild-current.mjs` aborta si no coincide).
- El parche se aplica con `patch --batch --fuzz=0 -p1`: cualquier drift,
  incluido en espacios, haría fallar la aplicación en vez de aceptarla
  en silencio.
- La reconstrucción exacta se ejecutó **dos veces** de forma
  independiente (secciones 6 y 7), con resultado idéntico entre sí.
- El resultado final se comparó **byte a byte contra `fuente.js`**
  (`cmp -s dist/fuente.js ../fuente.js`), no solo por SHA-256.

Cuatro comprobaciones independientes, todas en verde, sobre el mismo
byte que `git diff --check` señala -- la excepción está tan verificada
como el resto del mecanismo, no es una omisión sin comprobar.

## 7. Certificación remota

Push a `claude/punto4-manifiesto-release` (commit `4127d39`) disparó
`validate-source-recovery-release.yml`. Run
[`35528256636`](https://github.com/Plopezm1990/Almacen/actions/runs/35528256636)
— **SUCCESS real**, 9/9 pasos, logs comprobados (no solo el estado):

```
SOURCE_RECOVERY_TARGET_FUENTE_COMMIT=70ccfd54d673f20584fe3d37f3791de0b2455270
SOURCE_RECOVERY_TARGET_SHA=9367617cb34600966a5e726e6a16b1bb2a537b220aba0c54d6fdd53e53c1eb8a
SOURCE_RECOVERY_DIRECT_BUILD_REPRODUCIBLE=PASS
SOURCE_RECOVERY_BASE_SHA=372813f2230054306b0d37eb3825938832b68f62ea88a484dde0b1dfcdb075ed
SOURCE_RECOVERY_EXACT_REBUILD_TWICE=PASS
SOURCE_RECOVERY_RUNTIME_BYTE_PARITY=PASS
SOURCE_RECOVERY_CERTIFICATION=PASS
SOURCE_RECOVERY_GENERATED_ARTIFACTS_ALREADY_CURRENT=1
```

El último paso (`Versionar artefactos de certificación si cambiaron`)
**no generó ningún commit automático**: los artefactos regenerados en CI
coincidieron byte a byte con los que ya había commiteado localmente. Por
tanto el SHA final de la rama sigue siendo el commit manual `4127d39`, no
uno posterior generado por el workflow.

## 8. Puerta de CI general sobre el SHA final

Disparada manualmente vía `workflow_dispatch` sobre
`claude/punto4-manifiesto-release`. Run
[`35528466331`](https://github.com/Plopezm1990/Almacen/actions/runs/35528466331)
— **SUCCESS real, 4/4 jobs**, mismo SHA `4127d39`, conteos calculados
extraídos del log de `gate-final`:

```
ACTIVE_PASS=133
ACTIVE_FAIL=0
HISTORICAL_EXPECTED_FAIL=1
UTILITIES=3
DIAGNOSTICS=5
TOTAL_INVENTORY=142
PUERTA_CI_RELEASE_GATE=PASS
```

## 9. Igualdad del payload de Netlify

`.netlify-dist` construido en dos worktrees separados y desechables, uno
desde `origin/release@8540bd0` y otro desde
`claude/punto4-manifiesto-release@4127d39`:

- Mismas listas `COPIED_ROOT_ENTRIES` / `EXCLUDED_ROOT_ENTRIES` en ambos
  -- `source-recovery` y `.github` están excluidos en bloque en los dos
  casos (ya lo hacía `build-netlify-publish.mjs` antes de este punto; no
  se tocó esa lista).
- **33 archivos** en cada `.netlify-dist`, **mismas rutas relativas**.
- **Mismos SHA-256** archivo por archivo -- payload publicable **byte a
  byte idéntico**.
- Confirmado con búsqueda explícita de `source-recovery`/`.github` en
  ambos `.netlify-dist`: ninguna coincidencia.

Esperado y confirmado: los 4 archivos que cambia este punto viven todos
bajo `source-recovery/` y `.github/workflows/`, ambos ya excluidos del
contenido publicable -- promocionar esta candidata no cambiaría ni un
solo byte de lo que Netlify sirve hoy. El único efecto de un futuro push
a `release` sería, como en el Punto 3, disparar un nuevo deploy (nuevo
`deploy_id`) sin cambio de contenido.

## 10. Comprobaciones finales

- **`git diff --check origin/release..HEAD`**: código `2`, no PASS -- 1
  hallazgo exacto (`source-recovery/CURRENT_RELEASE.patch:6272: trailing
  whitespace`), explicado en la sección 6 (espacio real preexistente en
  `fuente.js`, capturado fielmente por el patch generado -- no se
  modifica). El control acotado que excluye únicamente ese artefacto
  generado (`git diff --check origin/release..HEAD -- .
  ':(exclude)source-recovery/CURRENT_RELEASE.patch'`) sí termina en
  código `0`.
- **Alcance exacto de archivos modificados** (`git diff --name-only
  origin/release HEAD`), 4 archivos:
  ```
  .github/workflows/validate-source-recovery-release.yml
  source-recovery/CURRENT_RELEASE.patch
  source-recovery/CURRENT_RELEASE_EVIDENCE.json
  source-recovery/CURRENT_RELEASE_MANIFEST.json
  ```
- **Ausencia de secretos**: `grep -oE 'secrets\.[A-Z_]+'` sobre el
  workflow modificado -- cero coincidencias.
- **Fusión simulada** (`git merge --no-commit --no-ff
  claude/punto4-manifiesto-release` sobre una copia desechable de
  `origin/release`, worktree separado, descartado después): automática,
  limpia, sin ningún conflicto, exactamente los 4 archivos esperados en
  el índice.
- **Commits que incorporaría la promoción**: exactamente **1**
  (`4127d39945d49f51c33e4b13a1ec8d69cc6a872e`) -- `git rev-list --count
  origin/release..HEAD` = 1.

## 11. Efecto esperado de promocionar

- `release` avanzaría de `8540bd06d5555cf260aa4599144ed6c64f3ca029` a
  `4127d39945d49f51c33e4b13a1ec8d69cc6a872e` (fast-forward puro, mismo
  patrón que el Punto 3).
- El contenido publicable en Netlify no cambia (sección 9) -- solo se
  actualiza documentación de certificación bajo `source-recovery/` y el
  workflow que la genera, ambos fuera del payload.
- `source-recovery/CURRENT_RELEASE_MANIFEST.json` y
  `CURRENT_RELEASE_EVIDENCE.json` pasarían a certificar correctamente el
  `fuente.js` real y vigente de `release`, cerrando la desactualización
  detectada.
- El push disparará, igual que en el Punto 3, un nuevo deploy automático
  de Netlify (nuevo `deploy_id`, mismo contenido servido).

## 12. Reversión

`release` está protegida (Fase B del Punto 3): no admite force-push, y
la regla se aplica también a administradores. **Mover `release` de
vuelta a `8540bd0...` no es una opción de reversión disponible** -- ni
siquiera para deshacer una promoción propia.

El único rollback permitido es **hacia delante**: crear un nuevo commit
que, partiendo del `8540bd0...` original, restaure el contenido anterior
de los 4 archivos modificados (`.github/workflows/validate-source-recovery-release.yml`,
`source-recovery/CURRENT_RELEASE.patch`,
`source-recovery/CURRENT_RELEASE_EVIDENCE.json`,
`source-recovery/CURRENT_RELEASE_MANIFEST.json`), y someter ese commit a
`gate-final` como cualquier otro cambio antes de fusionarlo -- exactamente
el mismo patrón de PR ya usado para incorporar la puerta de CI. Ese
rollback **no se ejecuta en esta entrega**; queda documentado como
procedimiento disponible si se necesitara. Ninguna migración de base de
datos, ningún cambio de `fuente.js` ni de configuración de
Netlify/Supabase está involucrado en ningún caso -- la reversión es
exclusivamente de metadatos de certificación y del workflow que los
genera.

## 13. Confirmación de límites respetados

- `release` no se movió ni se modificó: sigue en
  `8540bd06d5555cf260aa4599144ed6c64f3ca029`.
- `main` no se tocó: sigue en `93a570badba1c5375febfbddc1dffdbcef003dcd`.
- PR #38, Supabase y Netlify no se tocaron: cero `secrets.*` en el
  workflow modificado, ninguna llamada a sus APIs desde esta tarea salvo
  la lectura de solo consulta del estado de deploy ya publicado (no se
  disparó ningún deploy).
- No se aplicó ninguna promoción -- pendiente de autorización.
- No se empezó el Punto 5.
