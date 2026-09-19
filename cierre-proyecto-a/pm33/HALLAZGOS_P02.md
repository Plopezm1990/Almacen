# PM33 — Revisión de cierre: P01 → P02 → P03

Estado: **P03 preparado y validado localmente contra Postgres real (16.13), incluida la migración completa desde el estado real de PROD y el parche de frontend. NO aplicado a Supabase ni a producción. Falta validación con PostgreSQL 17 (versión real de PROD/QA), Auth/PostgREST reales -- propuesta concreta preparada en `PROPUESTA_VALIDACION_QA.md`, pendiente de autorización.**

Este documento cubre las tres iteraciones en orden: **P02** (secciones 1-6,
qué corrigió sobre el candidato original P01 y qué gap dejó abierto) y
**P03** (sección 7 en adelante, qué corrigió sobre P02 tras una segunda
ronda de revisión). Nada de lo descrito en las secciones 1-6 quedó
aplicado; P03 lo sustituye por completo como candidato vigente.

## 1. Contexto

El candidato original está en la rama `claude/pm33-fix-obtener-contexto-operativo`
(commit `4127782b3feb2977e0570548904ca5e4f6523937`), un solo commit por
delante de `release` (`f313bc0e036281d5c68c57fcda72da72f0dd0369`, verificado
con `git merge-base` — sin conflicto de fusión). Corrige R10: la función
`public.obtener_contexto_operativo()`, **hoy vigente en PROD sin ningún
cambio** (confirmado por `pg_get_functiondef` contra el proyecto
`flqercbgpgmmfaakrwkc` el 19/09/2026), lee `empleados`, `proveedores`,
`fichasCosto` y `encargos` desde `almacen_kv` sin acotar por
`empresa_id`/`local_id`, pese a que la tabla tiene esas columnas.

Ese documento (`docs/plan-maestro/PM33_CONTEXTO_OPERATIVO_AISLAMIENTO.md` en
la rama del candidato) reporta 14 escenarios / 38 aserciones en verde contra
Postgres 16 real. **Reproduje esa batería de forma independiente** (no me
limité a confiar en el mensaje del commit): cargando el mismo
`tests/pm33/db/fixtures.sql` y el mismo
`supabase/migrations/20260919120000_pm33_obtener_contexto_operativo_aislamiento.sql`
contra un Postgres 16.13 real (`postgresql-16` local, no mock/regex),
obtuve el mismo resultado: **38/38 PASS**.

## 2. Hallazgo: regresión para roles no gestionados por el bloque obligatorio

El propio documento del autor original afirma en su sección "Riesgo de
regresión": *"Riesgo medio, ya cubierto por T14: cualquier rol fuera de
Encargado/Cajero/a/Churrero/a que llame a esta RPC. Cubierto y en verde."*
Esa afirmación es **incorrecta**: T14 solo comprueba que la llamada no
lanza error, que `rol` y `empresaId` son los esperados y que `proveedores`
está vacío. **No comprueba `empleado` ni `empleadosFichaje`.**

### Causa

P01 solo calcula `(v_empresa_id, v_local_id)` dentro de
`if v_rol in ('Encargado','Cajero/a','Churrero/a') then ...`. La rama
`elsif v_empleado_id is not null` — que resuelve el propio registro de
empleado para **cualquier rol** con `empleado_id` (incluido `Camarero/a`,
usado hoy por `fuente.js` vía `fichajesDelPropioEmpleado` /
`empleadoDelContexto` para que un empleado que no es Encargado vea sus
propios fichajes) — filtra por
`k.empresa_id = v_empresa_id and k.local_id = v_local_id`. Para un rol
fuera de esas tres, esas variables quedan `NULL`, la comparación es
`NULL` (desconocida) para toda fila, y `empleado`/`empleadosFichaje`
vuelven vacíos donde la función **hoy vigente en PROD** sí devuelve el
propio registro (sin acotar por tenant, que es justamente el defecto R10,
pero sin vaciarlo).

### Reproducción con Postgres real (no solo inspección de código)

Mismo fixture, mismo usuario `Camarero/a` (`empleado_id='ea-4'`, ya
presente en `tests/pm33/db/fixtures.sql`, usuario de T14):

| Función | `ctx.empleado` | `ctx.empleadosFichaje` |
|---|---|---|
| Vigente en PROD hoy (0 argumentos, sin el parche) | `{"id":"ea-4","nombre":"SEÑUELO-A-Bajado-Diego",...}` | `[{"id":"ea-4",...}]` |
| Candidato P01 tal cual (rama `claude/pm33-fix-obtener-contexto-operativo`) | `null` | `[]` |
| Candidato P02 (este documento) | `{"id":"ea-4","nombre":"SEÑUELO-A-Bajado-Diego",...}` | `[{"id":"ea-4",...}]` |

Impacto funcional real si P01 se aplicase tal cual: cualquier empleado con
rol `Camarero/a` (el único rol legítimo hoy fuera del bloque gestionado,
según los datos de PROD) dejaría de ver sus propios fichajes en el
frontend — confirmado leyendo `fuente.js` (`fichajesDelPropioEmpleado` usa
`contexto.empleado` / el único elemento de `empleadosFichaje`).

## 3. Corrección P02 (mínima)

Archivo: `candidato_p02_obtener_contexto_operativo.sql` en esta misma
carpeta. Cambia únicamente el bloque `elsif v_empleado_id is not null` a
nivel de rol (antes de las lecturas de datos):

- Para roles fuera de `Encargado/Cajero/a/Churrero/a`: **no se les exige
  contexto** (no cambia nada de lo que ya hacía P01 para ellos: sin
  excepción nueva). Si su contexto **es** deducible de forma inequívoca
  (mismo criterio de "exactamente un candidato" que usa el bloque
  obligatorio: una membresía propia no-todos-locales, o su propio registro
  en `almacen_kv`), se usa para acotar la búsqueda de su empleado —
  mejora de aislamiento que P01 dejó sin acotar en este camino.
- Si hay **cero candidatos o más de uno** (ambiguo), `v_empresa_id`/
  `v_local_id` quedan `null` a propósito: la búsqueda de empleado cae al
  comportamiento previo (sin acotar por tenant), **igual que la función
  hoy vigente en PROD**. Nunca se lanza excepción en este camino — a
  diferencia del bloque obligatorio, que si rechaza.

No toca nada del bloque obligatorio (Encargado/Cajero/a/Churrero/a) ni la
verificación de local/empresa activos.

## 4. Pruebas ejecutadas (todas locales, Postgres 16.13 real — no mocks/regex)

1. **Base (T01–T14, sin cambios)**: contrato original completo, contra P02.
   `PM33_P01_CHECKS=38 TOTAL PASS=38 FAIL=0` — sin regresión en el
   aislamiento multiempresa ya probado.
2. **Ciclo rojo/verde de la regresión** (`p02-regresion-rol-no-gestionado.mjs`,
   T14e–T15):
   - Contra **P01 sin corregir**: `TOTAL PASS=4 FAIL=3` — falla
     exactamente en `empleado`/`empleadosFichaje` del Camarero/a, tal como
     predice el hallazgo. Confirma que la prueba detecta el defecto real.
   - Contra **P02**: `TOTAL PASS=7 FAIL=0`.
3. **Caso "contexto no deducible" para rol no gestionado** (T15, usuario
   nuevo con `empleado_id` inexistente en cualquier local): no lanza
   excepción, `empleado` queda `null` — mismo comportamiento que la
   función hoy vigente en PROD. Verifica el requisito explícito de esta
   revisión: "que el parche no introduzca regresiones ... para usuarios
   cuyo contexto no pueda deducirse automáticamente".
4. **Verificación adicional contra PROD real (solo lectura, sin aplicar
   nada)**: el propio autor de P01 dejó pendiente confirmar que "ningún
   empleado_id real resuelve en más de un local" antes de poder aplicar el
   parche. Ejecuté esa consulta de solo lectura contra
   `flqercbgpgmmfaakrwkc` el 19/09/2026: **0 filas** — ningún
   `empleado_id` de un perfil activo aparece en más de un
   `(empresa_id, local_id)` dentro de `almacen_kv.empleados` hoy. Ese
   riesgo específico queda cerrado con evidencia actual, no solo asumido.

Total combinado, base limpia: **45/45 PASS** (38 + 7).

## 5. Lo que esta revisión NO valida (gaps explícitos)

- **PostgreSQL 17**: PROD y QA corren PostgreSQL 17.6; toda la validación
  de este documento (y la del autor original) se hizo contra PostgreSQL
  16.13, la única versión disponible en este entorno de trabajo (sin
  Docker operativo ni paquete `postgresql-17` en los repositorios
  disponibles). No hay razón conocida para esperar diferencias de
  comportamiento (no se usa ninguna función/sintaxis específica de una
  versión), pero **no está demostrado** contra la versión real.
- **Auth/PostgREST/RLS reales**: la prueba usa un stub de `auth.uid()`
  vía `set_config('request.jwt.claim.sub', ...)`, no JWT real de
  Supabase Auth ni la capa PostgREST. La función es `SECURITY DEFINER` y
  su autorización vive íntegramente en su propio cuerpo (no depende de
  políticas RLS de las tablas que lee), lo que reduce pero no elimina
  esta brecha: falta confirmar el comportamiento end-to-end con un
  usuario autenticado real.
- **Compatibilidad multi-local del frontend — gap NO resuelto aquí**:
  `fuente.js` invoca `supabase.rpc("obtener_contexto_operativo")` **sin
  argumentos**. Si un `Encargado`/`Cajero/a`/`Churrero/a` real llegara a
  tener más de un local vía `membresias_usuario` (hoy, verificado, las 3
  membresías de PROD son todas `todos_locales=true`, así que este caso no
  se da todavía), el candidato (P01 o P02) rechazaría con "ambiguo" y el
  frontend no tiene forma de reintentar pasando `p_local_id`. Esto
  requiere una decisión de producto: cambiar el frontend para pedir el
  local explícitamente (cambio en `release`, fuera del alcance de esta
  preparación) o aceptar el riesgo mientras no existan membresías
  multi-local reales — **decisión pendiente del propietario del
  proyecto**, no tomada aquí.
- **No aplicado a ningún entorno real** (ni QA ni PROD): esta corrección
  es SQL preparado y probado localmente, nada más.

## 6. Próximo paso concreto (histórico, sustituido por la sección 7)

Esta sección describía el plan cuando P02 era el candidato vigente. Antes
de ejecutarlo se pidió una segunda ronda de revisión, que encontró un
defecto de diseño adicional en P02 (sección 7.1) y un gap crítico de
migración (sección 7.3). Ver sección 8 para el plan vigente.

---

## 7. P03 — segunda ronda de revisión sobre P02

Candidato: rama **`claude/pm33-p03-obtener-contexto-operativo`** (creada
desde `origin/release`, no desde `main` — ver sección 7.4), commit
**`e7491d5f840185025259e4029f7f1d6b8a814798`**. Un solo commit por delante
de `release` (`f313bc0`), sin conflicto. El SQL de P02 (sección 3 de este
documento) queda como referencia histórica; **P03 lo sustituye por
completo**, no es un incremento sobre el archivo `candidato_p02_...sql`.

### 7.1 Hallazgo: el fallback sin acotar de P02 era, en el fondo, otra vez R10

P02 (sección 2 de este documento) corrigió que roles no gestionados
(Camarero/a) perdieran su propio `empleado`/`empleadosFichaje`, pero lo
hizo con un fallback que, cuando el contexto no era deducible de forma
inequívoca, **leía `almacen_kv` sin acotar por empresa/local** —
exactamente el patrón de fondo de R10, ahora aplicado a la búsqueda de un
único empleado en vez de a un listado. Reproducido con Postgres real: un
`empleado_id` que colisiona entre dos empresas (sin membresía que
desambigüe) hacía que P02 devolviera, con `LIMIT 1`, el registro de
**cualquiera de las dos empresas** — no se había observado esa colisión en
PROD hoy (verificado en la revisión anterior), pero el propio código lo
permitía si llegara a darse.

También se encontró, en la misma revisión, que P02 no comprobaba que el
local/empresa resuelto para estos roles siguiera activo (sí lo hacía para
el bloque obligatorio, pero no para el camino de autoservicio de
Camarero/a): un usuario cuyo único contexto deducible apuntara a una
empresa dada de baja seguía recibiendo su propio registro de empleado.

**P03** (`supabase/migrations/20260919150000_pm33_p03_obtener_contexto_operativo_aislamiento.sql`
en la rama del candidato) elimina por completo cualquier lectura sin
acotar: si el contexto no resuelve de forma inequívoca (0 o >1
candidatos), no se lee ningún dato — nunca una excepción para estos
roles (se mantiene "sin regresión para roles no gestionados"), pero
tampoco nunca un registro de otra empresa. Se retira también todo uso de
`LIMIT 1`/`LIMIT 2` para resolver una ambigüedad de identidad: la
resolución usa conteo explícito (0/1/>1), igual que ya hacía el bloque
obligatorio. Se añade la comprobación de empresa/local activos para este
camino, y se acota también por `p_local_id` cuando el llamante lo pasa
explícitamente (antes se ignoraba fuera del bloque obligatorio).

Un efecto colateral **deliberado**, no un descuido: la función ahora
resuelve y devuelve `empresaId`/`localId` también para estos roles cuando
el contexto es deducible sin ambigüedad (antes quedaban siempre `null`).
Esto invalida literalmente la aserción original `T14c` del contrato de
P01 ("empresaId permanece null") — documentado como excepción conocida en
la sección 7.2, no ocultado.

### 7.2 Pruebas ejecutadas para P03 (todas locales, Postgres 16.13 real)

| Batería | Archivo | Resultado |
|---|---|---|
| Contrato original T01-T14 | `tests/pm33/db/p01-aislamiento-multiempresa-contract.mjs` | **37/38 PASS.** Único fallo: `T14c` ("empresaId permanece null"), superseded por diseño (ver 7.1) — P03 ahora sí devuelve `empresaId='emp-A'` para ese usuario porque su contexto SÍ es deducible sin ambigüedad. No es una regresión de aislamiento: la propia `T14g`/`T16e` confirman que el valor devuelto es el correcto, nunca el de otra empresa. |
| Regresión Camarero/a P01→P02 | `tests/pm33/db/p02-regresion-rol-no-gestionado.mjs` | **7/7 PASS** (sigue sin regresión) |
| Aislamiento específico Camarero/a (nuevo, pedido en esta ronda) | `tests/pm33/db/p03-aislamiento-camarero-contract.mjs` | **17/17 PASS.** Ver detalle abajo. |
| Frontend multilocal | `tests/pm33/p03-frontend-multilocal-contract.mjs` | **4/4 PASS**, ejecutando el propio código parcheado de `fuente.js` en un sandbox `vm`, no por inspección de texto. |
| `node --check fuente.js` | — | PASS |

**Detalle de T16-T20** (fixture `tests/pm33/db/fixtures_p03_extra.sql`),
con ciclo rojo/verde contra P02 sin corregir para demostrar que capturan
el defecto real:

| # | Escenario | P02 (sin corregir) | P03 |
|---|---|---|---|
| T16 | Camarero/a **activo**, membresía única (no el `ea-4` inactivo de T14 — caso funcional legítimo añadido en esta ronda) | PASS | PASS |
| T17 | `empleado_id` **duplicado entre dos empresas**, sin membresía | **FAIL** — devuelve el registro de `emp-A` (podría haber sido el de `emp-B`, según el orden interno de Postgres) | PASS — `empleado: null`, nunca un registro ajeno |
| T18 | Camarero/a con contexto propio pide **explícitamente un local ajeno** (`loc-B`) | **FAIL** — P02 ignoraba `p_local_id` para este camino y devolvía igualmente su propio contexto de `loc-A` | PASS — `empleado: null`, el local ajeno no se autoriza |
| T19 | Única "candidatura" es una **membresía inactiva** | PASS | PASS |
| T20 | Contexto resuelve de forma inequívoca pero a una **empresa/local dados de baja** | **FAIL** — devolvía el registro igualmente, ignorando la baja | PASS — `empleado: null` |

Total combinado P03: **65/66** aserciones (37+7+17+4), con la única
excepción documentada y explicada en 7.1/7.2 (no una regresión de
seguridad).

### 7.3 Migración completa desde el estado real de PROD

Hallazgo crítico de esta ronda: **P02, tal como quedó redactado, omitía
el `drop function if exists public.obtener_contexto_operativo();`** que sí
llevaba P01. Aplicado directamente sobre PROD real (que hoy solo tiene la
sobrecarga de 0 argumentos), `create or replace function
obtener_contexto_operativo(p_local_id text default null)` habría creado
una SEGUNDA sobrecarga sin retirar la primera — y como el único call site
real invoca sin argumentos, Postgres prefiere la coincidencia exacta de
aridad (la versión de 0 argumentos, la defectuosa): **P02 habría sido un
no-op en producción real.**

Verificado contra PROD real el 19/09/2026 (solo lectura): única sobrecarga
existente (0 args), grants `authenticated=EXECUTE` / `anon`, `public` sin
permiso, ninguna otra función/vista/trigger de `public` referencia el
nombre en su cuerpo, `pg_depend` vacío — la migración es autocontenida, no
hace falta tocar ningún otro objeto.

Probado con Postgres real (16.13), **partiendo de la función antigua real**
(no solo de una base vacía como se hizo con P01/P02): se instaló el cuerpo
exacto capturado de PROD (`tests/pm33/db/prod_original_function_20260919.sql`
en la rama del candidato), se ejecutó el script completo de migración
(`docs/plan-maestro/PM33_P03_MIGRACION_DESDE_PROD.sql`: preflight, apply
transaccional, postflight) y se comprobó:

- **Postflight de sobrecargas**: tras migrar, queda EXACTAMENTE una
  (`obtener_contexto_operativo(text)`, `pronargs=1`) — la de 0 argumentos
  ha desaparecido por completo, no solo está "tapada".
- **Postflight funcional**: una llamada real sin argumentos (el único call
  site real) para un usuario de prueba conocido devuelve el resultado
  **acotado** del cuerpo nuevo (`localId`, `proveedores` limitados a su
  empresa), confirmando que no queda ejecutándose la versión vieja.
- **Rollback probado**: restaurar el cuerpo original + `drop function
  ...(text)` devuelve el estado exactamente a una sobrecarga de 0
  argumentos, con el comportamiento original (sin `localId` en la
  respuesta) verificado funcionalmente, no solo por la firma.

### 7.4 Rama de integración desde `release` real (no desde `main`)

La rama de trabajo de esta revisión (`claude/proyecto-a-la-suite-cierre-3xs7l3`)
parte de `main`, que no contiene los 137 commits exclusivos de `release`.
El candidato P03 (SQL + frontend) se preparó en una rama nueva,
**`claude/pm33-p03-obtener-contexto-operativo`**, creada desde
`origin/release` (`git checkout -b ... origin/release`), no desde `main`.
Un solo commit por delante de `release`, sin conflicto. La rama original
`claude/pm33-fix-obtener-contexto-operativo` (P01) queda intacta, sin
tocar.

### 7.5 Frontend: compatibilidad multilocal (rama del candidato, no publicado)

Cambios en `fuente.js` (mismo commit `e7491d5`, rama del candidato):

1. `obtenerContexto()` ahora pide `p_local_id` cuando se conoce el local
   activo del dispositivo. Reutiliza el estado `localActivoId` ya
   existente en el componente principal (el mismo que usa
   `SelectorLocalInformes`/`cambiarLocalActivo`) mediante un `useEffect`
   que publica `window.__localActivoIdParaContexto` y fuerza una recarga
   del contexto operativo cada vez que cambia — no se introduce ningún
   selector nuevo.
2. Un cambio de local invalida SIEMPRE la caché en memoria, aunque el TTL
   (30s) no haya vencido: nunca se sirve el contexto resuelto para el
   local anterior mientras se resuelve el nuevo.
3. Un **rechazo explícito del servidor** (`respuesta.error` — contexto no
   autorizado, ambiguo, local inactivo) limpia por completo la caché, en
   memoria y en disco (`localStorage`), y devuelve `null` — **antes**
   (código vigente en `release` hoy) un rechazo caía silenciosamente al
   respaldo en disco (`leerContextoLocal`), pudiendo servir datos
   desactualizados o de otro contexto. Un fallo de **red** (no una
   respuesta del servidor) sigue cayendo al respaldo en disco, pero éste
   ahora queda vinculado al `local_id` con el que se guardó: nunca se
   sirve el respaldo de un local distinto al que se está pidiendo.
4. Validado ejecutando el propio bloque de código parcheado de `fuente.js`
   en un sandbox `vm` de Node (`tests/pm33/p03-frontend-multilocal-contract.mjs`),
   simulando `window`/`localStorage`/`supabase.rpc`, no por inspección de
   texto: 4/4 escenarios (`p_local_id` enviado, rechazo no reutiliza
   datos, cambio de local invalida la caché en memoria, el respaldo en
   disco no mezcla locales).
5. `node --check fuente.js`: PASS.

**No publicado a `release`** — vive únicamente en la rama del candidato.
Publicarlo requiere autorización explícita para esa operación concreta.
`source-recovery/fuente-recuperado.js` (el artefacto de reconstrucción,
ya señalado como desactualizado en el Punto 4 del documento maestro) NO
se ha tocado en este parche; si se retoma la reconstrucción del release,
este cambio de frontend tendrá que incorporarse ahí también.

### 7.6 Lo que sigue sin validar (gaps explícitos, sin cambios respecto de P02)

- **PostgreSQL 17 real**: sigue sin poderse probar en este entorno de
  trabajo (sin Docker operativo ni paquete `postgresql-17` disponible).
  Propuesta concreta para cerrarlo en QA: `PROPUESTA_VALIDACION_QA.md`
  (pendiente de autorización, no ejecutada).
- **Auth/PostgREST reales**: la prueba SQL sigue usando el stub de
  `auth.uid()`; la prueba de frontend simula `supabase.rpc` en vez de usar
  un cliente real. Misma propuesta de QA lo cierra.
- **No aplicado a ningún entorno real** (ni QA ni PROD).

## 8. Próximo paso concreto (vigente)

1. Autorización para ejecutar el **preflight** (solo lectura) de
   `PM33_P03_MIGRACION_DESDE_PROD.sql` contra QA — confirma que el estado
   real de QA coincide con lo asumido antes de aplicar nada.
2. Con eso en verde, ejecutar la propuesta de `PROPUESTA_VALIDACION_QA.md`:
   usuarios de prueba reales vía Supabase Auth Admin, datos de prueba
   prefijados y retirables en `public`, batería completa (66 aserciones)
   vía `supabase-js` real contra PostgreSQL 17.6.
3. Decisión del propietario sobre publicar el cambio de frontend a
   `release` (independiente de aplicar el SQL — el SQL solo, sin el
   cambio de frontend, ya cierra R10 para el caso de uso real actual de
   un único local por dispositivo; el cambio de frontend es necesario
   únicamente para el caso multilocal, que hoy no tiene usuarios reales
   en PROD).
4. Solo tras (2) en verde y (3) decidido, autorización explícita para
   aplicar a PROD.
