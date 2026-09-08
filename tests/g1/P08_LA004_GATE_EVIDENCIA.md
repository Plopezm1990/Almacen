# G1 · Núcleo seguro · Punto 8 — LA-004 y cierre de gate

Fecha: 2026-09-05  
Rama: `g1-nucleo-seguro`  
Entorno vivo: Supabase QA `qjqorixtkilwsndqayyx`  
Producción/main: sin cambios

## 1. Objetivo

Cerrar el único hueco de evidencia CRÍTICO heredado por G1 y ejecutar la regresión final de Puerta G1.

El catálogo PM04 define literalmente:

- `LA-004`
- paquete: `PM-06`
- severidad: `CRITICO`
- fixture: `Factura A2 + proveedor`
- esperado: `Factura conserva empresa/local al editar, recargar y pagar; operador no autorizado no modifica.`

P02 había localizado cadena histórica de cierre PM06, pero no un artefacto independiente de prueba equivalente al resto. Por eso LA-004 debía revalidarse directamente.

## 2. Contrato PM06 reconstruido desde QA

La implementación viva mantiene:

- `facturas_directas_empresa` y `albaranes_empresa` con identidad empresa/local;
- proveedor compatible con la empresa del documento;
- trigger `pm06_proteger_identidad_y_total()` que rechaza mover una factura entre empresa/local;
- bloqueo de cambio del importe total cuando existen pagos;
- `pm06_total_factura()` como autoridad de total y estado válido;
- `pagos_factura` ligado a factura/origen/empresa/local;
- `registrar_pago_factura()` con saldo pendiente y rechazo de sobrepago;
- `revertir_pago_factura()` como reverso enlazado;
- gasto derivado de factura directa `fdg:<factura_id>` con la misma empresa/local/factura e importe.

## 3. Hallazgo real 1 — replay financiero demasiado permisivo

Batería inicial LA-004, siempre en `BEGIN ... ROLLBACK` y con datos sintéticos `G1-P08-`:

- 14/15 controles correctos;
- fallo: mismo `operationId` de pago, misma factura/empresa/local/importe, pero cambiando `id`, fecha, medio de pago y `datos` fue aceptado como `replayed=true`.

Causa: la comparación de replay de `registrar_pago_factura()` no incluía todo el contenido significativo de la operación.

Esto viola DEC-03: un reintento legítimo debe reutilizar el mismo `operationId` con el mismo contenido; contenido distinto debe producir conflicto.

## 4. Hallazgo real 2 — colisión de operationId entre pagos y Caja

Prueba transaccional adicional:

| Caso | Antes de corregir |
|---|---|
| Caja primero → Pago factura con mismo `operationId` | aceptado |
| Pago factura primero → Caja con mismo `operationId` | aceptado |

Resultado inicial: **0/2 PASS**.

PM09 ya había endurecido colisiones entre stock/Caja/arqueos, pero `pagos_factura` no formaba parte de ese dominio global.

## 5. Corrección aplicada únicamente en QA

Migración Supabase QA:

- versión: `20260905185935`
- nombre: `g1_p08_operation_id_finanzas_global`

Reflejada en repositorio como:

`supabase/migrations/20260905185935_g1_p08_operation_id_finanzas_global.sql`

La corrección:

1. crea registro privado y transaccional `private.g1_operation_ids_global`;
2. incorpora `pagos_factura`, `caja_operaciones`, `stock_operaciones`, `arqueos_caja` y `arqueos_caja_anulaciones` al mismo dominio de `operationId`;
3. bloquea reutilización de un ID entre ledgers distintos con `operation_id_conflict`;
4. conserva replay legítimo dentro del mismo ledger;
5. hace que pago y reverso de factura usen el mismo `pg_advisory_xact_lock` PM08;
6. compara en replay de pago: id, factura, origen, empresa, local, importe, fecha, medio y datos;
7. compara en replay de reverso: id, pago original y motivo.

Antes de crear el registro global se verificó que QA no contenía ningún `operationId` ya duplicado entre los cinco ledgers críticos.

## 6. Revalidación definitiva LA-004

Fixture sintético:

- empresa: `QA-EMP-A`;
- local: `QA-A2`;
- proveedor: `QA-PROV-A`;
- factura directa: 12,00 €;
- pago: 5,00 €;
- saldo esperado: 7,00 €.

Resultado posterior a la corrección: **20/20 PASS**.

Casos demostrados:

- alta conserva empresa/local/proveedor/total;
- gasto derivado conserva empresa/local/factura/importe;
- edición ordinaria conserva identidad;
- nueva lectura/recarga devuelve la misma identidad;
- cambio de local rechazado: `identidad_documental_inmutable`;
- proveedor de Empresa B rechazado: `proveedor_empresa_incompatible`;
- pago 5 € confirmado con pendiente 7 €;
- replay exacto del pago: idempotente;
- mismo ID con metadatos distintos: `operation_id_conflict`;
- mismo ID con importe distinto: `operation_id_conflict`;
- sobrepago: `pago_supera_saldo`;
- factura con pagos no admite alterar total: `factura_con_pagos_no_admite_cambio_importe`;
- Caja → Pago con mismo ID: `operation_id_conflict`;
- Pago → Caja con mismo ID: `operation_id_conflict`;
- operador sin permiso no edita la factura;
- operador sin permiso no paga: `pago_no_autorizado`;
- reverso de pago válido;
- replay exacto del reverso idempotente;
- mismo ID de reverso con motivo distinto: `operation_id_conflict`;
- reverso conserva factura/empresa/local/importe y referencia al pago original.

**G1_P08_LA004_LIVE=20/20_PASS**

## 7. Limpieza

Tras `ROLLBACK` y comprobación independiente:

- facturas `G1-P08-%`: 0;
- gastos derivados/pruebas: 0;
- pagos: 0;
- Caja: 0;
- stock operaciones: 0;
- claims `private.g1_operation_ids_global` de prueba: 0.

No se utilizaron datos reales.

## 8. Asesor de seguridad

Después del DDL se ejecutó el Security Advisor de Supabase.

No apareció un problema nuevo atribuible a esta corrección. Persisten avisos ya conocidos y fuera del alcance puntual de LA-004:

- RLS sin políticas en `operaciones_procesadas`, `prefiltro_limites` y `prefiltros_candidatos`;
- advertencias por RPC `SECURITY DEFINER` accesibles por `authenticated`, que son puntos de entrada intencionales y deben seguir tratándose con autorización interna y revisión específica;
- protección contra contraseñas filtradas desactivada.

No se declara el asesor globalmente limpio.

## 9. Reconstrucción reproducible del candidato actual

El primer workflow final de G1 (`33986030268`) dejó verdes todas las regresiones funcionales, pero falló correctamente el `cmp` de build porque `source-recovery` todavía reconstruía el estado anterior del bundle. Por tanto el gate no se declaró cerrado en ese momento.

El diagnóstico posterior localizó el baseline exacto:

- commit base que coincide byte a byte con `npm run build`: `7b2aa0f1500ecfc5dce551196f5434655411a314`;
- mensaje: `PM-08: hacer caja y devoluciones indivisibles`;
- SHA-256 del artefacto base: `372813f2230054306b0d37eb3825938832b68f62ea88a484dde0b1dfcdb075ed`.

Desde ese commit hasta el último cambio funcional de `fuente.js` hay exactamente **17 commits**, todos PM09/PM10. Se preservaron como parches históricos individuales en:

`source-recovery/post-pm08-patches/`

El manifiesto `PATCH_SERIES.json` fija:

- base PM08;
- SHA del artefacto base;
- orden y SHA de los 17 commits;
- último commit funcional `a4a1866f4e81c4651162105e33d37515cb53a7f2`;
- SHA-256 objetivo `8dbd5f9be4c172eaa5b28ce84a668414edcd2ec8c9941a2d748c466aa4bbd48c`.

`source-recovery/rebuild-current.mjs` ejecuta el build desde la fuente recuperada, verifica el SHA base, aplica los 17 parches con `--fuzz=0`, verifica el SHA objetivo y no usa `../fuente.js` como entrada. `package.json` expone este proceso como:

`npm run build:current`

La generación inicial de la serie probó que los 17 parches reconstruyen exactamente el candidato. Después, el workflow final usa la serie ya versionada y vuelve a comparar `dist/fuente.js` contra el candidato.

## 10. Regresión final de Puerta G1

Workflow:

`.github/workflows/g1-p08-cierre-puerta.yml`

Primera ejecución completamente satisfactoria con la cadena reproducible versionada:

- run: **33986461074**;
- SHA del candidato: **`af04d67a3a387d64c98847bdf8ca9ecd491f0bf1`**;
- conclusión: **SUCCESS**.

En ese único SHA pasaron:

1. sintaxis del candidato;
2. contrato LA-004 y gate;
3. G1 P02, P03, P04, P05, P06 y P07;
4. regresión CRITICAL/HIGH PM05/PM07/PM08;
5. regresión económica y de aislamiento PM09;
6. regresión de validaciones, persistencia y legado PM10;
7. build desde instalación limpia;
8. reconstrucción PM08 + 17 parches históricos;
9. comparación byte a byte del artefacto reconstruido con `fuente.js`.

Resultado de criterios G1:

- CRITICAL/HIGH Fase 1: **16/16 PASS**;
- LA-019: **PASS**;
- LA-023: **PASS**;
- permisos/aislamiento: **PASS**;
- cifras/conciliaciones: **PASS**;
- concurrencia/replay: **PASS**;
- LA-004 evidencia directa: **PASS**;
- build reproducible: **PASS**.

## 11. Decisión

**LA-004 = PASS** después de descubrir y corregir dos defectos reales de idempotencia/identidad financiera.

**PUERTA G1 · NÚCLEO SEGURO = SUPERADA.**

No se ha fusionado a `main`, no se ha publicado producción y no se ha modificado Netlify de producción. El cierre de G1 autoriza únicamente avanzar en el Plan Maestro al siguiente paquete de trabajo, manteniendo las mismas reglas de ramas de prueba y QA.

Siguiente paquete: **PM11 — empleados/personal**.

Este commit de evidencia es documental; al modificar `tests/g1/**`, el workflow de cierre vuelve a ejecutarse automáticamente y debe permanecer verde sobre el SHA final de la rama antes de iniciar PM11.

**G1_P08_LA004=PASS**  
**G1_CRIT_HIGH_16_OF_16=PASS**  
**G1_BUILD_REPRODUCIBLE=PASS**  
**G1_GATE_SUPERADO=SI**  
**G1_SIGUIENTE=PM11**
