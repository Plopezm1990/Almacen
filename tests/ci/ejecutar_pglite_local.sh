#!/usr/bin/env bash
# Ejecuta el smoke funcional A09 sobre PGlite (PostgreSQL 18 WASM).
# Este contrato complementa los contratos de PostgreSQL 16/17; no los sustituye.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

MANIFEST="tests/ci/manifiesto_clasificacion.json"
EVID_DIR="tests/ci/evidencia"
OUT="$EVID_DIR/resultado_bruto_pglite.tsv"

if [ ! -f "$MANIFEST" ]; then
  echo "FALTA_MANIFIESTO: $MANIFEST" >&2
  exit 1
fi

expected_active=$(node -e "const m=JSON.parse(require('fs').readFileSync('$MANIFEST','utf8')); console.log(m.expected_environment_counts.pglite.active_contract)")
expected_utility=$(node -e "const m=JSON.parse(require('fs').readFileSync('$MANIFEST','utf8')); console.log(m.expected_environment_counts.pglite.utility)")

local_package="$ROOT/tests/f3/a09/node_modules/@electric-sql/pglite"
external_package="${TMPDIR:-/tmp}/a09-pglite/node_modules/@electric-sql/pglite"
if [ -z "${A09_PGLITE_PACKAGE_ROOT:-}" ]; then
  if [ -f "$local_package/package.json" ]; then
    A09_PGLITE_PACKAGE_ROOT="$local_package"
  else
    A09_PGLITE_PACKAGE_ROOT="$external_package"
  fi
fi
export A09_PGLITE_PACKAGE_ROOT

if [ ! -f "$A09_PGLITE_PACKAGE_ROOT/package.json" ]; then
  echo "PGLITE_INFRA_MISSING: package no encontrado en $A09_PGLITE_PACKAGE_ROOT" >&2
  exit 1
fi
expected_version=$(node -p "require('./tests/f3/a09/package.json').dependencies['@electric-sql/pglite']")
actual_version=$(node -e 'console.log(require(process.argv[1]+"/package.json").version)' "$A09_PGLITE_PACKAGE_ROOT")
if [ "$actual_version" != "$expected_version" ]; then
  echo "PGLITE_VERSION_MISMATCH: esperado=$expected_version real=$actual_version" >&2
  exit 1
fi

mapfile -t archivos < <(node -e "
const fs=require('fs');
const m=JSON.parse(fs.readFileSync('$MANIFEST','utf8'));
console.log(m.entries.filter(e=>e.environment==='pglite')
  .sort((a,b)=>a.path.localeCompare(b.path,'en'))
  .map(e=>e.path+'\\t'+e.classification).join('\\n'));
")

if [ "${#archivos[@]}" -eq 0 ]; then
  echo "PGLITE_SIN_ENTRADAS_EN_MANIFIESTO" >&2
  exit 1
fi

mkdir -p "$EVID_DIR"
: > "$OUT"
printf 'ruta\tclasificacion\tcodigo_salida\tduracion_ms\tresultado_final\n' >> "$OUT"
pglite_active_total=0
pglite_active_pass=0
pglite_active_fail=0
pglite_utility_run=0
infra_fail=0
fallos=()

for linea in "${archivos[@]}"; do
  f="${linea%%$'\t'*}"
  clasificacion="${linea##*$'\t'}"
  start=$(date +%s%N)
  out=$(timeout 180 node "$f" 2>&1)
  code=$?
  end=$(date +%s%N)
  ms=$(( (end - start) / 1000000 ))
  resultado=""

  case "$clasificacion" in
    active_contract)
      pglite_active_total=$((pglite_active_total + 1))
      if [ "$code" -eq 0 ]; then
        pglite_active_pass=$((pglite_active_pass + 1))
        resultado="PASS"
      else
        pglite_active_fail=$((pglite_active_fail + 1))
        resultado="FAIL"
        fallos+=("$f (exit=$code)")
      fi
      ;;
    utility)
      pglite_utility_run=$((pglite_utility_run + 1))
      if [ "$code" -eq 0 ]; then
        resultado="PASS"
      else
        infra_fail=$((infra_fail + 1))
        resultado="INFRA_FAIL"
        fallos+=("$f (utility, exit=$code)")
      fi
      ;;
    *)
      infra_fail=$((infra_fail + 1))
      resultado="CLASSIFICATION_ERROR"
      fallos+=("$f (unexpected classification=$clasificacion)")
      ;;
  esac

  printf '%s\t%s\t%s\t%s\t%s\n' "$f" "$clasificacion" "$code" "${ms}ms" "$resultado" >> "$OUT"
  printf '%s\n' "$out"
  echo "$f [$clasificacion] -> exit=$code (${ms}ms) resultado=$resultado"
done

echo "PGLITE_ACTIVE_TOTAL=$pglite_active_total"
echo "PGLITE_ACTIVE_PASS=$pglite_active_pass"
echo "PGLITE_ACTIVE_FAIL=$pglite_active_fail"
echo "PGLITE_UTILITIES_RUN=$pglite_utility_run"
echo "PGLITE_INFRA_FAIL=$infra_fail"
echo "PGLITE_VERSION=$actual_version"
echo "RESULTADO_ESCRITO=$OUT"

if [ "$pglite_active_total" -ne "$expected_active" ] ||
   [ "$pglite_active_pass" -ne "$expected_active" ] ||
   [ "$pglite_active_fail" -ne 0 ] ||
   [ "$pglite_utility_run" -ne "$expected_utility" ] ||
   [ "$infra_fail" -ne 0 ]; then
  printf 'PGLITE_RUNNER_FALLO:\n' >&2
  printf '  - %s\n' "${fallos[@]}" >&2
  exit 1
fi

echo "A09_PGLITE_RUNNER=PASS"
