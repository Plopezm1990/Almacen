# F2.1 — contrato de base transaccional

Fecha: 2026-10-01  
Estado: `CANDIDATO_DOCUMENTAL_NO_APLICADO`  
Base: F1.6 y `origin/release` `7859508`

Este contrato prepara F2 sin ejecutar SQL remoto. La migración candidata se
creará solo después de revisar alcance, dependencias, seguridad, pruebas y
reversión.

## Alcance mínimo

- Operaciones indivisibles usan transacción y validan empresa/local antes de
  devolver incluso un resultado repetido.
- Cada entidad económica conserva identificador estable: pedido, línea,
  intento, pago, documento y operación.
- `operation_id` es idempotente; el mismo identificador con otro contenido
  devuelve conflicto.
- Precio, impuestos, descuentos, saldo y permisos se validan en servidor.
- El resultado externo desconocido conserva reserva, consulta e incidencia; no
  se libera por un timeout simple ni se repite un cargo ciego.
- Los efectos pendientes de cobro, impresión o documento tendrán referencia,
  intentos limitados, último error, consulta y recuperación supervisada.

## Frontera Supabase

- Toda tabla nueva en `public` debe tener RLS activado y políticas ajustadas al
  contexto real de empresa/local; `TO authenticated` por sí solo no autoriza
  acceso a filas.
- Las políticas de `UPDATE` deben incluir `USING` y `WITH CHECK` cuando proceda.
- No se usa `user_metadata` para decidir autorización; los datos de permisos
  deben proceder del modelo seguro del proyecto.
- No se expone `service_role` ni una clave secreta en el cliente.
- Las vistas nuevas deben valorar `security_invoker = true` o quedar fuera de
  esquemas expuestos.
- No se crean objetos personalizados en `auth`, `storage` ni `realtime`.
- La exposición de tablas al Data API se comprobará de forma explícita; no se
  asume que una tabla nueva queda publicada automáticamente.

Referencia de cambios recientes de plataforma: [Supabase Changelog — breaking
changes](https://supabase.com/changelog?types=breaking-change).

## Orden de una operación protegida

1. Identificar usuario, empresa, local y `operation_id`.
2. Comprobar autorización y estado previo.
3. Bloquear o versionar las filas en orden estable.
4. Validar importes, contexto, dependencias e idempotencia.
5. Escribir hechos y auditoría dentro de la transacción.
6. Registrar el efecto externo pendiente, si aplica.
7. Confirmar una sola vez y devolver el resultado trazable.

Un fallo en cualquier paso revierte la operación interna y conserva una
incidencia consultable cuando exista dependencia externa.

## Dependencias a revisar antes de migrar

| Dependencia | Comprobación | Estado |
|---|---|---|
| Tablas base de release | nombres, columnas, índices y ACL | `PENDIENTE` |
| RLS y políticas | lectura, escritura y contexto | `PENDIENTE` |
| RPC existentes | firma, permisos y efectos | `PENDIENTE` |
| Migraciones previas | orden y hash del candidato | `PENDIENTE` |
| Data API | exposición y grants explícitos | `PENDIENTE` |
| Rollback | procedimiento aditivo/compensatorio | `PENDIENTE` |
| PostgreSQL local | versión y extensiones permitidas | `PENDIENTE` |

## Puerta de aplicación

Antes de crear o aplicar una migración se exigirá:

- revisión de seguridad/RLS y advisors de Supabase;
- prueba local con base UTF-8 desechable y datos ficticios;
- comparación de dependencias y hash del candidato;
- plan de recuperación que no borre hechos externos;
- autorización separada para QA o PROD.

En esta entrega no se crea migration SQL, no se usa `db push`, no se conecta a
QA/PROD y no se hace deploy de Netlify.

## Resultado de F2.1

El contrato transaccional queda preparado para revisión. La siguiente tarea es
inventariar dependencias reales de `origin/release` y diseñar la migración
candidata, sin aplicarla.
