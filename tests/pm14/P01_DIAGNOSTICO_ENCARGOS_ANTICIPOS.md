# PM14 — Diagnóstico real (previo a cualquier cambio funcional)

Rama: `claude/pm14-encargos-anticipos-i8ye52` (realineada a `6ee2752a8f6aba882a6fa926892ab5b04aac231d`, checkpoint final PM13/P07 — no se creó desde `main`).
Estado verificado en vivo antes de tocar nada:
- `origin/main` = `7f792925d6a3d27334ee0e7335ba635b4ed79b6b` ✔ coincide con el traspaso, congelado, no tocado.
- `origin/pm13-p07-ia-nominas-revision` = `6ee2752a8f6aba882a6fa926892ab5b04aac231d` ✔ coincide con el traspaso.
- La rama de trabajo asignada por el entorno apuntaba, al arrancar, exactamente a `main` (idéntica byte a byte, cero commits propios). Se realineó con `git reset --hard 6ee2752a...` y push, sin pérdida de trabajo (se verificó `git diff origin/main origin/claude/pm14-...` vacío antes de tocarla).

Todo lo que sigue es **solo lectura del código real** (`fuente.js`, 118 919 líneas) y de los contratos ya cerrados en `tests/pm10/p08-encargos-contract.mjs`. No se ha modificado ninguna línea funcional.

## A. ¿Cómo se crea hoy un encargo?

`crearLogicaEncargos({ encargos, setEncargos, ... })` → `addEncargo(data)` (fuente.js:106655).
Valida con `validarEncargoPM10` (fuente.js:106556, cerrado en PM10‑P08/P09/P12/P13): cliente existente y de la misma empresa, fecha de entrega ISO válida y ≥ fecha de creación, líneas con producto de catálogo (mismo local) o descripción libre, cantidad/precio > 0, señal ≤ total, medio de pago de señal válido. Todo-o-nada: una línea inválida invalida el alta completa (contrato PM10 confirmado, no se toca).

Persistencia: **100% estado de React en memoria**, guardado como blob único con `saveKey("encargos", encargos)` (fuente.js:102087) → `window.storage.set("encargos", JSON.stringify(arrayCompleto), false)` (fuente.js:101282). `clientes` usa el mismo mecanismo. No hay tabla Supabase dedicada, RPC ni Edge Function para Encargos/Clientes — a diferencia de Stock (PM07/12, `stock_operaciones`, `movimientos_stock`, RPC `registrar_venta_stock_carrito_pm09`) o Personal (PM11/13, RPCs `pm11_*`). Es el modelo **pre‑PM07**: sobrescritura completa del array en cada guardado, sin `operationId` de fila, sin lock, sin detección de conflicto de escritura.

## B. ¿Tiene identidad estable?

Parcial. Tiene `id` (uid), `clienteId`, `localId`, `fechaCreacion`, `fechaEntrega`, `lineas`. **Le faltan**:
- `empresaId` propio — `validarEncargoPM10` solo lo usa transitoriamente para validar contra `cliente.empresaId`; el objeto persistido (fuente.js:106629‑106641) nunca incluye `empresaId`. El anclaje de empresa depende indirectamente del cliente y del local, no es un campo propio.
- `total` — se recalcula con `reduce(...)` de forma independiente en al menos 3 sitios (`entregarEncargo` línea 106706, el listado de pendientes línea ~113399, el modal de entrega línea 113404), sin una única fuente de verdad.
- `operationId` — no existe ningún identificador de operación para la entrega o el cobro; ver punto F/L.

## C. ¿Qué estados reales existen?

Solo dos se producen realmente: `"Pendiente"` (por defecto en `addEncargo`) y `"Entregado"` (fijado en `entregarEncargo`, fuente.js:106711). **No existe ninguna función que fije `"Cancelado"`** — sin embargo el código de lectura ya lo anticipa y filtra por él en dos sitios (fuente.js:102750 y 102914: `e2.estado !== "Entregado" && e2.estado !== "Cancelado"`), es decir hay un contrato de lectura a medio construir cuyo lado de escritura nunca se implementó. `updateEncargo` además permite escribir `estado` a cualquier valor libre vía `data`, sin máquina de estados ni transiciones válidas.

## D–E. ¿Cómo se registra hoy un anticipo (señal)?

Es **solo un número dentro del propio documento del encargo**, en un array `cobros` (fuente.js:106660, `sincronizarCobroSeñal`, fuente.js:106540). No genera movimiento de caja real, no genera un "pago" en el sentido de PM11/PM06, no pasa por ningún RPC.
- Un solo importe de señal: `sincronizarCobroSeñal` **reemplaza** el registro `"Señal"` existente por uno nuevo cuando cambia (misma `id`, importe sobrescrito) — no admite múltiples cobros/anticipos parciales reales, solo "editar el número". No queda rastro de cuál era el importe anterior.
- No hay `operationId`/replay para el cobro: cada `updateEncargo({ señal: N })` sobrescribe sin comprobar si es un reintento de la misma operación o una intención nueva.
- No admite sobrecobro respecto al total (`señal > total` se bloquea, contrato PM10 ya cerrado, correcto) pero sí permite bajar la señal por debajo de lo que ya se hubiera "cobrado" sin ningún control económico, porque no hay caja real detrás.

## F–G. ¿Cómo se entrega el encargo? ¿Descuenta stock / crea venta / puede ejecutarse dos veces?

**Defecto crítico y reproducible, no documentado en ningún traspaso anterior.**

`entregarEncargo(encargo, medioPago)` (fuente.js:106690):
```js
function entregarEncargo(encargo, medioPago = "Efectivo") {
  const actual = encargos.find((e2) => e2.id === encargo);   // <-- compara e2.id (string) con `encargo`
  if (!encargoEsDelLocalActivo(actual)) return false;
  ...
```
La UI real la invoca así (fuente.js:113419): `entregarEncargo(e2, medioPagoEntrega)`, pasando el **objeto** encargo completo, no su id. Por tanto `e2.id === encargo` (objeto) nunca es cierto, `actual` es siempre `undefined`, `encargoEsDelLocalActivo(undefined)` devuelve `false` (fuente.js:106650‑106654), y la función **retorna `false` inmediatamente sin ejecutar nada**: no descuenta stock, no crea venta, no cambia el estado del encargo, no añade el cobro del resto.

El botón "Confirmar entrega" (fuente.js:113418‑113421) ignora el valor de retorno y cierra el modal igualmente:
```js
onClick: () => { entregarEncargo(e2, medioPagoEntrega); setEntregarId(null); }
```
Es decir: **hoy, en el código real, entregar un encargo no tiene ningún efecto — ni en stock, ni en caja, ni en el estado — pero la UI muestra éxito y cierra el modal.** Esto contradice directamente la regla ya aplicada en el propio formulario de alta/edición del mismo módulo (`tests/pm10/p08-encargos-contract.mjs:214‑218` exige explícitamente que el formulario "solo se cierra tras éxito"): la ruta de entrega quedó fuera de ese contrato y lo incumple.

Si se corrigiera solo la comparación de identidad (sin más cambios), aparecerían inmediatamente estos otros defectos, ya presentes en el cuerpo de la función:
1. **Sin backend en modo sincronizado.** `entregarEncargo` llama a `venderLineas` (fuente.js:106698), la versión **local/síncrona** de `crearLogicaVenta` (fuente.js:106728), nunca a `venderCarrito` (fuente.js:106801), que es la que usa el RPC `registrar_venta_stock_carrito_pm09` cuando `window.__nubeActiva`. Se confirma en la composición real (fuente.js:102249‑102251): `venderLineas` se desestructura de `crearLogicaVenta` y se pasa tal cual a `crearLogicaEncargos`. Resultado: la entrega de un encargo **nunca respeta la autoridad del backend** (DEC‑03), incluso con Supabase conectado — muta stock local sin RLS ni servidor, mientras el TPV normal sí usa el camino RPC.
2. **Sin idempotencia.** `venderLineas` se llama sin `operationId` (fuente.js:106698‑106705 no incluye esa clave en `opciones`), así que cada llamada genera un `ventaId = uid()` nuevo (fuente.js:106745) y `movimientoId: uid()` nuevos (fuente.js:106785). No hay ninguna comprobación de `encargo.estado === "Entregado"` antes de proceder. Doble clic o reintento (una vez arreglada la comparación de identidad) duplicaría venta y descuento de stock sin que el motor de idempotencia ya existente (`aplicarLoteMovimientosStock`, `idsConocidos`/`porId`) pueda detectarlo, porque nunca recibe un id determinista.
3. El "resto" cobrado al entregar (fuente.js:106707‑106710) se añade solo al array `cobros` del propio documento, igual que la señal — no genera ningún movimiento de caja real.

## H. ¿Qué pasa al cancelar?

No existe ninguna función de cancelación (`cancelarEncargo`, etc.). La única acción disponible es `deleteEncargo` (fuente.js:106683), que hace **borrado físico total e incondicional** del registro (`setEncargos(s => s.filter(...))`), sin comprobar `estado` (se puede borrar un encargo ya `"Entregado"`, con venta y stock ya afectados, perdiendo la única referencia legible a esa operación — los movimientos de stock quedarían con `documentoOrigenId` apuntando a un encargo que ya no existe). El propio texto de la UI lo admite (fuente.js:113422): *"Se borra el encargo. Esta acción no se puede deshacer."* Esto incumple DEC‑04 y la regla general de no-borrado de operaciones económicas confirmadas.

## I. ¿Qué pasa con un anticipo al cancelar?

No aplica una respuesta real: al no existir cancelación, la única vía (`deleteEncargo`) destruye también cualquier rastro de la señal cobrada, sin reverso ni trazabilidad (no hay caja real que revertir, pero se pierde la evidencia documental).

## J–K. ¿Cómo se hace una devolución/reembolso? ¿Puede devolverse más de lo entregado/cobrado?

No existe ninguna función de devolución/reembolso para encargos. No hay, por tanto, ningún control que impida devolver más de lo entregado o cobrado — el caso no está cubierto en absoluto.

## L. Doble clic / retry / respuesta perdida / dos pestañas / concurrencia

- **Alta/edición**: protegidas por el contrato PM10 (todo-o-nada, validación previa a mutar) — correcto, no se toca.
- **Entrega**: rota de raíz (ver F/G); si se arregla sin operationId, no es replay-safe.
- **Persistencia (`encargos`/`clientes` como blob único)**: `saveKey` hace un `set` de reintento simple (fuente.js:101280) sin comparación de versión previa; dos pestañas o dos operaciones simultáneas que lean el array, lo modifiquen en memoria y lo vuelvan a guardar producen **último-en-escribir gana** sin detección de conflicto — el patrón opuesto al usado en Stock/Personal (fila por operación + `operation_id` + advisory lock).
- No hay noción de "operación pendiente sin confirmar" para Encargos equivalente a `contexto.pendiente` del motor de stock (fuente.js:105016‑105037).

## M. Aislamiento (empresa / local / cliente / histórico / local inactivo / "Todos los locales")

- **Empresa**: el encargo no guarda `empresaId` propio (ver B); el aislamiento depende de que el cliente tenga `empresaId` correcto en el momento de la validación. `clientes` es el array completo sin filtrar por empresa (fuente.js:102250 pasa el estado raíz tal cual); `addCliente`/`updateCliente` sí comprueban `empresaId` (fuente.js:104958, 104964) pero **`deleteCliente` no comprueba `empresaId` en absoluto** (fuente.js:104966‑104970): borra por `id` sin más, aceptando en teoría borrar un cliente de otra empresa si se conoce su id.
- **Local**: `encargoEsDelLocalActivo` (fuente.js:106650) protege bien `updateEncargo`/`deleteEncargo`/`entregarEncargo` frente a "otro local concreto", **pero cuando `localActivoId` es `null` (vista "Todos los locales") devuelve `true` para cualquier encargo** — es decir, con "Todos los locales" seleccionado, `deleteEncargo` (y, si se corrige, `entregarEncargo`) pueden mutar/borrar un encargo de cualquier local sin restricción. Esto incumple la regla 13 del traspaso ("Todos los locales" no puede ser destino de una mutación que necesite local real).
- **Local inactivo**: `crearLogicaEncargos` no comprueba `local.activo`/`fusionadoEn` en ningún punto (a diferencia de `crearLogicaTraspasos`, fuente.js:107021‑107023, que sí lo hace). Se puede crear/editar/entregar un encargo contra un local inactivo o fusionado sin bloqueo.
- **Histórico**: se pierde en cuanto se ejecuta `deleteEncargo`/`deleteCliente` — no hay snapshot ni tabla de auditoría persistente para Encargos equivalente a la de Personal/IA-nóminas (PM13‑P07).

## N. Borrados físicos peligrosos

Sí, dos: `deleteEncargo` (fuente.js:106683) y `deleteCliente` (fuente.js:104966), ambos sin comprobar estado/histórico asociado antes de destruir el registro.

## O. ¿UI actualiza primero y backend después?

No en el sentido clásico (Encargos no tiene backend propio), pero el efecto es el mismo: la UI de entrega (fuente.js:113418‑113421) se comporta como si la operación hubiese tenido éxito (cierra el modal) sin comprobar el resultado — que hoy es siempre `false` sin efecto alguno.

## P. Efectos parciales / duplicados posibles hoy

- Hoy mismo: ninguno, porque `entregarEncargo` no hace nada (bug F/G) — el "efecto parcial" real es que el usuario cree que entregó un encargo y no pasó nada.
- En cuanto se corrija la comparación de identidad sin añadir operationId/idempotencia: doble clic o reintento duplicaría movimientos de stock y "ventas" (cada llamada genera sus propios `uid()`), aunque el encargo solo quedaría marcado `"Entregado"` una vez (por los cierres de `setEncargos` en lote de React) — es decir, quedaría **stock/venta duplicados con el documento de encargo aparentemente consistente**, el peor de los casos: nada en el encargo delata la duplicación aguas abajo.

## Contraste con la descomposición propuesta en el traspaso (sección 8/12.2)

La propuesta P01–P08 del traspaso encaja con lo encontrado y **no requiere cambios de forma**, con una precisión: P01 (documento/identidad) debe incluir explícitamente añadir `empresaId` y `total` como campos propios del encargo (hoy ausentes), no solo "verificarlos". P03 (Entrega) es más grave de lo que el traspaso anticipaba: no es solo "falta idempotencia", es que **la entrega está completamente rota en el código real** y además nunca usó el motor de venta autoritativo (`venderCarrito`) — corregirlo implica decidir si la entrega de un encargo pasa a usar el mismo RPC que el TPV (`registrar_venta_stock_carrito_pm09`) con un `operationId` derivado de forma determinista del `encargo.id`, reutilizando el motor de idempotencia ya existente, en vez de crear uno nuevo (tal como exige la sección 12.3 del traspaso).

## Qué NO se ha tocado en este paso

Ningún archivo funcional. Este documento es el único cambio de esta sesión de trabajo. `main` permanece en `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`. No se ha desplegado nada, no se ha tocado Supabase productivo, no se ha generado ninguna migración.

## Siguiente paso propuesto (pendiente de ejecutar, no ejecutado todavía)

1. **P01**: añadir `empresaId` y `total` como campos propios y estables del encargo (cambio mínimo en `validarEncargoPM10`/`addEncargo`), con contrato positivo/negativo y regresión de `tests/pm10/p08-encargos-contract.mjs`.
2. **P03 (bloqueante, prioridad alta)**: corregir `entregarEncargo` para que reciba y use el id correctamente, no proceda si el encargo ya está `"Entregado"`/no existe/pertenece a otro local (incluida "Todos los locales"), use un `operationId` determinista derivado de `encargo.id` reutilizando el motor de stock existente, y — cuando `window.__nubeActiva` — pase por el mismo camino autoritativo que el TPV en vez de mutar solo estado local. La UI no debe cerrar el modal si el resultado no es `ok`.
3. Después de P01/P03: abordar cancelación (P04) y devolución (P05) como estados trazables reales, no como borrado físico.
