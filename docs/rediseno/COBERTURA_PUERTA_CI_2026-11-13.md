# Los filtros de rutas de la puerta: lo que no se dispara no protege

13 de noviembre de 2026. Esto no estaba en el plan del rediseño. Salió de
investigar por qué `p2-p06` se puso en rojo en el PR #225, y conviene que quede
escrito porque afecta a la puerta, no a la apariencia.

## La regla

Todo archivo que un contrato **lee** tiene que estar en el filtro `paths:` del
flujo que lo ejecuta. Si falta, el contrato solo se dispara cuando el PR toca
por casualidad algún otro archivo de la lista. Deja de ser un contrato y pasa a
ser una lotería.

## El caso que lo destapó

El contrato `p2-p06` hace **seis aserciones** sobre `edge-auth-patch.js`, que es
donde viven los guardas de lectura y escritura por rol. Ese archivo **no estaba**
en su filtro.

El PR #220 cambió exactamente esas líneas: convirtió

```js
if (rol === "Propietario") return getOriginal(key, shared);
```

en un bloque que antes de devolver pasa `empleados` por
`empleadosPropietarioSinSecretos`, que borra el PIN. Un endurecimiento correcto.
El contrato no se enteró, siguió exigiendo la forma vieja y salió en rojo
semanas después, en una rama que sí tocaba `index.html`.

Dos consecuencias, y la segunda es la grave:

1. Un cambio en la capa de autoridad de servidor pasó sin su contrato.
2. El contrato quedó desalineado y, cuando por fin se disparó, lo hizo contra
   trabajo ajeno, en una rama que no lo había provocado.

Arreglado en dos pasos: el contrato ahora fija la forma endurecida y, además,
el filtro de `p2-p06` incluye los dos archivos que leía a ciegas,
`edge-auth-patch.js` e `index-storage-bootstrap.js`.

## El barrido

Con la regla escrita, se puede medir. `docs/rediseno/auditar-filtros-de-rutas.mjs`
lo hace sin dependencias y sin escribir nada:

```bash
node docs/rediseno/auditar-filtros-de-rutas.mjs --detalle
```

| | |
|---|---|
| Flujos con filtro de rutas | **205** |
| Flujos sin filtro, que corren siempre | **40** |
| Flujos con **algún** archivo leído fuera de su filtro | **64** |
| Flujos cuyo contrato lee el paquete (`fuente.js` o la copia legible) | **87** |
| De esos, **ciegos al paquete** | **37** |

No todos los 64 son igual de serios. Un contrato que lee su propio documento de
evidencia no necesita volver a correr porque cambie ese documento. Hay que
mirarlos uno a uno, y por eso no se ha tocado ninguno más.

Los **37 ciegos al paquete** sí importan, y le importan directamente a este
trabajo: **el rediseño edita `fuente.js`**. Un PR que solo tocara el paquete se
saltaría 37 contratos que hacen aserciones sobre el paquete.

Es la razón de fondo por la que en este rediseño la batería local de 304
contratos, que corre todos sin mirar rutas, ha pesado más que la puerta remota.
No es desconfianza: es que la puerta remota, por construcción, no corre lo que
su filtro no nombra.

## Corrección del 14/11: de 37 a 2

La cifra de **37 flujos ciegos al paquete** es correcta como medida, pero la
conclusión que saqué de ella no lo era. Al mirar uno por uno **qué los
dispara**, el cuadro cambia:

| | |
|---|---|
| Se disparan en **PR a `release`**, que es la puerta | **3** |
| Se disparan al empujar a su **propia rama de trabajo**, que existe | 33 |
| Escuchan una rama que no existe | 1 |

Los 33 no son parte de la puerta: son flujos de su línea de trabajo, y corren
cuando alguien empuja a su rama. Que no se disparen con el paquete en un PR a
`release` no es un agujero de la puerta, es que no son la puerta.

Y de los 3 que sí lo son, uno —`abc-f4-b11-offline-contract`— **ya estaba
cubierto en la práctica**: su filtro lista `source-recovery/fuente-recuperado.js`,
y por la regla de paridad esa copia cambia siempre que cambia `fuente.js`. Mi
auditoría lo marcó porque compara nombres literales, no equivalencias.

Así que el hueco real de la puerta eran **dos flujos**:
`p2-edge-security-candidate` y `p2-r03a-release-current`, cuyos contratos leen
`fuente.js` y cuyo filtro no lo nombraba ni a él ni a su copia.

Eso creí, y añadí `fuente.js` y la copia legible a sus rutas tras comprobar que
sus tres contratos pasan en esta rama —`P2_R03A_CONTRACT_OK=1`,
`P2_EDGE_SECURITY_CONTRACT_OK=1`, `P2_EDGE_SECURITY_BEHAVIOR_OK=1`—. **Estaba
mal, y la puerta remota lo dijo**: la sección siguiente cuenta por qué.

La lección: **una auditoría que cuenta ficheros no sabe lo que importa.** Medir
los 37 estuvo bien; haber dicho que los 37 eran un agujero de la puerta, no.

## Corrección del 14/11, la segunda: los dos tampoco eran un hueco

El PR se puso en rojo en `p2-r03a` y `edge-security`, los dos flujos cuyo filtro
había ampliado, y en ninguno falló un contrato. Falló el primer paso, que en
los dos se llama **«Frontera exacta del candidato»**.

Lo que hace ese paso es comparar los archivos que el PR cambia contra una lista
fija y abortar si no coinciden:

```bash
BASE='a34ac998f6e806e4dbeefaf511f4de6ca3bbbfc4'
mapfile -t changed < <(git diff --name-only "$BASE"...HEAD | LC_ALL=C sort)
expected=$'.github/scripts/p2-r03a/contract.mjs
…'   # cinco archivos
test "$actual" = "$expected"
```

Es decir: **su `paths:` no es un filtro de cobertura, es un cerrojo de disparo.**
No está ahí para que el contrato corra cuando cambia lo que lee; está ahí para
que el flujo solo se despierte en su propio candidato histórico. Ampliárselo no
mejora nada: lo único que consigue es que se dispare en PRs que su frontera va a
rechazar. Es lo que pasó.

`edge-security` lo hace de forma algo más fina —filtra los cambios del PR a su
propio perímetro y acepta siete formas conocidas de ese subconjunto— y ahí el
detalle es casi cómico: el único archivo de su perímetro que este PR tocaba era
**el propio workflow, porque yo acababa de editarle las rutas**. Un perímetro de
un solo archivo no coincide con ninguna forma aceptada, y abortó:

```
Perímetro P2-SEC no reconocido:
.github/workflows/p2-edge-security-candidate.yml
```

**Revertido.** Las cuatro líneas que añadí se han quitado y los dos flujos
vuelven a no dispararse en este PR, que es lo correcto para lo que son.

### Por qué `p2-p06` sí se podía ampliar

Porque es el único de los siete que **degrada en vez de abortar**:

```bash
if [ "$actual" != "$expected" ]; then
  echo "P2_P06_SCOPE=SKIP_MIXED_PR"
else
  echo "P2_P06_SCOPE=PASS"
fi
```

Reconoce que un PR mixto no es su candidato, lo dice, y sigue ejecutando sus
contratos. Por eso ampliarle el filtro funcionó y por eso aquella ampliación se
queda: es lo que puso a correr su contrato en este PR y lo que destapó que
exigía la forma vieja de `edge-auth-patch.js`.

### La clase, contada

Siete flujos tienen frontera exacta, todos en PR a `release`, y **seis abortan**:

| | |
|---|---|
| Con frontera exacta | **7** |
| De esos, que abortan si el PR no es su candidato | **6** |
| Que degradan a `SKIP_MIXED_PR` | 1 (`p2-p06`) |

La auditoría ya lo sabe: `FLUJOS_CON_FRONTERA_EXACTA=7`, y con `--paquete`
marca `[FRONTERA EXACTA: no ampliar]` en los que además salen como ciegos al
paquete. Así el próximo que lea la lista no repite mi error.

### Y el recuento honesto

Dije que el hueco real de la puerta eran dos flujos. **Eran cero.** Los dos que
quedaban no son puerta de PRs futuros: son certificaciones de un candidato
histórico concreto que siguen escuchando `pull_request`. Que no se disparen con
el paquete no es un descuido, es su diseño.

Convertir esos seis en algo que degrade como `p2-p06` **sí** sería una mejora de
la puerta, y **no se hace aquí**: cambia el comportamiento de la puerta en todos
los PR futuros y no tiene nada que ver con la apariencia. Queda medido y con el
ejemplo de cómo se arregla uno, que es `p2-p06`.

## Lo que no se ha hecho, y por qué

Cerrar los 37 no se ha metido aquí. Cambiaría el comportamiento de la puerta en
**todos** los PR futuros, exige criterio flujo por flujo, y es más que probable
que despierte contratos que llevan meses dormidos y salgan en rojo por cosas
que no tienen nada que ver con la apariencia. Eso es trabajo con su propio
triaje, y meterlo en el PR del rediseño convertiría un cambio de presentación en
una reforma de la puerta.

Queda medido, reproducible con un comando, y con el caso de `p2-p06` ya cerrado
como ejemplo de cómo se arregla uno.

## 14/11, por la tarde: lo que el rediseño no tenía vigilado era el rediseño

Buscando trabajo que no necesitara sesión de QA apareció el hueco más
incómodo de todos, porque era mío. Este documento habla de los filtros de la
puerta y de los 37 flujos ciegos al paquete, y mientras media eso no miré lo
que tenía delante: **las seis capas con las que se hace el rediseño no
apareciían en ningún contrato ni en ningún flujo.**

Medido, no supuesto: buscar cada uno de los seis nombres de archivo en `tests/`,
en `.github/` y en los guiones de `docs/rediseno` no devolvía nada. Ni una
referencia, para ninguna de las seis.

| Capa | Quién la vigilaba |
|---|---|
| `la-apariencia.css` | nadie |
| `la-pase.css` | nadie |
| `la-apariencia.js` | nadie |
| `la-apariencia-editor.js` | nadie |
| `la-pase-panel.js` | nadie |
| `la-tablas-fichas.js` | nadie |

El banco de apariencia cubre tres de ellas y tiene 24 comprobaciones, pero vive
en `docs/`, que la puerta no ejecuta y que el artefacto publicado excluye. Es
una herramienta para mirar, no una red.

### Y algo peor que un hueco

`tests/cfg/f7-preflight-static-contract.mjs` excluía las dos migraciones del
rediseño de su foto histórica con esta razón escrita:

> Apariencia por empresa pertenece al rediseño posterior y **se valida con su
> propio contrato**.

Y la segunda, «se valida con **el mismo contrato propio**». Ese contrato no
existía. Dos migraciones salieron de la foto apoyándose en una red que nadie
había tejido.

Es el **tercer caso del mismo patrón en dos días**, y conviene verlos juntos
porque ya no es casualidad:

| Dónde | La forma |
|---|---|
| Asignar mesa en el TPV | `if (typeof f !== "function") return;` — un `return` mudo |
| Regresiones heredadas en 9 flujos | `if [ -f "$f" ]; then node "$f"; fi` — un salto en silencio |
| Exclusión de f7-preflight | un comentario que afirma un contrato inexistente |

Los tres convierten **lo que falta en un aprobado**. Dos eran código y uno era
prosa, y la prosa engaña igual de bien.

### El contrato, y lo que cuesta

`tests/rediseno/p01-capas-y-migraciones-contract.mjs`, estático, sin red y sin
base de datos. Las seis capas enlazadas una sola vez y con su marca `?v=`;
ninguna huérfana en el árbol; la **huella de cada capa fijada junto a su
marca**; y las seis funciones públicas de las dos migraciones, cada una
retirada de `public` y `anon` y concedida solo a `authenticated`. Además
comprueba que la exclusión de f7-preflight sigue nombrándolo, para que la nota
no vuelva a quedarse huérfana.

Lo de la huella es lo que impide repetir el fallo del 13/11: cambié
`la-apariencia.css`, no subí su marca, y el preview sirvió la copia anterior.
Lo peor no fue el fallo, fue que **`fetch` me dio un verde falso**, porque
`fetch` se salta la caché que el navegador sí estaba usando. Un contrato
estático no se deja engañar por eso.

El coste, dicho sin adornos: **cambiar una capa obliga a tocar el contrato.**
Es a propósito, y es la parte que a alguien le va a molestar. La fricción es
exactamente el paso que me salté.

### La prueba negativa encontró un fallo en el propio contrato

Cinco mutaciones, cada una con restauración garantizada del archivo. Cuatro
pusieron el contrato en rojo. **La quinta se quedó en verde**, y era un fallo
mío: el patrón decía

```js
new RegExp(`revoke all on function public\.${fn}[^;]*from public, anon`)
```

y ese `[^;]*` se tragaba el sufijo del nombre, así que
`abc_apariencia_guardar_otro` colaba como si fuera `abc_apariencia_guardar`.
Anclado con `\s*\(`, cayó como debía. Queda escrito en el código por qué
lleva ese paréntesis, para que nadie lo «simplifique».

La lección, que es la misma de todo este documento vista del otro lado: un
contrato que no se ha visto fallar no se sabe si vigila. Escribir la prueba
negativa costó diez minutos y encontró un defecto en el primer intento.

La puerta queda en **359 entradas, 342 contratos activos, 306 en Node**.
