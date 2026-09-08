# PM14 P05 — Devolución/reembolso de encargos

## Problema encontrado

No existía ninguna función de devolución para encargos (ver
`P01_DIAGNOSTICO_ENCARGOS_ANTICIPOS.md`, sección J-K): un encargo ya entregado no podía
devolverse ni reembolsarse desde el propio módulo. No había, por tanto, ningún control que
impidiera devolver más de lo entregado o cobrado, porque el caso simplemente no existía.

## Solución aplicada

- `devolverLote` (nuevo, en `crearLogicaVenta`, junto a `venderLote`/`venderLineas`/
  `venderLocal`/`venderCarrito` sin tocar ninguno de ellos): reutiliza el mismo motor
  atómico de lote (`aplicarLoteMovimientosStock`) que ya usan PM07/PM12/P03, pero para
  **sumar** stock en vez de restarlo (`permitirDeficit: true` siempre, porque una
  devolución nunca debe bloquearse por "falta de stock" — al contrario, lo aumenta).
- `devolverEncargo(encargoOrId, { motivo })`: solo permite devolver un encargo en estado
  `"Entregado"`; lo marca `"Devuelto"` (vía `updateEncargo`, reutilizando su validación y su
  sincronización en segundo plano) sin borrar el documento. Motivo obligatorio y trazado.
  Idempotente: devolver dos veces no duplica el movimiento de stock ni falla.
- Backend: `"Devuelto"` pasa a ser un estado válido del espejo `encargos_empresa` y,
  igual que `"Cancelado"`, bloquea automáticamente nuevos cobros contra ese encargo
  (`private.pm14_total_encargo` devuelve `null`). Migración mínima
  (`20260908075655_pm14_p05_estado_devuelto_encargo.sql`), aplicada solo en `L&A Suite QA`:
  no se crea ninguna tabla ni RPC nueva — se reutiliza íntegramente
  `pagos_encargo`/`registrar_pago_encargo`/`revertir_pago_encargo` de P02 para reembolsar.
- Igual que en P04, `devolverEncargo` devuelve `cobrosParaReembolsar` (qué conceptos y
  cuánto se cobró) para que el llamador decida **explícitamente** si reembolsa, en vez de
  hacerlo — o no hacerlo — en silencio.
- UI: cada encargo entregado tiene un botón "Devolver" que abre un modal con motivo
  obligatorio; tras confirmar, si había cobros, se pregunta explícitamente si se
  reembolsan (reutilizando `revertirAnticipoEncargo` de P02).
- Los filtros de "pendientes"/"encargos del día" (que ya excluían `Entregado` y
  `Cancelado` desde antes de PM14) se actualizaron para excluir también `Devuelto`: sin
  este ajuste, un encargo devuelto habría reaparecido como pendiente por error.

## Explícitamente fuera de alcance (documentado, no oculto)

- **Devolución parcial** (solo algunas unidades o líneas, o un reembolso parcial): esta
  primera versión solo cubre la devolución completa de lo entregado con reembolso total de
  lo cobrado. `revertir_pago_encargo` revierte el importe completo de un pago, no una
  fracción; una devolución parcial necesitaría una fila de reembolso propia en el ledger,
  no solo un reverso. Queda para una revisión posterior si se necesita.
- El histórico de encargos devueltos no tiene todavía su propia sección en la UI (aparece
  descartado tanto de "pendientes" como de "entregados"); corresponde a P08
  (historial/informes).

## Archivos principales

- `fuente.js`: `crearLogicaVenta` (`devolverLote`), `crearLogicaEncargos`
  (`devolverEncargo`), filtros de pendientes/del día, composición, componente `Encargos`
  (botón y modal de devolución).
- `supabase/migrations/20260908075655_pm14_p05_estado_devuelto_encargo.sql`.
- `tests/pm14/p05-encargos-devolucion-contract.mjs`,
  `tests/pm14/db/p05-postgres-contract.mjs`.

## Pruebas

Frontend (9 casos): camino feliz (devuelve stock, marca Devuelto, calcula qué reembolsar),
replay/doble clic idempotente, solo se puede devolver un `Entregado` (no `Pendiente` ni
`Cancelado`), motivo obligatorio, cross-local rechazado, inexistente rechazado, acepta id u
objeto completo, solo señal a reembolsar cuando no hubo resto, líneas manuales no tocan
stock. Postgres real (3 casos): `Devuelto` aceptado en el espejo, bloquea nuevos cobros
igual que `Cancelado`, un estado inventado sigue rechazado.

## Regresión

`tests/pm10/p08-encargos-contract.mjs`, `tests/pm14/p01`, `p02`, `p03`, `p04`,
`tests/pm07/frontend-contract.mjs`, `tests/pm09/*.mjs`, y `tests/pm14/db/p02-postgres-contract.mjs`
(re-ejecutado tras aplicar también la migración de P05) — sin regresiones.
`venderLote`/`venderLineas`/`venderLocal`/`venderCarrito`/`anularVenta` no se tocan.

## Estado de main/producción

`main` = `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`, sin tocar. Migración aplicada
únicamente en `L&A Suite QA` (`qjqorixtkilwsndqayyx`). `L&A Suite` (producción) y `TPV`
(ajeno a Proyecto A) no se han tocado.
