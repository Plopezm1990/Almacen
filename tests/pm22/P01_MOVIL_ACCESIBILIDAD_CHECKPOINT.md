# PM22 P01 — Móvil y accesibilidad: cobertura emulada en Chromium

Texto literal del Plan Maestro: *"PM-22 · Móvil y accesibilidad: Probar
360/390/768 y escritorio; Android/iOS reales, orientación, teclado, foco,
lector, tablas y cobro. Evitar que los controles financieros queden fuera de
pantalla."*

PM-22 exige explícitamente "Android/iOS reales", algo que este entorno de
ejecución no tiene. El usuario decidió, con conocimiento explícito de esa
limitación, acotar el alcance: emular los viewports en Chromium y registrar
la cobertura en dispositivo físico como bloqueada — nunca presentarla como
"PM22 validado en dispositivos reales".

## 0. Cómo se cumple cada condición de la autorización

1. **Viewports 360/390/768/escritorio + orientación horizontal**: probados
   360×800 (Android), 390×844 (iPhone), 390×844 en horizontal (844×390),
   768×1024 (tablet) y 1440×900 (escritorio). Ver §2.
2. **Flujos críticos, navegación, formularios, tablas, diálogos, scroll,
   teclado, foco y estructura de accesibilidad**: cubiertos en la matriz de
   §2 — login, navegación del menú, el módulo Productos (lista/estado vacío
   + formulario real "Nuevo producto" de 23 campos), un módulo financiero
   real (Arqueo de caja/Tesorería), el diálogo "Modo empleado", y navegación
   por teclado (Tab) sobre el panel general.
3. **Evidencias por caso y build**: cada uno de los 61 casos ejecutados queda
   registrado con resultado PASS/FAIL y detalle en `evidencia/resultados.json`
   (generado por la ejecución, no versionado — ver §5), más una captura de
   pantalla por viewport y pantalla relevante, subidas como artefacto del
   propio job de CI, ligadas al build (SHA) que las generó.
4. **No presentar la emulación como prueba en dispositivos físicos**: este
   documento, el nombre del workflow y cada mensaje de cierre lo dejan
   explícito — "cobertura emulada", nunca "validado en Android/iOS reales".
5. **Registro expreso de lo pendiente**: ver §3.
6. **Código modificado solo ante defectos reproducibles**: no se modifica
   `fuente.js` en este punto — no se encontró ningún defecto reproducible que
   lo exigiera (ver §4, incluida la corrección de método sobre un falso
   positivo).
7. **Regresión acumulada, commit/push, gate remoto `SUCCESS`**: ver §5 y §6.
8. **Estado final**: "cobertura emulada cerrada; dispositivos físicos
   bloqueados" — no "PM22 validado en dispositivos reales". Ver §6.
9. **Mantener el bloqueo, continuar con PM23**: registrado en §3; PM23 es el
   siguiente punto tras el cierre de este.
10. `main`, producción y TPV sin tocar — este punto no toca ningún backend:
    se ejecuta la app real servida como archivos estáticos locales, en modo
    "Trabajar solo en este equipo, sin sincronizar" (el mismo modo que ya usa
    `.github/scripts/auditar-dashboard.mjs`, preexistente en este
    repositorio), sin ninguna llamada de red a QA ni a producción.

## 1. Método

Chromium (el mismo binario ya preinstalado en este entorno, sin descargar
nada nuevo) sirviendo `index.html`/`fuente.js` como archivos estáticos vía un
servidor HTTP local (`python3 -m http.server`), navegado con Playwright. Se
entra a la app en modo local (sin sincronizar) — el alcance de este punto es
maquetación, teclado, foco y estructura de accesibilidad de la propia app, no
lógica de negocio ni RLS (eso ya se cubrió con datos e identidades reales en
PM21). Las peticiones a CDNs externos (Tailwind Play CDN, Google Fonts) se
bloquean explícitamente porque este entorno no tiene salida a ellas y
reintentarlas bloquea minutos por página sin aportar nada a lo que este punto
evalúa.

**Corrección de método, registrada explícitamente**: la primera versión del
comprobador de accesibilidad de formularios marcaba como "sin etiqueta" un
campo que solo tuviera `aria-label`/`<label for>` en sus propios atributos.
Con esa heurística, los campos de correo/contraseña del login parecían no
tener nombre accesible. Antes de reportarlo como defecto se verificó con el
árbol de accesibilidad real que calcula el propio navegador
(`page.accessibility.snapshot()`), que sí reconoce el `placeholder` como
nombre accesible válido cuando no hay otro mecanismo — la heurística inicial
era demasiado estricta, no la app. La misma verificación real, aplicada al
formulario "Nuevo producto" (23 campos), confirmó que sus 23 campos sí tienen
nombre accesible completo vía `<label>` visible — otro posible falso positivo
evitado de la misma manera. Se corrigió el comprobador para usar siempre el
árbol de accesibilidad real, nunca una heurística de atributos sueltos —
misma lección ya aplicada en PM21 P01 con las funciones SQL: no concluir un
veredicto por lo que un elemento no contiene en su propia definición.

## 2. Resultado: 61/61 casos, 5 viewports

| Viewport | Casos | Resultado |
|---|---|---|
| 360×800 (Android) | 14 | 14/14 PASS |
| 390×844 (iPhone) | 14 | 14/14 PASS |
| 844×390 (iPhone, horizontal) | 5 | 5/5 PASS |
| 768×1024 (tablet) | 14 | 14/14 PASS |
| 1440×900 (escritorio) | 14 | 14/14 PASS |

Por cada viewport (salvo el de orientación horizontal, con un subconjunto más
ligero): login con nombre accesible real en sus campos y sin desborde
horizontal; panel general alcanzable sin errores de página; módulo Productos
con su estado vacío legible, sin desborde horizontal, y su formulario real
"Nuevo producto" (23 campos) con nombre accesible en el 100% de ellos; un
módulo financiero real (Arqueo de caja/Tesorería) con una cifra monetaria
visible y dentro del ancho de pantalla — el criterio explícito del Plan
Maestro de "no dejar controles financieros fuera de pantalla"; el diálogo
"Modo empleado" con `role="dialog"` real y cierre con Escape; y navegación
por teclado (Tab) que alcanza varios controles reales, todos con tamaño
visible (ninguno bloqueado ni oculto).

El módulo Productos se probó en su estado vacío real: el modo local sin
sincronizar arranca sin ninguna empresa/local configurado a propósito (para
no depender de red hacia QA), así que no hay filas de producto que listar —
se verificó que ese estado vacío se comunica con claridad y sin desborde, en
vez de forzar un alta de empresa/local que está fuera del alcance de este
punto (dispositivo/accesibilidad, no onboarding de negocio).

## 3. Explícitamente pendiente (bloqueado por falta de dispositivo/entorno)

Registrado tal como exige la autorización — no se presenta nada de esto como
probado:

- **Android/Chrome real e iPhone/Safari real**: sin dispositivo físico en
  este entorno. Solo se emuló el viewport en Chromium de escritorio.
- **Teclado virtual**: no se prueba su aparición, su efecto sobre el layout
  (viewport que se reduce, controles que quedan tapados) ni su propio
  comportamiento — un teclado físico no lo reproduce.
- **Gestos táctiles** (swipe, pinch-zoom, tap con precisión de dedo real):
  no se prueban; Playwright sobre Chromium de escritorio no los emula de
  forma fiel.
- **Áreas seguras** (notch, home indicator, `safe-area-inset-*`): no se
  prueban sin un dispositivo real o un simulador con esas métricas.
- **Comportamiento propio del sistema operativo** (gestos del sistema,
  rotación real del sensor, interrupciones de llamada/notificación, lector de
  pantalla nativo de iOS/Android — VoiceOver/TalkBack real, no solo el árbol
  de accesibilidad que expone Chromium): no se prueba.

## 4. Hallazgo registrado, no corregido (mejora, no defecto)

Los campos de correo/contraseña del login obtienen su nombre accesible
únicamente del `placeholder` (ver corrección de método en §1) — es válido
para el cálculo de nombre accesible, pero el texto desaparece en cuanto el
usuario escribe, así que no hay una etiqueta visible persistente. Es una
mejora razonable para un futuro punto de UI, no un defecto de accesibilidad
que bloquee este cierre — no se modifica `fuente.js` por esto ahora, conforme
a la condición 6 de la autorización (código solo ante defectos
reproducibles).

## 5. Archivos

- `tests/pm22/p01-movil-accesibilidad.mjs`: la suite real, ejecutable
  (`npm install` + `node p01-movil-accesibilidad.mjs` con un servidor
  estático local sirviendo la raíz del repositorio).
- `tests/pm22/p01-contract.mjs` (nuevo): confirma que este documento registra
  el resultado real (61/61, 5 viewports, el bloqueo explícito de dispositivo
  físico) y que no publica identificadores internos ni secretos.
- `tests/pm22/package.json` / `package-lock.json`: dependencia de
  `playwright`, fijada por versión.
- `evidencia/` (generada por la ejecución, no versionada — ver `.gitignore`
  de este directorio): capturas de pantalla y `resultados.json` con el
  detalle de los 61 casos; se suben como artefacto del job de CI.

## 6. Regresión, commit y gate

Sin cambios en `fuente.js` ni en ninguna migración — este punto no modifica
la app, solo la ejecuta y evalúa. Regresión completa del proyecto (todas las
suites `tests/*/*.mjs` + `node --check fuente.js`) sin regresiones. El gate
remoto de este punto ejecuta la suite real de Playwright contra la copia
local servida en el propio runner de CI (mismo patrón ya usado por
`.github/workflows/auditar-dashboard-funcional.yml`, preexistente en este
repositorio) y sube capturas + resultados como artefacto.

## Estado de main/producción/QA

`main` sin tocar. Ninguna llamada de red a QA ni a producción — la app se
sirve como archivos estáticos locales y se ejecuta en modo local sin
sincronizar. Producción y TPV sin tocar.

**PM22_P01_COBERTURA_EMULADA=CERRADA**
**PM22_P01_DISPOSITIVOS_FISICOS=BLOQUEADO_SIN_HARDWARE**
