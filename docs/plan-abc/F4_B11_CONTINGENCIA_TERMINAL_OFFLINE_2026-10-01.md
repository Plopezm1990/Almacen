# F4 B11.2 — contingencia para terminal offline

Estado: diseño preparado; no activado.

## Principio

Si un datáfono permite autorizar pagos sin conexión, esa autorización sigue
siendo una operación del terminal/proveedor, no una confirmación de ABC. ABC
no debe crear una venta fiscal, aplicar stock ni cerrar un pago con una
respuesta que todavía no pueda verificar.

## Condiciones mínimas antes de activar

El proveedor y el adquirente deben confirmar por escrito:

1. límite máximo por operación y límite acumulado offline;
2. antigüedad máxima de una autorización pendiente;
3. método de autenticación del terminal y protección contra manipulación;
4. comportamiento ante doble envío, rechazo posterior o contracargo;
5. momento y evidencia de la sincronización posterior;
6. responsabilidad del comercio por operaciones finalmente rechazadas.

## Estados propuestos

```text
OFFLINE_DECLARADO      -> constancia local del terminal, no cobro confirmado
PENDIENTE_CONCILIACION -> el proveedor aún debe confirmar online
CONFIRMADO             -> respuesta online verificada por ABC
RECHAZADO              -> respuesta online negativa o expiración
INCIDENCIA             -> falta de respuesta, discrepancia o contracargo
```

Solo `CONFIRMADO` podría liberar las reservas y aplicar efectos económicos de
ABC. Los demás estados bloquean la repetición automática del mismo cobro y
requieren la misma referencia estable para conciliar.

## Decisión actual

Hasta disponer de esa evidencia, la contingencia operativa es usar el
terminal conectado, anotar el pedido como borrador local o aceptar el pago
por un canal cuya confirmación sí llegue al backend. No se activa ningún
camino offline en el TPV y no se presenta una autorización declarada como
confirmación bancaria.

Este documento no constituye una aprobación PCI ni una autorización del
adquirente. Es el diseño que deberá revisar el negocio antes de una futura
implementación específica.
