# PM11 · Personal / Empleados · P10 — Corrección y cierre del smoke de acceso

Fecha: 2026-09-06  
Rama: `pm11-personal-empleados`  
Base antes de la corrección: `48abe840a995da9f61796885192020b9c6f30d24`  
Supabase QA: `qjqorixtkilwsndqayyx`  
Producción/main: **NO TOCAR**

## 1. Hallazgos del smoke real

La prueba real en navegador incógnito con la cuenta `PM11 Smoke A1` confirmó que el alta de cuenta funcionaba, pero descubrió defectos reales de presentación/alcance que inicialmente impedían cerrar P10:

1. el rol `Camarero/a` mostraba únicamente TPV y Fichajes en el menú, pero todavía podía permanecer/acceder a la pantalla principal o Dashboard;
2. la cuenta, aunque su membresía era únicamente `QA-A1`, veía el catálogo de `QA-A1` y `QA-A2` heredado del bootstrap/caché del navegador;
3. la pantalla principal podía mostrar el logotipo histórico de San Ginés en vez de la identidad de producto `L&A Suite`;
4. tras dar de baja al empleado durante el smoke, una sesión previamente autenticada podía conservar UI heredada y permanecer temporalmente dentro de Registro horario aunque el backend ya considerase al empleado no operativo.

Estos hallazgos se trataron como defectos reales y no como un PASS aparente.

## 2. Verificación de la cuenta de prueba

Se comprobó en Supabase QA que la cuenta usada en el smoke estaba correctamente creada y vinculada:

- perfil activo;
- rol: `Camarero/a`;
- empleado vinculado: `mtpz334lfrh8y7` (`PM11 Smoke A1`);
- empresa: `QA-EMP-A`;
- local: `QA-A1`;
- `todos_locales=false`;
- membresía activa.

Mientras el empleado estuvo activo, el vínculo era coherente y autorizable. Tras la baja lógica, el empleado quedó en estado `inactivo` y el helper autoritativo `private.la_usuario_activo()` dejó de considerarlo operativo, manteniendo deliberadamente perfil, membresía y credenciales para permitir una futura reactivación sin recrear identidad.

## 3. Causa raíz

La capa de compatibilidad del frontend intentaba obtener un contexto operativo reducido mediante `obtener_contexto_operativo`, pero esa RPC no existía inicialmente en QA. Además, el bundle seguía pudiendo cargar el catálogo global de locales del bootstrap local.

El catálogo QA de `almacen_kv`, clave `locales`, contiene A1 y A2 activos para Empresa A y un local histórico cerrado. Sin una RPC de contexto autoritativa, una cuenta limitada a A1 podía recibir/mostrar más catálogo del necesario desde la copia local.

En branding, el proyecto ya disponía de `la-suite-logo.svg`, pero la detección histórica del Dashboard no cubría todas las variantes de la pantalla que ve un empleado.

En el caso de la baja lógica, el backend rechazaba correctamente el contexto del empleado inactivo, pero el navegador todavía podía conservar una sesión Auth válida y UI/caché anterior. Faltaba un guard explícito que, ante una sesión autenticada sin contexto operativo autorizado, cerrase la sesión del cliente en vez de limitarse a vaciar datos.

## 4. Corrección backend: contexto operativo autoritativo

Migración versionada:

- `supabase/migrations/20260906183000_pm11_contexto_operativo_acceso_smoke.sql`

Migración aplicada **solo a QA**:

- nombre: `pm11_contexto_operativo_acceso_smoke`;
- versión QA: `20260906163842`.

Nueva RPC:

- `public.obtener_contexto_operativo()`.

Contrato de seguridad:

- `SECURITY DEFINER` con `search_path` explícito;
- identidad exclusivamente desde `auth.uid()`;
- requiere perfil activo y membresía activa;
- rol y empresa/local se derivan del servidor, nunca de parámetros enviados por el navegador;
- un no-Propietario debe resolver un único local concreto;
- el catálogo de locales se filtra por membresía y por `activo=true`;
- el local histórico cerrado no se entrega como contexto operativo;
- la cuenta vinculada debe apuntar a un empleado activo y dentro de la misma membresía;
- para `Camarero/a` el contrato de módulos es exactamente `TPV + Fichajes`;
- `anon` no puede ejecutar la RPC;
- `authenticated` sí puede ejecutarla.

## 5. Pruebas dinámicas QA del contexto

### Camarero del smoke

Para `58056afa-6ad6-4ff1-919c-2b3a37540e98` mientras el empleado estuvo activo:

- rol: `Camarero/a`;
- empresa: `QA-EMP-A`;
- local fijado: `QA-A1`;
- `todosLocales=false`;
- locales visibles devueltos por servidor: **solo `QA-A1`**;
- empleado: **solo `mtpz334lfrh8y7 / PM11 Smoke A1`**;
- empleados disponibles para fichaje: **solo el propio empleado**;
- módulos devueltos: **`tpv`, `fichajes`**.

Resultado: `PM11_P10_CONTEXTO_CAMARERO_QA=PASS`.

### Encargado A2

Para el fixture Encargado A2:

- empresa `QA-EMP-A`;
- local fijado `QA-A2`;
- catálogo visible: **solo A2**.

Resultado: `PM11_P10_CONTEXTO_ENCARGADO_QA=PASS`.

### Propietario A

Para el Propietario A:

- conserva acceso multi-local autorizado;
- devuelve A1 y A2 activos;
- no entrega `QA-A-CERRADO` como local operativo activo.

Resultado: `PM11_P10_CONTEXTO_OWNER_QA=PASS`.

### Permisos de función

- `authenticated`: EXECUTE = `true`;
- `anon`: EXECUTE = `false`.

Resultado: `PM11_P10_CONTEXTO_PERMISOS_QA=PASS`.

## 6. Corrección frontend de mínimo privilegio

La barrera de acceso se implementó en:

- `pm11-access-patch.js`.

Se carga antes del bundle y:

- obtiene el contexto firmado por la RPC;
- limita `empresas`, `locales` y `localActivoId` al scope autorizado;
- filtra productos/movimientos por local para cuentas no propietarias;
- para fichajes de empleado normal entrega únicamente los propios;
- impide que un no-Propietario cambie `localActivoId` fuera de su membresía;
- falla cerrado si existe sesión pero no puede verificarse el contexto;
- no entrega la copia local heredada fuera de scope;
- para `Camarero/a` oculta Inicio/Dashboard y redirige a TPV/Fichajes;
- poda opciones de locales no autorizados;
- sustituye branding evidente de San Ginés/Chocoloyos por `L&A Suite`.

Posteriormente se añadió:

- `pm11-access-runtime-v3.js`, para rehidratación post-login, fijación del local autorizado y bloqueo de `Corrección manual` para Camarero/a;
- `pm11-mobile-layout-v3.js`, para corregir el ancho móvil sin romper permisos;
- `pm11-session-guard-v4.js`, para cerrar de forma autoritativa una sesión autenticada que ya no tenga contexto operativo válido, incluido el caso de baja lógica del empleado.

El orden actual de carga es:

1. `pm11-access-patch.js`;
2. `pm11-session-guard-v4.js`;
3. `pm11-access-runtime-v3.js`;
4. `pm11-mobile-layout-v3.js`;
5. `fuente.js`.

No se confía en querystring ni en valores de rol/empresa/local escritos por el cliente.

## 7. Suspensión de acceso por baja lógica

La prueba real confirmó primero el defecto residual: después de marcar `PM11 Smoke A1` como baja, una sesión ya abierta podía seguir mostrando Registro horario por caché/UI heredada.

Se verificó en QA que en ese momento:

- empleado `mtpz334lfrh8y7`: `estado=inactivo`;
- perfil: activo;
- membresía: activa;
- rol: `Camarero/a`;
- empresa/local: `QA-EMP-A / QA-A1`.

Esto es el estado esperado del modelo: la baja no elimina perfil ni membresía, pero debe suspender el acceso efectivo.

La corrección `pm11-session-guard-v4.js` convierte esa condición en fail-closed: si existe sesión Auth pero `obtener_contexto_operativo()` rechaza al usuario por empleado vinculado no operativo, se limpia contexto seguro, se cierra la sesión y se vuelve a la pantalla de acceso.

Además, el guard repite la validación durante una sesión viva para evitar que una baja administrativa posterior deje una pestaña operativa indefinidamente.

## 8. Gate CI

Workflow:

- `.github/workflows/pm11-p10-smoke-acceso.yml`.

Gate final con guard de sesión:

- run `34057270396`: **SUCCESS**.

Pasaron todos los pasos del job `smoke-acceso-pm11`, incluidos:

- origen/alcance y `main` intacto;
- inserción determinista de barreras antes del bundle;
- sintaxis de `pm11-access-patch.js`, `pm11-session-guard-v4.js`, runtime, layout y `fuente.js`;
- contrato de smoke;
- contrato específico del guard de sesión v4;
- regresión de anonimización;
- regresiones P09 a P06;
- Personal LA-017 y PM11 P05 a P01;
- reconstrucción y comparación byte a byte de `fuente.js`;
- verificación del `index.html` final.

Resultado:

`PM11_P10_SMOKE_ACCESO_GATE=PASS`  
`PM11_P10_SESSION_GUARD_V4=PASS`

## 9. Estado de producción

`main` continúa congelado en:

`7f792925d6a3d27334ee0e7335ba635b4ed79b6b`

No se aplicó esta migración al Supabase de producción y no se fusionó la rama a `main`.

Deploy Preview de la rama QA: **SUCCESS**.

## 10. Smoke real final confirmado por usuario

En navegador real se completó la secuencia crítica de ciclo de vida:

1. la cuenta `PM11 Smoke A1` pudo operar mientras el empleado estaba activo;
2. se probó TPV con alcance limitado a su local;
3. se probó Registro horario y fichaje propio;
4. se realizó Entrada y Salida y se exportó el registro;
5. desde Propietario se dio de baja lógica al empleado;
6. la ficha quedó marcada como `baja`, conservando historial;
7. tras desplegar el guard v4 y recargar, la sesión del empleado fue expulsada;
8. el usuario intentó iniciar sesión nuevamente con la misma cuenta y confirmó que **ya no permite entrar**.

Confirmación textual final del usuario: la aplicación lo sacó y, al volver a probar el inicio de sesión, no permitió el acceso.

Esto demuestra simultáneamente:

- la baja lógica conserva identidad e historial;
- una cuenta vinculada a empleado inactivo deja de ser operativa;
- una sesión abierta no puede permanecer utilizable tras la baja;
- un nuevo intento de entrada tampoco obtiene contexto operativo;
- no fue necesario borrar credenciales ni identidad del usuario.

## 11. Criterio de cierre P10

Quedan satisfechos los criterios relevantes del smoke real:

- mínimo privilegio de Camarero/a: PASS;
- aislamiento de local A1 frente a A2: PASS;
- TPV permitido: PASS;
- Fichajes propios: PASS;
- Corrección manual no disponible para Camarero/a: PASS;
- branding L&A Suite: PASS;
- layout móvil sin franja lateral: PASS;
- baja lógica suspende sesión existente: PASS;
- baja lógica impide nueva operativa: PASS;
- backend + CI + navegador real coherentes: PASS;
- producción/main intactos: PASS.

**PM11_P10_SMOKE_ACCESO_CORREGIDO=PASS**  
**PM11_P10_SMOKE_BROWSER_REPETICION=PASS**  
**PM11_P10_BAJA_SUSPENDE_ACCESO_REAL=PASS**  
**PM11_P10_CIERRE=PASS**
