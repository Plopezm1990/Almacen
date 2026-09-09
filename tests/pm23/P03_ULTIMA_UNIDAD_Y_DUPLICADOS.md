# PM23 P03 — Última unidad, y "varias pestañas"/"recarga durante guardado"

Tercer punto de PM23. Cierra los tres escenarios del texto literal de PM-23
que quedaron explícitamente pendientes en P02 §5.

## 0. "Recarga durante guardado" y "varias pestañas": mismo caso observable

Desde el backend, ambos escenarios del Plan Maestro son indistinguibles: dos
peticiones con el **mismo `operationId`** llegando casi al mismo tiempo, sin
que ninguna de las dos haya visto todavía el resultado de la otra — ya sea
porque el usuario tiene dos pestañas abiertas, o porque recargó la página y
su cliente reenvía la operación pendiente sin saber si ya se guardó. Se
prueban como un único caso real: dos llamadas HTTP simultáneas (mismo id,
lanzadas con `Promise.all`, no una tras otra) al mismo RPC.

## 1. Última unidad

Fixture: `QA-PM23-ULTIMA-UNIDAD`, stock exacto de 1 unidad. Tres llamadas
concurrentes a `registrar_venta_stock_pm09` (1 unidad cada una, identificador
de operación distinto en cada una — no es un duplicado, son tres clientes
reales compitiendo por la misma unidad).

**Resultado real**: exactamente 1 éxito, 2 rechazos limpios
(`stock_insuficiente`, sin excepción no controlada ni error 500). Stock final
verificado por consulta directa: `0` (ni negativo, ni fraccionario, ni
residual). Exactamente 1 fila de tipo `VENTA` en `stock_operaciones` para ese
producto — ninguna venta fantasma de las dos rechazadas.

## 2. Duplicado simultáneo — pago

Dos llamadas simultáneas a `registrar_pago_factura` con el mismo `id`/
`operationId`, contra la factura fixture. Resultado real: la primera en
resolver el bloqueo devolvió `{ok:true, replayed:false}`; la segunda,
`{ok:true, replayed:true}` — ninguna de las dos vio un error. Verificado por
consulta directa: exactamente 1 fila en `pagos_factura` con ese `operationId`.

## 3. Duplicado simultáneo — "recepción" (sustituto `pm12_confirmar_ajuste_stock`)

Mismo patrón sobre el fixture `QA-PM23-DUP-AJUSTE`: una respuesta
`replayed:false`, la otra `replayed:true`, exactamente 1 fila final en
`stock_operaciones` para ese `operationId`.

## 4. Duplicado simultáneo — devolución

Mismo patrón sobre una venta real previa del fixture `QA-PM23-DUP-VENTA`:
una respuesta `replayed:false`, la otra `replayed:true`, exactamente 1 fila
final en `devoluciones_venta` con ese `operationId`.

## 5. Lectura

Los tres mecanismos de bloqueo por `operationId` ya existentes en el backend
(`pm08_bloquear_operation_id`, `pm09_bloquear_operation_id_stock`, y el
usado internamente por `pm12_confirmar_ajuste_stock`) sirven exactamente
para este caso: serializan las dos peticiones simultáneas en vez de dejarlas
correr en paralelo sobre la misma fila, así que la segunda siempre ve el
resultado ya persistido de la primera y responde con una réplica idéntica,
nunca con una segunda escritura. Esto ya se había verificado con el patrón
de "abortar y reintentar" en P01 §5 (secuencial); aquí se confirma que
también se sostiene cuando las dos peticiones son genuinamente simultáneas,
no una detrás de otra.

## 6. Archivos

- `tests/pm23/P03_ULTIMA_UNIDAD_Y_DUPLICADOS.md` (este documento).
- `tests/pm23/p03-resultado.json`: la salida real de la ejecución.
- `tests/pm23/p03-contract.mjs` (nuevo): confirma que el documento y el
  resultado registran los cuatro casos con su resultado real correcto, y que
  no publican identificadores internos ni secretos.

## Regresión

Sin cambios en `fuente.js` ni en ninguna migración de esquema. Suite
completa del proyecto — sin regresiones.

## Estado de main/producción/QA

`main` sin tocar. Todas las llamadas mutantes con `anon key` + sesión real
(nunca `service_role`), sobre fixtures QA aisladas y prefijadas
(`QA-PM23-*`). Producción y TPV sin tocar.

## Cierre de PM23

Con P01 (línea base), P02 (presupuesto acordado, veredicto APROBADO sin
hallazgos, sustituto de recepción aceptado) y P03 (última unidad, pestañas,
recarga durante guardado — los tres con resultado correcto), quedan
cubiertos todos los elementos del texto literal de PM-23: recarga durante
guardado, timeout tras confirmación, varias pestañas, última unidad,
recepción/pago/devolución concurrentes y volumen representativo, con
presupuesto de rendimiento acordado y medido, no solo percibido.

**PM23_P03_ULTIMA_UNIDAD=CORRECTO**
**PM23_P03_DUPLICADOS_SIMULTANEOS=CORRECTO**
**PM23_CIERRE_FORMAL=PASS**
