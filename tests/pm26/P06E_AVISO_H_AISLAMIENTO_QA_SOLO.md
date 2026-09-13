# PM26 P06e — Aviso H: aislamiento de la migración fuera de la cadena de producción

## Estado

**Presentado. No autorizado a aplicarse en QA.** Responde a la
condición del usuario: antes de aplicar nada, demostrar cómo se evita
que la migración del aviso H entre en la cadena de producción, o
convertirla en canónica para todos los entornos. Dado que las
políticas `qa_*` que toca esta migración **solo existen en QA** —
confirmado en `P06D_AVISO_F_PRODUCCION_SOLO_LECTURA.md`, producción
tiene un diseño distinto para la tabla que sí se investigó allí, y no
se ha investigado si producción tiene equivalentes con otro nombre
para `perfiles`/`suscripciones_push`/`membresias_usuario` — se sigue
la opción preferida del usuario: aislar la migración con un mecanismo
específico de QA, fuera de `supabase/migrations`.

**Actualización (PM26 P06f)**: el usuario pidió endurecer más el
mecanismo — preflight embebido en la misma ejecución (no dos llamadas
separadas), `lock_timeout`/`statement_timeout`, comprobación de
índices equivalentes con otro nombre, y una prueba real de bloqueo
concurrente. El archivo cambió de contenido (mismo SQL funcional, más
las nuevas protecciones) y su hash cambió en consecuencia. Ver
`P06F_AVISO_H_ENDURECIDO.md` para el hash y las pruebas vigentes; las
secciones de más abajo describen correctamente el estado en el momento
en que se escribieron.

---

## 1. Ubicación y mecanismo exactos

**Ubicación**: `supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql`
— un directorio nuevo, hermano de `supabase/migrations/`, con nombre
deliberadamente distinto a `migrations` para que ninguna herramienta
que busque ese nombre convencional lo encuentre.

**Mecanismo de aplicación, el único sancionado**: leer el archivo y
pasarlo a la herramienta `apply_migration` de Supabase (MCP),
invocada manualmente con el `project_id` de QA explícito en esa
llamada concreta, tras autorización específica del usuario para esta
migración exacta — igual que todas las migraciones QA anteriores de
este proyecto (PM20 P06, etc.). **Nunca** mediante `supabase db
push`/`migration up`/cualquier flujo que descubra migraciones por
convención de carpeta.

El propio archivo lleva ahora, en su cabecera, la advertencia y la
razón (`supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql`,
líneas 10–23).

## 2. Prueba de que queda excluida de producción — real, no solo afirmada

Dos pruebas reproducibles, ambas ejecutadas en esta ronda:

**a) Estructural**: `git diff`/inspección directa confirma que el
archivo no existe bajo `supabase/migrations/` — solo bajo
`supabase/qa-solo/`.

**b) Con la CLI real de Supabase, contra el repositorio real**
(`tests/pm26/p06b-h-aislado/prueba-exclusion-cli.sh`): se instaló la
CLI (`npm install -g supabase`, ya usada en P06b), y se ejecutó
`supabase migration list --db-url <Postgres local aislado y
desechable>` con `--workdir` apuntando a este mismo repositorio.
Resultado:

- La migración QA-only **no aparece** en la lista que la CLI descubre
  — confirmado por grep sobre la salida real del comando.
- **Control positivo**: la misma ejecución sí reporta migraciones
  reales de `supabase/migrations/` (con su timestamp de 14 dígitos) —
  descarta que "no aparece nada" fuera un fallo silencioso del comando
  o una base de datos sospechosamente vacía.

Esto no es una afirmación sobre cómo se comporta la CLI — es la CLI
real, ejecutándose contra el repositorio real, demostrándolo. Se
verificó además con `supabase db push --dry-run` en una carpeta de
prueba aislada (no en el repo, para no arriesgar nada): un archivo
fuera de `supabase/migrations` nunca aparece en "Would push these
migrations", solo el que sí está dentro.

**c) No existe ninguna cadena de CI/CD que aplique migraciones a
producción de todos modos.** Se revisaron los 194 workflows del
repositorio: ninguno ejecuta `supabase db push`, `migration up`, ni
contiene el project ref de producción salvo en los patrones `grep` ya
registrados como deuda en PM26 P02 (defecto J, cerrado, no relacionado
con este punto) o en las pruebas de aislamiento QA/producción de
`pm02-cerrar-backend-qa.yml` (que verifican, correctamente, que las
llamadas a producción quedan bloqueadas en QA). No hay ningún
mecanismo automático hoy que pudiera aplicar esta migración a
producción aunque estuviera en `supabase/migrations` — la protección
por ubicación es una defensa adicional para el futuro, no la corrección
de un riesgo activo hoy.

## 3. Preflight de catálogo

Nuevo: `tests/pm26/p06b-h-aislado/preflight-catalogo.sql`. Antes de
aplicar la migración contra cualquier proyecto, comprueba (solo
lectura, sin modificar nada):

1. Existen exactamente las 4 políticas objetivo
   (`qa_perfil_propio_select`, `qa_perfil_propio_update`,
   `qa_push_propio`, `membresia_propia_select`) — **si no existen,
   aborta**, y esto cubre tanto "esto no es QA" (producción no tiene
   ninguna con estos nombres, confirmado en P06d) como cualquier otro
   proyecto que no sea este QA.
2. El texto exacto de cada política coincide con el estado **anterior**
   a la migración (sin optimizar) — si ya está optimizado, aborta
   (evita reaplicar a ciegas sobre un estado que ya cambió por otra
   vía).
3. Ninguno de los 4 índices nuevos existe todavía.
4. Las 4 columnas exactas que se van a indexar existen en las tablas
   esperadas.

Se ejecuta con `DO $$ ... RAISE EXCEPTION ... $$;` — un fallo aborta
con un mensaje real, no con un código de salida silencioso.

## 4. Definiciones exactas de índices y políticas

Sin cambios respecto a `P06B_AVISO_H_VALIDACION_AISLADA.md` — mismos 4
`CREATE INDEX IF NOT EXISTS`, mismos 4 `ALTER POLICY` envolviendo
únicamente `auth.uid()` en `(select auth.uid())`. No se repiten aquí;
siguen vigentes.

## 5. Pruebas positivas y negativas (ampliadas en esta ronda)

`tests/pm26/p06b-h-aislado/validar.sh`, reejecutado de punta a punta
con las nuevas comprobaciones, dos veces de forma independiente, mismo
resultado ambas veces:

- Todo lo ya validado en P06b (13 comprobaciones de permisos,
  reversión exacta, idempotencia, `ShareLock`, `InitPlan`) — sigue
  pasando igual, sin cambios de comportamiento.
- **Nuevo — preflight positivo**: sobre el estado real anterior a la
  migración, pasa limpio (`PREFLIGHT_CATALOGO=PASS`).
- **Nuevo — preflight negativo, catálogo distinto**: se altera
  deliberadamente el texto de una política dentro de una transacción
  que se revierte (simulacro de "proyecto equivocado") — el preflight
  aborta con `PREFLIGHT_FALLO`, y tras el `ROLLBACK` el preflight
  positivo vuelve a pasar limpio (el simulacro no dejó rastro).
- **Nuevo — preflight negativo, ya aplicado**: tras aplicar la
  migración real, el preflight (que exige el texto sin optimizar)
  falla correctamente — detecta también ese caso, no solo el de
  proyecto equivocado.
- **Nuevo — preflight tras revertir**: vuelve a pasar limpio.

## 6. Reversión

Sin cambios respecto a P06b: `tests/pm26/p06b-h-aislado/revertir.sql`,
re-validada en esta misma ronda como parte de `validar.sh`.

## 7. Archivo final y SHA-256

Archivo: `supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql`
(60 líneas — el SQL funcional no cambió respecto a P06b; se añadió
únicamente la cabecera que explica el aislamiento).

SHA-256: `0409ea7d13d7f8cdd88fa37b4c34e739864d8f85a9f4971a15ee5d399d71c84e`

## Qué NO se hizo

- No se aplicó la migración en QA ni en ningún proyecto real.
- No se tocó `supabase/migrations/` salvo para retirar de ahí el
  archivo que nunca debió quedarse ahí desde el principio.
- No se tocó producción, `main`, `release`, Netlify, ni TPV.
- No se decidió nada sobre el aviso F ni se mezcló con este punto.

```
PM26_P06E_UBICACION=SUPABASE_QA_SOLO
PM26_P06E_FUERA_DE_SUPABASE_MIGRATIONS=SI
PM26_P06E_PRUEBA_CLI_REAL_EJECUTADA=SI
PM26_P06E_CLI_NO_VE_LA_MIGRACION=SI
PM26_P06E_CONTROL_POSITIVO_CLI_VE_MIGRACIONES_REALES=SI
PM26_P06E_CICD_APLICA_A_PRODUCCION_HOY=NO
PM26_P06E_PREFLIGHT_CATALOGO_CREADO=SI
PM26_P06E_PREFLIGHT_POSITIVO_VALIDADO=SI
PM26_P06E_PREFLIGHT_NEGATIVO_CATALOGO_DISTINTO_VALIDADO=SI
PM26_P06E_PREFLIGHT_NEGATIVO_YA_APLICADO_VALIDADO=SI
PM26_P06E_APLICADO_EN_QA=NO
```

Pendiente de autorización específica para aplicar esta migración
concreta en QA. PM25 P02 continúa PARCIAL/BLOQUEADO. No se toca `main`,
`release`, Netlify, Supabase en escritura, QA, producción ni TPV.
