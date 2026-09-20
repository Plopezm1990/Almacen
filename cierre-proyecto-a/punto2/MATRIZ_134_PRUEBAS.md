# Punto 2 -- Matriz completa de las 142 pruebas (133 activas + 1 histórica + 3 utilidades + 5 diagnósticos)

Rama: `claude/punto2-134-pruebas`, commit **`6320ab9e4fd06a18932856fd2c662451120e18a2`**, creada desde `release` (`6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d`). Fuente de verdad de la clasificación: `cierre-proyecto-a/punto2/manifiesto_clasificacion.json`. Ver `INFORME_CLASIFICACION.md` para la metodología completa, la corrección tras la auditoría independiente, y por qué esta matriz no reproduce el informe original perdido.

## Puerta de CI -- resultado real, no simulado

[`run 35502655080`](https://github.com/Plopezm1990/Almacen/actions/runs/35502655080) -- **SUCCESS**, los 4 jobs (`node-y-postgres`, `pm12-p08-supabase-full`, `pm33-p05-supabase-full`, `gate-final`) en verde. Salida real del job `gate-final`:

```
ACTIVE_PASS=133
ACTIVE_FAIL=0
HISTORICAL_EXPECTED_FAIL=1
UTILITIES=3
DIAGNOSTICS=5
TOTAL_INVENTORY=142
PUNTO2_GATE_COMPLETA=PASS
```

Versiones reales confirmadas en la propia ejecución: Node **v22.23.2**, PostgreSQL **16.15** (servicio de GitHub Actions, job `node-y-postgres`), Supabase Storage **v1.72.1** (job `pm33-p05-supabase-full`; el resto del stack Auth/PostgREST/PostgreSQL 17 sigue el mismo patrón ya documentado con su detalle de versión completo en el Punto 1, `cierre-proyecto-a/pm33/HALLAZGOS_P02.md`).

## Totales

- Total de archivos `.mjs` inventariados: **142**
- **Contratos activos** (deben estar en verde, y lo están: 133/133): **133**
- **Histórico, fallo esperado** (`tests/pm33/db/p01-aislamiento-multiempresa-contract.mjs`, nunca contrato activo): **1**
- **Utilidades** (no son casos de prueba): **3**
- **Diagnósticos** (sin semántica PASS/FAIL): **5**
- **Defectos actuales de producto confirmados**: **0**

## Tabla completa (142 filas)

| # | Archivo | Clasificación | Entorno | Resultado real |
|---|---------|----------------|---------|------------------|
| 1 | `tests/g1/p02-evidence-map-contract.mjs` | Contrato activo | node | PASS (exit=0, 40ms) |
| 2 | `tests/g1/p03-la019-contract.mjs` | Contrato activo | node | PASS (exit=0, 35ms) |
| 3 | `tests/g1/p04-la023-contract.mjs` | Contrato activo | node | PASS (exit=0, 64ms) |
| 4 | `tests/g1/p05-permisos-aislamiento-contract.mjs` | Contrato activo | node | PASS (exit=0, 36ms) |
| 5 | `tests/g1/p06-cifras-conciliaciones-contract.mjs` | Contrato activo | node | PASS (exit=0, 37ms) |
| 6 | `tests/g1/p07-concurrencia-replay-contract.mjs` | Contrato activo | node | PASS (exit=0, 34ms) |
| 7 | `tests/g1/p08-la004-gate-contract.mjs` | Contrato activo | node | PASS (exit=0, 34ms) |
| 8 | `tests/hotfix-barrera-reset-local.mjs` | Contrato activo | node | PASS (exit=0, 41ms) |
| 9 | `tests/netlify-publish-boundary.mjs` | Contrato activo | node | PASS (exit=0, 91ms) |
| 10 | `tests/p1-empty-kv-first-run.mjs` | Contrato activo | node | PASS (exit=0, 69ms) |
| 11 | `tests/pm04/contract-tests.mjs` | Contrato activo | node | PASS (exit=0, 45ms) |
| 12 | `tests/pm05/frontend-contract.mjs` | Contrato activo | node | PASS (exit=0, 48ms) |
| 13 | `tests/pm07/frontend-contract.mjs` | Contrato activo | node | PASS (exit=0, 92ms) |
| 14 | `tests/pm08/frontend-contract.mjs` | Contrato activo | node | PASS (exit=0, 55ms) |
| 15 | `tests/pm08/migration-contract.mjs` | Contrato activo | node | PASS (exit=0, 36ms) |
| 16 | `tests/pm08/replay-scope-contract.mjs` | Contrato activo | node | PASS (exit=0, 32ms) |
| 17 | `tests/pm09/la007-results-contract.mjs` | Contrato activo | node | PASS (exit=0, 59ms) |
| 18 | `tests/pm09/la008-rotation-margin-contract.mjs` | Contrato activo | node | PASS (exit=0, 59ms) |
| 19 | `tests/pm09/p09-historial-contract.mjs` | Contrato activo | node | PASS (exit=0, 68ms) |
| 20 | `tests/pm09/p10-caja-contract.mjs` | Contrato activo | node | PASS (exit=0, 61ms) |
| 21 | `tests/pm09/p11-iva-contract.mjs` | Contrato activo | node | PASS (exit=0, 67ms) |
| 22 | `tests/pm09/p12-resultados-margin-contract.mjs` | Contrato activo | node | PASS (exit=0, 60ms) |
| 23 | `tests/pm09/p15-special-economic-contract.mjs` | Contrato activo | node | PASS (exit=0, 53ms) |
| 24 | `tests/pm09/p16-isolation-context-contract.mjs` | Contrato activo | node | PASS (exit=0, 56ms) |
| 25 | `tests/pm09/p17-robustness-contract.mjs` | Contrato activo | node | PASS (exit=0, 61ms) |
| 26 | `tests/pm10/p04-productos-contract.mjs` | Contrato activo | node | PASS (exit=0, 66ms) |
| 27 | `tests/pm10/p05-pedidos-contract.mjs` | Contrato activo | node | PASS (exit=0, 57ms) |
| 28 | `tests/pm10/p06-recepcion-contract.mjs` | Contrato activo | node | PASS (exit=0, 76ms) |
| 29 | `tests/pm10/p07-personal-contract.mjs` | Contrato activo | node | PASS (exit=0, 56ms) |
| 30 | `tests/pm10/p08-encargos-contract.mjs` | Contrato activo | node | PASS (exit=0, 58ms) |
| 31 | `tests/pm10/p09-transversal-contract.mjs` | Contrato activo | node | PASS (exit=0, 60ms) |
| 32 | `tests/pm10/p10-autoridad-persistencia-contract.mjs` | Contrato activo | node | PASS (exit=0, 58ms) |
| 33 | `tests/pm10/p11-robustez-altas-contract.mjs` | Contrato activo | node | PASS (exit=0, 59ms) |
| 34 | `tests/pm10/p12-datos-legados-contract.mjs` | Contrato activo | node | PASS (exit=0, 60ms) |
| 35 | `tests/pm10/p13-contexto-aislamiento-contract.mjs` | Contrato activo | node | PASS (exit=0, 65ms) |
| 36 | `tests/pm11-compra/p02-contrato-e2e-estados-contract.mjs` | Contrato activo | node | PASS (exit=0, 34ms) |
| 37 | `tests/pm11-compra/p03-recepciones-multiples-replay-contract.mjs` | Contrato activo | node | PASS (exit=0, 55ms) |
| 38 | `tests/pm11-compra/p04-albaran-trazabilidad-contract.mjs` | Contrato activo | node | PASS (exit=0, 53ms) |
| 39 | `tests/pm11-compra/p05-factura-identidad-contract.mjs` | Contrato activo | node | PASS (exit=0, 57ms) |
| 40 | `tests/pm11-compra/p06-pago-reverso-e2e-contract.mjs` | Contrato activo | node | PASS (exit=0, 49ms) |
| 41 | `tests/pm11-compra/p07-aislamiento-permisos-e2e-contract.mjs` | Contrato activo | node | PASS (exit=0, 48ms) |
| 42 | `tests/pm11-compra/p08-fallos-replay-concurrencia-contract.mjs` | Contrato activo | node | PASS (exit=0, 55ms) |
| 43 | `tests/pm11-compra/p09-conciliacion-e2e-contract.mjs` | Contrato activo | node | PASS (exit=0, 68ms) |
| 44 | `tests/pm11-compra/p10-regresion-integral-contract.mjs` | Contrato activo | node | PASS (exit=0, 54ms) |
| 45 | `tests/pm12/db/p08-postgres-contract.mjs` | Contrato activo | postgres | PASS (exit=0, 595ms) |
| 46 | `tests/pm12/p01-checkpoint-inventario-contract.mjs` | Contrato activo | node | PASS (exit=0, 56ms) |
| 47 | `tests/pm12/p02-estados-normalizacion-contract.mjs` | Contrato activo | node | PASS (exit=0, 36ms) |
| 48 | `tests/pm12/p03-documento-corte-contract.mjs` | Contrato activo | node | PASS (exit=0, 37ms) |
| 49 | `tests/pm12/p04-cierre-honesto-ux-contract.mjs` | Contrato activo | node | PASS (exit=0, 59ms) |
| 50 | `tests/pm12/p05-ajustes-trazables-contract.mjs` | Contrato activo | node | PASS (exit=0, 70ms) |
| 51 | `tests/pm12/p06-cancelacion-conservadora-contract.mjs` | Contrato activo | node | PASS (exit=0, 84ms) |
| 52 | `tests/pm12/p07-permisos-aislamiento-ajustes-contract.mjs` | Contrato activo | node | PASS (exit=0, 72ms) |
| 53 | `tests/pm12/p08-fallos-replay-concurrencia-contract.mjs` | Contrato activo | node | PASS (exit=0, 62ms) |
| 54 | `tests/pm12/p08-instancias-fallos-contract.mjs` | Contrato activo | node | PASS (exit=0, 72ms) |
| 55 | `tests/pm12/p09-aplicar-index.mjs` | Utilidad | node | PASS (exit=0, 30ms) |
| 56 | `tests/pm12/p09-historial-informes-movil-contract.mjs` | Contrato activo | node | PASS (exit=0, 74ms) |
| 57 | `tests/pm12/p10-preview-smoke-contract.mjs` | Contrato activo | node | PASS (exit=0, 38ms) |
| 58 | `tests/pm12/supabase-full/p08-auth-postgrest-rls-contract.mjs` | Contrato activo | supabase_full_stack | PASS (real, CI) |
| 59 | `tests/pm12/supabase-full/p08-production-baseline-contract.mjs` | Contrato activo | supabase_full_stack | PASS (real, CI) |
| 60 | `tests/pm12/supabase-full/prepare-fixture.mjs` | Utilidad | node | N/A (no es caso de prueba) |
| 61 | `tests/pm12/supabase-full/prepare-production-baseline.mjs` | Utilidad | node | N/A (no es caso de prueba) |
| 62 | `tests/pm13/p01-altas-bajas-personal-contract.mjs` | Contrato activo | node | PASS (exit=0, 71ms) |
| 63 | `tests/pm13/p01-backend-personal-contract.mjs` | Contrato activo | node | PASS (exit=0, 35ms) |
| 64 | `tests/pm13/p01-diagnostico-personal.mjs` | Diagnóstico | node | PASS (exit=0, 61ms) |
| 65 | `tests/pm13/p01-rpc-personal-contract.mjs` | Contrato activo | node | PASS (exit=0, 72ms) |
| 66 | `tests/pm13/p02-diagnostico-turnos.mjs` | Diagnóstico | node | PASS (exit=0, 48ms) |
| 67 | `tests/pm13/p02-turnos-contract.mjs` | Contrato activo | node | PASS (exit=0, 52ms) |
| 68 | `tests/pm13/p03-backend-fichajes-contract.mjs` | Contrato activo | node | PASS (exit=0, 35ms) |
| 69 | `tests/pm13/p03-diagnostico-fichajes.mjs` | Diagnóstico | node | PASS (exit=0, 54ms) |
| 70 | `tests/pm13/p03-fichajes-contract.mjs` | Contrato activo | node | PASS (exit=0, 75ms) |
| 71 | `tests/pm13/p04-ausencias-contract.mjs` | Contrato activo | node | PASS (exit=0, 52ms) |
| 72 | `tests/pm13/p04-backend-ausencias-contract.mjs` | Contrato activo | node | PASS (exit=0, 34ms) |
| 73 | `tests/pm13/p04-diagnostico-ausencias.mjs` | Diagnóstico | node | PASS (exit=0, 66ms) |
| 74 | `tests/pm13/p05-vacaciones-contract.mjs` | Contrato activo | node | PASS (exit=0, 49ms) |
| 75 | `tests/pm13/p06-costes-personal-contract.mjs` | Contrato activo | node | PASS (exit=0, 54ms) |
| 76 | `tests/pm13/p07-diagnostico-ia-nominas.mjs` | Diagnóstico | node | PASS (exit=0, 139ms) |
| 77 | `tests/pm13/p07-ia-nominas-revision-contract.mjs` | Contrato activo | node | PASS (exit=0, 58ms) |
| 78 | `tests/pm14/db/p02-postgres-contract.mjs` | Contrato activo | postgres | PASS (exit=0, 154ms) |
| 79 | `tests/pm14/db/p05-postgres-contract.mjs` | Contrato activo | postgres | PASS (exit=0, 123ms) |
| 80 | `tests/pm14/db/p07-postgres-concurrencia-contract.mjs` | Contrato activo | postgres | PASS (exit=0, 152ms) |
| 81 | `tests/pm14/p01-encargos-identidad-contract.mjs` | Contrato activo | node | PASS (exit=0, 52ms) |
| 82 | `tests/pm14/p02-encargos-frontend-contract.mjs` | Contrato activo | node | PASS (exit=0, 6060ms) |
| 83 | `tests/pm14/p03-encargos-entrega-contract.mjs` | Contrato activo | node | PASS (exit=0, 56ms) |
| 84 | `tests/pm14/p04-encargos-cancelacion-contract.mjs` | Contrato activo | node | PASS (exit=0, 51ms) |
| 85 | `tests/pm14/p05-encargos-devolucion-contract.mjs` | Contrato activo | node | PASS (exit=0, 59ms) |
| 86 | `tests/pm14/p06-clientes-aislamiento-contract.mjs` | Contrato activo | node | PASS (exit=0, 63ms) |
| 87 | `tests/pm14/p07-encargos-concurrencia-contract.mjs` | Contrato activo | node | PASS (exit=0, 6056ms) |
| 88 | `tests/pm14/p08-encargos-historial-contract.mjs` | Contrato activo | node | PASS (exit=0, 62ms) |
| 89 | `tests/pm15/p01-la022-locales-empresa-contract.mjs` | Contrato activo | node | PASS (exit=0, 50ms) |
| 90 | `tests/pm15/p01-nr08-cambio-contexto-no-alcanzable-contract.mjs` | Contrato activo | node | PASS (exit=0, 55ms) |
| 91 | `tests/pm15/p02-mej01-contexto-modales-contract.mjs` | Contrato activo | node | PASS (exit=0, 54ms) |
| 92 | `tests/pm15/p03-mej02-confirmacion-pago-destino-contract.mjs` | Contrato activo | node | PASS (exit=0, 49ms) |
| 93 | `tests/pm15/p04-nr08-proteccion-borrador-navegacion-contract.mjs` | Contrato activo | node | PASS (exit=0, 71ms) |
| 94 | `tests/pm16/p01-la025-loadkey-fallos-contract.mjs` | Contrato activo | node | PASS (exit=0, 1107ms) |
| 95 | `tests/pm16/p01-la025-ui-fallos-carga-contract.mjs` | Contrato activo | node | PASS (exit=0, 57ms) |
| 96 | `tests/pm17/p01-rollback-push-nativo-contract.mjs` | Contrato activo | node | PASS (exit=0, 49ms) |
| 97 | `tests/pm17/p01-wiring-notificaciones-contract.mjs` | Contrato activo | node | PASS (exit=0, 47ms) |
| 98 | `tests/pm17/p02-neutralidad-informes-nativo-contract.mjs` | Contrato activo | node | PASS (exit=0, 50ms) |
| 99 | `tests/pm17/p02-wiring-seleccionpersonal-contract.mjs` | Contrato activo | node | PASS (exit=0, 45ms) |
| 100 | `tests/pm17/p03-auth-ux-nativo-contract.mjs` | Contrato activo | node | PASS (exit=0, 47ms) |
| 101 | `tests/pm17/p03-wiring-login-logout-contract.mjs` | Contrato activo | node | PASS (exit=0, 50ms) |
| 102 | `tests/pm17/p04-retirar-parches-externos-contract.mjs` | Contrato activo | node | PASS (exit=0, 56ms) |
| 103 | `tests/pm18/p01-identidad-fiscal-contract.mjs` | Contrato activo | node | PASS (exit=0, 50ms) |
| 104 | `tests/pm18/p01-wiring-identidad-fiscal-contract.mjs` | Contrato activo | node | PASS (exit=0, 55ms) |
| 105 | `tests/pm19/p01-appcc-historico-trazable-contract.mjs` | Contrato activo | node | PASS (exit=0, 48ms) |
| 106 | `tests/pm19/p01-wiring-appcc-contract.mjs` | Contrato activo | node | PASS (exit=0, 53ms) |
| 107 | `tests/pm19/p02-aceite-responsable-contract.mjs` | Contrato activo | node | PASS (exit=0, 48ms) |
| 108 | `tests/pm19/p02-wiring-aceite-contract.mjs` | Contrato activo | node | PASS (exit=0, 47ms) |
| 109 | `tests/pm19/p03-wiring-traspasos-contract.mjs` | Contrato activo | node | PASS (exit=0, 51ms) |
| 110 | `tests/pm19/p04-merma-descuenta-una-vez-contract.mjs` | Contrato activo | node | PASS (exit=0, 48ms) |
| 111 | `tests/pm19/p04-wiring-merma-contract.mjs` | Contrato activo | node | PASS (exit=0, 47ms) |
| 112 | `tests/pm19/p05-comportamiento-guardia-contract.mjs` | Contrato activo | node | PASS (exit=0, 65ms) |
| 113 | `tests/pm19/p05-inventario-mutaciones-protegidas-contract.mjs` | Contrato activo | node | PASS (exit=0, 53ms) |
| 114 | `tests/pm19/p05-validar-contexto-escritura-contract.mjs` | Contrato activo | node | PASS (exit=0, 51ms) |
| 115 | `tests/pm20/p01-checkpoint-inventario-contract.mjs` | Contrato activo | node | PASS (exit=0, 94ms) |
| 116 | `tests/pm20/p02-comportamiento-proveedor-contract.mjs` | Contrato activo | node | PASS (exit=0, 56ms) |
| 117 | `tests/pm20/p02-la014-fecha-esperada-pedido-contract.mjs` | Contrato activo | node | PASS (exit=0, 60ms) |
| 118 | `tests/pm20/p02-wiring-proveedores-contract.mjs` | Contrato activo | node | PASS (exit=0, 49ms) |
| 119 | `tests/pm20/p03-dashboard-informes-resultados-contract.mjs` | Contrato activo | node | PASS (exit=0, 48ms) |
| 120 | `tests/pm20/p04-tesoreria-estacionalidad-saldo-mapa-contract.mjs` | Contrato activo | node | PASS (exit=0, 52ms) |
| 121 | `tests/pm20/p05-buscador-etiquetas-auditoria-contract.mjs` | Contrato activo | node | PASS (exit=0, 53ms) |
| 122 | `tests/pm20/p06-errores-sistema-aislamiento-contract.mjs` | Contrato activo | node | PASS (exit=0, 50ms) |
| 123 | `tests/pm20/p07-revalidacion-acumulada-contract.mjs` | Contrato activo | node | PASS (exit=0, 50ms) |
| 124 | `tests/pm20/p08-restauracion-qa-contract.mjs` | Contrato activo | node | PASS (exit=0, 69ms) |
| 125 | `tests/pm26/defecto-l-context-hotfix.test.mjs` | Contrato activo | node | PASS (exit=0, 40ms) |
| 126 | `tests/pm27-mobile-logout-modal-fix.mjs` | Contrato activo | node | PASS (exit=0, 36ms) |
| 127 | `tests/pm27-restore-c24-operational-rpcs.mjs` | Contrato activo | node | PASS (exit=0, 35ms) |
| 128 | `tests/pm29/p01-locales-desactivar-propietario-contract.mjs` | Contrato activo | node | PASS (exit=0, 58ms) |
| 129 | `tests/pm29/p02-empresas-desactivar-propietario-contract.mjs` | Contrato activo | node | PASS (exit=0, 56ms) |
| 130 | `tests/pm29/p03-adopcion-contexto-contract.mjs` | Contrato activo | node | PASS (exit=0, 54ms) |
| 131 | `tests/pm31/p01-bloqueo-programa-no-cargado-contract.mjs` | Contrato activo | node | PASS (exit=0, 10439ms) |
| 132 | `tests/pm32/p01-selector-empresa-y-local-contract.mjs` | Contrato activo | node | PASS (exit=0, 61ms) |
| 133 | `tests/pm33/db/contrato-vigente-contract.mjs` | Contrato activo | postgres | PASS (exit=0, 118ms) |
| 134 | `tests/pm33/db/p01-aislamiento-multiempresa-contract.mjs` | Histórico (fallo esperado) | postgres | FAIL esperado (exit=1, 97ms) |
| 135 | `tests/pm33/db/p02-regresion-rol-no-gestionado.mjs` | Contrato activo | postgres | PASS (exit=0, 76ms) |
| 136 | `tests/pm33/db/p03-aislamiento-camarero-contract.mjs` | Contrato activo | postgres | PASS (exit=0, 84ms) |
| 137 | `tests/pm33/db/p04-identidad-y-revocacion-contract.mjs` | Contrato activo | postgres | PASS (exit=0, 93ms) |
| 138 | `tests/pm33/db/p05-identidad-antes-de-actividad-contract.mjs` | Contrato activo | postgres | PASS (exit=0, 87ms) |
| 139 | `tests/pm33/p03-frontend-multilocal-contract.mjs` | Contrato activo | node | PASS (exit=0, 59ms) |
| 140 | `tests/pm33/supabase-full/p05-auth-postgrest-contract.mjs` | Contrato activo | supabase_full_stack | PASS (real, CI) |
| 141 | `tests/post-reset-schema-contract.mjs` | Contrato activo | node | PASS (exit=0, 52ms) |
| 142 | `tests/ui-context-bridge.mjs` | Contrato activo | node | PASS (exit=0, 37ms) |

## Evidencia y notas por archivo (todo lo que no es un PASS simple de contrato activo Node)

### `tests/pm12/db/p08-postgres-contract.mjs`

- **Clasificación**: Contrato activo
- **Entorno**: postgres
- **Resultado real**: PASS (exit=0, 595ms)
- **Evidencia**: CI run 35502655080, job node-y-postgres, contra PostgreSQL 16.15 real (servicio de GitHub Actions).

### `tests/pm12/p09-aplicar-index.mjs`

- **Clasificación**: Utilidad
- **Entorno**: node
- **Resultado real**: PASS (exit=0, 30ms)
- **Evidencia**: Utilidad de aplicación (integra pm12-p09-historial-informes-movil-v1.js en index.html), idempotente. No es un caso de prueba PASS/FAIL. Ejecutada dentro de la batería Node (ver resultado real). CI run 35502655080, job node-y-postgres.

### `tests/pm12/supabase-full/p08-auth-postgrest-rls-contract.mjs`

- **Clasificación**: Contrato activo
- **Entorno**: supabase_full_stack
- **Resultado real**: PASS (real, CI)
- **Evidencia**: PASS real en CI: P08_SUPABASE_AUTH_POSTGREST_CONCURRENT_REPLAY=PASS, P08_SUPABASE_RLS_SCOPE_AND_DIRECT_WRITE_DENIED=PASS, P08_SUPABASE_AUTH_POSTGREST_CONCURRENT_CANCEL=PASS, PM12_P08_SUPABASE_FULL_STACK=PASS. Jobs pm12-p08-supabase-full / pm33-p05-supabase-full.

### `tests/pm12/supabase-full/p08-production-baseline-contract.mjs`

- **Clasificación**: Contrato activo
- **Entorno**: supabase_full_stack
- **Resultado real**: PASS (real, CI)
- **Evidencia**: PASS real en CI: PM12_PROD_BASELINE_MINIMAL=PASS, PM12_PROD_BASELINE_RLS_GRANTS=PASS, PM12_PROD_BASELINE_P08_CONSTRAINTS=PASS, PM12_PROD_BASELINE_NO_QA_OBJECTS=PASS. Jobs pm12-p08-supabase-full / pm33-p05-supabase-full.

### `tests/pm12/supabase-full/prepare-fixture.mjs`

- **Clasificación**: Utilidad
- **Entorno**: node
- **Resultado real**: N/A (no es caso de prueba)
- **Evidencia**: Utilidad de preparación de fixtures exclusiva del job pm12-p08-supabase-full de CI (copia migraciones a un directorio temporal). No se ejecuta de forma aislada.

### `tests/pm12/supabase-full/prepare-production-baseline.mjs`

- **Clasificación**: Utilidad
- **Entorno**: node
- **Resultado real**: N/A (no es caso de prueba)
- **Evidencia**: Utilidad de preparación de la baseline productiva, exclusiva del job pm12-p08-supabase-full de CI. No se ejecuta de forma aislada.

### `tests/pm13/p01-diagnostico-personal.mjs`

- **Clasificación**: Diagnóstico
- **Entorno**: node
- **Resultado real**: PASS (exit=0, 61ms)
- **Evidencia**: Diagnóstico de solo lectura (inspecciona fuente.js, escribe evidencia JSON). Sin PASS/FAIL. Ejecutado dentro de la batería Node (ver resultado real); su evidencia ya commiteada quedó desactualizada respecto al fuente.js actual -- deuda separada, no corregida en esta rama (ver informe). CI run 35502655080, job node-y-postgres.

### `tests/pm13/p02-diagnostico-turnos.mjs`

- **Clasificación**: Diagnóstico
- **Entorno**: node
- **Resultado real**: PASS (exit=0, 48ms)
- **Evidencia**: Igual que P01. CI run 35502655080, job node-y-postgres.

### `tests/pm13/p03-diagnostico-fichajes.mjs`

- **Clasificación**: Diagnóstico
- **Entorno**: node
- **Resultado real**: PASS (exit=0, 54ms)
- **Evidencia**: Igual que P01. CI run 35502655080, job node-y-postgres.

### `tests/pm13/p04-diagnostico-ausencias.mjs`

- **Clasificación**: Diagnóstico
- **Entorno**: node
- **Resultado real**: PASS (exit=0, 66ms)
- **Evidencia**: Igual que P01. CI run 35502655080, job node-y-postgres.

### `tests/pm13/p07-diagnostico-ia-nominas.mjs`

- **Clasificación**: Diagnóstico
- **Entorno**: node
- **Resultado real**: PASS (exit=0, 139ms)
- **Evidencia**: Igual que P01. CI run 35502655080, job node-y-postgres.

### `tests/pm14/db/p02-postgres-contract.mjs`

- **Clasificación**: Contrato activo
- **Entorno**: postgres
- **Resultado real**: PASS (exit=0, 154ms)
- **Evidencia**: CI run 35502655080, job node-y-postgres, contra PostgreSQL 16.15 real (servicio de GitHub Actions).

### `tests/pm14/db/p05-postgres-contract.mjs`

- **Clasificación**: Contrato activo
- **Entorno**: postgres
- **Resultado real**: PASS (exit=0, 123ms)
- **Evidencia**: CI run 35502655080, job node-y-postgres, contra PostgreSQL 16.15 real (servicio de GitHub Actions).

### `tests/pm14/db/p07-postgres-concurrencia-contract.mjs`

- **Clasificación**: Contrato activo
- **Entorno**: postgres
- **Resultado real**: PASS (exit=0, 152ms)
- **Evidencia**: CI run 35502655080, job node-y-postgres, contra PostgreSQL 16.15 real (servicio de GitHub Actions).

### `tests/pm33/db/contrato-vigente-contract.mjs`

- **Clasificación**: Contrato activo
- **Entorno**: postgres
- **Resultado real**: PASS (exit=0, 118ms)
- **Evidencia**: CI run 35502655080, job node-y-postgres, contra PostgreSQL 16.15 real (servicio de GitHub Actions).

### `tests/pm33/db/p01-aislamiento-multiempresa-contract.mjs`

- **Clasificación**: Histórico (fallo esperado)
- **Entorno**: postgres
- **Resultado real**: FAIL esperado (exit=1, 97ms)
- **Evidencia**: Registro histórico retirado (P03 cambió el contrato deliberadamente); contrato vigente real: contrato-vigente-contract.mjs (PASS). CI run 35502655080, job node-y-postgres.

### `tests/pm33/db/p02-regresion-rol-no-gestionado.mjs`

- **Clasificación**: Contrato activo
- **Entorno**: postgres
- **Resultado real**: PASS (exit=0, 76ms)
- **Evidencia**: CI run 35502655080, job node-y-postgres, contra PostgreSQL 16.15 real (servicio de GitHub Actions).

### `tests/pm33/db/p03-aislamiento-camarero-contract.mjs`

- **Clasificación**: Contrato activo
- **Entorno**: postgres
- **Resultado real**: PASS (exit=0, 84ms)
- **Evidencia**: CI run 35502655080, job node-y-postgres, contra PostgreSQL 16.15 real (servicio de GitHub Actions).

### `tests/pm33/db/p04-identidad-y-revocacion-contract.mjs`

- **Clasificación**: Contrato activo
- **Entorno**: postgres
- **Resultado real**: PASS (exit=0, 93ms)
- **Evidencia**: CI run 35502655080, job node-y-postgres, contra PostgreSQL 16.15 real (servicio de GitHub Actions).

### `tests/pm33/db/p05-identidad-antes-de-actividad-contract.mjs`

- **Clasificación**: Contrato activo
- **Entorno**: postgres
- **Resultado real**: PASS (exit=0, 87ms)
- **Evidencia**: CI run 35502655080, job node-y-postgres, contra PostgreSQL 16.15 real (servicio de GitHub Actions).

### `tests/pm33/supabase-full/p05-auth-postgrest-contract.mjs`

- **Clasificación**: Contrato activo
- **Entorno**: supabase_full_stack
- **Resultado real**: PASS (real, CI)
- **Evidencia**: PASS real en CI: TOTAL PASS=15 FAIL=0, PM33_P05_ENTORNO_AISLADO_OK=1. Jobs pm12-p08-supabase-full / pm33-p05-supabase-full.

