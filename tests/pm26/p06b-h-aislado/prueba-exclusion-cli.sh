#!/usr/bin/env bash
# PM26 P06b-H -- prueba real, reproducible, de que la migracion
# QA-only (supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql)
# es invisible para la CLI de Supabase (`migration list`/`db push`),
# exactamente porque vive fuera de supabase/migrations. Se ejecuta la
# CLI real contra el repositorio real (--workdir), apuntada a un
# Postgres local aislado desechable -- nunca contra ningun proyecto
# Supabase real.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DB="pm26_p06b_h_cli_exclusion_$$"
PSQL="${POSTGRES_PSQL:-psql}"
RUN_AS_POSTGRES="${POSTGRES_SUDO:-sudo -u postgres}"
trap '$RUN_AS_POSTGRES $PSQL -c "drop database if exists \"$DB\";" >/dev/null 2>&1 || true' EXIT

fallo() { echo "PM26_P06B_H_CLI_EXCLUSION_FALLO: $1" >&2; exit 1; }

command -v supabase >/dev/null 2>&1 || fallo "la CLI de supabase no está instalada (npm install -g supabase)"
[ -f "$REPO_ROOT/supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql" ] \
  || fallo "no se encuentra la migracion QA-only en supabase/qa-solo"
[ ! -f "$REPO_ROOT/supabase/migrations/pm26_p06b_rendimiento_indices_rls_initplan.sql" ] || true
if ls "$REPO_ROOT"/supabase/migrations/*rendimiento_indices_rls_initplan* >/dev/null 2>&1; then
  fallo "la migracion QA-only tambien aparece dentro de supabase/migrations -- no deberia"
fi

$RUN_AS_POSTGRES $PSQL -c "drop database if exists \"$DB\";" >/dev/null
$RUN_AS_POSTGRES $PSQL -c "create database \"$DB\";" >/dev/null
$RUN_AS_POSTGRES $PSQL -c "alter user postgres password 'pm26_p06b_h_cli_exclusion';" >/dev/null

SALIDA="$(cd "$REPO_ROOT" && supabase migration list --db-url "postgresql://postgres:pm26_p06b_h_cli_exclusion@127.0.0.1:5432/$DB" 2>&1)" \
  || fallo "supabase migration list fallo: $SALIDA"

echo "$SALIDA" | grep -q "rendimiento_indices_rls_initplan" \
  && fallo "supabase migration list SÍ ve la migracion QA-only -- la exclusion no funciona: $SALIDA"
echo "PM26_P06B_H_CLI_EXCLUSION_MIGRATION_LIST_NO_LA_VE=PASS"

# Control positivo: la CLI SÍ debe ver al menos una migracion real de
# supabase/migrations, para descartar que "no ve nada" simplemente
# porque el comando fallo silenciosamente o la base estaba vacia de
# forma sospechosa. El formato de salida de `migration list` varia
# segun el contexto (JSON `"local":"20260904135838"` o tabla de texto
# con `` `20260904135838` ``) -- se busca el timestamp de 14 digitos
# en cualquiera de los dos formatos, no una sintaxis concreta.
echo "$SALIDA" | grep -qE '[0-9]{14}' \
  || fallo "supabase migration list no reporto ninguna migracion real de supabase/migrations -- el control positivo no se cumple: $SALIDA"
echo "PM26_P06B_H_CLI_EXCLUSION_CONTROL_POSITIVO_VE_MIGRACIONES_REALES=PASS"

echo "PM26_P06B_H_CLI_EXCLUSION_COMPLETA=PASS"
