# PM33 P05 — Entorno aislado equivalente al modelo actual de PROD

Decisión ya tomada por el propietario (no se toma aquí): preparar un
entorno aislado que valide el candidato PM33 (P05, `almacen_kv`) con
PostgreSQL 17 real, Auth real y PostgREST real, **equivalente al modelo
vigente de PROD** — no al modelo relacional ya migrado de QA
(`qjqorixtkilwsndqayyx`), que se conserva intacto y sin tocar. Esta
decisión no fija el diseño futuro (A–Z) ni incorpora P2 al cierre de
PM33.

## Estado: preparado, NO ejecutado en esta sesión

Todo lo de este documento está implementado y versionado en la rama
`claude/pm33-p03-obtener-contexto-operativo`
(`tests/pm33/supabase-full/`, `.github/workflows/pm33-p05-entorno-aislado.yml`)
pero **no se ha ejecutado ni una sola vez**: el sandbox de esta sesión no
puede correr Docker (`sudo service docker start` falla con
`ulimit: Operation not permitted`, la misma restricción encontrada antes
en esta revisión) y no tiene el CLI de `supabase` instalado. La primera
ejecución real debe ser supervisada.

## Opción recomendada: GitHub Actions, `workflow_dispatch` manual, coste cero

Este mismo repositorio ya tiene un precedente idéntico, probado y
committeado: `.github/workflows/pm12-p08-produccion-segura.yml` +
`tests/pm12/supabase-full/`, que arranca PostgreSQL 17 + Auth (GoTrue) +
PostgREST reales y desechables con el CLI de Supabase (`supabase start
-x realtime,storage-api,imgproxy,studio,mailpit,postgres-meta,edge-runtime,logflare,vector,supavisor`)
sobre un runner de GitHub Actions (que sí soporta Docker), corre las
pruebas, y hace `supabase stop`. Se ha replicado exactamente ese patrón
para PM33:

- `tests/pm33/supabase-full/supabase/config.toml` — copia del de PM12,
  mismo `major_version = 17`.
- `tests/pm33/supabase-full/supabase/migrations/20260919160000_pm33_schema_representativo.sql`
  — subconjunto representativo del esquema de PROD (`perfiles`,
  `empresas`, `locales`, `membresias_usuario`, `almacen_kv`), extraído
  por introspección igual que `tests/pm33/db/fixtures.sql`, pero **sin**
  el stub de `auth.uid()`: aquí lo resuelve Auth real desde el JWT. RLS
  activado y acceso directo por PostgREST revocado de `anon`/`authenticated`
  en las tablas base, igual que el modelo real (el único punto de acceso
  autorizado es la función `SECURITY DEFINER`).
- `tests/pm33/supabase-full/supabase/migrations/20260919170000_pm33_p05_identidad_antes_de_actividad.sql`
  — copia literal (diff vacío de contenido) del candidato real, aplicado
  en PROD el 19/09/2026 y registrado allí con la versión real
  `20260919225831` (ver `cierre-proyecto-a/pm33/PROPUESTA_PROMOCION.md`) —
  este archivo del entorno de pruebas conserva su nombre original,
  `20260919170000`, porque no es una migración desplegable (el gate de
  migración única la ignora explícitamente); el archivo desplegable real
  es
  `supabase/migrations/20260919225831_pm33_p05_identidad_antes_de_actividad.sql`.
- `tests/pm33/supabase-full/p05-auth-postgrest-contract.mjs` — usuarios
  reales vía Auth Admin API, `signInWithPassword`-equivalente
  (`/auth/v1/token?grant_type=password`) por JWT real, llamadas RPC reales
  vía PostgREST (`fetch` a `/rest/v1/rpc/obtener_contexto_operativo`), sin
  `pg` directo para las llamadas de negocio (`pg` solo para preparar
  fixtures). Incluye explícitamente el **escenario 1 pedido por el
  propietario sobre 5dfdbca** (identidad duplicada `dup-9` con estados
  distintos entre emp-A/loc-A e emp-B/loc-B, perfil Cajero/a, membresía
  única en A): pedir `loc-B` debe quedar rechazado con JWT y PostgREST
  reales, pedir el propio `loc-A` debe seguir resolviendo. Añade además
  aislamiento básico, revocación de membresía, herencia legítima sin
  membresía, y un control de que las tablas base siguen sin exponerse
  directamente por PostgREST.
- `.github/workflows/pm33-p05-entorno-aislado.yml` — **deliberadamente
  solo `workflow_dispatch`**, a diferencia de `pm12-p08-produccion-segura.yml`
  (que además dispara con `push` a su rama dedicada). Un push a esta rama
  NO ejecuta nada por sí solo; hace falta una activación manual explícita
  en la pestaña Actions (o vía la API/herramienta de disparo), que no se
  ha hecho en esta sesión.

**Coste y efecto real de ejecutarlo**: minutos de GitHub Actions de este
repositorio (incluidos en el plan actual salvo que ya estén agotados),
un runner efímero de GitHub que se destruye al terminar, sin crear ni
tocar ningún proyecto remoto de Supabase, sin escribir en QA ni en PROD.
Reversión: ninguna acción que revertir — no queda nada persistente. Esta
es la opción recomendada precisamente porque no tiene ninguno de los dos
efectos (coste recurrente, proyecto remoto nuevo) que sí tienen las dos
alternativas de abajo.

## Alternativas con Supabase Cloud (requieren autorización explícita antes de ejecutar cualquier operación — no ejecutadas)

Solo por completitud, ya que el propietario pidió evaluarlas si hiciera
falta crear o reactivar un proyecto remoto. Ninguna de las dos se ha
ejecutado.

### Alternativa A — reactivar `ytavvyusrmwandchjyei` (L&A Suite P2-R03 validation, hoy INACTIVE)

- **Destino**: proyecto ya existente, organización `legxycypezcvrqmzvhaz`,
  región `eu-west-1`, Postgres `17.6.1.166`, creado el 2026-09-17,
  actualmente `INACTIVE` (pausado).
- **Operación concreta**: `restore_project` (API de gestión de Supabase)
  — reanuda el proyecto pausado. Antes de asumir que sirve, hace falta
  ejecutar contra él el mismo preflight por hash que contra QA (no dar
  por bueno que su modelo coincide con PROD solo por el nombre).
- **Coste**: una consulta de coste de tipo `project` sobre esta
  organización devuelve **0 USD/mes** de coste adicional (recurrente) —
  la organización ya tiene capacidad para el plan de este proyecto.
  Reactivar un proyecto pausado no es idéntico a crear uno nuevo, así que
  esta cifra es orientativa, no una confirmación de que la reactivación en
  sí sea gratuita; la propia herramienta de reactivación pediría
  confirmación de coste en el momento, y esa confirmación no se ha hecho.
- **Reversión**: volver a pausar el proyecto (`pause_project`).

### Alternativa B — crear un branch de desarrollo de Supabase sobre PROD o QA

- **Destino**: un branch de Supabase (entorno aislado gestionado,
  vinculado a un proyecto padre — PROD o QA) creado vía `create_branch`.
- **Operación concreta**: requiere `confirm_cost_id` — un paso de
  confirmación de coste explícito antes de crear nada, ya integrado en la
  propia herramienta.
- **Coste real, consultado ahora**: **0.01344 USD/hora** (facturación por
  horas, recurrente mientras el branch exista) sobre esta organización.
- **Reversión**: `delete_branch`.

**Ninguna de las dos se recomienda como primera opción**: ambas implican
un proyecto remoto real (aunque sea de prueba) y, en el caso B, un coste
recurrente por hora; la opción de GitHub Actions cubre el mismo objetivo
(Postgres 17 + Auth + PostgREST reales) sin ninguno de los dos efectos.
Se documentan aquí, con destino/coste/operación concretos, únicamente
para que el propietario pueda autorizar cualquiera de las dos si prefiere
esa vía en vez de (o además de) la de CI.

## Qué NO resuelve este documento

- No ejecuta el workflow — queda pendiente de una activación manual
  explícita y supervisada.
- No decide si el modelo relacional de QA es el diseño futuro de esta
  función — eso sigue pendiente del propietario y fuera del alcance de
  PM33 (ver `cierre-proyecto-a/pm33/HALLAZGOS_P02.md` sección 9.5).
- No aplica el candidato P05 a ningún entorno real (QA, la reactivación
  de `ytavvyusrmwandchjyei`, un branch nuevo, ni PROD).
