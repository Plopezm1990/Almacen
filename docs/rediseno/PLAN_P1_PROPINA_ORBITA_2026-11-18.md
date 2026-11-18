# P1 · Propina del cambio en efectivo · integración Órbita

Fecha: 18 de noviembre de 2026  
Rama: `rediseno/f0-base-qa` · PR #225 en borrador · solo QA

Implementación publicada en `2f9679f8` (`feat(qa): integrar propina del
cambio en orbita`).

## Objetivo

Reincorporar en el TPV la opción **«El cambio es propina»** manteniendo el
contrato económico existente: `abc_iniciar_cobro` y `abc_confirmar_efectivo`
siguen confirmando el pago y guardando el cambio real. La propina se registra
después, como movimiento separado, mediante `abc_registrar_propina_efectivo`.

La implementación no decide tratamiento fiscal, documental ni contable. Solo
registra el movimiento interno de caja y deja la operación lista para que la
asesoría defina ese tratamiento en una fase posterior.

## Cambios implementados

- `fuente.js` y `source-recovery/fuente-recuperado.js` mantienen paridad exacta.
- El cobro en efectivo crea un `propinaOperationId` idempotente por intento.
- Tras confirmar el efectivo, si el usuario marca la casilla y el cambio es
  positivo, se llama a `abc_registrar_propina_efectivo` con el mismo importe
  de cambio y el contexto real de empresa, local, caja, sesión, terminal y
  día operativo.
- Un fallo de la segunda operación no deshace el cobro confirmado ni oculta
  el estado de la cuenta: el mensaje informa de que el cambio sigue pendiente
  de devolver. El cierre de cuenta y la fiscalización siguen su curso normal.
- La casilla solo aparece con cambio positivo y se limpia tras un cobro en
  efectivo correcto.
- Se añadieron mensajes para falta de permiso, pago no confirmado, importe
  inválido, pago no efectivo, cambio inexistente, duplicado y otros errores
  del contrato.
- Se añadió la migración reproducible
  `supabase/migrations/20261024070000_t6_propina_efectivo.sql`. No se ejecutó
  ninguna migración ni RPC de escritura en QA durante esta tanda.

## Contrato de servidor observado en QA

La sonda de solo lectura confirmó la firma
`abc_registrar_propina_efectivo(text,text,text,uuid,uuid,uuid,uuid,date,numeric)`
como `SECURITY DEFINER`, con `search_path` fijado y `EXECUTE` para
`authenticated`. La RPC exige capacidad `ABC_COBRO_INICIAR`, pago en efectivo
ya confirmado, cambio positivo coincidente, sesión de caja abierta y terminal
vinculado. El servidor bloquea duplicados por pago y usa el `operation_id` para
repetición segura.

## Verificación automática

- `tests/rediseno/p06-propina-cambio-contract.mjs`: PASS.
- P01, P05, paridad de `source-recovery`, sintaxis y `git diff --check` deben
  seguir en verde antes de publicar.
- El manifiesto CI incorpora P06 como contrato Node activo.

## Validación manual pendiente

Esta tanda no ejecuta cobros ni propinas. Para cerrar la prueba funcional en
QA hace falta una cuenta autorizada, una cuenta o fixture reversible con
cambio positivo y autorización explícita para realizar **un único cobro
simulado**. Debe comprobarse: propina registrada en caja, mensaje honesto,
idempotencia al reintentar y rechazo de un cargo sin `ABC_COBRO_INICIAR`.

La conciliación contable/fiscal de la propina permanece opcional y separada.

## Comprobación manual de los previews · 18/11/2026

El propietario confirmó la apertura de los dos enlaces de QA y se revisaron
sin ejecutar operaciones económicas:

- `https://deploy-preview-225--chic-entremet-9107cf.netlify.app/`: sesión de
  propietario en `QA-EMP-A / Local A1`, propuesta Órbita, Pase con datos reales,
  acceso al TPV y terminal `QA terminal A1`.
- `https://6afd8c3882695f87aa8c261a--chic-entremet-9107cf.netlify.app/`:
  propuesta Órbita y Pase cargados. Este origen muestra correctamente que el
  dispositivo todavía no tiene un terminal inequívocamente asignado; no es un
  error de datos del local.
- En el TPV se observó una cuenta pendiente de `1,32 €` con pago exacto y sin
  cambio positivo. Por ello la casilla **«El cambio es propina»** no aparece,
  que es el comportamiento previsto. Esta comprobación es visual; no cierra
  la prueba server-side de propina.

La prueba funcional de propina sigue requiriendo un fixture reversible con
cambio positivo y autorización explícita para un único cobro simulado. No se
crearon movimientos, no se cobraron cuentas y no se modificó producción.

## Intento funcional autorizado · resultado no confirmado · 18/11/2026

Con autorización explícita del propietario se preparó una única operación en
QA-A1: total `1,32 €`, efectivo `5,00 €`, cambio positivo `3,68 €` y la casilla
**«El cambio es propina»** activada. Se pulsó una sola vez **«Cobrar efectivo»**.

El botón pasó brevemente a «Procesando…», pero la pantalla volvió a los
valores iniciales sin mostrar ticket, confirmación, error ni movimiento de
propina. Una actualización posterior consultó de nuevo el servidor y devolvió
la cuenta en `0,00 € confirmado / 1,32 € pendiente`; la propina tampoco aparece
como registrada. Por seguridad no se repitió el clic: no hay prueba de que el
servidor haya aceptado la operación y repetir podría duplicarla.

Estado: **P06 no cerrado funcionalmente**. Queda una incidencia de diagnóstico
sobre el camino de cobro en el preview (respuesta o error no expuesto por la
UI). La evidencia visual queda en la sesión del preview; no se modificó
producción ni se ejecutó un segundo intento.

## Causa localizada y corrección preparada · 18/11/2026

La respuesta fallida sí llegaba a `ejecutarCobroF4()`, pero el flujo hacía
`setErrorCobroF4(resultado.error)` y, acto seguido, llamaba a
`refrescarCobroF4()`. Cuando la lectura posterior del estado funcionaba,
`refrescarCobroF4()` limpiaba el mensaje con `setErrorCobroF4("")`. El resultado
visible era exactamente el observado: el formulario volvía a sus valores
iniciales y no quedaba explicación.

La corrección conserva el motivo en una variable local, actualiza el estado de
la cuenta y vuelve a pintar el error después de la recarga. Se aplica también a
la recuperación de un cobro pendiente. `fuente.js` y
`source-recovery/fuente-recuperado.js` mantienen paridad exacta, y P06 ahora
comprueba el orden que evita borrar el error.

## Incidencia de día operativo · corrección preparada · 18/11/2026

La cuenta que permanecía seleccionada en el preview pertenecía a un día
operativo anterior. `abc_recuperar_cuenta` la devuelve con
`requires_operating_day_resolution`/`reanudable=false`; no es un fallo de la
propina ni una autorización para cerrar o cobrar esa cuenta. El cliente, sin
embargo, conservaba el contexto de cuenta en `localStorage`, por lo que dejaba
visible el panel F4 y sus botones de cobro. El aviso solo aparecía al abrir
«Mostrar operaciones de cuenta».

La corrección es local y no toca QA: al recibir ese rechazo, elimina únicamente
el puntero de contexto del navegador y retira `pedidoOperativoA05` de la
pantalla. La cuenta, sus pedidos y la evidencia permanecen en el servidor y
siguen apareciendo en «Cuentas abiertas y aparcadas» como **Día cerrado**. Así
el TPV no vuelve a ofrecer cobro sobre una cuenta que el servidor ha bloqueado y
el operador puede seleccionar una cuenta del día actual. La paridad con
`source-recovery` se mantiene y P06 incluye aserciones para este comportamiento.

Estado de publicación: commit `2c281607` desplegado en el Deploy Preview
`6afd9ed0c74b1938b74eb0d3` (`ready`). En la comprobación live, al abrir la
cuenta desde Pase el TPV mostró el aviso en la zona de contexto, retiró la
cuenta obsoleta y ya no renderizó «Cobro · F4» ni botones de cobro. No se
ejecutó ningún cobro adicional.

## Cobro único de propina autorizado · 18/11/2026

Con autorización explícita del propietario se preparó una cuenta del día
actual en QA-A1 y se ejecutó **una sola vez** el cobro simulado en efectivo.
La cuenta es `b23f583e-01b4-4329-8502-95c14734bb47` y el pedido es
`318d1423-d673-4640-bcb3-c5f8038bb387`. Total: `4,95 €`; efectivo recibido:
`5,00 €`; cambio positivo: `0,05 €`; casilla «El cambio es propina» activada.

El servidor confirmó el cobro y la propina: `4,95 €` confirmados, `0,00 €`
pendientes y mensaje visible «Propina de €0.05 registrada; no se devuelve
cambio». Se emitió el ticket QA `TPV-38`, secuencia `34`, con QR fiscal
simulado C07-D. No se repitió el clic ni se ejecutaron otros cobros.

La cuenta quedó pagada pero abierta porque su pedido aún no estaba servido o
cerrado. El cierre formal es una operación separada y no se ejecuta sin una
autorización específica. P06 queda validado para el camino de confirmación y
registro de propina; la conciliación contable/fiscal sigue siendo opcional.

## Intento de cierre formal autorizado · 18/11/2026

Con autorización explícita se pulsó **una sola vez** «Cerrar cuenta pagada»
para la cuenta anterior. La pantalla no mostró una confirmación de cierre:
conservó el estado «Cuenta comercial: Abierta» y, tras recargar el preview,
el panel Pase siguió mostrando la cuenta abierta. No se repitió la acción.

Resultado: el cobro y la propina sí están confirmados, pero el cierre formal
no queda probado. El pedido asociado todavía necesita quedar servido/cerrado o
el servidor debe exponer el motivo concreto del rechazo antes de volver a
intentarlo. No se modificó ninguna otra cuenta ni producción.
