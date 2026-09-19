# PM33 P03 — Propuesta de validación en QA (no ejecutada)

Estado: **propuesta preparada, pendiente de autorización explícita.** Nada
de este documento se ha aplicado a `qjqorixtkilwsndqayyx` (L&A Suite QA).
Se presenta antes de tocar ese entorno, tal como exige el alcance de esta
revisión.

## Qué se ejecutaría, dónde, y su efecto

| | |
|---|---|
| **Entorno** | Supabase QA (`qjqorixtkilwsndqayyx`), PostgreSQL 17.6 real |
| **Candidato** | `supabase/migrations/20260919150000_pm33_p03_obtener_contexto_operativo_aislamiento.sql`, rama `claude/pm33-p03-obtener-contexto-operativo`, commit `e7491d5` |
| **Efecto** | Sustituye `public.obtener_contexto_operativo()` (0 args) por `public.obtener_contexto_operativo(p_local_id text default null)`. Ningún otro objeto de QA se toca (confirmado: sin dependientes). Sin migración de datos. |
| **Reversión** | Un solo `create or replace` con el cuerpo original + `drop function ...(text)` -- documentado y probado en `docs/plan-maestro/PM33_P03_MIGRACION_DESDE_PROD.sql` (rama del candidato) |
| **Datos de prueba** | Solo usuarios/perfiles/membresías de prueba, creados y **retirables** explícitamente (ver más abajo). No se toca ningún usuario real de QA. |

## Por qué NO basta con cargar `fixtures.sql` tal cual en QA

El kit local (`tests/pm33/db/fixtures.sql`) sustituye `auth.uid()` por un
stub (`current_setting('request.jwt.claim.sub', ...)`) y **crea su propio
esquema `auth`**. Eso es correcto para una base Postgres desechable, pero
en Supabase real:

- `auth` ya existe y lo gestiona Supabase Auth -- crear o alterar ese
  esquema, o sustituir `auth.uid()`, está descartado por completo (rompería
  la autenticación real de todo el proyecto, no solo de la prueba).
- Las pruebas deben pasar por PostgREST/Auth real (JWT real), no por un
  `set_config` manual, para que la validación signifique algo en QA.

## Adaptación propuesta (sin tocar `auth`, sin sustituir la autenticación)

1. **Usuarios de prueba reales**, creados vía Supabase Auth Admin (API,
   no SQL directo sobre `auth.users`): 5-6 cuentas desechables con email
   dedicado (p. ej. `pm33-qa-camarero-a@...`), una por escenario
   (Cajero/a A, Cajero/a B, Encargado A, Camarero/a con colisión de id,
   Camarero/a con empleado activo legítimo). Contraseñas de un solo uso,
   sin reutilizar ningún dato real.
2. **Datos de prueba en `public`**, con los MISMOS señuelos ya usados en
   local (`SEÑUELO-PROVEEDOR-A`, etc.) para poder detectar contaminación
   cruzada por contenido:
   - Filas en `public.perfiles` que enlacen cada `auth.users.id` real
     (creado en el paso 1) con el `rol`/`empleado_id` del escenario.
   - Filas en `public.membresias_usuario` / `public.almacen_kv` con
     `empresa_id`/`local_id` de prueba, **prefijados de forma inequívoca**
     (p. ej. `qa-pm33-emp-A`, `qa-pm33-loc-A`) para que sean triviales de
     identificar y borrar, y para que no puedan colisionar con IDs reales
     de QA.
   - Todo insertado y retirado dentro del mismo script, con un bloque de
     limpieza explícito al final (no depender de recordar borrarlo a mano).
3. **Ejecución de la batería** (62 aserciones: 38+7+17, más las 4 del
   frontend si se decide probar también el flujo end-to-end con el
   dispositivo apuntando a QA) usando el cliente `supabase-js` real
   (JWT real vía `signInWithPassword`), no `pg` directo con un
   `set_config` -- esto es lo que cierra el gap "Auth/PostgREST reales"
   que sigue abierto en `HALLAZGOS_P02.md`.
4. **Postflight de PostgreSQL 17**: repetir la prueba de humo funcional del
   script de migración (llamada sin argumentos tras aplicar, con un
   usuario de prueba real) -- cierra el gap "PostgreSQL 17 real" que no se
   pudo validar en este entorno de trabajo (sin Docker operativo ni
   paquete `postgresql-17` disponible).
5. **Limpieza**: borrar los usuarios de Auth de prueba y las filas de
   `public` insertadas, en ese orden, al terminar -- script de limpieza
   incluido en el mismo paquete que el de carga, no un paso manual aparte.

## Siguiente paso

Si se autoriza, se ejecuta primero el **preflight** de
`PM33_P03_MIGRACION_DESDE_PROD.sql` contra QA (solo lectura) para
confirmar que el estado real de QA coincide con lo asumido, antes de
aplicar nada. El resultado de ese preflight se registra en
`HALLAZGOS_P02.md` antes de continuar.

Esta propuesta no incluye ni implica ninguna acción sobre PROD.
