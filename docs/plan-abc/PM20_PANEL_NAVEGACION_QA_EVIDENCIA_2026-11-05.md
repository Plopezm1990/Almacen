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

Se añadió `tests/pm20/p12-employee-owner-guard-contract.mjs` y se incorporó al workflow PM20. La prueba local del contrato pasa. Tras la primera corrección se creó en QA el empleado sintético `QA Panel Navegacion 20261106`, con rol Encargado y código temporal no documentado en claro. El registro se conserva identificado para estas pruebas; no se creó una cuenta Auth, no se envió ninguna comunicación y no se realizó ninguna operación económica.

La corrección final quedó desplegada en los commits `34ce66b` y `371e930`, ambos en estado `ready` en el branch-deploy de QA. Con una pestaña nueva y la sesión `QA Panel Navegacion 20261106 · Encargado` se repitieron las rutas directas sin usar el caché anterior: Configuración mostró solo el aviso de acceso exclusivo del Propietario; Locales mostró únicamente una vista informativa de los locales activos, sin fichas editables, desactivación ni alta; y Respaldos mostró solo el aviso de acceso exclusivo del Propietario. No se pulsaron controles de guardado, restauración, exportación, PIN o cambio de contexto. El hallazgo queda **corregido y verificado en QA para Encargado**. La comprobación independiente de Cajero y Camarero se completó posteriormente con sesiones Auth reales, en la sección específica de esta evidencia.

### Criterio de aceptación

Desde una sesión Encargado, Cajero y Camarero, una navegación directa a Configuración, Locales y Respaldos debe mostrar solo el estado no autorizado o una vista de consulta expresamente permitida, sin controles de propietario activos. Las RPC y funciones de servidor deben seguir denegando cualquier escritura fuera del rol, empresa y local autorizados.

Posteriormente se observaron ejecuciones de GitHub Actions asociadas a los commits `c0d6d7b` y `a1b6027`: ambas terminaron con conclusión **success** en el evento `push` de la rama QA. La ejecución del segundo commit, que ya incluye la batería E2E aislada, está registrada en [GitHub Actions](https://github.com/Plopezm1990/Almacen/actions/runs/42121179322). El resultado confirma la automatización de contratos y runtime descrita arriba, pero no sustituye la matriz de sesiones reales ni las pruebas de los servicios con JWT.

## Sesión de navegador QA y límite de roles

En la aplicación desplegada en el branch deploy se verificó una sesión de propietario ya disponible, sin escribir datos ni activar operaciones económicas. El encabezado mostró el contexto `Local A1 · QA Empresa A, S.L.` y el panel permitió observar la navegación general, el selector de local y el acceso a modo empleado.

El modo empleado mostró los perfiles sintéticos disponibles y, tras crear expresamente `QA Panel Navegacion 20261106` en QA, se verificó mediante interfaz el rol Encargado en Local A1. La prueba cubrió navegación principal, ruta profunda y las tres áreas restringidas descritas en PN-011. Cajero y Camarero todavía requieren una sesión sintética o acceso de prueba independiente; las denegaciones de servidor de la tabla anterior sí están verificadas mediante simulación controlada de identidad.

La documentación histórica del repositorio menciona además una identidad sintética de Camarero utilizada en otro smoke test, pero no proporciona su contraseña ni una sesión reutilizable. Esa referencia no se empleó para iniciar sesión ni se considera acceso disponible para esta matriz.

### Verificación independiente de Cajero y Camarero — 2026-11-06

Para cerrar la comprobación visual de roles se crearon desde la pantalla **Personal** dos perfiles sintéticos en QA, ambos en `Local A1 · QA Empresa A, S.L.`:

- `QA Panel Navegacion Cajero 20261106`, rol Cajero/a, código de acceso sintético no incluido en esta documentación.
- `QA Panel Navegacion Camarero 20261106`, rol Camarero/a, código de acceso sintético no incluido en esta documentación.

Inicialmente fueron perfiles de modo empleado guardados en el estado de QA; después se vincularon a cuentas Auth sintéticas para poder repetir la prueba con JWT real. No se enviaron comunicaciones y no se realizaron cobros, reembolsos, cambios de caja ni operaciones de negocio. Se conservaron identificados para mantener la trazabilidad de la prueba y no se borraron durante esta sesión.

Con el perfil Cajero/a se verificó el acceso correcto al contexto activo, el nombre del perfil en el encabezado, el rol visible y la navegación filtrada. El menú adicional solo mostró opciones operativas permitidas para ese rol; no mostró Configuración, Locales ni Respaldos. No se pulsaron acciones de fichaje, caja, TPV, guardado, exportación ni restauración.

Con el perfil Camarero/a se verificó el mismo contexto, el nombre del perfil, el rol visible y la navegación filtrada. La navegación operativa mostró TPV, Cocina, Registro horario y el acceso a Más; el diálogo Más no ofreció controles ni rutas de propietario. No se pulsaron acciones económicas ni de modificación.

La comprobación de ruta directa se repitió en esta sesión con ambas identidades. Para cada rol se solicitaron `#/panel/configuracion`, `#/panel/locales` y `#/panel/respaldos` en una pestaña con la sesión ya activa. En los seis casos la aplicación volvió al panel general, mantuvo el encabezado del rol y no mostró ningún control de propietario, formulario de empresa/local ni acción de guardar, restaurar, exportar o gestionar PIN. El resultado observado es una **denegación efectiva por redirección al panel general**, no una simple ausencia del enlace en el menú.

### Sesiones Auth reales de Cajero/a y Camarero/a — 2026-11-06

Para superar la limitación del modo empleado se crearon desde la misma pantalla de Personal dos cuentas Auth sintéticas en QA, vinculadas a los perfiles anteriores. Se usaron correos del dominio reservado `qa.invalid`; no se enviaron correos de alta, no se compartieron las contraseñas en la documentación y las sesiones se cerraron al terminar. Las cuentas se conservan en QA con finalidad exclusiva de prueba y no se utilizaron para cobros, caja, devoluciones, fichajes, exportaciones ni cambios de configuración.

Resultados observados con la aplicación desplegada en el branch de QA:

- **Cajero/a:** inicio de sesión Auth correcto; el encabezado mostró el perfil sintético, el rol Cajero/a y `Local principal · QA Empresa A, S.L.`. La navegación operativa quedó limitada al contexto visible. Las rutas directas de Configuración, Locales y Respaldos redirigieron a `#/panel/dashboard` en los tres casos.
- **Camarero/a:** inicio de sesión Auth correcto; el encabezado mostró el perfil sintético, el rol Camarero/a y el mismo contexto de empresa/local. La navegación visible incluyó la operación de TPV/Cocina y no mostró textos de Configuración, Locales o Respaldos. Las tres rutas directas volvieron igualmente a `#/panel/dashboard`.
- **Limpieza de sesión:** ambas sesiones Auth se cerraron desde la interfaz; la pestaña terminó en la pantalla de acceso sin una sesión sintética activa.

Esta evidencia eleva la verificación de PN-011 desde el modo empleado a una prueba de interfaz con identidades Auth reales para los dos roles. No demuestra todavía que una llamada PostgREST/RPC, Storage, Realtime o Edge Function deniegue por sí misma un identificador alterado. Tampoco prueba el aislamiento frente a una segunda empresa o a un local adicional, porque esa matriz requiere identidades y datos de ámbito preparados específicamente.

### Pruebas PostgREST/RPC con JWT real — 2026-11-06

Tras solicitar acceso de red únicamente para esta comprobación, se repitieron consultas HTTP de solo lectura contra el proyecto Supabase QA usando las dos cuentas sintéticas. La clave publicada se utilizó solo como identificador de cliente y los tokens de sesión no se conservaron ni se incluyeron en la evidencia.

| Comprobación | Cajero/a | Camarero/a | Interpretación |
|---|---:|---:|---|
| Inicio de sesión Auth | HTTP 200 | HTTP 200 | Identidad y contraseña sintéticas aceptadas |
| Lectura del propio contexto en `perfiles` | HTTP 200, 1 fila | HTTP 200, 1 fila | El perfil propio es accesible |
| Lectura de `membresias_usuario` | HTTP 200, 1 fila | HTTP 200, 1 fila | La membresía propia devuelve empresa/local/rol |
| Lectura directa de `empresas` | HTTP 403 | HTTP 403 | No hay acceso directo de tabla para estos roles |
| Lectura directa de `locales` | HTTP 403 | HTTP 403 | No hay acceso directo de tabla para estos roles |
| Lectura directa de `abc_cargos` | HTTP 403 | HTTP 403 | Catálogo de cargos no expuesto por PostgREST |
| Lectura directa de `abc_pantallas_rol` | HTTP 403 | HTTP 403 | Catálogo de pantallas no expuesto por PostgREST |
| Lectura de `almacen_kv` | HTTP 200, 5 filas | HTTP 200, 5 filas | Permitida por la política existente; ninguna fila observada pertenecía a otra empresa/local. Hay filas globales, por lo que la regla de claves permitidas debe seguir revisándose |
| RPC `abc_obtener_pantallas_rol` en el propio contexto | HTTP 200 | HTTP 200 | Lectura de navegación por función autorizada |
| RPC `pm13_resolver_cargo_permiso` en el propio contexto | HTTP 200 | HTTP 200 | Resolución de permiso por función autorizada |
| `abc_obtener_pantallas_rol` con `QA-EMP-B/QA-B1` | HTTP 400 | HTTP 400 | Contexto de otra empresa/local rechazado |
| `pm13_listar_cargo_permisos` con cargo UUID inexistente | HTTP 400 | HTTP 400 | Identificador de cargo no válido rechazado |
| `pm13_listar_excepciones_empleado` con empleado inexistente | HTTP 200 con JSON de decisión `ok/codigo` | HTTP 200 con JSON de decisión `ok/codigo` | La función usa respuesta de negocio; queda pendiente fijar en contrato el valor de `ok` y su semántica exacta |
| Enumeración de buckets de Storage | HTTP 200, 0 buckets visibles | HTTP 200, 0 buckets visibles | No se expusieron buckets a estas identidades en la consulta realizada |

La prueba aporta evidencia positiva de RLS/RPC para dos roles operativos y evidencia negativa directa para tablas y contexto ajeno. No se ejecutaron `INSERT`, `UPDATE`, `DELETE`, confirmaciones de pago, devoluciones, notificaciones, invocaciones de IA ni funciones Edge con efectos. Realtime no se probó porque requeriría abrir una suscripción y observar eventos; ese recorrido sigue pendiente.

### Matriz API consolidada con Encargado/a — 2026-11-06

Se añadió una tercera cuenta Auth sintética para el perfil Encargado/a y se repitió la misma matriz de lectura. Los tres inicios de sesión devolvieron HTTP 200 y los tres perfiles/membresías propias fueron accesibles. En los tres casos, las tablas directas `empresas`, `locales`, `abc_cargos` y `abc_pantallas_rol` devolvieron HTTP 403; la RPC de pantallas del contexto propio devolvió HTTP 200; y la misma RPC apuntando a `QA-EMP-B/QA-B1` devolvió HTTP 400.

La respuesta de capacidades de `abc_obtener_pantallas_rol` devolvió los siguientes valores, sin exponer el listado de pantallas ni datos de negocio:

| Rol | `puede_configurar_local` | `puede_configurar_empresa` | `PM13_PERSONAL_CONSULTAR` (`permitido`) |
|---|---:|---:|---:|
| Encargado/a | `false` | `false` | `false` |
| Cajero/a | `false` | `false` | `false` |
| Camarero/a | `false` | `false` | `false` |

Esto alinea la respuesta del backend con la ocultación de controles y la redirección de rutas observadas en la interfaz. El permiso concreto elegido para la lectura comparativa (`PM13_PERSONAL_CONSULTAR`) no se presenta como una matriz completa de permisos: solo demuestra que la RPC devuelve una decisión negativa para esa capacidad en los tres perfiles sintéticos.

## Pendiente para cerrar la matriz

1. Fijar en contratos el valor de negocio devuelto por `pm13_listar_excepciones_empleado` cuando el empleado no existe.
2. Añadir casos de usuario de otra empresa, local no autorizado, revocación durante sesión y dos pestañas con contextos distintos. Las cuentas creadas aquí solo cubren QA Empresa A / Local principal.
3. Revisar individualmente las funciones `SECURITY DEFINER` expuestas a `authenticated`, especialmente las relacionadas con cargos, capacidades, ámbito y operaciones QA. La consulta de solo lectura confirmó que `abc_qa_confirmar_pago_simulado` valida identidad, membresía y propietario, pero no se invocó porque puede producir un efecto económico de prueba.
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

La comprobación adicional de solo lectura sobre funciones relevantes observó estos indicadores: `abc_iniciar_cobro` contiene una comprobación de capacidad; `abc_qa_confirmar_pago_simulado` exige identidad, membresía y condición de propietario; y las funciones de consulta de permisos/ámbitos exigen identidad y contexto según su definición publicada. Estos indicadores describen el código inspeccionado, no constituyen una prueba de ejecución con JWT de cada rol. No se llamó a ninguna función de cobro, confirmación, devolución, notificación o escritura durante esta revisión.

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
