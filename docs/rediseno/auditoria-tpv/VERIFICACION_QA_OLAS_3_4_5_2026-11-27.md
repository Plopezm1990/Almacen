# Verificación en QA de las olas 3, 4 y 5 · 27/11/2026

Vista previa de la PR #227 (`deploy-preview-227--chic-entremet-9107cf.netlify.app`, hoja de estilos `v94`, commit `21f308a6`), contra el Supabase de QA (`qjqorixtkilwsndqayyx`).
Se entró como **PM07 (Propietario, con su segundo factor)** en `QA-EMP-A` / `QA-A1`, terminal A1. Producción no se ha tocado.

## Resultado

| Hallazgo | Qué se hizo | Resultado |
|---|---|---|
| **Carga con sesión** (regresión de la Ola 4, ya corregida) | Abrir la aplicación con la sesión real | **Verificado.** Carga sin quedarse en «Cargando almacén…». |
| **H-15** pendiente «Piso por reponer» | Abrir Inicio como Propietario | **Verificado.** Aparece «Piso por reponer · Agua 50 cl (QA) · 2,00 servida(s) desde el almacén hoy» y **cuadra con el libro**: dos ventas del día con `delta_almacen = −1` y `delta_piso = 0` (ids 1736 y 1738). |
| **H-15** tarjeta y ticket | TPV → tarjeta de «Agua 50 cl (QA)» (piso 0, almacén con existencias) y añadirla al ticket | **Verificado.** La tarjeta dice «sin piso · sale del almacén» (ámbar) y el ticket avisa: «el piso de venta tiene 0 y 1 saldrá del almacén. La venta queda anotada para reponer el piso.» (estado accesible, ámbar). No se llegó a cobrar: la anotación en el servidor ya está comprobada en el libro. |
| **H-01 / H-12** (Ola 3) acción principal | Modo caja con una línea en el ticket | **Verificado.** «F9 · Guardar pedido» naranja `rgb(255,75,50)`, texto oscuro, **64 px**; «Cobrar» ya no aparece neutro porque hay líneas. |
| **H-02** (Ola 3) aviso de sincronización | Mismo estado | **Verificado.** El aviso queda por debajo de la banda de cuenta, sin solape. |
| **H-05** devolver anticipo | Encargo de prueba (línea a mano de 20 €) con **señal de 5 € en efectivo** → «Devolver anticipo» → motivo → confirmar | **Verificado.** En `pagos_encargo`: el cobro `SEÑAL` 5,00 CONFIRMADO y **un único** `REVERSO` de 5,00 con el motivo «Devolución de anticipo: …» y el usuario. La ficha pierde la señal y el botón desaparece. **Repetir la petición** (misma operación) devuelve `replayed: true` y sigue habiendo **un solo** reverso. |
| **H-16** nombres de producto (TPV normal) | Con los productos reales de QA a 1440 y a 390 px | **Verificado.** 0 nombres fuera de su tarjeta, máximo 2 líneas, 4 columnas a 1440 y 2 a 390, sin desplazamiento horizontal. |
| **H-30** operaciones de cuenta recordadas | Activar «Mostrar operaciones de cuenta», **recargar la página** y abrir el TPV | **Verificado** con recarga completa: sigue abierto. |
| **H-25** «Cerrar caja» | Caja y fiscalidad → Arqueo de caja → «Ir al cierre de la sesión de caja» | **Verificado.** Lleva a «Cocina y comandas» con la gestión avanzada abierta. |
| **H-34** «Anular venta» (camino con permiso) | Detalle de una venta del historial como Propietario | **Verificado.** El Propietario **sigue viendo «Anular venta»** y no sale el aviso de falta de permiso. |

## Qué NO se pudo verificar

- **H-34 y H-41, camino sin permiso.** Solo hay sesión del Propietario: las cuentas de Encargado, Cajero/a y Camarero/a de la auditoría tienen la contraseña inicial pendiente de cambiar (H-36) y no pasan las comprobaciones de capacidad. Quedan solo con contrato.
- **H-32, sin red.** Se intentó forzar el fallo de red sustituyendo `fetch` en la página, pero el cliente de Supabase conserva la referencia original: **la prueba no fue concluyente** (la lista de cuentas cargó con normalidad). Queda solo con contrato.
- **Cobrar el Agua sin piso hasta el final**: no se hizo (no se crearon ventas ni cuentas); lo que sí se comprobó es el aviso previo y que el servidor ya anota estas ventas.

## Datos de prueba y estado de QA al terminar

- Creados y **borrados**: el encargo de prueba y sus dos filas de `pagos_encargo` (cobro y reverso). No se creó ninguna cuenta, venta ni documento.
- Sesión cerrada; preferencia local de H-30 eliminada; `QA-EMP-A`, `QA-A1` y la membresía 22 vuelven a `activo = false`.
- **Dato nuevo para la limpieza de QA (acta §11):** «Cuentas abiertas» muestra **90** cuentas abiertas, 89 de días ya cerrados (suben con cada prueba: ver H-28 y H-49).
- No se guardó ninguna contraseña ni código.
