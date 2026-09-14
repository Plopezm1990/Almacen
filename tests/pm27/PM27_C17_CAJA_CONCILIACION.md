# PM27 — C17 Caja y conciliación

Fecha: 2026-09-14
Base de entrada: `270f392ab815fdb5fe6643fea34cc1580647cd65` (C16 cerrado)
Rama: `claude/pm27-c17-caja-conciliacion`

## Contrato del caso

C17 revisa cinco ejes: arqueos, cierres, operaciones duplicadas/replay, permisos y consistencia económica de caja.

No se autoriza en C17 ninguna escritura remota. La inspección de Supabase QA y producción se limita a lectura de catálogo/estado. No se modifica `main`, `release`, PR #38 ni Netlify.

## Evidencia versionada reutilizada

La implementación existente ya dispone de contratos reproducibles de PM08/PM09 que cubren el núcleo de C17:

- `tests/pm08/frontend-contract.mjs`;
- `tests/pm08/migration-contract.mjs`;
- `tests/pm08/replay-scope-contract.mjs`;
- `tests/pm09/p10-caja-contract.mjs`;
- `tests/pm09/p16-isolation-context-contract.mjs`;
- `tests/pm09/p17-robustness-contract.mjs`.

C17 no crea una segunda lógica de caja. `tests/pm27/c17-caja-conciliacion.mjs` enlaza esos contratos y añade comprobaciones explícitas de los cinco criterios del caso.

## Arqueos

El contrato exige un solo arqueo activo por empresa/local/fecha. En modo PM09 la cifra base de ventas en efectivo se deriva en servidor y el esperado incorpora reversos y efectos de `caja_operaciones`; el cliente no puede imponer silenciosamente la conciliación.

La evidencia histórica PM09 de QA ya reprodujo con ROLLBACK una conciliación compuesta: ventas en efectivo/tarjeta/transferencia/mixto, reverso, reembolso, entrada y retirada. El servidor produjo efectivo base 17, reversos de efectivo -12, efectos de caja -3, esperado 2, contado 2 y diferencia 0, con limpieza final.

## Cierres

Un arqueo ACTIVO cierra el periodo diario del local para movimientos manuales de caja y reembolsos en efectivo. La corrección no borra el arqueo: genera una anulación trazable y cambia el original a `ANULADO`.

## Duplicados y replay

`operation_id` se valida y serializa. Un replay con el mismo payload devuelve el resultado previo; reutilizar el mismo identificador con otro payload produce `operation_id_conflict`. El endurecimiento global comprueba colisiones entre stock, caja, arqueos y anulaciones.

## Permisos y aislamiento

Operar caja exige usuario activo y rol `Propietario`, `Encargado` o `Cajero/a`. Corregir/revertir exige `Propietario` o `Encargado`. Las mutaciones validan empresa/local mediante los helpers de membresía y las lecturas de las tablas de caja están protegidas por RLS de local.

La lectura de catálogo realizada en QA confirmó que existen `caja_operaciones`, `arqueos_caja` y `arqueos_caja_anulaciones`, con RLS activada, y las cuatro RPC principales de caja están presentes como SECURITY DEFINER. En el momento de la inspección QA contenía 8 filas en `caja_operaciones` y 0 arqueos/0 anulaciones; C17 no modificó ninguna de ellas.

## Consistencia

La conciliación PM09 filtra por empresa y local, usa `fechaOperacion` cuando está presente con fallback histórico explícito, separa `VENTA` y `REVERSO`, descompone pagos mixtos y evita duplicar `DEVOLUCION_CLIENTE` porque sus reembolsos ya viven en `caja_operaciones`.

## Producción

La consulta de catálogo de producción no encontró las tablas/RPC modernas de caja PM08/PM09 inspeccionadas en QA. C17 certifica el candidato versionado y el contrato reproducible; no afirma que estas migraciones estén desplegadas en producción y no realiza ninguna escritura allí.

## Cierre

El primer gate exact-SHA de C17 fue el run `34814066666`, sobre `73d70a282e9a8f2c2f74eb1c40e1458b5f16bdf8`, y terminó en `SUCCESS`. Pasaron la verificación de referencias protegidas, el alcance desde C16, sintaxis, el contrato C17, todas las regresiones PM08/PM09 enlazadas, evidencia y árbol limpio.

Este documento de cierre también queda sometido al mismo workflow: C17 solo queda definitivamente cerrado cuando el SHA que contiene este texto obtiene `SUCCESS`.

`PM27_C17_ARQUEOS=PASS`

`PM27_C17_CIERRES=PASS`

`PM27_C17_DUPLICADOS=PASS`

`PM27_C17_PERMISOS=PASS`

`PM27_C17_CONSISTENCIA=PASS`

`PM27_C17_ESCRITURAS_QA=0`

`PM27_C17_ESCRITURAS_PRODUCCION=0`

`PM27_C17_RESULTADO=PASS`
