# PM20 P06 — Respaldos, errores y auditoría: destino, trazabilidad, diagnóstico y recuperación

Sexto punto de PM20.

## Defecto real crítico encontrado y corregido: `errores_sistema` sin aislamiento por empresa

Por inspección real de `fuente.js` y del proyecto Supabase QA (`qjqorixtkilwsndqayyx`,
lectura antes de cualquier cambio):

- `ErroresSistema` (componente de pantalla) leía `supabase.from("errores_sistema").select("*")`
  **sin ningún filtro**.
- `registrarErrorSistema` (capturador global de errores — `window.onerror`,
  `unhandledrejection`, `ErrorBoundarioGlobal`) insertaba en esa misma tabla **sin
  `empresa_id` ni `local_id`**.
- La tabla `errores_sistema` no existía en `supabase/migrations/` (se creó fuera del
  historial de migraciones trackeado) y tenía una única política RLS,
  `qa_errores_authenticated`, con `USING (true)` / `WITH CHECK (true)` para **todos** los
  comandos: cualquier usuario autenticado del proyecto —de cualquier empresa— podía leer
  (y en teoría modificar/borrar) el historial de errores de **todas las demás empresas**
  del proyecto: mensajes de error, pila de llamadas y dispositivo.

Esto viola directamente la regla de aislamiento multiempresa vigente desde el inicio de
la sesión. Se presentó el hallazgo al usuario antes de corregirlo (no se asumió
autorización), y se obtuvo confirmación explícita y específica para esta migración
concreta en QA antes de aplicarla.

### Corrección

Migración `pm20_p06_errores_sistema_aislamiento` (aplicada en **QA únicamente**,
`qjqorixtkilwsndqayyx`; nunca en `L&A Suite` producción ni en `TPV`), trackeada en
`supabase/migrations/20260908180500_pm20_p06_errores_sistema_aislamiento.sql`:

- Añade `empresa_id`/`local_id` (nullable) a `errores_sistema`.
- Retira la política permisiva.
- `errores_sistema_select`: solo el **Propietario** de la empresa dueña de la fila puede
  leerla (mismo patrón exacto ya usado por `auditoria_registro`, reutilizado — no se
  inventó lógica nueva).
- `errores_sistema_insert`: solo se puede insertar con `empresa_id` propio, o `null`
  (arranque/login, antes de que exista contexto de empresa) — nunca se deja de registrar
  un error real por falta de contexto, solo queda sin visibilidad hasta que exista.

`fuente.js`: nuevo efecto `window.__contextoErroresPM20` (mismo patrón ya establecido
para `window.__usuarioActivoNombre`, necesario porque el capturador global de errores
vive fuera del árbol de React); `registrarErrorSistema` envía `empresa_id`/`local_id`
desde ese contexto en cada inserción.

## Verificación real de lo demás del alcance (sin defecto)

- **Respaldos** (`historialRespaldos`): usa el almacén KV genérico (`almacen_kv`), que ya
  tiene RLS por `empresa_id`/`local_id` establecida desde antes de esta sesión (política
  `pm05_almacen_*`) — confirmado por inspección directa de las políticas en QA. Su
  acceso de lectura/escritura ya está además restringido a Propietario en la capa de
  sincronización (`CLAVES_SOLO_PROPIETARIO`).
- **Notificaciones** (`suscripciones_push`): política `qa_push_propio`
  (`user_id = auth.uid()`) — cada usuario solo ve/gestiona su propia suscripción, sin
  ninguna dimensión de empresa que pueda filtrarse.
- **Auditoría**: ya verificada en PM20 P05 (Propietario únicamente, mismo patrón).

## Archivos

- `supabase/migrations/20260908180500_pm20_p06_errores_sistema_aislamiento.sql` (nuevo,
  aplicado en QA).
- `fuente.js`: efecto `window.__contextoErroresPM20`; `registrarErrorSistema` envía
  `empresa_id`/`local_id`.
- `tests/pm20/p06-errores-sistema-aislamiento-contract.mjs` (nuevo): confirma la
  migración trackeada, el efecto de contexto, y el comportamiento real de
  `registrarErrorSistema` (con contexto y sin él — nunca se pierde el registro).

## Regresión

Suite completa del proyecto — 111/111 sin regresiones.

## Estado de main/producción/QA

`main` = `bdf25591a1e986a04223b399d11d8fe81d41d82d`, sin tocar directamente. Cambio con
una única migración aplicada en **QA** (autorizada explícitamente por el usuario para
esta acción concreta antes de ejecutarla); producción (`L&A Suite`) y `TPV` sin tocar.

**PM20_P06_CIERRE_RESPALDOS_ERRORES_AUDITORIA=PASS**
