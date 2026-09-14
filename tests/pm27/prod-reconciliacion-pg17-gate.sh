#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PG_IMAGE="${PG_IMAGE:-postgres:17}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
export PGPASSWORD

BASELINE='tests/pm27/fixtures/c24-pre-c13-baseline.sql'
DRIFT='tests/pm27/fixtures/prod-pre-reconciliacion-from-c24.sql'
RECON='supabase/migrations/20260914170500_pm27_prod_reconciliacion_pre_c24.sql'
RECOVERY='supabase/qa-solo/pm27_prod_recovery_pre_c24.sql'
PREFLIGHT='supabase/qa-solo/pm27_c24_preflight_migraciones.sql'
POSTFLIGHT='supabase/qa-solo/pm27_c24_postflight_migraciones.sql'
MANIFEST='tests/pm27/pm27-c24-migration-manifest.json'
SMOKE='tests/pm27/fixtures/prod-reconciliacion-smoke.sql'
POSTVERIFY='tests/pm27/fixtures/prod-reconciliacion-post-c24-verify.sql'
RECOVERYVERIFY='tests/pm27/fixtures/prod-reconciliacion-recovery-verify.sql'

pg_client() {
  docker run --rm --network host -e PGPASSWORD="$PGPASSWORD" \
    -v "$ROOT:/workspace:ro" "$PG_IMAGE" "$@"
}
psql_admin() {
  pg_client psql -X -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres "$@"
}
psql_db() {
  local db="$1"; shift
  pg_client psql -X -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$db" "$@"
}
run_file() {
  local db="$1" file="$2"
  psql_db "$db" -f "/workspace/$file"
}
recreate_db() {
  local db="$1"
  psql_admin -c "DROP DATABASE IF EXISTS \"$db\" WITH (FORCE);"
  psql_admin -c "CREATE DATABASE \"$db\";"
}
load_prod_drift() {
  run_file "$1" "$BASELINE"
  run_file "$1" "$DRIFT"
}
manifest_paths() {
  node -e "const m=require('./$MANIFEST'); for (const x of m.migrations) console.log(x.path)"
}
apply_manifest() {
  local db="$1" path
  while IFS= read -r path; do
    test -n "$path" || continue
    echo "==> APPLY $path"
    run_file "$db" "$path"
  done < <(manifest_paths)
}
expect_marker() {
  local marker="$1"; shift
  local out
  out="$("$@" 2>&1)" || { printf '%s\n' "$out" >&2; exit 1; }
  printf '%s\n' "$out"
  grep -Fq "$marker" <<<"$out"
}
expect_recon_reject() {
  local db="$1" out status
  set +e
  out="$(run_file "$db" "$RECON" 2>&1)"
  status=$?
  set -e
  printf '%s\n' "$out"
  test "$status" -ne 0
  grep -Fq 'PM27_PROD_RECON_PREFLIGHT_FALLO' <<<"$out"
  echo 'PM27_PROD_RECON_REAPLICACION_RECHAZADA=PASS'
}

node tests/pm27/prod-reconciliacion-pre-c24.mjs

version_num="$(psql_admin -Atqc 'show server_version_num')"
test "$version_num" -ge 170000
test "$version_num" -lt 180000
echo 'PM27_PROD_RECON_POSTGRES17=PASS'

DB_DEPLOY='pm27_prod_recon_deploy'
recreate_db "$DB_DEPLOY"
load_prod_drift "$DB_DEPLOY"
expect_marker 'PM27_PROD_RECON_PREFLIGHT=PASS' run_file "$DB_DEPLOY" "$RECON"
expect_recon_reject "$DB_DEPLOY"
expect_marker 'PM27_C24_PREFLIGHT=PASS' run_file "$DB_DEPLOY" "$PREFLIGHT"
expect_marker 'PM27_PROD_RECON_PAGOS_SMOKE=PASS' run_file "$DB_DEPLOY" "$SMOKE"
apply_manifest "$DB_DEPLOY"
expect_marker 'PM27_C24_POSTFLIGHT=PASS' run_file "$DB_DEPLOY" "$POSTFLIGHT"
expect_marker 'PM27_PROD_RECON_C24_VERIFY=PASS' run_file "$DB_DEPLOY" "$POSTVERIFY"

DB_RECOVERY='pm27_prod_recon_recovery'
recreate_db "$DB_RECOVERY"
load_prod_drift "$DB_RECOVERY"
run_file "$DB_RECOVERY" "$RECON"
apply_manifest "$DB_RECOVERY"
expect_marker 'PM27_PROD_RECOVERY=PASS' run_file "$DB_RECOVERY" "$RECOVERY"
expect_marker 'PM27_PROD_RECON_RECOVERY_VERIFY=PASS' run_file "$DB_RECOVERY" "$RECOVERYVERIFY"

for db in "$DB_DEPLOY" "$DB_RECOVERY"; do
  psql_admin -c "DROP DATABASE IF EXISTS \"$db\" WITH (FORCE);"
done

echo 'PM27_PROD_RECON_PG17_GATE=PASS'
