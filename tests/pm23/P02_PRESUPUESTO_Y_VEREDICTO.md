# PM23 P02 — Presupuesto acordado y veredicto formal sobre la línea base

Segundo punto de PM23. El usuario fijó el presupuesto de rendimiento
definitivo con la línea base de P01 delante:

- **p95 < 2000 ms** para una operación transaccional real contra QA.
- **Recuperación tras timeout < 5000 ms** (desde el abandono del cliente
  hasta que el reintento con el mismo `operationId` confirma el resultado
  final).

Y aceptó explícitamente el sustituto de "recepción"
(`pm12_confirmar_ajuste_stock`) medido en P01 §2, en vez de exigir una
medición separada del mecanismo `almacen_kv`.

## 1. Veredicto por operación y modo

Presupuesto: p95 < 2000 ms. Todos los valores en milisegundos, tomados
directamente de `tests/pm23/p01-resultado-medicion.json` (P01) — no se ha
repetido la medición, porque los datos de P01 ya son una medición real,
completa y sin errores, ligada al mismo HEAD.

| Operación | Modo | p95 medido | Presupuesto | Veredicto |
|---|---|---|---|---|
| Pago | Concurrente×2 | 200 | < 2000 | **APROBADO** |
| Pago | Concurrente×5 | 239 | < 2000 | **APROBADO** |
| Pago | Concurrente×10 | 284 | < 2000 | **APROBADO** |
| Pago | Concurrente×20 | 401 | < 2000 | **APROBADO** |
| Pago | Secuencial×200 | 148 | < 2000 | **APROBADO** |
| "Recepción" (sustituto) | Concurrente×2 | 163 | < 2000 | **APROBADO** |
| "Recepción" (sustituto) | Concurrente×5 | 166 | < 2000 | **APROBADO** |
| "Recepción" (sustituto) | Concurrente×10 | 224 | < 2000 | **APROBADO** |
| "Recepción" (sustituto) | Concurrente×20 | 192 | < 2000 | **APROBADO** |
| "Recepción" (sustituto) | Secuencial×200 | 153 | < 2000 | **APROBADO** |
| Devolución | Concurrente×2 | 167 | < 2000 | **APROBADO** |
| Devolución | Concurrente×5 | 235 | < 2000 | **APROBADO** |
| Devolución | Concurrente×10 | 229 | < 2000 | **APROBADO** |
| Devolución | Concurrente×20 | 466 | < 2000 | **APROBADO** |
| Devolución | Secuencial×200 | 200 | < 2000 | **APROBADO** |

El peor caso medido en cualquier operación/modo fue 466 ms de p95
(devolución, concurrencia×20) — un 77% por debajo del presupuesto de 2000 ms.
Incluso el peor p99 individual (498 ms, devolución×20) queda muy por debajo.

## 2. Veredicto de recuperación tras timeout

Presupuesto: < 5000 ms desde el abandono del cliente hasta la confirmación
del reintento. Medido en P01 §5: timeout de cliente a 66 ms, seguido de una
espera deliberada de 1500 ms antes del reintento, que confirmó
`replayed:true` de inmediato (tiempo de respuesta del propio reintento del
orden de 130-200 ms, según la p50 de pago). Tiempo total hasta la
confirmación: del orden de 1,7-1,8 s en los 5 ciclos — **muy por debajo de
los 5000 ms** del presupuesto.

**Veredicto: APROBADO.**

## 3. Aceptación explícita del sustituto de "recepción"

El usuario decidió aceptar `pm12_confirmar_ajuste_stock` como sustituto
válido de "recepción" para el cierre de PM23, en vez de exigir una medición
separada del mecanismo `almacen_kv` (que no tiene control de concurrencia
por fila ni identificador de operación equivalente). Esta decisión queda
registrada aquí como una excepción expresamente aceptada, no como un hueco
sin resolver — conforme a la propia regla del usuario ("un presupuesto
acordado... no puede incumplirse y quedar automáticamente como no
bloqueante" se cumple aquí porque no hay incumplimiento: hay una decisión
explícita sobre qué se mide en lugar de la recepción real).

## 4. Ningún hallazgo a corregir de este veredicto

Ninguna operación ni modo incumplió el presupuesto. No hay ningún hallazgo
de rendimiento que corregir en este punto — el propio texto de PM-23 exige
"presupuesto de rendimiento y muestra acordados, con mediciones", que es
exactamente lo que se entrega aquí, con veredicto explícito en cada fila, no
solo números sin interpretar.

## 5. Alcance restante de PM-23 (NR-06/12), aún no ejecutado

El presupuesto y el veredicto de P01/P02 cubren "timeout tras confirmación"
y "recepción/pago/devolución concurrentes y volumen representativo" del
texto literal de PM-23. Quedan, del mismo texto literal, tres escenarios
específicos sin ejecutar todavía — no se declaran cerrados por extensión de
este veredicto:

- **"Recarga durante guardado"**: el cliente recarga la página mientras una
  operación está en curso, sin haber recibido confirmación.
- **"Varias pestañas"**: dos pestañas del mismo usuario reenvían la misma
  operación pendiente casi simultáneamente.
- **"Última unidad"**: dos operaciones concurrentes compiten por la última
  unidad de stock disponible.

Desde el backend, "recarga durante guardado" y "varias pestañas" son
observacionalmente el mismo caso: dos peticiones con el **mismo
`operationId`** llegando casi al mismo tiempo, sin que ninguna de las dos
haya recibido aún confirmación de la otra. Se prueban juntas en PM23 P03,
sin inventar una distinción que el backend no puede observar.

## 6. Archivos

- `tests/pm23/P02_PRESUPUESTO_Y_VEREDICTO.md` (este documento).
- `tests/pm23/p02-contract.mjs` (nuevo): confirma que el veredicto por
  operación/modo está registrado y que ninguna fila incumple el presupuesto
  acordado, y que no se publica ningún identificador interno ni secreto.

## Regresión

Sin cambios en `fuente.js` ni en ninguna migración — este punto interpreta
los datos ya medidos en P01, no ejecuta nada nuevo contra QA. Suite completa
del proyecto — sin regresiones.

## Estado de main/producción/QA

`main` sin tocar. Ninguna escritura nueva en QA en este punto (es
interpretación de datos ya recogidos). Producción y TPV sin tocar.

**PM23_P02_PRESUPUESTO_ACORDADO=p95<2000ms;recuperacion<5000ms**
**PM23_P02_VEREDICTO=APROBADO_SIN_HALLAZGOS**
