# Punto 2 -- Matriz completa de 134 (142) pruebas: reconstrucción honesta

Rama: `claude/punto2-134-pruebas`, creada desde `release` vigente (`6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d`). Ver el informe de clasificación (`INFORME_CLASIFICACION.md`) para la explicación completa de por qué esta matriz no reproduce el informe original perdido y qué criterio se usó en su lugar.

## Totales

- Total de archivos `.mjs` bajo `tests/` inventariados: **142**
- **PASS** (ejecución real, verificado): **122**
- **Contrato histórico obsoleto** (comportamiento confirmado intacto bajo código renombrado/refactorizado, NO es un defecto): **10**
- **Infraestructura** (utilidades que no son casos de prueba, o hueco del arnés de prueba, NO es un defecto de producto): **5**
- **No aplicable** (scripts de diagnóstico de solo lectura, sin semántica PASS/FAIL): **5**
- **Defectos actuales de producto confirmados**: **0**

## Tabla completa

| # | Archivo | Área funcional | Resultado histórico | Resultado actual | Entorno requerido | Clasificación |
|---|---------|-----------------|----------------------|-------------------|--------------------|----------------|
| 1 | `tests/g1/p02-evidence-map-contract.mjs` | G1 (puerta de evidencia/cierre base) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (161ms) | Node puro | PASS |
| 2 | `tests/g1/p03-la019-contract.mjs` | G1 (puerta de evidencia/cierre base) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (76ms) | Node puro | PASS |
| 3 | `tests/g1/p04-la023-contract.mjs` | G1 (puerta de evidencia/cierre base) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (880ms) | Node puro | PASS |
| 4 | `tests/g1/p05-permisos-aislamiento-contract.mjs` | G1 (puerta de evidencia/cierre base) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (50ms) | Node puro | PASS |
| 5 | `tests/g1/p06-cifras-conciliaciones-contract.mjs` | G1 (puerta de evidencia/cierre base) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (51ms) | Node puro | PASS |
| 6 | `tests/g1/p07-concurrencia-replay-contract.mjs` | G1 (puerta de evidencia/cierre base) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (54ms) | Node puro | PASS |
| 7 | `tests/g1/p08-la004-gate-contract.mjs` | G1 (puerta de evidencia/cierre base) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | FAIL (2/-- comprobaciones) | Node puro | contrato_obsoleto |
| 8 | `tests/hotfix-barrera-reset-local.mjs` | Barrera de reset local (hotfix) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (64ms) | Node puro | PASS |
| 9 | `tests/netlify-publish-boundary.mjs` | Frontera de publicación Netlify | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (tras generar prerrequisito) | Node puro + build previo (.netlify-dist) | PASS |
| 10 | `tests/p1-empty-kv-first-run.mjs` | Arranque en KV vacío (primer uso) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (208ms) | Node puro | PASS |
| 11 | `tests/pm04/contract-tests.mjs` | PM04 (base regresión) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (55ms) | Node puro | PASS |
| 12 | `tests/pm05/frontend-contract.mjs` | PM05 (proveedores/clientes multiempresa) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | FAIL (1 comprobación) | Node puro | contrato_obsoleto |
| 13 | `tests/pm07/frontend-contract.mjs` | PM07 (venta/traspasos stock, RPC) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | FAIL (7 comprobaciones) | Node puro | contrato_obsoleto |
| 14 | `tests/pm08/frontend-contract.mjs` | PM08 (caja/movimientos, storage por usuario) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | FAIL (1 comprobación) | Node puro | contrato_obsoleto |
| 15 | `tests/pm08/migration-contract.mjs` | PM08 (caja/movimientos, storage por usuario) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (51ms) | Node puro | PASS |
| 16 | `tests/pm08/replay-scope-contract.mjs` | PM08 (caja/movimientos, storage por usuario) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (53ms) | Node puro | PASS |
| 17 | `tests/pm09/la007-results-contract.mjs` | PM09 (resultados, IVA, robustez frontend) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (93ms) | Node puro | PASS |
| 18 | `tests/pm09/la008-rotation-margin-contract.mjs` | PM09 (resultados, IVA, robustez frontend) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (159ms) | Node puro | PASS |
| 19 | `tests/pm09/p09-historial-contract.mjs` | PM09 (resultados, IVA, robustez frontend) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (106ms) | Node puro | PASS |
| 20 | `tests/pm09/p10-caja-contract.mjs` | PM09 (resultados, IVA, robustez frontend) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (100ms) | Node puro | PASS |
| 21 | `tests/pm09/p11-iva-contract.mjs` | PM09 (resultados, IVA, robustez frontend) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (109ms) | Node puro | PASS |
| 22 | `tests/pm09/p12-resultados-margin-contract.mjs` | PM09 (resultados, IVA, robustez frontend) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (145ms) | Node puro | PASS |
| 23 | `tests/pm09/p15-special-economic-contract.mjs` | PM09 (resultados, IVA, robustez frontend) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (92ms) | Node puro | PASS |
| 24 | `tests/pm09/p16-isolation-context-contract.mjs` | PM09 (resultados, IVA, robustez frontend) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (111ms) | Node puro | PASS |
| 25 | `tests/pm09/p17-robustness-contract.mjs` | PM09 (resultados, IVA, robustez frontend) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | FAIL (1 comprobación) | Node puro | contrato_obsoleto |
| 26 | `tests/pm10/p04-productos-contract.mjs` | PM10 (productos, pedidos, personal, autoridad) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (102ms) | Node puro | PASS |
| 27 | `tests/pm10/p05-pedidos-contract.mjs` | PM10 (productos, pedidos, personal, autoridad) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (84ms) | Node puro | PASS |
| 28 | `tests/pm10/p06-recepcion-contract.mjs` | PM10 (productos, pedidos, personal, autoridad) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (97ms) | Node puro | PASS |
| 29 | `tests/pm10/p07-personal-contract.mjs` | PM10 (productos, pedidos, personal, autoridad) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (104ms) | Node puro | PASS |
| 30 | `tests/pm10/p08-encargos-contract.mjs` | PM10 (productos, pedidos, personal, autoridad) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (90ms) | Node puro | PASS |
| 31 | `tests/pm10/p09-transversal-contract.mjs` | PM10 (productos, pedidos, personal, autoridad) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (97ms) | Node puro | PASS |
| 32 | `tests/pm10/p10-autoridad-persistencia-contract.mjs` | PM10 (productos, pedidos, personal, autoridad) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (91ms) | Node puro | PASS |
| 33 | `tests/pm10/p11-robustez-altas-contract.mjs` | PM10 (productos, pedidos, personal, autoridad) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (92ms) | Node puro | PASS |
| 34 | `tests/pm10/p12-datos-legados-contract.mjs` | PM10 (productos, pedidos, personal, autoridad) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (95ms) | Node puro | PASS |
| 35 | `tests/pm10/p13-contexto-aislamiento-contract.mjs` | PM10 (productos, pedidos, personal, autoridad) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (97ms) | Node puro | PASS |
| 36 | `tests/pm11-compra/p02-contrato-e2e-estados-contract.mjs` | PM11 (compras: recepciones, albarán, factura, pago) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (50ms) | Node puro | PASS |
| 37 | `tests/pm11-compra/p03-recepciones-multiples-replay-contract.mjs` | PM11 (compras: recepciones, albarán, factura, pago) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (104ms) | Node puro | PASS |
| 38 | `tests/pm11-compra/p04-albaran-trazabilidad-contract.mjs` | PM11 (compras: recepciones, albarán, factura, pago) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (84ms) | Node puro | PASS |
| 39 | `tests/pm11-compra/p05-factura-identidad-contract.mjs` | PM11 (compras: recepciones, albarán, factura, pago) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (101ms) | Node puro | PASS |
| 40 | `tests/pm11-compra/p06-pago-reverso-e2e-contract.mjs` | PM11 (compras: recepciones, albarán, factura, pago) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (94ms) | Node puro | PASS |
| 41 | `tests/pm11-compra/p07-aislamiento-permisos-e2e-contract.mjs` | PM11 (compras: recepciones, albarán, factura, pago) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (76ms) | Node puro | PASS |
| 42 | `tests/pm11-compra/p08-fallos-replay-concurrencia-contract.mjs` | PM11 (compras: recepciones, albarán, factura, pago) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (101ms) | Node puro | PASS |
| 43 | `tests/pm11-compra/p09-conciliacion-e2e-contract.mjs` | PM11 (compras: recepciones, albarán, factura, pago) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (96ms) | Node puro | PASS |
| 44 | `tests/pm11-compra/p10-regresion-integral-contract.mjs` | PM11 (compras: recepciones, albarán, factura, pago) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (84ms) | Node puro | PASS |
| 45 | `tests/pm12/db/p08-postgres-contract.mjs` | PM12 (conteos/inventario, stock atómico) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (13/13 marcas) | Postgres 16 real (local, desechable) | PASS |
| 46 | `tests/pm12/p01-checkpoint-inventario-contract.mjs` | PM12 (conteos/inventario, stock atómico) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (89ms) | Node puro | PASS |
| 47 | `tests/pm12/p02-estados-normalizacion-contract.mjs` | PM12 (conteos/inventario, stock atómico) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (51ms) | Node puro | PASS |
| 48 | `tests/pm12/p03-documento-corte-contract.mjs` | PM12 (conteos/inventario, stock atómico) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (53ms) | Node puro | PASS |
| 49 | `tests/pm12/p04-cierre-honesto-ux-contract.mjs` | PM12 (conteos/inventario, stock atómico) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (95ms) | Node puro | PASS |
| 50 | `tests/pm12/p05-ajustes-trazables-contract.mjs` | PM12 (conteos/inventario, stock atómico) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (103ms) | Node puro | PASS |
| 51 | `tests/pm12/p06-cancelacion-conservadora-contract.mjs` | PM12 (conteos/inventario, stock atómico) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (120ms) | Node puro | PASS |
| 52 | `tests/pm12/p07-permisos-aislamiento-ajustes-contract.mjs` | PM12 (conteos/inventario, stock atómico) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (107ms) | Node puro | PASS |
| 53 | `tests/pm12/p08-fallos-replay-concurrencia-contract.mjs` | PM12 (conteos/inventario, stock atómico) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (94ms) | Node puro | PASS |
| 54 | `tests/pm12/p08-instancias-fallos-contract.mjs` | PM12 (conteos/inventario, stock atómico) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (107ms) | Node puro | PASS |
| 55 | `tests/pm12/p09-aplicar-index.mjs` | PM12 (conteos/inventario, stock atómico) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | N/A (no es caso de prueba) | Node puro | infraestructura |
| 56 | `tests/pm12/p09-historial-informes-movil-contract.mjs` | PM12 (conteos/inventario, stock atómico) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (85ms) | Node puro | PASS |
| 57 | `tests/pm12/p10-preview-smoke-contract.mjs` | PM12 (conteos/inventario, stock atómico) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | FAIL (excepción no capturada) | Node puro (vm sandbox) | infraestructura |
| 58 | `tests/pm12/supabase-full/p08-auth-postgrest-rls-contract.mjs` | PM12 (conteos/inventario, stock atómico) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (3/3 marcas) | Auth + PostgREST + Postgres reales (Docker, solo disponible en CI) | PASS |
| 59 | `tests/pm12/supabase-full/p08-production-baseline-contract.mjs` | PM12 (conteos/inventario, stock atómico) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (4/4 marcas) | Auth + PostgREST + Postgres reales (Docker, solo disponible en CI) | PASS |
| 60 | `tests/pm12/supabase-full/prepare-fixture.mjs` | PM12 (conteos/inventario, stock atómico) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | N/A (no es caso de prueba) | Node puro (utilidad de fixtures) | infraestructura |
| 61 | `tests/pm12/supabase-full/prepare-production-baseline.mjs` | PM12 (conteos/inventario, stock atómico) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | N/A (no es caso de prueba) | Node puro (utilidad de fixtures) | infraestructura |
| 62 | `tests/pm13/p01-altas-bajas-personal-contract.mjs` | PM13 (personal: turnos, fichajes, ausencias, nóminas) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (107ms) | Node puro | PASS |
| 63 | `tests/pm13/p01-backend-personal-contract.mjs` | PM13 (personal: turnos, fichajes, ausencias, nóminas) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (52ms) | Node puro | PASS |
| 64 | `tests/pm13/p01-diagnostico-personal.mjs` | PM13 (personal: turnos, fichajes, ausencias, nóminas) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | N/A (diagnóstico, sin PASS/FAIL) | Node puro | no_aplicable |
| 65 | `tests/pm13/p01-rpc-personal-contract.mjs` | PM13 (personal: turnos, fichajes, ausencias, nóminas) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (99ms) | Node puro | PASS |
| 66 | `tests/pm13/p02-diagnostico-turnos.mjs` | PM13 (personal: turnos, fichajes, ausencias, nóminas) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | N/A (diagnóstico, sin PASS/FAIL) | Node puro | no_aplicable |
| 67 | `tests/pm13/p02-turnos-contract.mjs` | PM13 (personal: turnos, fichajes, ausencias, nóminas) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (84ms) | Node puro | PASS |
| 68 | `tests/pm13/p03-backend-fichajes-contract.mjs` | PM13 (personal: turnos, fichajes, ausencias, nóminas) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (53ms) | Node puro | PASS |
| 69 | `tests/pm13/p03-diagnostico-fichajes.mjs` | PM13 (personal: turnos, fichajes, ausencias, nóminas) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | N/A (diagnóstico, sin PASS/FAIL) | Node puro | no_aplicable |
| 70 | `tests/pm13/p03-fichajes-contract.mjs` | PM13 (personal: turnos, fichajes, ausencias, nóminas) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (102ms) | Node puro | PASS |
| 71 | `tests/pm13/p04-ausencias-contract.mjs` | PM13 (personal: turnos, fichajes, ausencias, nóminas) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (83ms) | Node puro | PASS |
| 72 | `tests/pm13/p04-backend-ausencias-contract.mjs` | PM13 (personal: turnos, fichajes, ausencias, nóminas) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (51ms) | Node puro | PASS |
| 73 | `tests/pm13/p04-diagnostico-ausencias.mjs` | PM13 (personal: turnos, fichajes, ausencias, nóminas) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | N/A (diagnóstico, sin PASS/FAIL) | Node puro | no_aplicable |
| 74 | `tests/pm13/p05-vacaciones-contract.mjs` | PM13 (personal: turnos, fichajes, ausencias, nóminas) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (78ms) | Node puro | PASS |
| 75 | `tests/pm13/p06-costes-personal-contract.mjs` | PM13 (personal: turnos, fichajes, ausencias, nóminas) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (85ms) | Node puro | PASS |
| 76 | `tests/pm13/p07-diagnostico-ia-nominas.mjs` | PM13 (personal: turnos, fichajes, ausencias, nóminas) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | N/A (diagnóstico, sin PASS/FAIL) | Node puro | no_aplicable |
| 77 | `tests/pm13/p07-ia-nominas-revision-contract.mjs` | PM13 (personal: turnos, fichajes, ausencias, nóminas) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (93ms) | Node puro | PASS |
| 78 | `tests/pm14/db/p02-postgres-contract.mjs` | PM14 (encargos y pagos de encargo) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (9/9 marcas) | Postgres 16 real (local, desechable) | PASS |
| 79 | `tests/pm14/db/p05-postgres-contract.mjs` | PM14 (encargos y pagos de encargo) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (3/3 marcas) | Postgres 16 real (local, desechable) | PASS |
| 80 | `tests/pm14/db/p07-postgres-concurrencia-contract.mjs` | PM14 (encargos y pagos de encargo) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (1/1 marca) | Postgres 16 real (local, desechable) | PASS |
| 81 | `tests/pm14/p01-encargos-identidad-contract.mjs` | PM14 (encargos y pagos de encargo) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (80ms) | Node puro | PASS |
| 82 | `tests/pm14/p02-encargos-frontend-contract.mjs` | PM14 (encargos y pagos de encargo) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (6090ms) | Node puro | PASS |
| 83 | `tests/pm14/p03-encargos-entrega-contract.mjs` | PM14 (encargos y pagos de encargo) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (86ms) | Node puro | PASS |
| 84 | `tests/pm14/p04-encargos-cancelacion-contract.mjs` | PM14 (encargos y pagos de encargo) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (85ms) | Node puro | PASS |
| 85 | `tests/pm14/p05-encargos-devolucion-contract.mjs` | PM14 (encargos y pagos de encargo) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (89ms) | Node puro | PASS |
| 86 | `tests/pm14/p06-clientes-aislamiento-contract.mjs` | PM14 (encargos y pagos de encargo) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (92ms) | Node puro | PASS |
| 87 | `tests/pm14/p07-encargos-concurrencia-contract.mjs` | PM14 (encargos y pagos de encargo) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (6084ms) | Node puro | PASS |
| 88 | `tests/pm14/p08-encargos-historial-contract.mjs` | PM14 (encargos y pagos de encargo) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (88ms) | Node puro | PASS |
| 89 | `tests/pm15/p01-la022-locales-empresa-contract.mjs` | PM15 (contexto empresa/local en modales, protección de borradores) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (81ms) | Node puro | PASS |
| 90 | `tests/pm15/p01-nr08-cambio-contexto-no-alcanzable-contract.mjs` | PM15 (contexto empresa/local en modales, protección de borradores) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (85ms) | Node puro | PASS |
| 91 | `tests/pm15/p02-mej01-contexto-modales-contract.mjs` | PM15 (contexto empresa/local en modales, protección de borradores) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | FAIL (1a comprobación) | Node puro | contrato_obsoleto |
| 92 | `tests/pm15/p03-mej02-confirmacion-pago-destino-contract.mjs` | PM15 (contexto empresa/local en modales, protección de borradores) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (79ms) | Node puro | PASS |
| 93 | `tests/pm15/p04-nr08-proteccion-borrador-navegacion-contract.mjs` | PM15 (contexto empresa/local en modales, protección de borradores) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | FAIL (bloque "superficies protegidas") | Node puro | contrato_obsoleto |
| 94 | `tests/pm16/p01-la025-loadkey-fallos-contract.mjs` | PM16 (fallos de carga LA-025) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (1136ms) | Node puro | PASS |
| 95 | `tests/pm16/p01-la025-ui-fallos-carga-contract.mjs` | PM16 (fallos de carga LA-025) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (90ms) | Node puro | PASS |
| 96 | `tests/pm17/p01-rollback-push-nativo-contract.mjs` | PM17 (wiring nativo: notificaciones, login/logout, auth UX) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (80ms) | Node puro | PASS |
| 97 | `tests/pm17/p01-wiring-notificaciones-contract.mjs` | PM17 (wiring nativo: notificaciones, login/logout, auth UX) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (74ms) | Node puro | PASS |
| 98 | `tests/pm17/p02-neutralidad-informes-nativo-contract.mjs` | PM17 (wiring nativo: notificaciones, login/logout, auth UX) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (80ms) | Node puro | PASS |
| 99 | `tests/pm17/p02-wiring-seleccionpersonal-contract.mjs` | PM17 (wiring nativo: notificaciones, login/logout, auth UX) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (77ms) | Node puro | PASS |
| 100 | `tests/pm17/p03-auth-ux-nativo-contract.mjs` | PM17 (wiring nativo: notificaciones, login/logout, auth UX) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (74ms) | Node puro | PASS |
| 101 | `tests/pm17/p03-wiring-login-logout-contract.mjs` | PM17 (wiring nativo: notificaciones, login/logout, auth UX) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | FAIL (1 comprobación) | Node puro | contrato_obsoleto |
| 102 | `tests/pm17/p04-retirar-parches-externos-contract.mjs` | PM17 (wiring nativo: notificaciones, login/logout, auth UX) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (82ms) | Node puro | PASS |
| 103 | `tests/pm18/p01-identidad-fiscal-contract.mjs` | PM18 (identidad fiscal) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (76ms) | Node puro | PASS |
| 104 | `tests/pm18/p01-wiring-identidad-fiscal-contract.mjs` | PM18 (identidad fiscal) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (87ms) | Node puro | PASS |
| 105 | `tests/pm19/p01-appcc-historico-trazable-contract.mjs` | PM19 (APPCC, aceite, merma, guardia de escritura) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (80ms) | Node puro | PASS |
| 106 | `tests/pm19/p01-wiring-appcc-contract.mjs` | PM19 (APPCC, aceite, merma, guardia de escritura) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (81ms) | Node puro | PASS |
| 107 | `tests/pm19/p02-aceite-responsable-contract.mjs` | PM19 (APPCC, aceite, merma, guardia de escritura) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (79ms) | Node puro | PASS |
| 108 | `tests/pm19/p02-wiring-aceite-contract.mjs` | PM19 (APPCC, aceite, merma, guardia de escritura) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (76ms) | Node puro | PASS |
| 109 | `tests/pm19/p03-wiring-traspasos-contract.mjs` | PM19 (APPCC, aceite, merma, guardia de escritura) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (76ms) | Node puro | PASS |
| 110 | `tests/pm19/p04-merma-descuenta-una-vez-contract.mjs` | PM19 (APPCC, aceite, merma, guardia de escritura) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (75ms) | Node puro | PASS |
| 111 | `tests/pm19/p04-wiring-merma-contract.mjs` | PM19 (APPCC, aceite, merma, guardia de escritura) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (81ms) | Node puro | PASS |
| 112 | `tests/pm19/p05-comportamiento-guardia-contract.mjs` | PM19 (APPCC, aceite, merma, guardia de escritura) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (97ms) | Node puro | PASS |
| 113 | `tests/pm19/p05-inventario-mutaciones-protegidas-contract.mjs` | PM19 (APPCC, aceite, merma, guardia de escritura) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (82ms) | Node puro | PASS |
| 114 | `tests/pm19/p05-validar-contexto-escritura-contract.mjs` | PM19 (APPCC, aceite, merma, guardia de escritura) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (77ms) | Node puro | PASS |
| 115 | `tests/pm20/p01-checkpoint-inventario-contract.mjs` | PM20 (dashboard, tesorería, proveedores, auditoría) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (283ms) | Node puro | PASS |
| 116 | `tests/pm20/p02-comportamiento-proveedor-contract.mjs` | PM20 (dashboard, tesorería, proveedores, auditoría) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (83ms) | Node puro | PASS |
| 117 | `tests/pm20/p02-la014-fecha-esperada-pedido-contract.mjs` | PM20 (dashboard, tesorería, proveedores, auditoría) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (95ms) | Node puro | PASS |
| 118 | `tests/pm20/p02-wiring-proveedores-contract.mjs` | PM20 (dashboard, tesorería, proveedores, auditoría) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (77ms) | Node puro | PASS |
| 119 | `tests/pm20/p03-dashboard-informes-resultados-contract.mjs` | PM20 (dashboard, tesorería, proveedores, auditoría) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (78ms) | Node puro | PASS |
| 120 | `tests/pm20/p04-tesoreria-estacionalidad-saldo-mapa-contract.mjs` | PM20 (dashboard, tesorería, proveedores, auditoría) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (85ms) | Node puro | PASS |
| 121 | `tests/pm20/p05-buscador-etiquetas-auditoria-contract.mjs` | PM20 (dashboard, tesorería, proveedores, auditoría) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | FAIL (1 comprobación) | Node puro | contrato_obsoleto |
| 122 | `tests/pm20/p06-errores-sistema-aislamiento-contract.mjs` | PM20 (dashboard, tesorería, proveedores, auditoría) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (77ms) | Node puro | PASS |
| 123 | `tests/pm20/p07-revalidacion-acumulada-contract.mjs` | PM20 (dashboard, tesorería, proveedores, auditoría) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (79ms) | Node puro | PASS |
| 124 | `tests/pm20/p08-restauracion-qa-contract.mjs` | PM20 (dashboard, tesorería, proveedores, auditoría) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (96ms) | Node puro | PASS |
| 125 | `tests/pm26/defecto-l-context-hotfix.test.mjs` | PM26 (hotfix contexto Defecto L) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | FAIL (excepción no capturada) | Node puro (vm sandbox) | infraestructura |
| 126 | `tests/pm27-mobile-logout-modal-fix.mjs` | PM27 (restauración RPC / logout móvil) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (52ms) | Node puro | PASS |
| 127 | `tests/pm27-restore-c24-operational-rpcs.mjs` | PM27 (restauración RPC / logout móvil) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (48ms) | Node puro | PASS |
| 128 | `tests/pm29/p01-locales-desactivar-propietario-contract.mjs` | PM29 (desactivar empresas/locales, adopción de contexto) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (82ms) | Node puro | PASS |
| 129 | `tests/pm29/p02-empresas-desactivar-propietario-contract.mjs` | PM29 (desactivar empresas/locales, adopción de contexto) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (86ms) | Node puro | PASS |
| 130 | `tests/pm29/p03-adopcion-contexto-contract.mjs` | PM29 (desactivar empresas/locales, adopción de contexto) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (79ms) | Node puro | PASS |
| 131 | `tests/pm31/p01-bloqueo-programa-no-cargado-contract.mjs` | PM31 (bloqueo programa no cargado) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (10459ms) | Node puro | PASS |
| 132 | `tests/pm32/p01-selector-empresa-y-local-contract.mjs` | PM32 (selector empresa y local) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (93ms) | Node puro | PASS |
| 133 | `tests/pm33/db/contrato-vigente-contract.mjs` | PM33 (aislamiento obtener_contexto_operativo, R10) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (39/39) | Postgres 16 real (local, desechable) | PASS |
| 134 | `tests/pm33/db/p01-aislamiento-multiempresa-contract.mjs` | PM33 (aislamiento obtener_contexto_operativo, R10) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | FAIL (1/38, deliberado) | Postgres 16 real (local, desechable) | contrato_obsoleto |
| 135 | `tests/pm33/db/p02-regresion-rol-no-gestionado.mjs` | PM33 (aislamiento obtener_contexto_operativo, R10) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (7/7) | Postgres 16 real (local, desechable) | PASS |
| 136 | `tests/pm33/db/p03-aislamiento-camarero-contract.mjs` | PM33 (aislamiento obtener_contexto_operativo, R10) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (17/17) | Postgres 16 real (local, desechable) | PASS |
| 137 | `tests/pm33/db/p04-identidad-y-revocacion-contract.mjs` | PM33 (aislamiento obtener_contexto_operativo, R10) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (12/12) | Postgres 16 real (local, desechable) | PASS |
| 138 | `tests/pm33/db/p05-identidad-antes-de-actividad-contract.mjs` | PM33 (aislamiento obtener_contexto_operativo, R10) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (6/6) | Postgres 16 real (local, desechable) | PASS |
| 139 | `tests/pm33/p03-frontend-multilocal-contract.mjs` | PM33 (aislamiento obtener_contexto_operativo, R10) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (91ms) | Node puro | PASS |
| 140 | `tests/pm33/supabase-full/p05-auth-postgrest-contract.mjs` | PM33 (aislamiento obtener_contexto_operativo, R10) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (15/15) | Auth + PostgREST + Postgres 17 reales (Docker, solo disponible en CI) | PASS |
| 141 | `tests/post-reset-schema-contract.mjs` | Post-reset (barrera de arranque tras reinicio) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (79ms) | Node puro | PASS |
| 142 | `tests/ui-context-bridge.mjs` | Puente de contexto UI (empresa/local) | Desconocido -- informe original no localizado (ver Punto 2, sección "Fuente 134 pruebas") | PASS (58ms) | Node puro | PASS |

## Detalle de evidencia (todo lo que no es PASS simple, y los casos DB/red)

### `tests/g1/p08-la004-gate-contract.mjs`

- **Clasificación**: contrato_obsoleto
- **Resultado actual**: FAIL (2/-- comprobaciones)
- **Entorno**: Node puro
- **Evidencia y acción**: REBUILD_VERIFIES_BASE_SHA/TARGET_SHA=0: el test exige el literal "manifest.baseArtifactSha256" en source-recovery/rebuild-current.mjs; el script real usa requireString(manifest, 'baseArtifactSha256') (formato de manifiesto v2, con validación añadida). Verificación de SHA confirmada presente por otra vía (grep). No es un defecto.

### `tests/pm05/frontend-contract.mjs`

- **Clasificación**: contrato_obsoleto
- **Resultado actual**: FAIL (1 comprobación)
- **Entorno**: Node puro
- **Evidencia y acción**: "alta proveedor no fija empresa": el test exige el literal "const nuevo = { id: uid(), ...data, empresaId };"; el código real usa "...validacion.datos" en vez de "...data" (se añadió una capa de validación de datos antes del spread). empresaId se sigue fijando igual. No es un defecto -- endurecimiento posterior.

### `tests/pm07/frontend-contract.mjs`

- **Clasificación**: contrato_obsoleto
- **Resultado actual**: FAIL (7 comprobaciones)
- **Entorno**: Node puro
- **Evidencia y acción**: venta_rpc_pm07/reverso_rpc_pm07: RPC renombradas a registrar_venta_stock_carrito_pm09/revertir_venta_stock_carrito_pm09 en una ronda posterior (confirmado en fuente.js). alertas_pm07_parentesis/tpv_precheck_autoritativo/tpv_vendibles_autoritativo/reconciliacion_cloud_autoritativa/reconciliacion_cloud_no_muta_local: el bundle actual renombró las variables locales p2->p22 y l2->l22 (artefacto del empaquetador), la lógica exacta sigue presente palabra por palabra salvo el nombre de variable (confirmado por grep). No son defectos.

### `tests/pm08/frontend-contract.mjs`

- **Clasificación**: contrato_obsoleto
- **Resultado actual**: FAIL (1 comprobación)
- **Entorno**: Node puro
- **Evidencia y acción**: movimiento_bloquea_arqueo_activo: el test exige el literal "a2.estado !== \"ANULADO\""; el bundle actual usa "a22.estado !== \"ANULADO\"" (mismo renombrado p2->p22/a2->a22 del empaquetador). La comprobación de bloqueo por arqueo activo sigue presente (confirmado por grep, línea 104925 de fuente.js). No es un defecto.

### `tests/pm09/p17-robustness-contract.mjs`

- **Clasificación**: contrato_obsoleto
- **Resultado actual**: FAIL (1 comprobación)
- **Entorno**: Node puro
- **Evidencia y acción**: FRONTEND_PENDING_PAYLOAD_CONFLICT: el test busca el texto "Hay una operación anterior pendiente en este local"; el mensaje real es ahora "Hay una operación sin confirmar. Reinténtala antes de iniciar otra." -- misma protección (bloquear submit con una operación previa sin confirmar), solo cambió el texto mostrado al usuario. No es un defecto.

### `tests/pm12/db/p08-postgres-contract.mjs`

- **Clasificación**: PASS
- **Resultado actual**: PASS (13/13 marcas)
- **Entorno**: Postgres 16 real (local, desechable)
- **Evidencia y acción**: Ejecutado contra pm12_p08_test (Postgres 16.13 local). Todas las marcas P08_PG_*=PASS, P08_POSTGRES_ISOLATED_CONTRACT=PASS.

### `tests/pm12/p09-aplicar-index.mjs`

- **Clasificación**: infraestructura
- **Resultado actual**: N/A (no es caso de prueba)
- **Entorno**: Node puro
- **Evidencia y acción**: Script de aplicación (integra pm12-p09-historial-informes-movil-v1.js en index.html), no es un caso de prueba: no afirma ni PASS ni FAIL, muta index.html (idempotente). Ejecutado: P09_INDEX_YA_INTEGRADO=PASS (no-op, ya estaba integrado).

### `tests/pm12/p10-preview-smoke-contract.mjs`

- **Clasificación**: infraestructura
- **Resultado actual**: FAIL (excepción no capturada)
- **Entorno**: Node puro (vm sandbox)
- **Evidencia y acción**: TypeError: window.setInterval is not a function. reset-pruebas-preview.js ganó, en una ronda posterior (barrera temprana post-reset), un window.setInterval(...) en la ruta de producción (hostname no-preview) que el objeto "window" simulado de este test nunca definió porque no existía cuando se escribió. Un navegador real siempre tiene setInterval; es un hueco del arnés de prueba, no del producto. Confirmado reproduciendo el mismo script con setInterval mockeado: no hay más fallos.

### `tests/pm12/supabase-full/p08-auth-postgrest-rls-contract.mjs`

- **Clasificación**: PASS
- **Resultado actual**: PASS (3/3 marcas)
- **Entorno**: Auth + PostgREST + Postgres reales (Docker, solo disponible en CI)
- **Evidencia y acción**: Sin Docker operativo en el entorno local: ejecutado vía .github/workflows/punto2-p08-supabase-full.yml, run 35492977065, job pm12-p08-supabase-full, SUCCESS. P08_SUPABASE_AUTH_POSTGREST_CONCURRENT_REPLAY=PASS, P08_SUPABASE_RLS_SCOPE_AND_DIRECT_WRITE_DENIED=PASS, P08_SUPABASE_AUTH_POSTGREST_CONCURRENT_CANCEL=PASS, PM12_P08_SUPABASE_FULL_STACK=PASS.

### `tests/pm12/supabase-full/p08-production-baseline-contract.mjs`

- **Clasificación**: PASS
- **Resultado actual**: PASS (4/4 marcas)
- **Entorno**: Auth + PostgREST + Postgres reales (Docker, solo disponible en CI)
- **Evidencia y acción**: Mismo run 35492977065, job pm12-p08-supabase-full, SUCCESS. PM12_PROD_BASELINE_MINIMAL=PASS, PM12_PROD_BASELINE_RLS_GRANTS=PASS, PM12_PROD_BASELINE_P08_CONSTRAINTS=PASS, PM12_PROD_BASELINE_NO_QA_OBJECTS=PASS.

### `tests/pm12/supabase-full/prepare-fixture.mjs`

- **Clasificación**: infraestructura
- **Resultado actual**: N/A (no es caso de prueba)
- **Entorno**: Node puro (utilidad de fixtures)
- **Evidencia y acción**: Utilidad de preparación de fixtures para p08-postgres-contract.mjs (copia 2 migraciones a un directorio temporal). No es un caso de prueba independiente.

### `tests/pm12/supabase-full/prepare-production-baseline.mjs`

- **Clasificación**: infraestructura
- **Resultado actual**: N/A (no es caso de prueba)
- **Entorno**: Node puro (utilidad de fixtures)
- **Evidencia y acción**: Utilidad de preparación de la baseline productiva para los tests de Auth/PostgREST de PM12 P08 (reconstruye supabase/migrations temporal). No es un caso de prueba independiente.

### `tests/pm13/p01-diagnostico-personal.mjs`

- **Clasificación**: no_aplicable
- **Resultado actual**: N/A (diagnóstico, sin PASS/FAIL)
- **Entorno**: Node puro
- **Evidencia y acción**: Diagnóstico de solo lectura (inspecciona fuente.js por patrones de texto y escribe P01_DIAGNOSTICO_PERSONAL.json). Sin aserciones PASS/FAIL. Ejecutado: corre sin error, pero la evidencia JSON que ya estaba commiteada estaba desactualizada respecto al fuente.js actual (sourceLength distinto) -- revertido tras confirmar el hallazgo, para no alterar el árbol de trabajo con un cambio fuera del alcance de este punto.

### `tests/pm13/p02-diagnostico-turnos.mjs`

- **Clasificación**: no_aplicable
- **Resultado actual**: N/A (diagnóstico, sin PASS/FAIL)
- **Entorno**: Node puro
- **Evidencia y acción**: Igual que P01: diagnóstico de solo lectura, sin PASS/FAIL. Evidencia committeada desactualizada, revertida tras confirmarlo.

### `tests/pm13/p03-diagnostico-fichajes.mjs`

- **Clasificación**: no_aplicable
- **Resultado actual**: N/A (diagnóstico, sin PASS/FAIL)
- **Entorno**: Node puro
- **Evidencia y acción**: Igual que P01: diagnóstico de solo lectura, sin PASS/FAIL. Evidencia committeada desactualizada, revertida tras confirmarlo.

### `tests/pm13/p04-diagnostico-ausencias.mjs`

- **Clasificación**: no_aplicable
- **Resultado actual**: N/A (diagnóstico, sin PASS/FAIL)
- **Entorno**: Node puro
- **Evidencia y acción**: Igual que P01: diagnóstico de solo lectura, sin PASS/FAIL. Evidencia committeada desactualizada, revertida tras confirmarlo.

### `tests/pm13/p07-diagnostico-ia-nominas.mjs`

- **Clasificación**: no_aplicable
- **Resultado actual**: N/A (diagnóstico, sin PASS/FAIL)
- **Entorno**: Node puro
- **Evidencia y acción**: Igual que P01: diagnóstico de solo lectura, sin PASS/FAIL. Evidencia committeada desactualizada, revertida tras confirmarlo.

### `tests/pm14/db/p02-postgres-contract.mjs`

- **Clasificación**: PASS
- **Resultado actual**: PASS (9/9 marcas)
- **Entorno**: Postgres 16 real (local, desechable)
- **Evidencia y acción**: Ejecutado contra pm14_p02_test. Todas las marcas P02_PG_*=PASS.

### `tests/pm14/db/p05-postgres-contract.mjs`

- **Clasificación**: PASS
- **Resultado actual**: PASS (3/3 marcas)
- **Entorno**: Postgres 16 real (local, desechable)
- **Evidencia y acción**: Ejecutado contra pm14_p02_test. Todas las marcas P05_PG_*=PASS.

### `tests/pm14/db/p07-postgres-concurrencia-contract.mjs`

- **Clasificación**: PASS
- **Resultado actual**: PASS (1/1 marca)
- **Entorno**: Postgres 16 real (local, desechable)
- **Evidencia y acción**: Ejecutado contra pm14_p02_test. P07_PG_CONCURRENCIA_REAL_MISMO_OPERATION_ID=PASS.

### `tests/pm15/p02-mej01-contexto-modales-contract.mjs`

- **Clasificación**: contrato_obsoleto
- **Resultado actual**: FAIL (1a comprobación)
- **Entorno**: Node puro
- **Evidencia y acción**: El test exige el literal `title: "Desactivar local" }, .../* @__PURE__ */ ... "Empresa: "` en línea (JSX inline de PM15). PM29 sustituyó ese modal por el componente compartido ConfirmarConContrasenaPM29 (añade confirmación con contraseña); la línea real de invocación SÍ sigue mostrando `"Empresa: ", empresaDeLocal(confirmarDesactivar)?.razonSocial...` dentro de la prop `descripcion` (confirmado, fuente.js ~112441). El contexto de empresa se sigue mostrando; cambió la forma del componente, no la información.

### `tests/pm15/p04-nr08-proteccion-borrador-navegacion-contract.mjs`

- **Clasificación**: contrato_obsoleto
- **Resultado actual**: FAIL (bloque "superficies protegidas")
- **Entorno**: Node puro
- **Evidencia y acción**: El test exige `createElement(TopBarC, {...setTab: cambiarTabPM15` y un patrón `disenoMenu === "A" ? gruposA : gruposB`. Ninguno de los dos existe ya: el rediseño visual (PM28) sustituyó TopBarC por BarraSuperiorMovil + SidebarGrupos y retiró el conmutador de diseño A/B (gruposA/gruposB) a favor de una única lista GRUPOS. Confirmado por inspección directa: SidebarGrupos, NavInferior y BusquedaGlobal reciben "setTab: cambiarTabPM15" (el setTab protegido) exactamente igual que antes -- la protección contra pérdida de borrador sigue cableada en las 3 superficies de navegación real verificadas. No es un defecto; los otros 4 bloques de este mismo test (decidirCambioTabPM15, los 4 formularios, la composición, la navegación tras guardar) pasan sin cambios.

### `tests/pm17/p03-wiring-login-logout-contract.mjs`

- **Clasificación**: contrato_obsoleto
- **Resultado actual**: FAIL (1 comprobación)
- **Entorno**: Node puro
- **Evidencia y acción**: El test exige `window.location.href = "./restablecer-contrasena.html";` (navegación imperativa). El código real usa `createElement("a", { href: "./restablecer-contrasena.html", ... })` -- un enlace real en vez de un manejador de clic imperativo, mismo destino, técnica más idiomática/accesible. No es un defecto.

### `tests/pm20/p05-buscador-etiquetas-auditoria-contract.mjs`

- **Clasificación**: contrato_obsoleto
- **Resultado actual**: FAIL (1 comprobación)
- **Entorno**: Node puro
- **Evidencia y acción**: El test exige el literal exacto `createElement(EtiquetasCatalogo, { productos: ..., fichasCosto: ..., alergenosDeFicha })`. El código real añadió una prop más, `empresa: empresaDelLocalActivo`, delante de las tres originales (que siguen intactas) -- ampliación de props en una ronda posterior (probablemente PM32, contexto empresa/local), no una regresión.

### `tests/pm26/defecto-l-context-hotfix.test.mjs`

- **Clasificación**: infraestructura
- **Resultado actual**: FAIL (excepción no capturada)
- **Entorno**: Node puro (vm sandbox)
- **Evidencia y acción**: Mismo TypeError: window.setInterval is not a function que tests/pm12/p10-preview-smoke-contract.mjs, mismo mecanismo (barrera temprana post-reset añadida después de escribir este test, objeto "window" simulado sin setInterval). No es un defecto del producto.

### `tests/pm33/db/contrato-vigente-contract.mjs`

- **Clasificación**: PASS
- **Resultado actual**: PASS (39/39)
- **Entorno**: Postgres 16 real (local, desechable)
- **Evidencia y acción**: Ejecutado contra pm33_p05_test con fixtures completos + migración P05 real (20260919225831). TOTAL PASS=39 FAIL=0.

### `tests/pm33/db/p01-aislamiento-multiempresa-contract.mjs`

- **Clasificación**: contrato_obsoleto
- **Resultado actual**: FAIL (1/38, deliberado)
- **Entorno**: Postgres 16 real (local, desechable)
- **Evidencia y acción**: El propio repositorio documenta este archivo como registro histórico retirado (ver cabecera de tests/pm33/db/contrato-vigente-contract.mjs: "se conserva SIN modificar como registro histórico... no se toca ni se reutiliza como gate"). Falla exactamente en T14c ("empresaId permanece null"), el mismo punto que el propio equipo señala como cambio de contrato deliberado desde P03. El contrato vigente real es contrato-vigente-contract.mjs, que pasa 39/39.

### `tests/pm33/db/p02-regresion-rol-no-gestionado.mjs`

- **Clasificación**: PASS
- **Resultado actual**: PASS (7/7)
- **Entorno**: Postgres 16 real (local, desechable)
- **Evidencia y acción**: TOTAL PASS=7 FAIL=0.

### `tests/pm33/db/p03-aislamiento-camarero-contract.mjs`

- **Clasificación**: PASS
- **Resultado actual**: PASS (17/17)
- **Entorno**: Postgres 16 real (local, desechable)
- **Evidencia y acción**: TOTAL PASS=17 FAIL=0.

### `tests/pm33/db/p04-identidad-y-revocacion-contract.mjs`

- **Clasificación**: PASS
- **Resultado actual**: PASS (12/12)
- **Entorno**: Postgres 16 real (local, desechable)
- **Evidencia y acción**: TOTAL PASS=12 FAIL=0.

### `tests/pm33/db/p05-identidad-antes-de-actividad-contract.mjs`

- **Clasificación**: PASS
- **Resultado actual**: PASS (6/6)
- **Entorno**: Postgres 16 real (local, desechable)
- **Evidencia y acción**: TOTAL PASS=6 FAIL=0.

### `tests/pm33/supabase-full/p05-auth-postgrest-contract.mjs`

- **Clasificación**: PASS
- **Resultado actual**: PASS (15/15)
- **Entorno**: Auth + PostgREST + Postgres 17 reales (Docker, solo disponible en CI)
- **Evidencia y acción**: Mismo patrón ya validado en Punto 1 (PM33). run 35492977065, job pm33-p05-supabase-full, SUCCESS. TOTAL PASS=15 FAIL=0, PM33_P05_ENTORNO_AISLADO_OK=1.

