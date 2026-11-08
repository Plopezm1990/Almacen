# PM13 · Punto 5.5 — Persistencia de permisos con claves, acción y alcance

Fecha: 2026-10-17
Rama: `codex/fix-product-bootstrap-context-20261015`
Alcance: contrato de persistencia y resolución. No se han aplicado migraciones ni se han modificado permisos, RPC, datos o despliegues.

## Objetivo

Persistir cada decisión de autorización con identificadores estables y separables: una clave técnica de capacidad, la acción que se pretende ejecutar y el alcance de los datos. El nombre visible de una pantalla o cargo nunca sustituye a estos tres valores.

## Claves estables

Las claves son valores técnicos versionables, en mayúsculas y con prefijo de dominio:

| Familia | Formato | Ejemplo | Significado |
|---|---|---|---|
| Capacidad operativa | `ABC_<RECURSO>_<ACCION>` | `ABC_CIERRE_REABRIR` | Autoriza una operación concreta; debe comprobar estado, empresa y local antes de mutar. |
| Pantalla consultable | `ABC_PANTALLA_<RECURSO>_CONSULTAR` | `ABC_PANTALLA_PERSONAL_CONSULTAR` | Autoriza a ver/leer la pantalla; no concede crear, editar, exportar ni aprobar. |
| Acción PM13 | `PM13_<RECURSO>_<ACCION>` | `PM13_FICHAJE_MANUAL` | Identifica una RPC o decisión específica de empleados, fichajes o ausencias. |

Reglas de las claves:

- Se comparan por valor exacto normalizado; no por texto de UI, etiqueta traducida o posición de un botón.
- Una clave desconocida o retirada se rechaza, aunque llegue en una petición autenticada.
- Renombrar una pantalla, cargo o descripción no cambia la clave histórica.
- No se reutiliza una clave para una acción de mayor riesgo ni para otro recurso.
- La activación de un módulo no convierte automáticamente una clave consultable en una clave operativa.

## Dimensiones persistidas

Cada permiso futuro debe poder resolverse con, como mínimo, estas dimensiones:

| Dimensión | Valores/regla | Motivo |
|---|---|---|
| Empresa | `empresa_id` obligatorio | Impide que un UUID o nombre válido de otra empresa cruce el tenant. |
| Cargo | `cargo_id` obligatorio para cargos personalizados | El nombre puede cambiar; el identificador interno permanece estable. |
| Clave | `clave` o `capacidad` del catálogo | Enlaza la decisión con una definición técnica, no con la UI. |
| Acción | `CONSULTAR`, `CREAR`, `EDITAR`, `EXPORTAR`, `ANULAR_ELIMINAR`, `APROBAR`, `CONFIGURAR` | Separa ver de ejecutar y solicitud de aprobación. |
| Alcance | `PROPIO`, `LOCAL`, `EMPRESA` | Limita qué filas puede afectar la acción. `PROPIO` requiere resolver el empleado desde `auth.uid()`. |
| Decisión | permitir/denegar/heredar | La ausencia no debe significar autorización; la herencia debe ser explícita. |
| Versión y motivo | `version`, actor, fecha y motivo | Permite concurrencia optimista, trazabilidad y explicación de cambios. |

La combinación lógica recomendada para una decisión es `(empresa_id, cargo_id, clave, acción, alcance)`. Si se permite una decisión a nivel empresa o local, el alcance se guarda explícitamente; no se codifica con un `local_id` omitido sin indicar qué significa.

## Evidencia de lo que ya existe

| Componente actual | Qué persiste | Límite actual |
|---|---|---|
| `abc_cargos` | Catálogo estable por `empresa_id` y `id` UUID | No contiene permisos ni acciones. |
| `abc_cargo_asignaciones` | Cargo activo/histórico por empresa, local y empleado | Vincula la persona al cargo, pero no resuelve capacidades. |
| `abc_cargo_pantallas` | `empresa_id`, `cargo_id` y `capacidad_consulta` única | Solo cubre consultas de pantalla; no guarda acción ni alcance explícitos. |
| `abc_capacidades_rol` | Rol técnico, capacidad ABC, ámbito empresa/local, decisión, versión y motivo | Es para roles técnicos (`Encargado`, `Cajero/a`, `Camarero/a`), no para cargos personalizados. |
| Catálogos privados ABC/PM13 | Claves permitidas y techos | La clave debe estar en catálogo; no existe autorización por compatibilidad. |

La evidencia confirma que la base ya tiene piezas separadas y seguras para catálogo, asignación, pantallas consultables y roles técnicos. No confirma todavía la persistencia completa de acciones y alcances para cargos personalizados.

## Resolución obligatoria

1. Autenticar al actor y comprobar membresía activa, empresa y local antes de leer o escribir una decisión.
2. Resolver el cargo activo de la persona para ese `(empresa_id, local_id)`; una asignación de otro local no aplica.
3. Validar que la `clave` y la `acción` pertenecen al mismo catálogo y que el módulo está activo.
4. Resolver el alcance de los datos; para `PROPIO`, derivar el empleado del actor en servidor y no confiar en un `empleado_id` enviado por el cliente.
5. Aplicar el techo de la capacidad y la regla más restrictiva entre cargo, rol técnico, módulo, estado e integridad.
6. Denegar por defecto si no existe una fila, si la decisión está caducada/inactiva o si hay ambigüedad de empresa/local.
7. Registrar antes y después, versión, motivo y actor en una auditoría inmutable.

## Reglas de idempotencia y concurrencia

- Las escrituras deben recibir `operation_id` estable y ser idempotentes.
- Una repetición de la misma operación devuelve el resultado previo; no duplica permisos ni eventos.
- La actualización debe comparar `version` o usar bloqueo transaccional; una respuesta antigua no puede sobrescribir una decisión posterior.
- Revocar una capacidad crea una decisión explícita o una versión posterior; no se borra el histórico para ocultar el cambio.
- La eliminación lógica de un cargo o módulo deja sus decisiones trazables y no las reactiva por una recarga del cliente.

## Casos de rechazo

| Petición | Resultado obligatorio |
|---|---|
| Clave de pantalla usada como acción de crear/editar | Rechazar: consultar no concede mutación. |
| Acción válida con alcance no permitido por el catálogo | Rechazar por techo/alcance. |
| `PROPIO` con empleado indicado que no coincide con `auth.uid()` | Rechazar sin revelar datos de otra persona. |
| Cargo de una empresa aplicado a un local ajeno | Rechazar por tenant y pertenencia. |
| Permiso sin `empresa_id`, clave o acción | Rechazar por contrato incompleto. |
| Clave desconocida o módulo inactivo | Rechazar por catálogo. |
| Dos cambios con la misma versión | Aceptar solo uno; el otro debe devolver conflicto sin perder el estado ganador. |

## Hueco de implementación

El punto 4 ya persiste claves de consulta por cargo y el ABC técnico persiste decisiones por rol y alcance local/empresa. Falta un contrato único que relacione cargos personalizados con acciones operativas y alcance explícito, manteniendo compatibilidad hacia atrás con las pantallas consultables. Ese trabajo requiere una migración y pruebas de servidor separadas; no se realiza en este subpunto.

## Estado del subpunto

**5.5 — contrato de persistencia de claves, acciones y alcances documentado.** No se han aplicado migraciones, ni se han cambiado permisos, RPC, datos, QA, producción o despliegues.

Siguiente subpunto, solo con autorización: **5.6 — definir la resolución efectiva y la precedencia entre cargo, rol técnico, alcance y excepciones.**
