# PM17 — Diagnóstico (solo lectura, sin cambios de código)

Rama: `claude/pm17-seguridad-notificaciones` (base `main` = `5db0b9ed03c8f8ecd700ff339edce1dff14ffde4`).
Este documento cubre los puntos 1-3 y 6 pedidos explícitamente para esta fase de diagnóstico.
No se ha modificado `fuente.js` ni ningún parche. No se ha hecho ningún commit todavía.

## 1. LA-024 contra el candidato actual

`tests/pm04/regression-catalog.json`:
```
{"id":"LA-024","package":"PM-17","severity":"BAJO","fixture":"Notificaciones neutral",
 "expected":"Texto neutral integrado y revalidado en candidato;
             no reimplementar si el cambio existente ya está presente."}
```

Comprobado por inspección directa (sección 2 y 3): el texto/estructura neutral para
Prefiltros y Entrevistas **ya existe y ya se aplica** sobre el candidato real, vía
`seleccion-neutral-patch.js` (`parchearInformeEntrevista`, `parchearModalPrefiltro`,
`parchearTextos`). Lee `almacen:entrevistas` de `localStorage` y las filas de
`prefiltros_candidatos` cacheadas desde el propio `fetch`, oculta las tarjetas de
puntuación/recomendación/riesgo con selectores por texto exacto, e inserta tarjetas
neutrales (resumen, experiencia, disponibilidad, evidencias, situaciones, cuestiones a
aclarar) leyendo el informe real del candidato — o un aviso de "formato antiguo" cuando
el informe no tiene los campos neutrales nuevos.

**Conclusión del punto 1: LA-024 ya está cumplido por el mecanismo existente.** La propia
ficha del catálogo lo advierte ("no reimplementar si el cambio existente ya está
presente") — no hay que rehacer la lógica de texto neutral, solo (más abajo) su forma de
entrega.

## 2. Inventario de los tres parches

### `edge-auth-patch.js` — ya no es un archivo aparte en ejecución

Su contenido íntegro está **inlineado dentro de `fuente.js` líneas 43510-43888** (bloque
`// ../edge-auth-patch.js`), heredado del build original con esbuild
(`fuente.js -> chunk-CZ7CSFO4.js -> edge-auth-patch.js`, confirmado también en
`source-recovery/entrada-recuperada.js:4-6`). El archivo `edge-auth-patch.js` en el
repo es ahora una copia histórica/fuente de ese bloque, no algo que el navegador
descargue por separado — pero **es el que inyecta, en runtime, los otros dos**:

| Bloque (dentro de fuente.js, síncrono, sin red) | Función | Consumidores |
|---|---|---|
| L43510-43551 | Inyecta `Authorization: Bearer <access_token>` en `fetch` a Edge Functions protegidas (`importar-albaran`, `importar-nomina`, `enviar-notificacion`, `entrevista-personal`) | Cualquier `fetch` nativo a esas 4 funciones |
| L43552-43838 | Envuelve `window.storage.get/set/delete`: aísla por rol (Propietario/Encargado/Cajero/a/Churrero/a) qué colecciones locales puede leer/escribir cada perfil; sustituciones de mínimo privilegio (`empleados`→solo `empleadosFichaje`, `fichajes`→solo los propios, etc.) | Los 39+ puntos de llamada de `loadKey`/`saveKey` en toda la app |
| L43839-43870 | Cada 30s / en focus / en visibilitychange: si el perfil se desactivó, cierra sesión local y recarga | Toda la sesión activa |
| L43871-43888 | **Inyecta `<script src="./seleccion-neutral-patch.js?v=2">` y `<script src="./auth-ux-patch.js?v=1">`** vía `document.createElement("script")` | Arranque de la app |

Estos 4 bloques corren **de forma síncrona, en el mismo módulo `fuente.js`**, sin
depender de red adicional ni de que otro archivo termine de cargar. No tienen el
problema de carrera/fallo silencioso — ya están "nativizados" de facto.

### `auth-ux-patch.js` — solo existe como archivo aparte, cargado por red

No está inlineado en ningún sitio de `fuente.js`. Se descarga porque el bloque
L43880-43888 de arriba lo inyecta.

| Función | Consumidor / cómo actúa |
|---|---|
| `asegurarOlvidePassword()` | Busca los inputs de login por `placeholder` y el botón "Entrar"; añade un botón "¿Olvidaste tu contraseña?" que navega a `restablecer-contrasena.html`. Se reintenta cada 100ms tras cada mutación del DOM y en `resize`/`orientationchange`. |
| `asegurarLogoutPropietario()` | Consulta `perfiles.rol/activo` del usuario de la sesión; si es Propietario activo, inyecta un botón "Cerrar sesión" (cabecera en escritorio, clon del botón "Locales" del menú en móvil) con modal de confirmación propio y `supabase.auth.signOut({scope:"local"})`. |
| Ambas | Dependen de que el DOM ya tenga los elementos de referencia (inputs de login, botón "Entrar"/"Modo empleado"/"Locales") — si React aún no ha montado esas pantallas cuando el archivo termina de cargar, el primer intento no hace nada y espera al siguiente `MutationObserver`/reintento. |

### `seleccion-neutral-patch.js` — solo existe como archivo aparte, cargado por red

Tampoco está inlineado. Se descarga por el mismo bloque de inyección (L43871-43879 de
`fuente.js`). Contiene dos IIFEs independientes:

**(a) Seguridad de suscripción push** (L1-122 del archivo)
- Envuelve `window.PushManager.prototype.subscribe`: si tras crear la suscripción no
  llega un `POST` exitoso a `/rest/v1/suscripciones_push` en 45s, hace
  `unsubscribe()` automático (evita "activado" falso en el navegador sin alta real
  en Supabase).
- Envuelve `window.PushSubscription.prototype.unsubscribe`: antes de desactivar de
  verdad, comprueba contra Supabase que el `endpoint` ya no existe en la tabla; si no
  puede comprobarlo o sigue existiendo, lanza error en vez de desactivar.
- Consumidor real: `Notificaciones.activar()`/`desactivar()` en `fuente.js`
  (L111261-111311) — **la función nativa `activar()` no tiene ningún rollback propio**;
  si `errInsert` es verdadero simplemente hace `throw` y muestra el error, dejando la
  suscripción del navegador creada. Hoy ese hueco lo cubre por completo este parche.

**(b) DOM neutral** (L129-430 del archivo): `parchearTextos`, `parchearInformeEntrevista`,
`parchearModalPrefiltro` — ya descritos en el punto 1. Se disparan con
`MutationObserver` sobre `#root` + debounce de 30ms, así que se re-aplican en cada
render nuevo, no solo una vez al cargar.

### Orden de carga real y ventana de carrera

1. `index.html` carga `fuente.js` como `type="module"` (equivalente a `defer`: se
   ejecuta tras parsear el HTML, antes de `DOMContentLoaded`... en realidad los módulos
   se ejecutan tras el parseo completo, tan pronto estén listos).
2. Al evaluarse el módulo, se ejecutan en orden los 4 bloques inlineados de
   `edge-auth-patch.js` (síncronos) y, al final, se crean y añaden los dos `<script>`
   para `seleccion-neutral-patch.js` y `auth-ux-patch.js`.
3. **`script.defer = true` no tiene ningún efecto sobre un `<script>` creado con
   `document.createElement` y añadido dinámicamente al DOM** — esa propiedad solo aplica
   a scripts presentes en el parseo inicial del HTML. Ambos archivos se descargan y
   ejecutan tan pronto responde la red, sin ninguna garantía de orden respecto al montaje
   de React ni respecto a la interacción del usuario.
4. React monta la app (incluye `Notificaciones`, `Personal/entrevistas`) en paralelo a
   esa descarga. Si el usuario pulsa "Activar en este dispositivo" o abre un informe de
   entrevista **antes** de que `seleccion-neutral-patch.js` termine de descargarse y
   ejecutarse, se ejecuta la lógica nativa sin la protección de ese parche — sin ningún
   aviso de que la protección "aún no está lista".
5. Ninguno de los dos `<script>` inyectados tiene `onerror` gestionado: si el archivo no
   se despliega, se bloquea (CSP, proxy, 404), o falla la red, la app sigue funcionando
   con normalidad pero **sin aislamiento de roles reforzado en la UI de selección, sin
   texto neutral, y sin la protección de rollback de push** — de forma completamente
   silenciosa, sin banner ni log visible para nadie.

### Consecuencias concretas si cada parche falla en cargar

| Si falla... | Consecuencia real |
|---|---|
| `edge-auth-patch.js` | Imposible que falle "en runtime" — es código nativo de `fuente.js`, falla solo si `fuente.js` falla (ya cubierto por el resto de la app). |
| `auth-ux-patch.js` | No aparece "¿Olvidaste tu contraseña?" en login, ni el botón de logout de Propietario. Degradación de UX, no de seguridad — el usuario sigue pudiendo cerrar sesión por otras vías existentes de la app (si las hay) o recargar/borrar sesión del navegador. |
| `seleccion-neutral-patch.js` | (a) Vuelve el hueco real de rollback de push descrito arriba — una suscripción puede quedar "activada" en el navegador sin alta en Supabase. (b) Prefiltros y Entrevistas **vuelven a mostrar puntuación numérica, recomendación, señales de riesgo y competencias generales sin ningún filtro** — el hueco de sesgo/NR-04 que motivó este parche deja de estar cubierto. Este es el fallo silencioso más serio de los tres. |

## 3. Qué existe ya de forma nativa en `fuente.js`

- **Autenticación/Edge Functions y aislamiento de `window.storage` por rol**: 100%
  nativo (inlineado), no depende de ningún archivo externo. No hay nada que portar aquí.
- **Auth UX** (recuperar contraseña, logout de Propietario): **no existe ningún
  equivalente nativo**. Si se retira `auth-ux-patch.js` sin sustituirlo, esas dos
  funciones desaparecen por completo, no solo se degradan.
- **Neutralización de IA en Prefiltros/Entrevistas**: **no existe ningún equivalente
  nativo**. El componente que renderiza el informe (L113082-113121 de `fuente.js`)
  sigue generando incondicionalmente los bloques de puntuación/recomendación/riesgo; la
  neutralización depende al 100% del parche externo.
- **Rollback de suscripción push**: **no existe ningún equivalente nativo** en
  `Notificaciones.activar()`/`desactivar()` (L111241-111313); depende al 100% del
  parche externo.

## 6. Matriz rama → cambio → prueba → build (propuesta para cuando se autorice el punto 4)

No ejecutada todavía — es la propuesta de lotes pequeños pedida, para tu revisión antes
de tocar nada.

| Lote | Cambio propuesto | Alcance | Prueba de contrato propuesta | Compatibilidad a revisar antes de retirar nada |
|---|---|---|---|---|
| P01 | Portar el rollback de suscripción push (envoltura de `subscribe`/`unsubscribe`) **dentro de `Notificaciones.activar()`/`desactivar()`**, nativo y síncrono | Solo `fuente.js`, sin tocar `seleccion-neutral-patch.js` todavía | Positivo: alta con éxito en Supabase deja suscrito; Negativo: alta falla en Supabase → sin rollback nativo hoy debe quedar rota tras el cambio → con el cambio, unsubscribe automático a los 45s (o inmediato si se decide sin temporizador); Replay: doble intento de activar tras un fallo no dejut duplicados | Confirmar que el parche externo y la versión nativa no se pisan mutuamente mientras ambos convivan (doble envoltura de `PushManager.prototype.subscribe`) — probablemente haya que decidir orden: ¿nativo primero, parche se vuelve no-op? |
| P02 | Portar la neutralización de Prefiltros/Entrevistas **dentro del propio componente de informe**, condicionando el render de las tarjetas de puntuación/recomendación en vez de ocultarlas por DOM después | Solo `fuente.js` | Positivo: informe con campos neutrales nuevos renderiza igual que hoy vía parche; Negativo: informe en "formato antiguo" (sin campos neutrales) muestra el aviso de formato antiguo, no los números; Replay: alternar entre candidato con informe antiguo y nuevo en la misma sesión no deja restos de un candidato en otro | Verificar los ~9 selectores por texto exacto del parche (`"Recomendación final"`, `"Señales de riesgo"`, etc.) contra el JSX real para no dejar ningún campo sin migrar; decidir si `seleccion-neutral-patch.js` se retira solo cuando esto y el prefiltro (mismo lote o siguiente) estén cubiertos, no antes |
| P03 | Portar auth UX (olvidé contraseña, logout Propietario) de forma nativa | Solo `fuente.js` | Positivo: enlace/botón aparecen y funcionan igual que hoy; Negativo: usuario no-Propietario no ve el botón de logout; Replay: perfil se desactiva mientras la sesión está abierta → guard ya nativo (L43839-43870) sigue cerrando sesión igual | Bajo riesgo — es la pieza más aislada; comprobar estilos/clases CSS no rotos al mover de inyección DOM a JSX |
| P04 | Retirar `seleccion-neutral-patch.js` y `auth-ux-patch.js` del repo (y el bloque de inyección L43871-43888 de `fuente.js`) solo una vez P01-P03 estén cerrados, probados y con gate verde | Frontend puro | Regresión completa + prueba explícita de que ya no se inyecta ningún `<script>` en runtime | Confirmar que ningún otro flujo (SW, `dashboard-premium-v2.js`, etc.) referencia estas rutas antes de borrarlas |

Cada lote de P01-P03 lleva: contrato de test (positivo/negativo/replay) →
`node --check fuente.js` → regresión completa de todas las suites vigentes → doc de
cierre → workflow de CI propio → verde en remoto sobre el HEAD exacto, igual que en
PM14-PM16. Ningún lote implica tocar producción, Supabase QA de escritura fuera de lo ya
usado, ni el entorno TPV.

## Pendiente para siguiente turno

- NR-03 y NR-04 no aparecen en `tests/pm04/regression-catalog.json` ni en
  `docs/plan-maestro/*.md` — no tengo su texto literal en el repo. Si tienes la
  redacción exacta, la contrasto contra este inventario antes de proponer el punto 4.
- Ningún archivo de código se ha tocado. Este documento es el único artefacto nuevo y
  aún no está commiteado.
