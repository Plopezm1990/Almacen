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
- `tests/g1/p07-concurrencia-replay-contract.mjs`: PASS como contrato estático; mantiene la marca explícita `G1_P07_GATE_STILL_PENDING=1` porque el gate vivo de 24/24 no se ejecuta desde esta máquina.
- `tests/f3/a10/a10-route-recovery-regression.mjs`: PASS.

## Pendiente de certificación

Los contratos SQL económicos de cobro y reembolso ya se ejecutaron en PGlite efímero, aislado y desechable, con los resultados M03B PASS, M03C PASS, B04 PASS y B05 PASS. B05 comprobó saldo confirmado, saldo reservado, disponibilidad cero, cambio en efectivo, desglose de pagos/intentos/caja y rechazo de un cobro sobre saldo reservado.

La batería estática de concurrencia/replay también pasa, pero el gate vivo `G1_P07_GATE_STILL_PENDING=1` no se puede marcar como certificado: requiere el entorno de ejecución vivo previsto por el proyecto. Por tanto, VEN-003, VEN-010 y VEN-011 quedan respaldados por los contratos efímeros y QA sintético, pero el gate vivo de concurrencia permanece pendiente y no se presenta como aprobado.

La deriva de QA del A10 queda corregida en el proyecto QA autorizado. La decisión de esta rama es no reencolar automáticamente comandas históricas; por tanto, no se sustituyó `min(uuid)` para conservar ese trigger. La reparación aplicada retira el mecanismo automático y deja cualquier recuperación histórica para una futura acción explícita y auditada.

## Comprobación de entorno para la certificación

Se revisó el repositorio y el equipo de trabajo: no están instalados `psql` ni `pg_isready` y Docker Desktop no quedó disponible como daemon local. El runner PGlite existente prepara A08; para esta certificación se usó una base PGlite nueva por batería, cargando únicamente en memoria las migraciones B02/B03/B04/B05 necesarias y cerrándola al terminar. No se aplicaron esas migraciones en QA ni producción. La ejecución PostgreSQL 16 completa sigue siendo una comprobación complementaria pendiente.
