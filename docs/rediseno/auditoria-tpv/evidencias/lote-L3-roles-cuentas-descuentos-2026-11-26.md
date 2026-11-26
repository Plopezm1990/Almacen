# Lote L3 · cuentas, descuentos y cobro por cargo · 26/11/2026

Autorizado por el usuario («Autorizo») tras presentar el lote concreto. Actores: las tres
cuentas de prueba de QA-A1 (Encargado, Cajero/a y Camarero/a). Sin producción, sin `sis-13`,
sin cambios de configuración ni de permisos, sin llamar a funciones de QA desde la consola. Las
sondas del servidor usan identificadores inventados que no pueden escribir. **Ninguna
contraseña se guardó** y las copias en memoria de la pestaña se borraron al terminar.

## Cambios respecto del lote presentado

- **El envío del pedido B a cocina fue frenado** por el sistema de permisos y no se hizo: en el
  lote las cuentas A y B iban «sin enviar». Por eso **no se probó la unión efectiva de cuentas
  ni el reparto de productos**, que exigen un pedido enviado (ver «Resultado de F-07»).
- La venta del Cajero/a se hizo por «Cobrar ahora» de la venta rápida, que es su camino normal,
  y falló a medias (H-37); se cobró después por el camino de «Retomar» la cuenta.
- La autorización de un descuento por el Propietario **no se probó**: exige su código y la
  política del Encargado no llega a crear la solicitud (H-39).

## Línea de tiempo (UTC, 26/11)

| Hora | Quién | Acción | Resultado en servidor |
|---|---|---|---|
| 05:04 | Encargado | Abrir caja con fondo 0,00 € | `7827ed19-0c1c-4283-8af5-3ab86fa01ba3` ABIERTA |
| 05:05 | Encargado | Cuenta A: 2 aguas guardadas, sin enviar | `6dc5de7b…`, pedido ABIERTO, línea BORRADOR |
| 05:05 | Encargado | Cuenta B: 1 agua guardada, sin enviar | `7b6e21ad…`, ídem |
| 05:06 | Encargado | Buscar cuentas abiertas y retomar A | «Cuenta retomada»; PASS |
| 05:06 | Encargado | «Abrir reparto» en A | «No hay productos repartibles en esta cuenta» (solo borrador) |
| 05:07 | Encargado | Intento de enviar B a cocina | **Frenado por el sistema de permisos**; B queda sin enviar |
| 05:08 | Encargado | Unir A en B con A en borrador | Rechazado: «La cuenta que se funde todavía tiene un pedido en borrador o abierto. Envíalo o cancélalo antes de unir» |
| 05:08 | Encargado | Cancelar el pedido de A y volver a unir | A (vacía) ya no se ofrece: «No hay otra cuenta abierta de hoy con la que unir esta» |
| 05:08 | Encargado | Descuento del 10 % en A | `descuento_no_autorizado` (H-39); no se crea solicitud |
| 05:09 | Encargado | Cancelar el pedido de B | Pedido CANCELADO; las cuentas A y B **siguen ABIERTAS** (H-21) |
| 05:10 | Cajero/a | Sondas de descuento `PERCENT` y `COURTESY` | `descuento_solicitar_no_autorizado` en ambas |
| 05:10 | Cajero/a | Venta rápida de 1 agua con «Cobrar ahora» | Pedido `30696ad8…` ENVIADO (stock 70 → 69); fallo «Tu perfil no tiene permiso para realizar esta transición del pedido» (H-37); sin cobro |
| 05:1x | Camarero/a | Ve en su carrito el agua que dejó el Cajero/a (H-40) y no ve las cuentas abiertas (H-41) | — |
| 05:1x | Camarero/a | `abc_iniciar_cobro` en efectivo y con tarjeta (ids inventados) | efectivo: `abc_efectivo_no_autorizado`; tarjeta: `checkout_no_cobrable` (la autorización pasa) |
| 05:1x | Camarero/a | Sondas de descuento | `descuento_solicitar_no_autorizado` |
| 05:13 | Cajero/a | Retomar la cuenta, «Exacto» y «Cobrar efectivo» | Pago `977f86ca…` CONFIRMADO, caja ENTRADA +1,00; pantalla: «Emisión fiscal bloqueada C07D_CONFIG_NO_AUTORIZADO»; **0 documentos** (H-38) |
| 05:14 | Encargado | Iniciar, marcar preparada y servir; «Cerrar cuenta pagada» | Cuenta `7721798a…` CERRADA y pedido CERRADO, **sin documento fiscal** y sin acción para emitirlo |
| 05:14 | Encargado | Reembolso en efectivo de 1,00 € | CONFIRMADO; caja REEMBOLSO −1,00, un solo movimiento |
| 05:15 | Encargado | Cierre: contado 0,00 € (esperado 0,00 €), ensayo C12, finalizar | C12: «APTO_CIERRE… documentos conciliados 0 · pendientes 0» (H-38); sesión **CERRADA_FINAL** |

## Antes y después (QA-EMP-A / QA-A1)

| Dato | Antes (05:03 UTC) | Después (05:15 UTC) | Diferencia |
|---|---|---|---|
| `pagos` | 81 | 82 | +1 |
| `checkouts` | 71 | 72 | +1 |
| `pedidos_tpv` | 122 | 125 | +3 (A y B cancelados, venta del Cajero/a) |
| `cuentas_comerciales` | 122 | 125 | +3 |
| Cuentas abiertas | 84 | 86 | +2 (A y B, vacías) |
| `ventas_fiscales` | 71 | 72 | +1 (sin documento) |
| `reembolsos` | 10 | 11 | +1 |
| `caja_operaciones` | 84 | 86 | +2, neto 0,00 € |
| Descuentos aplicados / autorizaciones | 6 / 3 | 6 / 3 | 0 |
| Stock del agua QA-A1 (almacén / piso) | 70 / 0 | 69 / 0 | −1 |
| Sesiones de caja abiertas en A1 | 0 | 0 | 0 |

## Resultado de F-07 (cuentas)

- **Aparcar y recuperar:** PASS. Las cuentas guardadas aparecen en «Cuentas abiertas» y se
  retoman.
- **Unir cuentas:** la **validación** del servidor es correcta y clara (rechaza si la cuenta
  que se funde tiene un pedido sin enviar), pero **la unión efectiva no se probó**.
- **Repartir productos:** **no se probó**: «No hay productos repartibles» mientras no haya
  líneas enviadas.
- Para cerrar F-07 hace falta enviar al menos un pedido (1 unidad más de stock); lo frenó el
  sistema de permisos por no estar en el lote autorizado.

## Resultado de F-12 (descuentos)

- Cajero/a y Camarero/a: el servidor rechaza `PERCENT` y `COURTESY` (PASS).
- Encargado: rechazado con `descuento_no_autorizado`, aunque su política dice «solicitar: sí,
  escalar: sí, máximo 0 %». El código corta en `v_max<=0` antes de crear la solicitud (H-39).
- Aprobación por el Propietario y aplicación con autorización: **no probada**.

## Reservas

- Las sondas del Cajero/a y del Camarero/a se hicieron con identificadores inventados; no
  prueban el éxito de la operación permitida, solo el rechazo y el orden de las comprobaciones.
- El Propietario no entró en esta ronda.
- Tras cerrar la sesión quedaron en el navegador pendientes locales de `productos` ligados a
  QA-EMP-A / QA-A1; no se tocaron (H-19).
