# PM12–P08 — Fallos, replay y concurrencia

PM12_P08_FALLOS_REPLAY_CONCURRENCIA=PASS

- OFF1: el lote se prevalida completo antes de tocar productos o movimientos.
- RW1: cada pata del ajuste usa un `movimientoId` determinista derivado del `operationId`, producto y semántica.
- C1: un replay completo es no-op y no duplica stock.
- Un replay parcial se bloquea en modo fail-closed; no intenta completar un estado potencialmente incoherente.
- Un conflicto de mismo ID con payload diferente nunca sobrescribe.
- El documento de conteo solo se marca `ajustesAplicados` después de que el lote completo resulte OK.
- Se conservan `operationId`, `documentoOrigenId` y `origen: aplicarAjustes`, por lo que P05/P06 siguen trazables y reversibles.
- P07 continúa autorizando antes de entrar en la frontera de mutación.
- Garantía: lote local prevalidado + replay determinista. No se declara transacción ACID de base de datos.
- Esta implementación y sus pruebas no realizan escrituras en Supabase ni en producción.
