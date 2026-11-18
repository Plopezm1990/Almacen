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
