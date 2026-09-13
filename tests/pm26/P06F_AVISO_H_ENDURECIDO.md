# PM26 P06f — Aviso H: preflight embebido, atomicidad y lock_timeout

## Estado

**Presentado. No autorizado a aplicarse en QA.** Responde a la lista
de endurecimiento exigida por el usuario, ítem por ítem, antes de
volver a solicitar autorización para aplicar el aviso H:

1. Gate obsoleto de PM26 P01 — corregido en un commit aparte
   (`PM26 P01: corrige el gate obsoleto...`), mínimamente: se añadió
   exactamente el archivo QA-only de P06e a la lista de excepciones ya
   existente, sin abrir ninguna excepción genérica para `supabase/**`.
2. Preflight integrado en la misma ejecución que `apply_migration`.
3. Preflight independiente mantenido para las pruebas.
4. `SET LOCAL lock_timeout`/`statement_timeout` añadidos inmediatamente
   después de `BEGIN`, con prueba real de bloqueo concurrente.
5. Comprobación de índices equivalentes con otro nombre, embebida en
   el propio preflight; checklist de asesores justo antes de aplicar.
6. `IF NOT EXISTS` retirado de los cuatro índices: una carrera o
   divergencia posterior al preflight ahora aborta toda la transacción.
7. SHA-256 recalculado; las cuatro pruebas (positiva, negativa,
   reversión, exclusión de producción) repetidas.
8. Este documento, más la confirmación de gates remotos en la
   respuesta de chat que lo acompaña.

---

## 1. Gate de PM26 P01 (ya corregido, aparte)

El HEAD remoto que el usuario señaló (`33e615b`) tenía roto el paso
"Proteger main y esquema" de `pm26-p01-inventario-diagnostico.yml`:
compara todo `supabase/` contra `origin/main` con una lista de
excepciones por archivo concreto, y el archivo QA-only de P06e
(`supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql`) no
estaba en esa lista. Corregido en un commit propio, mínimo: una línea
`grep -v` más, con el mismo patrón exacto ya usado para las 3
migraciones de PM21 — nunca una excepción genérica para todo
`supabase/**`. Verificado en local antes de comprometer; el gate
remoto se confirma en el mismo turno que este documento.

## 2. Preflight integrado en la misma ejecución

Antes: `preflight-catalogo.sql` y la migración eran dos archivos que
se aplicarían en dos llamadas separadas a `apply_migration` — con el
riesgo real que señaló el usuario, que cada llamada especifica su
propio `project_id`, y nada impedía que fueran distintos.

Ahora: el contenido íntegro del preflight (el mismo bloque `DO $$ ...
END $$;`, byte a byte — verificado por `validar.sh`, que extrae ambos
bloques y los compara) vive **al principio** de
`supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql`.
Una sola llamada a `apply_migration`, un solo `project_id`, preflight
y aplicación en la misma transacción.

## 3. Preflight independiente, mantenido

`tests/pm26/p06b-h-aislado/preflight-catalogo.sql` sigue existiendo
tal cual, para poder ejecutarse por separado (comprobación manual antes
de decidir aplicar, o dentro de las pruebas aisladas). `validar.sh`
comprueba en cada ejecución que el bloque embebido en la migración real
coincide byte a byte con este archivo — si algún día divergieran (por
editar uno y no el otro), la prueba lo detecta y falla.

## 4. Atomicidad y límites de tiempo

Todo el archivo —preflight incluido— corre ahora dentro de una única
transacción explícita (`BEGIN;` ... `COMMIT;`). Inmediatamente después
de `BEGIN`, antes incluso de leer el catálogo en el preflight, se fija:

```sql
set local lock_timeout = '5s';
set local statement_timeout = '30s';
```

`SET LOCAL` limita ambos valores a esta transacción: no pueden filtrarse
a ninguna operación posterior de la sesión. Los cuatro `CREATE INDEX`
son deliberadamente estrictos, sin `IF NOT EXISTS`; como el preflight ya
comprueba ausencia por nombre y por cobertura equivalente, cualquier
carrera entre esa lectura y la DDL debe fallar y provocar rollback, no
convertirse en un éxito ambiguo.

**Prueba real, no solo declarada** (`validar.sh`): se abre, en una
sesión de Postgres aparte, una transacción que toma
`LOCK TABLE public.movimientos_stock IN ACCESS EXCLUSIVE MODE` y la
mantiene 8 segundos. Mientras ese lock está activo, se intenta aplicar
la migración completa (que crea primero el índice de
`auditoria_registro`, sin conflicto, y luego intenta el de
`movimientos_stock`, que sí choca con el lock). Resultado observado:

- La migración **falla** (no se queda colgada) en **menos de 7
  segundos** — el mensaje de error real de Postgres es
  `canceling statement due to lock timeout`.
- Gracias al `BEGIN`/`COMMIT` explícito, **ni siquiera el índice de
  `auditoria_registro`** (creado con éxito antes de chocar con el
  lock, dentro de la misma transacción) queda aplicado — se revierte
  entero. Confirmado consultando `pg_indexes` después: 0 de los 4
  índices nuevos, y el preflight independiente vuelve a pasar limpio.

## 5. Índices equivalentes con otro nombre + checklist de asesores

Añadido al preflight (embebido y en el archivo independiente): antes
de comprobar nada más sobre los índices por nombre exacto, se consulta
`pg_index`/`pg_attribute` para descartar que **cualquier** índice
existente, con cualquier nombre, ya cubra esa misma columna como
columna inicial — si lo hiciera, aborta explicando cuál.

`get_advisors` (asesores de Supabase) es una llamada a la API de
gestión, no algo que pueda embeberse dentro de un script SQL. Se deja
como paso explícito, manual, **inmediatamente antes** de invocar
`apply_migration`, no delegado únicamente al preflight SQL:

**Checklist obligatorio justo antes de aplicar (no se ha ejecutado
todavía — se presenta como procedimiento, a la espera de
autorización):**
1. `get_advisors(project_id=QA, type=performance)` — confirmar que los
   4 hallazgos `unindexed_foreign_keys` y las 4 políticas
   `auth_rls_initplan` siguen siendo exactamente esos, sin que nadie
   los haya corregido ya por otra vía desde la última comprobación.
2. Ejecutar `preflight-catalogo.sql` de forma independiente contra el
   `project_id` exacto que se va a usar, y confirmar
   `PREFLIGHT_CATALOGO=PASS`.
3. Confirmar explícitamente, en la propia llamada a `apply_migration`,
   que el `project_id` es el de QA (no copiado de una sesión anterior).
4. Solo entonces, una única llamada a `apply_migration` con el
   contenido íntegro del archivo (preflight embebido incluido).

## 6. SHA-256 recalculado y las 4 pruebas repetidas

Archivo: `supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql`
(198 líneas)

SHA-256: `c4dc61a38cfc58ee588917988e81e3946cb79376e635464e37c5435fe435189d`

`tests/pm26/p06b-h-aislado/validar.sh`, reejecutado de punta a punta
dos veces de forma independiente, mismo resultado ambas veces —
incluye ahora, además de todo lo ya validado en P06b/P06e:

- **Preflight embebido == preflight independiente**, byte a byte.
- **Positiva**: preflight pasa antes de aplicar; migración se aplica
  limpia (preflight embebido incluido); los 4 índices y las 4
  políticas quedan como se espera; comportamiento de permisos
  idéntico antes/después; `InitPlan` confirmado.
- **Negativa — reaplicación rechazada**: reaplicar la migración
  completa inmediatamente después de aplicarla **falla** con
  `PREFLIGHT_FALLO` (ya no es "silenciosamente idempotente": es un
  rechazo explícito y más seguro).
- **Negativa — catálogo distinto**: simulacro de proyecto equivocado,
  con rollback limpio después.
- **Negativa — lock_timeout**: sección 4 de arriba.
- **Reversión**: exacta, revalidada.
- **Exclusión de producción**: `tests/pm26/p06b-h-aislado/prueba-exclusion-cli.sh`
  (CLI real de Supabase contra el repositorio real), sin cambios
  desde P06e, reejecutada y en verde.

## Qué NO se hizo

- No se aplicó la migración en QA.
- No se llamó a `get_advisors` en esta ronda (queda como paso
  explícito del checklist, no ejecutado).
- No se tocó producción, `main`, `release`, Netlify, ni TPV.
- No se mezcló con el aviso F ni con el defecto L.

```
PM26_P06F_PREFLIGHT_EMBEBIDO_EN_MISMA_EJECUCION=SI
PM26_P06F_PREFLIGHT_INDEPENDIENTE_MANTENIDO=SI
PM26_P06F_ATOMICIDAD_BEGIN_COMMIT=SI
PM26_P06F_LOCK_TIMEOUT_CONFIGURADO=SI
PM26_P06F_TIMEOUTS_SET_LOCAL_ANTES_PREFLIGHT=SI
PM26_P06F_LOCK_TIMEOUT_PROBADO_CON_BLOQUEO_REAL=SI
PM26_P06F_STATEMENT_TIMEOUT_CONFIGURADO=SI
PM26_P06F_IF_NOT_EXISTS_RETIRADO=SI
PM26_P06F_INDICE_EQUIVALENTE_OTRO_NOMBRE_COMPROBADO=SI
PM26_P06F_CHECKLIST_ASESORES_PRESENTADO=SI
PM26_P06F_ASESORES_REEJECUTADOS_EN_ESTA_RONDA=NO
PM26_P06F_SHA256_RECALCULADO=SI
PM26_P06F_PRUEBAS_REPETIDAS=SI
PM26_P06F_APLICADO_EN_QA=NO
PM26_P06F_P01_GATE_CORREGIDO=SI
```

Pendiente de que el usuario confirme los gates remotos en verde y
autorice específicamente aplicar esta migración en QA. PM25 P02
continúa PARCIAL/BLOQUEADO. Defecto E sigue esperando el cambio manual
del usuario en Netlify. No se toca `main`, `release`, Netlify, Supabase
en escritura, QA, producción ni TPV.
