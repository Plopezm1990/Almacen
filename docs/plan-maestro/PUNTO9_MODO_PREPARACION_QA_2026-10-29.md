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

## Estado y siguiente paso

La corrección está terminada en código y QA, pero el incidente de producción no se considera cerrado todavía: producción mantiene un producto bloqueado y no se ha modificado. Antes de promover, hay que probar en QA una venta directa desmarcando la opción y comprobar que no se crea comanda; después se podrá preparar un paquete de promoción separado. La promoción a producción requiere autorización explícita y una decisión sobre cómo regularizar la comanda ya existente.
