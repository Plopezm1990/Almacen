# PM33 — Revisión de cierre: P01 → P02 → P03 → P04 → P05

Estado: **Fase A aplicada y verificada en PROD (`flqercbgpgmmfaakrwkc`): la migración P05 está aplicada (versión real `20260919225831`), postflight en verde. Candidato final re-validado: `claude/pm33-promocion-final` @ `6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d`, gate `run 35474922732` SUCCESS. Fase B (mover `release`, publicar Netlify) PENDIENTE de autorización separada. NO cerrado.** Candidato P05 (SQL + frontend) validado contra Postgres real localmente (16.13, 81/81 aserciones), contra un entorno aislado equivalente al modelo actual de PROD con **PostgreSQL 17.6.1.167 + Auth (GoTrue v2.196.0) + PostgREST (v16.2) reales** (`run 35465771875`, commit `d6ed496`, SUCCESS), sobre el candidato final limpio creado desde `release` vigente sin las migraciones intermedias P03/P04 en su historia (`run 35473168918`, commit `21ce7fa`, SUCCESS), y de nuevo tras renombrar la migración a su versión real registrada por PROD (`run 35474922732`, commit `6e26391`, **SUCCESS**). Ver sección 13 para la primera validación real, sección 15 para el candidato final limpio, sección 17 para el hallazgo crítico de la matriz de migraciones (34 locales vs. 36 en PROD, 0 en común) y el mecanismo corregido, sección 19 para la fase A completa (preflight, aplicación, postflight, versión registrada), y sección 20 para el estado vigente. QA (`qjqorixtkilwsndqayyx`) se conserva intacto, sin tocar. Propuesta de promoción concreta en `cierre-proyecto-a/pm33/PROPUESTA_PROMOCION.md` -- pendiente de autorización separada del propietario para (B) mover `release` (dispara Netlify automáticamente).

Este documento cubre las cinco iteraciones en orden: **P02** (secciones
1-6), **P03** (sección 7-8, segunda ronda), **P04** (sección 9 en
adelante, tercera ronda, sobre una revisión independiente de P03),
**P05** (sección 11 en adelante, cuarta ronda, sobre una revisión
independiente de P04, commit `5dfdbca`), y la **validación aislada real**
(secciones 13-14, sobre commits `9523131`→`d6ed496`). Nada de lo descrito
en las secciones 1-12 quedó aplicado a ningún entorno real; P05 sustituye
a P04 por completo como candidato vigente, y las correcciones de 13.1
sustituyen al entorno aislado tal como quedó preparado en la sección 11.

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

## 8. Próximo paso concreto (histórico, sustituido por la sección 10)

Esta sección describía el plan cuando P03 era el candidato vigente. Antes
de solicitar autorización se pidió una tercera ronda de revisión
independiente, que encontró dos defectos de identidad/autorización más
(sección 9.1-9.2), una condición de carrera en el frontend (9.3), y un
hallazgo que cambia el propio plan de validación en QA (9.5). Ver sección
10 para el plan vigente.

---

## 9. P04 — tercera ronda: revisión independiente sobre P03

Candidato: rama **`claude/pm33-p03-obtener-contexto-operativo`** (la
misma rama que P03; P04 es un commit adicional sobre ella, no una rama
nueva), commit **`5dfdbca909f7f33873e1c54fb61eda0085c994e6`**. Sigue
siendo un único frente por delante de `release`, ahora dos commits
(P03 + P04), sin conflicto.

### 9.1 Defecto: el parámetro del cliente no demuestra autorización

Reproducido con Postgres real: `camareroColision` (empleado_id `dup-9`,
**sin ninguna membresía**, `dup-9` existe en `emp-A/loc-A` y en
`emp-B/loc-B`) obtenía el contexto de `emp-A` pidiendo `p_local_id='loc-A'`
y el de `emp-B` pidiendo `'loc-B'` — el servidor solo comprobaba "¿existe
una coincidencia de este id EN el local pedido?", nunca "¿este id
pertenece de forma inequívoca a ese local?". Cualquiera que conociera (o
adivinara) el `local_id` de otra empresa donde su propio `empleado_id`
colisionara podía obtener sus datos con solo pedirlo. **Afectaba también
al bloque obligatorio** (Encargado/Cajero/a/Churrero/a), no solo a
Camarero/a — conservar ese bloque sin cambios en P02/P03 no lo hacía
seguro, tenía el mismo patrón desde P01.

**Corrección**: la fuente (b) (el propio `empleado_id` en `almacen_kv`)
se resuelve **una sola vez, a nivel global**, contando cuántos pares
`(empresa_id, local_id)` distintos tiene ese id en todo `almacen_kv` —
sin filtrar por el local pedido. Si no es exactamente uno, la fuente (b)
queda inutilizable para **cualquier** local explícito, no solo para el
que resultó ambiguo. Si es exactamente uno, un `p_local_id` explícito
solo se acepta si **coincide** con ese único par.

### 9.2 Defecto: una membresía revocada no bloqueaba la vía heredada

Reproducido: `camareroActivo` (membresía `id=20`, `emp-A/loc-A`) seguía
obteniendo su contexto tras `update membresias_usuario set activo=false
where id=20`, porque su `empleado_id` seguía existiendo, sin cambios, en
`almacen_kv` — la vía heredada nunca comprobaba si había una baja
explícita.

**Corrección**: antes de aceptar la fuente (b) para un par resuelto, se
comprueba si existe una membresía de ese mismo usuario, para esa misma
empresa (con ese local o con `todos_locales`), marcada **explícitamente**
`activo = false`. Si existe, la vía heredada queda bloqueada para ese
par. Si no existe **ninguna** fila de membresía (nunca se migró al
modelo de membresías — el caso real de Cajero/a y Churrero/a en
producción hoy), la vía heredada sigue funcionando exactamente igual:
esto no exige tener membresía, solo impide que una baja explícita se
elude por una vía más antigua. Verificado con pruebas dedicadas que los
usuarios heredados **legítimos** (sin ninguna membresía) no se ven
afectados.

### 9.3 Pruebas para 9.1/9.2 (Postgres 16.13 real, ciclo rojo/verde contra P03)

`tests/pm33/db/p04-identidad-y-revocacion-contract.mjs` /
`p04-identidad-y-revocacion-contract.mjs` en este directorio:

| # | Escenario | P03 (sin corregir) | P04 |
|---|---|---|---|
| D1a | Camarero/a, id duplicado, pide `loc-A` y `loc-B` explícitos | **FAIL** — devuelve el empleado de la empresa pedida, cualquiera | PASS — `empleado: null` en ambos casos |
| D1b | Cajero/a (bloque obligatorio), mismo patrón | **FAIL** — no rechazaba | PASS — rechazado con "Contexto no autorizado" en ambos |
| D1c | Cajero/a con membresía válida SOLO en A, pide B explícito | ya pasaba (control) | PASS |
| D2a | Camarero/a, membresía revocada, `empleado_id` sigue en `almacen_kv` | **FAIL** — devolvía el empleado igualmente | PASS — `empleado: null` |
| D2b | Cajero/a (bloque obligatorio), mismo patrón | **FAIL** — no rechazaba | PASS — rechazado |
| Control | Heredados legítimos (sin ninguna membresía) y activos (membresía intacta) | PASS | PASS (sin cambios) |

Total: **12/12 PASS** contra P04; **6/12 FAIL** contra P03 sin corregir
(confirmado ejecutando la misma batería contra el commit `e7491d5` antes
de escribir el parche).

### 9.4 Condición de carrera en el frontend (`fuente.js`)

Reportado: dos peticiones pendientes de `obtenerContexto()` para el mismo
usuario/local — la segunda resuelve primero con un rechazo de
autorización; la primera resuelve **después** con éxito. El diseño de
P03 no tenía ninguna noción de "petición vigente": el éxito tardío de la
primera sobrescribía la caché que la segunda (más reciente) ya había
limpiado, y una lectura posterior (`window.storage.get('empleados')`)
devolvía esos datos obsoletos sin una nueva llamada a la RPC.

**Corrección**: contador de generación (`contextoGeneracion`). Cada
invocación de `obtenerContexto()` que llega a necesitar red o disco
queda marcada como la vigente en el momento en que empieza (no en el que
termina); cualquier respuesta — éxito, rechazo, o fallo de red — que
resuelva después de que otra invocación más reciente haya tomado el
relevo se descarta sin tocar la caché ni devolverse al consumidor. Cubre
también cambios de local (ya invalidaban la caché desde P03, ahora
además invalidan la generación) y de sesión (sin usuario ⇒ nueva
generación).

Validado ejecutando el propio código parcheado (`tests/pm33/p03-frontend-multilocal-contract.mjs`,
escenario 5) en un sandbox `vm`: **reproducido el fallo contra el
`fuente.js` de P03** (commit `e7491d5`) con una prueba controlable
(promesas diferidas para fijar el orden de resolución exacto que
describe el informe) — el resultado tardío se filtraba tal como se
reportó — y **confirmado en verde contra el `fuente.js` de P04**.

### 9.5 Hallazgo nuevo: QA no es hoy un entorno válido para validar este candidato

Se pidió explícitamente no asumir que la definición/permisos de QA
coinciden con los de PROD antes de preparar una reversión específica.
Ejecuté el preflight de solo lectura contra `qjqorixtkilwsndqayyx` el
19/09/2026 (autorizado: lecturas remotas dentro del alcance existente) y
**no coinciden — la diferencia es de diseño, no de detalle**:

`obtener_contexto_operativo()` en QA es una **reimplementación completa**
sobre tablas relacionales (`public.empleados`, `public.locales`),
autorización **exclusivamente** vía `membresias_usuario` (sin ninguna vía
heredada por `almacen_kv`), forma de respuesta distinta (`ok`,
`todosLocales`, `empresas`, `locales`, `modulos`) y códigos de error con
nombre en vez de `errcode 42501`. El detalle completo, con la definición
íntegra capturada, está en `qa/README.md` y `qa/00_preflight.sql`.

**Consecuencia**: aplicar el candidato PM33 (diseñado para el modelo real
de PROD, `almacen_kv`) sobre QA no sería una validación neutral —
**sustituiría una implementación de QA ya migrada y más estricta por una
más antigua**. Preparé el preflight como una puerta de seguridad real
(`DO` block que compara la definición contra lo que el candidato asume y
**aborta con `RAISE EXCEPTION`** si no coincide, no solo un aviso en un
documento) y lo probé tanto en el caso que debe pasar como en el que debe
abortar antes de ejecutarlo contra QA de verdad.

> **Corrección explícita (ronda P05, ver sección 11.3)**: la frase que
> seguía aquí ("abortó, correctamente, contra QA") era **incorrecta por
> partida doble** y se retira. Primero, ese preflight (v1, con la
> condición `usa_empleados_relacional AND NOT usa_almacen_kv`) **nunca se
> ejecutó de verdad** en esta ronda contra QA — el razonamiento de arriba
> se hizo a mano, sobre consultas de introspección sueltas, no sobre el
> resultado de correr el script. Segundo, esa misma condición tenía un
> punto ciego que la revisión independiente de la ronda P05 encontró y
> reprodujo: QA es en realidad un modelo **híbrido** (usa `almacen_kv`
> para el catálogo de `'locales'` Y `public.empleados` relacional para el
> resto), así que `true AND NOT true = false` — el aborto no se habría
> disparado ni ejecutándolo. El preflight se corrigió (hash md5 exacto,
> ver 11.3) y **esa versión sí se ejecutó de verdad** contra QA, con el
> hash real de QA en el mensaje de error — la evidencia genuina está en
> 11.3, no aquí.

Esto es la confirmación concreta, sobre esta función exacta, de la deuda
de trazabilidad de migraciones ya registrada en el Punto 5 del documento
maestro (QA tiene 27 migraciones que no existen en PROD). **Decisión
pendiente del propietario**, no tomada aquí: si el modelo relacional de
QA es el diseño futuro (y este candidato PM33 debería apuntar ahí en vez
de a `almacen_kv`), o si hace falta primero un entorno espejo de PROD
para validar este candidato sin tocar la implementación ya migrada de
QA — ver `qa/README.md` para el detalle de ambas opciones.

### 9.6 Kit de QA: implementado y versionado, no solo descrito

`cierre-proyecto-a/pm33/qa/`: `00_preflight.sql` (ejecutado de verdad),
`01_crear_usuarios_prueba.mjs` (Auth Admin API, usuarios desechables reales
por escenario), `02_cargar_datos_prueba.mjs` (datos de prueba prefijados
`qa-pm33-`, vinculados a los UIDs reales creados en `01`, vía conexión
directa), `03_ejecutar_bateria.mjs` (login real por usuario vía
`signInWithPassword` + `supabase-js`, sin `pg` directo ni `set_config` —
cierra de verdad el gap de Auth/PostgREST reales cuando haya un entorno
válido), `04_limpiar.mjs` (retira filas y usuarios, en ese orden). Ninguno
de `01`-`04` se ha ejecutado — el hallazgo de 9.5 los bloquea para
`qjqorixtkilwsndqayyx` tal como está hoy, y así lo señala el propio
preflight al ejecutarse.

## 10. Próximo paso concreto (histórico, sustituido por la sección 12)

1. **Decisión del propietario** sobre el hallazgo 9.5: ¿el modelo
   relacional de QA es el diseño futuro para esta función, o hace falta
   un entorno espejo de PROD (`almacen_kv`) para validar este candidato?
   Nada de lo siguiente tiene sentido sin esta decisión.
2. Según lo decidido: identificar/preparar el entorno correcto (posible
   candidato ya existente: `ytavvyusrmwandchjyei`, L&A Suite P2-R03
   validation, hoy `INACTIVE` — reactivar un proyecto pausado tiene coste
   real y requiere autorización explícita; comprobar primero, con un
   preflight igual que el de QA, que su función coincide con el modelo de
   PROD antes de asumir que sirve).
3. Con el entorno correcto identificado y su preflight en verde, ejecutar
   `qa/01`-`04` en ese orden (usuarios de prueba reales, datos prefijados,
   batería vía Auth/PostgREST real, limpieza).
4. Decisión del propietario sobre publicar el cambio de frontend a
   `release` (el SQL solo ya cierra R10 para el caso de un único local
   por dispositivo, el caso real hoy).
5. Solo tras (3) en verde y (4) decidido, autorización explícita para
   aplicar a PROD.

## 11. P05 — cuarta ronda: revisión independiente sobre P04 (commit `5dfdbca`)

Decisión del propietario que enmarca esta ronda: preparar la validación
de PM33 en un **entorno aislado equivalente al modelo actual de PROD**
(`almacen_kv`), conservando QA existente y su implementación intactos.
Esto no decide el modelo futuro ni incorpora P2 al cierre de PM33. Sobre
esa base, la revisión independiente reprodujo cinco hallazgos contra
`5dfdbca`; los cinco están corregidos y verificados en el candidato
vigente (rama `claude/pm33-p03-obtener-contexto-operativo`, commit
`de613dc`, dos commits por delante del de P05 puro `8dbef85`: el primero
ya en `8dbef85` corrige 11.1/11.2, el segundo — `de613dc` — añade el
entorno aislado de 11.5, sin tocar SQL/frontend).

### 11.1 Identidad duplicada con estados diferentes (activo filtrado antes de resolver identidad)

**Reproducido** antes de corregir: perfil Cajero/a, membresía única en
emp-A/loc-A, `empleado_id` `dup-9` existente en `almacen_kv` de emp-A
(marcado `activo:false`) y de emp-B (marcado `activo:true`). P04 contaba
los candidatos de la fuente heredada **filtrando por `activo=true`
primero** — con un único registro activo visible (el de B), la colisión
real quedaba oculta y la llamada con `p_local_id='loc-B'` devolvía datos
de B, sin membresía ni pertenencia real ahí.

**Corrección (SQL)**: la identidad se resuelve primero, a nivel global,
**sin** filtrar por `activo` — se cuentan los `(empresa_id, local_id)`
distintos en los que existe ese `empleado_id`. Solo si ese conteo es
exactamente 1 se examina el `activo` del único candidato resuelto; una
coincidencia activa en otra empresa nunca demuestra pertenencia y nunca
participa en el conteo de unicidad. Aplicado a los tres roles del bloque
obligatorio (Encargado, Cajero/a, Churrero/a) y al bloque de Camarero/a
por igual — ver el comentario "DEFECTO... IDENTIDAD PRIMERO, ACTIVIDAD
DESPUÉS" en `supabase/migrations/20260919170000_pm33_p05_identidad_antes_de_actividad.sql`.

**Pruebas**: `tests/pm33/db/fixtures_p05_extra.sql` (nuevo) añade tres
fixtures de colisión activo/inactivo, una por cada rol del bloque
obligatorio (`dup-501` Cajero/a, `dup-502` Encargado, `dup-503`
Churrero/a), cada una con membresía únicamente en A.
`tests/pm33/db/p05-identidad-antes-de-actividad-contract.mjs` (nuevo):
para cada rol, pedir `loc-B` debe quedar rechazado ("Contexto no
autorizado") y pedir el propio `loc-A` debe seguir resolviendo vía
membresía. **3 de 6 aserciones fallan contra P04** (`5dfdbca`) antes de
la corrección; **6/6 pasan contra P05**. Los usuarios heredados
legítimos (sin colisión) siguen verificados por las pruebas ya
existentes de P03/P04 (`camarero-heredado-legitimo` y equivalentes) —
sin regresión.

### 11.2 Concurrencia y caché (frontend)

Dos defectos distintos, ambos en `resolverContexto`/`obtenerContexto` de
`fuente.js`:

**11.2.a — filtración de identidad cruzada al descartar una respuesta
obsoleta.** P04 introdujo el contador de generación, pero la rama
`if (!siguesVigente()) return contextoCache;` devolvía la caché **sin
comprobar a qué usuario/local pertenecía esa caché en ese momento** —
una petición A pendiente para `loc-A`, un cambio de usuario/local a B
mid-flight, y un éxito de B, dejaban que la llegada tardía de A
devolviera el contexto de B. **Reproducido** contra P04 con promesas
diferidas controladas (orden de resolución exacto fijado por la prueba)
antes de corregir. **Corrección**: nueva función
`contextoObsoletoSalvoQueCoincida(userId, localIdSolicitado)` — solo
devuelve `contextoCache` si `contextoUsuarioId`/`contextoLocalIdUsado`
coinciden con la invocación que pregunta; si no, `null`. Aplicada en los
tres puntos donde antes se devolvía `contextoCache` a ciegas (tras el
`await` a la RPC, en el `catch`, y tras el `await` a la sesión).

**11.2.b — falsos vacíos por concurrencia normal.** Un diseño de
generación "pura" (bump en cada intento nuevo, incluso dos peticiones
casi simultáneas para el **mismo** local/usuario) descartaba la primera
de dos peticiones idénticas por tener una generación menor, aunque fuera
igual de correcta. **Reproducido**: dos `storage.get('empleados')`
simultáneos del mismo usuario/local, sin caché inicial, con ambas RPC
correctas — la primera terminaba vacía si la segunda seguía pendiente.
**Corrección**: coalescencia de peticiones equivalentes resuelta de
forma **100% síncrona** (antes de cualquier `await`), usando
`localIdActualParaContexto()` (ya síncrona) como única clave — explota
que dos llamadas síncronas consecutivas en JS ejecutan su prefijo
síncrono en orden estricto sin intercalado, así que dos peticiones para
el mismo local comparten la misma promesa en vuelo en vez de generar dos
intentos que compitan por generación.

Un intento anterior de corregir 11.2.b introdujo un tercer defecto
**propio de esta misma ronda de pruebas, no del código de producción**:
una comprobación de "obsoleto" colocada justo después de resolver la
sesión (antes de la llamada RPC) cortocircuitaba la primera de dos
llamadas forzadas síncronas consecutivas (el patrón que ya usaba el
escenario 5 existente) antes de que esa primera llamada hiciera su
propia petición RPC — desincronizando el contador de llamadas del mock y
provocando un deadlock (la segunda llamada recibía la promesa nunca
resuelta de la primera). Diagnosticado por bisección con marcadores y
reproducciones mínimas; corregido retirando esa comprobación prematura,
que nunca fue pedida por el propietario y no forma parte del contrato:
la comprobación de vigencia sigue solo en los tres puntos originales.

**Pruebas**: `tests/pm33/p03-frontend-multilocal-contract.mjs`, dos
escenarios nuevos (6 y 7). Escenario 6: A pendiente (promesa diferida
controlada) para `loc-A`, cambio de local a `loc-B` mid-flight, recarga
forzada de B resuelve con éxito, la llegada tardía de A se descarta
(`resultadoA === null`) y una lectura posterior de B **no** dispara una
nueva RPC (caché de B intacta, sin contaminar). Escenario 7: dos
`sb.window.storage.get('empleados')` simultáneos vía `Promise.all`,
mismo usuario/local, sin caché inicial, ambas RPC correctas — ninguna de
las dos respuestas queda vacía. Las 7 escenarios del archivo, ejecutados
5 veces consecutivas completas: en verde de forma determinista (no por
suerte de temporización).

### 11.3 Preflight — comprobación de compatibilidad frágil

El preflight v1 (heurística `usa_empleados_relacional AND NOT
usa_almacen_kv`) tenía el mismo punto ciego que debía detectar: QA es un
modelo **híbrido** (usa `almacen_kv` para el catálogo de `'locales'` Y
`public.empleados` relacional para el resto), así que esa condición
nunca se dispara contra QA. Además, la afirmación de la sección 9.5
("abortó, correctamente, contra QA") era incorrecta por partida doble —
corregida explícitamente ahí mismo, no aquí: el script v1 nunca se había
ejecutado de verdad en la ronda P04, y el razonamiento manual que lo
sustituyó compartía el mismo punto ciego.

**Corrección**: `cierre-proyecto-a/pm33/qa/00_preflight.sql` ya no usa
heurísticas de texto. Compara el **hash md5 exacto** de
`pg_get_functiondef()` de la definición vigente contra una lista corta
de hashes conocidos y compatibles (hoy, únicamente
`40d7bf2ea50776b7eb40a3fff239c0b4`, el de la función real de PROD,
capturado el 19/09/2026). Cualquier definición que no coincida
exactamente aborta — cubre también, sin heurísticas adicionales, "no
existe la función" y "hay más de una sobrecarga".

**Ejecutado de verdad** (esta vez sí, vía la herramienta de ejecución
SQL, contra `qjqorixtkilwsndqayyx`) el 19/09/2026: abortó, con el hash
real de QA (`3064430c63c97f6c50e05ff0117da862`, distinto del de PROD) en
el propio mensaje de error — salida literal del error:
`PREFLIGHT ABORTADO: la definición vigente (hash 3064430c63c97f6c50e05ff0117da862) no coincide con ninguna definicion conocida y compatible.`
La definición completa de QA, capturada en esa misma ejecución, se
conserva en `qa/99_rollback_especifico_de_qa_20260919.sql` — documentada
como específica de QA, nunca como reversión válida para PROD.

### 11.4 Kit de QA — bug de doble escritura en la clave `almacen_kv`

`02_cargar_datos_prueba.mjs` escribía la fila `almacen_kv` de (emp-A,
loc-A, `'empleados'`) **dos veces por separado** — una con
`[dup-9, ea6]`, otra después con `[dup2]` (el heredado legítimo) — y el
segundo `INSERT ... ON CONFLICT DO UPDATE SET value = excluded.value`
**reemplazaba el array completo**, perdiendo `dup-9` y `ea6`.

**Corrección**: cada fila de `almacen_kv` se construye **completa en
memoria** antes de un único `INSERT` por fila — nunca dos escrituras a
la misma clave. Añadidos además, sobre el mismo kit: `_entorno.mjs`
(exige que `SUPABASE_PROJECT_URL` y `SUPABASE_DB_URL` apunten al mismo
proyecto antes de que `02`/`03`/`04` hagan nada), `_manifest.mjs` +
`RUN_ID` por ejecución (registra exactamente qué crea `01`/`02` según se
va creando, no al final), verificación **post-carga** explícita en `02`
(contenido real de las filas de `almacen_kv`, conteo de
perfiles/membresías) antes de marcar el manifest como `confirmado`, y
`04_limpiar.mjs` reescrito para borrar **exactamente** los objetos del
manifest (nunca por prefijo) — si algo falla, el manifest se conserva
con `fallo_parcial` en vez de borrarse. Detalle completo en
`cierre-proyecto-a/pm33/qa/README.md`.

### 11.5 Entorno aislado equivalente al modelo actual de PROD

Preparado, **no ejecutado** en esta sesión (Docker no disponible en este
sandbox, CLI de `supabase` no instalado aquí). Replica el patrón ya
existente y probado en este repositorio para PM12
(`tests/pm12/supabase-full/` + `pm12-p08-produccion-segura.yml`):
PostgreSQL 17 + Auth (GoTrue) + PostgREST reales y desechables vía
Supabase CLI sobre un runner de GitHub Actions.

- `tests/pm33/supabase-full/` (rama del candidato): esquema
  representativo (mismo subconjunto que `tests/pm33/db/fixtures.sql`,
  pero con Auth real en vez de un stub de `auth.uid()`), copia literal
  del candidato P05, y `p05-auth-postgrest-contract.mjs` — usuarios
  reales vía Auth Admin API, JWT real, RPC real vía PostgREST. Incluye
  explícitamente el escenario de 11.1 (identidad duplicada con estados
  distintos) validado esta vez con JWT y PostgREST reales, no con el
  stub de `set_config`.
- `.github/workflows/pm33-p05-entorno-aislado.yml`: inicialmente solo
  `workflow_dispatch` — **corregido después**: `workflow_dispatch` por sí
  solo no basta mientras el archivo del workflow solo exista en la rama
  candidata (GitHub exige que esté registrado, lo que en la práctica pide
  la rama por defecto o una ejecución previa por otro evento). Se añadió
  `push` restringido EXCLUSIVAMENTE al nombre exacto de esta rama
  candidata (nunca un comodín) — ver sección 13.
- `docs/plan-maestro/PM33_ENTORNO_AISLADO.md`: documenta esta opción
  como la recomendada (coste cero, ningún proyecto remoto tocado) y las
  dos alternativas con Supabase Cloud (reactivar
  `ytavvyusrmwandchjyei`, o un branch nuevo de Supabase) con
  destino/coste real consultado (0 USD/mes recurrente para un proyecto
  nuevo en esta organización; 0.01344 USD/hora para un branch) y
  operación concreta — ninguna ejecutada, ninguna autorizada.

**Ejecutado de verdad — ver sección 13**: la ejecución real contra
PostgreSQL 17 + Auth + PostgREST genuinos ya se hizo (dos rondas: una con
un fallo real corregido, y la definitiva en verde). Esta sección se deja
sin reescribir más allá de esta nota para conservar el registro histórico
de lo que se preparó en esta ronda; el resultado real está en la 13.

## 12. Próximo paso concreto (histórico, sustituido por la sección 14)

1. **Activar** `pm33-p05-entorno-aislado.yml` (`workflow_dispatch`
   manual, supervisado) para la primera ejecución real contra
   PostgreSQL 17 + Auth + PostgREST genuinos — ver 11.5. Nada de lo
   validado hasta ahora sustituye a esto; es el único paso que faltaba
   para que "validado" deje de significar solo "validado localmente".
2. Con esa ejecución en verde: decisión del propietario sobre publicar
   el cambio de frontend a `release` (el SQL solo ya cierra R10 para el
   caso de un único local por dispositivo, el caso real hoy).
3. Solo tras (1) en verde y (2) decidido, autorización explícita y
   específica para aplicar a PROD — nunca implícita por haber preparado
   el candidato.
4. Decisión pendiente, separada y no bloqueante para el cierre de PM33:
   si el modelo relacional de QA es el diseño futuro de esta función
   (fuera del alcance actual, ver 9.5).

## 13. Ejecución real contra PostgreSQL 17 + Auth + PostgREST genuinos (dos rondas)

### 13.1 Primera ejecución real — `run 35460961139`, commit `9523131`: FAILURE (14 PASS / 1 FAIL)

Activado el workflow (corregido primero para disparar por `push`
restringido a esta rama exacta, ver 11.5). El único fallo: la prueba de
"sin autenticar" exigía el mensaje `"No autenticado"`. Ese mensaje solo
se emite **dentro** del cuerpo de la función — una llamada con la clave
`anon` nunca llega a ejecutarlo, porque el candidato ya revoca `EXECUTE`
de `anon`/`public` de forma explícita (`revoke all on function ... from
public, anon;`, en la propia migración) y Postgres rechaza la llamada a
nivel de permiso, **antes** de invocar la función. Corregida la prueba,
no el candidato — no se concedió `EXECUTE` a `anon` ni `PUBLIC` para
hacerla pasar.

De paso, esta ronda también encontró y corrigió, sobre el mismo commit:

- **`SOURCE_RECOVERY_DRIFT`**: `source-recovery/fuente-recuperado.js` no
  se había sincronizado en NINGUNA ronda de PM33 (P01-P05) — pasaba en
  `release` (con su propio `fuente-recuperado.js` de verdad sincronizado
  en `f313bc0`) y fallaba en esta rama candidata desde que P03 empezó a
  tocar `fuente.js`. Corregido con el procedimiento ya existente
  (`python3 source-recovery/recuperar_candidato.py --sync-current`,
  anclado al mismo baseline de paridad exacta certificada que ya usaba el
  proyecto, `bd0dc4a`). El cambio de contenido real son las +13 líneas
  netas que P03-P05 añadieron sobre el `fuente.js` de `release`
  (contador de generación, seguimiento síncrono de sesión, invalidación
  por cambio de sesión) — `fuente.js` en sí no cambió por esta
  corrección.
- Instalación reproducible: generado y versionado
  `tests/pm33/supabase-full/package-lock.json` (antes ausente).
  Comprobado que `npm ci --prefix tests/pm33/supabase-full --no-audit
  --no-fund` (el comando exacto del workflow) funciona desde una copia
  limpia, instalando el CLI de `supabase` 2.117.0 de verdad.
- Activación: `workflow_dispatch` por sí solo no basta mientras el
  archivo del workflow solo exista en la rama candidata. Añadido `push`
  restringido EXCLUSIVAMENTE al nombre exacto de esta rama (nunca un
  comodín).
- Pruebas de autorización reforzadas: los rechazos ya no se aceptan como
  "cualquier respuesta no-ok" (un HTTP 500 de infraestructura contaba
  antes como aislamiento correcto). Nuevo helper que exige explícitamente
  que nunca sea un 500, que sea un 4xx real, y el código de error EXACTO
  (`42501`, insufficient_privilege) en el cuerpo.
- Añadidos como pasos propios del workflow, antes de levantar el stack
  de Supabase: las 9 pruebas de frontend (sandbox `vm` real de
  `fuente.js`) y la comprobación de paridad de `source-recovery`.
  Ampliados los filtros de `paths` del `push` para que `fuente.js`, el
  test de frontend, y `source-recovery/**` también disparen el workflow
  — antes ninguno de los tres lo hacía.

### 13.2 Segunda ejecución real — `run 35465771875`, commit `d6ed496`: **SUCCESS**

Con las correcciones de 13.1 aplicadas, se pusheó de nuevo (reejecutar el
SHA anterior sin cambios habría repetido el mismo fallo) y esta segunda
ejecución terminó en verde por completo:
[`https://github.com/Plopezm1990/Almacen/actions/runs/35465771875`](https://github.com/Plopezm1990/Almacen/actions/runs/35465771875).

Evidencia literal de los logs reales de esa ejecución (no de memoria):

- **Versiones efectivas de los servicios**: PostgreSQL `17.6.1.167`,
  PostgREST `v16.2`, GoTrue (Auth) `v2.196.0`, Kong (API gateway)
  `2.8.1`.
- `MAIN_FROZEN=1`, `RELEASE_ANCESTOR_OK=1` — main y release seguían en
  las SHA congeladas verificadas en vivo por el propio workflow.
- `PM33_P03_FRONTEND_MULTILOCAL_OK=1` — **9/9** escenarios de frontend
  (sandbox `vm` real de `fuente.js`) en verde.
- `SOURCE_RECOVERY_CHECK=PASS`, `PARIDAD_CUERPO_EXACTA=1`,
  `SHA256_CUERPO=c07303adcfe0c6b114fd36d5b77e33c3ef94c854b2431e3659fa3f70984a12d5`
  — paridad `source-recovery` en verde, mismo hash que el cálculo local.
- `PM33_P05_ENTORNO_AISLADO_OK=1`, `TOTAL PASS=15 FAIL=0` — **15/15**
  aserciones reales de Auth JWT + PostgREST + permisos/RLS contra
  PostgreSQL 17 real: el escenario de identidad duplicada pedido
  explícitamente por el propietario (sin p_local_id resuelve por
  membresía; pidiendo `loc-B` explícito rechaza con HTTP 4xx y código
  `42501`; pidiendo su propio `loc-A` sigue resolviendo), el control de
  rechazo sin autenticar (HTTP 401, código `42501`, y `EXECUTE` de `anon`
  comprobado como `false` directamente en la base, no solo inferido del
  HTTP), aislamiento básico Cajero/a A vs B, revocación de membresía
  bloqueando la vía heredada, heredado legítimo sin membresía, y control
  de que las tablas base siguen sin exponerse directamente por
  PostgREST.

**Qué distingue estas pruebas de las locales**: las de
`tests/pm33/db/` (81/81 aserciones citadas en secciones anteriores)
corren contra Postgres real pero con `auth.uid()` **stubeado** vía
`set_config('request.jwt.claim.sub', ...)` — nunca pasan por Auth ni por
PostgREST. Las 15 de esta sección son las primeras de todo PM33
ejecutadas con **JWT real emitido por GoTrue** y **HTTP real a
PostgREST** — incluida la comprobación de que el propio PostgREST, no
solo la función, respeta los permisos (control de acceso directo a
`almacen_kv`, y el rechazo por `EXECUTE` denegado antes de entrar en la
función). Las 9 de frontend siguen siendo sandbox `vm` de `fuente.js`
contra mocks (nunca un navegador real ni Auth real del lado del
cliente) — eso sigue sin cambiar y sigue siendo una limitación explícita.

**Diferencias del esquema de este entorno frente al de PROD real**: el
esquema de `tests/pm33/supabase-full/supabase/migrations/20260919160000_pm33_schema_representativo.sql`
es un subconjunto representativo (mismas 5 tablas de las que depende
`obtener_contexto_operativo`: `perfiles`, `empresas`, `locales`,
`membresias_usuario`, `almacen_kv`), extraído por introspección durante
la auditoría R10 — **no** un volcado completo del esquema de PROD. No
incluye el resto de tablas de la aplicación, ni sus políticas RLS (aquí
se revoca el acceso directo por completo en vez de usar políticas), ni
extensiones, ni triggers que pudieran existir en PROD fuera del alcance
de esta función. Sigue sin comprobarse: migración completa (todas las
tablas), Storage, Edge Functions, ni ningún otro componente de PROD más
allá de esta única función y las tablas de las que depende.

**Pendiente todavía**: ninguna validación adicional bloquea la
promoción del candidato SQL+frontend — ver sección 14 y
`PROPUESTA_PROMOCION.md` para lo que sigue siendo decisión y ejecución
del propietario (aplicar en PROD, publicar en Netlify), no algo que
falte por preparar.

## 14. Próximo paso concreto (histórico, sustituido por la sección 16)

**Estado: PM33 validado para promoción. NO cerrado, NO aplicado, NO
publicado.**

1. Propietario revisa y autoriza, por separado, cada mitad de
   `cierre-proyecto-a/pm33/PROPUESTA_PROMOCION.md`: (a) aplicar la
   migración SQL en PROD, (b) publicar `fuente.js` en Netlify. Ninguna
   autorización implícita por haber preparado o validado el candidato.
2. Si se autoriza (a): preflight de solo lectura sobre PROD (especificado
   en la propuesta, no ejecutado todavía) → aplicar
   `docs/plan-maestro/PM33_P05_MIGRACION_DESDE_PROD.sql` → postflight en
   verde. Nunca publicar el frontend antes de que esto esté en verde
   (ver la propuesta, sección 6, para el porqué exacto).
3. Si se autoriza (b), solo después de (2): publicar `fuente.js` a
   Netlify.
4. Decisión pendiente, separada y no bloqueante para el cierre de PM33:
   si el modelo relacional de QA es el diseño futuro de esta función
   (fuera del alcance actual, ver 9.5).

## 15. Candidato final limpio: rama de promoción, gate de migración única, y mecanismo de aplicación

### 15.1 Por qué se creó una rama nueva

El propietario confirmó, mediante consultas de solo lectura propias
sobre PROD, el punto de partida exacto (función de 0 argumentos, hash
`40d7bf2ea50776b7eb40a3fff239c0b4`, `SECURITY DEFINER`, sin dependencias
externas, `EXECUTE` solo para `authenticated`/`postgres`, ninguna
migración PM33 en el historial) y sobre Netlify (producción en
`release@f313bc0`, deploy recuperable `6aad473513310100099a03a9`,
`manual_deploy=false`). Sobre esa base, señaló que
`claude/pm33-p03-obtener-contexto-operativo` no debía promocionarse
directamente: su **historia de commits** contiene las migraciones
intermedias P03 (`e7491d5`) y P04 (`5dfdbca`), con defectos ya corregidos
en rondas posteriores (bypass de identidad por local explícito,
revocación de membresía eludida, filtrado por `activo` antes de resolver
identidad) — no deben poder formar parte de ninguna cadena capaz de
ejecutar contra PROD.

### 15.2 `claude/pm33-promocion-final`

Creada desde `release` vigente (`f313bc0`) — nunca desde la rama
candidata. Trae, por **contenido exacto** (`git checkout <candidata> --
<rutas>`, no por historia de commits), el resultado ya validado en
`claude/pm33-p03-obtener-contexto-operativo` commit `d6ed496`: `fuente.js`
y `source-recovery/fuente-recuperado.js` (idénticos byte a byte,
confirmado con `diff`), **exactamente una migración**
(`supabase/migrations/20260919170000_pm33_p05_identidad_antes_de_actividad.sql`
— ninguna `150000` ni `160000`), `tests/pm33/` completo, y solo las
versiones P05 de los documentos de migración/entorno aislado. El
workflow de validación aislada se reapuntó al nombre de esta rama.
Confirmado: `git merge-base --is-ancestor origin/release HEAD` — un solo
commit de contenido sobre `release`.

Re-ejecutada la validación aislada sobre el SHA real de esta rama (no se
asumió que "ya se validó antes" bastaba):
[`run 35472854860`](https://github.com/Plopezm1990/Almacen/actions/runs/35472854860)
— SUCCESS, commit `70ccfd5`.

### 15.3 Gate automático de migración única

Añadido un paso propio del workflow, antes de cualquier otra
comprobación, que falla salvo que `supabase/migrations/` contenga
EXACTAMENTE un archivo `*pm33*` y sea
`20260919170000_pm33_p05_identidad_antes_de_actividad.sql`; confirma
además, de forma independiente, la ausencia de archivos con prefijo
`20260919150000` (P03) o `20260919160000` (P04). Ignora deliberadamente
`tests/pm33/supabase-full/supabase/migrations/` (migraciones internas del
entorno de pruebas desechable, nunca desplegables).

Verificado en ambos sentidos antes de commitear: en verde contra el
estado real de la rama; y en rojo copiando temporalmente la migración P03
real dentro de `supabase/migrations/` (detectado de forma independiente
por las dos comprobaciones: conteo=2 en vez de 1, y coincidencia directa
de prefijo) — el archivo de prueba se retiró antes del commit, sin dejar
rastro.

Ejecución real sobre el SHA final, con el gate ya incluido:
[`run 35473168918`](https://github.com/Plopezm1990/Almacen/actions/runs/35473168918)
— **SUCCESS**, commit `21ce7fa` (todos los pasos, incluido el gate,
verificados en el log real del job).

**Rama y SHA final vigentes: `claude/pm33-promocion-final` @
`21ce7fad37dec815fc4568945872fc72a9bf3cd7`.**

### 15.4 Mecanismo exacto de aplicación y reconciliación de versión

Comprobado vía `supabase --help`/`supabase db push --help` (CLI
`2.117.0`, instalado en este sandbox solo para inspeccionar la ayuda, sin
tocar PROD): `supabase db push` registra en
`supabase_migrations.schema_migrations` una `version` igual al prefijo
numérico exacto del nombre de archivo (`20260919170000`) y un `name`
igual al resto del nombre — reconciliación automática con el repositorio,
por construcción. `supabase db push --dry-run` (combinado con
`--linked`/`--project-ref`) es una operación de solo lectura real (no
depende de Docker) que imprimiría exactamente esa migración como la única
pendiente, sin aplicarla.

**Decisión**: usar el CLI (`supabase db push`) para aplicar, no la
herramienta MCP `apply_migration` — esta última solo acepta `name` y
`query`, sin `version` explícito, por lo que generaría una versión propia
a partir del momento de la llamada, desincronizando la tabla de historial
del nombre real del archivo. Si alguna vez hace falta corregir la tabla
de historial, el mecanismo sancionado es `supabase migration repair
[<version>] --status applied|reverted` — nunca SQL manual sobre
`supabase_migrations.schema_migrations`.

El dry-run real con el CLI no se ejecutó en esta ronda: este sandbox no
tiene credenciales de conexión a PROD (ni token de acceso ni contraseña
de base de datos, confirmado revisando las variables de entorno). En su
lugar, ejecuté la comprobación de solo lectura equivalente que sí tenía
autorizada en este mensaje: `list_migrations` vía MCP contra PROD — 36
migraciones registradas, ninguna con prefijo `20260919*`, confirmando lo
mismo que mostraría el dry-run (la migración se aplicaría como nueva, sin
conflicto). El dry-run literal queda especificado, listo para ejecutarse
desde un entorno con esas credenciales, como último paso de solo lectura
antes de aplicar — ver `PROPUESTA_PROMOCION.md` sección 4 para el comando
exacto.

Detalle completo, incluida la operación exacta de aplicación, el
resultado esperado en `list_migrations`, el postflight, y el orden de
rollback (SQL + `migration repair --status reverted`, Netlify antes que
SQL si hay que revertir), en `cierre-proyecto-a/pm33/PROPUESTA_PROMOCION.md`
secciones 4-11.

## 16. Próximo paso concreto (histórico, sustituido por la sección 18)

**Estado: PM33 validado para promoción, sobre el candidato final limpio
`claude/pm33-promocion-final` @ `21ce7fad37dec815fc4568945872fc72a9bf3cd7`.
NO cerrado, NO aplicado, NO publicado.**

1. Propietario revisa `cierre-proyecto-a/pm33/PROPUESTA_PROMOCION.md` y
   concede, por separado:
   - **(A) Autorización para aplicar la migración** — sobre
     `flqercbgpgmmfaakrwkc`, con el mecanismo de la sección 15.4
     (`supabase db push`, tras confirmar el `--dry-run` en verde).
   - **(B) Autorización para mover `release`** — que dispara la
     publicación en Netlify automáticamente (`manual_deploy=false`), solo
     después de que (A) esté aplicada y su postflight en verde.
2. Con (A) autorizada: dry-run (`supabase db push --dry-run --linked`)
   en verde → aplicar (`supabase db push --linked`) → postflight (firma,
   grants, `list_migrations` con la fila nueva) en verde → confirmación
   funcional supervisada con un usuario real (nunca un usuario sintético
   creado en PROD).
3. Con (B) autorizada, solo después de (2): mover `release` a
   `21ce7fad37dec815fc4568945872fc72a9bf3cd7` (o al commit que el
   propietario decida a partir de esta rama).
4. Decisión pendiente, separada y no bloqueante para el cierre de PM33:
   si el modelo relacional de QA es el diseño futuro de esta función
   (fuera del alcance actual, ver 9.5).

## 17. PROMOCIÓN DETENIDA: la matriz real de migraciones invalida el mecanismo `db push` de la sección 15.4

**Corrección explícita, no silenciosa, sobre la sección 15.4 de este
mismo documento.** El propietario comprobó la matriz real de migraciones
repo↔PROD y encontró que la propuesta anterior no era segura:

- `supabase/migrations/` en `claude/pm33-promocion-final` contiene **34**
  versiones.
- PROD registra **36** versiones en `supabase_migrations.schema_migrations`.
- **Intersección: 0.** Verificado de forma independiente contando los 34
  prefijos reales de la rama y comparándolos contra las 36 filas reales
  ya capturadas por `list_migrations` en la sección 15.4 — ninguna
  coincide.

**La afirmación de la sección 15.4** de que `supabase db push --dry-run`
"reconocería exactamente" la migración P05 como única pendiente **era
incorrecta y queda retirada aquí**: se apoyaba en que `list_migrations`
no mostraba ninguna versión `20260919*`, pero `list_migrations` solo lee
la tabla remota — no compara contra los archivos locales, que es
exactamente lo que hace `db push --dry-run`. Con intersección 0, un
`db push` real (con o sin `--dry-run`) tendría que considerar las 34
versiones locales como pendientes, no solo P05 — no hay evidencia de que
aplicar las otras 33 sea seguro (es la misma deuda de trazabilidad ya
registrada en el Punto 5 del documento maestro de cierre, ahora
cuantificada con exactitud: 34 vs. 36, 0 en común). **Quedan descartados
expresamente**: `db push` sin flags, `db push --include-all`, y
cualquier reparación masiva del historial.

**Mecanismo corregido** (sustituye a la sección 15.4 por completo):
aplicar el contenido exacto de la migración P05, y solo ese, vía
`supabase_apply_migration` (MCP) — que no lee ni compara
`supabase/migrations/`, así que no arriesga tocar las otras 33 versiones
— capturar después la versión real que Supabase genere (no predecible de
antemano) vía `list_migrations`, renombrar en el repositorio el archivo
de la migración P05 para que coincida con esa versión real, actualizar el
gate de migración única y la documentación en consecuencia, y volver a
ejecutar el gate sobre el nuevo SHA antes de mover `release`. Detalle
completo, paso a paso, en `cierre-proyecto-a/pm33/PROPUESTA_PROMOCION.md`
sección 5.

**Rollback también corregido**: se retira `supabase migration repair
--status reverted` como mecanismo de rollback operativo normal (el propio
historial ya tiene discrepancias no auditadas; añadir reparaciones sobre
él sin necesidad real no es prudente). El rollback correcto es hacia
delante: primero restaurar el deploy de Netlify
`6aad473513310100099a03a9`, después aplicar una NUEVA migración de
rollback (mismo mecanismo, `apply_migration`) que restaure la función
anterior, conservando en el historial tanto la aplicación de P05 como su
reversión — nunca borrando ni reescribiendo la entrada de P05. Detalle
completo en `PROPUESTA_PROMOCION.md` sección 11.

**Vía alternativa documentada, no ejecutable aquí**: `supabase migration
fetch --linked` en un directorio de trabajo aislado reconciliaría el
repositorio completo (las 36 versiones reales, no solo P05) antes de un
`dry-run` genuinamente demostrado — sigue bloqueada en este sandbox por
falta de credenciales de conexión a PROD (mismo hallazgo que en la ronda
anterior). Ver `PROPUESTA_PROMOCION.md` sección 13.

No se ha aplicado nada a PROD ni se ha modificado el historial remoto de
migraciones en esta ronda — solo se corrigió la documentación.

## 18. Próximo paso concreto (histórico, sustituido por la sección 20)

**Estado: PM33 validado para promoción, mecanismo de aplicación
corregido, PROMOCIÓN DETENIDA hasta ejecutar el mecanismo de la sección
17. NO cerrado, NO aplicado, NO publicado.**

1. Propietario revisa `cierre-proyecto-a/pm33/PROPUESTA_PROMOCION.md`
   (sección 5, mecanismo corregido) y autoriza, por separado:
   - **(A) Autorización para aplicar la migración P05** — vía
     `apply_migration` (MCP), captura de la versión real, renombrado del
     archivo, actualización del gate, y nueva ejecución del gate en
     verde, todo antes de continuar.
   - **(B) Autorización para mover `release`** — dispara Netlify
     automáticamente (`manual_deploy=false`), solo después de que (A) y
     su nuevo gate estén en verde.
2. Con (A) autorizada: preflight (sección 3) → `apply_migration` con el
   contenido exacto de P05 → postflight inmediato → capturar la versión
   real en `list_migrations` → renombrar el archivo en
   `claude/pm33-promocion-final` → actualizar el gate y la documentación
   → push → nuevo gate en verde sobre el nuevo SHA → confirmación
   funcional supervisada con un usuario real (nunca sintético).
3. Con (B) autorizada, solo después de (2): mover `release` al nuevo SHA
   (con el archivo ya renombrado), no a `21ce7fad37dec815fc4568945872fc72a9bf3cd7`.
4. Decisión pendiente, separada y no bloqueante para el cierre de PM33:
   si el modelo relacional de QA es el diseño futuro de esta función
   (fuera del alcance actual, ver 9.5). Tampoco bloqueante para PM33: la
   deuda más amplia de 34 vs. 36 migraciones más allá de P05 (Punto 5 del
   documento maestro de cierre).

## 19. Fase A ejecutada: migración P05 aplicada en PROD

**Autorizada explícitamente por el propietario, con siete condiciones,
todas cumplidas.** Ejecutada contra `flqercbgpgmmfaakrwkc` el 19/09/2026.

### 19.1 Preflight repetido inmediatamente antes de aplicar

Las cuatro condiciones de parada exigidas se comprobaron, ninguna se
disparó:

- Existe únicamente `obtener_contexto_operativo()` de 0 argumentos.
- Hash: `40d7bf2ea50776b7eb40a3fff239c0b4` (idéntico al capturado el
  19/09/2026).
- `pg_depend` sin filas para esta función — sin dependencias nuevas.
- `authenticated_execute=true`, `anon_execute=false`,
  `public_execute=false`.

### 19.2 Aplicación

`apply_migration` (MCP) contra `flqercbgpgmmfaakrwkc`, `name =
"pm33_p05_identidad_antes_de_actividad"`, `query` = el contenido literal
completo de
`supabase/migrations/20260919170000_pm33_p05_identidad_antes_de_actividad.sql`
del commit `21ce7fad37dec815fc4568945872fc72a9bf3cd7` (extraído con `git
show`, verificado antes de enviarlo). Sin tocar `db push` ni ninguna de
las otras 33 versiones locales sin correspondencia en PROD (sección 17).

### 19.3 Postflight inmediato — las siete comprobaciones exigidas

1. **Una única función con `p_local_id text DEFAULT NULL`**: confirmado
   (`pronargs=1`, `args="p_local_id text DEFAULT NULL::text"`).
2. **Ausencia de la sobrecarga antigua de 0 argumentos**: confirmado — la
   consulta por firma devuelve una sola fila.
3. **`authenticated` conserva EXECUTE**: confirmado (`true`).
4. **`anon` y `PUBLIC` sin EXECUTE**: confirmado (`false`, `false`).
5. **El hash/cuerpo corresponde al P05 aplicado**: hash de la definición
   en PROD tras aplicar = `211ddc8ad6c053be1c75872ceb29a093`. Verificado
   de forma independiente: **idéntico** al hash calculado sobre una
   instancia local de PostgreSQL 16 (`pm33_test`, de esta misma sesión)
   con el mismo candidato P05 ya validado localmente — no es solo
   autoconsistencia de PROD, es una comparación cruzada contra un
   entorno distinto que corrió el mismo SQL.
6. **La llamada sin sesión es rechazada**: petición HTTP real (no
   simulada) contra `https://flqercbgpgmmfaakrwkc.supabase.co/rest/v1/rpc/obtener_contexto_operativo`
   con la clave `anon` real de PROD, sin JWT de usuario — respuesta
   `HTTP 401`, cuerpo
   `{"code":"42501","details":null,"hint":null,"message":"permission denied for function obtener_contexto_operativo"}`.
   Coincide exactamente con el comportamiento ya validado en el entorno
   aislado (sección 13): rechazo a nivel de permiso, antes de entrar en
   la función.
7. **Sin avisos de seguridad nuevos atribuibles a esta migración**:
   `get_advisors(type=security)` tras aplicar devuelve tres categorías,
   ninguna nueva ni con recuento aumentado por esta migración:
   `rls_enabled_no_policy` (6 hallazgos, ninguno de una tabla tocada por
   esta migración -- no toca ninguna tabla), `authenticated_security_definer_function_executable`
   (**17** hallazgos -- mismo recuento ya documentado en rondas
   anteriores de este cierre; `obtener_contexto_operativo(p_local_id
   text)` aparece con su firma nueva, pero ya aparecía con la firma
   antigua antes de aplicar -- no es un hallazgo nuevo, es el mismo con
   los argumentos actualizados), y `auth_leaked_password_protection` (1
   hallazgo, ya documentado como Punto 10 del cierre general, sin
   relación con esta migración).

### 19.4 Versión registrada

`list_migrations` tras aplicar: **37 filas** (36 + 1). La nueva:
**`version = "20260919225831"`**, **`name =
"pm33_p05_identidad_antes_de_actividad"`**.

### 19.5 Candidato final actualizado y re-validado

En `claude/pm33-promocion-final`: renombrado
`supabase/migrations/20260919170000_pm33_p05_identidad_antes_de_actividad.sql`
→ `supabase/migrations/20260919225831_pm33_p05_identidad_antes_de_actividad.sql`
(contenido SQL verificado sin cambios con `diff`), actualizado el gate de
migración única y el filtro de `paths` del workflow al nuevo nombre,
corregida la referencia correspondiente en
`docs/plan-maestro/PM33_ENTORNO_AISLADO.md`. Commit **`6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d`**.
Workflow re-ejecutado sobre ese SHA:
[`run 35474922732`](https://github.com/Plopezm1990/Almacen/actions/runs/35474922732)
— **SUCCESS** (verificado de forma independiente vía la API de GitHub
Actions, no solo por el reporte del propietario).

**Candidato final vigente para la fase B: `claude/pm33-promocion-final`
@ `6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d`.**

### 19.6 Qué NO se hizo en esta fase

No se creó ningún usuario ni dato sintético en PROD. No se movió
`release`. No se publicó nada en Netlify. La confirmación funcional con
un usuario real y supervisado (distinta de la comprobación de rechazo
sin sesión, ya hecha) queda para la fase B o para una verificación
posterior expresamente supervisada por el propietario — no se ha hecho
en esta fase.

## 20. Próximo paso concreto (vigente)

**Estado: Fase A de PM33 aplicada y verificada en PROD
(`flqercbgpgmmfaakrwkc`), candidato final re-validado
(`claude/pm33-promocion-final` @ `6e26391`, gate `35474922732` SUCCESS).
Fase B (mover `release`, publicar Netlify) pendiente de autorización
separada. NO cerrado.**

1. Propietario autoriza, específicamente, mover `release` a
   `6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d` -- dispara Netlify
   automáticamente (`manual_deploy=false`).
2. Con esa autorización: comprobación inmediata antes de mover
   (`release` sigue en `f313bc0`, el candidato sigue en `6e26391`, el
   gate sigue en SUCCESS, PROD conserva la migración `20260919225831`) →
   fast-forward exacto de `release` → supervisar el despliegue de
   Netlify con espera acotada → verificar en producción (`index.html`,
   `fuente.js` y su hash servido, cabecera `Cache-Control`, rechazo de la
   llamada anónima, ausencia de errores nuevos) → postflight final.
3. Solo si todo queda en verde: marcar PM33 cerrado. Si algo falla:
   procedimiento de rollback documentado en
   `cierre-proyecto-a/pm33/PROPUESTA_PROMOCION.md` sección 11 (Netlify
   primero, después una nueva migración de rollback registrada si hace
   falta revertir también el SQL).
4. Decisión pendiente, separada y no bloqueante para el cierre de PM33:
   si el modelo relacional de QA es el diseño futuro de esta función
   (fuera del alcance actual, ver 9.5). Tampoco bloqueante: la deuda más
   amplia de 34 vs. 36 migraciones más allá de P05 (Punto 5 del
   documento maestro de cierre).
