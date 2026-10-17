# PM13 · Punto 5.6 — Resolución efectiva y precedencia de permisos

Fecha: 2026-10-17
Rama: `codex/fix-product-bootstrap-context-20261015`
Alcance: contrato de resolución. No se han cambiado resolvers, RLS, RPC, permisos, datos ni despliegues.

## Objetivo

Definir un único orden de evaluación para evitar que un cargo personalizado, un rol técnico o una excepción amplíen por accidente la autoridad del actor. La decisión final debe ser reproducible en servidor y explicable en auditoría.

## Orden de resolución

La autorización efectiva se obtiene aplicando estas barreras, en este orden:

1. **Sesión y contexto**: `auth.uid()` válido, empresa y local existentes, pertenencia del actor, membresía activa y relación correcta del registro.
2. **Catálogo y módulo**: clave conocida, acción compatible con el recurso y módulo contratado/activo. Una clave desconocida se deniega.
3. **Barreras no delegables**: protección del propietario, integridad histórica, estado del registro, segregación de aprobación y cualquier bloqueo legal/fiscal.
4. **Techo técnico**: el rol técnico de la membresía (`Propietario`, `Encargado`, `Cajero/a` o `Camarero/a`) fija el máximo que se puede conceder.
5. **Cargo personalizado**: si existe una asignación activa para el `(empresa_id, local_id, empleado_id)`, sus decisiones se intersectan con el techo técnico; nunca lo superan.
6. **Alcance**: la acción debe cubrir el registro solicitado. `PROPIO` no satisface `LOCAL`; `LOCAL` no satisface `EMPRESA`.
7. **Dependencias y estado**: se comprueba `CONSULTAR`, la fase de la operación, la aprobación previa y cualquier dependencia declarada.
8. **Resultado por defecto**: si falta una decisión, hay ambigüedad o un conflicto no resuelto, se deniega.

En forma compacta:

```text
permitido = contexto válido
         ∧ catálogo/módulo válido
         ∧ barreras no delegables satisfechas
         ∧ techo técnico permitido
         ∧ cargo permite la acción
         ∧ alcance cubre el registro
         ∧ dependencias y estado satisfechos
```

## Precedencia entre fuentes

| Fuente | Precedencia | Regla |
|---|---:|---|
| Denegación de contexto/tenant | 1 (máxima) | No se puede compensar con ningún permiso. |
| Protección del propietario e integridad | 2 | Queda fuera del editor de cargos y no se puede conceder por configuración ordinaria. |
| Techo del rol técnico | 3 | Un cargo no puede elevarlo; un `false` del techo siempre deniega. |
| Decisión explícita del cargo | 4 | Solo opera dentro del techo y del catálogo; una denegación explícita prevalece sobre una concesión del cargo. |
| Excepción de alcance | 5 | Solo puede estrechar el alcance; no convierte `LOCAL` en `EMPRESA`. |
| Plantilla por defecto | 6 | Se usa únicamente si no hay decisión explícita y el catálogo la permite. |
| Ausencia de fila | 7 | Denegación por defecto, nunca autorización implícita. |

## Precedencia de empresa frente a local

Para las decisiones configurables del rol técnico se conserva el comportamiento existente:

- Una decisión explícita del local prevalece sobre una decisión explícita de empresa.
- Si no hay decisión local, se consulta la decisión de empresa.
- Si tampoco existe, se usa la plantilla del catálogo.
- `permitido = false` es una revocación explícita; no equivale a “heredar”.
- `permitido = null` representa herencia únicamente en la tabla técnica donde está permitido.

Para cargos personalizados, la asignación sigue siendo local por diseño. Una concesión almacenada para un cargo de la empresa no se aplica a una persona/local sin asignación activa y contexto válido.

## Conflictos entre rol técnico y cargo

La regla segura es la intersección, no la suma:

| Rol técnico | Cargo personalizado | Resultado |
|---|---|---|
| Permite | Permite | Permitir solo si también pasan alcance, dependencias y estado. |
| Permite | Deniega explícitamente | Denegar. |
| Deniega por techo | Permite | Denegar por techo. |
| Sin decisión | Sin decisión | Usar plantilla técnica; si no autoriza, denegar. |
| Propietario protegido | Cualquier cargo | No aplicar el cargo como elevación ni sustituir la protección del propietario. |
| Membresía inactiva o sin local | Cualquier cargo | Denegar sin consultar datos del cargo. |

## Excepciones

Una excepción futura debe ser una decisión registrada, con clave estable, actor autorizado, motivo, inicio, caducidad y alcance limitado. No puede:

- cambiar el rol técnico o convertir un cargo en propietario;
- omitir la comprobación de empresa, local, módulo o estado;
- conceder un alcance más amplio que el techo del actor;
- sobrevivir a la desactivación de la membresía, cargo, módulo o registro;
- sustituir una aprobación obligatoria por una simple consulta;
- ocultarse como una bandera local del navegador.

Si dos excepciones se contradicen, gana la denegación más específica y, a igualdad de especificidad, la decisión más reciente y vigente; si la vigencia no puede probarse, se deniega.

## Ejemplos de resolución

| Solicitud | Evaluación | Resultado |
|---|---|---|
| Camarero/a con cargo que permite ver Personal | Contexto válido, consulta incluida, alcance local | Puede consultar solo el local autorizado. |
| Camarero/a con cargo que intenta editar un empleado | Falta acción `EDITAR`/techo de rol | Denegar. |
| Encargado con permiso local y petición sobre otro local | Contexto/alcance no coinciden | Denegar. |
| Cargo permite exportar, pero el catálogo no define esa exportación | Clave/acción no catalogada | Denegar. |
| Cargo permite reabrir caja, pero el techo técnico no lo permite | Techo vence a la concesión | Denegar. |
| Permiso de consulta revocado y acción de editar aún almacenada | Falta dependencia `CONSULTAR` | Denegar y mantener la trazabilidad. |
| Propietario con acceso a todos los locales configura empresa | Contexto y autoridad empresa válidos | Permitir según catálogo, motivo y auditoría. |

## Evidencia actual y hueco

`private.abc_cap_efectiva` ya resuelve el rol técnico con prioridad local → empresa → plantilla y aplica el techo. `private.abc_tiene_capacidad` comprueba sesión, empresa, local y membresía antes de consultar esa resolución. Las tablas de cargos y pantallas guardan catálogo/asignación, pero todavía no conectan el cargo personalizado con acciones operativas ni con el resolver común.

Por tanto, este subpunto fija la precedencia que deberá implementar el futuro resolver; no afirma que esa conexión ya exista en producción o QA.

## Estado del subpunto

**5.6 — orden de resolución y precedencia documentados.** No se han cambiado resolvers, tablas, RPC, permisos, datos, QA, producción ni despliegues.

Siguiente subpunto, solo con autorización: **5.7 — definir auditoría, explicación de decisiones y revocación trazable.**
