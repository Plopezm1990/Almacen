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

## Verificación adicional de ejecución — rama QA

Se ejecutaron sin escrituras externas:

- `tests/plataforma/p08c-copia-historial-cuota-runtime.mjs`: **PASS**. El traslado de un historial grande a la copia por cuenta conserva el contenido y elimina la copia global aun con una cuota local ajustada.
- `tests/plataforma/p05-panel-ui-runtime.mjs`: **PASS 95/95**. El panel de plataforma, sus estados, validaciones, reintentos, cierre de sesión y protección frente a nombres HTML se comportan conforme al contrato del arnés.
- `tests/pm20/p09-sync-events-runtime.mjs`: **PASS 4/4**. `saveKey` emite estado pendiente, confirmación, clasificación de cuota y confirmación de ledger sin duplicar caché local, según el resultado del adaptador.
- `tests/pm20/p10-sync-banner-ui-runtime.mjs`: **PASS**. El bundle real, montado en `jsdom` con nube desactivada, muestra el aviso con `role=alert` y `aria-live=assertive`, conserva la clave `historialRespaldos`, invoca `Reintentar` y retira el aviso al recibir confirmación.

En la aplicación QA desplegada, con una sesión de propietario y datos sintéticos ya existentes, se comprobó visualmente:

- `cafe` devuelve `Café con leche (QA)` y `Café solo (QA)`; la búsqueda no exige escribir el acento.
- `queseria` devuelve el proveedor sintético y abre `#/panel/proveedores`; se cerró la ficha sin guardar.
- `qa` devuelve un cliente y personal sintético; sus resultados abren `#/panel/clientes` y `#/panel/personal`, respectivamente; no se guardó ningún cambio.
- El encabezado conserva el ámbito visible `Local A1 · QA Empresa A, S.L.` durante el recorrido.

La prueba manual del aviso rojo de sincronización no se forzó en la cuenta QA porque no existe un control de inyección de fallo y provocarlo llenando el almacenamiento o interrumpiendo una escritura podría alterar el estado del entorno. La interacción visible sí queda verificada en el bundle real mediante el runtime aislado; lo que no se ha probado es la misma inyección sobre una sesión de navegador conectada a QA.

## Automatización añadida para la rama QA

Se añadió `.github/workflows/pm20-panel-navegacion-qa.yml` en el commit `c0d6d7b` para ejecutar en GitHub Actions, de forma aislada:

- sintaxis y contratos P0/P1 de panel, navegación, búsqueda y sincronización;
- runtime `jsdom` del aviso de sincronización y del panel de plataforma;
- runtime de la migración del historial de respaldos;
- regresión de contexto empresa/local, permisos, roles y protección de borradores;
- comprobación de que las pruebas nuevas no contienen claves privilegiadas.

La automatización está configurada para la rama `codex/ventas-release-integration` y para ejecución manual. La configuración, la publicación de QA y una ejecución concreta de GitHub Actions están verificadas; la ejecución CI no sustituye la matriz de sesiones reales ni las pruebas de los servicios con JWT.

Posteriormente se observó la ejecución de GitHub Actions asociada al commit `c0d6d7b`: terminó con conclusión **success** en el evento `push` de la rama QA. El resultado confirma la automatización de contratos y runtime descrita arriba, pero no sustituye la matriz de sesiones reales ni las pruebas de los servicios con JWT.

## Sesión de navegador QA y límite de roles

En la aplicación desplegada en el branch deploy se verificó una sesión de propietario ya disponible, sin escribir datos ni activar operaciones económicas. El encabezado mostró el contexto `Local A1 · QA Empresa A, S.L.` y el panel permitió observar la navegación general, el selector de local y el acceso a modo empleado.

El modo empleado mostró los perfiles sintéticos disponibles, pero solicita un código de acceso antes de entrar en cualquiera de ellos. No se adivinó ni se reutilizó ningún código no documentado. Por tanto, la evidencia de navegador directo queda confirmada para propietario y la prueba de cada rol operativo mediante interfaz sigue pendiente; las denegaciones de servidor de la tabla anterior sí están verificadas mediante simulación controlada de identidad.

## Pendiente para cerrar la matriz

1. Repetir los mismos casos desde sesiones JWT reales en el navegador para cada rol, sin crear cuentas nuevas en esta fase.
2. Probar PostgREST, Edge Functions, Storage/KV y Realtime con identidades de cada rol.
3. Añadir casos de usuario de otra empresa, revocación durante sesión y dos pestañas con contextos distintos.
4. Si se necesita cerrar también la matriz de entorno conectado, añadir un mecanismo de prueba aislado o una sesión controlada que permita inyectar el fallo de sincronización sin llenar el almacenamiento ni provocar una escritura real fallida.
