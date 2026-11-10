# A-05 — Las sesiones no caducan

Fecha de corte: 2026-11-09  
Producción: `flqercbgpgmmfaakrwkc` («L&A Suite»)  
QA: `qjqorixtkilwsndqayyx` («L&A Suite QA»)  
Fuente de código comparada: `origin/release` en `29354efead2e5e860d9e2d24d4199675e5eb0beb`

## Criterio y límite

El criterio del hallazgo es que la sesión caduque por inactividad en un plazo definido y que un terminal compartido exija reidentificación. Esta auditoría no inventa el plazo: falta una decisión de negocio/seguridad sobre cuántos minutos de inactividad deben permitirse y sobre si la reidentificación será una nueva contraseña, un PIN de empleado server-side o un cierre completo de sesión.

No se revocó ninguna sesión, no se modificó ningún usuario y no se cambió la configuración de Auth de ninguno de los dos proyectos.

## Política adoptada para la corrección candidata

Al reanudar este objetivo el 2026-11-10 se adopta como política candidata la propuesta ya documentada: bloqueo de interfaz tras 15 minutos sin interacción humana, reidentificación mediante el login completo de Supabase, `sessions_inactivity_timeout` positivo como defensa server-side y `sessions_timebox` inicialmente desactivado. Esta adopción autoriza preparar y probar la corrección en QA; no autoriza escribir en producción ni convierte la política en una certificación de producción.

Para mantener una sola cifra auditable, la configuración candidata de QA será `sessions_inactivity_timeout = 900` segundos. El JWT permanece en 3600 segundos: el bloqueo de la interfaz es el control inmediato del terminal y el timeout Auth es una defensa adicional, no una promesa de logout visual exactamente al segundo 900.

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
- **No reproducido:** no se forzó una caducidad real ni se esperó un timeout en QA, porque ambos timeouts están a cero y alterarlos remotamente cambiaría la configuración de Auth. Tampoco se cerraron sesiones existentes.

## Criterio técnico de remediación pendiente

Antes de implementar se necesita decidir, por escrito:

1. El valor de `sessions_inactivity_timeout` para QA y producción.
2. Si también habrá `sessions_timebox` como límite absoluto.
3. Si un terminal compartido debe exigir una nueva autenticación completa o una reidentificación de empleado separada de la sesión del propietario.
4. Qué operaciones deben bloquearse mientras la reidentificación esté pendiente.
5. Cómo tratar una sesión renovada automáticamente después de que la interfaz haya quedado sin actividad.

Una remediación técnicamente coherente deberá combinar:

- configuración server-side de Auth con un timeout positivo;
- una política de terminal compartido que no confunda “sesión Supabase viva” con “empleado actualmente identificado”;
- cierre/limpieza de estado local al detectar `SIGNED_OUT`, sesión inválida o timeout;
- contrato de regresión que compruebe que el cliente no acepta una sesión reanudada tras el límite sin reautenticación;
- contrato de regresión que compruebe que ni `modoEmpleado` ni `usuarioActivoId` persistidos en el navegador levantan por sí solos el bloqueo del terminal;
- prueba separada para `sessions_inactivity_timeout` y para el comportamiento de reidentificación, sin usar producción.

No se fija aquí un número de minutos ni se aplica ninguna configuración por falta de esa decisión y para no convertir una suposición en requisito.

## Estado

Estado de A-05: **corrección candidata versionada y contrato estático preparados; pendiente de aplicar/verificar exclusivamente en QA y de dejar producción expresamente sin cambios**.

No se crearon datos ni credenciales sintéticas para este punto. No se revocaron sesiones. Producción permaneció en solo lectura.

Límite adicional: el mecanismo histórico `source-recovery/CURRENT_RELEASE.patch` ya presentaba deriva respecto del `fuente.js` existente en este `HEAD`; no se reescribió ese parche histórico para ocultar la deriva. La corrección A-05 se verifica por el contrato estático, la sintaxis del parche y el diff mínimo del bundle servido; la reconstrucción byte a byte completa del runtime queda como trabajo separado.
