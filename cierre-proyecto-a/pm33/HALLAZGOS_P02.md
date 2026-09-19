# PM33 — Revisión de cierre: regresión encontrada en el candidato P01 y corrección P02

Estado: **corrección preparada y validada localmente contra Postgres real (16.13). NO aplicada a Supabase ni a producción. Falta validación con PostgreSQL 17 (versión real de PROD/QA), Auth/PostgREST y RLS reales.**

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

## 6. Próximo paso concreto

1. Decisión del propietario sobre el gap multi-local/frontend (sección 5).
2. Con esa decisión tomada, aplicar `candidato_p02_obtener_contexto_operativo.sql`
   primero en QA (`qjqorixtkilwsndqayyx`, PostgreSQL 17.6 real) y repetir
   ahí la batería de 45 aserciones más una prueba de humo con un usuario
   autenticado real (Auth/PostgREST) — ninguna de las dos cosas están
   hechas todavía.
3. Solo tras (2) en verde, autorización explícita para aplicar a PROD.

Ninguna de las dos altera código de aplicación (`fuente.js`); son cambios
exclusivamente en la función SQL.
