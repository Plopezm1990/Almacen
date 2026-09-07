# PM12–P08 — Fallos, replay y concurrencia

PM12_P08_FALLOS_REPLAY_CONCURRENCIA=PASS

## Auditoría adicional y alcance del gate

**PM12–P08 sigue abierto.** PASS corresponde a los contratos enumerados, no a un cierre de concurrencia distribuida de la aplicación desplegada.

La auditoría posterior a `d3f62d6` reprodujo duplicados entre instancias, doble descuento tras una publicación interrumpida y pérdida de actualizaciones desde snapshots simultáneos.

Corrección local: `crearMotorStock` comparte los mismos `idsConocidos`, `porId` y `snapshotLocal` entre consumidores de los mismos setters. El movimiento individual delega en el lote. Una publicación interrumpida conserva los valores preparados; el reintento la termina sin recalcular el delta. Los movimientos ya confirmados siguen siendo replay no-op, incluso si otra publicación está pendiente. No se crea otro registro de idempotencia.

Cada movimiento del ajuste conserva tamaño del plan, intención y resultado. Si se pierde la confirmación del documento, se recupera ese resultado antes de recalcular diferencias. Un cambio de stock desde la preparación se rechaza. La interfaz conserva el conteo y muestra el error, sin confundirlo con un ajuste de cero productos.

Pruebas añadidas: `p08-instancias-fallos-contract.mjs` ejecuta ambas fuentes reales y cubre dos instancias, movimiento individual/lote, fallos antes y después de ambos setters, reentrada, respuesta perdida, recarga con ledger existente, payload cambiado, base obsoleta, cancelación P06 con segundo reverso fallido y el callback real de la interfaz.

## Transacción integrada en la rama, sin despliegue remoto

`supabase/migrations/20260907155028_pm12_p08_stock_atomico.sql` se ejecutó exclusivamente en PostgreSQL local aislado. El nuevo adaptador `pm12-stock-atomico-v1.js` conecta el planificador real a sus RPC de ajuste y cancelación. Reutiliza `stock_operaciones.operation_id`, el bloqueo global PM08/PM09 y el registro global G1. Guarda movimientos, saldos y resultado documental dentro de la misma transacción. La condición única por conteo impide otra aplicación con un corte distinto del mismo documento. Ajustar y cancelar comparten el bloqueo del conteo y bloquean productos en orden estable. La cancelación anterior al ajuste lo impide; una cancelación posterior revierte una sola vez.

`db/p08-postgres-contract.mjs` solo admite loopback y la base `pm12_p08_test`. Usa PostgreSQL real y dos conexiones; comprueba espera real en `pg_stat_activity`, replay, reconexión tras respuesta perdida, rollback inyectado durante INSERT, rechazo de base obsoleta, roles/contexto y colisión con el ledger financiero. Las dependencias de identidad/pertenencia son fixtures: **no acredita Supabase Auth/RLS desplegado**. No usa credenciales ni endpoints Supabase remotos.

La recuperación consulta el resultado durable del mismo ledger y sincroniza stock y movimientos conservando sus IDs. No aplica otra vez el lote local tras el RPC. Los ensayos recorren el planificador real, adaptador, SQL y funciones de recuperación de ambas fuentes; simulan respuesta perdida y cancelación duplicada. También prueban total, piso, almacén, cero diferencias, planes de dos patas y reversión exacta. Todos: PASS en PostgreSQL 18.4 local. El gate usa PostgreSQL 17 efímero, sin credenciales Supabase.

Pendientes antes del cierre operativo: validar reconciliación de documentos antiguos y Auth/PostgREST/RLS en Supabase aislado completo; autorizar por separado cualquier despliegue remoto. Los documentos antiguos con efectos no reconciliados se bloquean con `conteo_legacy_requiere_revision`. La reparación manual de duplicados antiguos tampoco aplica stock fuera del backend. Sin conexión se conserva el conteo y se exige confirmación atómica. Estas restricciones son cambios de comportamiento: aunque los contratos P02–P07 pasan, no se afirma compatibilidad operativa total con todos los datos antiguos. Contra un backend sin las nuevas funciones, el cliente devuelve error sin aplicar stock. No avanzar a P09.

Orden reproducible: contrato P08 original, `p08-instancias-fallos-contract.mjs`, `db/p08-postgres-contract.mjs`, después los seis contratos P02–P07. El contrato de base de datos requiere instalar `pg` con `npm ci --prefix tests/pm12/db --ignore-scripts` y `PM12_TEST_DATABASE_URL` apuntando exclusivamente a loopback y a la base desechable `pm12_p08_test`; reconstruye sus esquemas. Resultados locales: P08 original PASS; P08 instancias PASS; P08 PostgreSQL PASS; P02 PASS; P03 PASS; P04 PASS; P05 PASS; P06 PASS; P07 PASS. Sintaxis de ambas fuentes y ambos adaptadores PM12: PASS. Contrato adicional PM10 P11 altas/recepción: PASS. Se requiere SUCCESS remoto del nuevo commit; el gate antiguo no acredita este cambio.

- OFF1: el lote se prevalida completo antes de tocar productos o movimientos.
- RW1: cada pata del ajuste usa un `movimientoId` determinista derivado del `operationId`, producto y semántica.
- C1: un replay completo es no-op y no duplica stock.
- Un replay parcial se bloquea en modo fail-closed; no intenta completar un estado potencialmente incoherente.
- Un conflicto de mismo ID con payload diferente nunca sobrescribe.
- El documento de conteo solo se marca `ajustesAplicados` después de que el lote completo resulte OK.
- Se conservan `operationId`, `documentoOrigenId` y `origen: aplicarAjustes`, por lo que P05/P06 siguen trazables y reversibles.
- P07 continúa autorizando antes de entrar en la frontera de mutación.
- Garantía probada: lote local prevalidado, replay determinista y transacción PostgreSQL aislada. No se acredita despliegue ni Supabase Auth/RLS completo.
- Esta auditoría y sus pruebas no realizaron escrituras en Supabase remoto ni en producción. Las migraciones históricas, pruebas P02–P07 y diagnósticos P09 no se modificaron. Se ajustó exclusivamente el control de archivos del workflow P07: admitía cero archivos SQL y confundía incluir una migración local con escribir en Supabase remoto. Ahora permite solo la migración P08 identificada; las pruebas P07 y P02–P06 siguen intactas. El primer gate P08 remoto (34142435030, commit 14215df1deab5ff5447316d888e4b106fa0f54df) pasó completo; el control anterior de P07 falló después de pasar todas sus pruebas. Debe comprobarse también el gate del commit final que corrige ese control.
