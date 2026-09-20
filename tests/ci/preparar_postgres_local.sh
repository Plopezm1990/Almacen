#!/usr/bin/env bash
# Prepara un Postgres 16 local desechable y ejecuta los 9 contratos activos
# de tests/{pm12,pm14,pm33}/db/*.mjs que necesitan Postgres real pero NO
# Auth/PostgREST (esos 3 van en el workflow de CI, porque necesitan Docker,
# no disponible en este entorno de trabajo), más
# tests/pm33/db/p01-aislamiento-multiempresa-contract.mjs, que se ejecuta
# también -- como HISTORICAL_EXPECTED_FAIL, no como contrato activo -- para
# dejar constancia real de que sigue fallando exactamente donde se espera.
#
# Cada test se ejecuta AISLADO: un fallo (incluido el fallo esperado de
# P01) nunca detiene el script ni impide ejecutar el resto. El estado
# global (éxito/fracaso del script) se decide solo al final, comparando
# cada resultado contra lo que el manifiesto espera para ese archivo.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

MANIFEST="tests/ci/manifiesto_clasificacion.json"
EVID_DIR="tests/ci/evidencia"
OUT="$EVID_DIR/resultado_bruto_postgres.tsv"

if [ ! -f "$MANIFEST" ]; then
  echo "FALTA_MANIFIESTO: $MANIFEST" >&2
  exit 1
fi

export PGPASSWORD=postgres

# Portable entre un entorno de trabajo interactivo (sin Postgres arrancado
# todavía, se levanta el paquete local del sistema) y CI (un contenedor de
# servicio Postgres que ya escucha en 127.0.0.1:5432 con esta misma
# contraseña vía POSTGRES_PASSWORD) -- en ningún caso se asume systemd.
if ! pg_isready -h 127.0.0.1 -p 5432 -U postgres >/dev/null 2>&1; then
  service postgresql start 2>/dev/null || sudo service postgresql start 2>/dev/null || true
  for i in $(seq 1 20); do
    pg_isready -h 127.0.0.1 -p 5432 -U postgres >/dev/null 2>&1 && break
    sleep 1
  done
fi
pg_isready -h 127.0.0.1 -p 5432 -U postgres
# Fija la contraseña solo hace falta en un Postgres local recién instalado
# (auth peer/trust por defecto); en CI el servicio ya la trae fijada y
# esto es un no-op idempotente tolerado.
sudo -u postgres psql -h 127.0.0.1 -c "ALTER USER postgres PASSWORD 'postgres';" 2>/dev/null || \
  psql -h 127.0.0.1 -U postgres -c "ALTER USER postgres PASSWORD 'postgres';" 2>/dev/null || true
for db in pm12_p08_test pm14_p02_test pm33_p05_test; do
  dropdb -h 127.0.0.1 -U postgres --if-exists "$db"
  createdb -h 127.0.0.1 -U postgres "$db"
done

for dir in tests/pm12/db tests/pm14/db tests/pm33/db; do
  if [ -f "$dir/package-lock.json" ]; then
    npm ci --silent --prefix "$dir"
  else
    npm install --silent --prefix "$dir"
  fi
done

# pm33/db necesita fixtures + la migración P05 real cargados por adelantado
# (pm12/db y pm14/db cargan sus propias migraciones dentro del propio
# script .mjs). El nombre del archivo de la migración se resuelve por
# patrón, nunca hardcodeado, porque ya cambió una vez (renombrado a la
# versión real registrada por PROD en el Punto 1) y puede volver a
# cambiar.
psql -h 127.0.0.1 -U postgres -d pm33_p05_test -v ON_ERROR_STOP=1 -f tests/pm33/db/fixtures.sql
psql -h 127.0.0.1 -U postgres -d pm33_p05_test -v ON_ERROR_STOP=1 -f tests/pm33/db/fixtures_p02_extra.sql
psql -h 127.0.0.1 -U postgres -d pm33_p05_test -v ON_ERROR_STOP=1 -f tests/pm33/db/fixtures_p03_extra.sql
psql -h 127.0.0.1 -U postgres -d pm33_p05_test -v ON_ERROR_STOP=1 -f tests/pm33/db/fixtures_p04_extra.sql
psql -h 127.0.0.1 -U postgres -d pm33_p05_test -v ON_ERROR_STOP=1 -f tests/pm33/db/fixtures_p05_extra.sql

migracion_p05=$(find supabase/migrations -maxdepth 1 -type f -iname '*pm33_p05_identidad_antes_de_actividad.sql')
n_migracion=$(printf '%s\n' "$migracion_p05" | grep -c . || true)
if [ "$n_migracion" -ne 1 ]; then
  echo "MIGRACION_PM33_P05_NO_UNICA: se esperaba exactamente 1, se encontraron $n_migracion" >&2
  printf '%s\n' "$migracion_p05" >&2
  exit 1
fi
psql -h 127.0.0.1 -U postgres -d pm33_p05_test -v ON_ERROR_STOP=1 -f "$migracion_p05"

export PM12_TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/pm12_p08_test'
export PM14_TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/pm14_p02_test'
export PM33_TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/pm33_p05_test'

mkdir -p "$EVID_DIR"
: > "$OUT"
echo "# POSTGRES=$(psql -h 127.0.0.1 -U postgres -tAc 'select version();') FECHA_UTC=$(date -u +%FT%TZ)" >> "$OUT"
printf 'ruta\tclasificacion\tcodigo_salida\tduracion_ms\tultima_marca\tresultado_final\n' >> "$OUT"

# Lista de ejecución: todo lo que el manifiesto marca environment=postgres
# (9 activos + 1 histórico), en el orden del propio manifiesto.
mapfile -t archivos < <(node -e "
const fs = require('fs');
const m = JSON.parse(fs.readFileSync('$MANIFEST', 'utf8'));
console.log(m.entries.filter(e => e.environment === 'postgres').map(e => e.path + '\t' + e.classification).join('\n'));
")

postgres_active_total=0
postgres_active_pass=0
postgres_active_fail=0
historical_expected_fail_count=0
fallos_inesperados=0
FALLOS_ACTIVOS=()
FALLOS_HISTORICO=()

for linea in "${archivos[@]}"; do
  f="${linea%%$'\t'*}"
  clasificacion="${linea##*$'\t'}"
  start=$(date +%s%N)
  out=$(timeout 60 node "$f" 2>&1)
  code=$?
  end=$(date +%s%N)
  ms=$(( (end - start) / 1000000 ))
  lastline=$(printf '%s' "$out" | tail -1 | tr '\t' ' ')

  if [ "$clasificacion" = "historical_expected_fail" ]; then
    if [ "$code" -eq 0 ]; then
      resultado="INESPERADO_PASA"
      echo "$f -> exit=$code (${ms}ms) -- INESPERADO: se esperaba que este histórico siguiera fallando (P03 cambió el contrato deliberadamente) y ahora pasa; revisa si sigue siendo un registro histórico válido."
      fallos_inesperados=$((fallos_inesperados + 1))
      FALLOS_HISTORICO+=("$f (pasó, se esperaba que fallara)")
    else
      resultado="HISTORICAL_EXPECTED_FAIL"
      historical_expected_fail_count=$((historical_expected_fail_count + 1))
      echo "$f -> exit=$code (${ms}ms) -- esperado (HISTORICAL_EXPECTED_FAIL)"
    fi
  else
    postgres_active_total=$((postgres_active_total + 1))
    if [ "$code" -eq 0 ]; then
      resultado="PASS"
      postgres_active_pass=$((postgres_active_pass + 1))
    else
      resultado="FAIL"
      postgres_active_fail=$((postgres_active_fail + 1))
      fallos_inesperados=$((fallos_inesperados + 1))
      FALLOS_ACTIVOS+=("$f (exit=$code)")
    fi
    echo "$f -> exit=$code (${ms}ms) resultado=$resultado"
  fi
  printf '%s\t%s\t%s\t%sms\t%s\t%s\n' "$f" "$clasificacion" "$code" "$ms" "$lastline" "$resultado" >> "$OUT"
done

echo "RESULTADO_ESCRITO=$OUT"

# ---- Conteos REALES (nunca fijos) y veredicto ----
echo "POSTGRES_ACTIVE_TOTAL=$postgres_active_total"
echo "POSTGRES_ACTIVE_PASS=$postgres_active_pass"
echo "POSTGRES_ACTIVE_FAIL=$postgres_active_fail"
echo "HISTORICAL_EXPECTED_FAIL=$historical_expected_fail_count"

if [ "$postgres_active_total" -ne 9 ]; then
  echo "POSTGRES_ACTIVE_TOTAL_INESPERADO: se esperaban 9 contratos activos Postgres, el manifiesto tiene $postgres_active_total." >&2
  fallos_inesperados=$((fallos_inesperados + 1))
fi
if [ "$historical_expected_fail_count" -ne 1 ]; then
  echo "HISTORICAL_EXPECTED_FAIL_INESPERADO: se esperaba exactamente 1, hubo $historical_expected_fail_count." >&2
  fallos_inesperados=$((fallos_inesperados + 1))
fi

if [ "$fallos_inesperados" -gt 0 ]; then
  echo "PREPARAR_POSTGRES_LOCAL: $fallos_inesperados resultado(s) no coinciden con lo esperado por el manifiesto." >&2
  if [ "${#FALLOS_ACTIVOS[@]}" -gt 0 ]; then
    echo "  Contratos activos fallidos:" >&2
    printf '    - %s\n' "${FALLOS_ACTIVOS[@]}" >&2
  fi
  if [ "${#FALLOS_HISTORICO[@]}" -gt 0 ]; then
    echo "  Históricos con resultado inesperado:" >&2
    printf '    - %s\n' "${FALLOS_HISTORICO[@]}" >&2
  fi
  exit 1
fi
echo "PREPARAR_POSTGRES_LOCAL_OK=1"
