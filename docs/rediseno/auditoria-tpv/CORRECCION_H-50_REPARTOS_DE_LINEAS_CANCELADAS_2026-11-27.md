# Corrección de H-50 · un reparto sobre una línea cancelada retiene la cuenta abierta · 27/11/2026

Estado: **migración aplicada en QA, contrato PGlite hecho y comprobado en QA con la cuenta real (transacción deshecha).**
Rama `correccion/ola0-tpv-2026-11-26`. Producción no se ha tocado. Hallazgo nuevo, descubierto al probar H-47.

## Qué pasaba

Al probar «Deshacer reparto» (H-47) en QA, la cuenta B se quedó **ABIERTA** tras cancelar su pedido. B conservaba una fila de `cuenta_linea_repartos` en estado `ACTIVO` sobre una línea ya `CANCELADA`.
Las dos funciones que cierran cuentas contaban esa fila como «reparto vivo»:

- `abc_cancelar_pedido` (H-21: al cancelar el último pedido vivo se cierra la cuenta) no la cerraba;
- `abc_cerrar_cuentas_sin_actividad` (H-28) la omitía.

Resultado: una cuenta cuyo reparto acababa en una línea cancelada **no se podía cerrar desde ninguna pantalla**. Una línea cancelada no tiene importe (el total comercial de la cuenta ya la excluye),
así que su reparto no es dinero en juego.

## Qué se hizo

Migración `20261128150000_abc_f6_repartos_de_lineas_canceladas_no_retienen_cuenta.sql`: en las dos funciones, un reparto solo cuenta como vivo si su línea **no** está `CANCELADA`. Se parchea la definición viva de cada
función (idempotente por la marca «H-50», con errores explícitos si falta la función o cambia la estructura). No cambia permisos, tablas ni datos.

No se cierra de más: un reparto sobre una línea **viva** (por ejemplo, una parte recibida de otra cuenta), una cuota por importe activa y un pedido vivo siguen reteniendo la cuenta.

## Pruebas

- **PGlite** `tests/rediseno/h50-repartos-de-lineas-canceladas-pglite-contract.mjs`: ANTES de la migración reproduce el fallo en las dos funciones; DESPUÉS cierra la cuenta al cancelar y en la limpieza; sigue sin cerrar con reparto
  sobre línea viva, con cuota activa o con pedido vivo; la migración es idempotente, falla en voz alta si falta una función, deja la marca en ambas y no toca los permisos.
- **QA, cuenta real, transacción deshecha:** con la cuenta de prueba B (de H-47) movida a un día cerrado dentro de la transacción, «Cerrar cuentas sin actividad» **la cierra** (1 cerrada, 83 omitidas, con su evento).
  Todo se deshizo: B sigue `ABIERTA` en QA.

## Qué NO está hecho

- La cuenta de prueba B (`75a9fdf5-63d7-4cd2-8a87-58f16cf382ca`) sigue abierta en QA. Al ser de hoy (con un pedido cancelado) no se cierra todavía con la limpieza; mañana, ya de un día cerrado, la cerrará el botón de H-28.
- No se ha repetido desde la pantalla con sesión (la prueba real se hizo contra la función, con la cuenta real, dentro de una transacción deshecha).
- Las filas `ACTIVO` sobre líneas canceladas siguen existiendo (no se borran ni se cierran); solo dejan de contar para cerrar la cuenta.
