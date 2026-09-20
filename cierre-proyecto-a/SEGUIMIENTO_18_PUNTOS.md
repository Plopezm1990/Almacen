# Proyecto A · L&A Suite — Seguimiento de cierre (18 puntos)

Documento vivo. Revisión de cierre iniciada el 19/09/2026, contrastando el
informe `Proyecto_A_Pendientes_Verificados_2026-09-19` (corte ~11:24 UTC)
contra el estado real del repositorio, GitHub, Supabase (PROD/QA) y Netlify
en el momento de cada verificación registrada abajo. No contiene
credenciales ni secretos.

**Rama de trabajo:** `claude/proyecto-a-la-suite-cierre-3xs7l3`.
**Alcance de esta sesión:** lecturas remotas, preparación de correcciones en
rama/copia de trabajo aislada, commits locales, pruebas locales. `main` y
`release` no se han tocado. PR #38 no se ha fusionado. No se ha aplicado
ninguna migración ni cambio de datos/configuración en Supabase QA ni PROD.

**Convención de estado** (por punto, no por frase suelta):
`preparado` · `validado localmente` · `validado en QA` · `aplicado` ·
`cerrado` · `bloqueado` · `riesgo aceptado` (solo si hay una aceptación
explícita registrada del propietario — no se usa por defecto).

**Accesos comprobados al iniciar esta revisión:** GitHub (usuario
`Plopezm1990`, lectura/escritura de repo), Supabase (proyectos `flqercbgpgmmfaakrwkc`
= PROD, `qjqorixtkilwsndqayyx` = QA, `ytavvyusrmwandchjyei` = P2-R03
validation [INACTIVE], `cqtghwiuxrqrxupyonqf` = TPV [INACTIVE]), Netlify
(sitio `chic-entremet-9107cf`). Ningún acceso declarado como faltante
durante esta sesión.

---

## 1. PM33 / R10 — Aislamiento de `obtener_contexto_operativo()`

**Estado: CERRADO.** Fase A y fase B ejecutadas y verificadas en PROD, ambas
autorizadas explícitamente por el propietario. La migración P05 está
aplicada en `flqercbgpgmmfaakrwkc` (versión real registrada
`20260919225831`), postflight en verde (7/7 comprobaciones exigidas).
`release` se movió mediante fast-forward exacto a
`6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d` (sin merge commit, sin rebase,
`main`/PR#38 sin tocar) y Netlify publicó automáticamente el deploy
`6aaf17545a7196000883d14d` (`state=ready`, `branch=release`,
`commit_ref=6e26391...`, `context=production`, sin errores de build).
Postflight de producción en verde: `index.html` y `fuente.js` responden
correctamente, hash SHA-256 servido de `fuente.js`
(`9367617cb34600966a5e726e6a16b1bb2a537b220aba0c54d6fdd53e53c1eb8a`)
idéntico al esperado y al del commit promovido, cabecera `Cache-Control`
preservada, llamada RPC anónima sigue rechazada (`HTTP 401`, `42501`), sin
avisos de seguridad nuevos. Gate
[`run 35474922732`](https://github.com/Plopezm1990/Almacen/actions/runs/35474922732)
**SUCCESS**. Límite honesto documentado: sin credenciales reales de un
empleado activo no fue posible una prueba funcional autenticada completa
de la lógica multilocal en PROD (no se crearon usuarios ni datos
sintéticos, conforme a la condición explícita del propietario). Detalle
completo de la fase B en `pm33/HALLAZGOS_P02.md` sección 21. El mecanismo
de aplicación inicialmente propuesto (`supabase db push`) resultó
inseguro -- el propietario comprobó la matriz real de migraciones (34
locales vs. 36 en PROD, 0 en común) y se corrigió antes de aplicar nada
(ver más abajo y `pm33/HALLAZGOS_P02.md` sección 17).
Candidato P05 (SQL + frontend) validado localmente (Postgres 16 real,
81/81), en un entorno aislado equivalente al modelo actual de PROD con
**PostgreSQL 17.6.1.167 + Auth (GoTrue v2.196.0) + PostgREST (v16.2)
reales** sobre la rama de iteración
([`run 35465771875`](https://github.com/Plopezm1990/Almacen/actions/runs/35465771875),
commit `d6ed496`, SUCCESS: 9/9 frontend, paridad `source-recovery`,
15/15 Auth/PostgREST/RLS), y de nuevo sobre el SHA final de una rama
creada limpia desde `release` vigente — sin las migraciones intermedias
P03/P04 en su historia, con un gate automático que exige exactamente una
migración PM33 desplegable
([`run 35473168918`](https://github.com/Plopezm1990/Almacen/actions/runs/35473168918),
commit `21ce7fa`, **SUCCESS**). Cuarta ronda de revisión (independiente,
sobre `5dfdbca`): P04 filtraba por `activo` antes de resolver identidad
(podía ocultar una colisión real), tenía dos defectos de
concurrencia/caché en el frontend, y el preflight de QA tenía el mismo
punto ciego que debía detectar — encontrados y corregidos en P05. Una
ronda posterior, independiente, sobre la primera ejecución real
(`run 35460961139`, commit `9523131`, 14 PASS/1 FAIL) encontró y corrigió
además una condición de carrera ENTRE SESIONES en el frontend (dos
usuarios distintos pidiendo el mismo local podían compartir, sin darse
cuenta, la misma petición en vuelo), un `SOURCE_RECOVERY_DRIFT` nunca
corregido desde P03, y una prueba de autorización que exigía un mensaje
que nunca podía darse (el rechazo sin autenticar ocurre a nivel de
permiso, antes de la función). El propietario confirmó después, con
consultas de solo lectura propias sobre PROD y Netlify, el punto de
partida exacto y señaló que la rama de iteración no debía promocionarse
directamente por contener P03/P04 en su historia — de ahí la rama final
limpia. Decisión del propietario que enmarca toda esta ronda: preparar la
validación en un **entorno aislado equivalente al modelo actual de PROD**
(`almacen_kv`), conservando QA intacto — **no** decide el modelo futuro
ni incorpora P2 al cierre de PM33. Detalle completo en
`cierre-proyecto-a/pm33/HALLAZGOS_P02.md` (cubre P01→P02→P03→P04→P05, la
validación aislada real, y el candidato final limpio, secciones 13-16).
Propuesta concreta de promoción a PROD/Netlify, incluido el mecanismo
exacto de aplicación y reconciliación de versión, en
`cierre-proyecto-a/pm33/PROPUESTA_PROMOCION.md` — pendiente de
autorización separada del propietario para (A) aplicar en PROD y (B)
mover `release` (dispara Netlify automáticamente, `manual_deploy=false`).

- **Problema confirmado hoy, en vivo**: la función vigente en PROD
  (`flqercbgpgmmfaakrwkc`) sigue siendo la de 0 argumentos, sin acotar por
  empresa/local. El defecto R10 sigue activo en producción en este
  momento.
- **Candidato final vigente (limpio, para promoción)**: rama
  **`claude/pm33-promocion-final`**, SHA
  **`21ce7fad37dec815fc4568945872fc72a9bf3cd7`** — creada desde `release`
  vigente (`f313bc0`), **no** desde la rama de iteración. Un solo commit
  de contenido (`70ccfd5`, tomado por contenido exacto de
  `claude/pm33-p03-obtener-contexto-operativo` commit `d6ed496`, sin
  replicar su historia) más un commit de gate automático (`21ce7fa`).
  `git merge-base --is-ancestor origin/release HEAD` confirma `release`
  como ancestro directo. **Ninguna migración P03/P04 existe en esta rama,
  ni en el árbol ni en la historia** — `supabase/migrations/` contiene
  exactamente una migración PM33
  (`20260919170000_pm33_p05_identidad_antes_de_actividad.sql`), reforzado
  por un gate de CI que falla si no es así (verificado en rojo con una
  copia temporal de la migración P03 real, y en verde en
  [`run 35473168918`](https://github.com/Plopezm1990/Almacen/actions/runs/35473168918)).
  `fuente.js` y la migración son idénticos byte a byte (verificado con
  `diff`) al contenido ya validado en la rama de iteración.
  - **Rama de iteración (histórica, no promocionable directamente)**:
    `claude/pm33-p03-obtener-contexto-operativo`, commit `d6ed496`
    (SQL+frontend de producción en `e7491d5`→`5dfdbca`→`8dbef85`→`51c537f`;
    entorno aislado y su validación real en `de613dc`→`9523131`→`d6ed496`
    encima) — siete commits por delante de `release`, **fusión limpia
    confirmada** en su momento (`git merge --no-commit --no-ff` sobre
    `release` real, sin conflictos, abortada sin dejar rastro). Se
    conserva como registro de la iteración P03→P04→P05, pero la
    promoción real se hace desde `claude/pm33-promocion-final`, no desde
    aquí, precisamente porque esta rama sí contiene P03/P04 en su
    historia. Sustituye por completo a P04, P03 y P02 como iteración; la
    rama original P01 (`claude/pm33-fix-obtener-contexto-operativo`,
    commit `4127782`) sigue intacta, sin tocar.
- **Qué corrigió P05 sobre P04** (cuarta ronda, independiente, sobre
  `5dfdbca`, reproducido con Postgres real antes de escribir el parche —
  detalle completo en `pm33/HALLAZGOS_P02.md` sección 11):
  1. **Filtrar por `activo` antes de resolver identidad podía ocultar
     una colisión real.** Demostrado: mismo `empleado_id` en `almacen_kv`
     de dos empresas, uno marcado inactivo y otro activo — contar
     candidatos filtrando por `activo` primero dejaba un único candidato
     "visible" (el activo), aunque la identidad fuera genuinamente
     ambigua; una coincidencia activa en otra empresa no demuestra
     pertenencia. P05 cuenta primero sin filtrar por `activo`, a nivel
     global, y solo examina `activo` sobre el único candidato ya resuelto
     de forma inequívoca. Aplicado a los tres roles del bloque obligatorio
     y a Camarero/a por igual.
  2. **Filtración de identidad cruzada en el frontend al descartar una
     respuesta obsoleta.** El contador de generación de P04 devolvía
     `contextoCache` sin comprobar a qué usuario/local pertenecía —una
     petición tardía para un usuario/local antiguo podía recibir el
     contexto de un usuario/local más nuevo. P05 solo devuelve la caché
     si coincide con el usuario/local de quien pregunta.
  3. **Falsos vacíos por concurrencia normal.** Dos peticiones
     simultáneas para el mismo usuario/local (sin caché inicial, ambas
     RPC correctas) podían hacer que la primera terminara vacía. P05
     coalesce las peticiones equivalentes de forma síncrona antes de
     cualquier `await`, para que la concurrencia normal no produzca
     resultados vacíos falsos.
  4. **Preflight de QA con el mismo punto ciego que debía detectar.** La
     heurística v1 (`usa_empleados_relacional AND NOT usa_almacen_kv`) no
     abortaba contra QA porque QA es un modelo híbrido (usa `almacen_kv`
     para el catálogo de locales Y `empleados` relacional para el resto).
     Sustituida por comparación de hash md5 exacto de
     `pg_get_functiondef()` contra una lista corta de hashes compatibles
     conocidos.
  5. **Bug de doble escritura en el kit de carga de datos de QA.**
     `02_cargar_datos_prueba.mjs` escribía la misma fila `almacen_kv` dos
     veces por separado y la segunda escritura reemplazaba la primera
     por completo, perdiendo empleados de prueba. Corregido para
     construir cada fila completa en memoria antes de un único `INSERT`.
- **Corrección explícita sobre una afirmación anterior de esta misma
  sección**: donde antes decía que el preflight "abortó, correctamente,
  contra QA real", esa afirmación era incorrecta — el script nunca se
  había ejecutado de verdad en la ronda P04 (solo razonamiento manual
  sobre introspección suelta, con el mismo punto ciego que el preflight
  v1). La versión corregida por hash (punto 4 de arriba) **sí se ejecutó
  de verdad** contra QA el 19/09/2026 y abortó con el hash real de QA
  (`3064430c63c97f6c50e05ff0117da862`) en el mensaje de error — ver
  `pm33/HALLAZGOS_P02.md` sección 11.3 para la evidencia completa.
- **Qué corrigió P04 sobre P03** (tercera ronda, independiente,
  reproducido con Postgres real antes de escribir el parche):
  1. **El parámetro del cliente no demostraba autorización.** P03
     aceptaba la fuente heredada (el propio `empleado_id` en
     `almacen_kv`) contra un `p_local_id` explícito comprobando solo "¿hay
     una coincidencia de este id EN ese local?" — no pertenencia real.
     Demostrado: un `empleado_id` duplicado entre dos empresas, sin
     ninguna membresía, obtenía el contexto de cualquiera de las dos con
     solo pedirla por su local. Afectaba también al bloque obligatorio
     (Encargado/Cajero/a/Churrero/a), no solo a Camarero/a. P04 resuelve
     esa fuente una sola vez, a nivel GLOBAL (sin filtrar por el local
     pedido): si no es exactamente un candidato, queda inutilizable para
     cualquier local explícito, no solo para el que resultó ambiguo.
  2. **Una membresía desactivada no revocaba el acceso heredado.**
     Demostrado: desactivar la membresía de un Camarero/a no le impedía
     seguir obteniendo su contexto, porque su `empleado_id` seguía
     existiendo, sin cambios, en `almacen_kv`. P04 comprueba si existe una
     membresía explícitamente inactiva del mismo usuario para esa misma
     empresa/local antes de aceptar la vía heredada; si no existe
     ninguna fila de membresía (el caso real de legado puro), la vía
     heredada sigue funcionando sin cambios — verificado con pruebas
     dedicadas para no penalizar a los usuarios heredados legítimos.
  3. **Condición de carrera en el frontend.** Dos peticiones pendientes
     para el mismo usuario/local: la segunda rechazaba primero; la
     primera, más tardía, podía resolver después con éxito y restaurar la
     caché que la más reciente ya había limpiado. P04 añade un contador
     de generación: cualquier respuesta que resuelva después de que otra
     invocación más reciente haya tomado el relevo se descarta sin tocar
     la caché ni devolverse al consumidor. Cubre también cambios de local
     y de sesión con peticiones en curso.
- **Pruebas ejecutadas para P04 (histórico, ver P05 abajo)**: **75/75**
  aserciones locales en verde, Postgres 16.13 real + sandbox `vm` de
  `fuente.js`, no mocks de texto (39 contrato vigente + 7 regresión
  Camarero/a + 17 aislamiento Camarero/a + 12 defectos nuevos de
  identidad/revocación + 5 escenarios de frontend, incluida la condición
  de carrera). Cero pruebas desactivadas o pendientes: T14c, superseded
  por un cambio de contrato deliberado desde P03 (`empresaId` ahora se
  resuelve para roles no gestionados cuando es deducible), se actualizó
  con justificación y una comprobación más estricta (valor exacto) en un
  archivo de contrato vigente separado; el archivo histórico de P01 se
  conserva sin tocar. Cada defecto nuevo se demostró en rojo contra P03
  (6/12 y el escenario de frontend fallaban) antes de escribir la
  corrección.
- **Pruebas ejecutadas para P05 (vigente)**: local, Postgres 16.13 real +
  sandbox `vm` de `fuente.js` — 6/6 aserciones nuevas de
  identidad-antes-que-actividad (3/6 fallan contra P04 antes de
  corregir); 7 escenarios de frontend (2 nuevos de concurrencia/caché),
  ejecutados 5 veces consecutivas completas en verde de forma
  determinista; batería completa de P01-P04 sin regresión. Preflight de
  QA corregido (hash exacto) **ejecutado de verdad** contra
  `qjqorixtkilwsndqayyx`. **Entorno aislado equivalente al modelo actual
  de PROD** (PostgreSQL 17 + Auth + PostgREST reales, vía
  `workflow_dispatch` de GitHub Actions) preparado y versionado, **no
  ejecutado todavía** — ver más abajo. Detalle completo en
  `pm33/HALLAZGOS_P02.md` sección 11.
- **Frontend (`fuente.js`, misma rama, commits `8dbef85` + `51c537f`)**:
  control de concurrencia corregido sobre P04 (ver arriba), y una segunda
  corrección posterior — concurrencia ENTRE SESIONES (dos usuarios
  distintos pidiendo el mismo local podían compartir, sin darse cuenta,
  la misma petición en curso). **No publicado a `release`.**
- **QA no es hoy un entorno válido para este candidato (vigente, sin
  cambios respecto de P04).** Se pidió explícitamente no asumir que la
  definición/permisos de QA coinciden con los de PROD. No coinciden:
  `obtener_contexto_operativo()` en QA es una **reimplementación
  completa**, sobre tablas relacionales (`public.empleados`/`locales`) y
  autorización exclusivamente vía membresías, sin ninguna vía heredada
  por `almacen_kv` — no una variante del mismo diseño. Aplicar este
  candidato (pensado para el modelo real de PROD) sobre QA sustituiría
  una implementación ya migrada y más estricta por una más antigua. El
  preflight (`cierre-proyecto-a/pm33/qa/00_preflight.sql`) lo detecta
  automáticamente y **aborta** en vez de dejar que un `apply` posterior lo
  sobrescriba a ciegas. Coherente con la deuda de trazabilidad de
  migraciones ya registrada más abajo (Punto 5): esta es la confirmación
  concreta, sobre esta función exacta. Decisión ya tomada por el
  propietario sobre esta base: preparar un entorno aislado equivalente al
  modelo de PROD en vez de reconciliar con QA — QA se conserva intacto.
  **Corrección explícita**: esta misma sección afirmaba antes que el
  preflight "abortó, correctamente, contra QA real" en la ronda P04 —
  incorrecto: ese script nunca se había ejecutado de verdad, solo se
  razonó a mano sobre introspección suelta, con el mismo punto ciego
  (heurística de texto) que una revisión independiente encontró después.
  La versión corregida (hash md5 exacto) **sí se ejecutó de verdad**
  contra QA el 19/09/2026 y abortó con el hash real de QA
  (`3064430c63c97f6c50e05ff0117da862`) en el propio mensaje de error —
  evidencia completa en `pm33/HALLAZGOS_P02.md` sección 11.3.
- **Entorno comprobado**: local (Postgres 16.13, 81/81 aserciones),
  incluida la transición real desde la función hoy vigente en PROD, para
  P03, P04 y P05 por separado. **Y, desde esta ronda, PostgreSQL 17 real
  + Auth (GoTrue) + PostgREST reales, vía GitHub Actions**
  ([`run 35465771875`](https://github.com/Plopezm1990/Almacen/actions/runs/35465771875),
  commit `d6ed496`, **SUCCESS**): versiones efectivas PostgreSQL
  `17.6.1.167`, PostgREST `v16.2`, GoTrue `v2.196.0`. 9/9 escenarios de
  frontend, paridad `source-recovery` en verde, 15/15 aserciones reales
  de Auth JWT + PostgREST + permisos/RLS (incluido el escenario de
  identidad duplicada pedido por el propietario, y el rechazo sin
  autenticar por HTTP 401 + código `42501`, con `EXECUTE` de `anon`
  comprobado como denegado directamente en la base). Una primera
  ejecución (`run 35460961139`, commit `9523131`) dio 14 PASS/1 FAIL — el
  fallo era de la prueba, no del candidato (exigía un mensaje que nunca
  puede darse porque el rechazo sin autenticar ocurre a nivel de permiso,
  antes de la función); corregido junto con un `SOURCE_RECOVERY_DRIFT`
  nunca cerrado desde P03. Detalle completo en `pm33/HALLAZGOS_P02.md`
  sección 13. Kit de QA completo, corregido y versionado en
  `cierre-proyecto-a/pm33/qa/` — sigue bloqueado para
  `qjqorixtkilwsndqayyx` por el hallazgo de incompatibilidad de modelo,
  sin ejecutar más allá del preflight (decisión ya tomada de validar por
  el camino del entorno aislado en vez de reconciliar con QA).
- **Diferencias del entorno de validación frente a PROD real**: el
  esquema usado es un subconjunto representativo (las 5 tablas de las que
  depende `obtener_contexto_operativo`), no un volcado completo de PROD;
  no cubre el resto de tablas de la aplicación, ni Storage, ni Edge
  Functions, ni ningún otro componente fuera de esta función.
- **Candidato final limpio, creado y re-validado esta ronda**: el
  propietario, tras confirmar por su cuenta el estado exacto de PROD y
  de Netlify con consultas de solo lectura, señaló que la rama de
  iteración no debía promocionarse directamente (contiene P03/P04 en su
  historia). Creada `claude/pm33-promocion-final` desde `release` vigente,
  con exactamente una migración desplegable y un gate de CI que lo
  exige automáticamente — re-validada de nuevo con PostgreSQL 17 +
  Auth + PostgREST reales sobre el SHA final
  ([`run 35473168918`](https://github.com/Plopezm1990/Almacen/actions/runs/35473168918),
  commit `21ce7fa`, **SUCCESS**). Detalle completo en
  `pm33/HALLAZGOS_P02.md` sección 15.
- **Mecanismo de aplicación — corregido en esta ronda, PROMOCIÓN
  DETENIDA hasta ejecutarlo.** Propuesta anterior (retirada): `supabase
  db push` (CLI), apoyada en que `list_migrations` no mostraba ninguna
  versión `20260919*` en PROD. **El propietario comprobó la matriz real
  de migraciones y esa propuesta no era segura**: `supabase/migrations/`
  de la rama final contiene **34** versiones, PROD registra **36**, y la
  **intersección entre ambas es 0** (verificado de forma independiente
  contando los 34 prefijos reales y comparándolos contra las 36 filas
  reales). `list_migrations` (lectura de la tabla remota) **no es
  equivalente** a `supabase db push --dry-run` (que compara esa tabla
  contra los archivos locales): con intersección 0, un `db push` real
  trataría las 34 migraciones locales como pendientes, no solo P05 — sin
  evidencia de que aplicar las otras 33 sea seguro. Quedan descartados
  `db push` sin flags, `db push --include-all`, y cualquier reparación
  masiva del historial.
**Mecanismo corregido y EJECUTADO**: aplicado únicamente el contenido
  exacto de la migración P05 vía `apply_migration` (MCP, que no lee ni
  compara `supabase/migrations/`, así que no tocó las otras 33
  versiones). Preflight repetido inmediatamente antes de aplicar: las
  cuatro condiciones de parada exigidas por el propietario se
  comprobaron, ninguna se disparó (función de 0 argumentos, hash
  `40d7bf2ea50776b7eb40a3fff239c0b4`, sin dependencias nuevas,
  `authenticated=true`/`anon=false`/`public=false`). Postflight
  inmediato, las siete comprobaciones exigidas, todas en verde: una única
  función con `p_local_id text DEFAULT NULL` (sin la sobrecarga de 0
  argumentos), `authenticated` conserva `EXECUTE`, `anon`/`PUBLIC` sin
  `EXECUTE`, hash de la definición aplicada
  (`211ddc8ad6c053be1c75872ceb29a093`) verificado idéntico contra una
  instancia local de Postgres 16 con el mismo P05 ya validado, llamada
  sin sesión rechazada con una petición HTTP real contra PROD (`401`,
  código `42501`, mismo comportamiento ya validado en el entorno
  aislado), y sin avisos de seguridad nuevos atribuibles a esta migración
  (mismos 17 hallazgos de `SECURITY DEFINER` ya documentados, mismo
  hallazgo de leaked password protection ya documentado como Punto 10).
  `list_migrations` confirma **37 filas** (36+1): la nueva es `version =
  "20260919225831"`, `name = "pm33_p05_identidad_antes_de_actividad"`.
  Candidato final actualizado (renombrado el archivo a esa versión real,
  gate y documentación actualizados) y re-validado:
  `claude/pm33-promocion-final` @ `6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d`,
  [`run 35474922732`](https://github.com/Plopezm1990/Almacen/actions/runs/35474922732)
  **SUCCESS** (verificado de forma independiente vía la API de GitHub
  Actions). Ningún usuario ni dato sintético creado en PROD. Rollback
  corregido, no ejecutado (no hizo falta): nunca `migration repair
  --status reverted` como operación normal (el historial ya tiene
  discrepancias no auditadas); el rollback es hacia delante — primero
  restaurar el deploy de Netlify `6aad473513310100099a03a9`, después
  aplicar una NUEVA migración de rollback (mismo mecanismo), conservando
  en el historial tanto la aplicación de P05 como su reversión. Detalle
  completo en `pm33/PROPUESTA_PROMOCION.md` secciones 4-5 y 11-13, y en
  `pm33/HALLAZGOS_P02.md` sección 19.
- **Fase B ejecutada (19/09/2026), autorizada explícitamente por el
  propietario**: comprobación inmediata antes de mover reconfirmada en
  verde (`release` seguía en `f313bc0`, el candidato en `6e26391`, el
  gate en SUCCESS, PROD con la migración `20260919225831`) → fast-forward
  exacto de `release` a `6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d` (push
  sin `--force`, aceptado como fast-forward puro; `main`/PR#38 sin
  tocar) → Netlify publicó automáticamente el deploy
  `6aaf17545a7196000883d14d` (`ready`, `production`,
  `commit_ref=6e26391...`, sin errores de build, sin secretos
  detectados) → verificación en producción: `index.html` y `fuente.js`
  responden `HTTP 200`, hash SHA-256 servido de `fuente.js`
  (`9367617cb34600966a5e726e6a16b1bb2a537b220aba0c54d6fdd53e53c1eb8a`)
  idéntico al esperado y al del commit promovido (verificado con `diff`
  byte a byte), cabecera `Cache-Control: no-cache,must-revalidate`
  presente, llamada RPC anónima sigue rechazada (`HTTP 401`, `42501`),
  avisos de seguridad sin cambios → **no fue necesario ningún
  rollback**. Límite honesto: sin credenciales reales de un empleado
  activo no fue posible una prueba funcional autenticada de extremo a
  extremo (no se crearon usuarios ni datos sintéticos en PROD, conforme
  a la condición explícita del propietario). **PM33 queda CERRADO.**
  Detalle completo en `pm33/HALLAZGOS_P02.md` sección 21.
  Decisión separada y no bloqueante para el cierre de PM33: si el modelo
  relacional de QA es el diseño futuro de esta función, ni la deuda más
  amplia de 34 vs. 36 migraciones más allá de P05 (Punto 5).

---

## 2. Deuda de las 18 pruebas fallidas (de 134)

**Estado: CERRADO — puerta de CI en verde real, 133/133 contratos
activos.** El informe original `Proyecto_A_Pendientes_Verificados_2026-09-19`
que fijaba "134 scripts / 116 PASS / 18 FAIL" **no se localizó en ningún
punto del repositorio ni de GitHub** — búsqueda exhaustiva (pickaxe sobre
las 104 ramas y todo el historial, PR #38, issues, y confirmación de que
ningún workflow de este repo puede generar ese tipo de recuento porque
todos paran en el primer fallo). Por instrucción explícita del
propietario, se reconstruyó desde cero: se inventariaron los **142**
archivos `.mjs` reales bajo `tests/` en un manifiesto versionado
(`cierre-proyecto-a/punto2/manifiesto_clasificacion.json`), se ejecutaron
de verdad (nunca simulados) contra código/BD/Auth-PostgREST reales, y se
clasificó cada resultado con evidencia concreta.

**Primera corrección tras una auditoría independiente**: una primera
entrega (commit `0234a2f`) resultó no ser reproducible (ruta absoluta
hardcodeada, dependía de un archivo temporal sin versionar) y su script
de Postgres usaba `set -e`, que impedía que hubiera podido producir la
evidencia completa que decía tener (uno de los 10 archivos falla a
propósito). Los 9 contratos activos "obsoletos" se habían diagnosticado
pero no corregido — la batería seguía en rojo pese a que el informe
afirmaba "0 defectos". Se corrigió todo: los 2 scripts se reescribieron
para ser reproducibles desde cualquier clon (verificado con `git
worktree add --detach` antes de confiar en ellos) y para ejecutar cada
test aislado sin parar en el primer fallo; los 9 contratos se
actualizaron para comprobar comportamiento vigente de forma estructural
(no literales frágiles del bundle); se completaron 2 arneses de prueba
con las APIs de navegador que les faltaban (`window.setInterval`,
`window.sessionStorage`). Se construyó además una puerta de CI completa
(4 jobs) que revalida el manifiesto contra el árbol real en cada
ejecución. Cerrado sobre commit `1b823c9`,
[`run 35495524333`](https://github.com/Plopezm1990/Almacen/actions/runs/35495524333).

**Segunda corrección tras una auditoría independiente**: esa puerta de
CI tenía un defecto real propio: `ejecutar_bateria_no_db.sh` registraba
el código de salida de cada contrato pero nunca lo acumulaba ni exigía
que los 121 activos de Node terminaran en `0` — el script podía acabar
en verde con un contrato activo roto en medio de la batería. Además,
el job `gate-final` imprimía `ACTIVE_PASS=133` / `ACTIVE_FAIL=0` como
texto fijo, sin haberlos calculado. Se corrigió: `ejecutar_bateria_no_db.sh`
ahora calcula `NODE_ACTIVE_TOTAL/PASS/FAIL` reales por clasificación del
manifiesto, exige exactamente 121/121/0 y termina en código 1 si algún
contrato activo falla (o si una utilidad/diagnóstico se bloquea o lanza
excepción, contado como fallo de infraestructura) — siempre tras
completar la batería entera, nunca a mitad de camino, y el veredicto se
calcula e imprime antes de la comprobación de limpieza del árbol para
que un fallo real nunca quede oculto tras otro aviso;
`preparar_postgres_local.sh` emite igual `POSTGRES_ACTIVE_TOTAL/PASS/FAIL`
y `HISTORICAL_EXPECTED_FAIL` calculados y exige 9/9/0/1; los tres jobs
de ejecución del workflow exponen esos conteos como *outputs* de job
(los dos jobs full-stack cuentan solo los pasos cuyo `outcome` fue
`success`), y `gate-final` exige que los tres hayan terminado con éxito,
**suma** esos outputs (121+9+3=133) y solo entonces construye el
resumen — sin ningún `echo` de un número no demostrado en ese mismo run.
Se demostró el gate en rojo real y en verde real sobre el propio
workflow de CI, no solo en local: commit `ae8ef65` → verde
([`run 35502426949`](https://github.com/Plopezm1990/Almacen/actions/runs/35502426949));
commit temporal `009c5bb` (fallo forzado de un contrato activo no
relacionado con esta ronda) → rojo real, `NODE_ACTIVE_FAIL=1` con la
causa exacta
([`run 35502547235`](https://github.com/Plopezm1990/Almacen/actions/runs/35502547235),
FAILURE); commit `6320ab9` (revert del anterior) → verde real de nuevo
([`run 35502655080`](https://github.com/Plopezm1990/Almacen/actions/runs/35502655080)).
Detalle completo de ambas rondas de corrección en
`cierre-proyecto-a/punto2/INFORME_CLASIFICACION.md` sección 0-bis.

**Resultado final, verificado en CI sobre el commit final** —
[`run 35502837233`](https://github.com/Plopezm1990/Almacen/actions/runs/35502837233)
(commit `643b56a`, SUCCESS, 4/4 jobs, logs comprobados uno a uno, no solo
el estado; mismo estado de código ya verificado en rojo/verde real en el
commit `6320ab9` / `run 35502655080` citados arriba):

```
ACTIVE_PASS=133
ACTIVE_FAIL=0
HISTORICAL_EXPECTED_FAIL=1
UTILITIES=3
DIAGNOSTICS=5
TOTAL_INVENTORY=142
```

133 contratos activos en verde real (121 Node + 9 Postgres real + 3
Auth/PostgREST/Postgres real), 1 histórico marcado
`HISTORICAL_EXPECTED_FAIL` (`tests/pm33/db/p01-aislamiento-multiempresa-contract.mjs`,
un registro retirado a propósito que el propio repositorio documenta
como tal — nunca contado como activo), 3 utilidades y 5 diagnósticos sin
semántica PASS/FAIL. **0 defectos de producto confirmados en esta
batería** (no es una afirmación de que el producto no contenga defectos
en general — es el resultado de los 133 contratos activos ejecutados
aquí, cuyo cálculo ahora es real y exigido por la propia puerta, nunca
declarado). Se verificaron especialmente los recorridos PM28-33
(identidad/fichaje, contexto empresa/local, persistencia, red,
concurrencia): todos PASS; no se encontró ningún identificador "VIS-17"
en el repositorio; impresión/exportación sigue sin test `.mjs` dedicado
(hallazgo de cobertura, no de defecto, cruzado con el Punto 8, sin
inventar cobertura que no existe). Hallazgo incidental, cruzado con el
Punto 6: `build-netlify-publish.mjs` no excluye `cierre-proyecto-a/` de
la copia publicable. No se aplicó ningún cambio a `fuente.js` ni a
migraciones, ni se tocó `release`, `main`, PR #38, Supabase ni Netlify —
no hizo falta. Detalle completo, matriz de 142 filas y evidencia
reproducible en la rama `claude/punto2-134-pruebas`:
`cierre-proyecto-a/punto2/INFORME_CLASIFICACION.md` y
`cierre-proyecto-a/punto2/MATRIZ_134_PRUEBAS.md`.

---

## 3. Puerta de CI sobre el candidato final

**Estado: CERRADO.** Fase A ejecutada (puerta de CI incorporada a
`release`, ahora en `8540bd0`) y Fase B ejecutada (protección de rama
aplicada sobre `release`, con `gate-final` como required status check),
ambas verificadas. (El diagnóstico original de este punto, "bloqueado —
confirmado que no existe hoy", describía `release@f313bc0`, que ya no es
el HEAD real de `release`; quedó sustituido por la revalidación completa
contra `release@6e26391`, después por la incorporación real de la Fase A,
y finalmente por la protección de rama de la Fase B, todo documentado al
final de esta sección.)

**Revalidación inicial contra `release@6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d`**
(no heredada de la ronda anterior): SHA de `main` =
`93a570badba1c5375febfbddc1dffdbcef003dcd`. De los 179 workflows presentes
en `release`, solo 2 tienen un disparador que pueda alcanzarla
(`pm05-regresion.yml`, `pull_request` sin filtro de rama pero con 5 rutas
muy estrechas; `pm26-defecto-l-hotfix.yml`, `push` a `release` con 3 rutas
igual de estrechas) — **ninguno ejecuta la batería general**. `release` no
tiene ninguna regla de protección (`protected: false`, confirmado vía la
API de GitHub): **un commit puede llegar hoy a `release` sin ejecutar
ninguna prueba general**, confirmado. Ningún workflow del repositorio usa
un solo `secrets.*` (grep exhaustivo sobre los 179): ninguno puede
desplegar en Netlify ni escribir en el proyecto Supabase remoto — el
despliegue de Netlify ocurre por la integración directa de Netlify con el
repositorio, fuera de cualquier check (ya observado en el Punto 1/PM33
Fase B).

**Diseño construido, en la rama `claude/punto3-puerta-ci-final`** (creada
desde `origin/release@6e26391`, sin tocar `release`): se generaliza la
puerta de 4 jobs (121 Node + 9 Postgres + 3 Auth/PostgREST/Postgres reales)
ya validada en el Punto 2, ahora como infraestructura general del
repositorio bajo `tests/ci/` (manifiesto, runners) y
`.github/workflows/puerta-ci-release.yml` — no bajo rutas de cierre de un
punto. Se conservan las 11 correcciones de tests del Punto 2, y PM33 P01
sigue separado como `historical_expected_fail`. Los conteos se calculan y
exigen siempre a partir de outputs reales de los jobs, nunca se declaran.
Cero credenciales, cero pasos de despliegue. Disparo: `workflow_dispatch`,
`pull_request` contra `release`, y `push` sobre la propia rama aislada —
deliberadamente **sin** disparador de producción (`push` a `release`)
todavía.

**Corrección tras una auditoría independiente**: la primera entrega
(commit `5bf2dec`) incluía el propio informe de cierre
(`cierre-proyecto-a/punto3/INFORME_PUERTA_CI.md`) dentro de la rama
candidata, lo que hacía el diff frente a `release` de **18** archivos en
vez de los 17 reales de la puerta de CI, y mezclaba documentación de
cierre con la infraestructura que se compara contra `release`. Se
corrigió: el informe (mismo contenido) se trasladó íntegro a esta rama de
seguimiento, y se retiró por completo de la candidata (commit `ea9f76b`).
Se repitieron todas las comprobaciones sobre el SHA corregido, incluida
una nueva: **igualdad byte a byte del payload de Netlify** entre
`release@6e26391` y la candidata corregida — `.netlify-dist` construido en
worktrees separados desde cada punto de partida: 33 archivos en cada uno,
mismas rutas, **mismos SHA-256 archivo por archivo**, sin
`cierre-proyecto-a` en ninguno de los dos. Confirma que incorporar esta
candidata no cambiaría ni un solo byte del contenido que Netlify sirve
hoy.

**Verificado, con logs comprobados en cada caso (no solo el estado)**:
- **Rojo real**: se forzó el fallo de un contrato activo no relacionado
  (`tests/g1/p02-evidence-map-contract.mjs`), commit `16b3c22`,
  [`run 35503815182`](https://github.com/Plopezm1990/Almacen/actions/runs/35503815182)
  — **FAILURE real**, con causa exacta en el log:
  `NODE_ACTIVE_FAIL=1`, `tests/g1/p02-evidence-map-contract.mjs (exit=1)`.
- **Verde real**: revertido (`git revert` → commit `96457de`),
  [`run 35503941267`](https://github.com/Plopezm1990/Almacen/actions/runs/35503941267)
  — **SUCCESS real**, 4/4 jobs, conteos calculados extraídos del log de
  `gate-final`: `NODE_ACTIVE_PASS=121/121`, `POSTGRES_ACTIVE_PASS=9/9`,
  `PM12_FULL_STACK_PASS=2/2`, `PM33_FULL_STACK_PASS=1/1`,
  `ACTIVE_PASS=133 ACTIVE_FAIL=0`.
- **Verde real, sobre el SHA final realmente entregado** (tras retirar el
  informe de la candidata): commit
  `ea9f76bb71414cd92534121e19cabbe35087ea8b`,
  [`run 35504771758`](https://github.com/Plopezm1990/Almacen/actions/runs/35504771758)
  — **SUCCESS real**, 4/4 jobs, mismos conteos:
  `NODE_ACTIVE_PASS=121/121`, `POSTGRES_ACTIVE_PASS=9/9`,
  `PM12_FULL_STACK_PASS=2/2`, `PM33_FULL_STACK_PASS=1/1`,
  `ACTIVE_PASS=133 ACTIVE_FAIL=0`, `UTILITIES=3 DIAGNOSTICS=5
  TOTAL_INVENTORY=142`.
- El workflow no despliega en Netlify ni escribe en Supabase remoto (cero
  `secrets.*`, stacks Supabase locales desechables parados siempre al
  final del job).
- SHA probado = HEAD local = HEAD remoto = `ea9f76b`.
- `git diff --check` limpio sobre el diff completo frente a `release`.
- Fusión simulada (`git merge --no-commit --no-ff` sobre una copia
  desechable de `origin/release`) sin ningún conflicto — **exactamente 17
  archivos**, todos bajo `.github/workflows/` o `tests/`.

**Dos ramas, con propósitos distintos — ninguna de las dos incorporada
todavía a `release`:**

- **Rama de trabajo, `claude/punto3-puerta-ci-final`** (7 commits sobre
  `origin/release@6e26391`): conserva como evidencia histórica todo el
  proceso de construcción y demostración -- incluida la demostración real
  en rojo (`16b3c22`, fallo forzado) y su reversión (`96457de`), y el
  vaivén del informe de cierre (`5bf2dec` lo añadió, `ea9f76b` lo retiró).
  SHA final de esta rama: `ea9f76bb71414cd92534121e19cabbe35087ea8b`. No se
  toca más allá de lo ya hecho.
- **Rama limpia de promoción, `claude/punto3-promocion-final`** (creada a
  petición explícita, tras una auditoría independiente que señaló que
  incorporar los 7 commits de trabajo a `release` mezclaría en el
  historial de producción un fallo deliberado y su reversión): **un solo
  commit** (`8540bd06d5555cf260aa4599144ed6c64f3ca029`) directamente sobre
  `origin/release@6e26391`, con el estado final por contenido (no por
  cherry-pick de historia) de los mismos 17 archivos de `ea9f76b`. Único
  cambio de contenido respecto a `ea9f76b`: el trigger `push` del workflow
  pasa a apuntar a `claude/punto3-promocion-final` (necesario para poder
  validar esta rama en su propio nombre; el trigger `push: branches:
  [release]` sigue sin añadirse).

  Comprobado antes del push (los 9 requisitos exigidos): `origin/release`
  es ancestro directo de `HEAD`; exactamente 1 commit entre
  `origin/release` y `HEAD`; el diff contiene exactamente 17 archivos,
  todos bajo `.github/workflows/` o `tests/`; nada bajo
  `cierre-proyecto-a/`; los archivos son idénticos a los de `ea9f76b`
  salvo el cambio permitido del nombre de rama en el trigger (confirmado
  con `git diff ea9f76b`); `git diff --check` limpio; la simulación de
  incorporación sobre una copia desechable de `release` no tiene
  conflictos; el payload `.netlify-dist`, construido desde worktrees
  limpios de `release` y de esta candidata, sigue siendo byte a byte
  idéntico (33 rutas, mismos SHA-256, sin `cierre-proyecto-a`).

  Confirmado después del push, con logs (no solo el estado): run
  [`35505508683`](https://github.com/Plopezm1990/Almacen/actions/runs/35505508683)
  — **SUCCESS real, 4/4 jobs**, conteos calculados extraídos del log de
  `gate-final`: `NODE_ACTIVE_PASS=121/121`, `POSTGRES_ACTIVE_PASS=9/9`,
  `PM12_FULL_STACK_PASS=2/2`, `PM33_FULL_STACK_PASS=1/1`,
  `ACTIVE_PASS=133 ACTIVE_FAIL=0`, `UTILITIES=3 DIAGNOSTICS=5
  TOTAL_INVENTORY=142`.

**`release`, Netlify y la protección de rama siguen sin modificarse.** El
futuro movimiento de `release` (fusión de cualquiera de las dos ramas)
disparará un nuevo deploy automático de Netlify -- por la integración
directa del repositorio, fuera de GitHub Actions -- aunque el payload
publicable sea byte a byte idéntico al actual: no hay cambio de contenido
servido, pero sí un nuevo `deploy_id` en el historial de Netlify.

**Entrega completa** (ambas ramas, SHA finales, runs rojo/verde/verde,
lista real de los 17 archivos, diff frente a `release`, igualdad byte a
byte del payload Netlify en ambas rondas, la Fase A ejecutada con toda su
evidencia, propuesta de required status check con su efecto y reversión)
en `cierre-proyecto-a/punto3/INFORME_PUERTA_CI.md`, en esta rama de
seguimiento.

---

### Fase A — EJECUTADA (autorizada explícitamente, 20/09/2026)

**Autorización**: incorporar `claude/punto3-promocion-final@8540bd0` a
`release` mediante fast-forward exacto, sin `--force`, sin merge commit,
sin tocar `main` ni PR #38. Reconfirmado inmediatamente antes del
movimiento: `release` seguía en `6e26391`, la candidata seguía en
`8540bd0`, el run
[`35505508683`](https://github.com/Plopezm1990/Almacen/actions/runs/35505508683)
seguía en `SUCCESS`, y la incorporación seguía siendo fast-forward con un
único commit.

**Movimiento**: `git push origin claude/punto3-promocion-final:release` →
`6e26391..8540bd0` (la notación `..`, no `...`, del propio `git push`
confirma fast-forward puro). `release` pasó a apuntar exactamente a
`8540bd06d5555cf260aa4599144ed6c64f3ca029`.

**Verificado después del push**:
- `release` = `8540bd06d5555cf260aa4599144ed6c64f3ca029` (confirmado con
  `git fetch` + `git rev-parse origin/release`).
- `main` intacto: `93a570badba1c5375febfbddc1dffdbcef003dcd`.
- PR #38 sin tocar: sigue `open`, `draft`, base `main@93a570b`, head sin
  cambios (`claude/pm26-preparacion-tecnica@f297be0`).
- `.github/workflows/puerta-ci-release.yml` presente en `release`, con su
  trigger `pull_request: branches: [release]` intacto (confirmado con
  `git show origin/release:...`).

**Despliegue automático de Netlify, supervisado hasta estado final**
(sitio `chic-entremet-9107cf`, proyecto `472295da-601a-43df-a4bc-8171f2fc668b`):
- Deploy anterior (baseline, capturado antes del push):
  `6aaf17545a7196000883d14d`, `commit_ref=6e26391...`, `ready`.
- **Deploy nuevo**: `6aafbc029d58a60008d41f3c` — `branch=release`,
  `commit_ref=8540bd06d5555cf260aa4599144ed6c64f3ca029`,
  `context=production`, `state=ready`, `error_message=null`,
  `deploy_validations_report.secret_scan_result.secretsScanMatches=[]`
  (693 archivos escaneados, ningún secreto). Tiempo de build: 9s.
- **Demostración de la igualdad del payload**: la comparación local ya
  hecha antes del push (33 archivos, mismas rutas, mismos SHA-256 entre
  `release@6e26391` y `8540bd0`) -- esa es la prueba. El resumen del
  deploy de Netlify, `"All files already uploaded by a previous deploy
  with the same commits"`, es evidencia corroborativa de reutilización
  (Netlify detectó los mismos archivos y no los volvió a subir), pero no
  sustituye a la comparación SHA-256 como demostración: es un mensaje de
  optimización interna de Netlify, no una garantía criptográfica
  publicada.
- Confirma la predicción hecha antes de autorizar: el push disparó un
  deploy real y nuevo (`deploy_id` distinto), pero sin ningún cambio de
  contenido servido en producción.

**`release` avanzó de `6e26391eff7bafc1ceb3f1e6f6e45d84f3d3086d` a
`8540bd06d5555cf260aa4599144ed6c64f3ca029`. La puerta de CI general
(`puerta-ci-release.yml`, 133/133 contratos activos) queda incorporada a
`release` y activa en los PR dirigidos a ella.**

---

### Fase B — EJECUTADA (aplicada por el propietario vía GitHub Settings, 20/09/2026)

**Autorización recibida**: configurar protección de rama en `release`
(required status check `gate-final`, `strict=true`, aplicar a
administradores, impedir force-push y borrado, sin aprobaciones de
terceros ni reglas adicionales).

**Preflight de solo lectura previo — completado, los 5 puntos confirmaron
lo esperado** (idéntico al registrado en el primer intento de esta fase):
`release` en `8540bd0`; `puerta-ci-release.yml` presente en `release` con
su trigger `pull_request` intacto; el check `gate-final` real y en
`success` en el run
[`35505508683`](https://github.com/Plopezm1990/Almacen/actions/runs/35505508683);
configuración de protección capturada antes de cualquier cambio:
`release` → `"protected": false`.

**Aplicación**: la sesión no dispone de ninguna herramienta de
configuración de `branch protection rules` (se comprobó explícitamente
buscando por nombre y por dominio entre las herramientas de GitHub
disponibles, y no existe ese tipo de herramienta; tampoco hay acceso a
`gh` CLI ni a la API de GitHub por otra vía). Por ello, la Fase B se
aplicó **directamente por el propietario, en la interfaz de
administración de GitHub** (`Settings → Branches`), no por esta sesión.
Estado reportado por el propietario, con verificación propia inmediata
desde la propia pantalla de edición de la regla tras crearla (mensaje de
GitHub `Branch protection rule created`, después reabierta en modo
edición para comprobar cada valor):
- Regla clásica de protección de rama creada sobre `release`, ID `83444129`.
- Required status check: `gate-final` (origen: GitHub Actions).
- `Require branches to be up to date before merging`: activado.
- `Do not allow bypassing the above settings`: activado (afecta también
  a administradores).
- Force-push: no permitido.
- Eliminación de `release`: no permitida.
- Sin aprobaciones obligatorias, sin resolución obligatoria de
  conversaciones, sin commits firmados, sin historial lineal, sin
  deployments obligatorios, sin bloqueo total de la rama -- ninguna regla
  no solicitada.

**Verificado por esta sesión, por lectura, con las herramientas
disponibles (sin modificar nada)**: `list_branches` de la API de GitHub
sobre `Plopezm1990/Almacen` devuelve, para `release`:
```
{"name":"release","sha":"8540bd06d5555cf260aa4599144ed6c64f3ca029","protected":true}
```
GitHub reconoce `release` como rama protegida (`protected: true`), sobre
el SHA correcto. Esta sesión no tiene acceso, entre sus herramientas, a
una lectura granular de la regla (required checks exactos, `strict`,
enforcement sobre administradores, restricciones de force-push/borrado) —
esa parte del estado reportado arriba procede de la verificación directa
del propietario desde la pantalla de edición de la regla en GitHub, no de
una relectura independiente por esta sesión. El único campo verificable
con las herramientas de esta sesión (`protected: true`/`false`) coincide
exactamente con lo reportado.

**Estado posterior, también confirmado por esta sesión**:
- `release` = `8540bd06d5555cf260aa4599144ed6c64f3ca029` (sin cambios).
- `main` = `93a570badba1c5375febfbddc1dffdbcef003dcd` (sin cambios).
- Netlify: `currentDeploy` sigue siendo `6aafbc029d58a60008d41f3c`,
  `state=ready` — no se generó ningún deploy nuevo al configurar la
  protección de rama (una operación de configuración de GitHub no es un
  push ni un cambio de contenido, así que no dispara la integración de
  Netlify).
- PR #38, Supabase y el código del repositorio: sin cambios.

**Procedimiento de reversión** (documentado, no ejecutado): editar o
eliminar la regla clásica de protección de rama `83444129` desde
`https://github.com/Plopezm1990/Almacen/settings/branches` — desactivarla
o borrarla revierte el efecto de inmediato; es un cambio de configuración
de GitHub, no de código, y no requiere ningún revert de commit.

**Fase B queda EJECUTADA y verificada dentro de lo que las herramientas
de esta sesión permiten confirmar por lectura.**

---

**Punto 3: CERRADO.** Fase A (incorporación de la puerta de CI a
`release`, fast-forward `6e26391..8540bd0`) y Fase B (protección de rama
+ `gate-final` como required status check) quedan ambas ejecutadas y
verificadas. `release` avanzó únicamente por el fast-forward autorizado;
la protección de rama se aplicó únicamente por la configuración
autorizada, sin reglas adicionales. `main`, PR #38, Supabase y el código
del repositorio no se tocaron en ningún momento. No se empezó el
Punto 4.

---

## 4. Manifiesto de reconstrucción del release

**Estado: bloqueado — desactualización confirmada y cuantificada.**

`source-recovery/CURRENT_RELEASE_MANIFEST.json` en `release` certifica:

```
targetFuenteCommit:   9d54fc7ba76bd1285625f37b2940f99d26777ab8
targetArtifactSha256: 0e45bc8d4175771b8bfd1e74ad0aa12fd39853a1431dc6ca702470882ae6c4c2
```

Esto **no corresponde al HEAD actual de `release`** (`f313bc0`, con 137
commits sobre `main`). El manifiesto certifica un punto muy anterior de la
historia. No se ha regenerado en esta sesión (requiere reconstruir desde
un entorno limpio con `npm ci` + aplicar el patch documentado — no
ejecutado aquí por alcance de tiempo). **Siguiente acción**: regenerar
`CURRENT_RELEASE_MANIFEST.json`/`CURRENT_RELEASE_EVIDENCE.json` para el
candidato final una vez esté fijado (después de resolver PM33 y el resto
de bloqueantes), no antes — regenerarlo hoy solo certificaría un estado
que todavía va a cambiar.

---

## 5. Matriz de procedencia de migraciones (repo / QA / PROD)

**Estado: deuda de trazabilidad confirmada, matriz NO completada.**

Listé las migraciones aplicadas en PROD (36) y QA (63) vía Supabase el
19/09/2026, y las comparé contra los archivos de `supabase/migrations/` en
la rama `release`. Confirmado: **los timestamps de los archivos en
`release` no coinciden 1:1 con las versiones registradas como aplicadas en
PROD** (p. ej. `release` tiene un archivo `20260904135838`, que no
aparece en el historial de migraciones de PROD tal como lo devuelve
Supabase). Esto es consistente con lo que señala el informe: el historial
de migraciones vivo en cada entorno no es una simple proyección del
directorio del repositorio.

Confirmado también: `p2_r02_revocar_exec_rpcs_legacy` está aplicada y
activa en PROD (versión `20260916035012`), y su cadena de origen no está
incorporada en `release`. QA tiene 27 migraciones adicionales que no
existen en PROD (toda la serie `p2_r01_qa_*`, `p2_r02_qa_*`,
`pm29_qa_*`), coherente con que P2 está muy por delante de PROD.

**No completado en esta sesión**: la matriz completa objeto-por-objeto
(grants, funciones, RLS) por entorno. Es un trabajo de reconciliación
sustancial que requiere su propia pasada dedicada.

---

## 6. Publicación y recuperación de Netlify

**Estado: parcialmente verificado; automatismo de publicación NO
confirmado.**

- Confirmado hoy: sitio `chic-entremet-9107cf`, deploy actual `6aad473513310100099a03a9`
  en estado `ready`/`current`, dominio de rama `release--chic-entremet-9107cf.netlify.app`
  (branch deploy activo para `release`, lo que implica que un push a
  `release` sí puede disparar un deploy — **razón adicional para no tocar
  `release` sin autorización explícita**).
- Con las herramientas disponibles en esta sesión no pude leer la
  configuración de build hooks (qué dispara exactamente producción, si es
  push a `release`, un hook API, o ambos) — el informe de 19/09 ya señala
  la misma limitación ("el conector expone los datos del deploy, pero no
  toda la configuración de hooks/build").
- **No se afirma** que el auto-deploy esté activado o desactivado; sigue
  sin confirmarse íntegramente. **Siguiente acción**: el propietario
  revisa Site settings → Build & deploy en el panel de Netlify (requiere
  sesión web, no disponible por API en esta sesión) y documenta el
  disparador exacto y el procedimiento de rollback a un deploy conocido.

---

## 7. MEJ-03/MEJ-04 — Frontend (Tailwind runtime, cabeceras)

**Estado: pendiente, confirmado hoy tal cual el informe.**

Comprobé directamente las cabeceras HTTP del sitio en producción
(`https://chic-entremet-9107cf.netlify.app/`, 19/09/2026): la respuesta
**no incluye** `Content-Security-Policy`, `X-Content-Type-Options`,
`Referrer-Policy` ni `Permissions-Policy`. No se ha tocado el frontend en
esta sesión (cambiar esto implica editar `release`/el bundle publicado,
fuera del alcance autorizado sin decisión expresa). **Siguiente acción**:
compilar Tailwind en build (retirar `cdn.tailwindcss.com` en runtime) y
añadir las cabeceras vía `netlify.toml` o `_headers`, midiendo login/PWA/
integraciones antes de publicar — no ejecutado aquí.

---

## 8. Dependencias (xlsx) y Actions por tag

**Estado: revisado, riesgo bajo confirmado por uso real; hardening de
Actions sigue pendiente.**

- Confirmé por lectura de `fuente.js` en `release` que el código de la
  librería `xlsx` empaquetado corresponde a las rutas de **escritura/
  exportación** (`write_zip_xlsx`, `write_vt`, tipos de contenido para
  generar `.xlsx`), no a un flujo de **parseo de archivos `.xlsx` que
  suba el usuario**. El aviso de prototype pollution (GHSA-4r6h-8v6p-xvw6)
  excluye explícitamente los flujos que solo exportan. Coincide con lo que
  ya señalaba el informe; no encontré uso adicional que lo contradiga.
- Confirmé **98 usos de `actions/checkout@v4`, 5 de `actions/setup-node@v4`
  y 4 de `actions/upload-artifact@v4`** en los workflows de `release`,
  todos fijados por tag mutable, no por commit SHA. Sigue pendiente el
  endurecimiento (fijar a SHA) — no aplicado en esta sesión por ser un
  cambio sobre `release`.

---

## 9. Avisos de índices (Performance Advisor)

**Estado: confirmado igual que el informe; sin cambios aplicados
(correcto, no se deben aplicar solo por el aviso).**

Performance Advisor de PROD, consultado el 19/09/2026, confirma
exactamente los mismos 4 FKs sin índice
(`locales.empresa_id`, `movimientos_stock.actor_user_id`,
`movimientos_stock.operation_id`, `stock_operaciones.actor_user_id`) y los
mismos 5 índices sin uso reportados el 19/09. Nivel `INFO` en ambos casos
(rendimiento, no seguridad). No se ha tocado ningún índice. **Siguiente
acción**: decidir caso por caso con datos de uso real antes de crear o
borrar nada — no se propone ninguna acción automática aquí.

---

## 10. Protección de contraseñas filtradas (Aviso G)

**Estado: bloqueado por plan — confirmado, sin cambios.**

Confirmado hoy: `auth_leaked_password_protection` sigue en `WARN`
(deshabilitado) en PROD. La organización sigue en el plan que no incluye
este control sin verificar el nivel exacto requerido hoy en la
documentación de Supabase (el informe de 19/09 lo sitúa en Pro o
superior). No se ha contratado ni cambiado ningún plan. **Decisión
pendiente del propietario.**

---

## 11. PM25-P02 — Ensayo integral de recuperación/migración

**Estado: NO ejecutado en esta sesión — pendiente.**

Requiere un ensayo completo (Auth/JWT/PostgREST/RLS + restauración +
reversión) en un entorno representativo autorizado. El entorno
`ytavvyusrmwandchjyei` (L&A Suite P2-R03 validation) sigue `INACTIVE`.
No se ha reactivado ni usado ningún entorno para este ensayo en esta
sesión — activar un proyecto Supabase pausado/inactivo tiene efectos
reales (consumo, posible coste) y requiere autorización explícita antes
de hacerlo.

---

## 12. Residuo QA `pm29_res`

**Estado: confirmado presente hoy; contenido inspeccionado a nivel de
esquema, no de filas.**

Confirmé hoy vía Security Advisor de QA: `public.pm29_res` sigue sin RLS
(`rls_disabled_in_public`, nivel `ERROR`). Inspeccioné únicamente el
**esquema** de la tabla (sin leer filas/datos personales): columnas
`paso text, resultado text, estado text, momento timestamptz` — la forma
es consistente con un registro de pasos/resultados de alguna prueba o
migración (p. ej. un log de ejecución de PM29), no con datos de clientes.
No se ha borrado ni protegido la tabla. **Siguiente acción**: confirmar
con quien la creó si sigue en uso; si no, retirarla en QA (no en PROD, no
afecta a PROD) con autorización — no ejecutado aquí.

---

## 13. Acta GO/NO-GO final

**Estado: pendiente — no se puede emitir hasta cerrar 1-12.**

No se ha reunido la matriz LA-001–LA-025/NR-01–NR-12/MEJ-01–MEJ-10 en esta
sesión. Dado que PM33 (el bloqueante más crítico, seguridad) sigue sin
aplicar y varios puntos transversales siguen abiertos, **emitir un
GO ahora sería prematuro**. Este documento es el sustituto provisional de
seguimiento hasta que 1-12 tengan estado `aplicado`/`cerrado` o
`riesgo aceptado` con aceptación explícita registrada.

---

## 14-18. P2 — Frente independiente (no bloqueante para PM26-PM32)

**Estado: sin tocar en esta sesión, seguimiento visible conforme al
acuerdo del informe.** No se ha mezclado su estado con el cierre del
bloque actual. Referencia rápida (sin reverificar en esta pasada):
P2-R03A (caja/devoluciones, gate verde `5a040c8`), P2-R03B/C (auditoría/
errores por empresa-local, gates verdes `46d880f`/`50b36da`), PM11/PM13
post-reset (gates verdes `2fd691d`/`eba3962`), P06 (persistencia servidor,
gate verde `fe6276b`, anterior al HEAD actual `4a963ff` de esa rama —
pendiente certificar el HEAD completo), auditoría transversal de
seguridad del Punto 2 (Edge Functions, `enviar-notificacion` y
`crear-cuenta-empleado` con las deficiencias de autorización ya descritas
en el informe, por lectura de código, sin explotar nada). Ninguno de estos
seis puntos se ha aplicado a PROD. Próxima acción: retomarlos como
workstream separado cuando se decida, sin condicionar el cierre de 1-13.

---

## Registro de verificaciones de esta sesión (19/09/2026)

- Acceso confirmado: GitHub (`get_me`, ramas, PR #38, Actions), Supabase
  PROD y QA (`list_projects`, `list_migrations`, `get_advisors`,
  `execute_sql` de solo lectura), Netlify (`get-projects`).
- `git status`/`git log` del checkout: limpio antes de empezar, rama
  `claude/proyecto-a-la-suite-cierre-3xs7l3` desde `main` (`93a570b`).
- PM33 (primera ronda, candidato P02): 45/45 aserciones Postgres 16.13
  real. Verificación de solo lectura contra PROD (0 empleados con
  `empleado_id` ambiguo entre locales).
- PM33 (segunda ronda, candidato P03 sobre rama `claude/pm33-p03-obtener-contexto-operativo`
  sacada de `origin/release`): 65/66 aserciones Postgres 16.13 real (SQL +
  frontend), incluida la migración completa probada partiendo de la
  función real hoy vigente en PROD (capturada por `pg_get_functiondef`,
  no reescrita de memoria) y su rollback. Verificación de dependencias y
  grants reales contra PROD antes de diseñar la migración (`pg_proc`,
  `pg_depend`, `has_function_privilege`). Detalle completo en
  `pm33/HALLAZGOS_P02.md` sección 7-8.
- PM33 (tercera ronda, independiente, candidato P04 sobre la misma rama,
  commit `5dfdbca`): 75/75 aserciones Postgres 16.13 real + sandbox vm de
  `fuente.js`, cero pendientes/desactivadas. Reproducidos en rojo contra
  P03 los dos defectos de identidad/revocación (6/12) y la condición de
  carrera del frontend antes de corregirlos. Migración probada de nuevo
  partiendo de la función real de PROD. Consultas de introspección de
  solo lectura ejecutadas de verdad contra QA (`qjqorixtkilwsndqayyx`) —
  **no** el propio script `00_preflight.sql` v1, que nunca llegó a
  ejecutarse en esta ronda (corregido explícitamente en la ronda P05, ver
  abajo): función completamente distinta de la de PROD (modelo relacional
  `empleados`/`locales` vs. `almacen_kv`) — QA queda descartado como
  entorno de validación para este candidato hasta una decisión del
  propietario. Kit de QA (creación/carga/ejecución/limpieza) implementado
  y versionado en `pm33/qa/`, no ejecutado más allá de esas consultas. Detalle
  completo en `pm33/HALLAZGOS_P02.md` sección 9-10.
- PM33 (cuarta ronda, independiente, candidato P05 sobre la misma rama,
  commit `8dbef85`): identidad-antes-que-actividad, 6/6 aserciones nuevas
  en verde (3/6 fallan contra P04 antes de corregir); 7 escenarios de
  frontend (2 nuevos de concurrencia/caché cruzada), 5 ejecuciones
  completas consecutivas en verde de forma determinista; batería completa
  P01-P04 sin regresión. Preflight de QA corregido a hash md5 exacto y
  **ejecutado de verdad** (vía herramienta de ejecución SQL) contra
  `qjqorixtkilwsndqayyx` el 19/09/2026: abortó con el hash real de QA
  (`3064430c63c97f6c50e05ff0117da862`) en el mensaje de error. Kit de QA
  corregido (bug de doble escritura en `almacen_kv`, manifest por
  ejecución, verificación post-carga, limpieza exacta). Entorno aislado
  equivalente al modelo actual de PROD (PostgreSQL 17 + Auth + PostgREST
  reales, GitHub Actions, replicando el patrón ya probado en este
  repositorio para PM12) preparado y versionado en
  `tests/pm33/supabase-full/`. Detalle completo en
  `pm33/HALLAZGOS_P02.md` sección 11.
- PM33 (quinta ronda, validación aislada real, commits `9523131`→`d6ed496`):
  activado el workflow (corregido primero para disparar por `push`
  restringido a esta rama exacta, ya que `workflow_dispatch` por sí solo
  no basta mientras el archivo solo exista en una rama no-default sin
  ejecuciones previas). Primera ejecución real
  (`run 35460961139`, commit `9523131`): 14 PASS/1 FAIL — el fallo era de
  la prueba (exigía un mensaje que nunca puede darse, porque el rechazo
  sin autenticar ocurre a nivel de permiso `EXECUTE`, antes de la
  función), no del candidato; corregida sin conceder `EXECUTE` a
  `anon`/`PUBLIC`. Misma ronda: cerrado un `SOURCE_RECOVERY_DRIFT` nunca
  corregido desde P03 (`fuente-recuperado.js` sin sincronizar en ninguna
  ronda de PM33), añadidas las 9 pruebas de frontend y la comprobación de
  paridad como pasos propios del workflow. Segunda ejecución real
  ([`run 35465771875`](https://github.com/Plopezm1990/Almacen/actions/runs/35465771875),
  commit `d6ed496`): **SUCCESS** — PostgreSQL `17.6.1.167`, PostgREST
  `v16.2`, GoTrue `v2.196.0`; 9/9 frontend, paridad en verde, 15/15
  Auth/PostgREST/RLS reales. Detalle completo en
  `pm33/HALLAZGOS_P02.md` sección 13. **PM33 pasa a validado para
  promoción** — propuesta concreta en
  `pm33/PROPUESTA_PROMOCION.md`.
- GitHub Actions: **actualizado sobre una afirmación anterior de esta
  misma lista** — "0 workflow runs para `f313bc0`... ningún workflow
  dispara por push a las ramas usadas en esta revisión" seguía siendo
  cierto para `f313bc0` (HEAD de `release`, sin tocar) en el momento en
  que se escribió, pero ya no describe el estado actual: esta misma ronda
  añadió intencionadamente un trigger `push` restringido EXCLUSIVAMENTE
  a `claude/pm33-p03-obtener-contexto-operativo` (nunca un comodín, nunca
  a `release` ni `main`) precisamente para poder disparar la validación
  aislada — ver el punto anterior.
- Manifiesto de release: confirmado desactualizado (`9d54fc7`/`0e45bc8d`
  vs HEAD real `f313bc0`).
- Migraciones: 36 en PROD, 63 en QA, comparadas contra `supabase/migrations/`
  de `release` — discrepancias de trazabilidad confirmadas.
- Advisors: Performance PROD (4 FKs sin índice + 5 índices sin uso) y
  Security PROD/QA (17 vs 45 SECURITY DEFINER, `pm29_res` sin RLS en QA,
  leaked password protection deshabilitado) — todos reproducidos hoy.
- Netlify: deploy actual `6aad473` confirmado `ready`/`current`; cabeceras
  HTTP del sitio en vivo comprobadas por `curl` (sin CSP ni cabeceras de
  endurecimiento).
- Dependencias: uso de `xlsx` confirmado como exportación, no parseo;
  recuento de acciones de GitHub fijadas por tag (@v4).

**No repetido en esta sesión** (limitaciones explícitas, no ocultas): los
134 scripts históricos completos, PostgreSQL 17 real (sin Docker operativo
ni paquete disponible en este entorno), Auth/PostgREST/RLS reales,
reconstrucción completa del artefacto de release, matriz completa de
migraciones objeto-por-objeto, ensayo PM25-P02 integral.
