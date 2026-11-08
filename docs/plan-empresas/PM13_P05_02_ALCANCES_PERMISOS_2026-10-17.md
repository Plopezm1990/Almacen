# PM13 · Punto 5.2 — Alcances de los permisos

Fecha: 2026-10-17  
Rama: `codex/fix-product-bootstrap-context-20261015`  
Alcance: definición técnica para revisión. Este documento no cambia RLS, RPC, cargos ni datos.

## Regla de resolución

El alcance se resuelve en este orden:

1. **Empresa (`EMPRESA`)**: el registro pertenece a una empresa concreta y nunca puede aparecer por aportar solo un `local_id` válido de otra empresa.
2. **Local (`LOCAL`)**: el registro pertenece a una pareja `(empresa_id, local_id)`. El local seleccionado en el navegador no sustituye la comprobación de pertenencia en el servidor.
3. **Propio (`PROPIO`)**: el registro pertenece al trabajador autenticado, resuelto por la relación servidor `auth.uid() → perfil/membresía → empleado`; no se basa en un `empleado_id` que el cliente pueda afirmar.
4. **Denegar por defecto**: si falta el alcance, el registro es compartido de forma ambigua, la membresía está inactiva o la empresa/local no coincide, la acción se rechaza.

## Significado de “propio” por entidad

| Entidad | Titular verificable | “Propio” significa | Regla propuesta |
|---|---|---|---|
| Fichaje automático | Empleado autenticado enlazado a `auth.uid()` | El fichaje del propio empleado | Permitir fichar al propio empleado activo; la corrección y anulación requieren permiso de gestión del local. |
| Fichaje manual/corrección | Empleado afectado + actor gestor | No es propio solo porque el actor envíe su `empleado_id` | El servidor verifica el empleado y el local; el gestor actúa en alcance local. |
| Ausencia/vacaciones | Empleado afectado, empresa y local | La ausencia de esa persona | Registrar/anular se gobierna por el local; conservar el histórico del empleado aunque cambie de estado. |
| Empleado | Empresa + local de la fila | No se convierte en propio por conocer el ID | Alta, edición, baja y reactivación son acciones de gestión local autorizada. |
| Cargo personalizado | Empresa propietaria del cargo | No tiene titular individual | El catálogo es de empresa; la asignación a una persona siempre añade local y empleado. |
| Asignación de cargo | Empresa + local + empleado | No es una preferencia personal del navegador | La asignación solo existe si empleado, local y cargo pertenecen a la misma empresa. |
| Pantalla/capacidad de cargo | Empresa + cargo | No depende del nombre del cargo ni del usuario que la ve | La selección se guarda por empresa y cargo; leerla o modificarla exige autorización de propietario en un local válido. |
| Venta, cuenta, pedido y comanda | Empresa + local del registro | “Propio” no está demostrado por `created_by` en todos los flujos | Hasta que cada entidad tenga titular definido, usar alcance local y denegar consultas cruzadas. |
| Caja, arqueo y diferencia | Empresa + local + sesión de caja | La sesión/operación del local, no la cuenta del navegador | Mutaciones y decisiones se limitan al local y a la sesión/operación relacionada. |
| Producto y stock | Empresa + local o catálogo de empresa según entidad | No asumir que un producto global permite stock global | Separar catálogo de empresa de existencias/movimientos de local; traspasos requieren origen y destino autorizados. |
| Factura, pago y documento fiscal | Empresa + local/documento | No es propio por ser creador del documento | Mantener el alcance del documento y sus estados; reversos/anulaciones necesitan permiso específico. |
| Encargo, pago y devolución | Empresa + local + encargo | No es propio por ser cliente o actor que inició el pago | Respetar titular del encargo, estado y local de origen; reembolsos/aprobaciones son acciones separadas. |
| Auditoría | Empresa + local del evento + actor | El actor solo es autor del evento, no dueño de todos los datos | Consultar únicamente el ámbito autorizado; no permitir editar ni borrar trazas. |

## Matriz de alcance inicial

| Recurso | `PROPIO` | `LOCAL` | `EMPRESA` | Estado de la evidencia |
|---|---:|---:|---:|---|
| Fichaje automático | Sí, para el empleado autenticado | Sí, para gestión | No por defecto | `pm13_fichar` comprueba `auth.uid()`, empleado, empresa y local. |
| Fichaje manual/corrección/anulación | No por defecto | Sí | No por defecto | Las RPC exigen empleado y local; falta convertir la matriz de cargo en decisión efectiva. |
| Personal y ausencias | No por defecto | Sí | Solo lectura agregada si se aprueba | `pm11_*` y `pm13_*` validan empresa/local y rechazan `TODOS`. |
| Cargos personalizados | No | Lectura/escritura desde local autorizado | Sí, catálogo de empresa | `abc_cargos.empresa_id`; las operaciones usan un local activo como contexto de autorización. |
| Asignaciones | No | Sí | No | La clave incluye `empresa_id`, `local_id`, `empleado_id` y `cargo_id`. |
| Pantallas por cargo | No | Contexto de lectura/escritura | Sí, por cargo | `abc_cargo_pantallas` se almacena por empresa/cargo; no concede acciones de datos. |
| Operaciones de venta/caja/stock | No definido de forma uniforme | Sí | Solo cuando la operación lo permita explícitamente | Hay RPC con validación local; falta mapa completo recurso–alcance. |
| Configuración y permisos | No | Configuración del local | Configuración empresa si el propietario controla todos los locales | `abc_config_puede_configurar_empresa` ya distingue ambos casos. |
| Empresas/locales/membresías | No | No | Sí, ámbito de plataforma/empresa | No pertenece al permiso ordinario de un cargo de local. |
| Auditoría | No | Sí | Sí para propietario autorizado | La lectura debe mantener el tenant y no exponer secretos. |

## Registros compartidos e históricos

- Un registro conserva su `empresa_id` y, cuando corresponda, su `local_id` de origen; cambiar el local activo no lo mueve ni amplía el acceso.
- Un documento compartido entre locales debe tener una relación explícita (por ejemplo, origen/destino o empresa propietaria). Sin esa relación, se considera ambiguo y se deniega.
- Los registros históricos siguen siendo visibles solo dentro del alcance autorizado; “histórico” no significa “visible para todos los locales”.
- Las anulaciones, reversiones y desactivaciones son nuevas decisiones auditables; no deben borrar la titularidad ni reabrir automáticamente un permiso.
- Los agregados y exportaciones deben aplicar el mismo alcance que el detalle. No basta con filtrar la lista visible.

## Hallazgos y decisiones pendientes

1. El servidor ya valida empresa/local en Personal, Fichajes, Ausencias y Cargos; esa validación es evidencia de aislamiento, no todavía una matriz de permisos de cargos personalizados.
2. `PROPIO` es aplicable con claridad a fichaje automático; no debe generalizarse a ventas, documentos o caja sin identificar el titular real de cada entidad.
3. La configuración a nivel empresa exige comprobar que el propietario tiene autoridad sobre todos los locales, no solo sobre el local seleccionado.
4. Queda pendiente decidir si los informes agregados de empresa pueden incluir datos de todos sus locales y qué excepciones se permiten para registros compartidos.
5. Queda pendiente resolver cómo se comportan empleados con varios locales si el modelo futuro lo admite; el esquema actual de `empleados` y las asignaciones PM13 trabajan con `local_id` concreto.

## Estado del subpunto

**5.2 — definición técnica de alcances completada, pendiente de aprobación de las decisiones de negocio indicadas.** No se han cambiado permisos, tablas, RPC, datos, QA, producción ni despliegues.

Siguiente subpunto, solo con autorización: **5.3 — acordar dependencias entre permisos y hacerlas explícitas.**
