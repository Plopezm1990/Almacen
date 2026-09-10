#!/usr/bin/env bash
# PM26 P06b-H -- valida de punta a punta, en un Postgres local aislado
# (nunca contra QA ni produccion), la migracion QA-only
# supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql y su
# preflight de catalogo (preflight-catalogo.sql).
#
# Requiere un servidor Postgres local en marcha (rol "postgres"
# accesible via `sudo -u postgres psql`, o POSTGRES_PSQL/POSTGRES_SUDO
# ajustados). No crea ni depende de ningun proyecto Supabase.
#
# Los archivos .sql se pasan siempre por stdin (nunca con -f <ruta>):
# el usuario "postgres" no puede atravesar el directorio de checkout
# en runners como GitHub Actions (permisos del directorio del
# checkout), aunque sí puede leer lo que se le pasa por stdin.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DIR/../../.." && pwd)"
MIGRACION="$REPO_ROOT/supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql"
PREFLIGHT="$DIR/preflight-catalogo.sql"
DB="pm26_p06b_h_aislado_$$"
PSQL="${POSTGRES_PSQL:-psql}"
RUN_AS_POSTGRES="${POSTGRES_SUDO:-sudo -u postgres}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"; $RUN_AS_POSTGRES $PSQL -c "drop database if exists \"$DB\";" >/dev/null 2>&1 || true' EXIT

fallo() { echo "PM26_P06B_H_AISLADO_FALLO: $1" >&2; exit 1; }

# Aplica un archivo .sql por stdin contra "$DB", con ON_ERROR_STOP=1.
psql_archivo() {
  local archivo="$1" db="$2"
  cat "$archivo" | $RUN_AS_POSTGRES $PSQL -d "$db" -v ON_ERROR_STOP=1
}

[ -f "$MIGRACION" ] || fallo "no se encuentra la migracion en $MIGRACION"
[ -f "$PREFLIGHT" ] || fallo "no se encuentra el preflight en $PREFLIGHT"

# La migracion NO debe vivir bajo supabase/migrations -- si algun día
# volviera a aparecer ahí, la CLI de Supabase (migration list/db push)
# la trataría como una migración normal aplicable a cualquier proyecto,
# incluida producción. Se comprueba aquí, no solo se afirma.
if [ -f "$REPO_ROOT/supabase/migrations/$(basename "$MIGRACION")" ]; then
  fallo "la migracion QA-only tambien existe dentro de supabase/migrations -- debe vivir SOLO en supabase/qa-solo"
fi
echo "PM26_P06B_H_AISLADO_FUERA_DE_SUPABASE_MIGRATIONS=PASS"

$RUN_AS_POSTGRES $PSQL -c "drop database if exists \"$DB\";" >/dev/null
$RUN_AS_POSTGRES $PSQL -c "create database \"$DB\";" >/dev/null
$RUN_AS_POSTGRES $PSQL -c "drop role if exists service_role;" >/dev/null
echo "create role service_role; grant all on all tables in schema public to service_role;" \
  | $RUN_AS_POSTGRES $PSQL -d "$DB" -v ON_ERROR_STOP=1 >/dev/null

psql_archivo "$DIR/schema.sql" "$DB" >/dev/null \
  || fallo "no se pudo aplicar schema.sql"
echo "PM26_P06B_H_AISLADO_SCHEMA=PASS"

psql_archivo "$DIR/seed.sql" "$DB" >/dev/null \
  || fallo "no se pudo aplicar seed.sql"
echo "PM26_P06B_H_AISLADO_SEED=PASS"

# --- Preflight, positivo: sobre el estado real anterior a la
# migracion, debe pasar limpio. ---
PREFLIGHT_SALIDA="$(psql_archivo "$PREFLIGHT" "$DB" 2>&1)" \
  || { echo "$PREFLIGHT_SALIDA" >&2; fallo "el preflight de catalogo debia pasar antes de aplicar la migracion y no paso"; }
echo "$PREFLIGHT_SALIDA" | grep -q "PREFLIGHT_CATALOGO=PASS" \
  || fallo "el preflight no emitio PREFLIGHT_CATALOGO=PASS"
echo "PM26_P06B_H_AISLADO_PREFLIGHT_POSITIVO=PASS"

# --- Preflight, negativo 1: simular "esto no es QA" alterando el
# texto de una politica qa_* dentro de una transaccion que se revierte
# -- el preflight debe abortar, y el estado debe quedar intacto. El
# contenido del preflight se concatena en bash (nunca \i <ruta>, que
# tendria el mismo problema de permisos que -f <ruta> en CI). ---
PREFLIGHT_NEG1="$( { echo "begin;"; echo "alter policy qa_perfil_propio_select on public.perfiles using (user_id = auth.uid() and true);"; cat "$PREFLIGHT"; echo "rollback;"; } | $RUN_AS_POSTGRES $PSQL -d "$DB" 2>&1 || true )"
echo "$PREFLIGHT_NEG1" | grep -q "PREFLIGHT_FALLO" \
  || fallo "el preflight debia fallar cuando el catalogo no coincide con QA (simulacro de proyecto equivocado) y no fallo"
echo "PM26_P06B_H_AISLADO_PREFLIGHT_NEGATIVO_CATALOGO_DISTINTO=PASS"

# Confirma que el rollback anterior dejo todo exactamente igual (el
# preflight positivo vuelve a pasar).
psql_archivo "$PREFLIGHT" "$DB" 2>&1 | grep -q "PREFLIGHT_CATALOGO=PASS" \
  || fallo "tras el rollback del simulacro negativo, el preflight positivo deberia volver a pasar"
echo "PM26_P06B_H_AISLADO_PREFLIGHT_ROLLBACK_SIMULACRO_LIMPIO=PASS"

psql_archivo "$DIR/comportamiento.sql" "$DB" > "$WORKDIR/antes.txt" 2>&1 \
  || { cat "$WORKDIR/antes.txt" >&2; fallo "bateria de comportamiento ANTES fallo"; }

grep -q '^P13' "$WORKDIR/antes.txt" || fallo "la bateria ANTES no llego hasta P13 -- salida incompleta"
echo "PM26_P06B_H_AISLADO_BATERIA_ANTES=PASS"

# Indices no deben existir todavia
ANTES_IDX="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from pg_indexes where schemaname='public' and indexname in ('idx_auditoria_registro_actor_user_id','idx_movimientos_stock_operation_id','idx_pagos_encargo_revierte_pago_id','idx_suscripciones_push_user_id');")"
[ "$ANTES_IDX" = "0" ] || fallo "los 4 indices ya existian antes de aplicar la migracion (esperado 0, encontrado $ANTES_IDX)"
echo "PM26_P06B_H_AISLADO_INDICES_AUSENTES_ANTES=PASS"

TOTAL_IDX_ANTES="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from pg_indexes where schemaname='public';")"

# --- Aplicar la migracion real ---
psql_archivo "$MIGRACION" "$DB" >/dev/null \
  || fallo "la migracion no se aplico limpiamente"
echo "PM26_P06B_H_AISLADO_MIGRACION_APLICADA=PASS"

# --- Preflight, negativo 2: tras aplicar, el preflight (que exige el
# texto SIN optimizar) debe fallar -- prueba de que detecta también el
# caso "esto ya se aplico", no solo "esto no es QA". ---
PREFLIGHT_NEG2="$(psql_archivo "$PREFLIGHT" "$DB" 2>&1 || true)"
echo "$PREFLIGHT_NEG2" | grep -q "PREFLIGHT_FALLO" \
  || fallo "el preflight debia fallar tras aplicar la migracion (politicas ya optimizadas) y no fallo"
echo "PM26_P06B_H_AISLADO_PREFLIGHT_NEGATIVO_YA_APLICADO=PASS"

psql_archivo "$DIR/comportamiento.sql" "$DB" > "$WORKDIR/despues.txt" 2>&1 \
  || { cat "$WORKDIR/despues.txt" >&2; fallo "bateria de comportamiento DESPUES fallo"; }

if ! diff -q "$WORKDIR/antes.txt" "$WORKDIR/despues.txt" >/dev/null; then
  diff "$WORKDIR/antes.txt" "$WORKDIR/despues.txt" >&2 || true
  fallo "el comportamiento de permisos cambio tras la migracion -- deberia ser identico"
fi
echo "PM26_P06B_H_AISLADO_PERMISOS_IDENTICOS_ANTES_DESPUES=PASS"

DESPUES_IDX="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from pg_indexes where schemaname='public' and indexname in ('idx_auditoria_registro_actor_user_id','idx_movimientos_stock_operation_id','idx_pagos_encargo_revierte_pago_id','idx_suscripciones_push_user_id');")"
[ "$DESPUES_IDX" = "4" ] || fallo "esperados 4 indices nuevos tras la migracion, encontrado $DESPUES_IDX"

TOTAL_IDX_DESPUES="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from pg_indexes where schemaname='public';")"
[ "$TOTAL_IDX_DESPUES" -eq "$((TOTAL_IDX_ANTES + 4))" ] || fallo "el numero total de indices cambio en mas de 4 -- se pudo haber eliminado alguno existente (antes=$TOTAL_IDX_ANTES, despues=$TOTAL_IDX_DESPUES)"
echo "PM26_P06B_H_AISLADO_SOLO_4_INDICES_NUEVOS_NINGUNO_ELIMINADO=PASS"

# InitPlan: auth.uid() debe evaluarse una sola vez, no por fila
PLAN="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "set role authenticated; set app.current_uid = '11111111-1111-1111-1111-111111111111'; set enable_indexscan=off; set enable_bitmapscan=off; explain (costs off, format text) select * from public.perfiles;")"
echo "$PLAN" | grep -qi "InitPlan" || fallo "el plan de perfiles no muestra InitPlan tras la migracion -- auth.uid() puede seguir evaluandose por fila"
echo "PM26_P06B_H_AISLADO_INITPLAN_CONFIRMADO=PASS"

# --- Reversion exacta ---
psql_archivo "$DIR/revertir.sql" "$DB" >/dev/null \
  || fallo "la reversion no se aplico limpiamente"

REVERTIDO_IDX="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from pg_indexes where schemaname='public' and indexname in ('idx_auditoria_registro_actor_user_id','idx_movimientos_stock_operation_id','idx_pagos_encargo_revierte_pago_id','idx_suscripciones_push_user_id');")"
[ "$REVERTIDO_IDX" = "0" ] || fallo "tras revertir deberian quedar 0 de los 4 indices, encontrado $REVERTIDO_IDX"

psql_archivo "$DIR/comportamiento.sql" "$DB" > "$WORKDIR/revertido.txt" 2>&1 \
  || { cat "$WORKDIR/revertido.txt" >&2; fallo "bateria de comportamiento tras REVERTIR fallo"; }

diff -q "$WORKDIR/antes.txt" "$WORKDIR/revertido.txt" >/dev/null \
  || fallo "tras revertir, el comportamiento no coincide exactamente con el estado original"
echo "PM26_P06B_H_AISLADO_REVERSION_EXACTA=PASS"

# El preflight vuelve a pasar tras revertir -- confirma que la
# reversion deja el catalogo exactamente como el preflight lo exige.
psql_archivo "$PREFLIGHT" "$DB" 2>&1 | grep -q "PREFLIGHT_CATALOGO=PASS" \
  || fallo "tras revertir, el preflight positivo deberia volver a pasar"
echo "PM26_P06B_H_AISLADO_PREFLIGHT_PASA_TRAS_REVERTIR=PASS"

# --- Repeticion controlada / idempotencia: reaplicar dos veces mas ---
psql_archivo "$MIGRACION" "$DB" >/dev/null \
  || fallo "no se pudo reaplicar la migracion tras revertir"
psql_archivo "$MIGRACION" "$DB" >/dev/null \
  || fallo "reaplicar la migracion una segunda vez (ya aplicada) no debe fallar"
echo "PM26_P06B_H_AISLADO_REPETICION_CONTROLADA_IDEMPOTENTE=PASS"

# --- Bloqueo: CREATE INDEX plano toma ShareLock, no ACCESS EXCLUSIVE ---
$RUN_AS_POSTGRES $PSQL -d "$DB" -c "drop index if exists public.idx_suscripciones_push_user_id;" >/dev/null
LOCK_MODE="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "
begin;
create index idx_suscripciones_push_user_id on public.suscripciones_push (user_id);
select l.mode from pg_locks l join pg_class c on c.oid = l.relation where c.relname = 'suscripciones_push' and l.mode <> 'AccessShareLock';
rollback;
" | tr -d ' ')"
echo "$LOCK_MODE" | grep -qx "ShareLock" || fallo "modo de bloqueo inesperado para CREATE INDEX: '$LOCK_MODE' (esperado ShareLock)"
echo "PM26_P06B_H_AISLADO_BLOQUEO_SHARELOCK_CONFIRMADO=PASS"

# Dejar la base en el estado final "aplicado" antes de descartarla, por
# si se quiere inspeccionar manualmente en la misma ejecucion.
psql_archivo "$MIGRACION" "$DB" >/dev/null 2>&1 || true

echo "PM26_P06B_H_AISLADO_VALIDACION_COMPLETA=PASS"
