# Addendum de matriz QA · punto 1 económico · 21/11/2026

Este addendum actualiza la evidencia de las filas siguientes de
`MATRIZ-IMPLANTACION-QA.csv` sin cambiar sus identificadores ni sus
condiciones de cierre.

| ID | Evidencia live añadida | Estado |
| --- | --- | --- |
| `ini-01` | Panel autenticado QA-A1 refleja la sesión, venta `TPV-42`, documento QA y efecto de caja; producción no aparece en la CSP. | Cerrada |
| `tpv-03` | Cuenta `e3b9e818-4015-4cde-b0bd-8d351b641819`, pedido `109103bc-879a-42ae-92cf-46f930fc538b`, recorrido completo y cierre sin fallback. | Cerrada |
| `tpv-06` | Sala real QA-A1 conservó la cuenta exacta durante el recorrido; no se reutilizó una cuenta ajena. | Cerrada |
| `tpv-09` | Cuenta del día actual recuperada en TPV y posteriormente cerrada mediante cobro QA. | Cerrada |
| `tpv-18` | Cobro efectivo simulado de `1,00 €`, recibido `1,00 €`, cambio `0,00 €`, pago confirmado por servidor. | Cerrada |
| `tpv-20` | Ticket `TPV-42`, secuencia `36`, QR fiscal QA, `SIMULADOR_C07D`, AEAT real desactivada. | Cerrada |
| `caj-11` | Superficie B08 usada como reembolso económico; solicitud QA de `1,00 €` confirmada en efectivo. | Cerrada |
| `caj-12` | Solicitud creada con motivo obligatorio y estado `PENDIENTE`; el selector identifica el pago recién cobrado. | Cerrada |
| `caj-13` | Botón «Confirmar efectivo» ejecutado con autorización explícita; resultado: un único movimiento negativo de caja. | Cerrada |
| `caj-22` | La sesión ya tenía terminal auxiliar A2; no se creó una segunda sesión. La evidencia Q08 A1/A2 permanece válida. | Cerrada |

## Salvedades que siguen separadas

- El flujo físico de devolución no se mezcló con el económico: devolvió
  `reembolso_devolucion_separado`, por lo que no se alteró stock al confirmar
  el reembolso B08.
- La sesión de caja era preexistente. No se abrió ni cerró una sesión nueva y
  no se guardó un arqueo adicional; Arqueo mostró `2,00 €` esperados (`1,00 €`
  de venta y `1,00 €` de ajuste/reembolso).
- El positivo de Cajero/a con MFA, la paginación/búsqueda de la cola de Pase y
  el bookkeeping de Apariencia siguen siendo opcionales.
