# Evidencia de operaciones con escritura · 21/11/2026

Entorno: `QA-EMP-A / QA-A1`, Deploy Preview #225, rama
`rediseno/f0-base-qa`, PR #225 en borrador. El propietario autenticado fue
`pm07.smoke@qa.invalid`. Producción no se tocó y no se utilizó `sis-13`.

## Recorrido ejecutado

Se autorizó expresamente una venta sintética de **1,00 €**, cobro en efectivo
simulado y reembolso simulado. El recorrido se hizo sobre el TPV del terminal
`QA terminal A1 (siembra etapa 1)` y el producto `QA Aceite ensayo 20261115`.

| Paso | Evidencia observada |
| --- | --- |
| Cuenta | `c4dadb89-0b27-4e27-b4ee-d2d348e97ff1` |
| Pedido | `e4f59cf1-26b6-418e-9d75-5d5cd16edf97` |
| Línea | 1 × `QA Aceite ensayo 20261115` · 1,00 € |
| Estados | Guardado → enviado a cocina → en preparación → listo para servir → servido |
| Cobro | Efectivo exacto: recibido 1,00 €, cambio 0,00 €, confirmado por servidor |
| Cuenta tras cobro | Pagada y cerrada |
| Documento fiscal | `TPV-43`, secuencia `37`, `SIMULADOR_C07D`, QR QA preparado; AEAT real desactivada |
| Venta | `V-20261121-65D717` |
| Anulación/reembolso | Venta pasó a `ANULADA`, importe vigente 0,00 €, original 1,00 € |
| Caja | Se observan los movimientos `COBRO_VENTA +1,00 €` y `REEMBOLSO_VENTA −1,00 €`, con motivo `Ensayo autorizado QA 20261121 - reembolso efectivo` |
| Cambio de permisos | Empleado `QA Rediseno Camarero 20261113`: `Camarero/a → Encargado → Camarero/a`; cada guardado se confirmó al reabrir la ficha y el estado final quedó restaurado a `Camarero/a` |

La anulación se hizo desde Historial completo de ventas sobre el ticket recién
creado, no sobre un ticket preexistente. El historial conserva la venta
original y deja visible el estado `ANULADA`, por lo que la operación es
auditable y no borra datos.

## Preparación temporal y restauración

Para que el pedido pudiera avanzar en el entorno sembrado, se desmarcó
temporalmente `Requiere preparación / comanda de cocina` en el producto. Tras
terminar el cobro y el reembolso, se volvió a marcar y se comprobó abriendo de
nuevo la ficha: el campo quedó con valor `1` (requiere preparación). No queda
ningún cambio permanente de configuración del producto por este ensayo.

## Caja y límites de la tanda

La pantalla de Arqueo mostró los movimientos de cobro y reembolso y un
efectivo esperado de 2,00 €. La caja ya tenía una sesión operativa activa antes
de la prueba; no se abrió una segunda sesión ni se cerró la existente. Tampoco
se guardó un arqueo nuevo, porque el cierre de la sesión activa requeriría un
ensayo independiente con fondo y contado autorizados.

El reembolso económico anula el importe y crea el movimiento negativo de caja,
pero no devuelve automáticamente el stock. El producto quedó en 48 litros en
QA; esto es coherente con separar reembolso económico de devolución física de
stock. No se ejecutó una devolución física adicional.

## Acciones no ejecutadas

- No se hizo ningún cobro, reembolso, apertura/cierre de caja ni cambio de
  configuración fuera de la venta sintética descrita.
- Sí se ejercitó un cambio de permisos reversible sobre `QA Rediseno Camarero
  20261113`: se elevó temporalmente de `Camarero/a` a `Encargado`, se verificó
  el guardado y después se restauró a `Camarero/a`. No queda una elevación de
  privilegios abierta.
- No se ejecutó una acción de Plataforma. La sesión era de Propietario de
  empresa, no de administrador de Plataforma; no se utilizó una cuenta
  `plataforma_admin` ni se concedió ese privilegio.
- No se tocó producción, no se fusionó el PR #225 y no se reinició QA.

## Estado para el siguiente agente

La operación de escritura autorizada queda demostrada en QA: venta,
preparación/servicio, cobro efectivo, cierre de cuenta, documento fiscal QA y
anulación/reembolso con movimientos de caja. Queda como dato sintético
auditable la venta `V-20261121-65D717` anulada y el pedido cerrado; no borrar
ninguno de los dos.

