# G1 · Núcleo seguro · Punto 8 — LA-004 y cierre de gate

Fecha: 2026-09-05  
Rama: `g1-nucleo-seguro`  
Entorno vivo: Supabase QA `qjqorixtkilwsndqayyx`  
Producción/main: sin cambios

## 1. Objetivo

Cerrar el único hueco de evidencia CRÍTICO heredado por G1 y preparar la regresión final de Puerta G1.

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

## 9. Decisión LA-004

**LA-004 = PASS** después de descubrir y corregir dos defectos reales de idempotencia/identidad financiera.

El hueco de evidencia PM06 queda cubierto por prueba viva actual, migración versionada y este artefacto.

La **Puerta G1 completa todavía queda PENDIENTE** hasta ejecutar sobre un único SHA:

1. regresión actual de los 16 CRITICAL/HIGH;
2. todos los contratos G1 P02–P07;
3. reconstrucción reproducible y comparación del artefacto `fuente.js`;
4. workflow final verde sobre el SHA de cierre.

**G1_P08_LA004=PASS**  
**G1_ESTADO=PENDIENTE_REGRESION_FINAL_BUILD**
