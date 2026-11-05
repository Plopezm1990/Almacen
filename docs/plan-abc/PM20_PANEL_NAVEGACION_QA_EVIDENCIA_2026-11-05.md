# Evidencia QA — Panel y navegación — 2026-11-05

## Alcance

Comprobación de lectura del aislamiento de empresa/local y de la resolución de permisos del panel en el proyecto Supabase QA de LA Suite.

No se ejecutaron escrituras, migraciones, cambios de permisos, cobros, reembolsos ni restauraciones.

## Método y límite de la evidencia

Las funciones SQL se invocaron en QA utilizando `set_config('request.jwt.claim.sub', ...)` dentro de una consulta de solo lectura para simular la identidad de usuarios sintéticos ya existentes. Esto permite comprobar la lógica de autoridad del servidor y sus denegaciones, pero no sustituye una llamada PostgREST completa con un JWT real desde el navegador.

No se incluyen identificadores de usuario, nombres personales, correos ni credenciales.

## Resultados

| Identidad sintética | Operación | Resultado | Evidencia |
|---|---|---|---|
| Propietario QA | Contexto de local A2 | Permitido | Devuelve contexto de empresa A y local A2 |
| Encargado QA con empleado activo | Contexto de su local A1 | Permitido | Devuelve rol Encargado, empresa A, local A1 y empleado activo |
| Encargado QA con empleado activo | `PM13_PERSONAL_CONSULTAR` en A1 | Permitido | `permitido=true`, fuente `cargo`, resolución de servidor |
| Encargado QA con empleado activo | `PM13_PERSONAL_CONSULTAR` en A2 | Denegado | `membresia_no_autorizada` |
| Encargado QA con empleado activo | Contexto de local A2 | Denegado | `contexto_local_no_autorizado` |
| Encargado QA sin empleado vinculado | Resolución de acción en A2 | Denegado | `empleado_no_vinculado` |
| Usuario QA con empleado inactivo | `PM13_PERSONAL_CONSULTAR` | Denegado | `empleado_no_disponible` |
| Usuario QA con membresía inactiva | Contexto de A1 | Denegado | `contexto_perfil_inactivo` |
| Encargado QA | `abc_obtener_pantallas_rol` sobre el local no autorizado | Denegado | `abc_config_no_autorizado` |
| Encargado QA | Contexto de empresa B | Denegado | `contexto_local_no_autorizado` |

## Interpretación

- El backend mantiene la autoridad sobre el ámbito empresa/local.
- El frontend no debe considerarse una barrera de seguridad por ocultar una entrada del menú.
- La denegación por empleado no vinculado o inactivo es segura y no se ha clasificado como fallo.
- El caso positivo de Encargado requiere una cuenta con perfil, empleado activo, asignación de cargo y membresía en el mismo local; ese caso sí está presente en QA y devolvió permiso positivo para Personal.

## Pruebas de código relacionadas

Pasaron los contratos estáticos de catálogo, capacidades, roles fijos, resolver de acciones, guard de permisos, aislamiento frontend multilocal y navegación protegida por borrador.

También pasaron los contratos de sincronización y respaldos:

- claves solo locales;
- historial de respaldos;
- primer arranque con cuota o KV vacío;
- fallos transitorios y reintentos;
- comunicación honesta de estado no confirmado.

## Pendiente para cerrar la matriz

1. Repetir los mismos casos desde sesiones JWT reales en el navegador.
2. Probar PostgREST, Edge Functions, Storage/KV y Realtime con identidades de cada rol.
3. Añadir casos de usuario de otra empresa, revocación durante sesión y dos pestañas con contextos distintos.
4. Ejecutar la prueba sintética de fallo de sincronización desde la interfaz y verificar el reintento visible.
