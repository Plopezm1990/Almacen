# PM33 — Propuesta de promoción a PROD y Netlify

**Estado: candidato validado para promoción. NO cerrado, NO aplicado.**
Nada de esto se ha ejecutado contra PROD ni contra Netlify. Esta propuesta
existe para que el propietario autorice, por separado, (a) la aplicación
en PROD y (b) la publicación en Netlify — ninguna de las dos queda
autorizada implícitamente por preparar este documento.

## 0. Evidencia de la validación aislada (base de esta propuesta)

- Rama candidata: `claude/pm33-p03-obtener-contexto-operativo`, commit
  **`d6ed496b2f9c1e14159d651e3c7ed337ea2e5a24`**.
- Ejecución real en GitHub Actions:
  [`run 35465771875`](https://github.com/Plopezm1990/Almacen/actions/runs/35465771875)
  — **SUCCESS**, sobre ese mismo commit.
- Versiones efectivas de los servicios (de los logs reales de esa
  ejecución, no de memoria): **PostgreSQL `17.6.1.167`**, **PostgREST
  `v16.2`**, **GoTrue (Auth) `v2.196.0`**, Kong (API gateway) `2.8.1`.
- Resultados: preflight de rama/main-congelada OK; **9/9** escenarios de
  frontend (sandbox `vm` real de `fuente.js`) en verde; comprobación de
  paridad `source-recovery` en verde (`SOURCE_RECOVERY_CHECK=PASS`,
  `PARIDAD_CUERPO_EXACTA=1`); **15/15** aserciones reales de Auth JWT +
  PostgREST + permisos/RLS en verde contra PostgreSQL 17 real (incluido
  el escenario de identidad duplicada pedido explícitamente por el
  propietario, y el control de rechazo por permiso HTTP 401/código 42501
  sin JWT real).
- Detalle completo, incluida la ronda anterior con el único FAIL
  (`run 35460961139`, corregido), en `HALLAZGOS_P02.md` sección 12 y
  `SEGUIMIENTO_18_PUNTOS.md` punto 1.

## 1. Commits exactos

La rama candidata tiene 7 commits por delante de `release`
(`f313bc0e036281d5c68c57fcda72da72f0dd0369`, sin tocar). Se distinguen
dos grupos:

### 1.1 Commits que cambian lo que se despliega (SQL + frontend)

| Commit | Qué cambia |
|---|---|
| `e7491d5` | P03 — primera versión del aislamiento (`fuente.js`, migración `20260919150000_...sql`) |
| `5dfdbca` | P04 — corrige bypass de identidad por local explícito y revocación de membresía eludida (`fuente.js`, migración `20260919160000_...sql`) |
| `8dbef85` | **P05 — candidato SQL vigente** (identidad antes de actividad) + control de concurrencia/caché del frontend (`fuente.js`, migración `20260919170000_pm33_p05_identidad_antes_de_actividad.sql`) |
| `51c537f` | Corrige concurrencia ENTRE SESIONES en el frontend (solo `fuente.js`, sin cambios de SQL) |

Cada migración (`150000`, `160000`, `170000`) es un `create or replace
function` completo — no hace falta aplicar las tres en PROD: **la
migración `20260919170000_pm33_p05_identidad_antes_de_actividad.sql` por
sí sola, aplicada sobre el estado real de PROD, ya define la función
final**. El script ensamblado para eso ya existe y está probado:
`docs/plan-maestro/PM33_P05_MIGRACION_DESDE_PROD.sql` (preflight + apply
en una transacción + postflight + rollback), en la propia rama candidata.

### 1.2 Commits de infraestructura de pruebas (no se despliegan a ningún sitio)

| Commit | Qué añade |
|---|---|
| `de613dc` | Entorno aislado en CI (`tests/pm33/supabase-full/`, workflow) |
| `9523131` | Activación por `push`, lockfile reproducible, pruebas de rechazo por código |
| `d6ed496` | Corrige el rechazo anónimo y sincroniza `source-recovery/fuente-recuperado.js` |

Estos tres no tocan `fuente.js` servido ni ninguna migración de
producción — son kit de validación y CI. Se recomienda fusionarlos
igualmente (quedan como evidencia y como puerta de CI reutilizable), pero
no forman parte de lo que se "publica".

## 2. Archivos SQL y frontend afectados por la promoción real

- **SQL**: `supabase/migrations/20260919170000_pm33_p05_identidad_antes_de_actividad.sql`
  (la función `public.obtener_contexto_operativo(p_local_id text default
  null)` completa, con sus `revoke`/`grant`).
- **Frontend**: `fuente.js` — el cambio neto contra `release` está
  confinado a la IIFE que instala `window.__contextoRolSeguroInstalado`
  (contador de generación, seguimiento síncrono de sesión vía
  `supabase.auth.onAuthStateChange`, invalidación de caché por cambio de
  local o de sesión). Nada fuera de esa región cambia.

## 3. Comprobaciones previas de solo lectura sobre PROD (preflight)

**No ejecutadas todavía por mí en esta ronda** (una consulta de solo
lectura contra PROD para esta propuesta quedó sin autorizar en el
momento de pedirla). Quedan especificadas aquí, listas para ejecutarse
—y volver a ejecutarse inmediatamente antes de aplicar, no solo una vez
de antemano— con autorización explícita:

```sql
-- 1) Firma y definición vigentes -- deben seguir siendo EXACTAMENTE las
--    capturadas el 19/09/2026 (hash 40d7bf2ea50776b7eb40a3fff239c0b4).
--    Si no coinciden, alguien más cambió la función desde entonces: NO
--    aplicar sin investigar qué cambió y por qué.
select p.oid::regprocedure as firma, p.pronargs,
       md5(pg_get_functiondef(p.oid)) as hash_definicion
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo'
order by p.pronargs;

-- 2) Dependencias -- nada más debe depender de esta función de forma
--    que la sustitución pueda romper.
select classid::regclass::text as clase, objid, deptype
from pg_depend
where refobjid in (
  select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo'
);

-- 3) Permisos vigentes -- confirmar el punto de partida real antes de
--    tocarlos.
select has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('public', p.oid, 'EXECUTE') as public_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo';
```

Estas tres consultas ya están incluidas, en la misma forma, en la
sección PREFLIGHT de `docs/plan-maestro/PM33_P05_MIGRACION_DESDE_PROD.sql`
(rama candidata) — este apartado solo las hace explícitas aquí para la
autorización.

## 4. Orden exacto entre migración SQL y publicación del frontend

**SQL primero, frontend después. Nunca al revés, nunca simultáneo.**

1. Preflight de PROD (sección 3) en verde.
2. Aplicar `PM33_P05_MIGRACION_DESDE_PROD.sql` (una única transacción:
   `drop function` de la sobrecarga de 0 argumentos + `create or replace`
   de la de 1 argumento con default + `revoke`/`grant`).
3. Postflight de PROD (sección 5) en verde.
4. Solo entonces, publicar `fuente.js` a Netlify.

Ver sección 6 (riesgo de incompatibilidad) para el porqué exacto de este
orden — no es una preferencia arbitraria, invertirlo rompe a los usuarios
con un local ya seleccionado en su dispositivo.

## 5. Postflight funcional

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
`public_execute = false`.

**Funcional real, NO automatizado aquí y NO delegado a un usuario de
prueba sintético en PROD**: una llamada real, hecha por el propietario o
bajo su supervisión directa, con la sesión de un empleado real ya
existente en PROD (nunca un usuario creado a propósito para la prueba,
que sería escribir en PROD sin necesidad) — confirmar que
`obtener_contexto_operativo()` devuelve el contexto esperado para ese
usuario real, con y sin `p_local_id`. Esto queda pendiente de esa
supervisión, no de más automatización.

## 6. Riesgo de incompatibilidad temporal si solo se publica una de las dos partes

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
  el orden de la sección 4 es estricto, no una preferencia.

## 7. Confirmación del comportamiento de llamadas antiguas sin `p_local_id`

Verificado, tanto en la batería SQL local (81/81 aserciones P01-P05,
casos "sin p_local_id" incluidos en cada ronda) como en el escenario 1
de la ejecución aislada real (`sinLocal`, sección 0): una llamada sin
`p_local_id` resuelve exactamente igual que antes de este parche --
mismo camino de "candidato único vía membresía, o ambiguo/no
determinable si hay más de uno" -- con la diferencia real de que ahora
la fuente heredada (`almacen_kv`) participa en esa resolución con la
misma disciplina de identidad-antes-que-actividad que el resto de la
función, en vez de con el defecto original. No hay cambio de contrato
para quien nunca manda `p_local_id`.

## 8. Rollback SQL

Ya incluido y probado en `docs/plan-maestro/PM33_P05_MIGRACION_DESDE_PROD.sql`,
sección ROLLBACK: restaura, en una única transacción, el cuerpo EXACTO
de la función de 0 argumentos capturado en PROD el 19/09/2026 (no una
reconstrucción de memoria), retira la sobrecarga de 1 argumento, y
revierte `revoke`/`grant` al estado original. Ejecutable en cualquier
momento tras la promoción, sin depender de que el frontend ya se haya
revertido primero (una función de 0 argumentos sigue resolviendo
correctamente las llamadas del frontend viejo; las llamadas del
frontend nuevo con `p_local_id`, si el rollback SQL ocurre ANTES que el
de Netlify, fallarían por el mismo motivo de la sección 6 -- por eso,
si hace falta revertir, revertir primero Netlify y after el SQL,
exactamente al revés que para aplicar).

## 9. Rollback de Netlify

Netlify conserva el historial de despliegues anteriores del sitio
(`chic-entremet-9107cf`); volver al desplegado inmediatamente anterior
es una operación de "publicar de nuevo" ese deploy ya construido, sin
generar uno nuevo -- revierte el `fuente.js` servido de inmediato. El
identificador exacto del deploy al que volver debe confirmarse leyendo
la lista de deploys de Netlify justo antes de publicar (consulta de
solo lectura), no asumirse de antemano en este documento -- no se ha
consultado esa lista en esta ronda.

## 10. Qué NO decide ni autoriza este documento

- No aplica la migración SQL a PROD.
- No publica nada en Netlify.
- No mueve `release`, `main` ni toca PR #38.
- No decide si el modelo relacional de QA es el diseño futuro de esta
  función (fuera del alcance de PM33, ver `HALLAZGOS_P02.md` 9.5).
- No cierra PM33: PM33 pasa a **"validado para promoción"**, un estado
  nuevo y distinto de "cerrado" -- cierre real requiere que el
  propietario autorice, específicamente, (a) aplicar en PROD y (b)
  publicar en Netlify, y que el postflight de ambas quede en verde.
