# Plan ABC — D2: flujo CONFIRMADA en Preview QA

Fecha: 2026-10-10  
Entorno objetivo: Preview QA  
Local de prueba: QA-A1  
Usuario de prueba: QA Propietario A

## Diagnóstico

A02/A04 guarda la cuenta y la línea en BORRADOR/ABIERTO. A05 llamaba a `abc_confirmar_linea_pedido` únicamente dentro de `enviarPedidoA05`; la misma acción confirmaba la línea y después llamaba a `abc_enviar_pedido`. La interfaz, por tanto, solo exponía “Enviar pedido” y no permitía dejar la línea en CONFIRMADA.

El backend ya admite la transición independiente a CONFIRMADA. D09-D11 consume stock para Barra/Para llevar o reserva para Mesa/Terraza cuando esa transición se confirma. D10 permite la devolución recuperable solo mientras la línea sigue CONFIRMADA y rechaza estados posteriores o MERMA.

## Decisión funcional

Se añade la acción explícita **Confirmar pedido** al flujo A05. No se crea un fixture que falsee estados: la acción usa el mismo RPC servidor y los mismos triggers de stock que el flujo operativo real. La confirmación deja el pedido ABIERTO y la línea CONFIRMADA; “Enviar pedido” sigue siendo una acción posterior independiente.

No se modifican migraciones, esquema ni la guardia D10. Este cambio no ejecuta SQL de escritura contra QA.

## Prueba contractual añadida

`tests/f3/d10/d2-recoverable-state-contract.mjs` comprueba sin conectarse ni escribir en Supabase:

| Estado de línea | D2 esperado |
|---|---|
| CONFIRMADA | Permite devolución recuperable |
| ENVIADA | Rechaza |
| EN_PREPARACION | Rechaza |
| PREPARADA | Rechaza |
| SERVIDA | Rechaza |
| MERMA | Rechaza |

La prueba también verifica que CONFIRMADA no envía automáticamente el pedido y que D10 conserva el resultado REVERTIDA tras una devolución aceptada.

## Evidencia de QA

La repetición D2 en el Preview anterior quedó BLOQUEADA porque solo existía “Enviar pedido” y ese botón llevaba la línea directamente a ENVIADA. La repetición en el nuevo Preview debe crear una cuenta nueva con `QA-CAT-A1-AGUA`, pulsar “Confirmar pedido”, comprobar `ABIERTO` + `CONFIRMADA` y registrar cantidad 1, importe 0 y “Sin reembolso / cambio” en Devoluciones. La evidencia final se añade aquí después del despliegue, con URL, usuario, local y hora.
