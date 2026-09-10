#!/usr/bin/env bash
# PM26 P06h -- valida de punta a punta, en un Postgres local aislado
# (nunca contra QA ni produccion), el diseno propuesto del aviso F
# (aislamiento por empresa/local, RLS en lectura, RPC en escritura).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DIR/../../.." && pwd)"
MIGRACION="$REPO_ROOT/supabase/qa-solo/pm26_p06h_aislamiento_prefiltros_candidatos.sql"
DB="pm26_p06h_f_aislado_$$"
PSQL="${POSTGRES_PSQL:-psql}"
RUN_AS_POSTGRES="${POSTGRES_SUDO:-sudo -u postgres}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"; $RUN_AS_POSTGRES $PSQL -c "drop database if exists \"$DB\";" >/dev/null 2>&1 || true' EXIT

fallo() { echo "PM26_P06H_F_AISLADO_FALLO: $1" >&2; exit 1; }

psql_archivo() {
  local archivo="$1" db="$2"
  cat "$archivo" | $RUN_AS_POSTGRES $PSQL -d "$db" -v ON_ERROR_STOP=1
}

[ -f "$MIGRACION" ] || fallo "no se encuentra la migracion en $MIGRACION"
if [ -f "$REPO_ROOT/supabase/migrations/$(basename "$MIGRACION")" ]; then
  fallo "la migracion del aviso F tambien existe dentro de supabase/migrations -- debe vivir SOLO en supabase/qa-solo"
fi
echo "PM26_P06H_F_AISLADO_FUERA_DE_SUPABASE_MIGRATIONS=PASS"

$RUN_AS_POSTGRES $PSQL -c "drop database if exists \"$DB\";" >/dev/null
$RUN_AS_POSTGRES $PSQL -c "create database \"$DB\";" >/dev/null

psql_archivo "$DIR/schema.sql" "$DB" >/dev/null \
  || fallo "no se pudo aplicar schema.sql"
echo "PM26_P06H_F_AISLADO_SCHEMA=PASS"

psql_archivo "$DIR/seed.sql" "$DB" >/dev/null \
  || fallo "no se pudo aplicar seed.sql"
echo "PM26_P06H_F_AISLADO_SEED=PASS"

# --- Negativo: simular produccion (crear las 3 politicas reales de
# produccion sobre la tabla dentro de una transaccion que se revierte)
# -- el preflight debe abortar. ---
NEG_PROD="$( { echo "begin;"; \
  echo "create policy \"prefiltros - propietario lee\" on public.prefiltros_candidatos for select to authenticated using (true);"; \
  cat "$MIGRACION"; \
  echo "rollback;"; } | $RUN_AS_POSTGRES $PSQL -d "$DB" 2>&1 || true )"
echo "$NEG_PROD" | grep -q "PREFLIGHT_FALLO" \
  || fallo "el preflight debia fallar al detectar una politica de produccion simulada, y no fallo"
echo "PM26_P06H_F_AISLADO_PREFLIGHT_DETECTA_PRODUCCION=PASS"

# Confirma que el rollback del simulacro no dejo rastro (0 politicas todavia).
QUEDAN_POLITICAS="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from pg_policies where tablename='prefiltros_candidatos';")"
[ "$QUEDAN_POLITICAS" = "0" ] || fallo "tras el rollback del simulacro de produccion deberian quedar 0 politicas, encontrado $QUEDAN_POLITICAS"
echo "PM26_P06H_F_AISLADO_SIMULACRO_PRODUCCION_SIN_RASTRO=PASS"

# --- Negativo: simular filas existentes (insertar una fila directa
# como postgres, dentro de una transaccion que se revierte) -- el
# preflight debe abortar porque exige 0 filas. ---
NEG_FILAS="$( { echo "begin;"; \
  echo "insert into public.prefiltros_candidatos (token, candidato_nombre) values ('token-simulado', 'Simulado');"; \
  cat "$MIGRACION"; \
  echo "rollback;"; } | $RUN_AS_POSTGRES $PSQL -d "$DB" 2>&1 || true )"
echo "$NEG_FILAS" | grep -q "PREFLIGHT_FALLO" \
  || fallo "el preflight debia fallar al encontrar una fila existente simulada, y no fallo"
echo "PM26_P06H_F_AISLADO_PREFLIGHT_DETECTA_FILAS_EXISTENTES=PASS"

FILAS_TRAS_ROLLBACK="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from public.prefiltros_candidatos;")"
[ "$FILAS_TRAS_ROLLBACK" = "0" ] || fallo "tras el rollback del simulacro de filas deberian quedar 0 filas, encontrado $FILAS_TRAS_ROLLBACK"

# --- Aplicar la migracion real (positivo). ---
psql_archivo "$MIGRACION" "$DB" >/dev/null \
  || fallo "la migracion no se aplico limpiamente"
echo "PM26_P06H_F_AISLADO_MIGRACION_APLICADA=PASS"

# --- Bateria de comportamiento: 15 casos positivos/negativos. ---
SALIDA="$(psql_archivo "$DIR/comportamiento.sql" "$DB" 2>&1)" \
  || { echo "$SALIDA" >&2; fallo "la bateria de comportamiento fallo al ejecutarse"; }
echo "$SALIDA" > "$WORKDIR/comportamiento.txt"
FALLOS="$(grep -c '=FAIL' "$WORKDIR/comportamiento.txt" || true)"
if [ "$FALLOS" != "0" ]; then
  grep '=FAIL' "$WORKDIR/comportamiento.txt" >&2
  fallo "$FALLOS caso(s) de la bateria de comportamiento fallaron"
fi
for n in P1 P2 P3 N4 N5 N6 N7 N8 P9 N10 P11 N12 N13 N14 N15; do
  # psql antepone "NOTICE:  " a cada linea -- no anclar a inicio de linea.
  grep -q "$n=PASS" "$WORKDIR/comportamiento.txt" || { echo "$SALIDA" >&2; fallo "falta o no paso el caso $n"; }
done
echo "PM26_P06H_F_AISLADO_BATERIA_15_CASOS=PASS"

# --- Reaplicar inmediatamente despues debe fallar (columnas ya existen). ---
REAPLICAR="$(psql_archivo "$MIGRACION" "$DB" 2>&1 || true)"
echo "$REAPLICAR" | grep -q "PREFLIGHT_FALLO" \
  || fallo "reaplicar la migracion inmediatamente despues debia fallar por PREFLIGHT_FALLO y no fallo"
echo "PM26_P06H_F_AISLADO_REAPLICACION_RECHAZADA=PASS"

# --- Reversion exacta. ---
psql_archivo "$DIR/revertir.sql" "$DB" >/dev/null \
  || fallo "la reversion no se aplico limpiamente"

COLUMNAS_TRAS_REVERTIR="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from information_schema.columns where table_schema='public' and table_name='prefiltros_candidatos' and column_name in ('empresa_id','local_id');")"
[ "$COLUMNAS_TRAS_REVERTIR" = "0" ] || fallo "tras revertir no deberian quedar las columnas empresa_id/local_id, encontrado $COLUMNAS_TRAS_REVERTIR"
GRANTS_TRAS_REVERTIR="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from information_schema.role_table_grants where table_schema='public' and table_name='prefiltros_candidatos' and grantee='authenticated';")"
[ "$GRANTS_TRAS_REVERTIR" = "0" ] || fallo "tras revertir authenticated no deberia tener ningun grant sobre prefiltros_candidatos, encontrado $GRANTS_TRAS_REVERTIR"
echo "PM26_P06H_F_AISLADO_REVERSION_EXACTA=PASS"

# --- Reaplicar limpio tras revertir, para confirmar que el ciclo
# completo es repetible. La bateria de comportamiento dejo 2 filas de
# prueba (creadas en P1/P2; la de P3 se borro en P11) -- revertir.sql
# NO las borra a proposito (un revert real no debe destruir datos), asi
# que aqui, solo en este entorno aislado, se limpian esas filas de
# fixture para que el preflight de "tabla vacia" vuelva a cumplirse,
# igual que ocurriria en QA si nunca se hubiera escrito nada.
$RUN_AS_POSTGRES $PSQL -d "$DB" -c "delete from public.prefiltros_candidatos;" >/dev/null \
  || fallo "no se pudieron limpiar las filas de prueba antes de reaplicar"

psql_archivo "$MIGRACION" "$DB" >/dev/null \
  || fallo "no se pudo reaplicar la migracion tras revertir"
echo "PM26_P06H_F_AISLADO_REAPLICACION_LIMPIA_TRAS_REVERTIR=PASS"

echo "PM26_P06H_F_AISLADO_VALIDACION_COMPLETA=PASS"
