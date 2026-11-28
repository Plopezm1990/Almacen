# Lote L1 · ejecución en QA · 25/11/2026

Autorizado por el usuario («Sí, autorizo», «De acuerdo», «Autorizo», «Sí, usa el refresco»,
«Sí, anula y sigue», «Sí, véndela», «Has lo más recomendado»). Actor: Propietario de QA con
segundo factor (`aal2`), QA-EMP-A / QA-A1, terminal `QA terminal A1`. Sin producción, sin
`sis-13`, sin cambios de configuración ni de permisos. No se guardó ninguna contraseña ni
código.

## Cambios respecto del plan original (L1)

| Plan | Lo que pasó | Por qué |
|---|---|---|
| Producto `QA Aceite ensayo`, 1,00 € | **Refresco en lata (QA)** 1,65 € y después **Agua 50 cl (QA)** 1,00 € | El aceite tenía piso de venta 0 y exige preparación. El refresco exige preparación y el servidor no deja enviarlo (no tiene ruta a cocina). El agua es el único producto de QA-A1 con `requiere_preparacion = false` |
| Caja ya abierta, sin abrir ni cerrar | Se abrió una sesión con fondo 0,00 € y se cerró al final | Acordado con el usuario (opción 1): no había sesión abierta |
| Caso 4: dos terminales | **No ejecutado** | Necesita una segunda sesión |
| Reembolso de 2 ventas | 3 reembolsos (uno por pago); el de tarjeta se canceló | El reembolso B08 es por pago |

## Línea de tiempo (UTC)

| Hora | Acción | Resultado en servidor |
|---|---|---|
| 20:47:00 | Abrir sesión de caja con fondo 0,00 € | `caja_sesiones` `14d01b2f-0276-42ac-82cf-0d41bf5828a3` ABIERTA |
| 20:50:51 | Venta con refresco 1,65 €: Guardar pedido | Cuenta `d9e28655…`, pedido `ac7a731e…` ABIERTO, línea CONFIRMADA |
| 20:5x | Enviar pedido | **Rechazado:** «producto que requiere preparación pero no tiene una ruta activa a cocina». Sin cobro ni movimiento |
| 20:54:16 | Cancelar pedido, motivo «Auditoria QA L1: producto sin ruta de cocina» | Pedido y línea CANCELADO/CANCELADA. **La cuenta comercial sigue ABIERTA** |
| 20:57:11 | Venta 1 con agua 1,00 €: Guardar, Enviar, retomar cuenta desde la lista | Pedido `eb294c34…`; stock del agua: almacén 73 → 72 al enviar |
| 20:58:38 | Cobro efectivo exacto 1,00 € | Pago `7a65b8c6…` CONFIRMADO; caja ENTRADA +1,00; documento fiscal QA `TPV-000044`, cola PENDIENTE, AEAT desactivada |
| 20:5x | Preparar, marcar preparada, servir, cerrar cuenta pagada | Cuenta `02c283ae…` CERRADA, pedido CERRADO |
| 21:00:06 | **Venta 2, doble clic en «Guardar pedido»** | **1** cuenta (`16ae5dd4…`), **1** pedido (`dd48ea53…`), **1** línea. PASS |
| 21:01:07 | **Doble clic en «Cobrar efectivo»** 0,50 € | **1** pago `4865a6a0…`, **1** entrada de caja +0,50. PASS |
| 21:01:28 | «Iniciar tarjeta simulada» 0,50 € | Pago `68b47726…` y intento `a49f7bdb…` PENDIENTE; la pantalla dice que lo resolverá «el adaptador de proveedor» |
| 21:0x | Se resolvió con `abc_qa_confirmar_pago_simulado` **llamada desde la consola del navegador** | Intento CONFIRMADO, checkout COMPLETADO. **No es un camino de la interfaz** (ver H-27) |
| 21:02:32 | Servir y cerrar cuenta pagada | Cuenta `16ae5dd4…` CERRADA. **Sin documento fiscal emitido** (ver H-23) |
| 21:04:52 | Reembolso efectivo 1,00 € (solicitar, aprobada por el Propietario, confirmar) | Reembolso `81f831e1…` CONFIRMADO; caja REEMBOLSO −1,00, un solo movimiento |
| 21:05:13 | Reembolso efectivo 0,50 € | Reembolso `6041c1fb…` CONFIRMADO; caja REEMBOLSO −0,50 |
| 21:05:24 | Reembolso tarjeta 0,50 € | Reembolso `e9013eb6…` PENDIENTE; efecto `PROVIDER_REEMBOLSO` PENDIENTE que **nada puede resolver** en QA |
| 21:0x | Iniciar cierre, contado 0,00 € (esperado servidor 0,00 €) | Cierre `3736e308…` PROVISIONAL con bloqueo `EFECTOS_PENDIENTES` |
| 21:0x | Cancelar la solicitud de reembolso con tarjeta (motivo «simulador sin resolucion de reembolso tarjeta») | Reembolso CANCELADO, efecto liberado, bloqueos `[]` |
| 21:11 | Finalizar cierre | Sesión **CERRADA_FINAL**, cierre FINAL, 0 sesiones abiertas |

## Antes y después

Línea base a las 20:40:15 UTC y estado a las 21:11:08 UTC (QA-EMP-A / QA-A1):

| Tabla | Antes | Después | Diferencia | Explicación |
|---|---|---|---|---|
| `pagos` | 77 | 80 | +3 | efectivo 1,00 · efectivo 0,50 · tarjeta 0,50 |
| `checkouts` | 68 | 70 | +2 | una por venta |
| `pedidos_tpv` | 118 | 121 | +3 | refresco (cancelado) · agua 1,00 · agua mixta |
| `ventas_fiscales` | 68 | 70 | +2 | una por venta |
| `reembolsos` | 6 | 9 | +3 | 2 confirmados en efectivo · 1 de tarjeta cancelado |
| `caja_operaciones` | 78 | 82 | +4 | 2 entradas y 2 reembolsos; neto 0,00 € |
| `abc_c05_documentos_emitidos` (desde 20:40) | — | 1 | +1 | TPV-44; la venta 2 no tiene |
| Sesiones de caja abiertas | 0 | 0 | 0 | una sesión abierta y cerrada (CERRADA_FINAL) |
| Stock agua QA-A1 (almacén / piso) | 73 / 0 | 71 / 0 | −2 | consumo de las 2 ventas |
| Stock refresco QA-A1 (almacén / piso) | 100 / 50 | 100 / 50 | 0 | el pedido nunca se envió |

Sin duplicados: un pago por cada importe cobrado y una sola entrada de caja por pago.

## Cambios que quedan en QA

- 3 pedidos, 3 cuentas comerciales, 2 ventas fiscales y 1 documento fiscal QA, 3 pagos, 3
  reembolsos (uno cancelado) y 4 movimientos de caja con neto 0,00 €, más una sesión de caja
  cerrada.
- La cuenta `d9e28655…` (refresco) **sigue ABIERTA** sin líneas activas. No se tocó por falta
  de una acción de interfaz para cerrarla.
- 2 unidades de agua consumidas del almacén; no se han repuesto (el reembolso B08 no
  devuelve stock).

## Resultado de los casos

- **PASS en vivo:** doble clic en Guardar (C-03), doble clic en Cobrar efectivo (C-01),
  efectivo exacto (F-08), pago mixto efectivo + tarjeta simulada (F-09, con la salvedad de
  H-27), reembolso B08 de efectivo con un único movimiento de caja (F-14), cierre de caja con
  esperado = contado (F-16 en parte), cancelación de pedido sin cobro.
- **FAIL / nuevos hallazgos:** H-19 a H-28 (ver `HALLAZGOS_TPV_2026-11-25.md`).
- **NO PROBADO:** dos terminales (C-04), recarga o desconexión tras escritura (C-05), descuento
  (F-12), reembolso de tarjeta completo, impresión (F-19).

## Reservas

- La tarjeta simulada se resolvió desde la consola del navegador, no desde un botón. El
  resultado vale como prueba del servidor, no como prueba de la interfaz.
- La venta 2 no emitió documento fiscal. La causa más probable es esa misma resolución
  externa, porque la emisión parece ejecutarse desde el cliente tras el cobro; no se
  reprodujo el caso por la vía de la interfaz.
- La pantalla «Arqueo de caja» (cierre diario) **no se guardó**: solo se leyó.
