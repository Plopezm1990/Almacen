# PM14 P02 — Anticipos y saldo de encargos

## Problema encontrado

Ver `tests/pm14/P01_DIAGNOSTICO_ENCARGOS_ANTICIPOS.md` (sección D-E): la señal/anticipo de
un encargo era solo un número dentro del propio documento (`almacen_kv`), sin caja real,
sin pagos parciales trazables y sin protección de sobrecobro a nivel de backend — cualquier
control dependía enteramente del cliente.

## Solución aplicada

**Backend (`L&A Suite QA`, nunca producción):** ver `tests/pm14/P02_CIERRE...` (esta nota) y
las migraciones `supabase/migrations/20260908071757_pm14_p02_*.sql` y siguientes. Se replicó
el motor ya probado de PM06 (`pagos_factura`/`registrar_pago_factura`/`revertir_pago_factura`)
en vez de crear uno nuevo: tabla `encargos_empresa` (espejo autoritativo mínimo de
empresa/local/total/estado) y tabla `pagos_encargo` + RPCs `registrar_pago_encargo`/
`revertir_pago_encargo` (`operation_id` idempotente, sin sobrecobro, reverso trazable sin
borrado, solo escribibles vía RPC).

**Frontend (`fuente.js`, `crearLogicaEncargos`):**
- `sincronizarEncargoNube(encargo)`: sincroniza el espejo (`registrar_encargo`) en segundo
  plano cuando hay nube activa, sin bloquear ni cambiar la firma síncrona de `addEncargo`/
  `updateEncargo` (ambas siguen devolviendo el mismo tipo de valor que ya validan los
  contratos de PM10/P01, sin romper nada de lo ya cerrado).
- `registrarAnticipoEncargo(encargoOrId, { concepto, importe, medioPago, fecha })`: función
  nueva, asíncrona, que llama a `registrar_pago_encargo` cuando hay nube activa. Usa un
  `operationId`/`id` de fila **deterministas** (`anticipo-encargo:<id>:senal` /
  `...:resto`), no un `uid()` aleatorio, para que un doble clic o un reintento reutilice la
  misma fila en vez de duplicar el cobro. Sin conexión, se niega explícitamente
  (`sin_conexion`) en vez de fingir que se ha cobrado — nunca actualiza el `cobros` local
  del encargo por su cuenta.
- `revertirAnticipoEncargo(pagoId, motivo)`: llama a `revertir_pago_encargo`, exige motivo.
- UI (`Encargos`): al dar de alta un encargo con señal, tras guardarlo localmente se llama a
  `registrarAnticipoEncargo` con concepto `SEÑAL`; si el servidor lo rechaza (saldo, permiso,
  etc.) se avisa explícitamente sin fingir que el cobro se confirmó, pero sin deshacer el
  alta del documento (son dos operaciones legítimamente separadas, igual que en PM11
  pedido→recepción→pago). Al confirmar la entrega, si queda resto por cobrar se llama con
  concepto `RESTO_ENTREGA` tras el descuento de stock.

## Explícitamente fuera de alcance en este pase (documentado, no oculto)

- **Editar una señal ya cobrada** (cambiar su importe desde el formulario de edición) sigue
  actualizando solo el documento local; no dispara un reverso + nuevo cobro en el ledger real.
  Eso exige un flujo de corrección propio, no una sustitución silenciosa.
- **Múltiples cobros parciales fuera de "señal" y "resto de la entrega"** (concepto `OTRO`)
  no tienen todavía un punto de enganche en la UI ni un id determinista por defecto — el
  backend ya lo admite (`registrar_pago_encargo` acepta `OTRO`), falta la UI de PM14-P08 o
  una revisión posterior si se necesita antes.
- **`revertirAnticipoEncargo` no tiene botón en la UI todavía**: no existe aún un listado de
  cobros por encargo desde el que anular uno. La función y su contrato ya están listos para
  cuando se construya esa vista (P06/P08).

## Archivos principales

- `supabase/migrations/20260908071757_pm14_p02_encargos_pagos_encargo.sql` (+ 2 migraciones
  de corrección de privilegios de ejecución).
- `fuente.js`: `crearLogicaEncargos` (nuevas funciones), composición (`registrarAnticipoEncargo`
  pasado a la UI), componente `Encargos` (alta y entrega).
- Tests: `tests/pm14/db/p02-postgres-contract.mjs` (Postgres real), `tests/pm14/p02-encargos-frontend-contract.mjs` (enganche RPC simulado).

## Pruebas

- Postgres real (9 casos, ver commit del backend): camino feliz, replay, conflicto,
  no-sobrecobro, encargo ya liquidado, reverso + reverso duplicado bloqueado, roles
  (Cajero/a cobra pero no revierte, Básico no cobra), aislamiento cross-empresa, local
  inactivo.
- Frontend simulado (10 casos): sin conexión no finge éxito; camino feliz con ids
  deterministas para señal y resto; el alta sigue síncrona y no espera a la RPC de
  sincronización; errores del backend traducidos a mensajes legibles; encargo de otro local
  rechazado sin llegar a llamar a la RPC; concepto inválido rechazado; reverso exige motivo,
  tiene éxito con id determinista, y un reverso duplicado se traduce correctamente.

## Regresión

`tests/pm10/p08-encargos-contract.mjs`, `tests/pm14/p01-encargos-identidad-contract.mjs`,
`tests/pm14/p03-encargos-entrega-contract.mjs`, `tests/pm07/frontend-contract.mjs`,
`tests/pm09/*.mjs` — sin regresiones. `venderLineas`/`venderLocal`/`venderCarrito`/
`anularVenta` no se han tocado en este punto.

## Estado de main/producción

`main` = `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`, sin tocar. Migraciones aplicadas
únicamente en `L&A Suite QA` (`qjqorixtkilwsndqayyx`). `L&A Suite` (producción) y `TPV`
(ajeno a Proyecto A) no se han tocado en ningún momento.
