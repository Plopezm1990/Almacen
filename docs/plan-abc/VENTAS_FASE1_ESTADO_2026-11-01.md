# Ventas — estado de fase 1

Fecha: 2026-11-01
Rama: `codex/ventas-mejoras`
Base: `f8cf300bd86054ef376519823ec787dc99b3807`

## Alcance ejecutado

- Se eliminó la lectura directa de `pago_intentos` desde la UI de cobro.
- La UI consume los intentos desde `abc_estado_pago_mixto_cuenta`, que es la superficie autorizada para el rol autenticado.
- El importe del siguiente pago se sincroniza con el saldo autoritativo del servidor después de actualizar, cobrar, recuperar un intento o cambiar de cuenta.
- Si la cuenta no está disponible o el estado del cobro no se puede leer, se limpian el importe y el efectivo introducidos para no reutilizar datos de otra cuenta o un saldo no verificado.
- La etiqueta operativa pasó a ser `Exacto para este pago (€)`.
- Las comandas `BLOQUEADA` sin estación (`SIN_RUTA`) ahora muestran un bloqueo explícito: no se imprimen, no ofrecen reimpresión operativa y la UI indica que asignar una ruta no reenvía automáticamente la comanda existente.
- La confirmación de una ruta de producto informa de que se aplicará a nuevas comandas; la configuración sigue pasando por RPC y no hace DML directo desde el cliente.
- Se añadieron a la rama dos migraciones correctivas de A10 para QA, sin aplicarlas a producción:
  `20261101093000_abc_f3_a10_disable_auto_route_requeue.sql` y
  `20261101094000_abc_f3_a10_assignment_without_historical_requeue.sql`.
- Tras la autorización expresa, esas migraciones se aplicaron únicamente en QA. La remediación de las siete comandas que se reencolaron durante la primera prueba se hizo conservando las filas, restaurando `BLOQUEADA/SIN_RUTA` y marcando sus efectos de outbox como `ABANDONADO`; no se borraron registros ni se tocaron pagos.

## Evidencia QA

- La cuenta de prueba autenticó correctamente contra QA.
- La RPC de estado mixto devolvió una cuenta de 1,32 €, 1,00 € confirmado, 0,32 € pendiente y un intento de tarjeta `PENDIENTE`.
- La lectura directa de `pago_intentos` respondió `42501` para `authenticated`, confirmando que la UI no debe consultar esa tabla directamente.
- Se ejecutó un flujo sintético aislado en `QA-EMP-A` / `QA-A1`: cuenta nueva, comanda de croissant, checkout mixto efectivo/tarjeta y consulta posterior de autoridad.
- La autoridad devolvió `total=1,32`, `confirmado=1,00`, `saldo=0,32`, `reservado=0,32`, `disponible_para_nuevo_cobro=0` y `PARCIALMENTE_PAGADO`; no se confirmó ni alteró el intento de tarjeta pendiente.
- Un intento sintético de cobrar `0,33` fue rechazado con `saldo_insuficiente` y no creó un pago adicional.
- Antes de asignar estación, la comanda quedó observada como `BLOQUEADA`, `estacion_id=null`, `route_key=SIN_RUTA`; la UI y los contratos impiden tratarla como imprimible o reenviable automáticamente.
- La asignación de estación no pudo certificarse en QA por una incidencia del esquema remoto: el trigger `a10_requeue_blocked_routes` invoca `private.abc_a10_reencolar_bloqueadas_por_producto`, cuya definición contiene `min(uuid)`. PostgreSQL devuelve `42883` y revierte la transacción antes de persistir la ruta. Tras el rechazo, la ruta siguió vacía y la comanda siguió `BLOQUEADA/SIN_RUTA`.
- Esa función/trigger pertenece a migraciones posteriores existentes en QA (`abc_f3_a10_requeue_blocked_routes`) y no está presente en el árbol local revisado. No se corrigió remotamente porque la tarea prohíbe aplicar migraciones y la corrección implicaría decidir si se debe reencolar o no una comanda histórica.
- Se ha elegido la política recomendada: asignar una ruta no reencola automáticamente comandas históricas. Inicialmente quedó preparada, pero no aplicada, la migración idempotente `20261101093000_abc_f3_a10_disable_auto_route_requeue.sql`, que retira el trigger y sus helpers heredados de QA.
- Tras la autorización expresa, se aplicaron en QA las dos migraciones correctivas: retirada del trigger y sustitución de la RPC `abc_asignar_producto_estacion` por la versión sin reencolado. La verificación remota confirmó `route_trigger_count=0`, `helper_count=0` y que la RPC ya no menciona `abc_a10_reencolar_bloqueadas` ni devuelve `comandas_reencoladas`.
- La primera prueba posterior a retirar solo el trigger reveló que la RPC heredada aún reencolaba siete comandas. Se restauraron esas siete filas QA a `BLOQUEADA/SIN_RUTA` y sus efectos de outbox se marcaron `ABANDONADO`, conservando las filas y sin tocar ningún pago. El pedido de referencia quedó finalmente en `BLOQUEADA`, sin estación y con `route_key=SIN_RUTA`.
- La prueba final con `QA-CAT-A1-FLAN` confirmó la política: la RPC respondió solo `ok`, producto y estación; la ruta del producto quedó activa, pero la comanda histórica permaneció `BLOQUEADA`, `estacion_id=null`, `route_key=SIN_RUTA` y sin cambio funcional de estado.

## Pruebas ejecutadas

- `node --check source-recovery/fuente-recuperado.js`: PASS
- `node --check fuente.js`: PASS
- `python source-recovery/recuperar_candidato.py --check`: PASS
- `node tests/f4/b05/b05-phase1-regression.mjs`: PASS
- `node tests/f4/b05/b05-ui-contract.mjs`: PASS
- `node tests/f3/a10/a10-ui.test.mjs`: PASS, incluidos los controles de seguridad visual para `SIN_RUTA`
- Contratos B04, B07, B08 y B09: PASS
- Contratos de permisos/aislamiento y replay/concurrencia G1: PASS
- Contratos A02 y A05: PASS
- `node tests/f3/a09/local-pglite-contract.mjs`: PASS (`A09_PGLITE_FUNCTIONAL=PASS`), incluyendo idempotencia y concurrencia.
- Contrato SQL M03B en una base PGlite efímera aislada: PASS.
- Contrato SQL M03C en una base PGlite efímera aislada: PASS.
- Contratos SQL B04 y B05, con sus migraciones B02/B03/B04/B05 cargadas en una base PGlite efímera aislada: PASS (`ECONOMIC_PGLITE_BATTERY=PASS`).
- `tests/f4/b08/b08-ui-contract.mjs` y `tests/f4/b08/b08-refund-adapter-contract.mjs`: PASS.
- `tests/f4/b09/b09-schema-contract.mjs` y `tests/f4/b09/b09-rpc-contract.mjs`: PASS.
- `tests/g1/p07-concurrencia-replay-contract.mjs`: PASS como contrato estático; la evidencia QA viva existente registra 24/24 PASS y la revalidación adicional de esta tarea confirmó replay exacto y conflicto por payload distinto.
- `tests/f3/a10/a10-route-recovery-regression.mjs`: PASS.
- Batería Node completa del workflow G1/P07/P08 (PM08, PM09, P02-P06 y LA-004): PASS, sin fallos.
- Revalidación viva adicional en Supabase QA, dentro de `BEGIN ... ROLLBACK`: venta sintética `G1-P07-CODEX-VENTA-20261101`, replay exacto con `replayed=true` y payload distinto rechazado con `operation_id_conflict`: PASS.
- Limpieza independiente posterior en QA: cero filas de la operación sintética en `stock_operaciones` y `movimientos_stock`, stock de `QA-PROD-A-AGUA` conservado en 20 unidades y lock `pg_advisory_xact_lock` presente en `private.pm08_bloquear_operation_id`.
- Runner oficial PostgreSQL 16 (`tests/ci/preparar_postgres_local.sh`) sobre clúster portátil temporal: `POSTGRES_ACTIVE_TOTAL=10`, `POSTGRES_ACTIVE_PASS=10`, `POSTGRES_ACTIVE_FAIL=0`, `HISTORICAL_EXPECTED_FAIL=1`, `PREPARAR_POSTGRES_LOCAL_OK=1`.
- Runner oficial PGlite (`tests/ci/ejecutar_pglite_local.sh`): `PGLITE_ACTIVE_TOTAL=1`, `PGLITE_ACTIVE_PASS=1`, `PGLITE_ACTIVE_FAIL=0`, `PGLITE_INFRA_FAIL=0`, `A09_PGLITE_RUNNER=PASS`.
- Histórico de la primera ejecución: la batería no llegó a ejecutar todos los contratos porque el manifiesto declaraba 171 entradas pero descubría 173 y omitía `a10-route-recovery-regression.mjs` y `b05-phase1-regression.mjs`. El inventario se corrigió en `46fbbe3` y ahora declara y valida 173 entradas, 159 contratos activos y 145 contratos Node.
- La estabilización de los cinco contratos restantes quedó registrada en `a2497ce`: lecturas independientes de finales de línea CRLF/LF para A08, PM07, PM13 y PM20; aserción de wiring A08 tolerante a handlers posteriores; y margen de temporización en PM31. No se modificó la lógica de negocio de la aplicación.
- En un worktree limpio, la batería completa posterior ejecutó 145 contratos Node, 5 utilidades y 5 diagnósticos; obtuvo `NODE_ACTIVE_PASS=145`, `NODE_ACTIVE_FAIL=0`, `INFRA_FAIL=0` y `ARBOL_LIMPIO_TRAS_EJECUCION=1`.

## Smoke visual del preview QA

- La sesión autenticada del usuario QA cargó correctamente el dashboard, el módulo de Caja y el menú de navegación adicional en el preview de Netlify.
- El acceso a TPV mostró correctamente el bloqueo previsto cuando el contexto era `Todos los locales`.
- El defecto se corrigió en `30d29e2`: `crearLogicaVenta` exporta las cinco funciones F4 y `GestionAlmacen` las recibe por destructuring. El materializador y el contrato B05 contienen ahora una aserción para evitar la regresión.
- El nuevo preview QA `6ae7ae211e280889e8d08348` quedó `ready` en contexto `deploy-preview`. Tras autenticación limpia, la selección de `Local A1` abrió TPV correctamente, sin pantalla de error y sin errores de consola.
- El TPV mostró el aviso de F4 y el catálogo operativo. No se generó una cuenta sintética ni se pulsaron botones de cobro; la cobertura económica sigue respaldada por los contratos PGlite y la evidencia QA previa.
- Cocina A10 abrió correctamente en `Local A1`, mostró el encabezado, las secciones de estaciones/rutas y la lista de comandas, sin errores de consola. No se creó estación, ruta, comanda ni cierre de caja.
- No se inició ni confirmó ningún cobro, no se creó otra venta, no se modificó el intento de pago pendiente y no se ejecutó ninguna operación destructiva.

## Estado de certificación

Los contratos SQL económicos de cobro y reembolso ya se ejecutaron en PGlite efímero, aislado y desechable, con los resultados M03B PASS, M03C PASS, B04 PASS y B05 PASS. B05 comprobó saldo confirmado, saldo reservado, disponibilidad cero, cambio en efectivo, desglose de pagos/intentos/caja y rechazo de un cobro sobre saldo reservado.

El documento de evidencia QA de G1.7 ya existente registra el resultado vivo completo de 24/24 PASS, con rollback y limpieza a cero; el contrato estático lo verifica y la revalidación adicional de esta tarea confirma el mismo mecanismo sobre el estado QA actual. El gate vivo P07 queda, por tanto, respaldado como PASS. La batería PostgreSQL 16 completa también ha pasado. El gate G1 global continúa sujeto a su cierre formal conjunto según la política del repositorio, pero ya no existe un bloqueo de infraestructura para la certificación económica de esta fase.

La deriva de QA del A10 queda corregida en el proyecto QA autorizado. La decisión de esta rama es no reencolar automáticamente comandas históricas; por tanto, no se sustituyó `min(uuid)` para conservar ese trigger. La reparación aplicada retira el mecanismo automático y deja cualquier recuperación histórica para una futura acción explícita y auditada.

Con el fix `30d29e2` y el preview QA `6ae7ae211e280889e8d08348`, el smoke autenticado de TPV/B05 y Cocina A10 queda PASS. La fase 1 queda cerrada en código, contratos, evidencia económica y comprobación visual QA. Producción no se ha desplegado y no se autoriza su promoción automática desde este resultado.

## Comprobación de entorno para la certificación

Se revisó el repositorio y el equipo de trabajo. Docker Desktop no quedó disponible como daemon, por lo que se utilizó el ZIP portable oficial de PostgreSQL 16.15 para Windows, sin instalar un servicio ni conectar el servidor a QA. Se inicializó un clúster temporal local, se ejecutó el runner oficial en el puerto 5432 y se detuvo el servidor al terminar. Las cuatro bases creadas por el runner fueron exclusivamente de contrato y quedaron fuera del repositorio. En esta corrección no se aplicaron migraciones; las migraciones A10 de QA habían sido aplicadas previamente con autorización expresa y no se tocó producción.
