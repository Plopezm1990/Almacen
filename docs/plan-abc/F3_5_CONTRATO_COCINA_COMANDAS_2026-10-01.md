# F3.5 — contrato de cocina, estaciones y comandas

Fecha: 2026-10-01  
Estado: `CONTRATO_COCINA_PREPARADO_NO_APLICADO`  
Base: F3.1–F3.4, A05/A10 y `origin/release` `7859508`

Este contrato fija la frontera entre el TPV y la operación de cocina. La
comanda es un efecto operativo de una línea enviada; no sustituye al pedido,
no recalcula el precio y no se convierte en una escritura directa desde la
interfaz.

## Identidad y rutas

| Elemento | Regla |
|---|---|
| Estación | pertenece a empresa/local, tiene código estable, tipo, activo y versión |
| Asignación | producto y estación con prioridad; una ruta activa determinista |
| Comanda | `operation_id`, tipo, `route_key`, estado y versión |
| Línea de comanda | acción `ALTA`, `CAMBIO` o `CANCELACION`, versión de línea y snapshot |
| Snapshot | conserva producto, cantidad, nota y configuración que se preparó |

Una línea sin ruta no se oculta ni se envía a una estación arbitraria: queda
`BLOQUEADA` y requiere configuración autorizada. El `route_key` forma parte de
la identidad de idempotencia para que una misma operación pueda tener varias
rutas sin duplicar cada ruta.

## Estados y autoridad

- El pedido y la línea siguen la máquina de estados A05: `ENVIADA`,
  `EN_PREPARACION`, `PREPARADA`, `SERVIDA` o `CANCELADA` según la acción
  autorizada.
- La comanda usa `PENDIENTE`, `RECIBIDA` o `BLOQUEADA`; recibir una comanda no
  equivale a servir la línea.
- El servidor comprueba local, día operativo, permisos, estado y versión antes
  de crear una estación, asignar una ruta, enviar un cambio o resolver una
  merma.
- La interfaz solo consulta estaciones, rutas y comandas; las mutaciones pasan
  por RPC autorizadas y recuperación idempotente.

## Cambios, cancelación y reimpresión

Un cambio operativo conserva la línea comercial y genera una comanda de tipo
`CAMBIO` con su propia operación y snapshot. Una cancelación de una línea ya
preparada no borra la comanda ni inventa una devolución: deja la decisión de
merma pendiente hasta que un rol autorizado seleccione `MERMA_CONFIRMADA` o
`NO_MERMA`. Reimprimir es un efecto operativo auditable y no crea una nueva
venta ni cambia cantidades.

## Límites explícitos

F3.5 no mueve stock, no cobra, no emite fiscalidad y no modifica el precio
histórico. La agregación o consumo de stock queda para su contrato propio; la
cocina trabaja con el snapshot de la selección concreta.

## Criterios de aceptación F3.5

1. Una comanda nueva, cambio, cancelación y reimpresión son distinguibles y
   auditables.
2. Replay, reintento y doble clic no duplican una comanda por la misma
   operación, ruta y tipo.
3. Una línea sin estación queda bloqueada y visible para resolverla.
4. La preparación conserva la variante, suplemento, nota y cantidad de la
   línea sin reescribir su identidad comercial.
5. Cancelar después de preparar exige una decisión de merma autorizada.
6. El TPV no escribe tablas de cocina directamente ni ejecuta acciones fuera
   de alcance.

## Resultado de F3.5

El contrato de cocina y comandas queda preparado para cerrar el alcance A10 y
su integración con A05/F3. No añade migración remota, no aplica cambios en
QA/PROD, no hace merge y no ejecuta deploy de Netlify.
