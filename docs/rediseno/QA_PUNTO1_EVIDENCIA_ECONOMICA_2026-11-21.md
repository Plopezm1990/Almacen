# Addendum de evidencia económica del punto 1 · 21/11/2026

Entorno: `QA-EMP-A / QA-A1`, Deploy Preview #225, PR #225 en borrador.
Producción no se tocó y no se utilizó `sis-13`.

## Venta sintética autorizada

Se creó una venta de ensayo de exactamente **1,00 €** con el Propietario
`pm07.smoke@qa.invalid`, terminal `QA terminal A1 (siembra etapa 1)` y el
producto `QA Aceite ensayo 20261115`. El producto se preparó temporalmente
como venta directa para no depender de una ruta de cocina ausente; después del
recorrido se restauró su configuración original (`Requiere preparación = sí`).

| Dato | Resultado |
| --- | --- |
| Cuenta | `e3b9e818-4015-4cde-b0bd-8d351b641819` |
| Pedido | `109103bc-879a-42ae-92cf-46f930fc538b` |
| Total | `1,00 €` |
| Medio | Efectivo simulado, recibido `1,00 €`, cambio `0,00 €` |
| Estados | Guardado → enviado → en preparación → preparado → servido → pagado → cuenta cerrada |
| Ticket fiscal QA | `TPV-42`, secuencia `36`, QR QA, `SIMULADOR_C07D`, AEAT real desactivada |
| Stock | `QA Aceite ensayo 20261115`: 50 → 49 litros; el movimiento es el consumo de la venta |

La caja ya tenía una sesión activa antes del ensayo. Intentar abrir otra
sesión devolvió el aviso honesto «La caja o el terminal ya tienen una sesión
activa»; no se creó una sesión duplicada ni se cerró la sesión preexistente.

## Reembolso

La vía física «De cliente» rechazó la combinación porque el servidor separa la
devolución de stock del reembolso económico (`reembolso_devolucion_separado`).
Se utilizó entonces el flujo económico B08, que es el previsto para devolver un
pago sin modificar stock:

- solicitud de `1,00 €` en efectivo, motivo `Ensayo autorizado QA 20261121 - reembolso efectivo`;
- solicitud creada como `PENDIENTE` y aprobada por el simulador;
- confirmación explícita de «Confirmar efectivo»;
- resultado visible: **«Reembolso en efectivo confirmado. Se ha creado un único movimiento negativo de caja.»**

En Arqueo de caja, la pantalla muestra `Efectivo esperado 2,00 €`, compuesto
por `Base efectivo 1,00 €` y `ajustes/reembolsos caja 1,00 €`. No se guardó un
arqueo nuevo porque la sesión era preexistente y el cierre debe hacerse en un
ensayo separado con su propio fondo inicial y contado.

## Estado de cierre

- `tpv-18`, `tpv-20`, `caj-11`, `caj-12`, `caj-13` y `caj-22`: evidencia live
  ampliada con cobro, ticket, reembolso y caja.
- `ini-01`, `tpv-03`, `tpv-06` y `tpv-09`: la evidencia de recorrido y
  recuperación queda enlazada a este addendum; no requieren otra mutación.
- Sigue opcional el positivo de Cajero/a con MFA, la paginación/búsqueda de la
  cola de Pase y el registro contable de migraciones de Apariencia.
- La cuenta sintética `e3b9e818-4015-4cde-b0bd-8d351b641819` queda cerrada y
  pagada. El pedido `109103bc-879a-42ae-92cf-46f930fc538b` conserva el
  historial del ensayo; no se borran datos ni evidencias.

