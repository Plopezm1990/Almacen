# PM14 P07 — Fallos, replay y concurrencia

Este punto no introduce una funcionalidad nueva: reúne, prueba con más rigor y documenta
honestamente el estado real de replay/concurrencia de todo lo construido en P01–P06.

## Lo que ya estaba protegido (P01–P06) y aquí se verifica con más fuerza

- **Doble clic / reintento en caja (P02):** `registrarAnticipoEncargo` usa `operationId`/`id`
  de fila **deterministas** (`anticipo-encargo:<id>:senal` / `:resto`), nunca `uid()`
  aleatorio. Ya probado con llamadas secuenciales; en este punto se prueba además con
  `Promise.all` real (dos llamadas verdaderamente concurrentes, no una tras otra): ambas
  intentan la RPC con **exactamente el mismo id**, nunca dos identidades distintas — la
  seguridad no depende de que el cliente "gane" una carrera, sino de que nunca pueda crear
  dos intenciones diferentes para el mismo hecho.
- **Concurrencia real en el servidor:** nuevo contrato Postgres
  (`tests/pm14/db/p07-postgres-concurrencia-contract.mjs`) que reproduce una carrera
  **real** (dos conexiones, no simulada con `setTimeout`): la conexión A adquiere el
  advisory lock ya usado por PM08 (`private.pm08_bloquear_operation_id`, reutilizado sin
  cambios) dentro de una transacción sin confirmar; se observa con `pg_stat_activity` que
  la conexión B **queda realmente bloqueada** esperando ese lock; al confirmar A, B se
  resuelve como `replayed:true` y nunca se duplica la fila en `pagos_encargo`.
- **Entrega, cancelación, devolución (P03–P05):** siguen siendo idempotentes por
  construcción (`entrega-encargo:<id>`, cancelación/devolución con guardas de estado que
  devuelven `replayed:true`/`yaCancelado`/`yaDevuelto` sin repetir efectos). No se ha tenido
  que tocar nada aquí: ya cumplían el contrato de P07.
- **Aislamiento cross-empresa/local (P02, P03, P06):** ya cubierto con casos dedicados en
  cada punto; no se repite aquí.

## Riesgo real, cuantificado y **no resuelto** en este punto

El documento completo del encargo (y el de clientes) sigue viviendo en un blob de fila
única (`almacen_kv`, clave `"encargos"` / `"clientes"`), guardado mediante una
**sobrescritura total** (`saveKey` → `window.storage.set`), sin ninguna comparación de
versión. El nuevo test `tests/pm14/p07-encargos-concurrencia-contract.mjs` reproduce y
cuantifica exactamente esto: dos "pestañas" cargan la misma foto del array; la pestaña A
añade un encargo y guarda; la pestaña B —que nunca vio ese alta— cancela un encargo
distinto y guarda su propia copia completa; **el alta de A desaparece sin ningún aviso ni
error**. Es una pérdida de actualización clásica (*lost update*), reproducible con datos
sintéticos.

No se corrige en este punto porque:
1. `window.storage` es un primitivo **externo** (inyectado por la plataforma), sin
   comparar-y-cambiar (`compare-and-swap`) expuesto a `fuente.js`; no hay forma de arreglarlo
   sin tocar esa capa, que está fuera del alcance de Encargos.
2. El punto de guardado (`saveKey("encargos", encargos)` / `saveKey("clientes", clientes)`)
   vive en el componente raíz de la aplicación y es **compartido por todas las claves**
   (productos, movimientos, ventas, etc.), no solo por Encargos/Clientes — arreglarlo bien
   significa una capa de concurrencia optimista transversal, no un "cambio mínimo" de PM14.
3. Coincide exactamente con NR-06 del traspaso de continuidad ("Concurrencia/red/timeout...
   matriz final en PM23") — es decir, ya estaba identificado como un punto transversal para
   una fase posterior, no específico de Encargos.

**Mitigación parcial ya construida (P02/P06):** los campos que sí importan para el dinero
(total, estado, saldo) tienen un espejo autoritativo en tablas reales
(`encargos_empresa`/`clientes_empresa`) con RLS y, en el caso de los cobros, con lock real
en Postgres — así que aunque el *documento* pueda sufrir una pérdida de actualización, el
*dinero* (cobros/reembolsos) nunca puede duplicarse ni perderse de forma inconsistente,
porque no pasa por el blob.

## Archivos principales

- `tests/pm14/db/p07-postgres-concurrencia-contract.mjs` (nuevo, concurrencia real con dos
  conexiones a Postgres).
- `tests/pm14/p07-encargos-concurrencia-contract.mjs` (nuevo, carrera real vía `Promise.all`
  + demostración cuantificada del riesgo de fondo del blob).

No se modifica ninguna lógica de `fuente.js` en este punto: es un punto de verificación y
documentación, no de implementación.

## Regresión

`tests/pm10/p08-encargos-contract.mjs`, `tests/pm14/p01-p06`, `tests/pm07/frontend-contract.mjs`,
`tests/pm09/*.mjs` — sin regresiones (no se tocó código de producto).

## Estado de main/producción

`main` = `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`, sin tocar. Sin migraciones nuevas.
`L&A Suite` (producción) y `TPV` no se han tocado.
