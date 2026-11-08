# Punto 9 · modo de preparación por producto en QA

Fecha: 29/10/2026

## Motivo

La observación del TPV en producción detectó una comanda `BLOQUEADA` con `route_key=SIN_RUTA` para un producto recibido por albarán (`CROIS. CURVO GOURMET 100 46 UD`). El diseño A10 estaba tratando todo artículo vendible como si necesitara preparación, aunque una venta directa de mercancía no debe entrar en cocina.

## Corrección aplicada en código y QA

- El catálogo autoritativo `public.catalogo_tpv_productos` incorpora `requiere_preparacion`.
- El valor por defecto es `true`, por compatibilidad con los 37 productos que ya existían en QA.
- La pantalla de Productos muestra `Requiere preparación / comanda de cocina` al crear y editar.
- La opción permanece marcada por defecto; se desmarca para mercancía de venta directa, como un artículo de albarán que no se prepara.
- El puente de sincronización incluye el campo en la firma de venta y lo transmite al catálogo TPV.
- A10 consulta el catálogo en servidor. Solo genera comanda para líneas cuyo producto tenga `requiere_preparacion=true`; las ventas directas no generan `BLOQUEADA/SIN_RUTA`.
- Los payloads antiguos sin el campo siguen resolviendo a `true` tanto en la RPC como en el helper A10.

Migración QA aplicada: `abc_f3_a10_preparation_mode`.

## Verificación QA

- Columna: existe, `NOT NULL`, default `true`.
- Catálogo QA: 37 filas; 37 con preparación; 0 directas antes de la prueba funcional.
- Helper `private.abc_a10_requiere_preparacion`: presente.
- Trigger A10: filtra las dos rutas de transición (`ENVIADA` y `CANCELADA`).
- RPC de catálogo: guarda el valor en alta, actualización y snapshot.
- Contrato estático: `tests/f3/a10/a10-preparation-mode-contract.mjs`.

### Prueba funcional posterior a la corrección

Se ejecutó una segunda venta rápida en QA con `Agua 50 cl (QA)` después de
desmarcar la preparación para ese producto:

- `requiere_preparacion=false`, versión de catálogo `8`.
- Checkout `COMPLETADO` y pago en efectivo `CONFIRMADO` por `1,00 €`.
- Ticket `V-20261029-10DA2D`, número TPV `TPV-000014`.
- QR generado en modo simulador QA (`PREPARADO_SIMULADOR`), sin transporte real
  a la AEAT.
- Comandas nuevas asociadas a la venta: `0`.
- Efectos nuevos de cocina: `0`.
- Efectos nuevos en `ERROR`: `0`.

La primera venta de la sesión sí generó una comanda porque se hizo antes de
corregir el catálogo y el producto todavía tenía `requiere_preparacion=true`.
Ese registro histórico no se mezcla con el resultado de la segunda prueba.

## Estado y siguiente paso

La corrección está terminada en código y QA, y la prueba funcional de venta
directa ha pasado. El incidente de producción no se considera cerrado todavía:
producción mantiene un producto bloqueado y no se ha modificado.

Queda pendiente, antes de cualquier promoción:

1. revisar el producto afectado en producción y decidir cómo regularizar la
   comanda histórica;
2. preparar una migración o procedimiento de promoción separado para el campo
   `requiere_preparacion`, sin tocar producción durante esta etapa;
3. ejecutar el preflight y los contratos en la rama candidata;
4. obtener autorización explícita para cualquier cambio productivo.

La promoción a producción continúa bloqueada hasta completar esos puntos.

### Revisión de solo lectura en producción

La revisión del `flqercbgpgmmfaakrwkc` confirmó el alcance exacto del
incidente, sin ejecutar ningún cambio:

- Comanda: `20d1f90f-d461-4b99-b88d-d18d884bf38f`.
- Empresa/local: `empresa-034b3c08b4f4ae9b` / `local-6d0e54564e774506`.
- Producto recibido por albarán: `CROIS. CURVO GOURMET 100 46 UD`.
- Producto: `pm10-recepcion-albaran:factura-albaran:mv5tixkxej43iu:0:8550916306:producto-auto:0`.
- Código comercial: `101421`; precio final: `2,00 €`; versión del catálogo: `3`.
- La comanda permanece `BLOQUEADA` con `route_key=SIN_RUTA`.
- Producción todavía no tiene la columna `requiere_preparacion` en
  `catalogo_tpv_productos`.

Esto explica por qué no basta con editar el valor del producto en producción:
primero hay que promover de forma controlada el esquema y el filtro A10, y
después decidir explícitamente cómo tratar la comanda histórica. La consulta
fue exclusivamente de lectura; producción no ha sido modificada.
