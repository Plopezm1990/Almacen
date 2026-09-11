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

---

## 1. Preflight corregido y endurecido

Dos comprobaciones nuevas, embebidas y en el preflight independiente
(siguen siendo byte a byte idénticas entre ambos archivos):

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

Ambas comprobaciones se probaron positiva y negativamente en el
Postgres local aislado: redefinir `la_tiene_local` con un cuerpo
distinto (`select true;`) hace abortar el preflight con el mensaje
exacto esperado, y se restaura explícitamente el original después,
sin dejar rastro; crear un `private.pm11_puede_ver_personal` simulado
también hace abortar, y se elimina explícitamente después.

SHA-256 de los dos archivos endurecidos (sustituyen a los documentados
en `P08A_DEFECTO_L_PREPARACION_PRODUCCION.md`):

| Archivo | SHA-256 |
|---|---|
| `tests/pm26/p08-defecto-l-produccion/migracion-propuesta.sql` | `0012ddcb65c3dd0923b25dd7486c111b2a41265030c3a78aa75f9b3643a5ef9c` |
| `tests/pm26/p08-defecto-l-produccion/preflight-independiente.sql` | `a66d237b4bf72e404b1ca7da1436f547d0b8a15d4d880dc50894223b5eb13587` |

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

## 3. Despliegue coordinado

El cliente y la migración deben desplegarse **en el mismo cambio**,
nunca uno sin el otro:

1. Aplicar `migracion-propuesta.sql` en producción (autorización
   separada, no incluida aquí).
2. Publicar, en el mismo despliegue, la versión de `fuente.js` con la
   rama de producción del cliente (este commit).
3. Nunca al revés: publicar el cliente nuevo sin la migración
   rompería igual que hoy (las columnas no existen); aplicar la
   migración sin el cliente nuevo rompe el alta con el cliente viejo
   (demostrado en la sección 5).
4. Mientras esto no se autorice y despliegue, `main`/`release` siguen
   sirviendo el cliente antiguo sin cambios — este commit vive solo en
   la rama técnica y no afecta nada servido hoy.

## 4. Rollback conservador

- **SQL**: `revertir.sql` (sin cambios de alcance respecto a P08a) —
  restaura las 3 políticas originales con su texto exacto, retira las
  columnas nuevas, no toca ningún grant.
- **Cliente**: revertir este commit (o el commit de despliegue
  coordinado) y reconstruir con `verificar-build-canonico.mjs` restaura
  exactamente `crearLogicaPrefiltros` a su forma previa a P08b — la
  rama de producción completa desaparece, sin dejar código muerto ni
  ramas condicionales huérfanas.
- **Orden de reversión**: si alguna vez se llega a desplegar, revertir
  el cliente primero (para dejar de depender de las columnas) y la
  migración después, o ambos en el mismo cambio — nunca revertir solo
  la migración mientras el cliente nuevo siga desplegado, porque
  volvería a romper el alta (esta vez por columnas que dejan de
  existir en vez de por columnas que faltan).

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
PM26_P08B_PREFLIGHT_ENDURECIDO_PROBADO_POSITIVO_Y_NEGATIVO=SI
PM26_P08B_CLIENTE_COMPATIBLE_QA_Y_PRODUCCION=SI
PM26_P08B_CLIENTE_ESQA_DERIVADO_DE_SENAL_EXISTENTE=SI
PM26_P08B_CORRECCION_DETECCION_DELETE_BLOQUEADO=SI
PM26_P08B_BUILD_DETERMINISTA=SI
PM26_P08B_REGRESION_P07B_ACTUALIZADA_SIN_REESCRIBIR=SI
PM26_P08B_DESPLIEGUE_COORDINADO_DOCUMENTADO=SI
PM26_P08B_ROLLBACK_CONSERVADOR_DOCUMENTADO=SI
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
