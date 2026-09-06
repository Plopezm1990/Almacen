# PM11 · Personal / Empleados · P10 — Corrección del smoke de acceso

Fecha: 2026-09-06  
Rama: `pm11-personal-empleados`  
Base antes de la corrección: `48abe840a995da9f61796885192020b9c6f30d24`  
Supabase QA: `qjqorixtkilwsndqayyx`  
Producción/main: **NO TOCAR**

## 1. Hallazgos del smoke real

La prueba real en navegador incógnito con la cuenta `PM11 Smoke A1` confirmó que el alta de cuenta funcionaba, pero descubrió tres defectos de presentación/alcance que impiden cerrar P10:

1. el rol `Camarero/a` mostraba únicamente TPV y Fichajes en el menú, pero todavía podía permanecer/acceder a la pantalla principal o Dashboard;
2. la cuenta, aunque su membresía era únicamente `QA-A1`, veía el catálogo de `QA-A1` y `QA-A2` heredado del bootstrap/caché del navegador;
3. la pantalla principal podía mostrar el logotipo histórico de San Ginés en vez de la identidad de producto `L&A Suite`.

Estos hallazgos se consideran defectos reales encontrados por el smoke, no un PASS aparente.

## 2. Verificación de la cuenta de prueba

Se comprobó en Supabase QA que la cuenta usada en el smoke estaba correctamente creada y vinculada:

- perfil activo;
- rol: `Camarero/a`;
- empleado vinculado: `mtpz334lfrh8y7` (`PM11 Smoke A1`);
- empresa: `QA-EMP-A`;
- local: `QA-A1`;
- `todos_locales=false`;
- membresía activa.

El empleado SQL vinculado estaba también en:

- empresa `QA-EMP-A`;
- local `QA-A1`;
- estado `activo`.

Por tanto la causa no era una membresía incorrecta: el defecto estaba en la hidratación de contexto/caché del frontend.

## 3. Causa raíz

La capa de compatibilidad del frontend intentaba obtener un contexto operativo reducido mediante `obtener_contexto_operativo`, pero esa RPC no existía en QA. Además, el bundle seguía pudiendo cargar el catálogo global de locales del bootstrap local.

El catálogo QA actual de `almacen_kv`, clave `locales`, contiene A1 y A2 activos para Empresa A (y un local histórico cerrado). Sin una RPC de contexto autoritativa, una cuenta limitada a A1 podía recibir/mostrar más catálogo del necesario desde la copia local.

En branding, el proyecto ya dispone de `la-suite-logo.svg`, pero la detección histórica del Dashboard no cubría todas las variantes de la pantalla que ve un empleado.

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

Para `58056afa-6ad6-4ff1-919c-2b3a37540e98`:

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

Nuevo archivo:

- `pm11-access-patch.js`.

Se carga antes de `fuente.js` desde `index.html` mediante:

`./pm11-access-patch.js?v=pm11-p10-smoke-v1`

La barrera:

- obtiene el contexto firmado por la nueva RPC;
- limita `empresas`, `locales` y `localActivoId` al scope autorizado;
- filtra productos/movimientos por local para cuentas no propietarias;
- para fichajes de empleado normal entrega únicamente los propios;
- impide que un no-Propietario cambie `localActivoId` fuera de su membresía;
- falla cerrado si existe sesión pero no puede verificarse el contexto;
- no borra la copia local heredada de otro usuario: evita entregarla fuera de scope;
- para `Camarero/a` oculta la entrada a Inicio/Dashboard y, si la sesión aterriza en Dashboard, redirige a TPV (con Fichajes como alternativa);
- poda opciones de locales no autorizados del selector heredado;
- sustituye branding evidente de San Ginés/Chocoloyos en la cabecera del Dashboard por `la-suite-logo.svg` / `L&A Suite`.

No se confía en querystring ni en valores de rol/empresa/local escritos por el cliente.

## 7. Reproducibilidad y alcance de cambios

Rango comprobado:

- base: `48abe840a995da9f61796885192020b9c6f30d24`;
- commit que dejó `index.html` cargando la barrera: `7195f1beda13b683d4a94e1979fca0f32185aa29`.

Entre ambos solo se añadieron/modificaron los artefactos de esta corrección:

- `.github/workflows/pm11-p10-smoke-acceso.yml`;
- `index.html` (una línea de carga del patch);
- `pm11-access-patch.js`;
- la migración de contexto;
- el contrato estático de smoke;
- el parche reproducible de `index.html`.

`fuente.js` y `source-recovery` permanecieron sin cambios respecto a la base del smoke. El gate reconstruyó el artefacto histórico y comparó `fuente.js` byte a byte.

## 8. Gate CI

Workflow:

- `.github/workflows/pm11-p10-smoke-acceso.yml`.

Primer gate de implementación:

- run `34046351453`: **SUCCESS**.

Pasaron todos sus pasos:

- origen/alcance y `main` intacto;
- inserción determinista de la barrera antes del bundle;
- sintaxis;
- contrato del smoke;
- regresión P10 anonimización;
- regresiones P09, P08, P07, P06;
- LA-017;
- PM11 P05 → P01;
- reconstrucción y comparación byte a byte de `fuente.js`;
- commit automático de `index.html`.

El commit automático quedó en:

- `7195f1beda13b683d4a94e1979fca0f32185aa29` — `PM11 P10: cargar barrera de acceso antes de fuente`.

## 9. Estado de producción

`main` continúa congelado en:

`7f792925d6a3d27334ee0e7335ba635b4ed79b6b`

No se aplicó esta migración al Supabase de producción y no se fusionó la rama a `main`.

## 10. Condición que falta para cerrar el smoke

La corrección técnica está implementada y validada por backend + CI. Falta únicamente repetir el smoke real en una sesión incógnita/navegador real y confirmar simultáneamente:

1. `Camarero/a` no puede entrar/permanecer en Dashboard; arranca o queda en TPV/Fichajes;
2. solo aparece `QA Local A1` y no hay acceso/selector hacia A2;
3. la identidad mostrada es `L&A Suite`, nunca San Ginés;
4. TPV abre y permite la operativa permitida sin revelar datos del otro local;
5. Fichajes abre y solo permite trabajar con el empleado propio.

No se exige captura de pantalla: la confirmación textual del smoke es suficiente.

**PM11_P10_SMOKE_ACCESO_CORREGIDO=PASS**  
**PM11_P10_SMOKE_BROWSER_REPETICION=PENDIENTE_USUARIO**  
**PM11_P10_CIERRE=PARCIAL_HASTA_SMOKE_REAL**
