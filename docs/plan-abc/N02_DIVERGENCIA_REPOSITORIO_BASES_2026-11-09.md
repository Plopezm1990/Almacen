# N-02 — Divergencia entre repositorio y bases desplegadas

Fecha de corte: 2026-11-09  
Producción: `flqercbgpgmmfaakrwkc` («L&A Suite»)  
QA: `qjqorixtkilwsndqayyx` («L&A Suite QA»)  
Rama de auditoría: `codex/fase3-a03-a04`  
`origin/release`: `29354efead2e5e860d9e2d24d4199675e5eb0beb`

## Alcance y criterio

N-02 pregunta si las bases desplegadas pueden reconstruirse desde la fuente versionada. El criterio de aceptación del documento de pendientes es: todo objeto relevante debe existir en una migración versionada y una comparación entre el esquema desplegado y el repositorio no debe dejar diferencias sin explicar.

Este documento no certifica la paridad completa de todos los objetos de las bases. Recoge la revalidación de las divergencias ya identificadas, la migración candidata de reconciliación y sus límites.

## Resultado resumido

| Comprobación | Resultado | Clasificación |
|---|---|---|
| Migración N-02 registrada en QA | Sí, con nombre `20261108193000_n02_reconcile_deployed_db_functions`, aplicada con versión de historial `20261109144148` | Medido en QA |
| Migración N-02 registrada en producción | No aparece en `supabase_migrations.schema_migrations` | Medido en producción |
| `private.la_usuario_activo()` | Cuerpo ejecutable equivalente al canónico en QA y producción; misma huella `prosrc` | Medido y comparado |
| `public.obtener_contexto_operativo(text)` | Cuerpo equivalente al canónico al normalizar espacios y comentarios de línea; ACL distinta en QA por `service_role` adicional | Medido y comparado |
| `public.bootstrap_owner_instalacion(text,text)` | QA coincide con el bloque canónico; producción conserva otra procedencia textual, aunque el código sin comentarios de línea y espacios coincide con QA | Medido y comparado |
| Guarda manual `contexto_empleado_vinculado_no_operativo` | No aparece en la definición actual de QA ni producción | Medido hoy; corrige evidencia histórica |
| Producción modificada durante esta fase | No | Observado y mantenido |

La conclusión actual es **paridad funcional acotada para las tres funciones, pero no paridad de procedencia ni de historial de migraciones**. N-02 no queda certificado como resuelto en producción porque la migración de reconciliación no está registrada allí y el origen textual de `bootstrap_owner_instalacion` sigue siendo divergente.

## Comparación con `origin/release`

El `origin/release` medido no contiene `supabase/migrations/20261108193000_n02_reconcile_deployed_db_functions.sql`. La rama de auditoría sí contiene esa migración y el contrato `tests/n02-reconcile-migration-contract.mjs`.

La migración candidata no introduce una regla de negocio nueva. Extrae los bloques de las migraciones versionadas de:

- `private.la_usuario_activo()` desde `20261108100000_a01_baja_empleado_revoca_acceso.sql`.
- `public.obtener_contexto_operativo(text)` desde `20260919225831_pm33_p05_identidad_antes_de_actividad.sql`.
- `public.bootstrap_owner_instalacion(text,text)` desde `20260914223200_owner_installation_bootstrap.sql`.

También restablece las ACL explícitas de esas funciones y contiene un preflight que detiene la aplicación si faltan objetos base. La migración excluye expresamente la guarda manual de QA porque no pertenece a `release` ni se ha demostrado como requisito de negocio versionado.

## Historial de migraciones medido

La consulta se hizo en solo lectura sobre `supabase_migrations.schema_migrations`:

| Medición | QA | Producción |
|---|---:|---:|
| Migraciones registradas | 267 | 171 |
| Primera versión | `20260904091829` | `20260904135838` |
| Última versión | `20261109201233` | `20261108120610` |

QA registra, entre otras, estas aplicaciones relevantes:

- `20261108100000_a01_baja_empleado_revoca_acceso`, historial `20261108112949`.
- `20261108193000_n02_reconcile_deployed_db_functions`, historial `20261109144148`.
- `20261108170000_a02_cerrar_y_sellar_venta_fiscal`, historial `20261109163045`.
- `20261109120000_b02_errores_sistema_fecha_idx`, historial `20261109163053`.
- Las migraciones A-03/A-04 de esta rama, hasta `20261109201233`.

Producción registra A-01 con historial `20261108114221`, pero no registra N-02, A-02, B-02 ni las migraciones A-03/A-04 de esta rama en la consulta realizada. Esto no se transforma en una afirmación sobre todos los cambios aplicados fuera del historial: es una medición de la tabla de migraciones y debe contrastarse con el objeto desplegado.

## Funciones comparadas

### `private.la_usuario_activo()`

QA y producción devuelven el mismo `md5(p.prosrc)`: `61c859ebfaeac333e757d03ea8ce4fbd`. La comparación compacta del cuerpo también coincide con el bloque extraído de la migración A-01: `37722785f21b401a62466ec37de45f93`.

La función es `SECURITY DEFINER` y mantiene ACL explícita únicamente para `postgres`. Esto demuestra equivalencia de esta función concreta, no paridad completa de las bases.

### `public.obtener_contexto_operativo(text)`

Los dos entornos tienen el mismo cuerpo al normalizar espacios y comentarios de línea: `081e8498a3d8be432090ad3b08992bb9`. La longitud de `prosrc` difiere porque QA conserva comentarios y finales de línea de la versión canónica, mientras producción tiene otra representación textual.

La ACL medida difiere:

- QA: `postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres`.
- Producción: `postgres=X/postgres,authenticated=X/postgres`.

La migración candidata revoca `public` y `anon` y concede `authenticated`; no se presenta aquí como prueba de que la diferencia de `service_role` sea explotable ni como requisito de negocio. Queda como diferencia de privilegios que debe decidirse explícitamente antes de promover una reconciliación.

### `public.bootstrap_owner_instalacion(text,text)`

QA tiene la huella compacta de cuerpo canónico `977eb2748752ba4d101bfa278ee509db`. Producción tiene `bc6019e27e50cf1597d8e8e75deb804e`.

La comparación de líneas muestra que QA conserva comentarios y espacios de la migración candidata, mientras producción conserva otra representación textual. Al quitar comentarios de línea y espacios, ambas definiciones producen la misma huella de comparación, `4f7a222f`, y contienen los mismos marcadores funcionales medidos: bloqueo advisory, preflight de instalación, autorización de Propietario, rechazo de estado empresarial no vacío, comprobación de identidad inicial y respuesta idempotente.

Por tanto, la diferencia de `bootstrap_owner_instalacion` está demostrada como **divergencia de procedencia/texto desplegado**; con esta prueba no se afirma una diferencia observable de ejecución. La migración N-02 sigue siendo necesaria si el objetivo es que la base se reconstruya desde la fuente versionada y no solo que el código parezca equivalente.

## Corrección explícita de evidencia anterior

El informe de pendientes describía una guarda manual de QA con la cadena `contexto_empleado_vinculado_no_operativo`. La consulta de hoy no encuentra esa cadena en la definición desplegada actual de `public.obtener_contexto_operativo(text)` ni en QA ni en producción. Esa afirmación queda corregida como **estado histórico**, no como estado actual.

No se debe usar la ausencia actual para concluir que nunca existió: solo demuestra que no está presente en las definiciones consultadas el 2026-11-09.

## Contratos y controles locales

El contrato `tests/n02-reconcile-migration-contract.mjs` pasó:

```text
N02_CONTRACT_PASS=4 N02_CONTRACT_FAIL=0
```

El validador del manifiesto pasó con los contadores existentes:

```text
active_contract=325
historical_expected_fail=1
utility=11
diagnostic=5
total_inventory=342
```

La migración N-02 ya está registrada en `tests/ci/manifiesto_clasificacion.json`; no se añadió un contrato nuevo durante esta revalidación. `git diff --check` no detectó errores de contenido.

## Estado y límites

Estado de N-02: **investigación revalidada y remediación versionada preparada; QA contiene la aplicación de N-02; producción sigue divergente y no se ha modificado**.

No se ha comprobado todavía:

1. La paridad completa de tablas, columnas, índices, triggers, políticas, privilegios y funciones de todos los esquemas.
2. Que la tabla de historial de migraciones sea una fotografía completa de cualquier SQL ejecutado manualmente fuera de Supabase CLI.
3. Que la diferencia de `service_role` en `obtener_contexto_operativo` deba conservarse o eliminarse; requiere decisión de alcance y revisión de seguridad.
4. La ejecución de la migración N-02 en producción, que queda fuera de esta fase por la regla de solo lectura y requeriría autorización específica.

No se creó ningún dato sintético nuevo en QA para N-02. No se ejecutó ninguna sentencia de escritura remota.

## Revalidación de seguimiento — 2026-11-10

Se repitió la medición en solo lectura sobre QA (`qjqorixtkilwsndqayyx`) y producción (`flqercbgpgmmfaakrwkc`). Esta sección prevalece sobre las cifras de corte del 2026-11-09 cuando difieren; no se reescribe la medición histórica porque forma parte de la trazabilidad.

### Inventario actual acotado

| Objeto contado | QA | Producción | Clasificación |
|---|---:|---:|---|
| Relaciones públicas/privadas (tablas, particiones, vistas, matviews y foreign tables) | 150 | 131 | Medido 2026-11-10 |
| Funciones públicas/privadas | 487 | 431 | Medido 2026-11-10 |
| Políticas RLS | 110 | 103 | Medido 2026-11-10 |
| Triggers no internos | 60 | 57 | Medido 2026-11-10 |
| Migraciones registradas | 267 | 175 | Medido 2026-11-10 |
| Última migración registrada | `20261109201233` | `20261109201101` | Medido 2026-11-10 |

Estos conteos no son una comparación exhaustiva de nombres, columnas, índices o definiciones. Sí demuestran que la divergencia de inventario sigue abierta y que no sería correcto certificar N-02 como paridad completa.

### Comparación actual de las tres funciones de la remediación

| Función | QA | Producción | Resultado |
|---|---|---|---|
| `private.la_usuario_activo()` | `prosrc` MD5 `61c859ebfaeac333e757d03ea8ce4fbd`; normalizada `37722785f21b401a62466ec37de45f93`; longitud 540 | Mismos MD5 y longitud | Medido: identidad textual y normalizada en esta función |
| `public.bootstrap_owner_instalacion(text,text)` | `prosrc` MD5 `77104240e60fa4f5b38a2583e58808d6`; normalizada `bc6019e27e50cf1597d8e8e75deb804e`; longitud 3997; `authenticated` puede ejecutar | `prosrc` MD5 `2ac268ea336339890f9541df88aa2325`; normalizada `bc6019e27e50cf1597d8e8e75deb804e`; longitud 3356; `authenticated` puede ejecutar | Medido: misma función tras normalización, pero distinta representación/procedencia textual |
| `public.obtener_contexto_operativo(text)` | `prosrc` MD5 `05661e8c3cec97e4d7245e45cd826471`; normalizada `5075a335aacb1cbf3f8cb44746a23a36`; longitud 14394; `authenticated` y `service_role` pueden ejecutar | `prosrc` MD5 `c0a59e17b2a8486eb35467e70ecc24ab`; normalizada `5075a335aacb1cbf3f8cb44746a23a36`; longitud 14002; solo `authenticated` puede ejecutar | Medido: misma lógica tras normalización, con divergencia textual y de ACL |

La conclusión de esta revalidación es más precisa que una afirmación genérica de “paridad”: las tres funciones seleccionadas mantienen equivalencia funcional bajo la comparación normalizada usada, pero el inventario global y al menos una ACL no coinciden. La huella `prosrc` idéntica solo se ha demostrado para `private.la_usuario_activo()`.

### Historial reciente actual

Versiones registradas desde `20261101000000`:

- QA: `20261101022150`, `20261101194745`, `20261101194906`, `20261102063724`, `20261102204642`, `20261107222112`, `20261108112949`, `20261109144148`, `20261109163045`, `20261109163053`, `20261109183228`, `20261109191804`, `20261109191912`, `20261109191913`, `20261109201233`.
- Producción: `20261101150825`, `20261101152053`, `20261101152102`, `20261108114221`, `20261108120610`, `20261109150000`, `20261109170000`, `20261109180000`, `20261109201101`.

La presencia de las cuatro versiones A-03/A-04 en producción refleja la reparación autorizada de historial realizada el 2026-11-10; esa operación solo reparó el registro de migraciones y no demuestra por sí misma que el SQL de esas migraciones se haya ejecutado en producción. Esta distinción queda mantenida deliberadamente.

### Revisión de la rama de auditoría

En la rama `codex/fase3-a03-a04` se midieron 201 ficheros de migración locales. La migración candidata N-02 `20261108193000_n02_reconcile_deployed_db_functions.sql` y el contrato `tests/n02-reconcile-migration-contract.mjs` están presentes, y el contrato volvió a pasar con `N02_CONTRACT_PASS=4 N02_CONTRACT_FAIL=0`.

Esto es evidencia **probada por código** de que la remediación candidata conserva los bloques canónicos, el preflight y las ACL declaradas. No es evidencia de que la migración esté aplicada en producción: producción sigue sin registrar esa migración y no se ha escrito en ella.

### Estado actualizado de N-02

N-02 queda **investigado y revalidado**, con remediación versionada preparada y aplicación confirmada en QA. No queda **cerrado completamente** como paridad de repositorio contra bases desplegadas: permanecen diferencias globales de inventario, una divergencia de ACL en `obtener_contexto_operativo` y una divergencia de procedencia textual en `bootstrap_owner_instalacion`. Cerrar esas diferencias en producción exigiría una autorización separada para escribir en producción y una comparación exhaustiva previa de los objetos afectados.

No se creó ningún dato sintético nuevo en QA durante esta revalidación. No se ejecutó ninguna sentencia de escritura remota en producción.

## Corrección explícita de la comparación de `bootstrap_owner_instalacion` — 2026-11-10

Una consulta posterior, separando el cuerpo `pg_proc.prosrc` de la representación completa de `pg_get_functiondef`, devuelve una divergencia que debe prevalecer sobre la tabla anterior: el cuerpo de QA mide `MD5=77104240e60fa4f5b38a2583e58808d6`, cuerpo normalizado `977eb2748752ba4d101bfa278ee509db` y longitud 3.997; producción mide `MD5=2ac268ea336339890f9541df88aa2325`, cuerpo normalizado `bc6019e27e50cf1597d8e8e75deb804e` y longitud 3.356. La afirmación previa de igualdad normalizada queda corregida como no reproducible con la medición actual.

La divergencia refuerza, en lugar de cerrar, N-02: la migración canónica está versionada y el contrato local pasa, pero el cuerpo desplegado no es idéntico entre QA y producción. La función sigue concedida a `authenticated` en ambos entornos; la ACL no elimina la diferencia de definición. No se ejecutó la función ni se escribió en producción.
