# PM24 P01 — Integraciones controladas (correo, WhatsApp, IA, push)

## Alcance y autorización

Este punto cubre las cuatro integraciones externas del programa que no son
Supabase: enlaces de correo, enlaces de WhatsApp, la función de IA
`entrevista-personal` y el push nativo `enviar-notificacion`.

Se ejecutó con dos autorizaciones específicas del usuario, ambas puntuales
para esta prueba:

1. **Correo y WhatsApp**: documentar el envío automático como inexistente y
   fuera de alcance, y verificar en cambio los enlaces manuales (destinatario
   y contenido correctos, sin mezcla entre proveedores, comportamiento ante
   datos faltantes/inválidos, sin envíos reales durante la prueba).
2. **IA y push**: usar una redirección controlada a QA implementada
   exclusivamente dentro del arnés de prueba (Playwright `context.route()`),
   nunca un mecanismo permanente en `fuente.js`, con bloqueo y registro de
   cualquier petición que intente llegar a producción fuera de lo esperado.

**Nunca se tocó `main`, producción ni TPV.** No se creó ningún Netlify
Deploy Preview real — la evidencia se documenta explícitamente como **"E2E
local con redirección controlada a QA"**, nunca como "Netlify Deploy Preview
probado".

## Inventario previo (código real, no por nombre)

- **Correo y WhatsApp**: no existe ningún envío automático de pedidos por
  correo o WhatsApp. Todo lo que hay son enlaces manuales que el usuario
  decide accionar: `mailto:`, `https://wa.me/…`, `googlegmail:///co?...` y un
  enlace a Gmail web. No hay ninguna Edge Function ni proceso de servidor que
  envíe correos o WhatsApps por su cuenta.
- **`entrevista-personal`** (IA) y **`enviar-notificacion`** (push): están
  cableados de forma fija a la URL de producción de Supabase dentro de
  `fuente.js` — no leen ninguna variable de entorno ni configuración de
  cliente. El proyecto QA (`L&A Suite QA`) ya tiene ambas funciones
  neutralizadas a stubs (`{qa:true, simulated:true, ...}`), preparados en un
  paquete anterior.
- La conectividad directa navegador → QA es poco fiable en este entorno de
  pruebas (confirmado con una sonda dedicada: fallos repetidos de red desde
  el propio Chromium). Por eso la redirección a QA se hace en el lado Node
  del arnés de Playwright (`page.route()`), nunca dejando que el navegador
  intente hablar con QA directamente.

## Metodología

Arnés Playwright (`p01-integraciones.mjs`) que:

- Sirve la app localmente (`python3 -m http.server`) y entra en "Trabajar
  solo en este equipo, sin sincronizar".
- Intercepta **todas** las peticiones de red (`context.route('**/*', …)`).
  Para el host de producción de Supabase, solo dos rutas de función están
  permitidas (`entrevista-personal`, `enviar-notificacion`) y se relevan por
  Node hacia QA (o se sustituyen por una respuesta sintética de
  timeout/desconexión/5xx/JSON inválido, según el modo de prueba); **cualquier
  otra petición al host de producción se bloquea y se registra** como prueba
  de que nada más llegó allí.
- Sustituye `window.getSupabaseClient` tras la carga para simular sesión
  autenticada (token real de QA) o sesión inexistente, evitando depender de
  la red real para el login.

## Resultados

### 1. Enlaces manuales (correo / WhatsApp)

Se creó una empresa y un local QA (prerrequisito real de la app —
proveedores y pedidos exigen un contexto multiempresa/multilocal activo), un
producto QA, dos proveedores (uno con teléfono y correo completos, otro sin
ningún dato de contacto) y un pedido para cada uno.

- El enlace de WhatsApp del proveedor **con** teléfono lleva el número
  correctamente codificado (`https://wa.me/34600111222?text=...`).
- El modal de "Enviar por correo" muestra como destinatario el correo real
  del proveedor correspondiente, sin mezclarlo con el del otro proveedor.
- **Envío automático: inexistente y excluido expresamente, no probado.**
  Confirmado por inspección de código: no hay ninguna ruta de servidor para
  esto.

**Defecto real encontrado y corregido**: el botón "Enviar por WhatsApp" se
generaba también para el proveedor **sin** teléfono, produciendo un enlace
`https://wa.me/?text=...` sin ningún destinatario, sin aviso ni bloqueo —
justo lo contrario de "Llamar", que ya estaba condicionado a que el
proveedor tuviera teléfono. Se corrigió en los dos sitios donde se genera
ese botón (la lista de pedidos y el modal de confirmación tras crear un
pedido) para que exija teléfono, igual que "Llamar".

El botón "Enviar por correo" también se muestra siempre, pero como abre un
modal con un campo "Destinatario" visible **antes** de que el usuario elija
una app de correo, el campo vacío es evidente para quien lo usa antes de
actuar — se registra como hallazgo menor, mitigado por el propio flujo, y no
se modifica en este punto.

### 2. IA (`entrevista-personal`)

Matriz completa contra el sustituto neutralizado de QA:

| Modo | Petición llegó solo cuando debía | Sin excepción JS | Mensaje explícito (no silencioso) |
|---|---|---|---|
| Sin sesión | ✅ (0 peticiones) | ✅ | ✅ |
| Respuesta real QA (503 simulado) | ✅ | ✅ | ✅ (se acepta cualquier resultado no silencioso) |
| Desconexión | ✅ | ✅ | ✅ |
| Error 5xx simulado | ✅ | ✅ | ✅ |
| Respuesta inválida (JSON roto) | ✅ | ✅ | ✅ |
| Timeout de cliente | ✅ | ✅ | — (ver hallazgo) |

**Hallazgo documentado, no corregido en este punto**: `llamarIA()` no usa
`AbortController` ni ningún timeout propio — si el servidor nunca responde,
la llamada queda "en vuelo" indefinidamente sin que el usuario pueda
cancelarla ni reciba ningún aviso de que algo tarda demasiado. Se registra
como mejora pendiente; no se corrige aquí por ser un cambio de
comportamiento (hace falta decidir cuánto tiempo esperar) y no una
corrección puntual.

### 3. Push nativo (`enviar-notificacion`)

| Modo | Resultado |
|---|---|
| Respuesta real QA | `200 {ok:true, qa:true, simulated:true, sent:0}` — manejado sin excepción |
| Sin sesión | `401` con mensaje claro — manejado sin excepción |
| Error 5xx simulado | `fetch()` no lanza excepción por un HTTP 5xx (así es como funciona `fetch`) |
| Desconexión | Una desconexión real sí lanza excepción de `fetch()` |

**Defecto real encontrado y corregido**: en el sitio real donde se dispara
este push (aviso de lotes a punto de caducar), la llamada terminaba en
`.catch(() => {})` sin ningún `.then()` que comprobara `resp.ok` — es decir,
**ni siquiera un HTTP 5xx real llegaba a ejecutar el `catch`** (porque
`fetch()` no lanza excepción por un status de error), y una desconexión real
sí lo hacía pero el `catch` la ignoraba por completo. El resultado era una
notificación que podía fallar de cualquier forma sin dejar ningún rastro.

Se corrigió reutilizando el mecanismo YA EXISTENTE de `registrarErrorSistema`
(el mismo que ya usan los errores globales de JS y de renderizado, visible en
la pantalla "Errores del sistema"): ahora, si la respuesta no es `ok` o si la
llamada lanza una excepción, el fallo queda registrado allí. No se ha
inventado ningún canal de aviso nuevo — solo se conecta este punto al que ya
existía.

## Hallazgos colaterales (fuera del alcance directo de este punto)

Descubiertos durante la exploración de código, no corregidos aquí porque no
son integraciones de correo/WhatsApp/IA/push sino de aislamiento de red y de
alcance de RLS — se documentan para que se decida si merecen su propio punto:

- **El modo "Trabajar solo en este equipo, sin sincronizar" no aísla toda la
  red**: `listarPrefiltros`/`crearPrefiltro`/`eliminarPrefiltro` (candidatos
  con prefiltro por IA) llaman a `window.getSupabaseClient()` sin comprobar
  ningún indicador de modo local, y por tanto intentan contactar con
  producción incluso en modo local. Confirmado en esta misma prueba: el
  arnés tuvo que bloquear activamente 6 peticiones reales a
  `prefiltros_candidatos` en producción para que no llegaran allí (ver
  `bloqueadas` en `p01-resultado.json`) — sin ese bloqueo del arnés, en un
  uso real habrían llegado a producción pese a estar en modo local.
- **`suscripciones_push` no tiene columna `empresa_id`**: la política RLS de
  QA solo se autolimita a `user_id = auth.uid()`. El direccionamiento real
  "por rol y empresa" (si existe) vive en el código de la función de
  producción, que no es observable desde el stub de QA — se documenta como
  observación, no se puede verificar ni corregir desde este entorno.

## Evidencia y garantías

- `p01-resultado.json`: 32 casos, 0 fallos, tras aplicar las dos
  correcciones anteriores. Incluye el array `bloqueadas` con las peticiones
  reales que el arnés interceptó y bloqueó camino de producción (prueba de
  que nada llegó allí salvo lo explícitamente autorizado).
- Ningún dato real, usuario real, ni destinatario real se usó en ningún
  momento — solo identidades y proveedores QA sintéticos
  (`QA PM24 Proveedor Completo`, `QA PM24 Proveedor Sin Contacto`, correo
  `proveedor.pm24@qa.invalid`, teléfono ficticio).
- No se usó `service_role` en ningún momento de esta prueba.
- No se creó ningún Netlify Deploy Preview real.

```
PM24_P01_INTEGRACIONES_EJECUTADO=PASS
```
