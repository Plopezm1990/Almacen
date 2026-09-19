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

**Estado: preparado y validado localmente (Postgres 16 real). NO aplicado.
Regresión encontrada en el candidato original y corregida en un nuevo
candidato P02, también validado localmente.**

- **Problema confirmado hoy, en vivo**: consulté `pg_get_functiondef` contra
  PROD (`flqercbgpgmmfaakrwkc`) el 19/09/2026 — la función vigente sigue
  siendo la versión de 0 argumentos, sin acotar por empresa/local. El
  defecto R10 sigue activo en producción en este momento.
- **Candidato original**: rama `claude/pm33-fix-obtener-contexto-operativo`,
  commit `4127782b3feb2977e0570548904ca5e4f6523937`. Confirmado: 1 commit
  por delante de `release` (`f313bc0`), sin conflicto (`git merge-base` =
  `f313bc0`). Reproduje su batería (14 escenarios / 38 aserciones) de forma
  independiente contra Postgres 16.13 real: **38/38 PASS**, igual que
  reporta su propio commit.
- **Hallazgo nuevo de esta revisión**: el candidato original vacía
  `empleado`/`empleadosFichaje` para cualquier rol fuera de
  `Encargado/Cajero/a/Churrero/a` (hoy, `Camarero/a` es el caso real) —
  contradice la propia afirmación de su documento ("cubierto por T14").
  Reproducido con Postgres real: el mismo usuario de T14 pasa de recibir su
  propio registro de empleado (función vigente en PROD) a recibir `null`
  con el candidato original. Rompe `fichajesDelPropioEmpleado` en
  `fuente.js` para ese rol.
- **Corrección preparada**: `cierre-proyecto-a/pm33/candidato_p02_obtener_contexto_operativo.sql`.
  Detalle completo, evidencia rojo/verde y pruebas en
  `cierre-proyecto-a/pm33/HALLAZGOS_P02.md`.
- **Pruebas ejecutadas**: 45/45 aserciones locales (38 del contrato
  original + 7 nuevas), Postgres 16.13 real, no mocks. Además, verificación
  de solo lectura contra PROD que el propio autor había dejado pendiente:
  **0 empleados activos con `empleado_id` ambiguo entre locales hoy** — el
  riesgo de "contexto ambiguo" al aplicar el bloque obligatorio queda
  acotado con evidencia actual.
- **Entorno comprobado**: local (Postgres 16.13, contenedor de esta
  sesión). **NO comprobado**: PostgreSQL 17 (versión real de PROD/QA —
  sin Docker operativo ni paquete disponible en este entorno), Auth/JWT/
  PostgREST reales, RLS real (la función es `SECURITY DEFINER` y no
  depende de RLS de las tablas que lee, lo que reduce el gap pero no lo
  cierra), compatibilidad multi-local del frontend (`fuente.js` invoca sin
  `p_local_id`; hoy ningún usuario real de PROD tiene membresía
  multi-local, pero el candidato rechazaría a uno que la tuviera y el
  frontend no sabe reintentar con `p_local_id` — **decisión de producto
  pendiente, no tomada aquí**).
- **Pasos restantes**: (1) decisión del propietario sobre el gap
  multi-local; (2) aplicar y repetir la batería en QA (PostgreSQL 17 real)
  + una prueba de humo con Auth real; (3) autorización explícita para
  aplicar a PROD. Nada de esto se ha hecho en esta sesión.

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
- PM33: 45/45 aserciones Postgres 16.13 real (ver sección 1 y
  `pm33/HALLAZGOS_P02.md`). Verificación de solo lectura contra PROD
  (0 empleados con `empleado_id` ambiguo entre locales).
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
