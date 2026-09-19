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

**Estado: P04 preparado y validado localmente (Postgres 16 real), incluida
la migración completa desde el estado real de PROD y el parche de
frontend con control de concurrencia. NO aplicado a Supabase ni a
producción.** Tercera ronda de revisión (independiente): P03 tenía dos
defectos de identidad/autorización propios y el frontend una condición de
carrera, encontrados y corregidos en P04. Esa misma ronda encontró
también que **QA no es hoy un entorno válido para validar este
candidato** (ver más abajo). Detalle completo en
`cierre-proyecto-a/pm33/HALLAZGOS_P02.md` (cubre P01→P02→P03→P04).

- **Problema confirmado hoy, en vivo**: la función vigente en PROD
  (`flqercbgpgmmfaakrwkc`) sigue siendo la de 0 argumentos, sin acotar por
  empresa/local. El defecto R10 sigue activo en producción en este
  momento.
- **Candidato vigente**: misma rama **`claude/pm33-p03-obtener-contexto-operativo`**
  (creada desde `origin/release`, no desde `main`), commit
  **`5dfdbca909f7f33873e1c54fb61eda0085c994e6`** (P04 es un commit
  adicional sobre el de P03, no una rama nueva) — dos commits por delante
  de `release` (`f313bc0`), sin conflicto. Sustituye por completo a P03 y
  P02; la rama original P01 (`claude/pm33-fix-obtener-contexto-operativo`,
  commit `4127782`) sigue intacta, sin tocar.
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
- **Pruebas ejecutadas para P04**: **75/75** aserciones locales en verde,
  Postgres 16.13 real + sandbox `vm` de `fuente.js`, no mocks de texto
  (39 contrato vigente + 7 regresión Camarero/a + 17 aislamiento
  Camarero/a + 12 defectos nuevos de identidad/revocación + 5 escenarios
  de frontend, incluida la condición de carrera). Cero pruebas
  desactivadas o pendientes: T14c, superseded por un cambio de contrato
  deliberado desde P03 (`empresaId` ahora se resuelve para roles no
  gestionados cuando es deducible), se actualizó con justificación y una
  comprobación más estricta (valor exacto) en un archivo de contrato
  vigente separado; el archivo histórico de P01 se conserva sin tocar.
  Cada defecto nuevo se demostró en rojo contra P03 (6/12 y el escenario
  de frontend fallaban) antes de escribir la corrección.
- **Frontend (`fuente.js`, misma rama/commit)**: sin cambios adicionales
  sobre lo descrito para P03 más el control de concurrencia de este
  punto. **No publicado a `release`.**
- **Hallazgo nuevo — QA no es hoy un entorno válido para este candidato.**
  Se pidió explícitamente no asumir que la definición/permisos de QA
  coinciden con los de PROD. No coinciden: ejecuté el preflight de solo
  lectura contra `qjqorixtkilwsndqayyx` el 19/09/2026 y
  `obtener_contexto_operativo()` en QA es una **reimplementación
  completa**, sobre tablas relacionales (`public.empleados`/`locales`) y
  autorización exclusivamente vía membresías, sin ninguna vía heredada
  por `almacen_kv` — no una variante del mismo diseño. Aplicar este
  candidato (pensado para el modelo real de PROD) sobre QA sustituiría
  una implementación ya migrada y más estricta por una más antigua. El
  preflight (`cierre-proyecto-a/pm33/qa/00_preflight.sql`) lo detecta
  automáticamente y **aborta** en vez de dejar que un `apply` posterior lo
  sobrescriba a ciegas — probado tanto en el caso que debe pasar como en
  el que debe abortar, y abortó, correctamente, contra QA real. Coherente
  con la deuda de trazabilidad de migraciones ya registrada más abajo
  (Punto 5): esta es la confirmación concreta, sobre esta función exacta.
- **Entorno comprobado**: local (Postgres 16.13), incluida la transición
  real desde la función hoy vigente en PROD, para P03 y para P04 por
  separado. **NO comprobado**: PostgreSQL 17 real, Auth/PostgREST reales
  — bloqueado para QA por el hallazgo anterior, no por falta de
  herramientas. Kit completo implementado y versionado (no solo descrito)
  en `cierre-proyecto-a/pm33/qa/`: creación de usuarios de prueba reales
  vía Auth Admin API, carga de datos prefijados, batería vía
  `supabase-js` real con `signInWithPassword`, y limpieza — **no
  ejecutados** más allá del preflight (que bloquea seguir contra QA tal
  como está hoy).
- **Pasos restantes**: (1) decisión del propietario sobre el hallazgo de
  QA (¿su modelo relacional es el diseño futuro, o hace falta un entorno
  espejo de PROD para validar este candidato?); (2) identificar/preparar
  el entorno correcto según esa decisión; (3) con su preflight en verde,
  ejecutar el kit de QA (`01`-`04`); (4) decisión del propietario sobre
  publicar el cambio de frontend a `release`; (5) autorización explícita
  para aplicar a PROD. Nada de esto se ha hecho en esta sesión.

---

## 2. Deuda de las 18 pruebas fallidas (de 134)

**Estado: NO reejecutado en esta sesión — pendiente.** El informe de
19/09 ya advierte que es una clasificación histórica sin repetir la
batería completa. Esta revisión tampoco la ha repetido (134 scripts está
fuera del alcance que dio tiempo a cubrir en esta pasada). Se mantiene
como historial de referencia, **no como resultado verificado hoy**.
**Siguiente acción**: ejecutar la batería completa de 134 scripts en un
entorno con las dependencias necesarias (QA), clasificar cada FAIL como
producto / contrato histórico obsoleto / defecto actual / infraestructura,
y documentar los bloqueados o no aplicables. No hacerlo sobre PROD.

---

## 3. Puerta de CI sobre el candidato final

**Estado: bloqueado — confirmado que no existe hoy.**

- Confirmé vía GitHub Actions que **no hay ningún workflow run para el SHA
  actual de `release` (`f313bc0`)**. Los únicos runs en la rama `release`
  corresponden al workflow `pm26-defecto-l-hotfix.yml` sobre commits
  **anteriores** (`2c70df0c`, `a97740987`), no sobre el HEAD actual.
- Cada workflow del repositorio dispara solo con `push` a su propia rama
  nombrada exactamente (p. ej. `branches: [pm13-p03-fichajes]`), nunca con
  comodines. Confirmé que **ninguna rama de esta revisión activa
  automatización alguna** al recibir un push (ni `claude/proyecto-a-la-suite-cierre-3xs7l3`
  ni `claude/pm33-fix-obtener-contexto-operativo` aparecen como branch
  trigger de ningún workflow).
- **Falta diseñar**: un flujo de certificación que corra contra el
  candidato final exacto (no contra ramas históricas) y una regla de
  promoción que lo exija. No se ha diseñado en esta sesión — es una
  decisión de proceso, no un parche puntual.

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
  partiendo de la función real de PROD. Preflight de solo lectura
  ejecutado de verdad contra QA (`qjqorixtkilwsndqayyx`): función
  completamente distinta de la de PROD (modelo relacional
  `empleados`/`locales` vs. `almacen_kv`) — QA queda descartado como
  entorno de validación para este candidato hasta una decisión del
  propietario. Kit de QA (creación/carga/ejecución/limpieza) implementado
  y versionado en `pm33/qa/`, no ejecutado más allá del preflight. Detalle
  completo en `pm33/HALLAZGOS_P02.md` sección 9-10.
- GitHub Actions: 0 workflow runs para `f313bc0` (HEAD de `release`);
  confirmado que ningún workflow dispara por push a las ramas usadas en
  esta revisión.
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
