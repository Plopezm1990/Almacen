# Corrección de la Ola 5 · resto · 27/11/2026

Estado: **seis de los diez hallazgos corregidos en la pantalla (H-16, H-25, H-30, H-32, H-34, H-41), con contrato propio; cuatro quedan fuera con su razón (H-28, H-29, H-35, H-47).** Sin migraciones.
Rama `correccion/ola0-tpv-2026-11-26`. Producción no se ha tocado. Contrato: `tests/rediseno/ola5-resto-tpv-contract.mjs` (falla con el código anterior).

| Hallazgo | Cambio | Comprobado |
|---|---|---|
| **H-16** nombres de producto fuera de su tarjeta (TPV normal) | Las columnas salen del **ancho real de la rejilla** (tarjetas de 140 px como mínimo) y la paginación usa el mismo número; el nombre se corta en **dos líneas** con puntos suspensivos dentro de su tarjeta. La tarjeta hereda `white-space: nowrap`: hubo que poner `white-space: normal` al nombre (se vio al medir). El botón no oculta su desbordamiento: la insignia de cantidad sale por su esquina. En modo caja no cambia. | Navegador (modo local, nombres largos): a 1440, 1024 y 390 px **0 nombres fuera de su tarjeta**, como máximo 2 líneas, sin desplazamiento horizontal; 4 / 2 / 2 columnas y páginas de 16 / 8 / 8 productos coherentes con lo pintado. |
| **H-25** cierre de caja escondido | En «Arqueo de caja» hay una tarjeta **«Cerrar caja»** con el botón «Ir al cierre de la sesión de caja»: lleva a Cocina y comandas con la gestión avanzada ya abierta (marca de sesión que se borra sola). | Navegador: el botón lleva a «Cocina y comandas» con «Ocultar gestión avanzada» visible. **No se movió el cierre de sitio**: es un acceso directo. |
| **H-30** hay que reabrir las operaciones de cuenta | «Mostrar operaciones de cuenta» se recuerda **por empresa y local** en el navegador (solo se guarda al pulsar el botón). | Navegador: se activa, queda guardado y, saliendo del TPV y volviendo, sigue abierto. **No se probó con una recarga completa**, y la pantalla tras recargar sigue siendo Inicio. |
| **H-32** error crudo sin red | «TypeError: Failed to fetch» y equivalentes de Firefox y Safari se traducen: «Sin conexión con el servidor. No se pudo confirmar la operación: cuando vuelva la red, actualiza la pantalla y comprueba antes de repetirla.» En los dos traductores del TPV (cuentas y cobro). **No dice que no haya cambiado nada**: la petición pudo llegar antes de caerse la red. | Contrato (la función con casos). **El tiempo de espera de ~15 s no se ha acortado.** |
| **H-34** «Anular venta» habilitado sin permiso | El botón solo se muestra a Propietario y Encargado cuando hay nube (el servidor `revertir_venta_stock_carrito` exige `pm07_puede_gestionar_stock`, comprobado en QA); al resto se le explica «Solo el Propietario y el Encargado pueden anular una venta». Sin nube no cambia. | Contrato. Sin probar con un Camarero/a real. |
| **H-41** el Camarero/a no ve las cuentas abiertas | El rechazo del servidor (`abc_caja_no_autorizado`) en la lista de cuentas abiertas se traduce a «Tu cargo no puede ver la lista de cuentas abiertas de este local. Las mesas con cuenta se abren desde «Sala y mesas»». | Contrato. Sin probar con un Camarero/a real. |

La hoja de estilos sube a `qa-orbita-shell-v94-20261127`.

## Qué queda fuera de esta ola y por qué

- **H-28** (85 cuentas abiertas de días ya cerrados) y **H-29** (una recarga a mitad de «Guardar pedido» deja una cuenta sin pedido): hacen falta decisiones de producto y cambios de servidor sobre cuentas con dinero
  (quién las cierra y cuándo; si crear cuenta y pedido es una sola operación o se cierran las cuentas sin pedido tras un tiempo). Se suman a la limpieza de QA (acta §11).
- **H-35** (el historial no refleja los reembolsos): el historial no dispone de los reembolsos económicos; hay que diseñar de dónde salen (y cómo se descuentan del «total vigente») antes de tocar la pantalla.
- **H-47** («Deshacer reparto»): existe la capacidad `ABC_REPARTO_REVERTIR`, pero la pantalla solo ofrece «Mover producto»; el botón en la cuenta destino exige tocar el reparto con dinero y probarlo con cuentas reales.

## Qué NO está verificado

- H-34 y H-41 con un **Camarero/a** o **Cajero/a** reales (solo contrato).
- H-30 con una recarga completa; H-32 con la red cortada de verdad.
- Nada de esta ola se ha visto todavía en la **vista previa de QA con sesión**: las comprobaciones de H-16, H-25 y H-30 se hicieron en `localhost` con productos sembrados solo en el almacenamiento local del navegador.

## Aviso de proceso: un fallo de la Ola 4, encontrado y corregido al probar esto

Al preparar las comprobaciones del navegador, el **modo local se quedaba en «Cargando almacén…»**. Por bisección con compilaciones (la versión anterior, H-15 sola y H-05 sola cargaban; el commit completo de la Ola 4 no) la causa era el pendiente «Piso por reponer» (H-15):
llamaba a `setState` al montar aunque no cambiara nada. Se corrigió llevando la lista en una referencia (`cc7d562c`) y el contrato de H-15 lo vigila. **El commit de la Ola 4 que estuvo subido unos minutos (`306c1bb2`) tenía ese fallo.**
No se ha comprobado si también afectaba a la vista previa de QA con sesión, pero el mismo código se ejecuta al montar allí.
