# PM11 · Personal / Empleados · P04 — Entidad SQL `empleados` + RLS

Fecha: 2026-09-06  
Rama: `pm11-personal-empleados`  
Base funcional de PM11: G1 `1e21458b48a11302c59911ef966ded0aca3eb639`  
P03 cerrado: `bb77ce9e7bb8c5057f160044a1c5b0201addf119`  
Supabase QA: `qjqorixtkilwsndqayyx`  
Producción/main: **no tocar / no tocado**

## 1. Objetivo

Materializar la decisión de P03: crear una autoridad SQL para identidad, empresa/local y ciclo de vida del empleado, con RLS segura y sin abrir todavía mutaciones directas desde el cliente.

P04 no migra fichas reales desde `almacen_kv`, no modifica `fuente.js` y no implementa aún las RPC completas de alta/edición/baja/reactivación.

## 2. Migraciones aplicadas únicamente en QA

Se aplicaron correctamente:

1. `20260906060647` — `pm11_empleados_entidad_rls`.
2. `20260906060830` — `pm11_guard_perfiles_sensibles`.

Los archivos versionados correspondientes son:

- `supabase/migrations/20260906081500_pm11_empleados_entidad_rls.sql`;
- `supabase/migrations/20260906082500_pm11_guard_perfiles_sensibles.sql`.

## 3. Entidad autoritativa creada

Se creó `public.empleados` con:

- `id text` como PK global y estable;
- `empresa_id text` obligatorio;
- `local_id text` obligatorio;
- `estado` limitado a `activo | inactivo | anonimizado`;
- `nombre` como dato mínimo de presentación;
- `datos jsonb` como puente progresivo para la ficha ampliada;
- `created_at`, `updated_at`;
- `baja_at`, `reactivado_at`, `anonimizado_at`.

La tabla rechaza IDs/empresa/local vacíos, rechaza `TODOS`/`TODOS LOS LOCALES` como local persistido y exige coherencia mínima entre estado y marcas temporales.

El estado `anonimizado` exige `nombre = NULL`, `baja_at` y `anonimizado_at`; un registro activo/inactivo exige nombre no vacío.

## 4. Guard de identidad y ciclo de vida

`private.pm11_empleados_guard()` protege mediante trigger:

- `id` inmutable;
- `empresa_id` inmutable;
- `local_id` no puede cambiar por UPDATE ordinario;
- `created_at` inmutable;
- `activo → anonimizado` directo rechazado;
- `anonimizado` es terminal;
- `updated_at` se refresca en UPDATE.

El cambio futuro de local deberá entrar mediante una operación explícita de traslado y adaptar este guard de forma controlada; P04 no habilita ningún traslado silencioso.

## 5. RLS y permisos

RLS está habilitada en `public.empleados`.

La política `pm11_empleados_select_gestion` usa `private.pm11_puede_ver_personal(empresa_id, local_id)`.

La autorización se deriva de `membresias_usuario`, no de `perfiles.rol`:

- Propietario: lectura de los locales de su propia empresa cubiertos por su membresía;
- Encargado: únicamente su local concreto y con `todos_locales = false`;
- otros roles: sin lectura de la tabla completa de empleados;
- otra empresa: invisible.

Permisos comprobados en QA:

- `authenticated`: SELECT = sí;
- `authenticated`: INSERT/UPDATE/DELETE = no;
- `anon`: SELECT/INSERT = no.

Las mutaciones de empleados quedan cerradas hasta las RPC transaccionales de P05.

## 6. Prueba RLS A/B y A1/A2

Se sembraron temporalmente cuatro empleados sintéticos:

- A / A1;
- A / A2;
- A / local cerrado;
- B / B1.

Resultado:

- **Propietario A** vio A1, A2 y el histórico del local cerrado de A; no vio B1.
- **Encargado A2** vio exclusivamente A2.
- **Cajero A1** vio 0 filas de la tabla completa de empleados.
- **Propietario B** vio exclusivamente B1.
- usuario QA inactivo vio 0 filas.

La lectura de un empleado histórico adscrito a un local cerrado se conserva para el Propietario de la empresa; la operabilidad de altas/mutaciones sobre locales inactivos se validará en las RPC, no ocultando el histórico.

## 7. Hallazgo de seguridad heredado y corrección

Durante P04 se probó expresamente una posible autoescalada del rol.

Antes del hardening, la política histórica de UPDATE propio sobre `public.perfiles` permitía al usuario autenticado cambiar su propia columna `rol`. En una transacción de prueba, el usuario **Cajero A1** pudo modificar temporalmente `perfiles.rol` a `Propietario`, y `private.la_rol()` pasó a devolver `Propietario`.

La RLS nueva de PM11 no resultó vulnerable porque `pm11_puede_ver_personal()` utiliza el rol de la membresía y siguió devolviendo denegación/0 filas.

No obstante, dejar la autoescalada heredada abierta era incompatible con el contrato de cuentas de PM11. Se creó `private.pm11_perfiles_guard_sensible()` para bloquear, cuando el UPDATE procede directamente como `authenticated`, cambios propios de:

- `rol`;
- `activo`;
- `empleado_id`.

Se comprobó después del parche:

- autoescalada `Cajero/a → Propietario`: bloqueada;
- `private.la_rol()` permaneció `Cajero/a`;
- modificación no sensible de `nombre`: siguió permitida por la política histórica;
- PM11 siguió denegando la tabla completa al Cajero.

Así se prepara además `perfiles.empleado_id` para que el vínculo con cuenta solo pueda realizarse más adelante mediante una operación controlada.

## 8. Pruebas de integridad de ciclo de vida

En transacciones revertidas se comprobó:

- cambio de empresa por UPDATE: rechazado;
- cambio de local por UPDATE: rechazado;
- alta con `local_id='TODOS'`: rechazada por CHECK;
- `activo → anonimizado` directo: rechazado;
- `activo → inactivo → activo`: permitido cuando se aportan las marcas de baja/reactivación;
- `activo → inactivo → anonimizado`: permitido con nombre anonimizado y timestamp;
- `anonimizado → activo`: rechazado como estado terminal.

Ninguna de estas pruebas dejó datos sintéticos persistentes.

## 9. Limpieza QA

Tras terminar las pruebas se eliminaron las filas temporales `P04-QA-*`.

**empleados restantes al cerrar P04: 0**.

No se migró ni borró `almacen_kv.empleados`; el puente de migración progresiva sigue pendiente.

## 10. Frontend y producción

- cambios en `fuente.js`: **0**;
- cambios funcionales de frontend en P04: **0**;
- producción: **0 cambios**;
- `main`: debe permanecer en `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`;
- cambios de base de datos: únicamente QA `qjqorixtkilwsndqayyx`.

## 11. Criterio de cierre

P04 se considera cerrado si el workflow específico confirma:

- descendencia correcta desde G1/P03;
- solo las migraciones esperadas de P04;
- contrato estático de entidad/RLS y hardening;
- regresiones P03/P02/P01/LA-017;
- sintaxis de `fuente.js`;
- build reproducible byte a byte;
- `main` intacto.

**PM11_P04_ENTIDAD_SQL_EMPLEADOS_RLS=PASS**  
**SIGUIENTE=PM11_P05_RPC_ALTA_EDICION_BAJA_REACTIVACION**
