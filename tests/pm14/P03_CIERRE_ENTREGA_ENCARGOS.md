# PM14 P03 — Entrega de encargos

## Problema encontrado (ver `tests/pm14/P01_DIAGNOSTICO_ENCARGOS_ANTICIPOS.md`, sección F–G)

`entregarEncargo(encargo, medioPago)` comparaba `e2.id === encargo` con `encargo` siendo el **objeto completo** que le pasa la UI real (`entregarEncargo(e2, medioPagoEntrega)`), por lo que `actual` era siempre `undefined` y la función devolvía `false` sin ejecutar nada — sin descontar stock, sin crear venta, sin cambiar el estado — mientras el botón "Confirmar entrega" ignoraba el resultado y cerraba el modal como si hubiera tenido éxito. Además, aun corrigiendo esa comparación, la función no tenía `operationId`, no comprobaba si el encargo ya estaba entregado, mutaba stock línea a línea sin atomicidad (una línea sin stock no revertía las anteriores) y permitía operar con "Todos los locales" seleccionado.

## Solución aplicada

- `entregarEncargo` acepta ahora el id o el objeto del encargo, busca el registro real, y **no depende de la UI para decidir si tuvo éxito**.
- Requiere un local activo real: `encargoEsDelLocalActivo` deja de tratar `localActivoId == null` ("Todos los locales") como automáticamente autorizado — ahora hace falta un local concreto para entregar, editar o eliminar. Mismo criterio aplicado a `deleteEncargo`.
- Un encargo ya `"Entregado"` responde `{ ok: true, replayed: true, yaEntregado: true }` sin repetir ningún efecto; un estado distinto de `"Pendiente"`/`"Entregado"` (p. ej. una futura cancelación) se rechaza explícitamente.
- Se añadió `venderLote` a `crearLogicaVenta` (fuente.js), que reutiliza el motor de idempotencia **ya existente** (`aplicarLoteMovimientosStock`, el mismo que ya usan PM07/PM12) para aplicar todas las líneas del encargo **como un único lote atómico**: si una línea no tiene stock suficiente, no se aplica ninguna. No se ha creado un segundo motor de idempotencia — se expone la capacidad de lote que `crearMotorStock` ya ofrecía y que `venderLineas`/`venderLocal` (TPV) no usaban; `venderLineas`/`venderLocal`/`venderCarrito` no se han tocado, cero riesgo para PM07/09 ya cerrados.
- El `operationId` de la entrega es determinista (`entrega-encargo:<encargoId>`) y cada línea usa un `movimientoId` determinista (`<operationId>:<índice>`), de modo que un doble clic o un reintento con el mismo encargo reutiliza el mismo movimiento ya aplicado (replay) en vez de duplicar stock o venta.
- El cobro "Resto entrega" usa un id determinista (`resto-entrega:<encargoId>`) en vez de `uid()`, evitando duplicar la línea de cobro si se repite la operación.
- `deleteEncargo` deja de permitir borrar físicamente un encargo ya `"Entregado"` (evita dejar movimientos de stock/venta con `documentoOrigenId` apuntando a un encargo que ya no existiría).
- La UI (`Encargos`) deja de cerrar el modal de entrega si el resultado no es `ok` (muestra el error dentro del propio modal) y añade un guard de doble clic (`entregaBloqueadaPM14`, mismo patrón ya usado en el formulario de alta/edición). El modal de eliminación también comprueba el resultado real de `deleteEncargo` en vez de cerrarse siempre.

## Lo que queda explícitamente abierto dentro de P03 (no se declara cerrado del todo)

- **Autoridad de backend en modo sincronizado (DEC-03).** La entrega sigue aplicando el descuento de stock en local (motor `aplicarLoteMovimientosStock`), no a través del RPC `registrar_venta_stock_carrito_pm09` que ya usa el TPV (`venderCarrito`) cuando `window.__nubeActiva`. Es una mejora sustancial respecto al estado anterior (que no hacía nada) y ya es atómica/idempotente en local, pero no es todavía la ruta autoritativa de servidor. Enrutar la entrega por ese mismo RPC (reutilizándolo, no creando uno nuevo) queda como siguiente tarea dentro de P03 antes de darlo por cerrado del todo.
- La atomicidad ganada con `venderLote` es local a esta llamada (dentro de la misma función síncrona no hay forma de que otra operación se intercale en JS de un solo hilo), pero no protege todavía contra el escenario de **dos pestañas** modificando el array `encargos` en paralelo (el propio documento del encargo sigue usando el modelo de blob único `saveKey`/`window.storage`, sin versión ni bloqueo) — eso corresponde a PM14‑P07 (fallos/concurrencia), ya previsto como punto propio en la descomposición acordada.

## Archivos principales

- `fuente.js`: `crearLogicaVenta` (nuevo `venderLote`), `crearLogicaEncargos` (`encargoEsDelLocalActivo`, `entregarEncargo`, `deleteEncargo`), UI `Encargos` (modales de entrega/eliminación).
- `tests/pm14/p03-encargos-entrega-contract.mjs` (nuevo contrato).

## Pruebas

- Caso feliz: descuenta stock exacto, marca `Entregado`, liquida el resto (`total - señal`).
- Replay/doble clic: segunda llamada = `yaEntregado: true`, sin duplicar stock ni movimientos.
- Identidad rota original cubierta: pasar el objeto completo (como hace la UI real) funciona igual que pasar el id.
- Negativos: sin local activo, encargo de otro local, encargo inexistente, estado no permitido (`Cancelado`).
- Atomicidad: stock insuficiente en una línea de dos bloquea toda la entrega, cero movimientos, encargo sigue `Pendiente`.
- Líneas manuales (sin producto de catálogo) no tocan stock pero sí se liquidan.
- `deleteEncargo`: bloqueado sobre encargo `Entregado` y sobre "Todos los locales".

## Regresión ejecutada

`tests/pm10/*.mjs` completo, `tests/pm09/*.mjs` completo, `tests/pm07/frontend-contract.mjs`, `tests/pm12/p02..p10` (excepto Postgres/Supabase), `tests/pm13/*-contract.mjs` (excepto Postgres/Supabase) — sin regresiones nuevas. Los únicos rojos son los ya documentados como preexistentes al checkpoint `6ee2752a...` y ajenos a Encargos: `tests/pm10/p09-transversal-contract.mjs`, `tests/pm10/p10-autoridad-persistencia-contract.mjs` (regex de `addEmpleado` desactualizada desde PM13‑P01), `tests/pm12/p01-checkpoint-inventario-contract.mjs` y `tests/pm13/p01-altas-bajas-personal-contract.mjs` (verificado con `git stash`: fallan igual sin ningún cambio de esta sesión).

## Estado de main/producción

`main` = `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`, sin tocar. Sin migraciones, sin Supabase productivo, sin despliegue.
