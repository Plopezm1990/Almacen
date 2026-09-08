# PM11 · Compra, recepción y pago E2E · P04 — Albarán y trazabilidad documental

Fecha: 2026-09-07  
Rama: `pm11-compra-recepcion-pago-e2e`  
P03: recepciones múltiples y replay cerrado  
Producción/main: **NO TOCAR**

## Objetivo

Cerrar la frontera documental entre pedido y albarán: un albarán enlazado debe conservar la identidad del pedido/contexto y su confirmación debe producir **como máximo un efecto logístico**, aunque se repita el mismo documento tras rerender o recarga.

## Hallazgo real

La base heredada ya tenía una protección parcial importante:

- `procesarRecepcion` usa un `operationId` estable para albarán (`pm10-recepcion-albaran:<id>`);
- en la misma sesión, su caché evita volver a ejecutar el movimiento de stock;
- cuando ese replay inmediato era visible, `confirmarAlbaran` evitaba volver a incrementar `cantidadRecibida`.

El hueco estaba en la frontera documental persistida. Tras perder la caché en memoria (por ejemplo, después de una recarga), `confirmarAlbaran` no consultaba primero si el mismo `albaran.id` ya constaba como confirmado. Si todavía quedaba saldo suficiente en el pedido, la validación podía volver a aceptar las mismas unidades; la capa de stock podía reconocer su `operationId`, pero la capa de pedido no tenía una prueba documental persistida para distinguir esa reconfirmación del primer hecho. Además, el enlace no exigía de forma explícita que el proveedor del albarán coincidiera con el proveedor del pedido.

## Corrección aplicada

P04 añade una barrera documental anterior a cualquier nueva validación/efecto físico:

1. firma canónica de confirmación del albarán con:
   - `albaran.id`;
   - `pedidoId`;
   - empresa/local efectivos;
   - proveedor;
   - fecha y número;
   - líneas relevantes y sus cantidades/unidades/precio/IVA;
2. `confirmacionPM11.firma` queda persistida dentro del albarán confirmado;
3. el mismo albarán confirmado con la misma firma se trata como **replay sin nuevo efecto**;
4. el mismo `id` con contenido distinto devuelve `operation_id_conflict`;
5. un albarán legado ya confirmado pero sin firma P04 falla cerrado con `documento_ya_confirmado`: nunca vuelve a entrar stock ni a incrementar el pedido por intentar reinterpretarlo;
6. existe memoria de sesión por empresa/local/albarán para cubrir repetición inmediata antes del siguiente estado persistido;
7. si existe `pedidoId`, antes de recibir se exige que:
   - el pedido pertenezca al local activo;
   - `pedido.proveedorId === albaran.proveedorId`;
   - pedido y albarán pertenezcan al mismo local;
8. solo después se ejecuta la validación cuantitativa PM10 y `procesarRecepcion`;
9. si la capa física informa replay, `cantidadRecibida` no vuelve a incrementarse;
10. el albarán confirmado conserva `confirmacionPM11` y el `operationId` logístico estable.

## Compatibilidad

`confirmarAlbaran` conserva el contrato histórico de devolver un array de avisos en caso de éxito. En replay devuelve también un array, marcado con:

- `replayed = true`;
- `operationId = pm11-albaran:<id>`.

Los errores de dominio continúan usando `{ ok: false, codigo, campo, error }`, por lo que la UI existente sigue manteniendo abierto el editor y mostrando el error.

## Casos automatizados

`tests/pm11-compra/p04-albaran-trazabilidad-contract.mjs` valida:

- primera confirmación = operación nueva;
- replay persistido exacto = cero segundo efecto;
- mismo ID con cantidad distinta = conflicto;
- albarán legado confirmado sin firma = fallo cerrado;
- replay en memoria = cero segundo efecto;
- mismo ID en memoria con contenido distinto = conflicto;
- albarán sin ID = rechazado;
- compatibilidad del retorno como array;
- guardia documental antes de volver a validar saldo del pedido;
- proveedor y local reconciliados con el pedido antes de recepción;
- validación cuantitativa antes de `procesarRecepcion`;
- `operationId` estable del efecto físico;
- replay físico no vuelve a incrementar `cantidadRecibida`;
- persistencia de `confirmacionPM11`;
- regresiones P03, PM10 P06, PM10 P05 y contrato P02.

## Ejecuciones

- Run inicial P04 `34087231284`: **FAIL** en una aserción estática del test que buscaba literalmente `estado === "confirmado"` dentro de `confirmarAlbaran`, aunque esa comprobación vive correctamente en el helper `resolverConfirmacionAlbaranPM11`. El fixer y `node --check fuente.js` ya habían pasado; no se creó commit funcional en ese intento.
- Se corrigió únicamente la aserción del contrato para comprobar esa regla en el helper que realmente la implementa.
- Run P04 `34087279520`: **SUCCESS**. Pasaron sintaxis, contrato P04, regresión P03, PM10 P06, PM10 P05 y contrato E2E P02. El workflow generó el commit funcional `58f4732f6b58b902204e0feb50ad5e6f161f3ef5` con mensaje `PM11 compra P04: hacer idempotente confirmacion de albaran`.

## Límite honesto

P04 cierra la idempotencia documental de la confirmación con el modelo de persistencia actual. No declara una transacción ACID multientidad entre `almacen_kv`, pedido, stock y documento. Fallos de proceso, crash en ventanas intermedias y concurrencia entre clientes se vuelven a someter a pruebas específicas en **P08**, tal como quedó congelado en P02.

P04 tampoco decide todavía cuándo un documento confirmado constituye factura/obligación financiera; esa semántica explícita (`esFactura`, número, fecha y unicidad de obligación) corresponde a **P05**.

## Estado

**PM11_COMPRA_P04_ALBARAN_TRAZABILIDAD=PASS**
