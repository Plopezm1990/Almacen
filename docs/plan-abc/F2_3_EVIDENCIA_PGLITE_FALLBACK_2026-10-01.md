# F2.3 — evidencia auxiliar PGlite

Fecha: 2026-10-01  
Estado: `AUXILIAR_PASS_POSTGRES_PENDIENTE`  
Base: `origin/release` `7859508`

## Comprobación de entorno

- Docker CLI: no disponible en el entorno de ejecución.
- `psql`: no disponible en el entorno de ejecución.
- QA/PROD: no contactados y no modificados.

## Ensayo auxiliar ejecutado

Comando:

```text
node tests/f3/a09/local-pglite-contract.mjs
```

Resultado:

```text
PASS ACL/RLS
PASS split/source reconciliation
PASS idempotency/conflict
PASS cumulative role cap and rollback
PASS permission denial
PASS dual approval request, distinct signature and application
PASS cross-local and stale version
PASS partial fiscalization rejection
PASS largest-remainder rounding and untouched line version
PASS mixed-tax A08 rejection
PASS active A08 quota rejection
PASS A09.2.6 cash effect and monetary reconciliation
PASS concurrent dispatch on one PGlite connection
PASS A09.2.9 A04/A08/A09 cross regressions, idempotency and concurrency
A09_PGLITE_FUNCTIONAL=PASS
```

## Limitación

PGlite aporta regresión funcional auxiliar, pero no demuestra la compatibilidad
completa con PostgreSQL/Supabase, dos conexiones TCP independientes, extensiones,
ACL del servidor ni el comportamiento real del Data API. Por eso PG01–PG12
continúan `PENDIENTE` y la puerta F2 no se cierra.

El siguiente intento podrá ejecutarse cuando estén disponibles Docker/PostgreSQL
locales. No se requiere tocar QA/PROD ni hacer deploy de Netlify para repetirlo.
