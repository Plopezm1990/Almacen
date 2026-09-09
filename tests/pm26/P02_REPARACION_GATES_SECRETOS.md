# PM26 P02 — Reparación real de gates de secretos e identificadores

## Estado

**Cerrado.** Se corrigieron los cinco archivos autorizados, se construyó el
escáner centralizado exigido, y el gate remoto es verde sobre el HEAD
exacto. El criterio de "sin secretos" de los gates PM24/PM25 queda
reabierto y reparado — sus cierres funcionales (los defectos reales que
cada punto encontró y corrigió, sus regresiones, sus gates remotos
históricos) **no se reabren ni se invalidan**: siguen siendo evidencia
válida de lo que probaron. Ver "Qué NO cambia" más abajo.

## Defecto J (registrado por el usuario, base de este paquete)

> El workflow de PM26 P01 y los cuatro workflows anteriores contienen
> identificadores internos reales escritos literalmente dentro de sus
> patrones `grep`. No son claves secretas, pero su duplicación en CI
> público incumple la regla de no publicar identificadores internos fuera
> de la configuración cliente legítima. Además, el gate de PM26 solo
> inspecciona los `.md`, por lo que no detecta su propia exposición.

## Discrepancia de alcance encontrada y resuelta con el usuario

Al construir el escáner (que debía revisar "todos los archivos rastreados
pertinentes"), un `git grep` de los tres project refs sobre todo el árbol
mostró que el problema no estaba limitado a los cinco archivos descritos
en el defecto J: **63 archivos adicionales**, desde PM02 hasta PM23 (docs
de cierre, evidencia de diagnóstico, dos scripts de validación de CI y
tres arneses de prueba de PM24/PM25), también contienen alguno de los tres
project refs de forma literal. Esto se presentó al usuario antes de
corregir nada; su decisión, aplicada en este paquete, fue:

1. El escáner centralizado revisa **todo** el árbol rastreado (cumple el
   punto 4 literalmente).
2. La corrección funcional se limita a los **cinco archivos originales**
   (los cuatro workflows de PM24/PM25 más el de PM26 P01).
3. PM02–PM23 no se reabren ni se modifican.
4. Todo lo demás encontrado por el escáner se **clasifica**, sin mostrar
   valores, en una de cinco categorías, y solo tres de ellas pueden
   admitirse como línea base limpia — la cuarta queda registrada aparte,
   explícitamente como deuda, no como algo aceptado.

## Arquitectura del escáner (`tools/seguridad/verificar-secretos-e-identificadores.mjs`)

- **No contiene ningún identificador real, URL interna ni valor de clave**
  en su propio código fuente. Los project refs se detectan **por forma**
  (`[a-z0-9]{20}` acotado por límites de palabra), no por comparación
  contra un valor memorizado — así el mismo escáner detecta los tres refs
  reales (producción, QA y TPV) sin necesidad de que ninguno esté escrito
  en el script.
- Las claves `sb_publishable_…` completas se detectan por su propio
  prefijo estructural.
- Los secretos reales (`sb_secret_…` con valor, JWT de tres segmentos,
  claves AWS `AKIA…` con límites de palabra, bloques de clave privada PEM,
  `service_role`/`SUPABASE_SERVICE_ROLE_KEY` asignados a un valor) se
  detectan por forma estructural, en **cualquier archivo**, y son
  **siempre bloqueantes** — ninguna línea base ni deuda puede admitirlos.
- Cada coincidencia se clasifica en una de cinco categorías, re-derivada
  **siempre desde el contenido real del archivo en el momento de
  verificar** (nunca se confía en lo que diga un fichero de línea base sin
  comprobarlo — así editar esos ficheros a mano no puede encubrir un
  secreto real):

  | Categoría | Significado | ¿Admisible como línea base? |
  |---|---|---|
  | `secreto_real` | Forma de secreto real (JWT, `sb_secret_`, clave AWS, PEM, `service_role` asignado) | **Nunca.** Bloquea siempre, en cualquier archivo. |
  | `configuracion_publica_legitima` | El candidato aparece en una de las 6 ubicaciones de runtime ya auditadas en P01 (`index.html`, `reset-pruebas-preview.js`, `fuente.js`, `edge-auth-patch.js`, `restablecer-contrasena.html`, `source-recovery/fuente-recuperado.js`) | Sí — línea base. |
  | `termino_tecnico` | El valor aparece dentro de un literal de patrón (regex JS o cadena de alternancia `grep -E`) cuyo propio propósito es comprobar que ese valor NO debe aparecer en otro sitio — uso autorreferencial | Sí — línea base. |
  | `falso_positivo` | Coincidencia de forma sin relación real con un identificador (3 palabras de exactamente 20 letras en código vendorizado de DOMPurify/html2canvas: un atributo HTML, un atributo MathML y un nombre de color CSS) | Sí — línea base. |
  | `identificador_interno_historico` | Duplicación real de un identificador interno fuera de sus ubicaciones legítimas, sin ser patrón técnico — documentos de cierre, evidencia de diagnóstico, scripts/arneses de prueba que codifican el valor en vez de derivarlo | **No.** Deuda de saneamiento registrada aparte. |

- Cada entrada de los dos ficheros de datos (`linea-base-aceptada.json`,
  `deuda-identificadores-historicos.json`) guarda solo **archivo,
  categoría, cantidad y huellas** (`sha256` truncado a 16 caracteres hex
  del valor) — nunca el valor mismo, ni siquiera en la deuda.
- El gate (`verificar`) recalcula el árbol completo en cada ejecución y
  falla si aparece: (a) cualquier secreto real; (b) cualquier huella no
  presente ni en la línea base ni en la deuda registrada (aparición
  nueva); no reescribe ni confía ciegamente en los ficheros de línea
  base — los recalcula.

## Resultado del barrido completo (repositorio actual)

```
SECRETOS_REALES=0
LINEA_BASE=36 archivos, 112 coincidencias (termino_tecnico=71, configuracion_publica_legitima=31, falso_positivo=10)
DEUDA_DE_SANEAMIENTO=63 archivos, 161 coincidencias (identificador_interno_historico)
```

**No se afirma que los 63 archivos de deuda estén "limpios".** Se afirma
que fueron inventariados y clasificados uno por uno, que ninguna
coincidencia en ellos tiene forma de secreto real (verificado con el
mismo barrido estructural que cubre todo el árbol, antes de tocar nada),
y que la duplicación que sí contienen es de identificadores públicos
(project refs, o en un caso una clave `sb_publishable_` ya conocida) —
nunca de una clave privada, contraseña o token operativo. Quedan
registrados como deuda de saneamiento pendiente, no como aceptados.

Ningún secreto real (JWT, `sb_secret_`, clave AWS, bloque de clave
privada, `service_role` asignado a un valor) apareció en ningún archivo
del repositorio durante este barrido. Si hubiera aparecido, este documento
no se habría escrito así — el procedimiento exigía detenerse de inmediato
y reportarlo sin mostrarlo.

## Los cinco archivos corregidos

Sus pasos "Sin secretos ni identificadores internos" (antes: grep inline
con los tres project refs escritos literalmente) ahora son una única
línea: `node tools/seguridad/verificar-secretos-e-identificadores.mjs verificar`.

- `.github/workflows/pm24-p01-integraciones-controladas.yml`
- `.github/workflows/pm24-p02-duplicacion.yml`
- `.github/workflows/pm25-p01-respaldo-nube-activa.yml`
- `.github/workflows/pm25-p02-bloqueo-entorno.yml`
- `.github/workflows/pm26-p01-inventario-diagnostico.yml`

Confirmado por barrido: **ninguno de los cinco contiene ya ningún project
ref ni valor de secreto literal.**

## Hallazgo incidental de P01, ya corregido en la práctica

El hallazgo I de P01 (el patrón `! grep …; echo PASS` no aborta bajo
`set -e`) queda resuelto de facto: los cinco workflows ya no usan ningún
`grep` inline propio para este control — delegan en el escáner
centralizado, que sí termina con el código de salida correcto (`exit 1` o
`exit 2`) en cada caso de fallo.

## Pruebas positiva y negativa (verifican el CÓDIGO DE SALIDA, no un texto)

`tests/pm26/p02-contract.mjs` ejecuta el escáner como subproceso real y
comprueba `status`/código de salida devuelto por el proceso, nunca solo la
presencia de la palabra "PASS":

- **Positiva**: `node tools/seguridad/verificar-secretos-e-identificadores.mjs verificar`
  sobre el repositorio real → código de salida `0`.
- **Negativa**: se crea un directorio temporal **aislado** (fuera del
  repositorio, nunca añadido a git), con un único archivo que contiene un
  marcador sintético con forma de JWT (`eyJ` + letras repetidas, sin
  relación con ninguna credencial real) y se invoca
  `node tools/seguridad/verificar-secretos-e-identificadores.mjs escanear-ruta <directorio-temporal>`
  → código de salida distinto de cero. El directorio temporal se borra
  inmediatamente después, en un `finally`; el marcador nunca se escribe en
  ningún archivo del repositorio ni queda en ningún artefacto.

## Qué NO cambia (por precisión)

- Los defectos reales que PM24 P01, PM24 P02 y PM25 P01 encontraron y
  corrigieron en `fuente.js` (WhatsApp sin teléfono, duplicación de
  entrevista/push, respaldo local con nube activa) **siguen siendo
  válidos** — no se reabren, no se re-ejecutan sus pruebas en vivo contra
  QA real en este paquete. Este paquete repara **exclusivamente** el
  criterio "sin secretos" de sus gates, no su evidencia funcional.
- No se afirma que ninguna prueba histórica que dependía de red real
  contra QA (los arneses `.mjs` con Playwright de PM24/PM25) se haya
  vuelto a ejecutar en vivo aquí — la regresión de este paquete ejecuta
  los **contratos estáticos** (`*-contract.mjs`), como en todos los gates
  anteriores de este proyecto, no los arneses interactivos.
- PM25 P02 sigue **PARCIAL/BLOQUEADO** — no se ha tocado.
- No se ha modificado `fuente.js`, `index.html`, ningún recurso
  compilado, ninguna dependencia, Netlify, Supabase (QA/producción/TPV) ni
  `main`.

## Historial de Git (por precisión, instrucción del usuario)

No se ha reescrito ni purgado el historial de Git, ni se ha hecho
force-push. **Eliminar los literales del árbol actual no los elimina de
los commits anteriores donde ya se publicaron** (los commits históricos
de PM02–PM25 conservan esos project refs tal cual se escribieron
entonces, de forma permanente y recuperable por cualquiera con acceso de
lectura al repositorio). Dado que ninguno de esos valores es una clave
secreta — son project refs y, en un caso, una clave `publishable` ya
pública por diseño — no se ha solicitado ninguna rotación de credenciales
por este motivo, conforme a la instrucción explícita del usuario.

## Sobre solicitar rotación de claves

No se solicita rotación de ninguna clave únicamente por la presencia de
project refs o claves `publishable` — no son secretos, tal como confirma
la propia documentación del SDK de Supabase citada en PM26 P01. Si en
algún momento de este barrido hubiera aparecido una clave privada
auténtica (`service_role`, contraseña operativa, token de larga vida,
clave PEM), el procedimiento exigía detenerse de inmediato, no mostrarla
en ningún log ni documento, y reportarla para que el usuario decidiera su
revocación. Esto no ocurrió: el barrido completo de `secreto_real` dio
cero coincidencias.

```
PM26_P02_ESTADO=CERRADO
PM26_P02_SECRETOS_REALES_ENCONTRADOS=0
PM26_P02_ARCHIVOS_CORREGIDOS=5
PM26_P02_DEUDA_REGISTRADA_ARCHIVOS=63
PM26_P02_DEUDA_REGISTRADA_COINCIDENCIAS=161
PM26_P02_LINEA_BASE_ARCHIVOS=36
PM26_P02_HISTORIA_GIT_REESCRITA=NO
PM26_P02_ROTACION_SOLICITADA_POR_REFS=NO
PM26_P02_MAIN_TOCADO=NO
PM26_P02_FUENTE_JS_TOCADO=NO
PM26_P02_NETLIFY_SUPABASE_TOCADO=NO
```

Los defectos A–H de PM26 P01 permanecen pendientes, sin corregir. PM25 P02
continúa PARCIAL/BLOQUEADO y se arrastra a la puerta final.
