# PM11 · Personal / Empleados · P09 — Creación segura de cuenta de empleado

Fecha: 2026-09-06  
Rama: `pm11-personal-empleados`  
Entorno de aplicación DB/Edge: Supabase QA `qjqorixtkilwsndqayyx`  
Producción/main: no tocar

## Objetivo

Cerrar el flujo que crea una cuenta Auth para un empleado sin dejar identidad, perfil o membresía parciales y sin permitir que el frontend de pruebas llame por error a la Edge Function de producción.

## Hallazgo previo corregido

El puente P06 conservaba la llamada histórica a:

`https://flqercbgpgmmfaakrwkc.supabase.co/functions/v1/crear-cuenta-empleado`

Eso significaba que una pantalla conectada a QA podía intentar crear la cuenta en el proyecto de producción. P09 sustituye ese endpoint fijo por `supabase.functions.invoke("crear-cuenta-empleado", ...)`, de modo que se usa el mismo proyecto Supabase de la sesión activa.

## Diseño final

1. La Edge Function exige JWT (`verify_jwt=true`) y vuelve a verificar la sesión mediante `auth.getUser()`.
2. El cliente solo envía `empleadoId`, nombre, email, contraseña y rol. Empresa/local se resuelven desde `public.empleados`, nunca desde payload cliente.
3. Solo un perfil activo con membresía activa `Propietario` compatible con empresa/local del empleado puede continuar.
4. El empleado debe existir y estar `activo`.
5. Roles destino permitidos: Encargado, Básico, Camarero/a, Cajero/a y Churrero/a. No se puede crear otro Propietario desde este flujo.
6. La Edge Function crea primero el usuario Auth mediante service role.
7. Una RPC DB, ejecutable solo por `service_role`, crea en una misma transacción membresía + perfil vinculado + auditoría.
8. La membresía concreta se crea antes del perfil para satisfacer el guard P08.
9. Si la finalización DB falla, la Edge Function elimina el usuario Auth recién creado. Si esa compensación también falla, intenta bloquearlo como segunda barrera.
10. El reintento de una cuenta ya vinculada al mismo empleado/email/rol es idempotente y no crea un segundo usuario.

## QA aplicada

Migración QA aplicada:

- `pm11_creacion_cuenta_empleado_segura`
- versión observada: `20260906075429`

Edge Function QA desplegada:

- slug: `crear-cuenta-empleado`
- versión: 1
- estado: ACTIVE
- `verify_jwt=true`

La Edge Function de producción no se modificó.

## Prueba transaccional DB real

Se ejecutó en QA una transacción con rollback usando identidades Auth sintéticas existentes:

- actor: Propietario de QA Empresa A;
- usuario objetivo: fixture Auth de QA cuya configuración de perfil/membresía se retiró temporalmente dentro de la misma transacción;
- empleado temporal: `PM11-P09-TEMP`, Empresa A / local A1.

Se comprobó:

- creación atómica de membresía concreta A1;
- creación de perfil vinculado al empleado;
- mismo rol en membresía/perfil;
- auditoría única `Personal · crear cuenta empleado`;
- segundo intento devuelve `yaCreada=true`;
- el segundo intento no duplica auditoría;
- actor de Empresa B queda rechazado;
- rol destino `Propietario` queda rechazado.

Resultado: `PM11_P09_DB_TRANSACCIONAL=PASS`.

La transacción terminó con `ROLLBACK`. Verificación posterior:

- `public.empleados`: 0 filas sintéticas;
- `public.perfiles`: 6 fixtures restauradas;
- `public.membresias_usuario`: 6 fixtures restauradas;
- auditoría `PM11-P09-TEMP`: 0 filas.

## Permisos DB

`pm11_finalizar_creacion_cuenta_empleado(...)`:

- `authenticated`: EXECUTE = false;
- `anon`: EXECUTE = false;
- `service_role`: EXECUTE = true.

Así, un navegador no puede saltarse la Edge Function e invocar directamente la finalización privilegiada.

## Gate GitHub y fuente

El primer gate P09 fue `34020618209` y concluyó `success`. En ese mismo gate se aplicó de forma reproducible el parche frontend P09 y GitHub Actions creó el commit funcional:

- `61fcacd79a8d262c4c35b93419da589aeee8f90a`
- mensaje: `PM11 P09: usar Edge Function del proyecto Supabase activo`

El gate comprobó antes del commit:

- sintaxis de `fuente.js`;
- contrato P09;
- regresiones P08 → P01 y LA-017;
- build base + P06 + P09 reproducible byte a byte;
- `main` congelado en `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`.

Esta actualización de evidencia fuerza una segunda ejecución del gate sobre el HEAD que ya contiene el commit funcional, de forma que el cierre final no depende solo del worktree previo al commit automático.

## Limitación de la validación automatizada

Las herramientas de esta sesión permiten desplegar e inspeccionar Edge Functions, pero no proporcionan una sesión JWT de uno de los usuarios QA ni un invocador HTTP autenticado. Por ello no se fabricó ni se alteró una contraseña de fixture para forzar una llamada positiva artificial.

La ruta Auth queda validada por:

- despliegue real en QA con JWT obligatorio;
- código versionado exacto;
- contrato automático estático sobre autenticación, autorización, `admin.createUser`, finalización transaccional y compensación;
- prueba real de la parte DB transaccional con rollback.

Antes de cualquier integración a producción debe hacerse además un smoke desde el Deploy Preview usando una sesión real de Propietario QA.

## Producción

- `main`: no modificado;
- proyecto Supabase producción `flqercbgpgmmfaakrwkc`: no modificado;
- Edge Function producción `crear-cuenta-empleado`: inspeccionada previamente solo en lectura y no desplegada en P09.

**PM11_P09_CREACION_CUENTA_EMPLEADO_SEGURA=PASS**  
**SIGUIENTE=PM11_P10_SMOKE_CUENTA_DESDE_PREVIEW_Y_ANONIMIZACION**
