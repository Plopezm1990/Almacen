# P1 · Propina del cambio en efectivo · integración Órbita

Fecha: 18 de noviembre de 2026  
Rama: `rediseno/f0-base-qa` · PR #225 en borrador · solo QA

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
