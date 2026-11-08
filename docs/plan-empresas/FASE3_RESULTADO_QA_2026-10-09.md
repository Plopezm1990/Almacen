# Fase 3 — panel «Plataforma» y contraseña inicial del dueño: resultado en QA
Fecha: 9/10/2026
Estado: **HECHA Y PROBADA DE PUNTA A PUNTA EN QA** (local con jsdom y Chromium real, y con la pantalla por Cowork en dos vueltas). La repetición descubrió que la copia local del navegador se hereda entre cuentas de distintas empresas; arreglado en QA y comprobado. El aviso «colecciones solo en este equipo» es el límite conocido de las colecciones comunes (Fase 4). **Producción no se ha tocado.**

Autorización de Pedro (9/10/2026): «Sí, empezar la Fase 3», solo en la vista previa de QA.

## Qué se ha construido
| Pieza | Para qué |
|---|---|
| `plataforma-panel.js` (archivo nuevo) | El panel «Plataforma» del administrador y la pantalla «Elige tu contraseña». Va aparte para no tocar el programa grande (`fuente.js`) más que en una línea |
| `owner-bootstrap-prelock.js` | Lista cerrada de lo que el navegador puede llamar por el canal previo a la barrera: las 9 funciones `plataforma_*` del panel y la única Edge Function permitida (`plataforma-crear-propietario`). **Asignar dueño no está en la lista**: solo lo llama la función de servidor |
| `owner-bootstrap-post-reset.js` | Antes de preguntar por la instalación: 1) si el dueño debe cambiar su contraseña inicial, esa pantalla; 2) si es administrador, su panel. Una renovación de sesión no reconstruye una pantalla abierta. **Al pasar de panel a aplicación, de aplicación a panel, al cerrar sesión desde el panel y al terminar de elegir la contraseña, la página se recarga** (ver «Primera prueba con Cowork») |
| `plataforma_estado()` (servidor) | Ahora dice también si la plataforma está activa y cuántas empresas propias tiene el administrador. Aplicada en QA (huella md5 `3792b41e…`, igual que la base local) |
| `fuente.js` + espejo | La pantalla de Empresas no ofrece «+ Añadir empresa» cuando la plataforma está activa (una línea, con la misma protección en las dos copias) |

## Qué ve cada persona
- **Administrador de la plataforma** (Pedro): al entrar ve el panel, aunque no tenga ninguna empresa propia. Lista de empresas con estado, locales, usuarios, dueños y motivo de baja. Botones según el estado:
  - Activa: **Desactivar**, **Añadir dueño**.
  - Desactivada con baja registrada: **Reactivar**, **Descargar copia**, **Eliminar para siempre…**
  - Desactivada sin baja registrada (restos de antes): **Reactivar**, **Registrar la baja** (no se puede borrar hasta tener la fecha de baja).
  - Arriba: **+ Dar de alta una empresa** (empresa, local, CIF opcional, nombre y correo del dueño y contraseña inicial legible `xxxx-xxxx-xxxx` ya propuesta), **Actualizar**, **Cerrar sesión** y, si tiene empresa propia, **Abrir mi aplicación** (y un botón «← Plataforma» para volver).
- **Dueño de una empresa cliente**: la primera vez, «Elige tu contraseña» antes de cualquier otra cosa; después, el programa de siempre, sin «+ Añadir empresa».
- **Sin las funciones de plataforma en el servidor (producción hoy)**: todo funciona exactamente como antes; el programa solo cambia si el servidor responde que existe una plataforma.

## Las puertas del panel
- Desactivar y **preparar el borrado** piden la contraseña del administrador. Se comprueba aparte (una llamada a Auth que se descarta), sin reiniciar ni tocar la sesión abierta.
- Borrar: nombre exacto + código de un solo uso (el servidor lo emite y caduca a los 15 minutos) + plazo de gracia + copia descargada **o** motivo escrito de 10+ caracteres. Si algo no se cumple, no se envía nada al servidor.
- Los reintentos usan el mismo identificador de operación: si se pierde la respuesta, el servidor devuelve el mismo resultado y no borra dos veces.
- Alta: primero la empresa, después la cuenta del dueño. Si falla lo segundo, el diálogo avisa de que la empresa ya existe, no la repite al reintentar y deja «Añadir dueño» para más tarde.
- Todo texto que viene del servidor (nombres, correos) se pinta como texto, nunca como HTML.

## Cómo se probó
1. `p04-panel-contract` (Node, sin librerías): reglas de contraseña **idénticas a las del servidor** (17+ casos comparados), contraseña generada (400 pruebas), identificadores de operación, validaciones, botones por estado, textos de error, lista blanca del candado (ni «asignar dueño» ni otras Edge Functions), que el panel no usa HTML dinámico ni guarda nada en el navegador, orden del arranque y de los scripts.
2. `p05-panel-ui-runtime` (jsdom, 89 comprobaciones): la pantalla real montada con un servidor simulado; cada flujo (lista, alta, alta con fallo y reintento, desactivar, registrar baja, reactivar, copia, añadir dueño, borrado con todas sus puertas, contraseña inicial) comprobando **qué se envía y qué NO se envía**.
3. `p06-arranque-plataforma-runtime` (jsdom, 34 comprobaciones): el candado, el panel y el flujo de arranque REALES con red simulada a nivel de fetch; administrador sin empresa, dueño cliente, servidor sin plataforma, error del servidor, contraseña inicial, «Abrir mi aplicación» y volver, renovación y cierre de sesión, lista blanca.
4. `p07-empresas-sin-alta-runtime` (jsdom, 8 comprobaciones): el componente real de Empresas con la plataforma activa y sin ella.
5. **52 variantes rotas (mutantes) del código, las 52 detectadas** (contraseña sin comprobar, nombre o código sin comprobar, identificador nuevo en cada reintento, empresa repetida al reintentar, motivo no exigido, HTML sin escapar, error disfrazado de «no administrador», panel que no oculta el programa, atajos, lista blanca ampliada, etc.). Dos sobrevivieron a la primera ronda (contraseña mínima de 8 y correo sin minúsculas al añadir dueño) y se cerraron con casos nuevos.
6. **Chromium real** (no solo jsdom): el panel, el alta, el borrado bloqueado, el formulario de borrado y la contraseña inicial se revisaron en pantalla de 390 px y de 1100 px, sin errores de consola.
7. Batería Node completa del repositorio: 209/209 contratos activos (205 anteriores + 4 nuevos), incluida la puerta del manifiesto (251 archivos, 234 contratos activos). Repetida tras la corrección de la recarga. El contrato de Postgres de la fase 1 se actualizó y pasa (`mis_empresas`, `plataforma_activa`).
8. Un fallo real encontrado y corregido por la batería: el programa evalúa la pantalla de Empresas también sin navegador (una prueba de PM29), así que la línea nueva comprueba que `window` existe antes de leerlo.

## Primera prueba con Cowork (9/10/2026, vista previa de QA, commit `bbd057f`)
Cowork recorrió con la pantalla las partes A–E del guion (18 pasos) y todo fue como se describe: alta de empresa y dueña, error por correo repetido sin duplicar la empresa y reintento, «Elige tu contraseña» con las contraseñas malas rechazadas, entrada con la buena y segundo acceso directo, sin «+ Añadir empresa» en el programa de la dueña, desactivar (contraseña mala → no desactiva), copia descargada, reactivar, borrado con nombre mal / contraseña mala / código mal rechazados una por una y borrado final correcto (la empresa desaparece de la lista y su dueña ya no puede entrar: «Correo o contraseña incorrectos.»), añadir segundo dueño, motivo corto rechazado («Escribe un motivo de al menos 10 caracteres o descarga la copia.»), «Abrir mi aplicación» y «← Plataforma», cerrar sesión, y pantalla de 390 px sin desbordes. El detalle por tabla de la empresa borrada fue 2 tablas (`locales: 1`, `membresias_usuario: 1`), igual que el aviso de la copia.

**Hallazgos y qué se hizo**
| Hallazgo | Causa | Qué se hizo |
|---|---|---|
| **Aviso rojo «Un cambio no se ha podido guardar (locales)»** y «Guardado: cambios sin confirmar: N» tras elegir la contraseña y al abrir «mi aplicación» desde el panel | Había **dos causas**. (1) La que vi primero, por lectura del código: mientras se ve el panel o la pantalla de contraseña el programa sigue cargado por detrás con la barrera cerrada y su guardado de «locales» agota los 10 s de espera. (2) La principal, descubierta en la repetición: **la copia local del navegador se hereda entre cuentas** (ver «Segunda prueba») | Para (1): la página **se recarga** en cada cambio de pantalla (abrir mi aplicación, volver al panel, cerrar sesión, contraseña elegida); la elección «abrir mi aplicación» sobrevive con una marca en `sessionStorage` (solo el id de usuario). Para (2): **sin arreglar todavía**; es el primer paso de la Fase 4 |
| Al entrar la dueña, por un momento se vio «Local A1 · QA Empresa A» (datos de la administradora) hasta recargar | La vista previa de QA tiene desactivada la barrera que impide leer datos locales antes de validar (`esPreviewQA` en `reset-pruebas-preview.js`); en la misma pestaña quedaban los datos de la sesión anterior. En producción esa barrera está activa | Mejorado por la recarga (se recarga también al cerrar sesión desde el panel). Se vuelve a mirar en la repetición con ventana de incógnito y, sobre todo, en el ensayo de producción (Fase 7) |
| Algunos botones no se dejaban pulsar con el ratón (error de «marco incrustado») | Casi seguro la barra que Netlify añade a las vistas previas; no existe en producción. Además el atajo «← Plataforma» estaba abajo a la izquierda, sobre la barra inferior del programa | El atajo sube por encima de la barra inferior y queda por debajo de las ventanas del programa. La repetición pide comprobarlo |
| El nombre de una empresa quedó «QA F3 Cliente 2QA F3 Cliente 2» | El nombre se escribió dos veces en el campo (herramienta de Cowork); el formulario se abre vacío | Sin cambio. La repetición pide escribirlo una sola vez |
| La copia no se pudo abrir en el equipo de Cowork | Se guarda en el equipo de quien la descarga | Sin cambio; el contenido se verificó con el detalle por tabla |

Estado de QA tras la prueba: plazo de gracia restaurado a **30 días**; `QA F3 Cliente 1` borrada con su acta; queda `QA F3 Cliente 2…` desactivada con dos dueños de pruebas.

## Segunda prueba con Cowork (repetición parcial, commit `c30f0f6`) y la causa real
Cowork repitió con la pantalla los pasos 1–3 y se paró en la primera diferencia: tras elegir la contraseña (con la espera de 30 s y la página recargada) **el aviso rojo y «cambios sin confirmar: 1» seguían saliendo**, y en «Locales» aparecieron **dos «Local recuperado»** además de «Local F3». Todo lo demás fue correcto (nombre de empresa sin duplicar, «Elige tu contraseña», recarga automática, texto de «las empresas las da de alta el administrador…», sin «+ Añadir empresa», cierre de sesión).

**Causa comprobada** (código y base de datos de QA, solo lectura):
1. En la base de datos la empresa `QA F3 Cliente 3` tiene **un solo local** (`Local F3`). Los dos «Local recuperado» solo existen en el navegador.
2. El programa los crea al arrancar (`fuente.js`, «Local recuperado», `recuperadoDeProductos`): por cada `localId` que aparece en los productos y no está entre los locales de la empresa, inventa un local.
3. Los productos salen de la **copia local del navegador** (`almacen:productos`): en la vista previa de QA, `reset-pruebas-preview.js` siembra en cada navegador, una vez, productos de demostración de `QA-EMP-A` con los locales `QA-A1` y `QA-A2` (exactamente los dos «Local recuperado»), y además la sesión de la administradora deja ahí su propia copia al abrir su aplicación (la nube tiene 30 productos de `QA-EMP-A` con esos mismos locales). Cualquier otra cuenta que entra después en ese navegador los hereda.
4. La nube no se los habría dado a la dueña nueva: la regla de acceso de `almacen_kv` solo deja leer filas de las empresas de las que eres miembro. Pero cuando la nube no devuelve nada, el programa **cae a la copia local** (`index-storage-bootstrap.js`, `storage.get`), y esa copia **no está separada por cuenta** para la mayoría de las colecciones (solo lo está un subconjunto: proveedores, clientes, albaranes…). Tampoco se borra al cerrar sesión.
5. Con esos locales inventados, el programa intenta guardar la lista de locales y el servidor la rechaza (no pertenecen a su empresa): de ahí el aviso «(locales)».
6. La barrera actual contra herencia (`edge-auth-patch.js`) protege a un **empleado** frente a lo que dejó un **Propietario** en el mismo navegador, pero no a un Propietario frente a otro Propietario de otra empresa. Con una sola empresa nunca hizo falta.

**Alcance real:** ocurre cuando dos cuentas distintas usan el mismo navegador (como hace Cowork, o Pedro al probar con varias cuentas, o un equipo compartido). Los datos de la empresa A **llegan a la vista de la empresa B en el navegador** aunque la nube los proteja. En la vista previa de QA es más visible porque su barrera de lectura local está desactivada; en producción la barrera solo retrasa la lectura hasta validar, no la impide. **Es un hueco de aislamiento entre empresas y debe cerrarse antes de la primera empresa cliente real.**

**Qué no es:** no es un fallo del panel ni de la pantalla de contraseña; la corrección de la recarga sigue siendo útil contra la causa (1).

## Arreglo de la copia local por cuenta (primer paso de la Fase 4, hecho en QA)
Pedro autorizó arreglarlo ya, solo en QA («Arreglarlo ahora en QA»).

**Qué hace.** Al validar una sesión, la copia local viva (`almacen:*`, `almacen__*` y el contexto operativo seguro) pasa a ser **solo de esa cuenta**. Si era de otra, se **aparta entera** (no se borra) bajo `la_suite_copia_cuenta_v1:<cuenta>:<clave>` y la cuenta que entra empieza limpia (o recupera la suya, byte a byte, si ya había entrado antes). Si algo cambia, la página se recarga (el mismo mecanismo que ya usaba el cambio de generación) y la sincronización no se abre en esa pasada. La cola de subidas pendientes viaja con su cuenta: nunca se sube nada ajeno.

**Dónde.** `owner-bootstrap-prelock.js` (función `__laOwnerBootstrapSepararCopiaLocal`) y la llamada desde `prepararSesionPostReset` en `edge-auth-patch.js`. Se hizo en el candado previo porque la barrera temprana de producción **devuelve «nada» al leer** claves del programa y **descarta lo que se escribe** hasta validar la sesión: con las funciones normales, mover claves habría perdido datos. El candado conserva las funciones originales del navegador.

**Detalles que importan.**
- Copias anteriores a la mejora (sin marca de dueño): se reconocen por la cuenta que sembró el contexto la última vez (`almacen__ui_context_seed`); si tampoco hay, se apartan como «sin dueño» y no se devuelven a nadie (nunca se borran).
- Interrupciones: el apartado y la devolución se pueden cortar en cualquier punto y la siguiente pasada los termina sin perder nada; lo que ya está vivo manda.
- Falta de espacio del navegador: se descarta la copia apartada **más antigua de otra cuenta** (es una caché de lo que está en la nube); nunca la viva ni lo ya apartado de las cuentas implicadas. Si ni así cabe, falla cerrado (no abre la sincronización y no pierde nada).
- Un cambio de generación (reinstalación) descarta también las copias apartadas y todas las marcas `almacen__*`.
- La vista previa de QA ya no hace heredar a otra empresa sus productos de demostración.

**Pruebas.** `p08-copia-local-por-cuenta-runtime` (jsdom con los archivos reales y la barrera temprana real, 28 comprobaciones): cruce de cuentas, intacta al volver, cola de subidas, copias sin marca, demostración de QA, interrupciones, cambio de generación, espacio, entradas no válidas y que solo usa las primitivas originales. **18 variantes rotas, las 18 detectadas** (dos sobrevivieron a la primera versión de las pruebas y se cerraron con casos nuevos). Comprobado además en **Chromium real** con la barrera temprana de producción: B entra sin heredar nada, A vuelve con sus 4 claves.

**Resultado en la vista previa (repetición, commit `02d8ca3`, mismo navegador para todas las cuentas).** Cowork repitió los pasos 1–4 con `QA F3 Cliente 4`: alta correcta con el nombre sin duplicar, «Elige tu contraseña», 30 s de espera, recarga automática y entrada al programa **sin aviso rojo**, con «Guardado: cambios sin confirmar: 0», **un solo local («Local F3»)**, ningún «Local recuperado» ni local de otra empresa, texto «Las empresas las da de alta el administrador de la plataforma.» y sin «+ Añadir empresa». El arreglo funciona. Los pasos 5–8 se hicieron en una continuación (ver «Pasos 5 a 8»).

**Aviso nuevo: «3 colecciones solo en este equipo (el servidor no permite guardarlas)».** No lo causa el panel ni la copia local por cuenta; es el síntoma ya conocido (se investigó como «1 colección…» el 9/10) de que las colecciones comunes del programa no se pueden guardar en la nube para una empresa nueva. **Comprobado en los registros de QA:** durante la sesión de la dueña hubo 6 peticiones `POST /rest/v1/almacen_kv` rechazadas con 403 (3 colecciones, dos intentos cada una). La regla de acceso de `almacen_kv` en QA solo admite filas con `empresa_id` de una empresa de la que se es miembro, y el programa guarda estas colecciones sin esa etiqueta. Las 7 colecciones comunes que usa el programa son: productos, conteos, traspasos, catálogo de proveedores, diseño del menú, historial de respaldos y tema oscuro. En una empresa nueva quedan solo en ese equipo.

**Por qué importa para producción:** la regla de producción es distinta (permite por rol y clave, no por empresa). Allí esas colecciones sí se guardarían, pero **en una sola fila compartida por todas las empresas**, así que dos clientes mezclarían su catálogo de productos y demás. Por eso el paso «colecciones comunes por empresa» de la Fase 4 es **condición previa de la primera empresa cliente real** y no se puede saltar. Además, para dejar producción a cero (Fase 6) habrá que vaciar también esas 7 filas sueltas de producción.

**Pasos 5 a 8 (continuación con Cowork), todos como se esperaba.** Cerrar sesión de la dueña → pantalla de acceso; entrar como `owner.a@qa.invalid` en el MISMO navegador → panel «Plataforma»; tras 30 s, «Abrir mi aplicación» → la página se recarga y abre `QA Empresa A, S.L.` **sin aviso rojo y con «cambios sin confirmar: 0»**, y «Locales» muestra solo Local A1 y Local A2 (ni rastro de «Local F3»: la copia de cada cuenta está separada); «← Plataforma» recarga y vuelve al panel; desactivar `QA F3 Cliente 4` pidiendo la contraseña («Desactivada el 09/10/2026. Motivo: Repetición F3»); «Eliminar para siempre…» dice «Todavía no ha pasado el plazo de gracia de 30 días. Se podrá borrar a partir del 08/11/2026.» sin formulario; reactivar → «Activa»; «Cerrar sesión» del panel recarga y vuelve al acceso.

**Observaciones de esa continuación y qué se hizo**
| Observación | Qué se hizo |
|---|---|
| El botón «← Plataforma» (abajo a la izquierda) tapaba parte del contenido de «Empresas y locales» en pantalla estrecha | Pasa a ser una **solapa estrecha de 24 px en el borde izquierdo, a media altura** (texto girado), en vez de un botón flotante. Revisado en Chromium |
| Varios botones del panel no se dejaban pulsar con el ratón en el navegador de Cowork («el clic aterriza en un marco incrustado sin origen resoluble»); funcionaban con el teclado | **No se reproduce en nuestro código:** en Chromium real, con los archivos reales, los 21 botones del panel (de 7 empresas) reciben el clic en su centro a 390 px y a 1100 px, y nuestra página no tiene ningún `iframe`. Viene del entorno de la vista previa (Netlify) o de la herramienta de Cowork; en producción no existe ese marco |
| Tras «Cerrar sesión» apareció un instante «Netlify SSO Redirect» | Es la protección de acceso de las vistas previas de Netlify; no existe en producción |
| El aviso «3 colecciones solo en este equipo» pasó a «4» | Esperado: son las colecciones comunes que no se pueden guardar para una empresa nueva (Fase 4) |

**Límites.** La separación es de este navegador: no hay nada que hacer en la nube. Si una cuenta entra en el navegador de otra persona y esa persona vuelve a entrar, su copia se le devuelve (por eso se aparta y no se borra). Las copias apartadas pueden ocupar espacio del navegador; con poco espacio se descartan las más antiguas.

## Límites conocidos
- **Que el dueño cambie la contraseña inicial es una exigencia de pantalla, no del servidor.** Una persona con conocimientos técnicos podría saltarse la pantalla llamando a la API a mano; solo se perjudicaría a sí misma (Pedro seguiría conociendo su contraseña). Si se quiere blindar, hay que añadir una comprobación en el servidor (decisión para más adelante).
- El panel gestiona empresas y su dueño; no gestiona los usuarios dentro de cada empresa (eso lo hace cada dueño en su programa).
- La copia se descarga como un único archivo JSON; vale para empresas pequeñas y medianas (si una empresa crece mucho habrá que paginarla).
- Los datos que viven en colecciones comunes (`almacen_kv` sin etiqueta, y en producción `movimientos_registro` / `fichajes_registro`) siguen sin poder atribuirse a una empresa: es la Fase 4 (aislamiento por empresa), condición previa de la primera empresa cliente real.
- En QA el plazo de gracia se pone a 0 solo durante la prueba con Cowork y se restaura a 30.
- Nada de esto está en producción: se publica en la Fase 5, con autorización escrita de Pedro.
