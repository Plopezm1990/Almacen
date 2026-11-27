# Corrección de la Ola 1 · cobro y venta · 26-27/11/2026

Estado: **implementada y probada con contratos y pruebas de ejecución; migraciones aplicadas en QA;
sin verificar con identidades reales en QA** (ver «Qué no está verificado»). Rama
`correccion/ola0-tpv-2026-11-26` (PR borrador #226, y #227 solo para la vista previa de Netlify).

## Decisiones del usuario (27/11/2026: «lo más recomendado, actúa como experto»)

| Punto | Decisión | Por qué |
|---|---|---|
| H-39 · «máximo 0 %» | Significa **sin descuentos**; la pantalla avisa de las combinaciones que no funcionan | Cambiar el servidor tocaría una función que mueve dinero (`abc_aplicar_descuento_cuenta`); avisar no arriesga nada y deja el servidor estricto. |
| H-37 · venta rápida del Cajero/a | **Operación única de servidor** con el permiso de cobro | Mínimo privilegio: el Cajero/a sigue sin permisos de cocina. No encadenar pasos dejaba cuentas que nadie podía cerrar. |
| H-21 / H-42 | **Cerrar la cuenta** al cancelar su último pedido, si no tiene nada más | Evita que se acumulen (94 en QA) y que bloqueen el terminal. |

## Qué se hizo

| Hallazgo | Cambio | Pruebas |
|---|---|---|
| **H-26** | Los bloqueos del cierre se explican con una frase (ensayo C12 y cierre provisional), en vez de «Pendiente operativo». | Ejecución (3). |
| **H-44** | «Reintentar aplicación» enviaba el valor como `10.00000000` y el servidor comparaba el texto de la petición original (`10`): `operation_id_conflict`. El valor se envía siempre en su forma más corta. | Ejecución (6); falla con el código anterior con el mismo error. |
| **H-21 / H-42** | Migración `20261127100000`: `abc_cancelar_pedido` cierra la cuenta si no queda otro pedido distinto de CANCELADO, ni venta fiscal viva, ni checkout, ni reparto o cuota vivos. Evento `CUENTA_CERRADA_SIN_PEDIDOS`. | PGlite (22). |
| **H-37** | Migración `20261127110000`: `abc_completar_venta_rapida` (permiso `ABC_COBRO_INICIAR`, solo cuentas de BARRA) hace los tres pasos de cada línea con una marca de transacción; las transiciones directas siguen cerradas. El cliente hace una sola llamada. | PGlite (26) + ejecución (7). |
| **H-20** | Si el envío de «Cobrar ahora» falla (p. ej. producto sin ruta a cocina), se cancela el pedido (y con H-21 se cierra la cuenta) y el carrito se conserva. | Ejecución (3). |
| **H-39** | Avisos bajo cada cargo: «máximo 0 %» sin efecto; «solicitar»/«escalado» sin «aplicar» rechazado por el servidor. | Ejecución (5). |

Batería sin base de datos: 340 contratos activos, 0 fallos; manifiesto 400 entradas, 9 PGlite.

## Qué NO está verificado

- **H-21 y H-37 con identidades reales en QA.** Las cuentas de prueba del Cajero/a y del Encargado de la auditoría ya
  no pasan ninguna comprobación de capacidad (`private.abc_tiene_capacidad` devuelve falso, y llama antes a
  `plataforma_debe_cambiar_password()`: sospecha, no confirmada, de que son cuentas con cambio de contraseña inicial
  pendiente, H-36). La evidencia es el PGlite, que modela las funciones con su texto original.
- **H-20 y la pantalla de H-37** solo con servidor falso.
- **Cuentas ya acumuladas:** las 94 cuentas abiertas que QA ya tenía no se cierran solas; es parte de la limpieza de QA.

## Pendientes de la Ola 1 y por qué

| Hallazgo | Situación |
|---|---|
| **H-22** (tras enviar no aparece el cobro) | **Corregida el 27/11** tras verla en el navegador: `enviarPedidoA05` no devolvía la cuenta y el panel de cobro se sustituía por «Caja del TPV». Ver `CORRECCION_H-22_ENVIAR_PEDIDO_Y_COBRO_2026-11-27.md`. |
| **H-27** (tarjeta simulada y su reembolso) y **H-23** (documento de la venta mixta) | Dependen de **H-06 (ola 2)**: `abc_qa_confirmar_pago_simulado` y las demás funciones de QA no tienen código en el repositorio y solo aceptan QA-EMP-A/QA-A1. Un botón en la interfaz sobre una función sin versionar sería construir sobre algo no gobernado. Primero H-06, después un botón «Aprobar/Rechazar tarjeta simulada» solo en QA. |
| **H-43** (descuento sobre línea recibida por reparto) | Causa por confirmar; no se puede comprobar sin stock y sin una cuenta con permisos de descuento. |
