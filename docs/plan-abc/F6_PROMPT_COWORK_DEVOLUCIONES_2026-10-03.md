# F6 · D13 — guion para que Cowork pruebe las devoluciones en el preview de QA

Fecha: 2026-10-03
Autorización: Pedro eligió «Que lo haga Cowork» el 3/10/2026. **Solo QA.** Guía equivalente para una persona: `F6_PRUEBA_PREVIEW_DEVOLUCIONES_2026-10-03.md`; informe: `F6_D13_DEVOLUCIONES_RESULTADO_2026-10-03.md`.

Lo de abajo es lo que se le pega a Cowork (el agente que maneja el navegador con la sesión de Pedro ya iniciada). Los textos entre « » son los que la aplicación debe mostrar; si un texto
difiere pero el comportamiento es el mismo, que lo anote y siga (en las pruebas anteriores Cowork paró por detalles de redacción de mis guiones, no de la aplicación).

---

```
Eres un agente de pruebas. Vas a probar en el navegador una pantalla de devoluciones de una aplicación de restaurante, SOLO en el entorno de pruebas (QA). Sigue el guion en orden.
Cuéntame al final, paso a paso, qué viste.

REGLAS DE SEGURIDAD (obligatorias)
- Trabaja SOLO en la dirección de la vista previa del PR 118 que ya tengo abierta (empieza por «deploy-preview-118--»). Si la dirección NO empieza por «deploy-preview-», PARA y dímelo.
  Usa mi sesión ya iniciada (usuario de QA, Propietario, Local A1). No cierres sesión ni cambies de usuario ni de local.
- Todo lo que hagas se guarda de verdad en QA. Haz SOLO lo que dice el guion. No toques cierres de caja, empleados, productos, precios ni nada más.
- No uses tarjeta en ningún cobro. No pulses nada que diga «Cerrar caja», «Iniciar cierre» ni «Finalizar cierre».
- Si aparece un cartel rojo de error que el guion no prevé, o un botón del guion no existe, PARA en ese paso, no improvises, y dime exactamente qué ves (texto literal).
- Si un texto es un poco distinto de lo previsto pero el comportamiento es el mismo, anótalo («texto distinto: …») y sigue.
- Usa «motivo» = prueba D13 en cualquier campo de motivo. Los importes pueden salir con coma o con punto (1,00 o 1.00): es lo mismo.
- Antes de cada paso importante, apunta la hora (hh:mm:ss) en que lo haces.

PASO 0 · Comprobar que es la versión nueva (solo mirar, no cambies nada)
0.1 Menú lateral, grupo Sistema → «Configuración» → pestaña «Permisos».
0.2 Busca la fila «Solicitar devoluciones (el Cajero/a necesita aprobación)» y la fila «Aprobar y confirmar devoluciones». Si NO existe la primera con ese texto exacto, es la versión antigua:
    PARA y dime que abra otra ventana privada o espere unos minutos.
0.3 En la fila «Solicitar devoluciones (el Cajero/a necesita aprobación)», columna del Cajero/a: el cuadradito debe estar SIN marcar y SIN candado 🔒 (se puede marcar). No lo marques todavía.
    En la fila «Aprobar y confirmar devoluciones», columna del Cajero/a: SIN marcar y CON candado 🔒. Anótalo.

PASO 1 · Un cobro de prueba en efectivo (para tener un pago que devolver)
1.1 Menú lateral → «TPV». Añade al carrito productos hasta que el total sea de 3 € o un poco más (cualquier producto vale; apunta el TOTAL exacto, lo llamaremos T. Si no llegas a 3 €, añade más unidades).
1.2 Pulsa el botón «Guardar pedido €T». Debe salir una ventana «Pedido guardado». Pulsa «Enviar pedido». Debe pasar a «Pedido enviado». Pulsa «Aceptar».
1.3 En la pantalla del TPV debe aparecer un panel de cobro con «Importe de este pago (€)» (por defecto el total T) y «Efectivo recibido (€)». Deja los dos campos como están y pulsa «Cobrar efectivo».
    Debe salir «Efectivo confirmado y cuenta pagada.»
    Si no encuentras el panel de cobro o sale un error, PARA y dime qué ves.

PASO 2 · Solicitar una devolución como Propietario (se aprueba en el acto)
2.1 Menú lateral → «Devoluciones» → botón/pestaña «Reembolso económico».
2.2 Arriba, antes del formulario, NO debe haber ningún aviso que diga «no tiene permiso para solicitar» ni «quedará pendiente de aprobación». Anota si hay alguno.
2.3 En «Pago original» elige el cobro del paso 1 (una línea tipo «fecha hora · EFECTIVO · €T · disponible €T»). Importe a reembolsar: 1. Motivo obligatorio: prueba D13. Pulsa «Solicitar reembolso».
2.4 Debe salir el mensaje «Solicitud creada como PENDIENTE. El simulador no envía dinero a un proveedor real.» (NO debe decir «pendiente de aprobación»).
2.5 En la lista debe aparecer una fila de «€1,00 · EFECTIVO» con la etiqueta «Pendiente» (NO «Pendiente de aprobación»), con una línea «Aprobada el AAAA-MM-DD hh:mm» y con los botones
    «Confirmar efectivo» y «Cancelar solicitud». NO debe haber un botón «Aprobar» ni «Rechazar solicitud». Anota qué botones ves exactamente.

PASO 3 · Cancelar esa solicitud
3.1 En esa fila pulsa «Cancelar solicitud». Aparece «Motivo de cancelación»: escribe prueba D13 y pulsa «Confirmar cancelación».
3.2 Debe salir «Solicitud cancelada y saldo liberado.» (NO «rechazada»). La fila queda con la etiqueta «Cancelado» y el «disponible» del pago vuelve a €T.

PASO 4 · Solicitar y confirmar el efectivo
4.1 Otra vez: Pago original = el mismo cobro, importe 1, motivo prueba D13, «Solicitar reembolso». Debe salir el mismo mensaje de 2.4 y una fila nueva con «Aprobada el …».
4.2 En la fila nueva (la que está «Pendiente») pulsa «Confirmar efectivo».
4.3 Debe salir «Reembolso en efectivo confirmado. Se ha creado un único movimiento negativo de caja.» y la fila pasar a «Confirmado». El disponible del pago baja a T−1.

PASO 5 · Devolver el resto (deja la caja a cero)
5.1 Solicita el resto: Pago original = el mismo cobro, importe = T−1 (el «disponible» que ves), motivo prueba D13, «Solicitar reembolso», y luego «Confirmar efectivo» en esa fila.
5.2 Debe salir otra vez «Reembolso en efectivo confirmado…». El cobro ya no debe salir en la lista de «Pago original» (no queda nada disponible). Anota si no desaparece.

PASO 6 · El permiso del Cajero/a (parte final; hazla solo si los pasos 1 a 5 salieron bien)
6.1 Sistema → «Configuración» → «Permisos». En «Dónde se aplican los cambios» deja «Solo este local (…)». En el campo de motivo escribe prueba D13.
6.2 Marca el cuadradito de la fila «Solicitar devoluciones (el Cajero/a necesita aprobación)», columna Cajero/a (en el código su nombre accesible es «ABC_REEMBOLSO_SOLICITAR Cajero/a»).
    Debe poder marcarse (sin candado) y el botón de abajo debe decir «Guardar 1 cambio». Púlsalo. Debe salir «1 cambio guardado en el servidor.» y la celda quedar marcada con «decidido aquí».
6.3 Comprueba que «Aprobar y confirmar devoluciones» del Cajero/a SIGUE con candado 🔒 y sin poder marcarse.
6.4 DEJA LA PANTALLA COMO ESTABA: en esa celda del Cajero/a pulsa «volver a lo normal» (motivo prueba D13) y guarda («Guardar 1 cambio»). Debe salir «1 cambio guardado en el servidor.» y la celda quedar sin marcar y sin «decidido aquí».
    Es obligatorio dejarlo así antes de terminar.

INFORME FINAL (formato)
Una tabla con una fila por paso (0.3, 1.3, 2.2, 2.4, 2.5, 3.2, 4.3, 5.2, 6.2, 6.3, 6.4): resultado (OK / TEXTO DISTINTO / NO COINCIDE / PARO), el texto literal que viste cuando no coincide, y la hora.
Añade: el total T del cobro, el importe exacto de cada devolución, los botones que viste en la fila del paso 2.5, y cualquier cosa rara (parpadeos, botones que no responden, avisos inesperados).
No me des conclusiones sobre el servidor: solo lo que se ve en pantalla.
```

---

## Qué comprobaré yo en QA después (solo lectura)

- Un cobro en efectivo de T € en `pagos` y un solo reembolso cancelado de 1 €, uno confirmado de 1 € y otro confirmado de T − 1 €, con `aprobado_por` = Pedro y `aprobado_at` = la hora de la solicitud.
- Eventos `REEMBOLSO_SOLICITADO` (sin aprobación pendiente), `REEMBOLSO_APROBADO` (automática) y `REEMBOLSO_CONFIRMADO` o equivalente; **ningún** `PROVIDER_REEMBOLSO` en la cola (el pago era en efectivo).
- Dos movimientos negativos de caja (uno por cada reembolso confirmado), que cuadran con el cobro, y que el efectivo esperado de la sesión A1 vuelve a su valor anterior.
- Que el permiso del Cajero/a se activó y se **desactivó** (evento de configuración doble) y que queda sin decisión local para `ABC_REEMBOLSO_SOLICITAR` en A1.
- Que no ha quedado nada pendiente que bloquee el próximo cierre de caja.

## Qué no cubre

Aprobar o rechazar lo que solicita un Cajero/a (necesita otro usuario), devoluciones con tarjeta y un proveedor real: lo cubren las pruebas automáticas.
