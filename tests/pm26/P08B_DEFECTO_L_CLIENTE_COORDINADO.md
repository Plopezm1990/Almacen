# PM26 P08b — Defecto L: preflight endurecido, cliente coordinado, despliegue y rollback

## Estado

**PREPARADO. NO APLICADO Y NO DESPLEGADO.** El usuario autorizó
exactamente esto: corregir y endurecer el preflight, diseñar el cambio
de cliente compatible con producción y QA, y preparar el despliegue
coordinado, rollback conservador y pruebas sobre los esquemas anterior
y posterior — subiendo el commit únicamente a `claude/pm26-preparacion-tecnica`.
No se aplicó la migración, no se tocó `main` ni `release`, no se
desplegó en Netlify y no se escribió en producción, QA ni TPV.

Este paquete continúa `P08A_DEFECTO_L_PREPARACION_PRODUCCION.md` sin
reescribir su narrativa: esa preparación queda vigente en su alcance
original (inspección, diseño inicial, primera validación); aquí se
corrige, endurece y completa con la pieza que faltaba, el cliente.

**Actualización (PM26 P08e):** una reinspección en solo lectura de
producción encontró que `membresias_usuario` está **vacía**, así que
`private.la_tiene_local()` devuelve `false` para **todos** los usuarios.
Aplicar esta migración hoy no aislaría nada: dejaría al propietario
legítimo sin poder crear, leer ni borrar prefiltros. El preflight
(embebido e independiente) se endureció para rechazar ese estado de
forma explícita, y por eso los SHA-256 de la tabla de la sección 1
cambiaron respecto a P08b. El análisis completo, las alternativas
comparadas y el bloqueo documentado están en
`P08E_PRECONDICION_MEMBRESIAS_LEGACY.md`.

**Actualización (PM26 P08c):** el endurecimiento final previo a
producción está en `P08C_ENDURECIMIENTO_FINAL_PREVIO_PRODUCCION.md`.
P08c corrige dos cosas de este informe que no eran ciertas o no eran
seguras: (1) `revertir.sql` contaba las filas sin bloquear la tabla, de
modo que un `INSERT` concurrente podía confirmarse antes de que se
retiraran las columnas — ahora toma `ACCESS EXCLUSIVE` antes de contar
y lo mantiene hasta el `COMMIT`, demostrado con dos sesiones reales en
concurrencia; y (2) la sección 4 de este documento afirmaba que
revertir las políticas «cierra el aislamiento», cuando lo elimina y
reabre el Defecto L. Esa sección se reescribió en su sitio, señalada
como corrección; el resto del informe se mantiene intacto como
registro histórico.

---

## 1. Preflight corregido y endurecido

Dos comprobaciones nuevas y una corrección real, embebidas y en el
preflight independiente (siguen siendo byte a byte idénticas entre
ambos archivos):

1. **Huella del cuerpo del helper, no solo su firma.** La preparación
   original (P08a) solo comprobaba que `private.la_tiene_local(text,
   text)` existiera con esa firma. Una firma idéntica con un cuerpo
   distinto (por ejemplo, si alguien lo redefiniera para dejar de
   exigir `todos_locales` o el local exacto) habría pasado esa
   comprobación sin detectarlo. Ahora se compara, normalizado de
   espacios, el resultado completo de `pg_get_functiondef` contra el
   texto exacto verificado por inspección — si difiere en absolutamente
   nada, el preflight aborta.
2. **Exclusión explícita de QA.** Comprueba que no existan
   `private.pm11_puede_ver_personal` ni `private.pm11_puede_mutar_personal`
   (los helpers que sólo existen en QA). Su presencia es una señal
   adicional, independiente de las 3 políticas, de que el catálogo no
   es producción.
3. **Corrección real: rechaza `empresa_id` Y `local_id`, no solo el
   primero.** El preflight original solo comprobaba
   `empresa_id` como señal de "ya aplicado" — un estado parcial donde
   únicamente `local_id` ya existiera (por ejemplo, un `ALTER TABLE`
   previo interrumpido a medias) habría pasado esa comprobación sin
   detectarlo y llegado directo al segundo `ALTER TABLE ADD COLUMN
   local_id`, que habría fallado con un error genérico de Postgres en
   vez de este mensaje claro. Ahora comprueba ambas columnas por
   separado, cada una con su propio mensaje.

Las tres comprobaciones se probaron positiva y negativamente en el
Postgres local aislado: redefinir `la_tiene_local` con un cuerpo
distinto (`select true;`) hace abortar el preflight con el mensaje
exacto esperado, y se restaura explícitamente el original después,
sin dejar rastro; crear un `private.pm11_puede_ver_personal` simulado
también hace abortar, y se elimina explícitamente después; añadir solo
`local_id` (sin `empresa_id`) también hace abortar con el mensaje
específico de `local_id`, y se retira explícitamente después
(`PM26_P08_PREFLIGHT_DETECTA_LOCAL_ID_PARCIAL`).

SHA-256 de los dos archivos endurecidos (sustituyen a los documentados
en `P08A_DEFECTO_L_PREPARACION_PRODUCCION.md`):

| Archivo | SHA-256 |
|---|---|
| `tests/pm26/p08-defecto-l-produccion/migracion-propuesta.sql` | `667059f9e0b2fa0bce42daaa024d557524f6f42cb3a1a865cc9ac9636b88218c` |
| `tests/pm26/p08-defecto-l-produccion/preflight-independiente.sql` | `edb3ca7e9afc1051dc1857e639938fb7fe500874e8931312538d7ed4f3cff582` |

## 2. Cliente compatible con producción y QA

`crearLogicaPrefiltros` (en `source-recovery/fuente-recuperado.js`,
reconstruida en `fuente.js`) recibe ahora un parámetro `esQA`, derivado
en el único punto de llamada de `window.__modoPruebasQA === true` — la
misma señal que ya usa el Defecto K (P07b) para distinguir QA de
producción; no se introduce ningún mecanismo nuevo de detección de
entorno.

| Operación | Rama QA (`esQA=true`, sin cambios desde P07b/P07c) | Rama producción (`esQA=false`, nueva) |
|---|---|---|
| Crear | RPC `pm11_crear_prefiltro_candidato` | `INSERT` directo con `empresa_id`/`local_id`, token generado en el cliente |
| Listar | `SELECT` directo (sin cambios, válido para ambos esquemas) | igual |
| Eliminar | RPC `pm11_eliminar_prefiltro_candidato` | `DELETE ... .select()` |

**Corrección real encontrada al diseñar la rama de producción** (no
solo endurecimiento): un `DELETE` bloqueado por una política `USING`
no devuelve error en PostgREST/Postgres — simplemente no afecta
ninguna fila. Sin pedir explícitamente las filas devueltas
(`.select()` después de `.delete()`), el cliente no tendría forma de
distinguir un borrado bloqueado de uno real, y trataría ambos casos
como éxito. La rama de producción exige exactamente una fila devuelta
para considerar el borrado exitoso.

El generador de token de la rama de producción es idéntico, byte a
byte en su lógica, al que ya usa hoy el `fuente.js` congelado en
`main`/`release` (`crypto.randomUUID()` doble, con reserva sin
`crypto`) — no se inventa un mecanismo nuevo.

### Reconstrucción y verificación de la fuente

```bash
cd source-recovery && npm ci && cd ..
node source-recovery/verificar-build-canonico.mjs
```

Dos builds canónicos consecutivos produjeron el mismo hash (build
determinista). `node --check fuente.js` confirma sintaxis válida.

**Cómo se produjo `fuente.js` (hallazgo real de este paquete, no
supuesto):** un build limpio de la fuente canónica actual **no**
reproduce byte a byte el `fuente.js` ya congelado en `main`/`release`
— esto ya estaba documentado y aceptado desde PM26 P03b (esbuild
recorta algunos comentarios de línea y puede renombrar variables
locales según la composición global de un bundle de más de 5 MB,
incluso en zonas del archivo lejanas al cambio) y el propio informe de
P07b ya reflejaba tres hashes distintos para "fuente canónica",
"bundle servido" y "build canónico determinista" sin que nadie lo
hubiera explicado hasta ahora. Comprobado aquí de forma directa:
reconstruir en limpio la fuente canónica exacta de P08a (commit
`1a30358`) produce un hash distinto del `fuente.js` que ese mismo
commit tiene realmente congelado. Por tanto `fuente.js` **nunca** se
generó con "reconstruir y copiar" sin más — así lo confirma también
`source-recovery/post-pm08-patches/` (una serie de parches congelados
que PM09/PM10 aplicaron en su día directamente sobre el bundle
construido, no sobre la fuente).

Siguiendo ese mismo principio, el cambio de P08b sobre `fuente.js` se
aplicó como una edición quirúrgica y aislada directamente sobre el
`fuente.js` ya congelado y con gate en verde de P08a (`1a30358`):
exactamente el mismo texto que cambia en `crearLogicaPrefiltros` dentro
de `source-recovery/fuente-recuperado.js` (firma, rama `esQA`,
`generarTokenDirecto`, INSERT/DELETE directos), sin tocar ni un solo
byte del resto del archivo de 5 MB. Verificado con `node --check` y
con la batería completa de regresión (`tests/g1` a `tests/pm25`, más
de 100 contratos): **cero fallos nuevos**, incluidos los ~13 contratos
de PM09-PM17 que dependen de comentarios y caracteres no-ASCII
literales que un build limpio no conserva.

| Artefacto | SHA-256 |
|---|---|
| Fuente canónica (`source-recovery/fuente-recuperado.js`) | `10f5f3ef6ed120971ab2ad892f8f2736e953c9ba8e3e030618823954fdee54bc` |
| Bundle servido (`fuente.js`) | `84d416b440be81d52b2a6e28b1d30af0387a26453d727d4d28fa48583bd74f4e` |
| Build canónico determinista (`source-recovery/dist/fuente.js`) | `3efd60eaafd8f1c454537cdc38ce7939bdc0874070d26328a1327655bfb71cf7` |

Las tres huellas son distintas y así debe ser: la primera es la fuente
legible; la segunda es el bundle servido, editado quirúrgicamente sobre
el ya congelado; la tercera es la salida de un build limpio de la
fuente canónica, reproducible dos veces seguidas con el mismo hash,
que demuestra que la fuente compila y contiene la misma lógica sin
imponer una igualdad byte a byte que la propia P03b ya demostró
imposible de sostener.

### Regresión sobre los contratos existentes

`tests/pm26/p07b-contract.mjs` — que valida la rama QA en memoria con
dobles, sin ninguna petición real — se actualizó para reflejar la
extensión legítima (firma con `esQA`, comprobaciones agnósticas al
nombre local que `esbuild` pueda asignar a las variables
desestructuradas de la respuesta RPC, igual que ya se hizo en PM26
P03b) sin reescribir su narrativa histórica: la rama RPC de QA sigue
validada exactamente igual que en P07b, mismos dobles, misma
aserción de que las llamadas se hacen a las RPC correctas con el
contexto correcto. Las 5 mutaciones negativas de P07b (incluida
`sin-rpc-crear`) se re-ejecutaron sin cambios y se siguen detectando.

**Corrección real encontrada en esta reparación:** al añadir la rama
de producción, la comprobación original de `p07b-contract.mjs` que
garantizaba "la rama QA nunca muta `prefiltros_candidatos`
directamente" se había retirado por completo (en vez de acotarla a la
rama QA), y el mismo defecto existía sin corregir en
`tests/pm26/p06h-contract.mjs`. Ambos contratos aíslan ahora, contando
llaves (sin depender de la indentación exacta que produzca esbuild),
cada bloque `if (esQA) { ... }` de `crearLogicaPrefiltros` y comprueban
que ninguno contiene `.insert(`/`.delete(` directos — la prohibición
de mutación directa en QA queda tan estricta como antes de P08b. En
paralelo, `p07b-contract.mjs` valida ahora en positivo (no solo
tolera) el camino RLS directo exclusivo de producción: el `INSERT` con
`empresa_id`/`local_id` y el `DELETE` que exige `.select()` con
exactamente una fila.

## 3. Despliegue coordinado

El cliente y la migración deben desplegarse **en el mismo cambio**,
nunca uno sin el otro. Procedimiento real, no solo declarado:

### 3.1 Ventana de mantenimiento

`prefiltros_candidatos` tiene hoy 0 filas y un uso poco frecuente
(alta/baja manual de un Propietario). No existe un interruptor de
"modo mantenimiento" en la aplicación para esta tabla en concreto, ni
hace falta uno nuevo: dado el volumen real, la ventana se reduce a
minimizar el tiempo entre los dos pasos, no a bloquear tráfico.

1. Elegir un momento de baja actividad (fuera de horario comercial del
   negocio, verificado con quien opera la tienda).
2. Aplicar `migracion-propuesta.sql` en producción (autorización
   separada, no incluida aquí).
3. Publicar, **inmediatamente después y en el mismo despliegue**, la
   versión de `fuente.js` con la rama de producción del cliente (este
   commit) — Netlify publica de forma atómica, así que el hueco real
   es el tiempo entre "la migración terminó" y "el nuevo deploy queda
   `ready`", normalmente segundos.
4. Confirmar el deploy `ready` y, si es posible, hacer una alta y una
   baja de prueba real inmediatamente después (con un usuario de
   prueba, nunca con datos de un candidato real) antes de dar la
   ventana por cerrada.
5. Nunca al revés: publicar el cliente nuevo sin la migración rompería
   igual que hoy (las columnas no existen); aplicar la migración sin
   el cliente nuevo rompe el alta con el cliente viejo (demostrado en
   la sección 5, `POST1_CLIENTE_ANTIGUO_FALLA`).
6. Mientras esto no se autorice y despliegue, `main`/`release` siguen
   sirviendo el cliente antiguo sin cambios — este commit vive solo en
   la rama técnica y no afecta nada servido hoy.

### 3.2 Pestañas antiguas ya abiertas

Un navegador con la aplicación ya cargada antes del despliegue sigue
ejecutando el `fuente.js` antiguo en memoria hasta que se recargue —
Netlify no puede forzar una recarga de pestañas ya abiertas.

- **Efecto real, ya demostrado en `POST1_CLIENTE_ANTIGUO_FALLA`**: un
  `INSERT` desde esa pestaña antigua (sin `empresa_id`/`local_id`)
  falla de forma ruidosa (violación de RLS) en cuanto la migración ya
  esté aplicada — nunca se crea un prefiltro corrupto o sin
  aislamiento; el fallo es visible para quien lo usa, no silencioso.
- El listado (`SELECT`) y el borrado por token de una pestaña antigua
  siguen funcionando igual (no dependen de enviar empresa/local desde
  el cliente), así que una pestaña antigua no pierde acceso de lectura
  ni capacidad de borrar sus propias filas — solo falla la creación de
  prefiltros nuevos hasta recargar.
- Mitigación: avisar a quien vaya a usar la función de prefiltros justo
  antes/después de la ventana de mantenimiento para que recargue la
  página; dado el volumen de uso, el riesgo real de que alguien tenga
  la pestaña abierta exactamente en ese instante es bajo, y el efecto
  si ocurre es un error visible y recuperable con F5, no una escritura
  incorrecta.

### 3.3 Interrupción entre SQL y cliente

Si el despliegue se interrumpe **después** de aplicar
`migracion-propuesta.sql` pero **antes** de que el deploy del cliente
nuevo quede `ready` (fallo de Netlify, corte de red, etc.):

- Producción queda con el esquema nuevo (columnas NOT NULL, políticas
  con `la_tiene_local`) pero sirviendo todavía el cliente antiguo.
- Efecto: **toda** alta de prefiltro falla (mismo mecanismo que
  `POST1_CLIENTE_ANTIGUO_FALLA`) hasta que se resuelva. Ruidoso, no
  silencioso — no se pierden ni corrompen datos porque el `INSERT`
  nunca llega a insertar nada.
- Como en ese instante exacto la tabla sigue sin ninguna fila nueva
  (el cliente antiguo no puede escribir en el esquema nuevo), sigue
  cumpliéndose la precondición de `revertir.sql` (0 filas) — la
  reacción correcta es **revertir `migracion-propuesta.sql`
  inmediatamente con `revertir.sql`**, no esperar ni reintentar el
  deploy del cliente a ciegas. Eso devuelve producción al estado
  anterior (cliente antiguo + esquema antiguo) en segundos, y se
  reintenta el despliegue coordinado completo desde el principio.
- Solo si se confirma que el deploy del cliente está a punto de
  completarse (p. ej. Netlify sigue construyendo, no ha fallado) tiene
  sentido esperar en vez de revertir — nunca dejar este estado a medias
  sin decisión activa.

## 4. Rollback

> **Corregido en PM26 P08c.** La versión anterior de esta sección
> presentaba `revertir-conservador.sql` como la opción normal cuando ya
> hay tráfico, y afirmaba que revertir las políticas «cierra
> inmediatamente el aislamiento». Eso era **falso y peligroso**:
> restaurar las 3 políticas originales no cierra ni conserva el
> aislamiento — lo **elimina**, y vuelve a abrir el Defecto L. La
> sección se reescribe aquí para decirlo con exactitud; el resto del
> informe se mantiene como registro histórico.

### 4.0 Vía segura preferente: avance controlado (no revertir)

Si algo va mal con el cliente ya desplegado, la estrategia segura es
**mantener las columnas y las políticas con aislamiento** y corregir o
desplegar el cliente hacia delante. Revertir la protección para
arreglar un fallo del cliente cambia un problema de **disponibilidad**
(algo no funciona, se ve) por uno de **exposición de datos entre
empresas** (algo se ve que no debería, y no se ve que esté pasando).
El segundo es peor y además silencioso.

Los dos escenarios de abajo son excepciones a esta preferencia, no
alternativas equivalentes.

### 4.1 Sin tráfico real todavía (`revertir.sql`)

Si la ventana de mantenimiento se interrumpió (3.3) o se decide
revertir antes de que nadie haya podido crear un prefiltro con el
esquema nuevo, la tabla sigue en 0 filas. `revertir.sql` (sin cambios
de alcance respecto a P08a) restaura las 3 políticas originales con su
texto exacto y retira `empresa_id`/`local_id` por completo — reversión
exacta, sin rastro. **Ahora comprueba esa precondición él mismo**: si
al ejecutarlo encuentra alguna fila, aborta con
`ROLLBACK_FALLO` en vez de borrar columnas a ciegas (probado en
`PM26_P08_ROLLBACK_EXACTO_RECHAZA_CON_TRAFICO`).

### 4.2 Ya hubo tráfico real (`revertir-conservador.sql`) — excepcional

**Procedimiento excepcional y exclusivamente manual. No es el rollback
recomendado y no forma parte de ningún procedimiento automático.**
Exige autorización explícita y separada que nombre expresamente que se
acepta **reabrir el Defecto L** y durante cuánto tiempo. El propio
script lo impone: aborta con `ROLLBACK_CONSERVADOR_BLOQUEADO` salvo que
la sesión declare esa autorización a mano (probado en
`PM26_P08_ROLLBACK_CONSERVADOR_EXIGE_AUTORIZACION`).

Si el despliegue coordinado se completó y ya se crearon prefiltros
reales con `empresa_id`/`local_id` poblados, retirar esas columnas
destruiría para siempre esos valores. `revertir-conservador.sql`:

- Restaura las 3 políticas originales (solo por rol, sin
  `la_tiene_local`). Esto **no conserva el aislamiento: lo elimina**.
  Desde ese momento el Defecto L vuelve a estar abierto — un
  Propietario de otra empresa puede leer y borrar prefiltros de
  empresas y locales que no le corresponden, y las filas ya escritas
  quedan expuestas aunque conserven intactos su `empresa_id` y su
  `local_id`.
- Relaja `empresa_id`/`local_id` a `NULLABLE` en vez de eliminarlas
  (`ALTER COLUMN ... DROP NOT NULL`) — así, si además hace falta volver
  a desplegar el cliente antiguo (sin esos campos en el `INSERT`),
  puede volver a escribir sin romper `NOT NULL`.
- **No borra ni modifica ninguna fila existente** — probado
  explícitamente en `PM26_P08_ROLLBACK_CONSERVADOR_PRESERVA_DATOS`
  comparando un snapshot exacto (token, empresa_id, local_id) de todas
  las filas antes y después de ejecutarlo.
- Deliberadamente **no** deja el esquema bit a bit igual al anterior a
  la migración: las columnas siguen existiendo, ahora nullable. Es el
  precio de no perder datos reales. Retirarlas del todo, si más
  adelante se confirma que ninguna fila las necesita, es una decisión
  aparte y explícita con `revertir.sql` (que exige 0 filas) — nunca
  automática desde aquí.

### 4.3 Cliente y orden de reversión

- Revertir este commit (o el commit de despliegue coordinado) y
  reconstruir con `verificar-build-canonico.mjs` restaura exactamente
  `crearLogicaPrefiltros` a su forma previa a P08b — la rama de
  producción completa desaparece, sin dejar código muerto ni ramas
  condicionales huérfanas.
- **Sin tráfico real (4.1)**: revertir el cliente primero (para dejar
  de depender de las columnas) y la migración después, o ambos en el
  mismo cambio — nunca revertir solo la migración mientras el cliente
  nuevo siga desplegado, porque volvería a romper el alta (esta vez por
  columnas que dejan de existir en vez de por columnas que faltan).
- **Con tráfico real (4.2)**: el orden no importa para la integridad de
  los datos, porque `revertir-conservador.sql` nunca los toca. Sí
  importa para la exposición: en cuanto ese script restaura las
  políticas originales, **la protección desaparece** y el Defecto L
  queda abierto, tanto para las filas nuevas como para todas las ya
  escritas. Por eso la ventana entre ese paso y el restablecimiento
  del aislamiento debe ser lo más corta posible y estar acotada por
  escrito en la autorización que lo permitió. Volver a desplegar el
  cliente antiguo, si se desea, va después — pero la vía preferente
  sigue siendo 4.0: no llegar aquí.

## 5. Pruebas sobre los esquemas anterior y posterior

Ejecutadas en el mismo Postgres local aislado de P08a
(`tests/pm26/p08-defecto-l-produccion/validar.sh`), nunca contra QA ni
producción, reproduciendo el catálogo real verificado por inspección.

**Esquema ANTERIOR** (`transicion-anterior.sql`, antes de aplicar la
migración):

- `ANT1`: el cliente actualmente desplegado (`INSERT` sin
  empresa/local) sigue funcionando exactamente igual que hoy.
- `ANT2_BRECHA_REPRODUCIDA`: reproducción real, no solo declarada, de
  la brecha exacta que el Defecto L corrige — un Propietario de **otra
  empresa**, sin ninguna relación con la fila, la borra usando el
  mismo `DELETE` por token que usa el cliente actual, porque la
  política de hoy sólo exige rol Propietario, sin comprobar empresa ni
  local.

**Esquema POSTERIOR** (`transicion-posterior.sql`, tras aplicar la
migración):

- `POST1_CLIENTE_ANTIGUO_FALLA`: el mismo `INSERT` del cliente antiguo
  (sin empresa/local) ahora falla de forma real y ruidosa. El motivo
  observado es una violación de RLS, no de `NOT NULL` como se
  presuponía inicialmente: con `empresa_id`/`local_id` en `NULL`,
  `private.la_tiene_local(NULL, NULL)` evalúa a `false` antes de que
  la restricción de columna llegue a comprobarse. El efecto práctico
  — el alta se rompe sin coordinar el cliente — es el mismo que se
  documentó en P08a; el mecanismo exacto quedó corregido aquí tras
  comprobarlo realmente.
- `POST2_CLIENTE_NUEVO_FUNCIONA`: el `INSERT` con empresa/local (tal
  como lo envía la rama de producción del cliente nuevo) funciona.
- `POST3_BRECHA_CERRADA` / `POST3_SIN_RESIDUO_BORRADO`: el mismo
  intento de borrado cruzado de `ANT2` (Propietario de otra empresa,
  por token) reproducido ahora con el patrón exacto
  `DELETE ... RETURNING` (lo que genera `.delete().eq(...).select()`
  en supabase-js) afecta **0 filas** — sin excepción, sin residuo, la
  fila ajena sigue intacta.
- `POST4_BORRADO_PROPIO_FUNCIONA`: el mismo patrón `DELETE ...
  RETURNING`, ejecutado por el dueño real de la fila, sí la borra —
  confirma que el patrón de detección usado por el cliente nuevo
  (exigir exactamente una fila devuelta) no rompe el caso de éxito,
  sólo el bloqueado.

Reproducido dos veces de forma independiente, mismo resultado ambas
veces, junto con el resto de la batería ya validada en P08a (14 casos
de permisos, preflight positivo/negativo ampliado, reaplicación
rechazada, reversión exacta).

## 6. Corrección al gate histórico de P07c

Al reconstruir `fuente.js`/`source-recovery/**` para esta preparación,
el gate `pm26-p07c-aplicacion-f-qa.yml` empezó a fallar en remoto —no
por nada que P07c hiciera mal, sino porque su contrato y su paso de
"alcance acotado" exigían que, desde el commit base de P07c, **nada**
volviera a cambiar jamás en `fuente.js`/`source-recovery/**`/
`index.html`/`reset-pruebas-preview.js`/`_headers`, y que los SHA-256
documentados coincidieran con el árbol de trabajo **actual** en vez de
con el commit exacto donde el gate de P07c llegó a pasar en verde
(`41bf2e1d`, "reconstruye fuente en gate final"). Cualquier extensión
legítima posterior de esos archivos —esta misma, P08b— rompía ese gate
sin que P07c tuviera nada que ver con el cambio real.

Corregido para que P07c certifique lo que realmente certifica: un
hecho histórico inmutable, no una propiedad que deba seguir siendo
cierta para siempre.

- `tests/pm26/p07c-contract.mjs` ahora lee los seis archivos
  (`fuente-recuperado.js`, `fuente.js`, `index.html`,
  `reset-pruebas-preview.js`, `_headers` vía `git show
  41bf2e1d:<ruta>`; `source-recovery/dist/fuente.js` queda fuera por
  ser un artefacto de build nunca comprometido, ni siquiera en el
  propio commit de cierre) y compara sus SHA-256 contra el documento —
  nunca contra el árbol de trabajo actual.
- El paso "Proteger alcance" del workflow ya no exige una lista cerrada
  de archivos cambiados ni un diff vacío en el cliente desde el commit
  base — solo que el commit de cierre `41bf2e1d` siga existiendo y siga
  siendo antepasado de `HEAD` (que nadie reescribió esa historia), y
  que `supabase/migrations` siga sin ninguna migración real de F.
- Sin cambios de comportamiento ni de alcance en lo que P07c certificó
  en su momento (F aplicada en QA, preview validado) — solo se corrigió
  **cómo** se sigue verificando ese hecho histórico.

## Qué NO se hizo

- No se aplicó la migración en producción, QA ni TPV.
- No se desplegó ningún cambio de cliente — vive solo en esta rama
  técnica.
- No se tocó `main`, `release` ni Netlify.
- No se amplió el alcance de quién puede usar el flujo (sigue
  exigiendo rol Propietario).
- No se reescribió la narrativa histórica de P07b ni de P08a — sus
  contratos se actualizaron para seguir siendo ciertos, no sus
  informes.

```
PM26_P08B_ESTADO=PREPARADO_NO_APLICADO_NO_DESPLEGADO
PM26_P08B_PREFLIGHT_HUELLA_CUERPO_HELPER=SI
PM26_P08B_PREFLIGHT_EXCLUYE_HELPERS_QA=SI
PM26_P08B_PREFLIGHT_RECHAZA_AMBAS_COLUMNAS=SI
PM26_P08B_PREFLIGHT_ENDURECIDO_PROBADO_POSITIVO_Y_NEGATIVO=SI
PM26_P08B_CLIENTE_COMPATIBLE_QA_Y_PRODUCCION=SI
PM26_P08B_CLIENTE_ESQA_DERIVADO_DE_SENAL_EXISTENTE=SI
PM26_P08B_CORRECCION_DETECCION_DELETE_BLOQUEADO=SI
PM26_P08B_QA_MUTACION_DIRECTA_PROHIBIDA=SI
PM26_P08B_PRODUCCION_RLS_DIRECTO_VALIDADO=SI
PM26_P08B_BUILD_DETERMINISTA=SI
PM26_P08B_REGRESION_P07B_ACTUALIZADA_SIN_REESCRIBIR=SI
PM26_P08B_P07C_ANCLADO_A_CIERRE_HISTORICO=SI
PM26_P08B_DESPLIEGUE_COORDINADO_DOCUMENTADO=SI
PM26_P08B_VENTANA_MANTENIMIENTO_DOCUMENTADA=SI
PM26_P08B_PESTANAS_ANTIGUAS_DOCUMENTADO=SI
PM26_P08B_INTERRUPCION_SQL_CLIENTE_DOCUMENTADA=SI
PM26_P08B_ROLLBACK_CONSERVADOR_DOCUMENTADO=SI
PM26_P08B_ROLLBACK_CONSERVA_DATOS_CON_TRAFICO=SI
PM26_P08B_PRUEBAS_ESQUEMA_ANTERIOR=PASS
PM26_P08B_PRUEBAS_ESQUEMA_POSTERIOR=PASS
PM26_P08B_APLICADO_EN_PRODUCCION=NO
PM26_P08B_APLICADO_EN_QA=NO
PM26_P08B_DESPLEGADO_EN_NETLIFY=NO
PM26_P08B_MAIN_RELEASE_TOCADOS=NO
```

Pendiente de que el usuario autorice, por separado y de forma
explícita, (1) aplicar la migración en producción y (2) el despliegue
coordinado del cliente que la acompaña. Ninguna de las dos cosas se
ejecuta con esta preparación. Quedan Aviso G y PM25–P02 sin tocar.
