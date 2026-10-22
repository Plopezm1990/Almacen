# AUD-004 · fixture controlado de producto legacy en QA

Fecha: 2026-10-22  
Estado: PREPARADO; NO_EJECUTADO; QA_ONLY

## Objetivo

Reproducir en QA el caso histórico de un producto cuyo JSON no contiene
`empresaId`, sin crear una fila sin empresa en la base actual, sin tocar PROD y
sin modificar directamente tablas protegidas.

El caso que debe probarse es el que contempla la RPC
`abc_productos_guardar_lista`: la fila `almacen_kv` pertenece a una empresa
QA, pero el artículo legacy puede no llevar `empresaId` dentro del JSON. La
RPC debe resolver la empresa desde el contexto verificable de la fila, exigir
un `localId` válido y mantener el artículo dentro de la empresa correcta.

## Preflight realizado

- Proyecto consultado: QA `qjqorixtkilwsndqayyx`.
- `catalogo_tpv_productos`: 32 filas; ninguna tiene `empresa_id` o `local_id`
  nulo.
- Colección `almacen_kv.productos`: 32 artículos; ninguno carece de
  `empresaId` o `localId` en el JSON actual.
- No existe un fixture legacy/AUD-004 reproducible en el dataset QA actual.
- Las definiciones leídas de `abc_productos_guardar_lista` y
  `abc_catalogo_guardar_productos` exigen pertenencia y contexto de local; no
  permiten una reasignación silenciosa de empresa.
- Contratos locales ejecutados: `tests/pm10/p12-datos-legados-contract.mjs`
  y `tests/pm10/p04-productos-contract.mjs`: PASS.

## Procedimiento propuesto, aún pendiente de autorización específica

1. Elegir un identificador de producto nuevo y exclusivo, por ejemplo
   `QA-AUD004-LEGACY-20261022`, y un local ya perteneciente a QA Empresa A.
2. Capturar antes de la prueba, en solo lectura, el hash y el contenido de la
   fila `almacen_kv` de `productos`, el recuento de artículos y la existencia
   del identificador elegido.
3. Añadir un único artículo de fixture mediante la RPC autoritativa
   `abc_productos_guardar_lista`, con `localId` válido, `empresaId` ausente en
   el JSON, nombre identificable de QA, precio de venta vacío y `activo=false`
   para que no aparezca como producto vendible ni genere ventas o stock.
4. Leer de nuevo la lista y comprobar que la empresa efectiva procede de la
   fila QA, que el local es el esperado y que no se crea una segunda empresa ni
   se modifica otro artículo.
5. Abrir la pantalla de Productos en preview QA y comprobar el mensaje y el
   comportamiento de guardado del artículo legacy.
6. Intentar el caso contrario: cambiar el `empresaId` de un artículo que ya
   pertenece a QA Empresa A. El resultado esperado es rechazo cerrado por
   cambio de contexto; no debe producir reasignación.
7. Ejecutar una segunda llamada idéntica con un `operation_id` nuevo y
   comprobar que no se duplica el artículo.
8. Retirar exclusivamente el fixture por la vía de rollback autorizada,
   volver a leer el recuento y el hash de la lista, y confirmar que el resto de
   artículos queda idéntico al estado anterior.

## Reglas de seguridad

- Solo proyecto QA; PROD queda fuera de alcance.
- No usar `INSERT`, `UPDATE` o `DELETE` directo contra
  `public.almacen_kv`/`public.catalogo_tpv_productos`.
- No usar una empresa real de cliente ni un producto vendible.
- No crear ventas, cobros, movimientos de stock ni rutas de Cocina.
- Si la RPC no permite aislar el fixture o no existe rollback verificable, la
  prueba se detiene y AUD-004 permanece BLOQUEADO.
- Cualquier cambio de RLS, grants, migración o función requiere autorización
  separada y no forma parte de este fixture.

## Aceptación de AUD-004

El caso solo podrá marcarse PASS si se demuestra en QA, con evidencia antes y
después, que:

- un producto legacy sin `empresaId` se conserva dentro de la empresa de la
  fila y con un local válido;
- un `empresaId` contradictorio no puede reasignar el artículo;
- la repetición es idempotente y no crea duplicados;
- otra empresa no puede leerlo ni modificarlo;
- el rollback elimina únicamente el fixture y restaura el estado anterior;
- los contratos y el build QA continúan pasando.

Hasta ejecutar este procedimiento con autorización específica, el estado de
AUD-004 es `BLOQUEADO_FIXTURE_CONTROLADO`, no PASS ni FAIL de producto.
