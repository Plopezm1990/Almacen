# PM26 P06b — Aviso H: migración preparada y validada en aislamiento

## Estado

**Migración preparada en el repositorio y validada de punta a punta en
un Postgres local aislado (nunca contra QA). No aplicada en QA.**
Autorización recibida: *"Autorizo únicamente preparar P06b-H en el
repositorio y validarlo completamente en un Supabase/PostgreSQL
aislado. No autorizo todavía aplicarlo en QA."* Se cumplen las 8
condiciones dadas.

**Actualización (PM26 P06e)**: tras una condición posterior del
usuario (que la migración no pueda entrar por accidente en la cadena
de producción), el archivo se **relocalizó** de
`supabase/migrations/20260909200730_pm26_p06b_rendimiento_indices_rls_initplan.sql`
a `supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql`,
con una cabecera nueva explicando el aislamiento — el hash cambió en
consecuencia. El SQL funcional (los 4 índices y las 4 políticas) no
cambió. Ver `P06E_AVISO_H_AISLAMIENTO_QA_SOLO.md` para la ubicación,
el hash y las pruebas vigentes; las secciones de más abajo describen
correctamente el estado en el momento en que se escribieron, con la
ruta y el hash de entonces.

---

## 1. Creación mediante `supabase migration new`

Se instaló la CLI de Supabase (`npm install -g supabase`, versión
2.117.0) y se ejecutó `supabase migration new
pm26_p06b_rendimiento_indices_rls_initplan` dentro de
`/home/user/Almacen`. La CLI generó el nombre y el timestamp reales
(no inventados a mano):

```
supabase/migrations/20260909200730_pm26_p06b_rendimiento_indices_rls_initplan.sql
```

## 2. Columnas exactas de las 4 FK e índices existentes

Confirmado con `get_advisors(type=performance)` contra QA (nombre de
cada restricción y columna exacta) y con `pg_indexes` contra QA (para
comprobar que ningún índice existente las cubre ya como columna
inicial):

| Tabla | FK | Columna | ¿Cubierta por algún índice existente? |
|---|---|---|---|
| `auditoria_registro` | `auditoria_registro_actor_user_id_fkey` | `actor_user_id` | No (`auditoria_empresa_local_idx` empieza por `empresa_id`; el PK es `id`) |
| `movimientos_stock` | `movimientos_stock_operation_id_fkey` | `operation_id` | No (`pm07_mov_stock_scope` empieza por `empresa_id`; `pm07_un_reverso_por_movimiento` empieza por `movimiento_original_id`; el PK es `id`) |
| `pagos_encargo` | `pagos_encargo_revierte_pago_id_fkey` | `revierte_pago_id` | No (`pagos_encargo_por_encargo` empieza por `encargo_id`; el PK es `id`; `operation_id_key` es sobre `operation_id`) |
| `suscripciones_push` | `suscripciones_push_user_id_fkey` | `user_id` | No (único índice existente es el PK sobre `endpoint`) |

## 3. Los cuatro índices, con nombres deterministas

```sql
create index if not exists idx_auditoria_registro_actor_user_id
  on public.auditoria_registro (actor_user_id);

create index if not exists idx_movimientos_stock_operation_id
  on public.movimientos_stock (operation_id);

create index if not exists idx_pagos_encargo_revierte_pago_id
  on public.pagos_encargo (revierte_pago_id);

create index if not exists idx_suscripciones_push_user_id
  on public.suscripciones_push (user_id);
```

Patrón de nombre: `idx_<tabla>_<columna>`, sin abreviar, sin colisión
con ningún índice existente.

## 4. Las 4 políticas: único cambio permitido

Se usó `ALTER POLICY ... USING (...) [WITH CHECK (...)]`, que no
permite tocar tabla, comando (`SELECT`/`UPDATE`/`ALL`) ni roles salvo
que se especifiquen expresamente — no se especificaron, así que
quedan intactos. El único texto que cambia es `auth.uid()` →
`(select auth.uid())`. `private.la_usuario_activo()`, presente en
`membresia_propia_select`, **no se toca** — no es una llamada
`auth.<función>()` y el usuario limitó el cambio permitido
exactamente a esas llamadas.

Verificado contra QA, tabla por tabla, que `qual`/`with_check` no
cambian en ningún otro aspecto (mismo texto salvo el envoltorio
`(select ...)`), y reproducido en el Postgres aislado (ver sección 6).

## 5. Migración completa

Archivo: `supabase/migrations/20260909200730_pm26_p06b_rendimiento_indices_rls_initplan.sql`

SHA-256: `01ea795fe6b6c0bdc93e2599e3014c450c94c95d989057c58c9ccdbfd5db6e22`

(45 líneas — los 4 `create index if not exists` de la sección 3 más
los 4 `alter policy` de la sección 4, con comentario de cabecera.)

## 6. Validación en Postgres aislado — qué se reprodujo y qué demostró

Entorno: PostgreSQL 16 instalado localmente en este contenedor
(`apt-get install postgresql`), **sin ninguna relación con Supabase ni
con ningún proyecto real** — una base de datos nueva, descartada al
terminar. Nunca se tocó QA para esta validación.

Artefactos committeados en `tests/pm26/p06b-h-aislado/`:
- `schema.sql`: reproduce el subconjunto exacto de columnas, PK, FKs,
  `RLS` y las 4 políticas **byte a byte como están hoy en QA**, más una
  copia literal de `private.la_usuario_activo()` (no se modifica, solo
  se reproduce porque una de las políticas depende de ella), y un
  `auth.uid()` simulado mediante una variable de sesión (para poder
  cambiar de identidad dentro de la misma conexión de prueba, de forma
  null-safe como el real).
- `seed.sql`: 3 usuarios (2 con membresía activa en empresas distintas,
  1 con perfil inactivo), datos mínimos para las 4 tablas de índices.
- `comportamiento.sql`: 13 comprobaciones de permisos, positivas y
  negativas, incluida separación entre empresas (`P10`) y el caso de
  perfil inactivo (`P12`).
- `revertir.sql`: reversión exacta (elimina los 4 índices, devuelve las
  4 políticas a `auth.uid()` sin envolver).
- `validar.sh`: orquesta todo lo anterior de punta a punta y es lo que
  ejecuta el contrato de este paquete — no hay ningún paso manual sin
  reproducir por script.

**Resultado de `validar.sh`** (ejecutado dos veces de forma
independiente en esta ronda, mismo resultado ambas veces):

- `PM26_P06B_H_AISLADO_SCHEMA=PASS` / `..._SEED=PASS`: reproducción
  aplicada sin error.
- `..._BATERIA_ANTES=PASS`: las 13 comprobaciones de permisos, en el
  estado anterior a la migración, dan el resultado esperado (positivas
  en 1, negativas en 0 filas).
- `..._INDICES_AUSENTES_ANTES=PASS`: los 4 índices nuevos no existen
  todavía.
- `..._MIGRACION_APLICADA=PASS`: la migración real (el mismo archivo
  que se aplicaría en QA) se aplica sin error.
- `..._PERMISOS_IDENTICOS_ANTES_DESPUES=PASS`: **la salida completa de
  las 13 comprobaciones es byte a byte idéntica antes y después** —
  `diff` sin ninguna diferencia. Ninguna garantía de acceso cambió.
- `..._SOLO_4_INDICES_NUEVOS_NINGUNO_ELIMINADO=PASS`: el recuento total
  de índices en el esquema sube exactamente en 4; ninguno de los
  existentes desaparece.
- `..._INITPLAN_CONFIRMADO=PASS`: forzando un *seq scan* sobre
  `perfiles`, el plan pasa de `Filter: (user_id = auth.uid())`
  (evaluado por fila) a `Filter: (user_id = $0)` con un `InitPlan`
  aparte que calcula `auth.uid()` una sola vez — la mejora que
  describe el asesor de Supabase, confirmada estructuralmente, no solo
  afirmada.
- `..._REVERSION_EXACTA=PASS`: aplicando `revertir.sql`, los 4 índices
  desaparecen y la batería de 13 comprobaciones vuelve a coincidir
  byte a byte con el estado original.
- `..._REPETICION_CONTROLADA_IDEMPOTENTE=PASS`: reaplicar la migración
  una segunda vez (ya aplicada) no falla — `CREATE INDEX IF NOT
  EXISTS` emite un aviso y no hace nada; `ALTER POLICY` con el mismo
  texto es una operación segura de repetir.
- `..._BLOQUEO_SHARELOCK_CONFIRMADO=PASS`: `CREATE INDEX` (sin
  `CONCURRENTLY`) toma `ShareLock` sobre la tabla — bloquea escrituras
  mientras se construye el índice, permite lecturas. Dado el volumen
  de QA (0 a unas pocas filas en las 4 tablas), la duración de ese
  bloqueo es del orden de milisegundos.
- `..._VALIDACION_COMPLETA=PASS`.

## 7. Los 8 índices "sin uso" — no se tocan

Ninguno de los 8 índices marcados `unused_index` por el asesor
(`pm08_arqueos_scope_fecha`, `pm08_arqueos_anulaciones_scope`,
`pm08_devoluciones_venta_scope`, `pm08_devoluciones_proveedor_scope`,
`auditoria_empresa_local_idx`, `albaranes_empresa_scope_idx`,
`gastos_empresa_scope_idx`, `pagos_encargo_por_encargo`) aparece en la
migración. `validar.sh` lo comprueba estructuralmente (el recuento
total de índices solo sube en 4).

## 8. Riesgos y reversión

**Riesgos de aplicar esto en QA** (todavía no autorizado):
- Ninguno funcional: la batería de 13 comprobaciones demuestra
  permisos idénticos antes/después, en un esquema reproducido byte a
  byte del real.
- Bloqueo `ShareLock` de duración mínima (tablas con 0 a pocas filas en
  QA) durante la creación de cada índice — no debería ser perceptible.
- Espacio en disco adicional, mínimo, por los 4 índices nuevos.

**Reversión**: `tests/pm26/p06b-h-aislado/revertir.sql` contiene la
reversión exacta y ya fue validada de punta a punta (sección 6) —
elimina los 4 índices y devuelve las 4 políticas a su texto original.

## Qué NO se hizo

- No se aplicó la migración en QA, ni en ningún proyecto Supabase real.
- No se tocó producción ni TPV.
- No se mezcló el aviso F en esta migración.
- No se eliminó ningún índice existente.
- No se cambió ningún otro aspecto de las 4 políticas más allá de
  envolver `auth.uid()`.

```
PM26_P06B_AVISO_H_MIGRACION_CREADA=SI
PM26_P06B_AVISO_H_MIGRACION_APLICADA_EN_QA=NO
PM26_P06B_AVISO_H_VALIDADA_EN_AISLAMIENTO=SI
PM26_P06B_AVISO_H_PERMISOS_IDENTICOS_ANTES_DESPUES=SI
PM26_P06B_AVISO_H_REVERSION_VALIDADA=SI
PM26_P06B_AVISO_H_INDICES_SIN_USO_TOCADOS=NO
PM26_P06B_AVISO_F_MEZCLADO=NO
```

Pendiente de autorización específica para aplicar esta migración
concreta en QA.
