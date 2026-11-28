# Corrección de la copia local · H-19, H-40, H-46, H-31 · 26/11/2026

Estado: **implementada y probada con contratos**, sin tocar el servidor. Rama
`correccion/ola0-tpv-2026-11-26`, sin enviar al remoto. **No se ha verificado en el navegador de QA**
(ver «Qué falta»).

## Lo que ya existía

El candado D01 (`owner-bootstrap-prelock.js`, `__laOwnerBootstrapSepararCopiaLocal`) aparta la copia
local de la cuenta anterior al entrar otra y se la devuelve intacta al volver. Cubría solo `almacen:*`,
`almacen__*` y el contexto seguro. Sus pruebas: `tests/plataforma/p08-copia-local-por-cuenta-runtime.mjs`.

## Qué se reprodujo y qué se cambió

| Hallazgo | Causa demostrada (prueba en rojo antes de corregir) | Corrección |
|---|---|---|
| **H-40** borrador del carrito de otro usuario | El borrador (`la_suite_abc_tpv_borrador_v1:`) y los pendientes del TPV (`la_suite_f4_b02_b03_pago_v1:`, `la_suite_a02_1_pendiente_v1:`, `la_suite_a02_1_ultima_cuenta_v1:`) llevan empresa y local pero no usuario y **no estaban en la lista de claves de la cuenta**: B los heredaba. | Entran en `esClaveDeCopiaLocal` (se apartan por cuenta y se devuelven intactos) y en el borrado de una generación nueva (`edge-auth-patch.js`). La identidad del terminal (`la_suite_abc_terminal_id_v1`) **no** entra: es del equipo. |
| **H-46** arranque bloqueado | El candado compara lo apartado con lo vivo y se niega si el programa escribió una clave a mitad («La copia local cambió mientras se archivaba»); exigía pulsar «Reintentar comprobación». | Reintento automático, 4 intentos; si la copia no deja de cambiar falla cerrado como antes. La escritura de última hora no se pierde. |
| **H-31** pendiente de cobro antiguo | `leerEstadoCobroF4` comprobaba el pendiente contra la lectura directa de `pagos` (10 últimos checkouts, sujeta a permisos) **antes** de sustituirla por la lista completa de `abc_estado_pago_mixto_cuenta`. Un pago ya resuelto fuera de esa lectura dejaba el pendiente para siempre y bloqueaba cobrar con otro medio. | Se comprueba contra la lista completa del servidor; solo se retira si el pago está CONFIRMADO, RECHAZADO, CANCELADO o REEMBOLSADO. `fuente.js` y `source-recovery` en paridad. |
| **H-19** pendientes locales que se suben | El historial de respaldos es «local al dispositivo» (IndexedDB), pero si IndexedDB fallaba, el «fallback a localStorage» seguía por el camino general y **lo subía a la empresa con sesión** y lo dejaba en la cola. Coincide con las dos reescrituras de `historialRespaldos` del incidente. | `historialRespaldos` pasa a clave solo del dispositivo: no se sube, no entra en la cola, no se lee del servidor, y una cola antigua que lo tuviera se limpia sin subirlo. |

Pruebas: `tests/p1-denied-keys-solo-local.mjs` (caso 10), `tests/plataforma/p08-…` (secciones 9 y 10,
41/41) y el contrato nuevo `tests/rediseno/h31-pendiente-cobro-contra-servidor-contract.mjs`. Batería sin
base de datos: 337 contratos activos, 0 fallos; manifiesto 395 entradas.

## Qué NO queda demostrado

- **H-19 es una causa probable, no la prueba del incidente.** Reproduje que el historial se sube cuando
  IndexedDB falla, pero no puedo afirmar que IndexedDB fallara en el navegador de la auditoría. De los
  `productos` (37 artículos) que también se subieron no he encontrado un camino adicional: con el candado D01
  un cambio de cuenta ya los aparta, así que el caso que queda es la **misma cuenta** que trabaja en modo
  local y vuelve a entrar (esa copia es suya y se sincroniza). Si se quiere impedirlo, hay que decidir qué
  hacer con los datos del «modo local»: descartarlos al entrar con sesión o pedir confirmación.
- Un pendiente antiguo **sin etiqueta de empresa** (anterior a la cola con contexto) se sigue tratando como
  de la empresa con sesión (se conserva reintentable para no perder una escritura histórica).
- Nada de esto se ha probado todavía en el navegador de la vista previa de QA.
