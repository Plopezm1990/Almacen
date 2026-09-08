# PM14 P04 — Cancelación de encargos

## Problema encontrado

No existía ningún estado "Cancelado" real: la única vía para dar de baja un encargo era
`deleteEncargo`, que hacía **borrado físico incondicional** del documento (ya limitado en
P03 para encargos `Entregado`, pero no para uno `Pendiente` con señal cobrada). El propio
código de lectura ya filtraba por `estado !== "Cancelado"` en dos sitios (dashboard y lista
de pendientes) desde antes de PM14 — un contrato de lectura a medio construir cuyo lado de
escritura nunca se implementó (ver `P01_DIAGNOSTICO_ENCARGOS_ANTICIPOS.md`, sección C).

## Solución aplicada

- `cancelarEncargo(encargoOrId, { motivo })`: nueva función que marca el encargo como
  `"Cancelado"` (vía `updateEncargo`, reutilizando su validación y su sincronización en
  segundo plano con `encargos_empresa`) sin borrar el documento. Motivo obligatorio y
  trazado (`fechaCancelacion`, `motivoCancelacion`). Un encargo ya `Entregado` no puede
  cancelarse; un encargo ya `Cancelado` responde de forma idempotente
  (`{ok:true, replayed:true, yaCancelado:true}`) sin reescribir el motivo original.
- `deleteEncargo` se restringe: ya no borra físicamente un encargo que tenga algún cobro
  confirmado (`cobros` con importe > 0) — coherente con DEC-04. Sigue permitiendo borrar un
  borrador real sin ningún cobro (caso "me equivoqué, esto no debería existir").
- La función devuelve `tieneCobrosPendientesDeResolver` y la lista de `cobros` para que el
  llamador decida **explícitamente** qué hacer con lo ya cobrado (nunca se revierte en
  silencio, ni se da por perdido en silencio).
- UI: el botón "Eliminar" del listado de encargos pendientes pasa a ser "Cancelar" y abre un
  modal que exige motivo. Si el encargo tenía cobros confirmados, tras cancelar se pregunta
  explícitamente (reutilizando `revertirAnticipoEncargo` de P02) si se reembolsan o se
  quedan como señal perdida — ninguna de las dos cosas ocurre por defecto.
- El espejo autoritativo `encargos_empresa` (P02) ya aceptaba `'Cancelado'` como estado
  válido desde su migración original, y `pm14_total_encargo` ya trataba un encargo
  `Cancelado` como sin saldo cobrable (`return null`) — cancelar un encargo, una vez
  sincronizado, bloquea automáticamente nuevos cobros contra él sin necesidad de una
  migración nueva.

## Explícitamente fuera de alcance (documentado, no oculto)

- Reembolsar automáticamente sin preguntar, o dar por perdida la señal sin preguntar: se
  decidió que ninguna de las dos es la política correcta por defecto (el Plan Maestro exige
  "política explícita"), así que la UI siempre pregunta.
- Cancelar un encargo con reserva de stock: no aplica — el diagnóstico de P01 confirmó que
  este motor no reserva stock al crear el encargo (solo se descuenta en la entrega, P03), así
  que no hay nada de stock que revertir al cancelar un `Pendiente`.

## Archivos principales

- `fuente.js`: `crearLogicaEncargos` (`cancelarEncargo`, `deleteEncargo` restringido),
  composición, componente `Encargos` (botón y modal de cancelación).
- `tests/pm14/p04-encargos-cancelacion-contract.mjs`.

## Pruebas

Caso feliz (marca Cancelado, no borra, motivo trazado), sin cobros que resolver, motivo
obligatorio, no se puede cancelar un `Entregado`, replay/doble clic idempotente (no
reescribe el motivo), encargo inexistente y de otro local rechazados, acepta id u objeto
completo (igual que `entregarEncargo`), `deleteEncargo` bloqueado con cobros y permitido sin
ellos.

## Regresión

`tests/pm10/p08-encargos-contract.mjs`, `tests/pm14/p01`, `p02`, `p03`,
`tests/pm07/frontend-contract.mjs`, `tests/pm09/*.mjs` — sin regresiones.

## Estado de main/producción

`main` = `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`, sin tocar. Sin migraciones nuevas (el
espejo de P02 ya soportaba `Cancelado`). `L&A Suite` (producción) y `TPV` no se han tocado.
