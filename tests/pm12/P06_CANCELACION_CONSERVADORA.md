# PM12 · P06 — Cancelación conservadora de conteos

Fecha: 2026-09-07  
Rama: `pm12-conteo-estados-honestos`

## Contrato cerrado

- Solo un `BORRADOR` completamente vacío puede eliminarse físicamente.
- Un conteo iniciado (`EN_CURSO`) o cerrado (`PARCIAL` / `COMPLETADO`) se conserva como `CANCELADO`.
- La cancelación exige motivo y responsable.
- Se registran fecha de cancelación, estado anterior, identidad de operación y reversos vinculados.
- Los ajustes de stock previos se revierten con movimientos nuevos; nunca se borran movimientos históricos.
- Cada reverso usa un `movimientoId` determinista por movimiento original, por lo que un reintento no duplica stock.
- Repetir la cancelación de un documento ya cancelado devuelve `replayed: true`.
- Los documentos antiguos con `cancelado: true` se normalizan de forma conservadora a `CANCELADO` aunque conserven un estado antiguo.
- El historial muestra explícitamente `Cancelado`; no disfraza el documento como completado o en curso.
- Se mantienen las garantías de P02–P05.

## Límites

P06 modifica únicamente la rama de QA. No añade migraciones, no escribe en Supabase y no modifica producción.

**PM12_P06_CANCELACION_CONSERVADORA=PASS**
