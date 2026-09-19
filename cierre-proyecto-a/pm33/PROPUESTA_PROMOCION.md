# PM33 — Propuesta de promoción a PROD y Netlify

**Estado: candidato final limpio, validado para promoción. NO cerrado, NO
aplicado.** Nada de esto se ha ejecutado contra PROD ni contra Netlify.
Esta propuesta existe para que el propietario autorice, por separado, (a)
la aplicación en PROD y (b) la publicación en Netlify — ninguna de las
dos queda autorizada implícitamente por preparar este documento.

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
  mismo workflow, nunca migraciones desplegables.
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
  de lo ya probado, solo su procedencia.
- Detalle completo en `HALLAZGOS_P02.md` secciones 13-15 y
  `SEGUIMIENTO_18_PUNTOS.md` punto 1.

## 1. Commits exactos de la rama final

| Commit | Qué contiene |
|---|---|
| `70ccfd5` | Contenido: `fuente.js`, `source-recovery/fuente-recuperado.js`, la única migración P05, `tests/pm33/`, docs P05, el workflow reapuntado a esta rama |
| `21ce7fa` | Gate automático de migración única (esta ronda) |

Ambos por contenido exacto tomado de `claude/pm33-p03-obtener-contexto-operativo`
commit `d6ed496` (ya validado, ver sección 0), nunca replicando su
historia de commits. Ese commit `d6ed496`, a su vez, es el resultado
acumulado de `e7491d5` (P03), `5dfdbca` (P04) y `8dbef85` (P05) — pero
**ninguno de esos tres commits, ni sus migraciones intermedias, existen
en esta rama final**, ni en el árbol de archivos ni en la historia de
commits.

## 2. Archivos SQL y frontend afectados por la promoción real

- **SQL**: `supabase/migrations/20260919170000_pm33_p05_identidad_antes_de_actividad.sql`
  (la función `public.obtener_contexto_operativo(p_local_id text default
  null)` completa, con sus `revoke`/`grant`) — la única migración
  desplegable en esta rama, confirmado por el gate automático de la
  sección 0.
- **Frontend**: `fuente.js` — el cambio neto contra `release` está
  confinado a la IIFE que instala `window.__contextoRolSeguroInstalado`
  (contador de generación, seguimiento síncrono de sesión vía
  `supabase.auth.onAuthStateChange`, invalidación de caché por cambio de
  local o de sesión). Nada fuera de esa región cambia.

## 3. Comprobaciones previas de solo lectura sobre PROD (preflight)

**Confirmado por el propietario, mediante consultas de solo lectura
propias sobre PROD** (no ejecutadas por mí — la consulta equivalente que
intenté en una ronda anterior quedó sin autorizar):

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
- Ninguna migración PM33 figura en el historial de PROD — confirmado de
  forma independiente por mí vía `list_migrations` (lectura autorizada
  explícitamente en esta ronda, ver sección 4): 36 migraciones
  registradas en `supabase_migrations.schema_migrations`, ninguna con
  prefijo `2026091[5-9]` salvo las ya conocidas de PM27/PM29 (nada con
  `20260919`).
- Solo existe un perfil activo, Propietario, con un único contexto
  candidato.

Estas consultas, en la misma forma, siguen incluidas en la sección
PREFLIGHT de `docs/plan-maestro/PM33_P05_MIGRACION_DESDE_PROD.sql` (rama
final) — deben repetirse inmediatamente antes de aplicar, no basta con
haberlas confirmado una vez de antemano si pasa tiempo entre esta
confirmación y la aplicación real.

## 4. Mecanismo exacto de aplicación y registro de versión

**Mecanismo: Supabase CLI (`supabase db push`), enlazado o con
`--db-url`/`--project-ref`+contraseña contra PROD — no la herramienta MCP
`apply_migration`.**

Comprobado vía `supabase --help` y `supabase db push --help` (CLI
`2.117.0`, la misma versión ya validada en el entorno aislado de CI):

- `supabase db push` lee los archivos de `supabase/migrations/` del
  directorio de trabajo y los compara contra
  `supabase_migrations.schema_migrations` del proyecto remoto. Al
  aplicar un archivo, registra en esa tabla `version` = el prefijo
  numérico exacto del nombre del archivo (`20260919170000`) y `name` =
  el resto del nombre (`pm33_p05_identidad_antes_de_actividad`) — la
  reconciliación con el archivo del repositorio es automática, por
  construcción, sin ningún paso manual.
- `supabase db push --dry-run` existe: *"Print the migrations that would
  be applied, but don't actually apply them"* — un dry-run real,
  enlazado, de solo lectura (no depende de Docker: `db push` es una
  operación de red pura, a diferencia de `db start`/`db diff`).
  Combinado con `--linked` (tras `supabase link --project-ref
  flqercbgpgmmfaakrwkc`) o directamente con `--project-ref` +
  `--password`, reconocería exactamente
  `20260919170000_pm33_p05_identidad_antes_de_actividad.sql` como la
  migración pendiente.
- `supabase migration list --linked` lista migraciones locales y
  remotas lado a lado — otra comprobación de solo lectura equivalente.
- `supabase migration repair [<version>] --status applied|reverted` es
  el mecanismo **sancionado por el propio CLI** para corregir la tabla
  de historial cuando hiciera falta — la vía correcta si alguna vez hay
  que ajustar un registro, nunca `UPDATE`/`INSERT`/`DELETE` manual sobre
  `supabase_migrations.schema_migrations`.

**Por qué no `apply_migration` (MCP) para esta operación**: esa
herramienta acepta `name` y `query`, pero **no un `version` explícito** —
la Management API que envuelve genera la versión a partir del momento de
la llamada, no del nombre del archivo del repositorio. Usarla aquí
registraría una versión distinta de `20260919170000`, desincronizando
silenciosamente la tabla de historial del archivo real que la produjo —
exactamente el riesgo de reconciliación que se pidió evitar.

**Dry-run real, no ejecutado en esta ronda**: este sandbox de desarrollo
no tiene credenciales de conexión a PROD para el CLI (ni
`SUPABASE_ACCESS_TOKEN`, ni la contraseña de la base) — confirmado
(variables de entorno revisadas, ninguna presente). En su lugar, ejecuté
la comprobación de solo lectura equivalente que sí tengo autorizada y
disponible: `list_migrations` vía MCP contra PROD (sección 3) — confirma
el mismo hecho que mostraría el dry-run (ninguna versión `20260919*`
registrada, por tanto la migración se aplicaría como nueva, sin
conflicto). El dry-run literal con el CLI queda como el último paso de
solo lectura, ejecutable desde un entorno con esas credenciales
(la máquina del propietario, o un job de CI con secretos configurados),
inmediatamente antes de aplicar:

```
git checkout claude/pm33-promocion-final   # SHA 21ce7fad37dec815fc4568945872fc72a9bf3cd7
supabase link --project-ref flqercbgpgmmfaakrwkc
supabase db push --dry-run --linked
# Revisar la salida: debe listar EXACTAMENTE
# 20260919170000_pm33_p05_identidad_antes_de_actividad.sql
# como única migración pendiente. Cualquier otra cosa en la salida (otra
# migración pendiente, un error de firma) -- NO aplicar, investigar antes.
```

## 5. Operación exacta de aplicación

```
supabase db push --linked
```

(solo tras revisar en verde el `--dry-run` de la sección 4). Aplica
`20260919170000_pm33_p05_identidad_antes_de_actividad.sql` completo:
`drop function` de la sobrecarga de 0 argumentos, `create or replace` de
la de 1 argumento con default, `revoke`/`grant`.

**Resultado esperado en `list_migrations`** (o `supabase migration list
--linked`) tras aplicar: 37 filas (36 actuales + 1), con la nueva fila
`version = '20260919170000'`, `name =
'pm33_p05_identidad_antes_de_actividad'`, al final de la lista. Ninguna
de las 36 filas existentes se modifica.

## 6. Orden exacto entre migración SQL y publicación del frontend

**SQL primero, frontend después. Nunca al revés, nunca simultáneo.**

1. Preflight de PROD (sección 3) reconfirmado en el momento.
2. Dry-run de la sección 4 en verde.
3. Aplicar (sección 5).
4. Postflight de PROD (sección 7) en verde.
5. Solo entonces, publicar `fuente.js` a Netlify.

Ver sección 8 (riesgo de incompatibilidad) para el porqué exacto de este
orden — no es una preferencia arbitraria, invertirlo rompe a los usuarios
con un local ya seleccionado en su dispositivo.

## 7. Postflight funcional

Automático (solo lectura, ya en el script):

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
`public_execute = false`. Más `list_migrations`/`migration list` mostrando
la fila nueva descrita en la sección 5.

**Funcional real, NO automatizado aquí y NO delegado a un usuario de
prueba sintético en PROD**: una llamada real, hecha por el propietario o
bajo su supervisión directa, con la sesión de un empleado real ya
existente en PROD (nunca un usuario creado a propósito para la prueba,
que sería escribir en PROD sin necesidad) — confirmar que
`obtener_contexto_operativo()` devuelve el contexto esperado para ese
usuario real, con y sin `p_local_id`. Esto queda pendiente de esa
supervisión, no de más automatización.

## 8. Riesgo de incompatibilidad temporal si solo se publica una de las dos partes

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
  el orden de la sección 6 es estricto, no una preferencia.

## 9. Confirmación del comportamiento de llamadas antiguas sin `p_local_id`

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

## 10. Rollback SQL

Bloque ROLLBACK ya incluido y probado en
`docs/plan-maestro/PM33_P05_MIGRACION_DESDE_PROD.sql`: restaura, en una
única transacción, el cuerpo EXACTO de la función de 0 argumentos
capturado en PROD el 19/09/2026 (no una reconstrucción de memoria),
retira la sobrecarga de 1 argumento, y revierte `revoke`/`grant` al
estado original.

**Paso adicional, obligatorio, no incluido en el bloque SQL**: el
rollback del contenido de la función no retira por sí solo la fila
`version = 20260919170000` de `supabase_migrations.schema_migrations`.
Sin este paso, un futuro `db push` creería que esa migración ya está
aplicada y nunca la reintentaría, dejando el repositorio y la base
desincronizados en silencio. El paso correcto, con el mecanismo
sancionado (nunca SQL manual sobre esa tabla):

```
supabase migration repair 20260919170000 --status reverted --linked
```

Ejecutable en cualquier momento tras la promoción, sin depender de que el
frontend ya se haya revertido primero (una función de 0 argumentos sigue
resolviendo correctamente las llamadas del frontend viejo). Si el
frontend nuevo (con `p_local_id`) sigue publicado cuando se hace este
rollback, esas llamadas fallarían por el mismo motivo de la sección 8 —
por eso, si hace falta revertir, se revierte primero Netlify y **después**
el SQL, exactamente al revés que para aplicar.

## 11. Rollback de Netlify

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
sitio, no un paso previo independiente. La autorización (b) de este
documento (publicar en Netlify) y la de mover `release` son, por tanto,
la misma autorización operativa — pedidas por separado en la sección 12
solo porque son decisiones distintas del propietario, no porque exista
un paso manual adicional entre una y otra.

## 12. Qué NO decide ni autoriza este documento

- No aplica la migración SQL a PROD.
- No publica nada en Netlify, ni mueve `release` (que la dispararía
  automáticamente — ver sección 11).
- No mueve `main` ni toca PR #38.
- No decide si el modelo relacional de QA es el diseño futuro de esta
  función (fuera del alcance de PM33, ver `HALLAZGOS_P02.md` 9.5).
- No cierra PM33: PM33 pasa a **"validado para promoción"**, un estado
  nuevo y distinto de "cerrado" -- cierre real requiere que el
  propietario autorice, específicamente, (a) aplicar en PROD y (b) mover
  `release`/publicar en Netlify, y que el postflight de ambas quede en
  verde.

**Dos autorizaciones separadas pendientes, presentadas en este orden
porque (a) es condición previa de (b) — ver sección 6**:

- **A) Autorización para aplicar la migración** (sección 5, sobre
  `flqercbgpgmmfaakrwkc`).
- **B) Autorización para mover `release`** (dispara Netlify
  automáticamente — ver sección 11), solo después de que (A) esté
  aplicada y su postflight (sección 7) esté en verde.
