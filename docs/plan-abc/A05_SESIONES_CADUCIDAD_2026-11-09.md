# A-05 — Las sesiones no caducan

Fecha de corte: 2026-11-10
Producción: `flqercbgpgmmfaakrwkc` («L&A Suite»)  
QA: `qjqorixtkilwsndqayyx` («L&A Suite QA»)  
Fuente de código comparada: `origin/release` en `29354efead2e5e860d9e2d24d4199675e5eb0beb`

## Criterio y límite

El criterio del hallazgo es que la sesión caduque por inactividad en un plazo definido y que un terminal compartido exija reidentificación. Al reanudar este punto, el usuario autorizó la política candidata que se detalla abajo: 15 minutos sin interacción humana, login completo de Supabase para volver a entrar y un timeout server-side de Auth como defensa adicional.

No se revocó ninguna sesión, no se modificó ningún usuario y no se cambió la configuración de Auth de ninguno de los dos proyectos.

## Política adoptada para la corrección candidata

Al reanudar este objetivo el 2026-11-10 se adopta como política candidata la propuesta ya documentada: bloqueo de interfaz tras 15 minutos sin interacción humana, reidentificación mediante el login completo de Supabase, `sessions_inactivity_timeout` positivo como defensa server-side y `sessions_timebox` inicialmente desactivado. Esta adopción autoriza preparar y probar la corrección en QA; no autoriza escribir en producción ni convierte la política en una certificación de producción.

Para mantener una sola cifra auditable, la configuración candidata de QA será `sessions_inactivity_timeout = 900` segundos. El JWT permanece en 3600 segundos: el bloqueo de la interfaz es el control inmediato del terminal y el timeout Auth es una defensa adicional, no una promesa de logout visual exactamente al segundo 900.

La aplicación de ese valor en QA no fue posible: la pantalla Authentication → Sessions del proyecto `qjqorixtkilwsndqayyx` muestra los campos `Inactivity timeout` y `Time-box user sessions` deshabilitados y el aviso “Configuring user sessions is only available on the Pro Plan and above”. Un intento anterior de actualización mediante la API de gestión, usando el token de auditoría de solo lectura, respondió 403. No se hizo ningún cambio de configuración; por tanto, QA conserva `sessions_inactivity_timeout = 0`.

## Medición actual de `auth.sessions`

Consulta de solo lectura realizada el 2026-11-09. Se contaron filas y fechas, sin devolver tokens, hashes de refresh, direcciones IP ni agentes de usuario.

| Medición | QA | Producción |
|---|---:|---:|
| Usuarios de Auth | 25 | 5 |
| Sesiones vivas | 163 | 9 |
| Usuarios con sesión | 14 | 1 |
| Sesión creada más antigua | 2026-09-04 10:23:37 UTC | 2026-10-11 20:56:10 UTC |
| Sesiones creadas hace más de 7 días | 112 | 8 |
| Sesiones actualizadas hace más de 7 días | 105 | 6 |
| Sesiones creadas hace más de 30 días | 28 | 0 |
| Sesiones actualizadas hace más de 30 días | 28 | 0 |
| `not_after` nulo | 163/163 | 9/9 |
| `not_after` no nulo | 0 | 0 |

La cifra anterior del documento de pendientes era de 8 sesiones de producción con más de 7 días y una antigüedad máxima de 28 días. La nueva medición conserva las 9 sesiones y las 8 creadas hace más de 7 días, pero hoy solo hay un usuario con sesiones y las fechas de actualización han cambiado. Se usa la medición de hoy para esta fase; no se mezclan las dos fotografías.

Esto es **medido sobre datos reales desplegados**. La edad de una fila no demuestra por sí sola que el usuario haya estado inactivo —una sesión puede renovarse o permanecer abierta en un dispositivo—, pero sí demuestra que el sistema conserva sesiones con antigüedad de semanas y sin `not_after`.

## Configuración efectiva de Supabase Auth

Se consultó en modo lectura la configuración no secreta de Auth de ambos proyectos mediante la API de gestión. Los valores relevantes son idénticos:

| Parámetro | QA | Producción | Interpretación técnica |
|---|---:|---:|---|
| `jwt_exp` | 3600 s | 3600 s | El access token dura una hora; no es la duración máxima de la sesión.
| `sessions_inactivity_timeout` | 0 | 0 | Sin caducidad por inactividad configurada.
| `sessions_timebox` | 0 | 0 | Sin duración máxima de sesión configurada.
| `sessions_single_per_user` | `false` | `false` | No se limita a una sola sesión por usuario.
| `refresh_token_rotation_enabled` | `true` | `true` | Hay rotación de refresh tokens, pero no equivale a caducidad por inactividad.
| `security_refresh_token_reuse_interval` | 10 s | 10 s | Ventana antifallo de reutilización, no timeout de usuario.
| `password_min_length` | 6 | 6 | Configuración adicional observada; queda relacionada con M-04.
| `security_captcha_enabled` | `false` | `false` | Configuración adicional observada; no es el objeto principal de A-05.

La documentación oficial de Supabase distingue el JWT de corta duración de la sesión completa y define el timeout de inactividad y el time-box como controles separados: [User sessions](https://supabase.com/docs/guides/auth/sessions). En el estado actual, ambos controles están desactivados en QA y producción.

La misma documentación añade dos límites que condicionan el diseño: el control se comprueba cuando la sesión se renueva, no como una destrucción inmediata de todas las sesiones al cambiar la configuración, y la duración efectiva puede ser el timeout configurado más la expiración del JWT. Por eso un timeout server-side no sustituye al bloqueo de interfaz del terminal compartido; el contrato debe verificar ambos comportamientos por separado.

## Código servido y causa raíz

La comparación sobre `origin/release` encontró estos caminos:

1. `fuente.js:101394` crea el cliente con `createClient(window.NUBE_URL, window.NUBE_CLAVE)` sin un tercer objeto `auth` que desactive o limite la persistencia y renovación.
2. La copia embebida de `supabase-js` contiene los valores por defecto `autoRefreshToken: true` y `persistSession: true` en `fuente.js:58506-58507`.
3. `AppConSesion` restaura la sesión con `supabase.auth.getSession()` y deja la aplicación dentro si existe una sesión; después escucha `onAuthStateChange` (`fuente.js:128912-128934`). No hay una comprobación propia de antigüedad o inactividad antes de aceptar la sesión.
4. El manejador común de cambios de sesión invalida cachés cuando cambia el usuario (`fuente.js:43793`), pero no inicia un contador de inactividad ni fuerza una reidentificación periódica.
5. `edge-auth-patch.js:200` escucha cambios de sesión y `edge-auth-patch.js:632` cierra la sesión local cuando un perfil pasa a inactivo. Además, `fuente.js:44122` ejecuta una comprobación del perfil cada 30 segundos y en foco/visibilidad. Esa guarda revoca por estado del perfil, no por tiempo sin actividad.
6. No se encontró lógica de aplicación para `sessions_inactivity_timeout`, `sessions_timebox`, `inactivity`, `idle` o un contador de eventos de teclado/puntero que provoque logout. Las coincidencias `Idle*` restantes pertenecen al planificador interno de React, no a una política de sesión.

7. El modo empleado existente no constituye por sí mismo una reautenticación server-side: `crearLogicaSeguridad` compara el PIN contra un hash mantenido en el estado local del navegador, y la carga inicial recupera también `modoEmpleado`, `usuarioActivoId` y `pinPropietario` mediante `loadKey`. Por tanto, ese flujo puede servir como contexto operativo local, pero no debe usarse como prueba de identidad suficiente para levantar el bloqueo de un terminal compartido sin una decisión y una comprobación autorizada en servidor.

La causa raíz es, por tanto, una combinación de **configuración de Auth sin timeout** y **cliente con persistencia y renovación automáticas**, sin política de inactividad propia ni reidentificación de terminal compartido.

## Evidencia por nivel

- **Medido:** sesiones, usuarios, antigüedad, `not_after` y parámetros efectivos de Auth en QA y producción.
- **Probado por código:** inicialización de Supabase sin opciones de sesión, persistencia/renovación por defecto de la biblioteca embebida, restauración de la sesión al cargar y ausencia de contador de inactividad de la aplicación.
- **Observado:** el código dispone de logout manual y de una guarda de perfil inactivo cada 30 segundos.
- **Reproducido:** el contrato estático A-05 pasa en la rama candidata y la sintaxis de los dos artefactos servidos es válida. La comprobación del flujo real de 15 minutos y del timeout server-side no se pudo reproducir porque el timeout de QA sigue a cero y el plan Free no permite cambiarlo. Tampoco se cerraron sesiones existentes.

## Batería y comparación con control limpio

El 2026-11-10 se ejecutó la batería local completa de contratos sobre la rama candidata y sobre un worktree limpio de `origin/release`, siguiendo la disciplina de separar fallos del entorno Windows de fallos introducidos por el cambio.

| Ejecución | Inventario | Activos | Activos Node | Fallos Node | Contrato A-05 |
|---|---:|---:|---:|---:|---|
| Rama candidata `3d5f064a` | 343 | 326 | 292 | 22 | Pasa |
| Control limpio `origin/release` (`29354efe`) | 334 | 317 | 283 | 22 | No existe |

El conjunto de los 22 fallos locales coincide entre candidata y control: son los fallos Windows/dependencias ya conocidos, incluido el límite local de `tailwindcss` ausente. Esto es una comparación **medida en local**, no una certificación de QA ni de producción. El contrato nuevo A-05 no añade un fallo a la batería.

## Criterio técnico de la remediación candidata

La decisión adoptada para esta corrección candidata es:

1. Bloqueo de interfaz tras 15 minutos sin interacción humana.
2. Login completo de Supabase para reidentificar el terminal.
3. `sessions_inactivity_timeout = 900` segundos como defensa server-side cuando el plan de QA/producción lo permita.
4. `sessions_timebox = 0` inicialmente; no se añade un límite absoluto sin una decisión separada.
5. Una sesión renovada automáticamente no cuenta como actividad humana y no reinicia el contador de interfaz.

Una remediación técnicamente coherente deberá combinar:

- configuración server-side de Auth con un timeout positivo;
- una política de terminal compartido que no confunda “sesión Supabase viva” con “empleado actualmente identificado”;
- cierre/limpieza de estado local al detectar `SIGNED_OUT`, sesión inválida o timeout;
- contrato de regresión que compruebe que el cliente no acepta una sesión reanudada tras el límite sin reautenticación;
- contrato de regresión que compruebe que ni `modoEmpleado` ni `usuarioActivoId` persistidos en el navegador levantan por sí solos el bloqueo del terminal;
- prueba separada para `sessions_inactivity_timeout` y para el comportamiento de reidentificación, sin usar producción.

La política anterior queda preparada en código y contrato, pero el timeout server-side no queda aplicado en QA ni en producción por la restricción del plan. La promoción a producción requerirá una decisión operativa separada, una vía de configuración compatible y una verificación explícita posterior; esta auditoría no la ejecuta.

## Estado

Estado de A-05: **corrección candidata versionada, contrato estático pasado y batería comparada; timeout server-side de QA no aplicable por plan Free y producción expresamente sin cambios**.

No se crearon datos ni credenciales sintéticas para este punto. No se revocaron sesiones. Producción permaneció en solo lectura. La única escritura externa intentada fue el login OAuth del panel de Supabase; no se guardaron credenciales ni se cambió configuración.

Límite adicional: el mecanismo histórico `source-recovery/CURRENT_RELEASE.patch` ya presentaba deriva respecto del `fuente.js` existente en este `HEAD`; no se reescribió ese parche histórico para ocultar la deriva. La corrección A-05 se verifica por el contrato estático, la sintaxis del parche y el diff mínimo del bundle servido; la reconstrucción byte a byte completa del runtime queda como trabajo separado.

## Revalidación de despliegues y reproducción controlada — 2026-11-10

### Medición actual de sesiones

Se repitió en solo lectura la consulta sobre `auth.sessions`:

| Medición | QA | Producción |
|---|---:|---:|
| Sesiones vivas | 163 | 9 |
| Usuarios con sesión | 14 | 1 |
| Sesiones creadas hace más de 7 días | 119 | 8 |
| Sesión creada más antigua | 2026-09-04 10:23:37 UTC | 2026-10-11 20:56:10 UTC |
| Sesión creada más reciente | 2026-11-09 21:10:20 UTC | 2026-11-05 20:54:35 UTC |

Esta fotografía sigue demostrando que las filas históricas de Auth no se limpian retrospectivamente solo por haber desplegado la guarda de interfaz. No se revocó ninguna sesión ni se modificó ningún usuario. La antigüedad de una fila no se usa como sustituto de una prueba de inactividad del navegador.

### Código efectivamente servido

El HTML público de los dos entornos carga `edge-auth-patch.js`. La comparación del archivo servido dio el mismo MD5 para QA y producción (`e0b23aa34e543282b738560c76a664f7`) y contiene el marcador de instalación, el límite de 15 minutos, la exclusión de `TOKEN_REFRESHED`, `auth.signOut({ scope: "local" })` y la limpieza del contexto operativo. El archivo local de la rama tiene otra huella binaria por finales de línea, pero su contenido normalizado coincide con el archivo servido.

Esto es **observado en el paquete público** y **probado por código**; no es una inferencia basada únicamente en la rama local. La igualdad del paquete no demuestra que el timeout server-side de Supabase esté activo: la configuración medida sigue siendo `sessions_inactivity_timeout = 0` en ambos proyectos.

### Reproducción QA sin esperar 15 minutos reales

En una pestaña QA aislada, con la sesión `owner.a@qa.invalid` ya presente, se leyó primero `auth.getSession()` y devolvió sesión. Después se avanzó el reloj virtual del navegador 960000 ms (16 minutos), sin escribir en la base ni ejecutar operaciones de negocio. La lectura posterior devolvió:

```text
hasSession: false
almacen:modoEmpleado: null
almacen:usuarioActivoId: null
chocoloyos_contexto_operativo_seguro_v1: null
```

La prueba se clasifica como **reproducida en QA** mediante aceleración controlada del reloj; no equivale a una espera de 16 minutos de pared. El cierre local se propagó a la otra pestaña QA del mismo origen, que quedó sin sesión y necesitará login para volver a entrar. No se abrió una sesión ni se transmitieron credenciales durante la prueba.

### Estado actualizado

La parte de terminal compartido queda demostrada: el paquete de producción y QA contiene la misma guarda y el flujo de inactividad se reprodujo en QA con limpieza del contexto y cierre local de Auth. El control server-side sigue sin estar disponible en el plan actual: `sessions_inactivity_timeout = 0`, `sessions_timebox = 0`, y las sesiones históricas permanecen en `auth.sessions`.

Por tanto, A-05 queda **cerrado en su corrección de cliente y reidentificación del terminal**, con equivalencia del artefacto servido en QA y producción, pero queda **limitado explícitamente** por la defensa server-side no configurable y por la ausencia de una prueba de espera real. No se presenta como prueba de que Supabase vaya a revocar inmediatamente las filas históricas.
