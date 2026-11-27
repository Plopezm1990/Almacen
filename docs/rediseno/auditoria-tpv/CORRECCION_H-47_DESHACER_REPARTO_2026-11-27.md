# Corrección de H-47 · «Deshacer reparto» · 27/11/2026

Estado: **pantalla y contrato hechos; sin migración; sin probar desde la pantalla con sesión de QA.**
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
- **Sin probar desde la pantalla con sesión de QA** (hace falta una sesión de PM07 y dos cuentas abiertas con un reparto real).
