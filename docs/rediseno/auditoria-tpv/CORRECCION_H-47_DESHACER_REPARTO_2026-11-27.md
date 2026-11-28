# Corrección de H-47 · «Deshacer reparto» · 27/11/2026

Estado: **pantalla y contrato hechos; sin migración; probado desde la pantalla con sesión real de QA el 27/11/2026 (vista previa del PR #227).**
Rama `correccion/ola0-tpv-2026-11-26`. Producción no se ha tocado.

- **H-47 (P3):** «No hay botón para deshacer un reparto». Solo existía «Mover producto».

## Qué se encontró

- El servidor **ya sabe** devolver una cantidad a la cuenta de origen: `abc_mover_cantidad_linea_cuenta` mueve en cualquier sentido entre dos cuentas abiertas del mismo día
  y valida lo importante (parte fiscalizada inmóvil, sin reparto por importe activo, versiones, terminal y sesión). Deshacer un reparto de productos es, por tanto, **mover de vuelta**.
- La capacidad `ABC_REPARTO_REVERTIR` solo la usa `abc_revertir_cuota_importe`, que es para repartos **por importe** (otra función, sin pantalla; no se toca aquí).
- La consulta del reparto de la cuenta ya devuelve, por línea, `cuenta_origen_pedido` (la cuenta que tenía el pedido) y `cuenta_reparto_id` (la que tiene ahora la parte). No hace falta servidor nuevo.
- La dificultad que decía el hallazgo («no se puede si esa cuenta no se deja retomar») la resolvió H-42/H-22 (las cuentas con pedido se pueden retomar).

## Qué se hizo

En el panel «Repartir productos» de la cuenta que **recibió** el producto, bloque «Productos recibidos de otra cuenta»: una línea por producto, con la cantidad que se puede devolver,
de qué cuenta viene y un botón **«Deshacer reparto»**. Pulsarlo mueve esa cantidad de vuelta a la cuenta de origen con la misma función de servidor, con las versiones leídas
del servidor, recarga ambas cuentas y lo dice. Si la cuenta de origen ya no admite recibirlo (cerrada, de otro día), la línea lo explica y **no ofrece el botón**. La parte ya fiscalizada
no se devuelve y se avisa de que se queda. Un conflicto de versión recarga el estado antes de mostrar el error.

Permiso: el botón solo sale para **Propietario y Encargado con la nube activa** (el mismo criterio que el cierre de cuentas de H-28, que coincide con la capacidad `ABC_REPARTO_REVERTIR` por defecto).

## Pruebas

`tests/rediseno/h47-deshacer-reparto-contract.mjs` (falla con el código anterior): ejecuta el ayudante real que decide qué se puede devolver (línea recibida, línea propia, parte fiscalizada, todo fiscalizado,
canceladas, cuenta de origen sin destino, reparto en otra cuenta, sin estado) y fija el cableado (misma función de servidor, no pulsar dos veces, permiso, mensajes, recarga tras conflicto).

## Qué NO está hecho y límites

- **El servidor no distingue el permiso de «devolver» del de «repartir».** Quien puede repartir (también Cajero/a y Camarero/a) ya podía mover el producto de vuelta a mano con «Mover producto»; el
  botón se limita a Propietario y Encargado en la pantalla, pero eso no es una barrera del servidor. Si se quiere forzar `ABC_REPARTO_REVERTIR` en el servidor haría falta una función nueva (migración).
- Devuelve **todo lo devolvible** de la línea; para devolver solo una parte sigue valiendo «Mover producto» con la cantidad.
- No cubre repartos **por importe** (`abc_revertir_cuota_importe`) ni la unión de cuentas.
## Prueba en QA con sesión (27/11/2026)

Dos cuentas de hoy creadas desde la pantalla (A: 2 croissants; B: 1 croissant, ambas enviadas). Se repartió el croissant de B a A con «Mover producto»; en A, «Abrir reparto» mostró el bloque
**«Productos recibidos de otra cuenta»** (1,00 · viene de la cuenta B) con **«Deshacer reparto»**. Al pulsarlo: aviso «Reparto deshecho…», el bloque desapareció y el servidor dejó el croissant otra vez en B
(`cuenta_linea_repartos`: la parte de A cerrada y la de B activa de nuevo; dos eventos `CUENTA_REPARTO_LINEA_MOVIDO`, B→A y A→B).
Limpieza: se canceló el pedido de A (cuenta CERRADA) y el de B.

**Hallazgo nuevo al limpiar (no es de H-47):** la cuenta B se quedó **ABIERTA** con el pedido cancelado, porque conserva un reparto `ACTIVO` sobre una línea ya `CANCELADA`. Ni `abc_cancelar_pedido`
la cierra ni «Cerrar cuentas sin actividad» (H-28) la toca (lo trata como reparto vivo). Una cuenta con un reparto que se cancela queda abierta sin salida desde la pantalla. Queda anotado para corregir
(ignorar los repartos cuya línea está cancelada en ambos sitios). En QA queda esa cuenta de prueba (`75a9fdf5-63d7-4cd2-8a87-58f16cf382ca`).
