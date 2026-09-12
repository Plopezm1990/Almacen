# PM26 P02 — Reparación real de gates de secretos e identificadores

## Estado

**Cerrado.** El lote de corrección (commit `3bf7506b1a0d003fc7922de809f6175c8b94cd88`)
tiene gate remoto `SUCCESS` en los cinco workflows afectados, sobre ese
mismo HEAD exacto:

| Workflow | Run | Resultado |
|---|---|---|
| `pm24-p01-integraciones-controladas.yml` | [34367299659](https://github.com/Plopezm1990/Almacen/actions/runs/34367299659) | SUCCESS |
| `pm24-p02-duplicacion.yml` | [34367303016](https://github.com/Plopezm1990/Almacen/actions/runs/34367303016) | SUCCESS |
| `pm25-p01-respaldo-nube-activa.yml` | [34367307191](https://github.com/Plopezm1990/Almacen/actions/runs/34367307191) | SUCCESS |
| `pm25-p02-bloqueo-entorno.yml` | [34367310814](https://github.com/Plopezm1990/Almacen/actions/runs/34367310814) | SUCCESS |
| `pm26-p01-inventario-diagnostico.yml` | [34367290794](https://github.com/Plopezm1990/Almacen/actions/runs/34367290794) | SUCCESS |

El criterio de "sin secretos" de los gates PM24/PM25 queda reabierto y
reparado — sus cierres funcionales (los defectos reales que cada punto
encontró y corrigió, sus regresiones, sus gates remotos históricos) **no
se reabren ni se invalidan**: siguen siendo evidencia válida de lo que
probaron. Ver "Qué NO cambia" más abajo.

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
en el defecto J: decenas de archivos adicionales, desde PM02 hasta PM23
(docs de cierre, evidencia de diagnóstico, scripts de validación de CI y
arneses de prueba de PM24/PM25), también contienen alguno de los tres
project refs de forma literal. Esto se presentó al usuario antes de
corregir nada; su decisión, aplicada en este paquete, fue:

1. El escáner centralizado revisa **todo** el árbol rastreado (cumple el
   punto 4 literalmente).
2. La corrección funcional se limita a los **cinco archivos originales**
   (los cuatro workflows de PM24/PM25 más el de PM26 P01).
3. PM02–PM23 no se reabren ni se modifican.
4. Todo lo demás encontrado por el escáner se **clasifica**, sin mostrar
   valores, en una de las categorías descritas abajo, y solo algunas
   pueden admitirse como línea base limpia — el resto queda registrado
   aparte, explícitamente como deuda, no como algo aceptado.

## Corrección de segunda ronda (este documento la incorpora ya)

Tras el primer cierre reportado, el usuario detectó dos defectos reales en
el propio mecanismo de reparación, que este documento y el escáner ya
reflejan corregidos:

1. **`tests/pm26/p02-contract.mjs` seguía escribiendo los tres project
   refs de forma literal** dentro de un array `patronesValorReal`, para
   comprobar que el documento no los publicaba — exactamente la misma
   duplicación que este paquete existe para eliminar. Se retiró por
   completo; la comprobación ahora reutiliza el propio escáner
   (`escanearArbol`) sobre el documento, el escáner y este mismo contrato,
   verificando **estructuralmente** que ninguno de los tres contiene un
   candidato a identificador fuera de una ubicación legítima, sin escribir
   ningún valor real en ningún sitio para lograrlo.
2. **`termino_tecnico` se aplicaba a coincidencias de project refs reales
   o claves publishable completas** solo por aparecer dentro de una regex,
   una cadena de `grep -E` o un `assert` — tratando la envoltura sintáctica
   como si neutralizara la duplicación. No es así: un valor real sigue
   siendo el valor real aunque esté citado dentro de un patrón de
   comparación. `termino_tecnico` queda **redefinido**: puede cubrir
   nombres genéricos de patrón sin ningún valor adjunto (p. ej. la palabra
   `service_role` o `sb_secret_` sueltas), pero **nunca** un project ref
   real ni una clave publishable completa, sin excepción por contexto
   sintáctico. El escáner de este repositorio no genera hoy ninguna
   coincidencia `termino_tecnico` (la categoría queda definida en el
   esquema para un uso futuro distinto, no para identificadores). Todo lo
   que antes se clasificaba así ahora se reclasifica correctamente como
   `configuracion_publica_legitima` (si está en una ubicación autorizada)
   o `identificador_interno_historico` (en cualquier otro sitio) —
   incluidos los propios workflows de PM21-PM25 y sus contratos, que
   pasan de línea base a deuda. **No se modificó ningún archivo histórico
   para lograr esto** — solo se corrigió cómo el escáner los clasifica.
3. **Hallazgo adicional, encontrado al endurecer la comparación exacta**:
   la comparación por cantidad exacta hizo aflorar que `tests/pm26/p02-contract.mjs`
   se invoca dos veces por ejecución de CI (una vez sola, otra dentro de
   "Regresión completa"), y esta última invocación ocurre **después** de
   que `tests/pm13/*.mjs` se ejecuten como parte de esa misma regresión —
   varios de esos scripts reescriben, como efecto secundario no
   determinista de ejecutarse, su propia evidencia histórica
   (`tests/pm13/*.json`/`*.txt`), con una cantidad de coincidencias que
   puede variar de una ejecución a otra sin que el contenido rastreado
   haya cambiado en absoluto. Con una comparación exacta de cantidad, esa
   variación del árbol de trabajo hacía fallar el gate por una razón ajena
   a cualquier secreto o identificador real. Corregido en dos frentes, sin
   tocar `tests/pm13/`: (a) el paso duplicado y redundante
   "Sin secretos ni identificadores internos" del workflow, que repetía
   innecesariamente la misma comprobación después de la regresión, se
   retiró; (b) más importante, `escanearArbol()` ahora LEE el contenido de
   cada archivo desde el **índice de git** (`git show :archivo`), no desde
   el árbol de trabajo, cuando la lista de archivos proviene de
   `git ls-files` — así el escáner es inmune a cualquier mutación del
   árbol de trabajo ajena a lo realmente rastreado/staged, venga de donde
   venga, no solo de `tests/pm13`.
   Al implementar (b) apareció un tercer defecto real, encontrado y
   corregido antes de dar nada por bueno: `execFileSync` tiene un
   `maxBuffer` por defecto de 1 MB en Node.js, y `fuente.js` pesa más de
   5 MB — `git show :fuente.js` fallaba con `ENOBUFS`, ese fallo se
   descartaba en un `catch` genérico como "archivo no legible", y
   **`fuente.js` y `source-recovery/fuente-recuperado.js` quedaban sin
   escanear en absoluto**, sin ningún aviso. Confirmado de forma aislada
   antes de corregir. Corregido fijando `maxBuffer` a 64 MB, muy por
   encima del archivo más grande del repositorio; reconfirmado que ambos
   archivos vuelven a aparecer en la línea base con sus coincidencias
   legítimas de siempre.
4. **`verificar()` comparaba solo `archivo + huella`**, ignorando
   `cantidad` y `categoría` — una segunda aparición del mismo valor ya
   conocido en el mismo archivo no se detectaba (la huella ya era
   "conocida"), y una edición manual del ledger que cambiara la cantidad o
   la categoría tampoco. Corregido: `verificar()` ahora compara la entrada
   **completa** — archivo, categoría, cantidad y el conjunto exacto de
   huellas — regenerada en vivo contra lo registrado. Cualquier alta,
   baja, repetición adicional, cambio de cantidad o reclasificación exige
   una regeneración explícita del ledger.

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
  **siempre bloqueantes** — ninguna línea base ni deuda puede admitirlos,
  sin importar el contexto sintáctico que los envuelva.
- Cada coincidencia se clasifica en una de cinco categorías, re-derivada
  **siempre desde el contenido real del archivo en el momento de
  verificar** (nunca se confía en lo que diga un fichero de línea base sin
  comprobarlo — así editar esos ficheros a mano no puede encubrir un
  secreto real ni una reclasificación indebida):

  | Categoría | Significado | ¿Admisible como línea base? |
  |---|---|---|
  | `secreto_real` | Forma de secreto real (JWT, `sb_secret_`, clave AWS, PEM, `service_role` asignado) | **Nunca.** Bloquea siempre, en cualquier archivo, sin importar el contexto. |
  | `configuracion_publica_legitima` | El candidato (project ref o clave publishable completa) aparece en una de las 6 ubicaciones de runtime ya auditadas en P01 (`index.html`, `reset-pruebas-preview.js`, `fuente.js`, `edge-auth-patch.js`, `restablecer-contrasena.html`, `source-recovery/fuente-recuperado.js`) | Sí — línea base. |
  | `termino_tecnico` | Reservado para nombres **genéricos** de patrón, sin ningún valor real adjunto (p. ej. la palabra `service_role` suelta). **Nunca** un project ref real ni una clave publishable completa, aunque estén dentro de una regex, un comentario o un `assert` — envolver un identificador real en un patrón de búsqueda sigue siendo una duplicación de ese identificador. Esta versión del escáner no produce ninguna coincidencia en esta categoría. | Sí, si alguna vez se produjera — línea base. |
  | `falso_positivo` | Coincidencia de forma sin relación real con un identificador (3 palabras de exactamente 20 letras en código vendorizado de DOMPurify/html2canvas: un atributo HTML, un atributo MathML y un nombre de color CSS) | Sí — línea base. |
  | `identificador_interno_historico` | Duplicación real de un project ref o una clave publishable completa fuera de sus ubicaciones legítimas — documentos de cierre, evidencia de diagnóstico, workflows y contratos que codifican el valor en vez de derivarlo, sin importar si lo hacen dentro de una regex o no | **No.** Deuda de saneamiento registrada aparte. |

- Cada entrada de los dos ficheros de datos (`linea-base-aceptada.json`,
  `deuda-identificadores-historicos.json`) guarda solo **archivo,
  categoría, cantidad y huellas** (`sha256` truncado a 16 caracteres hex
  del valor) — nunca el valor mismo, ni siquiera en la deuda.
- `verificar()` recalcula el árbol completo en cada ejecución y compara,
  para cada par (archivo, categoría) presente en cualquiera de los dos
  lados, la **entrada completa**: si aparece en el ledger pero ya no en el
  árbol, si aparece en el árbol pero no en el ledger, si la cantidad
  difiere, o si el conjunto de huellas difiere — cualquiera de esos casos
  falla el gate. No compara huellas sueltas de forma independiente: una
  huella ya "conocida" en otro archivo o categoría no basta para admitir
  una nueva aparición.
- El CLI admite `--raiz=`, `--linea-base=`, `--deuda=` y `--sin-git=true`
  para poder probar el escáner contra un árbol y unos ledgers
  completamente aislados (usado por las pruebas negativas), sin tocar
  nunca el repositorio real ni sus ledgers.

## Resultado del barrido completo (repositorio actual, con la clasificación corregida)

```
SECRETOS_REALES=0
LINEA_BASE=11 archivos, 41 coincidencias (configuracion_publica_legitima=31, falso_positivo=10, termino_tecnico=0)
DEUDA_DE_SANEAMIENTO=83 archivos, 230 coincidencias (identificador_interno_historico)
```

La línea base ya **no** incluye ningún workflow ni contrato de prueba —
solo los 6 archivos de configuración de runtime legítima y los archivos
vendorizados con los 3 falsos positivos ya investigados. Todo lo que antes
se admitía como `termino_tecnico` (workflows y contratos de PM21-PM25 que
citaban los refs como patrón de búsqueda) se reclasificó a
`identificador_interno_historico`, sin modificar esos archivos.

**No se afirma que los 83 archivos de deuda estén "limpios".** Se afirma
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

## Pruebas (verifican el CÓDIGO DE SALIDA, nunca solo un texto, y nunca imprimen el valor encontrado)

`tests/pm26/p02-contract.mjs` ejecuta el escáner como subproceso real
sobre árboles y ledgers **aislados** (nunca el repositorio real, salvo la
prueba positiva) y comprueba el código de salida devuelto, comprobando
además que ningún mensaje de error contiene el valor sintético usado:

- **Positiva**: el repositorio real completo → código de salida `0`.
- **Negativa 1 — secreto real sintético**: un directorio temporal aislado
  con un marcador sintético con forma de JWT (letras repetidas, sin
  relación con ninguna credencial real) → código de salida `2`.
- **Negativa 2 — identificador nuevo fuera de línea base**: un árbol
  aislado con un candidato sintético y ledgers vacíos → código de salida
  distinto de cero (`aparicion_nueva_fuera_de_ledger`).
- **Negativa 3 — segunda aparición del mismo identificador en el mismo
  archivo**: se genera el ledger con una aparición, se añade una segunda
  del mismo valor sin regenerar → código de salida distinto de cero
  (`cantidad_distinta`). Esta prueba demuestra exactamente el defecto que
  tenía la comparación solo por huella.
- **Negativa 4 — edición manual del ledger**: (a) se sube la cantidad a
  mano sin que el árbol cambie → falla; (b) se reclasifica una entrada de
  deuda a línea base a mano → falla.
- **Negativa 5 — envolver no exime**: un candidato sintético dentro de un
  array `patronesSecreto`, una regex JS y un `assert.doesNotMatch` se
  clasifica como `identificador_interno_historico`, nunca como
  `termino_tecnico`.
- **Control**: un directorio aislado sin ningún marcador → código de
  salida `0`.
- **Estructural, sin literales**: el documento de este cierre, el propio
  escáner y este mismo contrato se escanean con el escáner real —
  ninguno debe contener un candidato a identificador fuera de una
  ubicación legítima. Ya no se comparan contra los tres project refs
  escritos a mano en el propio contrato (eso habría sido la misma
  duplicación que este paquete corrige).

Todos los directorios temporales se crean fuera del repositorio, nunca se
añaden a git, y se eliminan en un `finally` tanto si la prueba pasa como
si falla. Ningún marcador sintético se parece a una credencial operativa
real ni queda en ningún artefacto committeado.

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
- **No se ha modificado ninguno de los archivos históricos de deuda**
  (PM02-PM23, ni los workflows/contratos de PM21-PM25 que ahora
  reclasifican a deuda) — solo cambió cómo el escáner los clasifica.

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
PM26_P02_DEUDA_REGISTRADA_ARCHIVOS=83
PM26_P02_DEUDA_REGISTRADA_COINCIDENCIAS=230
PM26_P02_LINEA_BASE_ARCHIVOS=11
PM26_P02_HISTORIA_GIT_REESCRITA=NO
PM26_P02_ROTACION_SOLICITADA_POR_REFS=NO
PM26_P02_MAIN_TOCADO=NO
PM26_P02_FUENTE_JS_TOCADO=NO
PM26_P02_NETLIFY_SUPABASE_TOCADO=NO
PM26_P02_ARCHIVOS_HISTORICOS_MODIFICADOS=NO
PM26_P02_GATE_REMOTO_HEAD=3bf7506b1a0d003fc7922de809f6175c8b94cd88
```

Cerrado sobre el commit `3bf7506b1a0d003fc7922de809f6175c8b94cd88`, con
gate remoto `SUCCESS` confirmado en los cinco workflows exactamente sobre
ese HEAD (tabla al inicio de este documento).

Los defectos A–H de PM26 P01 permanecen pendientes, sin corregir. PM25 P02
continúa PARCIAL/BLOQUEADO y se arrastra a la puerta final.
