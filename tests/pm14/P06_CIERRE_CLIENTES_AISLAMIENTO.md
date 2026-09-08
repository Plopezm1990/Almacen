# PM14 P06 — Clientes: aislamiento por empresa y anonimización

## Problema encontrado

Ver `P01_DIAGNOSTICO_ENCARGOS_ANTICIPOS.md`, sección M. `deleteCliente` no comprobaba
`empresaId` en absoluto (borraba por `id` sin más — riesgo cross‑empresa si se conocía el
id); `anonimizarCliente` tenía el mismo problema; `updateCliente` sí filtraba por empresa
pero no devolvía ningún resultado (`undefined` siempre), y la UI (`Clientes.submit`,
`crearClienteRapido` en Encargos) **nunca comprobaba el resultado de `addCliente`/
`updateCliente`**: si `addCliente` fallaba (por ejemplo sin `empresaId` en contexto,
devolviendo `null`), la UI cerraba el formulario como si hubiese ido bien — el mismo patrón
de "éxito fingido" ya corregido en Encargos (P03). `anonimizarCliente` además existía en el
código desde antes pero **no tenía ningún botón en la interfaz** — funcionalidad muerta.

Inspección de `L&A Suite QA` (Supabase): existe una tabla `clientes_empresa` (id,
`empresa_id`, `datos` jsonb) con RLS ya correcta por empresa (`select`/`insert`/`update`/
`delete` gated por `la_tiene_empresa(empresa_id)`, `insert`/`update` exigen además que
`datos->>'empresaId' = empresa_id`) — construida en un PM anterior pero nunca conectada al
frontend, que seguía usando exclusivamente el blob `almacen_kv` (una sola fila global por
clave `"clientes"`, sin partición por empresa a nivel de fila — ver hallazgo ya reportado en
el chat sobre el riesgo de colisión cross-empresa en `almacen_kv`).

## Solución aplicada

- `addCliente`/`updateCliente`/`deleteCliente`/`anonimizarCliente` devuelven ahora un
  resultado real que la UI comprueba: `addCliente` sigue devolviendo el cliente creado (igual
  que antes, para no romper `crearClienteRapido`) o `{ok:false, codigo, error}` si falta
  `empresaId`; `updateCliente` devuelve `true`/`{ok:false,...}`; `deleteCliente`/
  `anonimizarCliente` devuelven `true`/`false`, comprobando `empresaId` como ya hacía
  `updateCliente`.
- UI: `Clientes.submit()` y `crearClienteRapido` (en Encargos) ya no cierran el formulario
  ni dan el alta por buena sin comprobar el resultado.
- Se añadió el botón "Anonimizar" (con confirmación) que faltaba para una función que ya
  existía en la lógica pero nunca se exponía.
- `sincronizarClienteNube`/`eliminarClienteNube` (nuevas, mismo patrón que
  `sincronizarEncargoNube` de P02): en segundo plano, sin bloquear la operación local,
  mantienen `clientes_empresa` al día vía `upsert`/`delete` directos sobre la tabla (no hace
  falta RPC: la RLS ya permite exactamente esta escritura al usuario autenticado de esa
  empresa). Esto empieza a poblar correctamente la tabla real para cada alta/edición/
  anonimización nueva, sin cambiar el modelo de lectura actual.

## Explícitamente fuera de alcance (documentado, no oculto — el hallazgo más importante de este punto)

**No se ha migrado la lectura de Clientes fuera del blob `almacen_kv`.** El riesgo de fondo
— que la clave `"clientes"` es una única fila global sin partición por empresa a nivel de
fila, así que dos empresas gestionadas desde la misma cuenta podrían pisarse los datos —
**sigue sin resolverse del todo**: esta sesión añade un espejo correcto en
`clientes_empresa` para las escrituras nuevas, pero el camino de lectura (`loadKey`/
`window.storage`) sigue siendo el blob antiguo. Cerrar esto de raíz exige migrar también la
lectura (cargar `clientes_empresa` en vez de la clave `"clientes"` cuando hay nube activa),
un cambio de mayor alcance que no encaja en "cambio mínimo" para este punto — queda como el
elemento pendiente más importante de PM14-P06, a decidir si se aborda en un punto propio o
se traslada a un PM posterior de aislamiento transversal.

## Archivos principales

- `fuente.js`: `crearLogicaClientes`, componente `Clientes`, `crearClienteRapido` (en
  `Encargos`).
- `tests/pm14/p06-clientes-aislamiento-contract.mjs`.

## Pruebas

Alta sin empresa rechazada, alta correcta, editar/eliminar/anonimizar cliente de otra
empresa rechazado (antes no comprobaba nada), editar/eliminar/anonimizar en la misma
empresa correcto, eliminar inexistente rechazado sin reventar, anonimizar conserva el
`id` (no rompe referencias históricas de encargos), sincronización en segundo plano con
`clientes_empresa` no bloquea el alta local.

## Regresión

`tests/pm10/p08-encargos-contract.mjs` (su regex de composición sigue esperando
`addCliente` con la misma forma de invocación), `tests/pm14/p01-p05`,
`tests/pm07/frontend-contract.mjs`, `tests/pm09/*.mjs` — sin regresiones.

## Estado de main/producción

`main` = `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`, sin tocar. Sin migraciones nuevas (la
tabla y las políticas de `clientes_empresa` ya existían en `L&A Suite QA`). `L&A Suite`
(producción) y `TPV` no se han tocado.
