# PM11 · Compra, recepción y pago E2E · P03 — Recepciones múltiples y replay

Fecha: 2026-09-07  
Rama: `pm11-compra-recepcion-pago-e2e`  
P02: contrato E2E cerrado  
Producción/main: **NO TOCAR**

## Objetivo

Cerrar el hueco identificado en P02 para la recepción directa de pedidos: varias recepciones físicas reales deben acumularse, pero un replay del mismo intento no puede volver a sumar stock ni `cantidadRecibida`.

## Hallazgo

La barrera heredada de PM10 impedía sobre-recepción y validaba el lote antes de tocar stock, pero `recibirPedido` no tenía una identidad de operación logística. Dos invocaciones del mismo intento podían partir del mismo snapshot de pedido y llamar dos veces a `procesarRecepcion` antes de que la UI reflejara el nuevo estado.

El aplicador cuantitativo limitaba `cantidadRecibida` al máximo pedido, pero esa protección no era suficiente: el segundo intento podía volver a producir el efecto físico de stock.

## Corrección

Se añade para la ruta de recepción directa:

- `operationId` explícito por intento;
- firma canónica de la solicitud (`pedido`, local, proveedor y líneas);
- registro persistido dentro del pedido en `recepcionesPM11`;
- memoria de corto plazo en la página para cubrir doble clic antes del siguiente render;
- replay exacto de la misma `operationId` devuelve `replayed: true` y no llama a `procesarRecepcion`;
- misma `operationId` con contenido distinto devuelve `operation_id_conflict`;
- una segunda recepción física real utiliza una nueva identidad y sí acumula cantidades;
- el evento conserva las `unidadesEntradas` realmente resueltas;
- el replay persistido se reconoce antes de validar el saldo pendiente actual, por lo que sigue siendo idempotente incluso si el pedido ya quedó `Recibido`;
- un intento inválido no reserva ni persiste una identidad de recepción.

La UI de Recepción conserva una identidad estable mientras el mismo intento siga visible. La firma del intento incluye el snapshot de `cantidadRecibida`, de modo que una nueva recepción real después del rerender obtiene una identidad nueva aunque tenga cantidades iguales a una recepción anterior.

## Casos automatizados

`tests/pm11-compra/p03-recepciones-multiples-replay-contract.mjs` cubre:

1. primera recepción 2/5 → `Parcial`;
2. replay inmediato de la misma operación → cero segundo efecto;
3. misma `operationId` con cantidad distinta → conflicto;
4. segunda recepción real con nueva identidad → 4/5;
5. tercera recepción real exacta → 5/5 y `Recibido`;
6. replay histórico después de completar el pedido → cero efecto;
7. reutilización de una identidad en otro pedido → conflicto;
8. intento inválido → no crea evento;
9. la UI entrega `operationId` estable a `recibirPedido`;
10. regresiones PM10 P05/P06 y contrato P02.

## Ejecuciones

- Run inicial P03 `34085754851`: **FAIL** únicamente por una aserción `deepStrictEqual` entre arrays de realms distintos del `vm`; la lógica funcional y `node --check` ya habían pasado hasta ese punto. No se generó commit funcional en ese intento.
- Test corregido para comparar valores normalizados.
- Run P03 `34085804169`: **SUCCESS**. Aplicó el fixer, pasó sintaxis, contrato P03, regresión PM10 P06, regresión PM10 P05 y contrato P02, y generó el commit funcional `9f39dffd0f0fbe6c6b3fffc6d1129a6ad4a9db17`.

## Alcance y límite honesto

P03 endurece recepción directa y replay dentro de la sesión + replay persistido cuando se reutiliza la misma identidad de operación. La resistencia completa ante recarga/crash, concurrencia entre clientes y fallo de persistencia/nube sigue reservada para P08, tal como congeló P02.

La confirmación idempotente de albaranes enlazados se trata en P04; P03 no la declara cerrada por extensión.

## Estado

**PM11_COMPRA_P03_RECEPCIONES_MULTIPLES_REPLAY=PASS**
