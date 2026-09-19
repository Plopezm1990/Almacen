# PM33 — Propuesta de promoción a PROD y Netlify

**Estado: candidato final limpio, validado para promoción. NO cerrado, NO
aplicado. PROMOCIÓN DETENIDA** — el propietario comprobó la matriz real
de migraciones repo↔PROD y el mecanismo de aplicación descrito en una
versión anterior de este documento no es seguro (sección 4). Nada de
esto se ha ejecutado contra PROD ni contra Netlify. Esta propuesta existe
para que el propietario autorice, por separado, (A) la aplicación en
PROD y (B) mover `release` (dispara Netlify automáticamente) — ninguna de
las dos queda autorizada implícitamente por preparar este documento.

## 0. Evidencia (candidato final limpio, no la rama de iteración)

**Rama final: `claude/pm33-promocion-final`, SHA `21ce7fad37dec815fc4568945872fc72a9bf3cd7`.**
Creada desde `release` vigente (`f313bc0e036281d5c68c57fcda72da72f0dd0369`,
el mismo commit que Netlify confirma en producción) — **no** desde
`claude/pm33-p03-obtener-contexto-operativo`, que contiene en su historia
las migraciones intermedias P03/P04 (defectos ya corregidos en rondas
posteriores) y por eso no debía promocionarse directamente. Un solo
commit de contenido más un commit de endurecimiento del gate, ambos
encima de `release`; `git merge-base --is-ancestor origin/release HEAD`
confirma que `release` es su ancestro directo.

- Ejecución real en GitHub Actions sobre el SHA final:
  [`run 35473168918`](https://github.com/Plopezm1990/Almacen/actions/runs/35473168918)
  — **SUCCESS**. (Ejecución previa sobre el commit de contenido, antes de
  añadir el gate de migración:
  [`run 35472854860`](https://github.com/Plopezm1990/Almacen/actions/runs/35472854860)
  — también SUCCESS.)
- **Gate automático de migración única** (nuevo paso del workflow,
  verificado en verde en `run 35473168918` y en rojo localmente contra
  una copia temporal de la migración P03 real, retirada antes de
  commitear): falla salvo que `supabase/migrations/` contenga
  EXACTAMENTE un archivo `*pm33*`, que sea
  `20260919170000_pm33_p05_identidad_antes_de_actividad.sql`, y confirma
  además, de forma independiente, la ausencia de cualquier archivo con
  prefijo `20260919150000` (P03) o `20260919160000` (P04). Ignora
  deliberadamente `tests/pm33/supabase-full/supabase/migrations/`, que
  son las migraciones internas del entorno de pruebas desechable de este
  mismo workflow, nunca migraciones desplegables. **Este gate valida el
  CONTENIDO del repositorio (una sola migración PM33, la correcta); no
  dice nada sobre si ese contenido se puede aplicar tal cual a PROD por
  `db push` — eso es precisamente lo que la sección 4 desmiente.**
- Versiones efectivas de los servicios (de los logs reales de la
  ejecución, no de memoria): **PostgreSQL `17.6.1.167`**, **PostgREST
  `v16.2`**, **GoTrue (Auth) `v2.196.0`**, Kong (API gateway) `2.8.1`.
- Resultados: preflight de rama/`release`-ancestro OK; gate de migración
  única OK; **9/9** escenarios de frontend (sandbox `vm` real de
  `fuente.js`) en verde; paridad `source-recovery` en verde
  (`SOURCE_RECOVERY_CHECK=PASS`, `PARIDAD_CUERPO_EXACTA=1`, mismo SHA256
  que la validación original); **15/15** aserciones reales de Auth JWT +
  PostgREST + permisos/RLS contra PostgreSQL 17 real.
- `fuente.js` y la migración son, verificado con `diff`, **idénticos byte
  a byte** al contenido ya validado en
  `claude/pm33-p03-obtener-contexto-operativo` commit `d6ed496`
  ([`run 35465771875`](https://github.com/Plopezm1990/Almacen/actions/runs/35465771875),
  también SUCCESS) — la promoción a rama limpia no cambió ni una línea
  de lo ya probado, solo su procedencia. **Nada de esta sección queda
  invalidado por el hallazgo de la sección 4: el SQL y el frontend siguen
  correctos; lo que cambia es CÓMO se aplican.**
- Detalle completo en `HALLAZGOS_P02.md` secciones 13-17 y
  `SEGUIMIENTO_18_PUNTOS.md` punto 1.

## 1. Commits exactos de la rama final

| Commit | Qué contiene |
|---|---|
| `70ccfd5` | Contenido: `fuente.js`, `source-recovery/fuente-recuperado.js`, la única migración P05, `tests/pm33/`, docs P05, el workflow reapuntado a esta rama |
| `21ce7fa` | Gate automático de migración única |

Ambos por contenido exacto tomado de `claude/pm33-p03-obtener-contexto-operativo`
commit `d6ed496` (ya validado, ver sección 0), nunca replicando su
historia de commits. Ese commit `d6ed496`, a su vez, es el resultado
acumulado de `e7491d5` (P03), `5dfdbca` (P04) y `8dbef85` (P05) — pero
**ninguno de esos tres commits, ni sus migraciones intermedias, existen
en esta rama final**, ni en el árbol de archivos ni en la historia de
commits. Tras aplicar por el mecanismo de la sección 5, habrá un commit
adicional que renombra el archivo de la migración P05 a la versión real
que Supabase le asigne — ver esa sección.

## 2. Archivos SQL y frontend afectados por la promoción real

- **SQL**: `supabase/migrations/20260919170000_pm33_p05_identidad_antes_de_actividad.sql`
  (la función `public.obtener_contexto_operativo(p_local_id text default
  null)` completa, con sus `revoke`/`grant`) — la única migración
  desplegable en esta rama, confirmado por el gate automático de la
  sección 0. Su prefijo `20260919170000` es un nombre de archivo local;
  ver sección 4 sobre por qué NO se puede asumir que coincide con nada en
  PROD.
- **Frontend**: `fuente.js` — el cambio neto contra `release` está
  confinado a la IIFE que instala `window.__contextoRolSeguroInstalado`
  (contador de generación, seguimiento síncrono de sesión vía
  `supabase.auth.onAuthStateChange`, invalidación de caché por cambio de
  local o de sesión). Nada fuera de esa región cambia.

## 3. Comprobaciones previas de solo lectura sobre PROD (preflight)

**Confirmado por el propietario, mediante consultas de solo lectura
propias sobre PROD**:

- Existe únicamente `obtener_contexto_operativo()` de **0 argumentos**
  (ninguna sobrecarga adicional).
- Hash vigente de la definición: **`40d7bf2ea50776b7eb40a3fff239c0b4`** —
  coincide exactamente con el capturado el 19/09/2026 y usado como
  referencia en el candidato.
- `SECURITY DEFINER`, `search_path=public`.
- No aparecen dependencias externas (nada más depende de esta función de
  forma que la sustitución pueda romper).
- `EXECUTE` concedido únicamente a `authenticated` y `postgres` — nunca a
  `anon` ni `PUBLIC`.
- Ninguna migración PM33 figura en el historial de PROD (esto sigue
  siendo cierto — ver sección 4: el hallazgo no es que exista una
  migración PM33 ya aplicada, es que NINGUNA de las 34 versiones locales,
  PM33 incluida por su prefijo, coincide con ninguna de las 36 versiones
  reales de PROD).
- Solo existe un perfil activo, Propietario, con un único contexto
  candidato.

Estas consultas, en la misma forma, siguen incluidas en la sección
PREFLIGHT de `docs/plan-maestro/PM33_P05_MIGRACION_DESDE_PROD.sql` (rama
final) — deben repetirse inmediatamente antes de aplicar, no basta con
haberlas confirmado una vez de antemano si pasa tiempo entre esta
confirmación y la aplicación real (ver sección 6 sobre ese intervalo).

## 4. Hallazgo crítico: la matriz real de migraciones invalida el mecanismo `db push`

**Comprobado por el propietario y verificado de forma independiente
contando los archivos reales de la rama final y las 36 filas reales de
`list_migrations`:**

- `supabase/migrations/` en `claude/pm33-promocion-final` contiene
  **34 versiones** (prefijos de 14 dígitos).
- PROD registra **36 versiones** en `supabase_migrations.schema_migrations`.
- **Intersección entre ambas listas: 0.** Ninguna de las 34 versiones
  locales coincide con ninguna de las 36 versiones remotas — ni siquiera
  las que, por su nombre y fecha, deberían corresponder al mismo cambio
  histórico (p. ej. las migraciones de PM27/PM29 que sí están en ambos
  lados por CONTENIDO, no aparecen con la MISMA versión).

**Consecuencia, retractada explícitamente de una versión anterior de
este documento**: aquí se afirmó que `supabase db push --dry-run`
"reconocería exactamente" la migración P05 como la única pendiente,
apoyándose en que `list_migrations` no mostraba ninguna versión
`20260919*`. **Esa inferencia era incorrecta y se retira.**
`list_migrations` (vía MCP) solo lee la tabla remota de historial; **no
es equivalente a `db push --dry-run`**, que compara la lista LOCAL de
archivos contra esa tabla. Con intersección 0, lo que un `db push`
(dry-run o real) vería no es "P05 pendiente, el resto ya aplicado": vería
las **34 versiones locales como pendientes**, P05 incluida, porque
ninguna de las otras 33 coincide con ningún registro remoto tampoco. No
hay evidencia de que aplicar esas 34 sea seguro — la mayoría corresponde
a cambios que casi con toda seguridad ya existen en PROD por otra vía
(aplicados alguna vez sin pasar por `db push`, con timestamps distintos),
así que reintentarlos arriesga errores de "ya existe" en el mejor caso, o
un estado inconsistente en el peor. Esto es la misma discrepancia de
trazabilidad ya registrada en el Punto 5 del documento maestro de cierre
(36 en PROD, 63 en QA, comparadas contra `supabase/migrations/` de
`release`), ahora cuantificada con exactitud para esta rama: 34 vs. 36,
0 en común.

**Por tanto, quedan expresamente descartados para esta operación:**

- `supabase db push` (sin flags) — intentaría aplicar las 34 migraciones
  locales, no solo P05.
- `supabase db push --include-all` — fuerza exactamente ese
  comportamiento amplio; más peligroso aún, no menos.
- Cualquier reparación masiva del historial (`supabase migration repair`
  aplicado a más de una versión, o usado para intentar "poner al día" la
  tabla completa) — fuera de alcance de esta promoción y con riesgo real
  de corromper el historial de las otras 33 migraciones, que no se han
  auditado en esta ronda.

## 5. Mecanismo definido para la autorización A

Sustituye por completo al mecanismo `db push` de una versión anterior de
este documento. Aplica **únicamente** el contenido de la migración P05,
sin tocar `db push` ni el resto del historial:

1. **Repetir el preflight** (sección 3) inmediatamente antes de aplicar.
2. **Aplicar únicamente el contenido exacto de la migración P05** vía la
   herramienta `supabase_apply_migration` (MCP), con:
   - `name`: `pm33_p05_identidad_antes_de_actividad`
   - `query`: el contenido literal, completo, de
     `supabase/migrations/20260919170000_pm33_p05_identidad_antes_de_actividad.sql`
     (sin modificar ni una línea).
   Esto NO lee ni compara `supabase/migrations/` localmente — aplica
   exactamente ese SQL, y solo ese, sin tocar las otras 33 versiones.
3. **Ejecutar inmediatamente el postflight** (sección 8): firma de 1
   argumento con default, grants (`authenticated`=true, `anon`=false,
   `public`=false).
4. **Consultar `list_migrations` y capturar la versión generada
   realmente por Supabase** para esta migración (la Management API la
   genera a partir del momento de la llamada — no será
   `20260919170000`; hay que leer el valor real, no asumirlo).
5. **Renombrar, en la rama de promoción, el archivo de la migración P05**
   para que su prefijo coincida EXACTAMENTE con esa versión remota real
   capturada en el paso 4 — p. ej. si Supabase generó `20260920140512`,
   el archivo pasa a llamarse
   `supabase/migrations/20260920140512_pm33_p05_identidad_antes_de_actividad.sql`.
   Esto reconcilia el repositorio con la realidad de PROD para esta
   migración concreta (no para las otras 33, que quedan fuera de alcance
   de esta promoción y siguen siendo la deuda ya registrada en el Punto
   5 del cierre general).
6. **Actualizar el gate de migración única** (`.github/workflows/pm33-p05-entorno-aislado.yml`)
   y la documentación (este documento, `HALLAZGOS_P02.md`,
   `SEGUIMIENTO_18_PUNTOS.md`) para referenciar el nuevo nombre de
   archivo/versión, no `20260919170000`.
7. **Ejecutar nuevamente el gate sobre el nuevo SHA** (push a
   `claude/pm33-promocion-final` con el archivo renombrado y el workflow
   actualizado) y esperar su resultado.
8. **Mover `release` únicamente después de ese nuevo SUCCESS** — nunca
   sobre el SHA `21ce7fad37dec815fc4568945872fc72a9bf3cd7` actual, que
   todavía referencia el nombre de archivo antiguo.

**Por qué este mecanismo es seguro pese al hallazgo de la sección 4**:
`apply_migration` no lee ni compara `supabase/migrations/` — aplica
exactamente el SQL que se le pasa, una sola vez, sin tocar ninguna de las
otras 33 versiones ni intentar reconciliar el historial completo. El
único efecto secundario es que la versión que PROD registra no es
predecible de antemano; por eso el mecanismo la CAPTURA después de
aplicar y ajusta el repositorio a esa realidad, en vez de asumir un
nombre de antemano (que es exactamente el error de la versión anterior
de este documento).

## 6. Intervalo entre la aplicación (A) y el nuevo gate

El preflight de la sección 3 se confirmó con datos reales, recientes, del
propio propietario. Ese intervalo entre confirmar el preflight y aplicar
(pasos 1-2 de la sección 5) es compatible con esos datos **mientras se
mantenga corto** — minutos u horas, no días: cuanto más tiempo pase,
mayor la probabilidad de que algo en PROD cambie por otra vía (otro
proceso, otra sesión) sin que este preflight lo capture. Lo mismo aplica
al intervalo entre aplicar (paso 2) y tener el nuevo gate en verde (pasos
4-7): mientras sea corto, el postflight del paso 3 y el gate del paso 7
siguen siendo representativos del mismo estado que el preflight
verificó. Si por cualquier motivo ese intervalo se alarga
significativamente en cualquiera de los dos tramos, **repetir el
preflight de la sección 3 antes de continuar**, no asumir que sigue
vigente.

## 7. Orden exacto entre migración SQL y publicación del frontend

**SQL primero, frontend después. Nunca al revés, nunca simultáneo.**

1. Preflight de PROD (sección 3) reconfirmado en el momento.
2. Aplicar por el mecanismo de la sección 5 (pasos 1-7).
3. Postflight de PROD (sección 8) en verde, y el nuevo gate (sección 5,
   paso 7) en verde.
4. Solo entonces, mover `release` (sección 11) — dispara Netlify
   automáticamente.

Ver sección 9 (riesgo de incompatibilidad) para el porqué exacto de este
orden — no es una preferencia arbitraria, invertirlo rompe a los usuarios
con un local ya seleccionado en su dispositivo.

## 8. Postflight funcional

Automático (solo lectura):

```sql
select p.oid::regprocedure as firma, p.pronargs,
       pg_get_function_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo';

select has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('public', p.oid, 'EXECUTE') as public_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo';
```

Confirma: exactamente una sobrecarga (1 argumento, `p_local_id text
DEFAULT NULL`), `authenticated_execute = true`, `anon_execute = false`,
`public_execute = false`. Más `list_migrations` mostrando la fila nueva
(sección 5, paso 4) con el `name` esperado.

**Funcional real, NO automatizado aquí y NO delegado a un usuario de
prueba sintético en PROD**: una llamada real, hecha por el propietario o
bajo su supervisión directa, con la sesión de un empleado real ya
existente en PROD (nunca un usuario creado a propósito para la prueba,
que sería escribir en PROD sin necesidad) — confirmar que
`obtener_contexto_operativo()` devuelve el contexto esperado para ese
usuario real, con y sin `p_local_id`. Esto queda pendiente de esa
supervisión, no de más automatización.

## 9. Riesgo de incompatibilidad temporal si solo se publica una de las dos partes

- **SQL aplicado, frontend TODAVÍA sin publicar (estado intermedio,
  seguro)**: el frontend hoy en Netlify (el de `release`, sin este
  parche) **nunca envía `p_local_id`** -- esa es precisamente la
  novedad que introduce este parche. La nueva función acepta una
  llamada sin argumentos gracias a `p_local_id text DEFAULT NULL`, y
  para ese caso sigue exactamente el mismo camino de resolución por
  ambigüedad de membresías que la función anterior. Es decir: aplicar
  solo el SQL no rompe nada del frontend actual -- de hecho ya mejora a
  todos los usuarios existentes, porque sustituye el defecto R10 (sin
  acotar por empresa/local, activo hoy en PROD) por una resolución
  correcta, incluso antes de publicar el frontend nuevo.
- **Frontend publicado, SQL TODAVÍA sin aplicar (nunca debe ocurrir)**:
  el frontend nuevo llama a la RPC **con `p_local_id`** en cuanto el
  dispositivo ya tiene un local activo conocido (el caso normal, no el
  raro). La función hoy vigente en PROD solo tiene la sobrecarga de 0
  argumentos -- PostgREST no podría resolver una llamada con un
  argumento que esa firma no acepta, y esos usuarios (la mayoría, con
  local ya seleccionado) se quedarían sin contexto operativo. Por eso
  el orden de la sección 7 es estricto, no una preferencia.

## 10. Confirmación del comportamiento de llamadas antiguas sin `p_local_id`

Verificado, tanto en la batería SQL local (81/81 aserciones P01-P05,
casos "sin p_local_id" incluidos en cada ronda) como en la validación
aislada real (escenario `sinLocal`, sección 0): una llamada sin
`p_local_id` resuelve exactamente igual que antes de este parche --
mismo camino de "candidato único vía membresía, o ambiguo/no
determinable si hay más de uno" -- con la diferencia real de que ahora
la fuente heredada (`almacen_kv`) participa en esa resolución con la
misma disciplina de identidad-antes-que-actividad que el resto de la
función, en vez de con el defecto original. No hay cambio de contrato
para quien nunca manda `p_local_id`.

## 11. Rollback — orden corregido

**Corrección explícita sobre una versión anterior de este documento**:
proponía `supabase migration repair --status reverted` como paso de
rollback. Se retira como mecanismo de rollback operativo normal — dado
el propio hallazgo de la sección 4 (el historial de migraciones ya tiene
discrepancias no auditadas), usar `migration repair` para "desmarcar"
entradas añade una operación más sobre una tabla que ya se sabe
inconsistente, sin necesidad real: el rollback correcto no borra ni
reescribe historial, añade un paso más, hacia delante, igual que
cualquier otra migración.

**Orden correcto, si hace falta revertir:**

1. **Primero, restaurar en Netlify el deploy `6aad473513310100099a03a9`**
   (sección 12) — el frontend vuelve a la versión que nunca envía
   `p_local_id`, compatible con cualquier estado de la función SQL.
   Nunca al revés: revertir el SQL primero, con el frontend nuevo
   todavía publicado, rompe a los usuarios con local conocido (mismo
   motivo que la sección 9).
2. **Después, aplicar una NUEVA migración de rollback**, registrada por
   el mismo mecanismo de la sección 5 (`apply_migration`, con su propio
   `name` — p. ej. `pm33_rollback_restaurar_funcion_0_argumentos` — y
   como `query` el bloque ROLLBACK ya redactado y probado en
   `docs/plan-maestro/PM33_P05_MIGRACION_DESDE_PROD.sql`: restaura el
   cuerpo EXACTO de la función de 0 argumentos capturado en PROD el
   19/09/2026, retira la sobrecarga de 1 argumento, revierte
   `revoke`/`grant`). Captura igualmente su versión real vía
   `list_migrations`.
3. **Conservar en el historial tanto la aplicación (P05) como el
   rollback** — dos entradas separadas, visibles, nunca se borra ni se
   reescribe la de P05. El historial de `schema_migrations` queda como
   registro auditable de que P05 se aplicó y, después, se revirtió, con
   sus dos versiones y timestamps reales.

## 12. Rollback de Netlify (primer paso del rollback, sección 11)

Deploy de recuperación confirmado: **`6aad473513310100099a03a9`**
(producción, rama `release`, `manual_deploy=false`). Netlify conserva el
historial de despliegues anteriores del sitio (`chic-entremet-9107cf`);
volver a ese deploy es una operación de "publicar de nuevo" el ya
construido, sin generar uno nuevo — revierte el `fuente.js` servido de
inmediato.

**Aviso operativo confirmado por el propietario**: el deploy actual de
producción tiene `manual_deploy=false` — Netlify publica automáticamente
en cuanto `release` recibe un push. Esto significa que **mover `release`
es, en la práctica, el propio acto de publicar en Netlify** para este
sitio, no un paso previo independiente. La autorización (B) de este
documento y la de mover `release` son, por tanto, la misma autorización
operativa — pedidas por separado en la sección 13 solo porque son
decisiones distintas del propietario, no porque exista un paso manual
adicional entre una y otra.

## 13. Alternativa solo documental: CLI con `migration fetch` (sigue bloqueada)

Una vía que sí reconciliaría el repositorio completo con PROD (no solo la
migración P05) existe en el CLI, pero requiere credenciales que este
entorno no tiene — se documenta solo para que quede especificada, no
como algo pendiente de ejecutar aquí:

1. Crear un directorio de trabajo temporal y aislado (`supabase init` en
   una carpeta vacía, sin relación con este repositorio).
2. `supabase migration fetch --linked` (o `--project-ref` +
   `--password`): reconstruye, a partir de la tabla real de historial de
   PROD, un conjunto de archivos de migración local cuyos nombres
   coinciden EXACTAMENTE con las 36 versiones reales — reconciliación
   completa, no solo de una migración.
3. Añadir a ese conjunto, ya reconciliado, únicamente el archivo de la
   migración P05 (contenido de
   `supabase/migrations/20260919170000_pm33_p05_identidad_antes_de_actividad.sql`,
   con cualquier nombre de archivo — el `fetch` ya garantiza que no
   colisiona con ninguna versión real).
4. Confirmar con `supabase db push --dry-run --linked` que, sobre esa
   base ya reconciliada, P05 es la ÚNICA migración pendiente —
   ahora sí de forma demostrada, no asumida.
5. Solo entonces `db push --linked` aplicaría exactamente P05, con la
   garantía adicional de que el resto del historial también quedó
   verificado en el mismo paso.

**Sigue bloqueada en este entorno**: sin `SUPABASE_ACCESS_TOKEN` ni la
contraseña de conexión a PROD (variables de entorno revisadas, ninguna
presente), ni `migration fetch` ni `db push --dry-run` pueden ejecutarse
aquí de verdad. El mecanismo de la sección 5 (`apply_migration` +
captura de versión + renombrado) es el que queda disponible para la
autorización A con las herramientas realmente accesibles en esta sesión.

## 14. Qué NO decide ni autoriza este documento

- No aplica la migración SQL a PROD.
- No publica nada en Netlify, ni mueve `release` (que la dispararía
  automáticamente — ver sección 12).
- No mueve `main` ni toca PR #38.
- No modifica el historial remoto de migraciones de PROD.
- No decide si el modelo relacional de QA es el diseño futuro de esta
  función (fuera del alcance de PM33, ver `HALLAZGOS_P02.md` 9.5).
- No decide ni resuelve la discrepancia general de 34 vs. 36 migraciones
  más allá de la única migración P05 — esa deuda más amplia (Punto 5
  del documento maestro de cierre) queda fuera del alcance de esta
  promoción.
- No cierra PM33: PM33 pasa a **"validado para promoción, mecanismo de
  aplicación corregido, pendiente de ejecución"** -- cierre real requiere
  que el propietario autorice, específicamente, (A) aplicar en PROD por
  el mecanismo de la sección 5 y (B) mover `release`, y que el postflight
  y el nuevo gate de ambas queden en verde.

**Dos autorizaciones separadas pendientes, presentadas en este orden
porque (A) es condición previa de (B) — ver sección 7**:

- **A) Autorización para aplicar la migración** por el mecanismo de la
  sección 5 (sobre `flqercbgpgmmfaakrwkc`).
- **B) Autorización para mover `release`** (dispara Netlify
  automáticamente — ver sección 12), solo después de que (A) esté
  aplicada, su postflight (sección 8) esté en verde, y el nuevo gate
  (sección 5, paso 7) esté en verde sobre el SHA con el archivo ya
  renombrado.
