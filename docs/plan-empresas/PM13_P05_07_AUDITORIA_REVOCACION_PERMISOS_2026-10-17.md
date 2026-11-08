# PM13 · Punto 5.7 — Auditoría, explicación y revocación de permisos

Fecha: 2026-10-17
Rama: `codex/fix-product-bootstrap-context-20261015`
Alcance: contrato de trazabilidad y revocación. No se han cambiado permisos, RPC, RLS, datos ni despliegues.

## Objetivo

Toda decisión de autorización debe poder responder a tres preguntas: quién decidió, qué cambió y por qué la acción fue permitida o denegada. Revocar debe cortar el acceso futuro sin borrar la historia de cómo se concedió.

## Evidencia existente

| Flujo | Evidencia actual | Cobertura |
|---|---|---|
| Cargos y asignaciones PM13 | `private.pm13_cargo_auditar` registra actor, empresa, local, acción y detalle en `auditoria_registro`. | Alta de cargo, edición, duplicado, asignación, desasignación y estado. |
| Pantallas por cargo | `abc_guardar_cargo_pantallas` registra capacidades anteriores y posteriores, cargo, operación y momento. | Cubre las consultas `*_CONSULTAR`, no las acciones operativas futuras. |
| Capacidades de rol ABC | `abc_configurar_capacidad_rol` conserva versión, motivo, valor anterior/nuevo y resultado efectivo antes/después en `abc_eventos`. | Cubre decisiones técnicas por empresa/local. |
| Operaciones ABC | Las RPC usan `operation_id` y eventos de operación para evitar duplicados y dejar resultado/fallo. | Debe reutilizarse en el futuro resolver de cargos. |

Esta evidencia permite auditar decisiones existentes, pero todavía no existe un registro único que explique una decisión efectiva de un cargo personalizado para una acción operativa.

## Registro mínimo de una decisión

Cada cambio de permiso debería registrar, sin almacenar secretos:

| Campo | Contenido |
|---|---|
| Identidad | `actor_user_id`, fecha/hora y sesión/operación. |
| Contexto | `empresa_id`, `local_id` y, si aplica, `cargo_id` y `empleado_id` pseudonimizados en la vista. |
| Decisión | clave estable, acción, alcance, permitido/denegado y versión. |
| Resolución | fuente (`cargo`, `rol_local`, `rol_empresa`, `plantilla`, `excepción`), techo aplicado y dependencias evaluadas. |
| Cambio | valor anterior, valor nuevo, motivo obligatorio y vigencia. |
| Resultado | evento de configuración, revocación, conflicto o rechazo, con `operation_id` idempotente. |

La auditoría debe ser append-only desde la perspectiva del usuario. Una corrección se registra como otro evento; no se edita ni se borra el evento anterior para ocultar una concesión.

## Explicación segura al usuario

La aplicación puede mostrar una explicación breve y no sensible:

- **Permitido**: “Permitido por el cargo X en el local Y; alcance LOCAL; versión N”.
- **Denegado por rol**: “El rol técnico no permite esta acción”.
- **Denegado por alcance**: “El registro no pertenece al ámbito autorizado”.
- **Denegado por dependencia**: “Falta consultar el recurso o completar la fase previa”.
- **Denegado por estado**: “La operación no está en un estado modificable”.
- **Denegado por contexto**: “No hay autorización para este contexto”.

La respuesta no debe revelar si existe un empleado, cargo, empresa o registro de otra empresa. Los detalles internos (IDs, reglas y trazas) quedan reservados para la auditoría autorizada.

## Revocación trazable

1. La revocación se expresa como una decisión explícita `permitido = false`, desactivación de la asignación o cierre de la vigencia; nunca como borrado físico del historial.
2. El servidor debe aplicar la revocación en la siguiente comprobación, aunque el navegador conserve una pantalla o caché antigua.
3. Las sesiones abiertas no mantienen un permiso revocado: cada mutación sensible vuelve a resolver membresía, cargo, alcance y versión.
4. Las acciones ya completadas no se reescriben; si procede corregirlas, se usa anulación o reverso propio del flujo y se audita.
5. Reactivar requiere una nueva decisión autorizada, con nuevo motivo y nueva versión; no se restaura silenciosamente el valor anterior.
6. Las operaciones en curso que detecten una versión anterior deben fallar con conflicto seguro y no aplicar un estado perdido.

## Revocaciones por dependencia

| Revocación | Efecto obligatorio |
|---|---|
| Quitar `CONSULTAR` | Deniega las acciones que dependan de esa consulta. |
| Desactivar cargo | Ninguna asignación futura puede usarlo; las asignaciones activas deben resolverse como no autorizadas sin borrar su histórico. |
| Desactivar membresía/local/empresa | Revoca inmediatamente el acceso de ese contexto. |
| Desactivar módulo | Deniega sus claves aunque permanezcan registradas para explicación histórica. |
| Bajar el techo del rol | Los cargos que lo superen dejan de ser efectivos hasta que se ajusten; no se borra la configuración original. |
| Caducar excepción | Vuelve a aplicar la resolución normal y registra el fin de vigencia. |

## Reglas de auditoría y privacidad

- No guardar contraseñas, tokens, datos completos de tarjetas ni secretos en el evento.
- Separar `actor_user_id` del empleado afectado: quien decide no siempre es quien recibe el permiso.
- Mantener empresa y local en el evento para evitar auditorías cruzadas.
- Permitir consulta de auditoría solo al ámbito autorizado y con filtros de tenant en servidor.
- Registrar rechazos de seguridad sin convertirlos en una fuente para enumerar usuarios o cargos.
- Correlacionar el evento de configuración con el `operation_id` de la petición y con el resultado efectivo.

## Hueco de implementación

Los flujos actuales ya auditan varias operaciones de cargos, pantallas y roles técnicos. Falta un contrato común de explicación y revocación para acciones de cargos personalizados, además de pruebas de concurrencia, expiración y revocación mientras una sesión está abierta. Este subpunto no aplica una migración ni cambia el comportamiento efectivo.

## Estado del subpunto

**5.7 — auditoría, explicación y revocación trazable documentadas.** No se han cambiado permisos, tablas, RPC, datos, QA, producción ni despliegues.

Siguiente subpunto, solo con autorización: **5.8 — preparar la matriz final de pruebas y criterios de aceptación del punto 5.**
