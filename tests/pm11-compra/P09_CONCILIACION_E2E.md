# PM11 · Compra, recepción y pago E2E · P09 — Conciliación E2E

Fecha: 2026-09-07  
Rama: `pm11-compra-recepcion-pago-e2e`  
P08: fallos, replay y concurrencia cerrado  
Producción/main: **NO TOCAR**

## Objetivo

Cerrar la conciliación numérica final del circuito definido en P02:

**pedido → recepciones únicas → stock → albarán/factura → pago parcial → pago total → reverso**.

P09 no añade un nuevo modelo ni una garantía ACID inexistente. Verifica que las capas ya cerradas en P03–P08 producen cifras coherentes entre sí y que los replays no alteran la conciliación.

## Caso determinista P09

Se ejecuta un pedido de `L1` con dos líneas:

- `p1`: 5 unidades;
- `p2`: 3 unidades.

### Primera recepción

Se reciben:

- `p1`: 2;
- `p2`: 1.

Resultado:

- pedido = `Parcial`;
- recibido acumulado = 2 + 1 por sus respectivas líneas;
- pendiente = 3 + 2;
- el stock físico de prueba aumenta exactamente 2 y 1;
- existe un único evento `recepcionesPM11` para esa recepción.

Se repite exactamente el mismo `operationId` y payload. Resultado:

- `replayed = true`;
- no aparece otro evento;
- no cambia `cantidadRecibida`;
- no cambia el stock físico conciliado.

### Segunda recepción real

Desde el snapshot actualizado se reciben exactamente los restos:

- `p1`: 3;
- `p2`: 2.

Resultado:

- pedido = `Recibido`;
- `cantidad == cantidadRecibida` en las dos líneas;
- pendiente final = 0;
- suma de eventos únicos = 5 y 3;
- stock neto conciliado = 5 y 3;
- dos recepciones reales = dos efectos físicos/versiones únicas.

Un replay histórico de la primera recepción después de completar el pedido vuelve a ser neutro: no cambia pedido, eventos ni stock.

## Identidad documental y factura

El caso enlaza una factura confirmada con:

- `pedidoId = ped-p09`;
- empresa `E1`;
- local `L1`;
- proveedor `prov-1`;
- identidad de factura explícita y válida.

Se ejecuta el helper real `validarIdentidadFacturaAlbaranPM11` y se verifica que la obligación mantiene empresa/local/proveedor y que el documento conserva el pedido enlazado.

Para las líneas confirmadas del caso:

- base = 65,00;
- IVA = 12,00;
- total = **77,00**.

Además, el contrato comprueba que la ruta real `marcarPagada` toma el total desde `calcularTotalesFacturaAlbaran(a22).total` y no desde un total financiero mutable externo.

## Pago y reverso

Se ejecuta el helper real `calcularSaldoFacturaPM06` sobre la obligación exacta de 77,00:

1. sin pagos: pagado 0, pendiente 77;
2. pago parcial de 30: pagado 30, pendiente 47;
3. pago final de 47: pagado 77, pendiente 0, factura pagada;
4. reverso del pago final de 47: pagado 30, pendiente 47.

En todos los estados se verifica:

`total factura = pagado + pendiente`.

Y después del reverso:

`nuevo pendiente = pendiente anterior + importe reversado`.

## Aislamiento

La proyección financiera se somete a movimientos sintéticos de otro local y otra empresa. No contaminan el saldo de `E1/L1`.

También se ejecuta la lógica real de pedido intentando recibir un pedido de `L2` desde el contexto activo `L1`; la escritura se rechaza y `cantidadRecibida` permanece en cero.

P07 continúa siendo la regresión autoritativa de la matriz completa A1/A2/B1/`Todos los locales`/usuario inactivo.

## Automatización

Contrato:

`tests/pm11-compra/p09-conciliacion-e2e-contract.mjs`

Workflow:

`.github/workflows/pm11-compra-p09-conciliacion.yml`

Primera ejecución completa:

- run `34093871188`;
- estado: **SUCCESS**;
- pasaron P09 y las regresiones P08, P07, P06, P05, P04, P03, PM10 autoridad de persistencia, G1 concurrencia/replay, G1 finanzas seguras y P02.

P09 no necesitó modificar `fuente.js`, ni migraciones de Supabase, ni datos QA. La conciliación existente quedó demostrada sin inventar una capa nueva.

## Estado

**PM11_COMPRA_P09_CONCILIACION_E2E=PASS**
