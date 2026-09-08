# PM15 P02 — MEJ-01: empresa/local inequívocos en modales de acciones sensibles

Segundo punto de PM15, orden acordado con el usuario (LA-022/NR-08 primero, MEJ-01 después).

## Problema real encontrado (inspección de código, no hipotético)

Ninguno de los modales de acciones sensibles ya existentes mostraba en qué local/empresa
estaba actuando — solo describían la consecuencia de la acción (motivo, qué se conserva, qué
se borra), pero nunca el contexto. Auditados los cinco modales de mayor riesgo (borran o
cambian de estado un registro que solo tiene sentido dentro de un local/empresa concreto):

- "Cancelar encargo" y "Devolver encargo" (Encargos, PM14)
- "Eliminar cliente" (Clientes, PM14)
- "Dar de baja empleado" (Personal, PM10/PM13)
- "Desactivar local" (Locales) — este sí mostraba el **nombre del local** (entre comillas),
  pero no la empresa a la que pertenece.

## Solución (cambio aditivo de solo texto, sin tocar ninguna lógica de negocio)

- **`etiquetaContextoPM15(local, empresa)`** (nueva función pura): construye
  `"Nombre del local · Razón social/marca de la empresa"`, degradando con gracia si falta
  una de las dos partes, y sin inventar texto si faltan ambas (devuelve `""`).
- Se calcula **una sola vez** en el nivel de composición (`contextoActivoPM15 =
  etiquetaContextoPM15(locales.find(...), empresaDelLocalActivo)`) y se pasa como prop a
  `Personal`, `Encargos` y `Clientes` — evita repetir la lógica tres veces y garantiza que
  los tres muestren exactamente el mismo contexto.
- En los cuatro modales de Encargos/Clientes/Personal, se añade una línea de contexto
  (`"Local: {contextoActivoPM15}"`) justo después del título, antes de la descripción de la
  acción. Si no hay contexto disponible (`contextoActivoPM15` vacío), el `&&` corto-circuita
  y no se pinta nada — nunca una etiqueta vacía o inventada.
- En "Desactivar local" (que ya mostraba el nombre del local propio de `confirmarDesactivar`,
  no el del local activo del dispositivo), se añade la empresa de **ese** local concreto
  reutilizando el helper `empresaDeLocal` ya existente en el componente — sin nueva prop.

No se ha tocado ninguna función de lógica de negocio (`cancelarEncargo`, `devolverEncargo`,
`deleteCliente`, `deleteEmpleado`, `desactivarLocal`): es exclusivamente una adición visual.

## Archivos

- `fuente.js`: nueva función `etiquetaContextoPM15`; nuevo prop `contextoActivoPM15` en
  `Personal`, `Encargos`, `Clientes`; línea de contexto en los 5 modales auditados; cálculo
  único en la composición.
- `tests/pm15/p02-mej01-contexto-modales-contract.mjs` (nuevo): la función pura
  (positivo/negativo/degradación), los 5 modales muestran contexto, el contexto se pasa a
  los tres componentes desde un único cálculo, y ausencia de contexto no pinta nada.

## Explícitamente fuera de alcance (documentado, no oculto)

- No se ha auditado ni tocado el resto de modales de la app (Eliminar producto, Eliminar
  pedido, Eliminar proveedor, Anular venta, etc.). Se ha priorizado el conjunto más
  directamente ligado a la ambigüedad empresa/local que señala MEJ-01 (Encargos, Clientes,
  Personal, Locales), consistente con el alcance de PM14/PM15. Ampliar a todos los modales
  de la app es una tarea mucho mayor y transversal, no un "cambio mínimo".

## Regresión

Suite completa: `tests/g1`, `tests/pm04`, `tests/pm05`, `tests/pm07`, `tests/pm08`,
`tests/pm09`, `tests/pm10`, `tests/pm11-compra`, `tests/pm12`, `tests/pm13`, `tests/pm14`,
`tests/pm15` (P01 y P02) — sin regresiones.

## Estado de main/producción

`main` = `767a2c3163f924b7599338785fe4331f78f0e1ac`, sin tocar directamente — este trabajo
vive en `claude/pm15-contexto-borradores-errores`. Sin migraciones nuevas (cambio de
frontend puro). `L&A Suite` (producción) y `TPV` no se han tocado.
