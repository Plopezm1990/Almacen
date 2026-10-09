# Fase 3 — panel «Plataforma» y contraseña inicial del dueño: resultado en QA
Fecha: 9/10/2026
Estado: **CONSTRUIDA, PROBADA EN LOCAL Y PROBADA CON LA PANTALLA POR COWORK (18 pasos); un fallo encontrado y corregido; pendiente repetir con Cowork lo que cambió (`PRUEBA_COWORK_FASE3_QA_REPETICION.md`) y la prueba de Pedro.** **Producción no se ha tocado.**

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
| **Aviso rojo «Un cambio no se ha podido guardar (locales)»** y «Guardado: cambios sin confirmar: N» tras elegir la contraseña y al abrir «mi aplicación» desde el panel | **Fallo mío, también habría ocurrido en producción.** Mientras se ve el panel o la pantalla de contraseña, el programa sigue cargado por detrás con la barrera de sincronización cerrada. Su guardado de «locales» espera 10 s a que se abra la barrera, agota el tiempo y deja el aviso, aunque luego se abra | La página **se recarga** en cada cambio de pantalla (abrir mi aplicación, volver al panel, cerrar sesión, contraseña elegida). Arranca limpia con la barrera ya validada. La elección «abrir mi aplicación» sobrevive a la recarga con una marca en `sessionStorage` (solo el id de usuario). Pruebas nuevas que cuentan las recargas. **Pendiente comprobar con la pantalla** |
| Al entrar la dueña, por un momento se vio «Local A1 · QA Empresa A» (datos de la administradora) hasta recargar | La vista previa de QA tiene desactivada la barrera que impide leer datos locales antes de validar (`esPreviewQA` en `reset-pruebas-preview.js`); en la misma pestaña quedaban los datos de la sesión anterior. En producción esa barrera está activa | Mejorado por la recarga (se recarga también al cerrar sesión desde el panel). Se vuelve a mirar en la repetición con ventana de incógnito y, sobre todo, en el ensayo de producción (Fase 7) |
| Algunos botones no se dejaban pulsar con el ratón (error de «marco incrustado») | Casi seguro la barra que Netlify añade a las vistas previas; no existe en producción. Además el atajo «← Plataforma» estaba abajo a la izquierda, sobre la barra inferior del programa | El atajo sube por encima de la barra inferior y queda por debajo de las ventanas del programa. La repetición pide comprobarlo |
| El nombre de una empresa quedó «QA F3 Cliente 2QA F3 Cliente 2» | El nombre se escribió dos veces en el campo (herramienta de Cowork); el formulario se abre vacío | Sin cambio. La repetición pide escribirlo una sola vez |
| La copia no se pudo abrir en el equipo de Cowork | Se guarda en el equipo de quien la descarga | Sin cambio; el contenido se verificó con el detalle por tabla |

Estado de QA tras la prueba: plazo de gracia restaurado a **30 días**; `QA F3 Cliente 1` borrada con su acta; queda `QA F3 Cliente 2…` desactivada con dos dueños de pruebas.

## Límites conocidos
- **Que el dueño cambie la contraseña inicial es una exigencia de pantalla, no del servidor.** Una persona con conocimientos técnicos podría saltarse la pantalla llamando a la API a mano; solo se perjudicaría a sí misma (Pedro seguiría conociendo su contraseña). Si se quiere blindar, hay que añadir una comprobación en el servidor (decisión para más adelante).
- El panel gestiona empresas y su dueño; no gestiona los usuarios dentro de cada empresa (eso lo hace cada dueño en su programa).
- La copia se descarga como un único archivo JSON; vale para empresas pequeñas y medianas (si una empresa crece mucho habrá que paginarla).
- Los datos que viven en colecciones comunes (`almacen_kv` sin etiqueta, y en producción `movimientos_registro` / `fichajes_registro`) siguen sin poder atribuirse a una empresa: es la Fase 4 (aislamiento por empresa), condición previa de la primera empresa cliente real.
- En QA el plazo de gracia se pone a 0 solo durante la prueba con Cowork y se restaura a 30.
- Nada de esto está en producción: se publica en la Fase 5, con autorización escrita de Pedro.
