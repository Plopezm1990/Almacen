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

BASELINE="tests/pm27/fixtures/c24-pre-c13-baseline.sql"
MANIFEST="tests/pm27/pm27-c24-migration-manifest.json"
PREFLIGHT="supabase/qa-solo/pm27_c24_preflight_migraciones.sql"
POSTFLIGHT="supabase/qa-solo/pm27_c24_postflight_migraciones.sql"
SNAPSHOT="supabase/qa-solo/pm27_c24_predeploy_snapshot.sql"

for required in "$BASELINE" "$MANIFEST" "$PREFLIGHT" "$POSTFLIGHT" "$SNAPSHOT"; do
  test -f "$required" || { echo "Falta artefacto C24: $required" >&2; exit 1; }
done

pg_client() {
  docker run --rm --network host \
    -e PGPASSWORD="$PGPASSWORD" \
    -v "$ROOT:/workspace:ro" \
    "$PG_IMAGE" "$@"
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

load_baseline() {
  local db="$1"
  run_file "$db" "$BASELINE"
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

expect_pass_marker() {
  local marker="$1"; shift
  local output
  output="$($@ 2>&1)" || {
    printf '%s\n' "$output" >&2
    echo "Fallo esperando marcador $marker" >&2
    exit 1
  }
  printf '%s\n' "$output"
  grep -Fq "$marker" <<<"$output" || {
    echo "No apareció marcador esperado: $marker" >&2
    exit 1
  }
}

expect_preflight_reject() {
  local db="$1" label="$2" output status
  set +e
  output="$(run_file "$db" "$PREFLIGHT" 2>&1)"
  status=$?
  set -e
  printf '%s\n' "$output"
  if [[ $status -eq 0 ]]; then
    echo "$label: el preflight debía rechazar el estado y devolvió éxito" >&2
    exit 1
  fi
  grep -Fq 'PM27_C24_PREFLIGHT_REAPLICACION_RECHAZADA' <<<"$output" || {
    echo "$label: rechazo sin marcador fail-closed esperado" >&2
    exit 1
  }
  echo "$label=PASS"
}

# 0) El contrato estático debe pasar antes de arrancar cualquier SQL.
node tests/pm27/c24-migrations-preflight-rollback.mjs

echo '==> Verify PostgreSQL 17 server'
version_num="$(psql_admin -Atqc 'show server_version_num')"
version_text="$(psql_admin -Atqc 'select version()')"
printf 'SERVER_VERSION_NUM=%s\n%s\n' "$version_num" "$version_text"
if [[ "$version_num" -lt 170000 || "$version_num" -ge 180000 ]]; then
  echo "C24 requiere servidor PostgreSQL 17; encontrado $version_num" >&2
  exit 1
fi
echo 'PM27_C24_POSTGRES17=PASS'

# 1) Baseline limpio con helper legacy presente.
DB_CLEAN='pm27_c24_clean'
recreate_db "$DB_CLEAN"
load_baseline "$DB_CLEAN"
expect_pass_marker 'PM27_C24_PREFLIGHT=PASS' run_file "$DB_CLEAN" "$PREFLIGHT"

# Inventario predeploy de recuperación: debe poder ejecutarse antes del lote.
expect_pass_marker 'ROLLBACK' run_file "$DB_CLEAN" "$SNAPSHOT" || true
# El snapshot no emite un marker fijo histórico; la ejecución ON_ERROR_STOP=1 es el gate.
run_file "$DB_CLEAN" "$SNAPSHOT" > /tmp/pm27-c24-predeploy-snapshot.txt 2>&1

echo '==> Create pre-package pg_dump'
pg_client pg_dump --no-owner -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB_CLEAN" \
  > /tmp/pm27-c24-prepackage.sql

test -s /tmp/pm27-c24-prepackage.sql

echo 'PM27_C24_PREPACKAGE_DUMP=PASS'

apply_manifest "$DB_CLEAN"
expect_pass_marker 'PM27_C24_POSTFLIGHT=PASS' run_file "$DB_CLEAN" "$POSTFLIGHT"
expect_preflight_reject "$DB_CLEAN" 'PM27_C24_REAPLICACION_RECHAZADA'

# 2) Estado parcial: solo la primera migración debe ser detectada y rechazada.
DB_PARTIAL='pm27_c24_partial'
recreate_db "$DB_PARTIAL"
load_baseline "$DB_PARTIAL"
first_migration="$(manifest_paths | head -n 1)"
run_file "$DB_PARTIAL" "$first_migration"
expect_preflight_reject "$DB_PARTIAL" 'PM27_C24_ESTADO_PARCIAL_RECHAZADO'

# 3) Variante válida C13: helper ya retirado, sin referencias residuales.
DB_HELPER_ABSENT='pm27_c24_helper_absent'
recreate_db "$DB_HELPER_ABSENT"
load_baseline "$DB_HELPER_ABSENT"
psql_db "$DB_HELPER_ABSENT" -c 'DROP FUNCTION private.es_propietario_activo();'
expect_pass_marker 'PM27_C24_PREFLIGHT=PASS' run_file "$DB_HELPER_ABSENT" "$PREFLIGHT"
apply_manifest "$DB_HELPER_ABSENT"
expect_pass_marker 'PM27_C24_POSTFLIGHT=PASS' run_file "$DB_HELPER_ABSENT" "$POSTFLIGHT"
echo 'PM27_C24_HELPER_AUSENTE=PASS'

# 4) Recuperación: restaurar el dump PRE-paquete en una base vacía y demostrar
# que vuelve a ser un destino limpio apto para el preflight agregado.
DB_ROLLBACK='pm27_c24_rollback'
recreate_db "$DB_ROLLBACK"
docker run --rm -i --network host \
  -e PGPASSWORD="$PGPASSWORD" \
  "$PG_IMAGE" psql -X -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB_ROLLBACK" \
  < /tmp/pm27-c24-prepackage.sql
expect_pass_marker 'PM27_C24_PREFLIGHT=PASS' run_file "$DB_ROLLBACK" "$PREFLIGHT"
echo 'PM27_C24_ROLLBACK_RESTORE=PASS'

# 5) Limpieza de las DB efímeras. Los roles viven a nivel cluster y desaparecen
# con el service container al terminar el job.
for db in "$DB_CLEAN" "$DB_PARTIAL" "$DB_HELPER_ABSENT" "$DB_ROLLBACK"; do
  psql_admin -c "DROP DATABASE IF EXISTS \"$db\" WITH (FORCE);"
done

echo 'PM27_C24_PG17_GATE=PASS'
