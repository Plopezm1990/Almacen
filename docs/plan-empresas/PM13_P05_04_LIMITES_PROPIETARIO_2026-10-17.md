# PM13 · Punto 5.4 — Límites del propietario y facultades no delegables

Fecha: 2026-10-17  
Rama: `codex/fix-product-bootstrap-context-20261015`  
Alcance: inventario de barreras y contrato de diseño. No se han cambiado permisos, RPC, RLS ni datos.

## Principio

Un cargo personalizado puede recibir capacidades funcionales, pero nunca puede convertirse en un rol técnico protegido ni superar las barreras de empresa, membresía, módulo, integridad o auditoría. El nombre visible del cargo no es una autoridad.

## Facultades no delegables

| Facultad | Regla no delegable | Evidencia actual |
|---|---|---|
| Identidad de Propietario | Una cuenta/membresía Propietario no puede recibir un cargo personalizado ni perder su protección por una asignación ordinaria. | `pm13_cargo_guard_propietario` rechaza asignaciones a una cuenta propietaria y no modifica perfiles ni membresías. |
| Nombre de rol protegido | Un cargo libre no puede llamarse `Propietario`, `Encargado`, `Cajero/a`, `Camarero/a`, `Churrero/a`, `Básico` o `Estándar`. | `pm13_cargo_guard_nombre` rechaza nombres normalizados reservados. |
| Último propietario válido | Ninguna operación de cargos puede dejar la empresa sin un propietario activo y autorizado. | El contrato de protección separa cargos de perfiles/membresías; cualquier operación futura debe comprobar el último propietario en servidor. |
| Configuración de empresa | Cambiar permisos para toda la empresa requiere una membresía Propietario activa con todos los locales. | `abc_config_puede_configurar_empresa` exige `todos_locales = true`, `local_id is null` y rol Propietario. |
| Techo de capacidades | El editor no puede dar a un rol una capacidad por encima de su techo técnico, aunque el propietario la solicite. | `abc_cap_techo_permite` y `abc_tiene_capacidad` aplican el techo; la UI muestra el bloqueo. |
| Membresía y empresa | Ningún cargo puede saltarse una membresía inactiva, una empresa distinta o un local no autorizado. | Las RPC PM13 y ABC validan sesión, empresa, local y pertenencia antes de mutar. |
| Módulo contratado | Un permiso no puede activar una pantalla o servicio no contratado/inactivo. | El catálogo de pantallas rechaza claves de módulos inactivos; las acciones deben conservar la misma barrera. |
| Integridad e histórico | Un cargo no puede borrar físicamente fichajes, auditoría, documentos fiscales o movimientos para conseguir un estado permitido. | PM13 conserva anulaciones e historial; los flujos financieros usan reversos/estados. |

## Capacidades delegables con techo

No son facultades exclusivas del propietario en todos los casos, pero sí están limitadas por el catálogo y por el estado de la operación:

- Operación de cuentas, pedidos, sala y preparación puede llegar a Encargado, Cajero/a o Camarero/a según la capacidad concreta.
- Devoluciones, cobros inciertos, cancelaciones sensibles, documentos fiscales y reapertura de cierres tienen techo de Encargado o Propietario; no deben darse a Cajero/a o Camarero/a si el catálogo lo impide.
- Aprobaciones financieras y diferencias de caja conservan el aprobador exigido por el flujo, aunque el cargo tenga permiso de consultar.
- `Propietario` mantiene las capacidades de su plantilla; no se configura como un cargo libre ni se le aplica el editor ordinario.

## Reglas de resolución obligatorias

1. Resolver primero actor autenticado, membresía activa, empresa, local y módulo; después cargo, excepción y capacidad.
2. Aplicar el límite más restrictivo: protección del propietario, techo de rol, alcance de datos, estado del registro y regla de negocio.
3. No permitir que un cargo personalizado conceda `EMPRESA` si el actor solo tiene autoridad `LOCAL`.
4. No permitir que una pantalla o capacidad de consulta desbloquee por sí sola una acción sensible.
5. Rechazar una petición que intente cambiar el propio rol técnico, asignar un cargo reservado o modificar una membresía propietaria.
6. Registrar actor, empresa, local, cargo, capacidad, decisión y motivo en cada cambio de configuración.
7. Devolver errores claros sin revelar si existe un usuario, empleado o registro de otra empresa.

## Casos que deben quedar bloqueados

| Intento | Resultado obligatorio |
|---|---|
| Crear cargo llamado `Propietario` | Rechazar por nombre reservado. |
| Asignar cargo personalizado a una cuenta Propietario | Rechazar sin modificar perfil ni membresía. |
| Dar a un cargo una capacidad por encima de su techo | Rechazar y dejar la configuración anterior. |
| Configurar toda la empresa desde un propietario de un solo local | Rechazar; solo permitir ámbito local. |
| Dar permiso sobre una empresa/local ajeno | Rechazar por contexto, aunque el ID sea válido. |
| Usar una clave de pantalla o acción desconocida | Rechazar por catálogo; no activar por compatibilidad. |
| Desactivar el único propietario activo | Bloquear y exigir una transición controlada. |
| Borrar un registro histórico para ocultar una acción | Rechazar; usar anulación/reverso trazable cuando proceda. |

## Hueco que queda para la implementación

La protección de nombres, asignaciones y techos ya está preparada en el modelo ABC/PM13. Todavía falta conectar estas barreras al futuro resolver de acciones de cargos personalizados y cubrir con pruebas las transiciones de último propietario, revocación y concurrencia. Este subpunto no autoriza a aplicar una migración ni a modificar el catálogo actual.

## Estado del subpunto

**5.4 — límites del propietario y facultades no delegables documentados; el contrato queda listo para revisión antes de implementar.** No se han cambiado permisos, tablas, RPC, datos, QA, producción ni despliegues.

Siguiente subpunto, solo con autorización: **5.5 — persistir permisos con claves estables, acción y alcance.**
