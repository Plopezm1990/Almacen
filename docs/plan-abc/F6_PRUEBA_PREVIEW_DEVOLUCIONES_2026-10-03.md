# F6 · D13 — guía para probar las devoluciones en el preview privado de QA

Fecha: 2026-10-03
Autorización: «D13: devoluciones» con las decisiones A a D, Pedro, 3/10/2026. **Solo QA.**
Informe: `F6_D13_DEVOLUCIONES_RESULTADO_2026-10-03.md`.

## Antes de empezar

- Entra por la dirección del **PR 118** (`deploy-preview-118--…`) en una **ventana privada nueva** (la caché del navegador puede servir la versión anterior) y con tu usuario de
  **QA** (Propietario), **Local A1**. Si la dirección no empieza por `deploy-preview-`, **no sigas**.
- QA **no tiene ningún pago**, así que primero hay que generar un cobro de prueba **en efectivo** (Prueba 0). Un cobro con tarjeta simulada se queda pendiente y **no sirve**: solo se
  puede devolver un pago confirmado.
- La caja de A1 está **abierta** (a las 09:00 UTC del 3/10 la sesión abierta era `6be7b6af`, con fondo 0; las anteriores se cerraron). El cobro de prueba suma efectivo a esa caja y la devolución lo resta (movimiento negativo), así que **si luego haces un cierre
  de caja, el efectivo esperado ya no será 0 €** hasta devolverlo todo. Haz una prueba tras otra y devuelve el cobro **completo** al final si quieres dejar la caja a cero (ojo: lo que se devuelve es el total cobrado menos lo ya devuelto; las solicitudes canceladas no cuentan).
- Todo lo que hagas **se guarda de verdad en QA** (con auditoría). Escribe como motivo «prueba D13».

## Prueba 0 — Un cobro en efectivo de 3 €

1. **TPV**: añade un producto barato (o varios hasta unos 3 €) al carrito → **Guardar pedido** → **Enviar a cocina**.
2. Cuando el pedido salga como enviado aparece el panel de cobro: deja el importe como está y pulsa **Cobrar efectivo**. Debe decir «Efectivo confirmado y cuenta pagada.».
3. Si en algún paso no encuentras el botón o sale un error rojo, **para y dime qué dice** (el cobro no es parte de esta pieza, pero sin él no hay nada que devolver).

## Prueba 1 — Solicitar como Propietario (se aprueba en el acto)

1. **Devoluciones → Reembolso económico**. En «Pago original» elige el cobro de la Prueba 0 (medio EFECTIVO).
2. **No debe salir ningún aviso** de «sin permiso» ni de «pendiente de aprobación» (eres Propietario).
3. Importe **1**, motivo «prueba D13» → **Solicitar reembolso** → «Solicitud creada como PENDIENTE. El simulador no envía dinero a un proveedor real.»
4. La fila sale con **«Aprobada el …»** (fecha y hora de ahora) y con los botones **Confirmar efectivo** y **Cancelar solicitud**. **No** debe aparecer «Aprobar» ni «Pendiente de aprobación».

## Prueba 2 — Cancelar

1. En esa fila, **Cancelar solicitud** → motivo «prueba D13» → **Confirmar cancelación** → «Solicitud cancelada y saldo liberado.» (no «rechazada»).
2. La fila queda «Cancelado» y el «disponible» del pago vuelve a los 3 €.

## Prueba 3 — Confirmar el efectivo

1. Solicita otra vez **1 €** (motivo «prueba D13») → **Confirmar efectivo**.
2. Debe decir «Reembolso en efectivo confirmado. Se ha creado un único movimiento negativo de caja.» y la fila pasar a Confirmado. El disponible baja a 2 €.
3. (Opcional) Repite con **2 €** para dejar el cobro devuelto del todo; el pago deja de salir en la lista de «Pago original».

## Prueba 4 (opcional) — El permiso del Cajero/a en Configuración

1. **Sistema → Configuración → Permisos**. Busca la fila **«Solicitar devoluciones (el Cajero/a necesita aprobación)»**: en la columna del **Cajero/a** debe estar **desactivada** y **sin candado 🔒**, así que **se puede activar** (antes de D13 tenía el candado). Actívala con el motivo «prueba D13», y **vuelve a desactivarla** con otro motivo.
2. La fila **«Aprobar y confirmar devoluciones»** debe seguir **con el candado 🔒 para el Cajero/a** (solo Encargado y Propietario).
3. Con el permiso activado, el Cajero/a vería en Devoluciones el aviso «Lo que solicites quedará pendiente de aprobación…». Eso **no se puede ver desde tu usuario**: está cubierto por las pruebas automáticas.

## Qué debes avisarme

Dime «hecho» (y cualquier cosa rara: un cartel rojo que no entiendas, un botón que no responde, una cifra distinta de la esperada). Yo compruebo en QA, **solo lectura**: los reembolsos
(estados, importes, quién y cuándo aprobó), los eventos `REEMBOLSO_SOLICITADO` (sin aprobación pendiente) y `REEMBOLSO_APROBADO`, el movimiento negativo de caja del efectivo, que no
hay envíos pendientes en la cola y, si hiciste la Prueba 4, la auditoría del cambio de permiso.

## Qué no cubre esta prueba

- **Aprobar o rechazar la solicitud de un Cajero/a**: necesita otro usuario; está cubierto por las pruebas automáticas (servidor y pantalla).
- **Devoluciones de pagos con tarjeta**: la tarjeta simulada no llega a «confirmado» sin un proveedor; con las pruebas automáticas se comprueba que aprobar encola el envío **una sola vez** y que solicitar no lo encola.
- La vista «De cliente» (sistema anterior), un proveedor de pagos real y producción.
