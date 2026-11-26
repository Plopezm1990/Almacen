# Lote L2 · recarga y desconexión tras escribir · 25/11/2026

Autorizado por el usuario («autorizo») tras presentar el lote concreto. Actor: Propietario de
QA con segundo factor, QA-EMP-A / QA-A1, terminal `QA terminal A1`. Sin producción, sin
`sis-13`, sin cambios de configuración ni de permisos, y sin llamar a funciones de QA desde la
consola. No se guardó ningún secreto.

## Cambio respecto de lo presentado

La desconexión (paso 5) se aplicó a **«Cerrar cuenta pagada»** de la misma venta, no a un cobro
nuevo, para no consumir una segunda unidad de agua fuera del lote autorizado.

## Línea de tiempo (UTC)

| Hora | Acción | Resultado en servidor |
|---|---|---|
| 21:20:27 | Abrir sesión de caja, fondo 0,00 € | `c6e09980-28b5-4c09-88e1-aa391241c914` ABIERTA |
| 21:20:50 | **Recarga a los 150 ms de pulsar «Guardar pedido»** (venta de 1 Agua a 1,00 €) | Existe la cuenta `f3d877c7…` ABIERTA, **sin pedido ni línea** |
| 21:21:25 | Tras la recarga: borrador local recuperado con 1 línea; «Guardar pedido» una vez | **Misma cuenta reutilizada**: 1 cuenta, 1 pedido `acd7ab56…`, 1 línea. Sin duplicados |
| 21:2x | Enviar pedido | Pedido ENVIADO; stock del agua en almacén 71 → 70 |
| 21:23:44 | **Recarga con la llamada de escritura en vuelo**: se interceptó `fetch` desde la página y se recargó 30 ms después de salir `abc_iniciar_cobro` | Checkout `c4fd4dbf…` EN_COBRO y pago `181d7c8c…` PENDIENTE de 1,00 € en efectivo; sin entrada de caja ni documento |
| 21:24:19 | Retomar la cuenta: la pantalla muestra «Existe un intento pendiente… No se permite iniciar otro cobro» y «Recuperar/reintentar mismo intento»; se pulsó **una vez** | **El mismo pago** `181d7c8c…` pasa a CONFIRMADO; 1 entrada de caja +1,00; documento fiscal QA `TPV-000045` emitido |
| 21:2x | Preparar, marcar preparada y servir | Pedido SERVIDO |
| 21:25 | **Desconexión simulada** (`fetch` hacia Supabase rechazado con «Failed to fetch») y «Cerrar cuenta pagada» | Tras unos 15 s con «Cerrando…» aparece «TypeError: Failed to fetch». **La cuenta sigue ABIERTA** y el botón vuelve a estar disponible |
| 21:26 | Conexión restaurada y «Cerrar cuenta pagada» una vez | Cuenta CERRADA y pedido CERRADO; 1 pago y 1 entrada de caja en total |
| 21:26 | Reembolso en efectivo de 1,00 € (solicitar, confirmar) | Reembolso CONFIRMADO; caja REEMBOLSO −1,00, un solo movimiento |
| 21:26 | Iniciar cierre, contado 0,00 € (esperado servidor 0,00 €: entradas 1,00 − salidas 1,00), cierre provisional, finalizar | Bloqueos `[]`; sesión **CERRADA_FINAL** |

## Antes y después

Línea base a las 21:20:09 UTC y estado a las 21:26:54 UTC (QA-EMP-A / QA-A1):

| Tabla | Antes | Después | Diferencia |
|---|---|---|---|
| `pagos` | 80 | 81 | +1 |
| `checkouts` | 70 | 71 | +1 |
| `pedidos_tpv` | 121 | 122 | +1 |
| `cuentas_comerciales` | 121 | 122 | +1 |
| `ventas_fiscales` | 70 | 71 | +1 |
| `reembolsos` | 9 | 10 | +1 |
| `caja_operaciones` | 82 | 84 | +2 (neto 0,00 €) |
| Stock agua QA-A1 (almacén / piso) | 71 / 0 | 70 / 0 | −1 |
| Sesiones de caja abiertas en A1 | 0 | 0 | 0 |
| Cuentas nuevas que quedan abiertas | — | 0 | — |

Sin duplicados: una cuenta, un pedido, un pago, una entrada de caja y un documento por la
venta, a pesar de dos interrupciones y de un fallo de red.

## Resultado

- **Recarga durante «Guardar pedido»:** PASS. Queda una cuenta sin pedido hasta que se
  reintenta (H-29); al reintentar se reutiliza.
- **Recarga durante «Cobrar efectivo»:** PASS. Queda un pago PENDIENTE que la pantalla
  protege (no deja iniciar otro cobro) y que se completa con «Recuperar/reintentar mismo
  intento» sin duplicar. La emisión del documento fiscal se produjo por ese camino de
  interfaz, lo que apoya la explicación de H-23.
- **Desconexión:** PASS en datos (nada cambia y el reintento no duplica), con defecto de
  mensaje (H-32).

## Reservas

- La recarga se programó con `setTimeout` y una intercepción de `fetch` hecha desde la
  página; no es un corte de red real, y el servidor puede completar una llamada ya enviada
  aunque la página se recargue. El resultado vale para estos puntos de interrupción, no para
  todos.
- La primera recarga (a ciegas, 150 ms) no llegó a enviar el cobro; se repitió con la
  intercepción.
- La desconexión se simuló solo para las peticiones a Supabase.
- El cobro con tarjeta y el pago mixto no se repitieron.
