# PM12 · P05 — Ajustes trazables

Fecha: 2026-09-07  
Rama: `pm12-conteo-estados-honestos`

## Contrato cerrado

- Solo los conteos `PARCIAL` y `COMPLETADO` pueden ajustar existencias.
- Se valida el documento completo antes de generar el primer movimiento.
- Una línea vacía queda pendiente y no ajusta stock; una cantidad `0` sí es una línea contada válida.
- Cantidades negativas, no finitas, incompatibles con unidades indivisibles o con precisión excesiva bloquean todo el intento.
- Un producto ajeno al local activo bloquea todo el intento.
- Todos los movimientos del lote comparten una identidad estable derivada del conteo y su corte.
- Cada movimiento conserva `documentoOrigenId`, `origen`, ubicación afectada, tipo y motivo.
- Repetir una aplicación ya confirmada devuelve `replayed: true` y no crea movimientos nuevos.
- El conteo conserva `ajustesOperationId`, fecha de aplicación, cantidad de movimientos y traspasos asociados.
- Se mantienen las garantías de stock y ubicación de PM07.

## Límites

P05 opera únicamente sobre el estado local/controlado ya existente. No añade migraciones ni escrituras nuevas en Supabase y no modifica producción.

**PM12_P05_AJUSTES_TRAZABLES=PASS**
