# PM13 · Punto 4.4 — Persistencia autorizada de pantallas por cargo

Fecha: 2026-10-17
Rama: `codex/fix-product-bootstrap-context-20261015`
Migración preparada: `20261017160000_pm13_p04_cargo_pantallas.sql`

## Qué se entrega

- Tabla aislada `public.abc_cargo_pantallas`, vinculada a empresa y cargo, con una fila por capacidad de consulta permitida.
- Catálogo servidor de las 45 claves estables del punto 4.2. Las claves desconocidas o asociadas a un módulo inactivo se rechazan.
- RPC `abc_guardar_cargo_pantallas`: valida el contexto del Propietario, comprueba el cargo y reemplaza atómicamente la selección del cargo.
- RPC `abc_listar_cargo_pantallas`: devuelve el catálogo y el estado efectivo de cada capacidad.
- `abc_listar_cargos` incluye `pantallas_consulta` para que la vista de cargos pueda hidratar la selección después de recargar o desde otro dispositivo.
- La auditoría registra actor, empresa, local, cargo, selección anterior, selección nueva, `operationId` y momento.
- La tabla no se expone directamente al cliente: se mantiene RLS activa, se revocan privilegios directos y solo se conceden las RPC a `authenticated`.

## Reglas de seguridad

- Toda lectura y escritura pasa por `pm13_cargo_validar_contexto`, que exige sesión y autorización de propietario en el local indicado.
- Una empresa no puede leer ni modificar capacidades de otra empresa.
- La ausencia de una fila significa denegación; no se crean permisos implícitos para claves nuevas.
- La migración no se ha aplicado a QA ni producción en este subpunto. Debe pasar revisión y QA antes de cualquier aplicación.

## Límites

Esta migración persiste únicamente capacidades de **consulta**. No concede acciones de crear, editar, exportar, eliminar/anular, aprobar o configurar; esas capacidades pertenecen al punto 5. Tampoco sustituye la autorización de datos del punto 7.
