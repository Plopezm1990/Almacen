# PM14 · P01 — Documento e identidad del encargo

Fecha de inicio: 2026-09-08
Rama: `pm14-encargos-anticipos-clientes`
Base vinculante: `6ee2752a8f6aba882a6fa926892ab5b04aac231d` (PM13 cerrado)
Producción: fuera de alcance. `main` debe permanecer en `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`.

## Objetivo

Cerrar el primer bloque de PM14 sin rehacer LA-018/PM10: el encargo debe ser un documento estable, con cliente, empresa, local, fechas, líneas, precios y total propios. La edición ordinaria no puede moverlo de empresa/local ni cambiar su identidad interna o fecha de creación.

## Diagnóstico real heredado

PM10 P08 ya cerró la validación de alta/edición de Encargos mediante `validarEncargoPM10`: cliente resoluble, fecha ISO real, al menos una línea, cantidades finitas > 0, precios finitos >= 0, señal no negativa ni superior al total y local de escritura válido. PM10 dejó expresamente diferido a PM14 el ciclo E2E de entrega/anticipo/cancelación/devolución.

PM05 ya hizo a `clientes` una entidad de empresa (`clientes_empresa`) y la lógica de clientes conserva `empresaId`. PM10 P13 bloqueó escritura en local inexistente, inactivo/fusionado y el uso de “Todos los locales” como destino de mutación.

Hueco P01 identificado: un encargo nuevo quedaba ligado a `localId` y a un cliente empresarial compatible, pero no fijaba siempre `empresaId` explícito en el propio documento. Además, la edición protegía de hecho `id`/`localId` por reconstrucción del candidato, pero podía ignorar silenciosamente intentos de cambiar identidad en lugar de rechazarlos de forma explícita; `fechaCreacion` tampoco estaba declarada como inmutable. El total se calculaba en la barrera, pero no quedaba fijado autoritativamente en el documento por esa misma barrera.

## Contrato P01

1. Alta nueva: exige empresa y local concretos y operativos; `Todos` nunca es destino.
2. Cliente: debe existir y pertenecer a la empresa activa cuando su `empresaId` es explícito.
3. Documento nuevo: fija `id`, `empresaId`, `localId`, `estado = Pendiente`, `fechaCreacion`, líneas normalizadas y `total` calculado por dominio.
4. `id`, `empresaId`, `localId` y `fechaCreacion` son identidad estable y una edición ordinaria no puede cambiarlos.
5. Cambiar posteriormente el precio del catálogo no reinterpreta precios unitarios ni total ya guardados en el encargo.
6. Un histórico legado sin `empresaId` explícito no se repara silenciosamente usando solo el selector actual. Se conserva tal cual mientras no exista evidencia suficiente para una migración controlada.
7. Estados canónicos de documento para PM14: `Pendiente`, `Entregado` y `Cancelado`. Cobro/reembolso se modelará como dimensión trazable separada; no se inventa un estado “Parcial” de entrega si no existe entrega parcial en el contrato.
8. P01 no implementa todavía cobro real, entrega, cancelación ni devolución. Esos efectos pertenecen a P02–P05.

## Casos de aceptación

- A1 + cliente empresa A + producto A1 -> alta válida con empresa/local explícitos.
- Cliente B desde empresa A -> rechazo sin mutación.
- Local A2 en una edición de documento A1 -> rechazo explícito.
- Empresa B en una edición de documento A -> rechazo explícito.
- Local inactivo o sin local concreto -> rechazo sin mutación.
- Intento de cambiar `id` o `fechaCreacion` -> rechazo explícito.
- Cambio posterior de PVP del producto -> el documento ya creado conserva su precio de línea y total.
- Legado sin `empresaId` -> una edición ordinaria no rellena automáticamente esa identidad histórica.

## Fuera de P01

- La señal todavía no se considera un movimiento real de caja solo por existir en `encargo.cobros`.
- La entrega todavía no se considera atómica ni idempotente hasta P03.
- `deleteEncargo`/cancelación se resolverá en P04: el contrato final no permitirá borrar un encargo económico para cuadrar cifras.
- Devolución/reembolso se cerrará en P05 y no podrá exceder lo entregado/cobrado.
