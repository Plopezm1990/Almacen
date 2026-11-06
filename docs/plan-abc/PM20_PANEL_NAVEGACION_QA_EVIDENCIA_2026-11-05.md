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
- `tests/pm20/p11-panel-navigation-e2e-runtime.mjs`: **PASS**. El bundle real, en DOM aislado y sin red, recorre navegación principal, hash de pantalla, `aria-current`, atrás, menú móvil «Más» y recarga de una ruta profunda sin crear ni modificar operaciones.

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

En la comprobación local del 2026-11-06 se ejecutó la batería completa definida por ese workflow, con resultado `PM20_FULL_LOCAL_REGRESSION=PASS`. Incluyó sintaxis de `fuente.js`, contratos P0/P1 de panel, búsqueda y sincronización, runtimes de aviso y navegación, copia de historial, panel de plataforma, contexto empresa/local, almacenamiento KV contextual, roles y capacidades, resolución y guardas de permisos, RLS de empleados, protección de borradores y selector de empresa/local.

## Hallazgo PN-011 — modo Encargado exponía controles de propietario por ruta directa

### Estado antes de la corrección

**Confirmado en QA mediante sesión real de Encargado, sin pulsar acciones de escritura.** Con la sesión `PM07 Smoke QA` en `Local A1 · QA Empresa A, S.L.`, el menú filtrado no mostraba Configuración ni Locales, pero al abrir directamente estas rutas se observó:

- `#/panel/configuracion`: controles activos de «Guardar corte del día», «Guardar número de cajas» y «Guardar umbral».
- `#/panel/locales`: «Ficha del local», «Desactivar» y «+ Añadir local nuevo» activos en la vista.
- `#/panel/respaldos`: «Guardar copia», «Restaurar esta copia», «Restaurar desde texto», «Exportar datos a Excel» y gestión del PIN de propietario visibles y activos.

La pantalla de Configuración decía que solo el Propietario podía cambiar los ajustes, pero no ocultaba los controles en esta sesión. No se pulsó ninguno y no se intentó demostrar un bypass de servidor; por tanto, la escritura no autorizada no está confirmada.

### Causa y corrección

La causa está confirmada en `fuente.js`: `esPropietarioPM29` consultaba el rol del perfil Auth propietario antes que el estado `modoEmpleado`. En un dispositivo del propietario, el empleado podía heredar ese booleano aunque el rol efectivo visible fuera Encargado. Se corrigió en `fuente.js` y `source-recovery/fuente-recuperado.js` para que `modoEmpleado` fuerce `esPropietarioPM29=false`, manteniendo el comportamiento legado propietario cuando no hay modo empleado.

Se añadió `tests/pm20/p12-employee-owner-guard-contract.mjs` y se incorporó al workflow PM20. La prueba local del contrato pasa. El commit `8dc290a` ya está desplegado y en estado `ready` en el branch-deploy de QA. La comprobación visual posterior no se marca como aprobada: al recargar la ruta profunda, la pestaña volvió al modo propietario y la aplicación solicitó de nuevo el código del empleado para reactivar `QA Encargado`. No se han adivinado códigos ni se han pulsado controles de escritura. Falta repetir la comprobación con esa sesión activa y confirmar también Cajero y Camarero.

### Criterio de aceptación

Desde una sesión Encargado, Cajero y Camarero, una navegación directa a Configuración, Locales y Respaldos debe mostrar solo el estado no autorizado o una vista de consulta expresamente permitida, sin controles de propietario activos. Las RPC y funciones de servidor deben seguir denegando cualquier escritura fuera del rol, empresa y local autorizados.

Posteriormente se observaron ejecuciones de GitHub Actions asociadas a los commits `c0d6d7b` y `a1b6027`: ambas terminaron con conclusión **success** en el evento `push` de la rama QA. La ejecución del segundo commit, que ya incluye la batería E2E aislada, está registrada en [GitHub Actions](https://github.com/Plopezm1990/Almacen/actions/runs/42121179322). El resultado confirma la automatización de contratos y runtime descrita arriba, pero no sustituye la matriz de sesiones reales ni las pruebas de los servicios con JWT.

## Sesión de navegador QA y límite de roles

En la aplicación desplegada en el branch deploy se verificó una sesión de propietario ya disponible, sin escribir datos ni activar operaciones económicas. El encabezado mostró el contexto `Local A1 · QA Empresa A, S.L.` y el panel permitió observar la navegación general, el selector de local y el acceso a modo empleado.

El modo empleado mostró los perfiles sintéticos disponibles, pero solicita un código de acceso antes de entrar en cualquiera de ellos. No se adivinó ni se reutilizó ningún código no documentado. Por tanto, la evidencia de navegador directo queda confirmada para propietario y la prueba de cada rol operativo mediante interfaz sigue pendiente; las denegaciones de servidor de la tabla anterior sí están verificadas mediante simulación controlada de identidad.

La documentación histórica del repositorio menciona además una identidad sintética de Camarero utilizada en otro smoke test, pero no proporciona su contraseña ni una sesión reutilizable. Esa referencia no se empleó para iniciar sesión ni se considera acceso disponible para esta matriz.

## Pendiente para cerrar la matriz

1. Repetir los mismos casos desde sesiones JWT reales en el navegador para cada rol, sin crear cuentas nuevas en esta fase.
2. Probar PostgREST, Edge Functions, Storage/KV y Realtime con identidades de cada rol.
3. Añadir casos de usuario de otra empresa, revocación durante sesión y dos pestañas con contextos distintos.
4. Si se necesita cerrar también la matriz de entorno conectado, añadir un mecanismo de prueba aislado o una sesión controlada que permita inyectar el fallo de sincronización sin llenar el almacenamiento ni provocar una escritura real fallida.

## Revisión de seguridad del proyecto Supabase QA — 2026-11-06

La comprobación fue de lectura mediante los asesores de Supabase; no se aplicaron migraciones, cambios de permisos ni cambios de configuración.

- El proyecto QA aparece en estado `ACTIVE_HEALTHY`.
- El asesor de seguridad informa de 61 tablas con RLS activado pero sin políticas declaradas. El resultado es un aviso de configuración que debe revisarse por tabla y por esquema; no demuestra por sí solo que todas sean accesibles, porque algunas pueden ser tablas privadas o estar protegidas exclusivamente mediante funciones/RPC.
- El asesor informa de 229 funciones `SECURITY DEFINER` ejecutables por el rol `authenticated`. Entre los ejemplos aparecen funciones de cuentas, caja, pedidos, resolución de permisos y operaciones de stock. La existencia de `SECURITY DEFINER` no es automáticamente un fallo, pero obliga a verificar `EXECUTE`, validación de ámbito y controles internos con sesiones JWT reales.
- El asesor informa de que la protección de contraseñas filtradas de Supabase Auth está desactivada.
- No se encontró ningún aviso de salud del proyecto en esta consulta.

Estos avisos se incorporan como bloqueo de cierre de PN-008 hasta revisar el alcance de cada función y completar pruebas con identidades reales. No se deben interpretar como vulnerabilidades explotables confirmadas sin una prueba autorizada y reproducible de acceso indebido.

### Comprobación de funciones de autorización y navegación

La consulta de solo lectura sobre las funciones relevantes confirmó lo siguiente:

- `public.abc_obtener_pantallas_rol` es `SECURITY DEFINER`, permite ejecución a `authenticated` y valida `auth.uid()`, empresa y local mediante `private.la_tiene_local` antes de devolver capacidades.
- `public.pm13_resolver_cargo_permiso` es `SECURITY DEFINER`, permite ejecución a `authenticated` y aplica, en el código publicado, catálogo de acciones, alcance permitido, membresía activa, local activo, techo técnico, empleado vinculado y activo, dependencia de consulta, excepciones y denegación por defecto.
- `public.pm13_listar_cargo_permisos` valida el contexto mediante `private.pm13_cargo_validar_contexto` y limita el cargo a la empresa solicitada.
- `public.pm13_listar_excepciones_empleado` exige propietario activo de la empresa/local y empleado activo del mismo ámbito.
- Las funciones privadas de validación de contexto consultadas no son ejecutables por `authenticated` directamente.

Esta evidencia confirma la presencia de barreras en el código SQL de las funciones, pero no sustituye la ejecución de llamadas PostgREST con JWT reales de cada rol ni la verificación de Storage, KV, Realtime y Edge Functions. El uso de `SECURITY DEFINER` sigue requiriendo revisión específica de cada función expuesta antes de operar con datos reales.

### Cobertura RLS de las tablas usadas por el contexto

La consulta de `pg_policies` mostró políticas directas para `almacen_kv`, `empleados`, `membresias_usuario` y `perfiles`. Las tablas de capacidades y cargos consultadas (`abc_cargos`, `abc_cargo_permisos`, `abc_cargo_asignaciones`, `abc_cargo_pantallas`, `abc_pantallas_rol` y `abc_permiso_excepciones`) no devolvieron políticas RLS directas en esta consulta; su acceso previsto para el cliente se realiza mediante funciones expuestas que deben validar el contexto.

Las políticas observadas son coherentes con ese diseño: `empleados` delega la lectura en `pm13_resolver_cargo_permiso`, `membresias_usuario` limita la lectura a la propia membresía activa, `perfiles` limita lectura/gestión a la propia identidad o a un propietario autorizado y `almacen_kv` delega lectura/escritura/borrado en `private.plataforma_kv_permitido`.

Esto no permite cerrar por sí solo el aislamiento. La ausencia de políticas directas en las tablas de cargos exige probar que no exista un camino alternativo de lectura o escritura mediante PostgREST, RPC, funciones Edge, Storage/KV o Realtime con cada rol.

### Edge Functions con `verify_jwt=false`

La lista actual de Edge Functions QA contiene cuatro funciones activas con la verificación JWT del gateway desactivada. Se revisó su código publicado en modo lectura:

- `importar-albaran`: simulador exclusivo de QA; devuelve datos sintéticos, no invoca IA, no usa claves y no escribe en la base de datos.
- `importar-nomina`: simulador QA que devuelve `503` y no procesa datos.
- `prefiltro-candidato`: endpoint basado en token temporal de 64 caracteres hexadecimales, fecha de caducidad y rate limit; usa una clave de servicio internamente y puede actualizar el registro del candidato, invocar IA y solicitar una notificación. No se ejecutó porque produciría efectos y podría generar consumo.
- `enviar-notificacion`: no depende de la verificación JWT del gateway, pero implementa autenticación propia mediante secreto interno o Bearer, comprueba perfil activo, membresía activa, empresa/local, roles para avisos de caja y origen permitido. No se ejecutó porque enviaría notificaciones push.

La configuración `verify_jwt=false` no se clasifica por sí sola como vulnerabilidad confirmada. En los dos simuladores de QA es coherente con su finalidad; en las otras dos funciones exige pruebas negativas y revisión de secretos, rate limit, caducidad, alcance y efectos antes de cerrar el bloque de seguridad. Estas pruebas quedan expresamente pendientes para no modificar candidatos, invocar IA, enviar comunicaciones ni generar costes.
