# Verificación en el navegador de QA (Ola 1) y hallazgo nuevo H-48 · 27/11/2026

Rama `correccion/ola0-tpv-2026-11-26`, vista previa de la PR #227 (`deploy-preview-227--chic-entremet-9107cf.netlify.app`),
contra el Supabase de QA (`qjqorixtkilwsndqayyx`). Producción no se ha tocado.

Se entró como **PM07 (Propietario real, con su segundo factor)** en `QA-EMP-A` / `QA-A1`, terminal A1, sesión de caja
`42a7063b…` abierta. Cada resultado se contrastó con la base de datos de QA, no solo con lo que mostraba la pantalla.

## Resultado

| Hallazgo | Qué se hizo | Resultado |
|---|---|---|
| **H-37** venta rápida en una sola operación | Café solo en venta rápida, «Cobrar ahora» en efectivo | **Verificado.** Las tres transiciones de la línea (ENVIADA → EN_PREPARACION → PREPARADA → SERVIDA) llevan el mismo instante y la operación `a05.3.venta_rapida…`; cuenta CERRADA, FACTURA TPV n.º 51 |
| **H-37** producto sin ruta de cocina | Agua 50 cl (sin ruta) en venta rápida | **No falla, y es lo esperado con la decisión tomada:** la venta se completa por cobro sin pasar por cocina (cuenta CERRADA, FACTURA n.º 54). Tardó unos 25 s con «Procesando venta…» |
| **H-21** cancelar cierra la cuenta | Pedido de sala de un croissant, «Cancelar pedido» con motivo | **Verificado.** Pedido CANCELADO, cuenta CERRADA, evento `CUENTA_CERRADA_SIN_PEDIDOS` |
| **H-27** tarjeta simulada desde la pantalla | Efectivo parcial + «Iniciar tarjeta simulada»; **Rechazar** y luego **Aprobar** | **Verificado.** Aparece «Tarjeta simulada pendiente (solo QA)»; el rechazo deja el último intento «Rechazado» y el saldo en 0,82 €; la aprobación deja el saldo en 0 y ofrece «Cerrar cuenta pagada» |
| **H-23** documento al cerrar una cuenta pagada | Venta mixta limpia (1,00 € efectivo + 1,32 € tarjeta aprobada), servir y «Cerrar cuenta pagada» | **Verificado.** Un solo clic cierra la cuenta y emite la FACTURA TPV n.º 53 |
| **H-24** esperado de caja del servidor | Pantalla «Arqueo de caja» | **Verificado.** «Efectivo esperado €13,37 — calculado por el servidor… fondo 0 · entradas 13,37». Coincide con la suma del libro de caja de la sesión (5 entradas) |
| **H-38b** ventas cobradas sin documento | Venta de 1,32 € cobrada con la cuenta atascada por H-48 (ver abajo); Cocina → gestión avanzada | **Verificado.** El panel «Ventas cobradas sin documento fiscal (1)» lista la venta con su importe y hora; «Emitir documento pendiente» emite la FACTURA TPV n.º 52 y el panel desaparece |

Documentos emitidos en la verificación: n.º 51, 52, 53 y 54 (serie TPV, simulador de QA; no se presentó nada a la AEAT).

## Hallazgo nuevo H-48 · una tarjeta rechazada y repetida impedía cerrar la cuenta

**Cómo apareció.** En la venta mixta se probó primero **Rechazar** la tarjeta simulada y después se repitió el cobro con
**Aprobar**. Con el saldo ya en 0, «Cerrar cuenta pagada» respondió «El servidor todavía tiene un pago o reserva sin resolver
para esta cuenta» y la cuenta quedó ABIERTA, con la venta cobrada y sin documento.

**Causa (leída en el servidor).** `public.abc_cerrar_cuenta_pagada` se niega a cerrar si el checkout tiene algún pago con
`estado not in ('CONFIRMADO','REEMBOLSADO')` (`cuenta_pago_no_resuelto`). Un pago **RECHAZADO** o **CANCELADO** no movió
dinero, pero cumple esa condición y bloquea el cierre para siempre. La misma condición está en la migración vigente
(`20261108170000_a02_cerrar_y_sellar_venta_fiscal.sql`), así que **no es un efecto de la simulación**: pasaría con una tarjeta
real rechazada por el banco y cobrada después con otra tarjeta o en efectivo.

**Por qué importa.** La cuenta atascada además **bloquea iniciar otra venta rápida en el terminal** («Hay una cuenta abierta en
este terminal. Continúa esa cuenta en Sala o ciérrala…») y su venta cobrada queda sin documento (bloquearía el cierre de caja).
Es el mismo síntoma que las cuentas acumuladas de H-21, por otra vía.

**Corrección.** Migración `20261127120000_abc_f4_cerrar_cuenta_ignora_pagos_rechazados.sql`: parchea la definición viva y
deja de contar los pagos RECHAZADO y CANCELADO. Siguen bloqueando PENDIENTE, AUTORIZADO, DESCONOCIDO y cualquier otro estado
vivo, y no cambian el saldo pendiente, las reservas activas, las incidencias abiertas ni el pedido sin servir. Es idempotente y
falla en voz alta si la función no tiene la forma esperada. No se toca `private.abc_actualizar_pago_reembolso_estado`, que
usa el mismo predicado para otro fin (reembolsos).

**Prueba.** `tests/rediseno/h48-cerrar-cuenta-ignora-pagos-rechazados-pglite-contract.mjs`: la función original se lee de la
migración A-02 (sin reescribirla), así que no hay deriva. **Antes** reproduce el fallo (RECHAZADO y CANCELADO impiden cerrar);
**después** se cierra y los casos vivos siguen bloqueando. 25 comprobaciones.

**Aplicada en QA** y comprobada: función parcheada, `authenticated` sí / `anon` no, `SECURITY DEFINER` intacto. Con ella, la
cuenta atascada se cerró desde la pantalla una vez servido su pedido (cuenta CERRADA, pedido CERRADO).

## Qué NO se ha verificado

- **H-20** (cancelar el pedido si falla el envío de una venta rápida): no se pudo provocar el fallo. Con la decisión de H-37, un
  producto sin ruta ya no hace fallar la venta, así que ese camino solo queda cubierto por la prueba de ejecución.
- **El cierre de caja en sí** (iniciar cierre provisional y cerrarlo): no se inició; la sesión sigue ABIERTA. Solo se vio el
  panel de ventas sin documento y el esperado del arqueo.
- **Reembolso con tarjeta** simulado: sigue sin función de servidor (ver el documento de H-27 / H-23).
- La venta del 25/11 (checkout `a4543959…`, 1,00 €) **sigue sin documento**: no se ha tocado.

## Estado de QA al terminar

- Sesión cerrada en el navegador.
- `QA-EMP-A`, el local `QA-A1` y la membresía de PM07 **vuelven a `activo=false`**, como estaban antes de la verificación.
  Las membresías de QA-A2, Cajero/a y Encargado no se tocaron (siguen desactivadas).
- La sesión de caja `42a7063b…` sigue ABIERTA, con 5 entradas de efectivo (13,37 €) y todas las ventas con documento
  salvo la del 25/11.
- Cuentas de la verificación: todas CERRADAS. No quedó ninguna abierta.
- Las contraseñas y códigos de segundo factor que se usaron no se guardaron en ningún archivo.
