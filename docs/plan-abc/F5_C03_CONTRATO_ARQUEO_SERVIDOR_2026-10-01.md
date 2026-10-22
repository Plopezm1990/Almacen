# F5 C03 Contrato de arqueo calculado en servidor

Fecha: 2026-10-01
Estado: `IMPLEMENTADO_EN_QA; UI_LOCAL_PREPARADA; DEPLOY_QA_PENDIENTE`
Base: Plan ABC C03, PM08/PM09 y cierre de sesión C04

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

La interfaz ya no envía `efectivo_base` al registrar un arqueo sincronizado.
Envía el efectivo contado, el desglose opcional por denominaciones y el
contexto de sesión. `abc_registrar_arqueo_caja` obtiene la base y el esperado
del libro de caja. `abc_previsualizar_arqueo_caja` muestra el mismo desglose en
el cierre por sesión y C04 vuelve a calcularlo al confirmar.

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

Las migraciones de vista previa y registro autoritativo están aplicadas en QA.
La prueba transaccional de 100 € de fondo, 50 € de entrada y 30 € de salida
obtuvo 120 € esperados, admitió un conteo por denominaciones de 120 € y una
diferencia de 0 €. También verificó replay, permisos, unicidad y anulación con
motivo. La transacción terminó con `ROLLBACK` y no dejó datos de prueba.

La interfaz está preparada localmente. Falta desplegarla en QA y recorrer el
arqueo histórico por pantalla antes de considerar C03 aceptado por completo.
Producción no se ha modificado.
