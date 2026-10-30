# Etapa 1 — Cierre operativo del TPV en QA

Fecha de verificación: 30/10/2026  
Ámbito: QA (`deploy-preview-192--chic-entremet-9107cf.netlify.app`)  
Empresa: `QA Empresa A, S.L.`  
Local: `Local A1`  
Producción: no modificada y no utilizada para las pruebas de venta.

## Resultado ejecutivo

La prueba operativa completa en QA ha quedado validada para el flujo de venta rápida:

1. Se puede seleccionar el modo `Venta rápida` / mostrador.
2. Se puede añadir un producto al carrito.
3. Se puede cobrar en efectivo.
4. El servidor confirma el pago y cierra formalmente la cuenta.
5. Se genera el ticket interno con importe, medio de pago, cambio y QR simulado de QA.
6. Se registra el movimiento de stock.
7. La venta queda persistida y aparece en el historial con su importe después de hidratar los datos del servidor.

## Evidencia manual QA

### Venta y cobro

- Producto: `Agua 50 cl (QA)`.
- Cantidad: `1`.
- Precio e importe: `1,00 €`.
- Medio: efectivo.
- Efectivo recibido: `1,00 €`.
- Cambio: `0,00 €`.
- Resultado: `PAGADA`.
- Estado de cuenta: `CERRADA`.
- No se reprodujo el error anterior `Could not find the function public.abc_cerrar_cuenta_pagada`.

### Ticket

El ticket mostrado en pantalla contiene:

- referencia de venta;
- empresa y local;
- fecha y número documental QA;
- línea, cantidad, precio, subtotal, IVA y total;
- medio de pago, entregado y cambio;
- indicación `VERI*FACTU · QA · EMISIÓN REAL DESACTIVADA`;
- QR tributario simulado HTTPS con payload de QA.

La URL observada durante la prueba fue la pasarela de validación de preproducción de la AEAT con los datos de QA; no se realizó emisión fiscal real.

### Persistencia e historial

La venta quedó persistida en el servidor y, tras la siguiente hidratación del ledger, apareció en el historial con importe `1,00 €`. El estado observado después de recargar fue `52` ventas y `10,00 €` de total vigente, incluyendo la nueva venta.

La lógica fuente contiene el refresco contextual de productos y movimientos inmediatamente después de confirmar el cobro (`4a3bd0c`, `fix(tpv): restore contextual product sync and refresh sales history`). Esto evita depender de una recarga manual cuando se ejecuta la versión que contiene ese commit; la hidratación posterior se mantiene como recuperación segura si una lectura de red llega antes de que el ledger termine de propagarse.

### Stock

Para `Agua 50 cl (QA)` se observó:

- stock total: `89` unidades;
- stock en piso de venta: `7` unidades;
- movimientos del día con `CONFIRMACION_VENTA` y salida de `1` unidad.

## Contratos automatizados ejecutados

Todos los contratos siguientes terminaron correctamente:

- `QA_RECEPCION_TPV_CAJA=PASS`.
- `p3c-client-contract: OK`.
- `C07D_CHECKOUT_EMIT_CONTRACT=PASS`.
- contrato estático de ticket/QR: `5/5` pruebas OK.
- contrato de preview ticket/QR: `2/2` pruebas OK.
- `a09-panel-ui-runtime: OK` (`22/22`).
- `a09-acciones-ui-runtime: OK` (`15/15`).
- `a09-eventos-ui-runtime: OK` (`22/22`).
- `git diff --check`: sin errores.

## Conclusión de la etapa

El circuito comercial de QA queda validado para venta rápida, cobro, cierre de cuenta, ticket QR simulado e inventario. No se promociona nada a producción en esta etapa.

## Sigue

El siguiente paso del plan es la revisión visual y funcional completa del ticket en QA: formato guardado/impreso, QR simulado y consistencia del importe en historial antes de preparar cualquier promoción operativa.
