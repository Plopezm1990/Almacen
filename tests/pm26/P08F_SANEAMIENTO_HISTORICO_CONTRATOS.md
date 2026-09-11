# PM26 P08f — Saneamiento histórico de contratos y corrección documental

## Estado

**CERRADO. NADA APLICADO, NADA DESPLEGADO, NADA TOCADO EN PRODUCCIÓN.**

Este paquete no diseña ni aplica el Defecto L y no toca ningún artefacto
de la aplicación. Hace dos cosas y solo dos:

1. **Repara cuatro contratos históricos** (`p04a`, `p06c`, `p06i`,
   `p07a`) que validaban contra el **árbol vivo** en vez de contra el
   commit exacto de su propio cierre.
2. **Corrige la documentación de P08e** en dos puntos concretos: retira
   `almacen_kv` escrito desde la aplicación como catálogo aceptable, y
   declara de forma explícita qué NO comprueba el guard de membresías.

---

## 1. El defecto reparado

Un paquete cerrado certifica un **hecho histórico inmutable**: que en el
commit donde su gate pasó en verde, los artefactos decían lo que su
informe afirma. **No** certifica una propiedad que deba seguir siendo
cierta para siempre sobre archivos que otros paquetes seguirán
modificando de forma legítima.

Los cuatro contratos leían `fuente.js`, `_headers`, `index.html`,
`reset-pruebas-preview.js`, el ledger de seguridad y hasta el propio
inventario de archivos rastreados **del árbol de trabajo actual**. En
cuanto la rama avanzó (K, F, H, P07b, P08b…), esos gates empezaron a
fallar por cambios que no tenían nada que ver con ellos.

Es exactamente el defecto que **PM26 P08b ya había corregido en P07c**,
anclándolo a su commit de cierre `41bf2e1d`. P08f extiende ese mismo
patrón a los cuatro que quedaban.

### Síntoma exacto de cada uno, antes de la reparación

| Contrato | Fallaba en | Causa |
|---|---|---|
| `p04a` | `_headers` con hash distinto al registrado | leía `_headers` del árbol vivo; P04b lo modificó después |
| `p06c` | la URL literal del defecto K «no existe en `fuente.js`» | leía `fuente.js` vivo; P07b reescribió ese flujo |
| `p06i` | `true !== false` en la Fase B | leía `fuente.js` vivo; P07b cableó `pm11_crear_prefiltro_candidato` |
| `p07a` | «P07a no debe modificar `fuente.js`» | comparaba el blob **vivo** contra el baseline P06i |

Ninguno de los cuatro estaba en rojo en GitHub: sus últimos runs remotos
son SUCCESS sobre sus propios commits de cierre, y sus filtros `paths:`
no los volvían a disparar. Eran **gates latentes**: habrían fallado en
cuanto algo volviera a tocar sus rutas.

## 2. Commits de cierre usados como ancla

Cada uno es el SHA exacto donde el workflow propio del paquete terminó
en SUCCESS, comprobado contra el historial de runs de GitHub Actions.

| Paquete | Commit de cierre | Run remoto | Resultado |
|---|---|---|---|
| P04a | `2ac878c96275a26e72ee2af061b2f3953e10a90f` | `34392502851` | success |
| P06c | `9505ada0f16af8b99cfb8538d71be0e95dac8e69` | `34405829096` | success |
| P06i | `4d34052b9f618d67ba1dae150215038f4adae75d` | `34446557537` | success |
| P07a | `d62162fb6c512ea9fd237de1f2e2bb0ea5debeec` | `34461008439` | success |

`p07a` mantiene además su baseline previo
`4d34052b9f618d67ba1dae150215038f4adae75d` (cierre de P06i), pero ahora
lo compara contra los blobs de **su propio cierre**, no contra el árbol
vivo.

## 3. Qué cambia y qué NO cambia

**Cambia únicamente la FUENTE de los bytes:**
`fs.readFileSync(<árbol vivo>)` → `git show <cierre>:<ruta>`.

**No cambia ninguna aserción.** Ninguna comprobación se ha debilitado,
eliminado, relajado ni vuelto opcional. Los mismos hashes, los mismos
patrones, los mismos conteos, los mismos órdenes.

Se mantienen deliberadamente **en vivo** dos clases de comprobación,
porque medirlas contra el árbol actual es más exigente, no menos:

- **Los informes propios de cada paquete** (`P04A_…md`,
  `P06B_…md`, `P06I_…md`, `P07A_…md` y su JSON de evidencia): deben
  seguir diciendo lo mismo hoy. En `p04a` y `p06i` se añade además una
  comprobación nueva de que el informe **no se ha reescrito** respecto
  al certificado en su cierre.
- **El escáner de secretos y las pruebas vivas** (`p04a` ejecuta de
  verdad `tests/pm12/p10-preview-smoke-contract.mjs` y
  `tests/pm11-compra/p10-regresion-integral-contract.mjs`; `p06i`
  vuelve a ejecutar el contrato completo `p06f` contra PostgreSQL
  aislado).

## 4. Módulo compartido de anclaje

`tests/pm26/lib/cierre-historico.mjs`. Su función `anclar(sha, etiqueta)`
exige, antes de devolver nada:

1. Que el SHA tenga forma de SHA-1 completo de 40 caracteres.
2. Que **exista** en este repositorio.
3. Que sea un **commit**, no otro tipo de objeto.
4. Que **siga siendo antepasado de HEAD** — si alguien reescribiera la
   historia y lo sacara de esta rama, el gate falla en vez de pasar en
   vacío.

Expone `leer`, `leerBuffer`, `sha256`, `oid`, `existe` y
`listarArchivos`, todas sobre ese commit. Una ruta que no exista en él
lanza con mensaje claro; nunca devuelve vacío en silencio.

## 5. Controles negativos añadidos

El riesgo real de anclar al pasado es que un contrato pase **en vacío**:
que lea el archivo equivocado, o una cadena vacía, y dé todo por bueno.
Se añaden controles que lo descartan.

### 5.1 En el propio módulo — `comprobarAnclajeNoPasaEnVacio()`

Los cuatro contratos la ejecutan. Verifica que `anclar` **rechaza**:

- Un SHA con forma válida pero inexistente (`000…0`).
- Una cadena que ni siquiera tiene forma de SHA.
- Un objeto que existe pero **no es un commit** (el árbol de HEAD).
- Un **commit huérfano real**, creado al vuelo con `git commit-tree` sin
  ninguna referencia que lo apunte, que por construcción no es
  antepasado de HEAD. El control comprueba primero que efectivamente no
  lo es, y luego que `anclar` lo rechaza.

Además, cada contrato comprueba que pedir una ruta inexistente en su
commit de cierre lanza, y que `existe()` devuelve `false` para ella.

### 5.2 Por contrato

| Contrato | Control negativo |
|---|---|
| `p04a` | Recorta la lista de archivos permitidos y exige que el recorrido del grafo **detecte** las referencias reales que antes excluía (10 detectadas). Verifica que el ledger no declara presente un archivo inexistente. Mutaciones en memoria de `reset-pruebas-preview.js`: sin guard de host y con modo QA adelantado, la frontera universal/QA debe fallar. |
| `p06c` | Exige que los literales de la URL de K sean **exactamente dos** y del mismo proyecto; mutación que los sustituye por una ruta relativa debe hacer fallar la comprobación. |
| `p06i` | Mutación que **inyecta** `pm11_crear_prefiltro_candidato` en el artefacto certificado debe hacer fallar la comprobación de «Fase B fuera de alcance» — sin esto no se distinguiría de un `includes` que siempre da `false` por leer el archivo equivocado. Exige además que `fuente.js` del cierre no sea un artefacto vacío o truncado. |
| `p07a` | Exige que el blob vivo de `fuente.js` **difiera** del baseline P06i: si coincidiera, la comparación estaría contrastando siempre lo mismo consigo mismo. Mutaciones en memoria: sin una de las dos URL, sin el INSERT directo, y con la Fase B inyectada. |

### 5.3 Control negativo externo, sobre los cuatro a la vez

Reanclando cada contrato al HEAD actual en vez de a su cierre, los cuatro
**fallan**, cada uno por su motivo real:

```
p04a anclado a HEAD -> PM26 P04a no debe tocar _headers -- hash distinto
p06c anclado a HEAD -> la URL hardcodeada citada en el defecto K debe existir literalmente en fuente.js
p06i anclado a HEAD -> la Fase B no debia estar cableada en el cierre de P06i
p07a anclado a HEAD -> P07a no debe modificar fuente.js
```

Esto demuestra que siguen leyendo contenido real y afirmando cosas
reales sobre él. `p08f-contract.mjs` reproduce esta prueba de forma
automática sobre copias temporales, no sobre los archivos del
repositorio.

## 6. Corrección documental de P08e

### 6.1 `almacen_kv` retirado como catálogo

La sección 3.2 del informe de P08e proponía, como primer paso del camino
seguro, «persistir la clave `locales` en `almacen_kv` desde la
aplicación». **Queda retirada.**

Era la misma alternativa C que la propia tabla de alternativas ya
rechazaba por circular, reintroducida por la puerta de atrás.
`almacen_kv` no tiene columna de usuario, de empresa ni de local, y su
autorización es por `perfiles.rol` más una lista blanca de claves: el
propio Propietario puede escribir esa clave desde el navegador. Un
catálogo que la persona autorizada reescribe a voluntad no es fuente de
autoridad — validar una membresía contra él equivale a validarla contra
el navegador, que es exactamente el Defecto L.

El paso 1 pasa a exigir un **catálogo backend con autoridad real**: una
tabla propia de empresas y locales, escrita solo por vía administrativa
y protegida por RLS que impida al Propietario darse de alta a sí mismo
donde no le corresponde.

### 6.2 Límite explícito del guard

Se añade la sección **4.1 «Qué NO comprueba este guard»** al informe de
P08e. El guard valida **presencia y coherencia estructural** de las
membresías. **No valida:**

- **La procedencia.** No distingue una fila insertada por vía
  administrativa de una insertada por cualquier otro camino.
- **La correspondencia con un catálogo backend real.** No existe tal
  catálogo, así que `empresa_id`/`local_id` se validan **solo por
  forma**. `'EMPRESA_INVENTADA'` / `'LOCAL_INVENTADO'` es
  estructuralmente coherente y pasaría.
- **Que el local pertenezca a esa empresa.** Sin catálogo no hay
  relación que verificar.

Pasar el guard significa «la migración no dejará al propietario sin
acceso», **no** «la autorización es correcta».

No se inventó ningún identificador ni ninguna membresía para escribir
esto.

## 7. Verificación

- Los cuatro contratos reparados pasan en local y en remoto.
- `p08e-contract.mjs` se amplía con los cinco marcadores nuevos y con
  las frases de la corrección; sigue en verde.
- Regresión acumulada completa y escáner de secretos.
- El control negativo externo de 5.3 reproducido de forma automática.

## Qué NO se hizo

- No se aplicó ninguna migración.
- No se creó ninguna membresía.
- No se escribió en Supabase, QA, producción ni TPV.
- No se tocó `fuente.js`, `source-recovery/`, `_headers`, `index.html`,
  `reset-pruebas-preview.js` ni ningún artefacto de la aplicación.
- No se desplegó en Netlify.
- No se tocó `main` ni `release`.
- No se fusionó ni cerró la PR #38.
- No se debilitó, eliminó ni volvió opcional ninguna comprobación.
- No se reabrió ningún paquete cerrado: los cuatro siguen certificando
  exactamente lo mismo que certificaban.

```
PM26_P08F_ESTADO=CERRADO_SANEAMIENTO_HISTORICO
PM26_P08F_CONTRATOS_REPARADOS=4
PM26_P08F_ANCLADOS_A_SU_CIERRE=SI
PM26_P08F_SHA_EXISTE_Y_ES_ANTEPASADO_COMPROBADO=SI
PM26_P08F_COMPROBACIONES_DEBILITADAS=0
PM26_P08F_COMPROBACIONES_ELIMINADAS=0
PM26_P08F_COMPROBACIONES_OPCIONALES=0
PM26_P08F_CONTROLES_NEGATIVOS_ANADIDOS=SI
PM26_P08F_CONTROL_NEGATIVO_REANCLAJE_A_HEAD=PASS
PM26_P08F_P08E_ALMACEN_KV_RETIRADO=SI
PM26_P08F_P08E_LIMITE_DEL_GUARD_DECLARADO=SI
PM26_P08F_IDENTIFICADORES_INVENTADOS=NO
PM26_P08F_MEMBRESIAS_INVENTADAS=NO
PM26_P08F_ARTEFACTOS_APLICACION_TOCADOS=NO
PM26_P08F_MIGRACION_APLICADA=NO
PM26_P08F_ESCRITURA_EN_SUPABASE=NO
PM26_P08F_DESPLEGADO_EN_NETLIFY=NO
PM26_P08F_MAIN_RELEASE_TOCADOS=NO
PM26_P08F_PR_38_CERRADA_O_FUSIONADA=NO
PM26_P08F_DEFECTO_L_CORREGIDO_EN_PRODUCCION=NO
```

El Defecto L sigue sin aplicarse en producción y sigue bloqueado por la
precondición de P08e, ahora documentada con su límite real.
