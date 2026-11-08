# Etapa 2 — Modo Venta rápida / Mostrador en QA

Fecha de verificación: 30/10/2026  
Ámbito: QA (`deploy-preview-192--chic-entremet-9107cf.netlify.app`)  
Producción: no modificada.

## Resultado

El modo `Venta rápida` / `Mostrador` está implementado y operativo en QA como una modalidad propia del TPV, separada de `Sala / restaurante`.

## Comportamiento validado

Al seleccionar `Venta rápida`, el TPV muestra:

- selector visible de modalidad;
- etiqueta `MOSTRADOR`;
- texto explicativo: producto, pago y ticket sin mesas ni cocina;
- buscador y catálogo de productos;
- carrito con cantidades, precios y total;
- selección de medio de pago;
- importe recibido y cálculo de cambio cuando el medio es efectivo;
- botón de cobro con el total visible;
- estado final de venta pagada;
- botón para consultar el ticket generado.

En este modo no se obliga al usuario a:

- abrir una mesa;
- asignar zona o camarero;
- preparar un pedido de sala;
- gestionar reparto;
- pasar por la pantalla de cocina.

La cuenta operativa sigue creándose y cerrándose en el servidor para conservar trazabilidad, stock y control de duplicados, pero la experiencia de usuario es la de un TPV de mostrador.

## Evidencia funcional

Durante la prueba QA del paso 1 se seleccionó `Venta rápida`, se vendió `Agua 50 cl (QA)` y se confirmó:

- cantidad: `1`;
- total: `1,00 €`;
- efectivo recibido: `1,00 €`;
- cambio: `0,00 €`;
- resultado: `PAGADA`;
- cuenta: `CERRADA`;
- ticket visible con importe y QR simulado QA.

## Contratos automatizados

Ejecutados correctamente:

- `A02_QUICK_SALE_TICKET_CONTRACT=PASS`.
- `QA_RECEPCION_TPV_CAJA=PASS`.
- `p3c-client-contract: OK`.
- contratos de cobro, ticket y QR QA: `PASS`.

El contrato A02 comprobó específicamente que el flujo contiene preparación de línea, servicio, cobro, cierre, generación del ticket, importe de línea, total de ticket, protección ante cuenta no cerrada y QR no productivo.

## Conclusión

El modo `Venta rápida / Mostrador` queda formalmente validado en QA. No se ha promovido a producción ni se ha activado fiscalidad real.

## Sigue

El siguiente paso es el punto 3: repetir una prueba QA completa y documentar conjuntamente cobro, cierre, stock y ticket, incluyendo la comprobación visual del historial y del documento guardado.
