# PM11 · Personal / Empleados · P02 — Mapa del módulo actual

Fecha: 2026-09-06  
Rama: `pm11-personal-empleados`  
Base funcional: cierre G1 `1e21458b48a11302c59911ef966ded0aca3eb639`  
Entorno inspeccionado: Supabase QA `qjqorixtkilwsndqayyx`  
Producción/main: no tocar

## 1. Objetivo de P02

Inventariar el módulo Personal existente antes de cambiar comportamiento. Este punto es diagnóstico y congelación del mapa: no crea tablas, no migra datos y no modifica `fuente.js`.

## 2. Frontera funcional observada en frontend

El paquete actual contiene un dominio específico de Personal mediante:

- `validarEmpleadoPM10(...)`;
- `crearLogicaPersonal(...)`;
- componente `Personal(...)`;
- frontera posterior `crearLogicaTurnos(...)` / `Turnos(...)`, que se considera PM13 y no se incorpora a PM11.

El contrato heredado `tests/pm10/p07-personal-contract.mjs` ya obliga a conservar:

- validación numérica finita;
- horas semanales no negativas;
- pagas positivas;
- salarios y coste de empresa no negativos;
- vacaciones anuales no negativas;
- local activo obligatorio para mutar;
- rechazo de edición cruzada de local;
- alta/edición todo-o-nada;
- no normalizar silenciosamente legados inválidos;
- conservar formulario y mostrar error cuando falla la validación.

PM11 construirá encima de este contrato y no lo reabrirá.

## 3. Capacidades que ya existen

El dominio/UI de Personal ya expone o referencia estas capacidades:

- alta de empleado;
- edición de empleado;
- borrado de empleado;
- anonimización de empleado;
- ausencias;
- EPI;
- documentos de personal y caducidades;
- creación de cuenta para empleado;
- entrevistas;
- prefiltro de candidatos;
- referencias a fichajes y nóminas en la pantalla, aunque su lógica de negocio pertenece a PM12/PM14 y queda fuera de PM11.

### Riesgo funcional ya visible

El dominio histórico contiene `deleteEmpleado(...)`, que elimina físicamente la ficha de la colección de empleados y además elimina las nóminas ligadas en el estado cliente. Esto debe revisarse en PM11 porque el contrato objetivo del paquete exige conservar trazabilidad histórica y preferir baja/desactivación lógica frente a borrado destructivo. P02 solo registra el riesgo; no lo corrige aún.

Existe también `anonimizarEmpleado(...)`, por lo que el producto ya distingue conceptualmente entre eliminación y anonimización, pero su semántica completa se validará en puntos posteriores.

## 4. Persistencia actual de la ficha de empleado

No existe en QA una tabla `empleados` dedicada.

La infraestructura genérica existente es `public.almacen_kv` con columnas:

- `key text`;
- `value jsonb`;
- `updated_at timestamptz`;
- `empresa_id text`;
- `local_id text`.

El adaptador de almacenamiento reconoce específicamente la clave `empleados`. Para usuarios no Propietario, la lectura de `empleados` se sustituye por el resumen de empleados permitido por el contexto; las escrituras sobre esa clave quedan bloqueadas para esos roles por el guard de almacenamiento.

Al ejecutar P02 en QA:

- filas `almacen_kv` con `key='empleados'`: **0**.

Por tanto, QA no contiene actualmente una ficha sintética de empleado persistida en esa clave que pueda usarse como autoridad de PM11. Los usuarios sintéticos de G1 existen como perfiles/membresías, no como fichas laborales completas en `almacen_kv`.

## 5. Identidad de acceso y rol

La identidad de acceso está separada de la ficha laboral.

### `public.perfiles`

Campos relevantes observados:

- `user_id uuid` PK/FK a `auth.users`;
- `rol text`;
- `empleado_id text` nullable;
- `nombre text` nullable;
- `activo boolean`;
- timestamps.

El rol está limitado por CHECK a:

- Propietario;
- Encargado;
- Básico;
- Camarero/a;
- Cajero/a;
- Churrero/a.

RLS está activa. Las políticas QA observadas permiten al usuario autenticado leer/actualizar su propio perfil por `user_id = auth.uid()`.

### `public.membresias_usuario`

Campos relevantes:

- `id bigint` PK;
- `user_id uuid` FK a `auth.users`;
- `empresa_id text`;
- `local_id text` nullable;
- `todos_locales boolean`;
- `rol text`;
- `activo boolean`;
- timestamps.

RLS está activa. La lectura propia exige `user_id = auth.uid()`, membresía activa y usuario activo.

En QA, P02 observó:

- `perfiles`: **6 filas**;
- `membresias_usuario`: **6 filas**.

La relación `perfiles.empleado_id` es nullable y no se observó una FK hacia una tabla `empleados`, porque dicha tabla no existe.

## 6. Aislamiento empresa/local

`almacen_kv` tiene RLS activa con políticas de SELECT/INSERT/UPDATE/DELETE para `authenticated` que exigen:

- `empresa_id IS NOT NULL`;
- pertenencia a empresa mediante `private.la_tiene_empresa(empresa_id)`;
- y, cuando hay `local_id`, pertenencia al local mediante `private.la_tiene_local(empresa_id, local_id)`.

El contrato frontend heredado además exige un `localActivoId` explícito para alta/edición de personal y rechaza cruzar la ficha a otro local.

Esto ofrece una base de aislamiento, pero PM11 aún debe congelar una identidad laboral explícita empresa/local y comprobar que todas las operaciones de alta, edición, baja, documentos y cuenta respeten esa misma identidad de extremo a extremo.

## 7. Prefiltro y selección de candidatos

QA ya contiene infraestructura específica:

### `public.prefiltros_candidatos`

- `token text` PK;
- `creado_en`;
- `candidato_nombre`;
- `estado`;
- `respuestas jsonb`;
- `resumen jsonb`;
- `completado_en` nullable;
- `expira_en`.

### `public.prefiltro_limites`

- `clave text`;
- `ventana_inicio`;
- `intentos integer`;
- `actualizado_en`.

Ambas tablas tienen RLS activada. En QA P02 no había datos sintéticos:

- `prefiltros_candidatos`: **0 filas**;
- `prefiltro_limites`: **0 filas**.

No se encontraron RPC de base de datos cuyo nombre contenga `emplead`, `perfil`, `membres`, `prefiltro` o `entrevista`; por tanto, las operaciones de Personal no están hoy modeladas como un único API transaccional de dominio en Postgres.

## 8. Fichajes y auditoría: dependencias, no alcance

QA contiene `public.fichajes_registro` con `id`, `fecha`, `datos`, `creado_en`. RLS está activa, pero la política QA observada es `ALL` para cualquier `authenticated` con `USING/WITH CHECK true`.

Esto **no se corrige en PM11**, porque control horario corresponde a PM12. Queda registrado como dependencia y deberá endurecerse en su paquete propio.

`public.auditoria_registro` contiene identidad de empresa/local y `actor_user_id`, por lo que existe infraestructura para trazabilidad; PM11 deberá usar/validar esa trazabilidad para eventos de empleado que entren en su alcance.

## 9. Separaciones que PM11 debe resolver en puntos posteriores

P02 congela estos huecos, sin implementar todavía:

1. No hay entidad SQL `empleados` autoritativa; la ficha laboral y la cuenta de acceso están separadas.
2. `perfiles.empleado_id` no tiene integridad referencial hacia una ficha laboral SQL.
3. Alta/edición ya están endurecidas por LA-017, pero falta congelar contrato completo de identidad `empresa + local + empleado`.
4. El borrado físico actual entra en tensión con trazabilidad histórica y debe sustituirse o restringirse mediante baja/desactivación lógica según el contrato PM11.
5. Debe definirse quién puede crear, editar, desactivar, anonimizar y crear cuentas de empleado.
6. Debe impedirse cualquier mutación con `Todos los locales` o sobre local inactivo.
7. Debe mantenerse una ficha histórica sin cruces A/B ni A1/A2.
8. Documentos, ausencias y EPI deben heredar el contexto de la ficha y no poder moverse de empresa/local.
9. La creación de cuenta debe enlazar de forma inequívoca `auth user ↔ perfil ↔ membresía ↔ empleado` sin duplicidades ni apropiación de otra empresa.
10. PM11 debe preparar referencias compatibles con PM12–PM14, pero no implementar fichajes, turnos ni nóminas.

## 10. Decisión de arquitectura para el siguiente punto

P02 **no decide todavía** si la solución final será una nueva tabla SQL `empleados`, una capa transaccional sobre la persistencia existente o una migración progresiva. Esa decisión se congela en P03 después de contrastar los contratos de aislamiento, trazabilidad, baja lógica y compatibilidad con PM12–PM14.

No se debe crear una tabla o migración por intuición antes de P03.

## 11. Estado de P02

- inspección de frontend: completada;
- contrato heredado LA-017: identificado y conservado;
- persistencia actual: mapeada;
- perfiles/membresías: mapeados;
- aislamiento RLS relevante: mapeado;
- prefiltro: mapeado;
- dependencias PM12–PM14: separadas;
- cambios funcionales: **0**;
- migraciones PM11: **0**;
- producción/main: **sin tocar**.

**PM11_P02_MAPA_PERSONAL_ACTUAL=PASS**  
**SIGUIENTE=PM11_P03_CONTRATO_IDENTIDAD_CICLO_VIDA_PERSONAL**
