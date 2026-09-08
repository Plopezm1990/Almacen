# PM19 P04 — Merma descuenta una vez

Cuarto punto de PM19. "Merma" no es un módulo aparte: es un motivo de movimiento de
salida (`registrarSalida`, dentro de `crearLogicaProductos`) que usa el motor de stock
compartido (`aplicarMovimientoStock`), ya probado extensamente frente a duplicados en
`tests/pm12/p08-fallos-replay-concurrencia-contract.mjs`. El encargo explícito de este
punto era no dar por buena esa garantía sin comprobarla contra el código real de merma en
concreto, en vez de asumirla solo porque el motor en general la tiene.

## Diagnóstico (hueco real encontrado)

`registrarSalida` generaba **siempre** un `movimientoId` aleatorio nuevo
(`movimientoId: uid()`) en cada llamada — incluso para el mismo lote de merma por
caducidad. Como la deduplicación del motor de stock se basa exactamente en que el mismo
`movimientoId` se repita, un reintento de la misma merma (doble confirmación, reintento
de red si en el futuro se hiciera asíncrono, etc.) **nunca llegaba a activar esa
protección**, porque cada intento generaba un id distinto y parecía, a ojos del motor, un
movimiento genuinamente nuevo. A diferencia de Producción, Conteos o Traspasos — que
generan un `operationId`/`movimientoId` estable una sola vez por operación real — la
merma por lote no tenía ningún identificador estable ligado a "esta merma en concreto".

## Solución

- **`registrarSalida`** acepta ahora un `movimientoId` opcional en las opciones del
  llamador; si no se da, sigue generando uno aleatorio como antes (sin cambios para
  ventas ni el resto de motivos que no lo pasan).
- **`movimientoIdMermaLotePM19(lote)`** (función pura): deriva un id determinista a
  partir de la identidad real del lote (`productoId` + `lote` + `caducidad`) — la misma
  merma, repetida, produce siempre el mismo id; una merma genuinamente distinta (otro
  producto, otro lote, otra caducidad) produce uno distinto.
- El punto real de "Registrar como merma" (alertas de caducidad próxima) pasa ahora
  `movimientoId: movimientoIdMermaLotePM19(confirmarMermaLote)` — con esto, la
  deduplicación ya existente del motor de stock protege de verdad esta merma concreta.

## Archivos

- `fuente.js`: `movimientoIdMermaLotePM19` (nueva, antes de `crearMotorStock`);
  `registrarSalida` acepta `movimientoId`; el punto de confirmación de merma por lote lo
  usa.
- `tests/pm19/p04-merma-descuenta-una-vez-contract.mjs`: `movimientoIdMermaLotePM19`,
  determinismo (positivo/replay) y distinción real por producto/lote/caducidad
  (negativo).
- `tests/pm19/p04-wiring-merma-contract.mjs`: por inspección estática, confirma que
  `registrarSalida` reenvía de verdad el `movimientoId` del llamador y que el punto real
  de confirmación de merma lo usa — sin reimplementar la deduplicación del motor, que ya
  está probada en PM12.

## Regresión

Suite completa del proyecto — 101/101 sin regresiones (ver detalle en el commit de PM19).

## Estado de main/producción

`main` = `cc7cab7cc3781012ab3e7729dfa2af7476e19eae`, sin tocar directamente. Frontend
puro, sin migraciones Supabase.

## Pendiente de PM19

Fichas de coste y Producción se inspeccionaron y ya están maduras (receta × rendimiento
precalculada, motor de stock idempotente, reversión completa) — no se ha encontrado ni
tocado nada ahí. Quedan por confirmar explícitamente, si se continúa con más puntos de
PM19: movimientos generales fuera de merma, y NR-07 en el resto de módulos operativos
(Producción, APPCC, Aceite, Fichas de coste) más allá de Traspasos, que es el único
comprobado en este punto.
