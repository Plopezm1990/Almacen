# Corrección H-27 y H-23 · tarjeta simulada y documento de la venta mixta · 27/11/2026

Estado: **implementadas, probadas con pruebas de ejecución y de código, y verificadas en el navegador de QA el 27/11/2026.**
Rama `correccion/ola0-tpv-2026-11-26`. Dependían de H-06 (funciones de QA versionadas), ya hecha.

## H-27 · aprobar o rechazar la tarjeta simulada desde la pantalla

**Antes:** «Iniciar tarjeta simulada» dejaba el pago y el intento PENDIENTE y la pantalla no ofrecía ningún modo de
resolverlos; solo se pudo llamando a `abc_qa_confirmar_pago_simulado` desde la consola del navegador.

**Ahora**, solo en la vista previa de QA y para el Propietario, con un intento de tarjeta o Bizum pendiente aparece el
bloque «Tarjeta simulada pendiente (solo QA)» con **Aprobar tarjeta simulada** y **Rechazar tarjeta simulada**. Tras
resolver, la pantalla vuelve a leer el estado del cobro; si se aprobó, indica «Cierra la cuenta pagada para emitir el
documento».

- Aprobar usa `abc_qa_confirmar_pago_simulado` (ya existía). **Rechazar usa una función nueva,
  `abc_qa_rechazar_pago_simulado`**, que no existía: se creó en QA solo con SQL (sin migración), con las mismas barreras
  (solo `QA-EMP-A` / `QA-A1` y Propietario por `private.abc_qa_c04_propietario`), `authenticated` sí y `anon` no, y se
  versionó en `supabase/qa-only/` (el `md5` coincide con QA).
- El cliente solo las llama desde `resolverTarjetaSimuladaQa`, que empieza por la barrera del interruptor de QA. El
  contrato de H-06 lo vigila y el de «lo que el cliente llama existe en migraciones» las lista como huecos conocidos con su motivo.

**No incluido:** el **reembolso con tarjeta** simulado (el efecto `PROVIDER_REEMBOLSO` que bloqueaba el cierre). No hay función
de servidor que lo resuelva y requiere más trabajo de servidor; queda pendiente.

## H-23 · cerrar una cuenta ya pagada no emitía el documento fiscal

**Causa (leída en el código, no era un artefacto de haber resuelto la tarjeta por la consola):** en `iniciarCobroCuentaF4`,
la rama «el saldo ya está pagado» (la que usa «Cerrar cuenta pagada», por ejemplo en una venta mixta cuya última parte se
resuelve después) cerraba la cuenta pero **no llamaba a la emisión**. Solo el camino de cobro normal emitía. Pasaría igual con
un proveedor de tarjeta real.

**Corrección:** tras cerrar bien la cuenta en esa rama se emite el documento (`emitirCheckoutFiscalC07D` con el checkout
completado) y se prepara el QR de QA. La emisión es idempotente por cuenta y checkout, así que repetirla no duplica. Una
cuenta ya CERRADA se devuelve sin tocar nada.

## Pruebas

`tests/cfg/h38b-h24-ui-runtime.mjs`: 67 comprobaciones de ejecución en total. Las de H-27 (12) evalúan la lógica real, el filtro
real de intentos pendientes y la presencia del bloque; las de H-23 (4) son **estáticas sobre el código** (orden cierre →
emisión, solo si el cierre salió bien, resultado con el documento y el QR, y que la cuenta ya cerrada no se toca): una venta
mixta de punta a punta pediría un servidor falso mucho más grande. Todas fallan con el código anterior.
Batería sin base de datos: 341 contratos activos, 0 fallos; manifiesto 401 entradas.

## Verificación en el navegador (actualizado el 27/11/2026)

H-27 y H-23 **se verificaron en la vista previa de QA** como Propietario (PM07): rechazar y aprobar la tarjeta simulada desde la
pantalla, y «Cerrar cuenta pagada» emite el documento en un solo clic (FACTURA TPV n.º 53). Detalle, y el hallazgo nuevo H-48 que
apareció al repetir una tarjeta rechazada, en `VERIFICACION_NAVEGADOR_OLA1_Y_H-48_2026-11-27.md`.

## Qué NO está verificado

- El **reembolso con tarjeta** simulado (sin función de servidor).
- La venta mixta de la auditoría (venta 2, sin documento) sigue sin él: no se ha tocado esa venta.
