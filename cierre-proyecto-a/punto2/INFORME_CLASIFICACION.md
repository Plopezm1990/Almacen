# Punto 2 — Informe de clasificación (deuda de pruebas fallidas)

Rama: `claude/punto2-134-pruebas`, creada desde `release` vigente
(`6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d`, el mismo commit al que se
promovió PM33). `release`, `main`, PR #38, QA y PROD **no se han tocado**
en este trabajo — todo lo ejecutado corrió contra código local o entornos
Postgres/Auth/PostgREST desechables (local o en GitHub Actions).

## 1. El informe original de 134/116/18 no se encontró

Antes de construir nada, se buscó exhaustivamente el informe
`Proyecto_A_Pendientes_Verificados_2026-09-19` (corte ~11:24 UTC), citado
por nombre como fuente de "134 scripts / 116 PASS / 18 FAIL" en
`cierre-proyecto-a/SEGUIMIENTO_18_PUNTOS.md` desde su primer commit
(`517f443`, 19/09/2026). Resultado de la búsqueda:

- `git log --all -S` del nombre del informe y de los formatos que este
  propio repositorio usa para cifras de resultados (`"116 PASS"`,
  `"18 FAIL"`, `"116/134"`, `"134 pruebas"`, `"134 casos"`, `"134
  scripts"`) sobre las 104 ramas remotas y todo el historial: **cero
  coincidencias**, salvo la cita textual que lo menciona sin adjuntarlo.
- El archivo `Proyecto_A_Pendientes_Verificados_2026-09-19` no existe en
  ningún árbol de ninguna rama.
- PR #38 (título y cuerpo) y una búsqueda de issues del repositorio: sin
  coincidencias.
- Los workflows de GitHub Actions más parecidos a "ejecutar la batería
  completa y contar resultados" (`pm20-p07-revalidacion-acumulada.yml`,
  `release-gate-consolidacion-pm14.yml`, `pm27-c16-e2e-post-hotfix.yml`)
  usan todos `set -euo pipefail` y **paran en el primer fallo** — ninguno
  puede, por diseño, generar un recuento tipo "116 PASS / 18 FAIL" en una
  misma ejecución. No existe tampoco ningún script "runner" que recorra
  las 134 pruebas sin parar en el primer error.

**Conclusión, aceptada por el propietario tras presentarle esta
evidencia**: el informe fue, con toda probabilidad, una evaluación
externa (de una sesión anterior) nunca versionada en este repositorio, y
el patrón de CI existente confirma que tampoco pudo generarse
automáticamente aquí. Por instrucción explícita del propietario, este
punto se completa con **un inventario nuevo y honesto**, construido desde
cero a partir de lo que existe realmente en el repositorio hoy — sin
pretender reproducir, ni heredar el número, del informe perdido.

## 2. Criterio del inventario nuevo

Unidad de prueba: cada archivo `.mjs` bajo `tests/` en `release`
(`6e26391`). Total encontrado: **142**. De esos 142, se excluyen de la
contabilidad PASS/FAIL, con justificación explícita caso por caso (ver
`MATRIZ_134_PRUEBAS.md`):

- **3 utilidades de infraestructura**, no casos de prueba: mutan
  archivos (`tests/pm12/p09-aplicar-index.mjs`, integra un script en
  `index.html`) o preparan fixtures para otros tests
  (`tests/pm12/supabase-full/prepare-fixture.mjs`,
  `prepare-production-baseline.mjs`). Ninguno afirma PASS/FAIL.
- **5 scripts de diagnóstico de solo lectura** (`tests/pm13/p0{1,2,3,4,7}-diagnostico-*.mjs`):
  inspeccionan `fuente.js` por patrones de texto y escriben un JSON/TXT de
  evidencia; no contienen ninguna aserción PASS/FAIL. Al ejecutarlos se
  confirmó, además, que la evidencia ya commiteada estaba desactualizada
  respecto al `fuente.js` actual (mismo patrón de "drift" ya documentado
  para PM33/source-recovery en rondas anteriores) — se revirtió esa
  regeneración para no alterar el árbol de trabajo con un cambio fuera
  del alcance de este punto, y queda anotado como hallazgo, no como
  defecto.

Quedan **134** archivos con semántica real de PASS/FAIL. Que esta cifra
coincida con el número citado en el informe perdido es una coincidencia
observada, **no una confirmación** de correspondencia con aquel informe:
la metodología es completamente distinta (inventario directo del árbol
actual, no un informe externo), y no hay forma de comprobar si los 134
archivos que cuento aquí son los mismos 134 casos que aquel informe
contaba.

## 3. Resultado real de los 142 archivos ejecutados

| Clasificación | Cuenta | Significado |
|---|---|---|
| **PASS** | **122** | Ejecutado de verdad, contra código/BD real, sin fallos. |
| **Contrato histórico obsoleto** | **10** | El texto/estructura exacta que el test comprueba cambió en una ronda posterior; el comportamiento real que el test pretendía proteger se verificó intacto por inspección directa del código actual. **No es un defecto.** |
| **Infraestructura** | **5** | 3 utilidades que no son casos de prueba + 2 casos con un hueco del arnés de prueba (un mock incompleto que quedó desfasado por un hotfix legítimo posterior). **No es un defecto de producto.** |
| **No aplicable** | **5** | Scripts de diagnóstico de solo lectura, sin PASS/FAIL. |
| **Defectos actuales de producto** | **0** | Ninguno encontrado. |

**Total: 142. Suma verificada: 122+10+5+5 = 142.**

De los 134 con semántica PASS/FAIL: **122 PASS reales, 10 contrato
obsoleto, 2 infraestructura (arnés) — 0 defectos de producto.**

Entornos usados, todos reales (nunca simulados/mockeados a nivel de
resultado):
- **121 pruebas**: Node puro (aserciones contra `fuente.js`,
  `source-recovery/fuente-recuperado.js`, `index.html` o fixtures
  locales).
- **10 pruebas**: PostgreSQL 16.13 real, local, desechable (bases
  `pm12_p08_test`, `pm14_p02_test`, `pm33_p05_test`, creadas y destruidas
  para este ejercicio). Sin Docker disponible en este entorno de
  trabajo, así que estas 10 se hicieron con el Postgres del sistema en
  vez de con el CLI de Supabase — el resultado es igual de real (SQL
  real, RPC real, sin mocks), solo cambia qué motor de Postgres lo sirve.
- **3 pruebas**: Auth + PostgREST + Postgres reales, que si necesitan
  Docker (el CLI de Supabase). Se ejecutaron en GitHub Actions,
  reutilizando exactamente el patrón ya validado en el Punto 1 (PM33):
  `.github/workflows/punto2-p08-supabase-full.yml`, rama
  `claude/punto2-134-pruebas`, commit `fc90ed6`,
  [`run 35492977065`](https://github.com/Plopezm1990/Almacen/actions/runs/35492977065) —
  **SUCCESS**, los dos jobs (`pm12-p08-supabase-full`,
  `pm33-p05-supabase-full`) en verde, con las marcas de PASS de cada
  test confirmadas en el log real (ver `MATRIZ_134_PRUEBAS.md`, sección
  de detalle).

## 4. Raíces de los 12 fallos iniciales (todas investigadas hasta el fondo)

Ningún fallo se clasificó por inspección superficial: cada uno se
reprodujo, se localizó la comprobación exacta que fallaba, se comparó
contra el código real de `fuente.js`/`source-recovery/fuente-recuperado.js`
con `grep`/lectura directa, y solo se cerró la clasificación cuando la
causa quedó confirmada con evidencia textual. Resumen de las causas
raíz encontradas (el detalle completo, por archivo, está en
`MATRIZ_134_PRUEBAS.md`):

1. **Renombrado de variables por el empaquetador** (`p2`→`p22`,
   `l2`→`l22`, `a2`→`a22`): afecta a `tests/pm07/frontend-contract.mjs`
   (5 de sus 7 comprobaciones) y `tests/pm08/frontend-contract.mjs` (1
   comprobación). La lógica es idéntica carácter por carácter salvo el
   nombre de la variable — confirmado con `grep` sobre el patrón exacto
   renombrado.
2. **RPC renombradas en una ronda posterior** (PM09 añadió el sufijo
   `_pm09` a `registrar_venta_stock_carrito`/`revertir_venta_stock_carrito`):
   2 comprobaciones de `tests/pm07/frontend-contract.mjs`.
3. **Reescritura de un manifiesto a una versión posterior** (v1→v2, con
   una capa de validación `requireString(manifest, campo)` en vez de
   acceso directo `manifest.campo`): `tests/g1/p08-la004-gate-contract.mjs`
   (2 comprobaciones) — la verificación de SHA sigue presente, confirmada
   por `grep` en `source-recovery/rebuild-current.mjs`.
4. **Validación añadida antes de un spread de datos** (`...data` →
   `...validacion.datos`): 1 comprobación de
   `tests/pm05/frontend-contract.mjs` — `empresaId` se sigue fijando
   igual; es un endurecimiento, no una regresión.
5. **Texto de mensaje al usuario reescrito, misma protección**:
   `tests/pm09/p17-robustness-contract.mjs` (1 comprobación) — el
   bloqueo de una operación con un envío previo sin confirmar sigue
   activo, solo cambió la frase mostrada.
6. **Rediseño de UI (PM28/PM29) que sustituyó componentes completos
   preservando el comportamiento protegido**: `tests/pm15/p02-mej01-contexto-modales-contract.mjs`
   (modal `ConfirmarConContrasenaPM29` sustituye al JSX inline de PM15,
   sigue mostrando "Empresa: X") y `tests/pm15/p04-nr08-proteccion-borrador-navegacion-contract.mjs`
   (`TopBarC` se sustituyó por `BarraSuperiorMovil`+`SidebarGrupos`, se
   retiró el conmutador de diseño A/B; `setTab: cambiarTabPM15` —el
   `setTab` protegido contra pérdida de borrador— confirmado presente en
   `SidebarGrupos`, `NavInferior` y `BusquedaGlobal` por inspección
   directa).
7. **Técnica de navegación cambiada, mismo destino**:
   `tests/pm17/p03-wiring-login-logout-contract.mjs` — un enlace `<a
   href>` real sustituyó a un manejador de clic imperativo
   (`window.location.href = ...`); técnica más idiomática/accesible,
   mismo destino.
8. **Prop añadida sin quitar ninguna de las anteriores**:
   `tests/pm20/p05-buscador-etiquetas-auditoria-contract.mjs` — se
   añadió `empresa: empresaDelLocalActivo` delante de las 3 props
   originales, que siguen intactas.
9. **Hueco del arnés de prueba, no del producto**:
   `tests/pm12/p10-preview-smoke-contract.mjs` y
   `tests/pm26/defecto-l-context-hotfix.test.mjs` — ambos simulan un
   `window` mínimo dentro de una sandbox `vm` de Node; una barrera de
   arranque añadida después (post-reset, hotfix legítimo) empezó a
   llamar a `window.setInterval` en la ruta de producción, función que
   el `window` simulado de estos dos tests nunca definió porque no
   existía cuando se escribieron. Un navegador real siempre tiene
   `setInterval`; reproducido con `setInterval` mockeado, el resto del
   script corre sin ningún otro fallo.
10. **Prerrequisito de build ausente, no un fallo real**:
    `tests/netlify-publish-boundary.mjs` fallaba con `ENOENT
    .netlify-dist` porque ese directorio lo genera el propio comando de
    build de Netlify (`node .github/scripts/build-netlify-publish.mjs`,
    declarado en `netlify.toml`), que no se había ejecutado en este
    entorno de trabajo. Tras ejecutarlo: `NETLIFY_PUBLISH_BOUNDARY_PASS
    entries=33` — pasa limpio.
11. **Registro histórico retirado a propósito**:
    `tests/pm33/db/p01-aislamiento-multiempresa-contract.mjs` — el
    propio repositorio documenta, en la cabecera de
    `tests/pm33/db/contrato-vigente-contract.mjs`, que este archivo "se
    conserva SIN modificar como registro histórico... no se toca ni se
    reutiliza como gate", precisamente porque P03 cambió deliberadamente
    el comportamiento que este archivo todavía comprueba. El contrato
    vigente real (`contrato-vigente-contract.mjs`) pasa 39/39.

## 5. Recorridos PM28–PM33 verificados especialmente

Por instrucción explícita, se prestó atención reforzada a: identidad/
fichaje, contexto empresa/local, persistencia, red, concurrencia,
impresión y exportación.

- **Fichaje**: `tests/pm13/p03-fichajes-contract.mjs`,
  `p03-backend-fichajes-contract.mjs` — **PASS**. No se encontró ningún
  identificador "VIS-17" en el repositorio (ni en el árbol actual de
  `release` ni en el historial completo de las 104 ramas) — si se
  refiere a un catálogo distinto del que usa este repo (que identifica
  sus casos como `LA-0xx` en `tests/pm04/regression-catalog.json`),
  conviene que el propietario confirme dónde vive esa referencia.
- **Contexto empresa/local**: cubierto extensamente — PM33 (39/39 +
  15/15 en Auth/PostgREST real), PM29 (`p01`/`p02`/`p03`
  desactivar/adopción — **PASS**), PM32 (selector empresa/local —
  **PASS**), PM15 (2 casos, ambos "contrato obsoleto" con el
  comportamiento confirmado intacto, ver sección 4).
- **Persistencia**: `tests/pm10/p10-autoridad-persistencia-contract.mjs`
  — **PASS**.
- **Red**: manejo de fallos de red y modo offline cubierto en
  `tests/pm09/p17-robustness-contract.mjs` (infra, comportamiento real
  confirmado intacto) y en la lógica de venta/traspaso offline de
  `tests/pm07/frontend-contract.mjs` (contrato obsoleto, comportamiento
  confirmado intacto).
- **Concurrencia**: `tests/g1/p07-concurrencia-replay-contract.mjs`,
  `tests/pm08/replay-scope-contract.mjs`,
  `tests/pm11-compra/p08-fallos-replay-concurrencia-contract.mjs`,
  `tests/pm12/p08-fallos-replay-concurrencia-contract.mjs`,
  `tests/pm12/db/p08-postgres-contract.mjs`,
  `tests/pm14/p07-encargos-concurrencia-contract.mjs`,
  `tests/pm14/db/p07-postgres-concurrencia-contract.mjs` — **todos
  PASS**, incluidos los 2 que corren contra Postgres real con bloqueos
  reales.
- **Impresión y exportación**: no existe ningún archivo `.mjs` dedicado
  a impresión o exportación (Excel/PDF) en la batería completa de 142.
  La deuda de la dependencia `xlsx` usada para exportar ya está señalada
  aparte, como punto propio, en `SEGUIMIENTO_18_PUNTOS.md` (Punto 8) —
  este hallazgo (falta de cobertura automatizada de impresión/
  exportación) queda anotado aquí como referencia cruzada, no se
  duplica como punto nuevo.

## 6. Qué NO se hizo (límites honestos de esta ronda)

- No se aplicó ningún cambio a `fuente.js`, `source-recovery/fuente-recuperado.js`
  ni a ninguna migración: no hizo falta, porque no se confirmó ningún
  defecto de producto.
- No se tocó `release`, `main`, PR #38, QA ni PROD.
- No se regeneró la evidencia desactualizada de los 5 diagnósticos de
  PM13 (se revirtió tras confirmar el hallazgo) — actualizarla, si se
  quiere, es una decisión aparte, fuera del alcance de este punto.
- Los 3 casos Auth/PostgREST/Postgres reales se resolvieron con un
  workflow de GitHub Actions nuevo (mismo patrón que el ya validado
  para PM33), no con Docker local — este entorno de trabajo no tiene
  Docker operativo.

## 7. Propuesta de corrección, por prioridad

Como no se encontró ningún defecto de producto, no hay nada que
corregir en `fuente.js` ni en el backend. La deuda real que queda es
**de los propios tests** (10 archivos con aserciones sobre texto/
estructura exacta que quedó obsoleta) y **de cobertura** (impresión/
exportación sin test dedicado). Prioridad sugerida:

1. **Alta — actualizar los 10 tests con contrato obsoleto** para que
   afirmen sobre el comportamiento real vigente en vez de un patrón de
   texto que ya no existe. Mientras sigan en rojo, cualquier ejecución
   futura de la batería completa reportará fallos que no son fallos,
   erosionando la confianza en el resultado (exactamente el riesgo que
   motivó este punto). Los 2 archivos con hueco de arnés
   (`window.setInterval` ausente en el mock) necesitan solo añadir esa
   función al objeto `window` simulado.
2. **Media — decidir el destino de `tests/pm33/db/p01-aislamiento-multiempresa-contract.mjs`**:
   ya está documentado como retirado; podría borrarse o marcarse de
   forma más visible (p. ej. moverlo a un directorio `historico/`) para
   que dejar de ejecutarlo en la batería completa no dependa de que
   quien la corra lea la cabecera del archivo vecino.
3. **Baja — cobertura de impresión/exportación**: no hay evidencia de
   que falte funcionalmente (no se encontró ningún defecto), pero
   tampoco hay ningún test automatizado que lo cubra. Añadir uno es una
   mejora de cobertura, no una corrección de un fallo conocido.
4. **Aparte, no de este punto**: refrescar la evidencia desactualizada
   de los 5 diagnósticos de PM13 si se van a seguir usando como
   referencia — decisión del propietario, fuera del alcance de este
   punto.

## 8. Entrega

- **SHA de esta rama** (con la matriz, este informe y el workflow ya
  commiteados): ver el commit final de esta rama en el historial de
  `claude/punto2-134-pruebas`.
- **PASS**: 122 · **Contrato obsoleto**: 10 · **Infraestructura**: 5 ·
  **No aplicable**: 5 · **Defectos actuales**: 0 · **Total**: 142.
- **Lista exacta de "fallos" iniciales, todos reclasificados** (ninguno
  quedó como defecto de producto): ver sección 4 de este informe y el
  detalle en `MATRIZ_134_PRUEBAS.md`.

Cada uno de los 142 casos tiene un resultado demostrado (ejecutado de
verdad, o clasificado con evidencia textual concreta cuando no aplica
PASS/FAIL). El Punto 2 puede darse por completado bajo el criterio
descrito en la sección 2 de este informe.
