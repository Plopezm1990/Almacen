# F5 C03 Contrato de arqueo calculado en servidor

Fecha: 2026-10-01  
Estado: `CONTRATO_C03_PREPARADO_NO_APLICADO`  
Base: Plan ABC C03, PM08/PM09 y `origin/release` `7859508`

Este contrato cierra el comportamiento de C03 para que el arqueo explique la
diferencia entre efectivo contado y efectivo esperado sin confiar en una cifra
calculada por el navegador. El arqueo es una operación de caja; no modifica
ventas, pagos ni stock para cuadrar artificialmente el resultado.

## Cálculo autoritativo

El servidor valida empresa, local, fecha, actor y permisos. A partir de la
sesión y de las operaciones de caja confirmadas calcula:

`efectivo_esperado = efectivo_base + entradas_efectivo - salidas_efectivo`

Después registra `efectivo_contado` y deriva:

`diferencia = efectivo_contado - efectivo_esperado`

La cifra enviada por el cliente puede conservarse como dato declarado o
referencia de la petición, pero no sustituye el cálculo autoritativo. Un
reembolso o movimiento ya registrado no se vuelve a sumar en un replay.

## Identidad y estados

| Elemento | Regla |
|---|---|
| Operación | `operation_id` estable; replay devuelve el arqueo original |
| Alcance | empresa, local y fecha explícitos; no se permite “todos los locales” |
| Arqueo activo | como máximo uno por empresa, local y fecha |
| Diferencia | siempre coincide con contado menos esperado |
| Corrección | anulación vinculada con motivo y actor; no se borra el original |

Un segundo arqueo activo del mismo día y local debe fallar. Un usuario sin
permiso, una sesión ajena o un `operation_id` reutilizado con otro contenido
deben fallar cerrado.

## Casos de aceptación C03

1. Caja exacta: apertura 100,00 €, entradas 50,00 €, salidas 30,00 € y
   contado 120,00 € producen esperado 120,00 € y diferencia 0,00 €.
2. Faltante o sobrante: la diferencia conserva signo y motivo sin alterar
   ventas ni movimientos confirmados.
3. Manipulación: cambiar `efectivo_esperado` en la petición no cambia el
   resultado autoritativo.
4. Replay: repetir el mismo `operation_id` devuelve el mismo arqueo y no crea
   otro movimiento ni otro saldo.
5. Concurrencia: dos aperturas activas para la misma empresa, local y fecha no
   pueden confirmarse simultáneamente.
6. Anulación: requiere permiso, motivo y operación vinculada; la historia
   original permanece consultable.

## Fuera de alcance

C03 no decide la numeración fiscal, el emisor, el resultado de un proveedor de
pagos ni la validez fiscal de un documento. Los pagos inciertos deben quedar
pendientes según B04/B12 y pueden impedir el cierre C04; no se resuelven
alterando el arqueo.

## Resultado de C03

El contrato de arqueo calculado en servidor queda preparado para la aceptación
F5. No aplica migraciones, no escribe QA/PROD, no hace merge y no ejecuta
deploy de Netlify.
