# Etapa 3 — Prueba E2E de cobro, cierre, stock, ticket e historial en QA

**Fecha:** 30/10/2026  
**Entorno:** QA exclusivamente  
**Preview validado:** `deploy-preview-192--chic-entremet-9107cf.netlify.app`  
**Empresa/local:** QA Empresa A, S.L. · Local A1  
**Producción:** sin cambios y sin ventas ejecutadas.

## Objetivo

Completar el circuito operativo de una venta controlada en QA y comprobar que la
venta se cobra, la cuenta se cierra, se genera el ticket interno con QR fiscal
simulado, se descuenta el stock y el importe queda disponible en el historial
después de recargar la aplicación.

## Prueba ejecutada

- Modo: **Venta rápida de mostrador**.
- Producto: `Agua 50 cl (QA)`.
- Cantidad: `1`.
- Total: `1,00 €`.
- Medio de pago: efectivo.
- Efectivo recibido: `1,00 €`.
- Cambio: `0,00 €`.
- Cuenta: pagada y cerrada en servidor.
- Ticket final recuperable: `V-20261030-08868A`.
- Número TPV: `TPV-000020`.
- Operación: `40fabcb2-223c-4a5e-87c5-c83b4c1d3207`.

## Evidencias observadas

### Cobro y cierre

El TPV mostró `Total €1,00`, `Confirmado €1,00`, `Pendiente €0,00`,
`Cuenta: PAGADO` y `Cuenta comercial: CERRADA`. El último intento quedó como
`Confirmado`.

### Ticket y QR

El ticket recuperable mostró:

- empresa y local QA;
- subtotal `€1,00`;
- IVA QA mostrado en el ticket;
- total `€1,00`;
- `Cobrado en EFECTIVO`;
- entregado `€1,00` y cambio `€0,00`;
- imagen `QR tributario`;
- aviso `VERI*FACTU · QA · EMISIÓN REAL DESACTIVADA`;
- payload HTTPS de validación QA:
  `https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=QA-A2-TEST&numserie=TPV-000020&fecha=30-10-2026&importe=1.00`.

La emisión real ante AEAT permaneció desactivada. El QR es únicamente de
simulación QA y no constituye un documento fiscal real.

### Persistencia e historial

Después de recargar la aplicación, el TPV mostró:

- `Ventas 53`;
- `Total vigente €11,00`;
- la venta de `Agua 50 cl (QA)` con importe `€1,00`;
- apertura del ticket guardado mediante `Ver ticket / reimprimir`.

El historial de producto confirmó además que la existencia de `Agua 50 cl
(QA)` quedó en `88,00` unidades, con `6,00` en piso de venta, y que los
movimientos recientes incluyen `−1,00 CONFIRMACION_VENTA` del 30/10/2026.

### Observación de interfaz

Durante el primer instante posterior al cobro, el árbol de accesibilidad
conservó temporalmente el estado `Procesando venta…`, aunque la interfaz ya
había presentado el ticket. Se esperó a una lectura fresca y se recargó la
aplicación; la venta, el ticket, el cierre y el stock quedaron confirmados.
No se repitió el cobro para evitar una venta duplicada.

## Contratos automáticos

Todos los contratos ejecutados quedaron en verde:

- `A02_QUICK_SALE_TICKET_CONTRACT=PASS`.
- `QA_RECEPCION_TPV_CAJA=PASS`.
- Contrato visual/estático del ticket QR: 5 pruebas correctas.
- Contrato de preview del ticket QR: 2 pruebas correctas.
- `git diff --check`: correcto.

## Resultado de la etapa

**ETAPA 3 TERMINADA EN QA.** El circuito cobro → cierre → ticket/QR QA →
stock → historial funciona y persiste tras recarga. No se ha activado
fiscalidad real ni se ha modificado producción.

## Siguiente etapa

La siguiente es la **Etapa 4: corregir y validar el formato visual del ticket**,
incluyendo la consistencia del contenido al abrirlo, imprimirlo o guardarlo en
PDF, manteniendo el QR únicamente como simulación QA hasta disponer de una
empresa fiscal real y su configuración C07-D validada.
