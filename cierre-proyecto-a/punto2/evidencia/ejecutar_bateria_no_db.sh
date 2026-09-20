#!/usr/bin/env bash
# Punto 2 -- batería reproducible de los contratos que NO requieren Postgres/Auth/PostgREST.
#
# Autocontenido: resuelve la raíz del repositorio con `git rev-parse
# --show-toplevel` (nunca una ruta absoluta fija), construye el inventario
# internamente a partir del manifiesto versionado
# (cierre-proyecto-a/punto2/manifiesto_clasificacion.json) y del árbol real
# de `tests/`, verifica el número esperado ANTES de ejecutar nada, y deja el
# árbol de trabajo limpio al terminar (revierte cualquier mutación de los
# scripts de diagnóstico/utilidad y borra el artefacto de build de Netlify).
# Pensado para poder ejecutarse desde cualquier clon o worktree limpio.
#
# Ejecuta: los 121 contratos activos con `environment: "node"` del
# manifiesto, los 5 diagnósticos y 1 de las 3 utilidades
# (tests/pm12/p09-aplicar-index.mjs -- las otras 2 utilidades,
# prepare-fixture.mjs/prepare-production-baseline.mjs, son exclusivamente
# de preparación para el job Auth/PostgREST de CI y se ejecutan solo ahí,
# nunca de forma aislada aquí, porque escriben migraciones temporales para
# un stack de Supabase que este script no levanta).
#
# NO ejecuta los 9 contratos Postgres (ver preparar_postgres_local.sh) ni
# los 3 contratos Auth/PostgREST/Postgres reales (ver el workflow de CI).
#
# GARANTÍA REAL (no solo registro): el código de salida de este script es
# 0 únicamente si los NODE_ACTIVE_TOTAL contratos activos terminaron todos
# en PASS (NODE_ACTIVE_FAIL=0) y ninguna utilidad/diagnóstico se bloqueó o
# lanzó una excepción. La batería completa siempre se ejecuta hasta el
# final -- el fallo se acumula y se decide al terminar, nunca se corta a
# mitad de camino.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

MANIFEST="cierre-proyecto-a/punto2/manifiesto_clasificacion.json"
EVID_DIR="cierre-proyecto-a/punto2/evidencia"
OUT="$EVID_DIR/resultado_bruto_no_db.tsv"

if [ ! -f "$MANIFEST" ]; then
  echo "FALTA_MANIFIESTO: $MANIFEST" >&2
  exit 1
fi

# ---- 0. Rutas mutables conocidas: abortar si ya tienen cambios sin relación con este runner ----
# p09-aplicar-index.mjs y los 5 diagnósticos de PM13 escriben en estas
# rutas. Si ya están sucias ANTES de ejecutar nada, no son un artefacto de
# esta corrida -- son trabajo del usuario, y sobrescribirlas con
# `git checkout --` las destruiría. Se aborta sin tocar nada.
RUTAS_MUTABLES_CONOCIDAS=(
  "index.html"
  "tests/pm13/P01_DIAGNOSTICO_PERSONAL.json"
  "tests/pm13/P02_DIAGNOSTICO_TURNOS.json"
  "tests/pm13/P02_LOGICA_TURNOS_ACTUAL.txt"
  "tests/pm13/P02_UI_TURNOS_ACTUAL.txt"
  "tests/pm13/P03_DIAGNOSTICO_FICHAJES.json"
  "tests/pm13/P03_FICHAJES_ABIERTOS.txt"
  "tests/pm13/P04_DIAGNOSTICO_AUSENCIAS.json"
  "tests/pm13/P07_DIAGNOSTICO_IA_NOMINAS.json"
  "tests/pm13/P07_EXTRACT_NOMINAS.txt"
)
sucio_previo=$(git status --porcelain -- "${RUTAS_MUTABLES_CONOCIDAS[@]}")
if [ -n "$sucio_previo" ]; then
  echo "ABORTADO: hay cambios sin commitear en rutas que este runner muta (no se sobrescriben):" >&2
  echo "$sucio_previo" >&2
  exit 1
fi
echo "RUTAS_MUTABLES_PREVIAS_LIMPIAS=1"

# ---- 1. Inventario real del árbol vs. manifiesto (detecta drift) ----
mapfile -t inventario_real < <(git ls-tree -r --name-only HEAD -- tests/ | grep '\.mjs$' | LC_ALL=C sort)
total_real=${#inventario_real[@]}

total_manifiesto=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$MANIFEST','utf8')).total_inventory)")
if [ "$total_real" -ne "$total_manifiesto" ]; then
  echo "INVENTARIO_DESAJUSTADO: árbol real=$total_real, manifiesto=$total_manifiesto -- actualiza el manifiesto antes de continuar." >&2
  exit 1
fi

# Cada ruta del árbol real debe existir en el manifiesto, y viceversa (ni
# archivos nuevos sin clasificar, ni entradas del manifiesto que ya no
# existen).
mismatch=$(node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('$MANIFEST', 'utf8'));
const real = fs.readFileSync('/dev/stdin', 'utf8').trim().split('\n').filter(Boolean);
const manifestPaths = new Set(manifest.entries.map(e => e.path));
const realPaths = new Set(real);
const soloEnArbol = real.filter(p => !manifestPaths.has(p));
const soloEnManifiesto = [...manifestPaths].filter(p => !realPaths.has(p));
if (soloEnArbol.length || soloEnManifiesto.length) {
  console.log(JSON.stringify({ soloEnArbol, soloEnManifiesto }));
}
" <<< "$(printf '%s\n' "${inventario_real[@]}")")

if [ -n "$mismatch" ]; then
  echo "INVENTARIO_DESAJUSTADO_POR_RUTA: $mismatch" >&2
  exit 1
fi

echo "INVENTARIO_VERIFICADO=$total_real (coincide con el manifiesto)"

# ---- 2. Construir la lista de ejecución, CON su clasificación (environment=node) ----
# Excluye las 2 utilidades de preparación exclusivas del job Auth/PostgREST
# de CI (ver cabecera). Formato de cada línea: "ruta<TAB>clasificación".
mapfile -t archivos < <(node -e "
const fs = require('fs');
const m = JSON.parse(fs.readFileSync('$MANIFEST', 'utf8'));
const excluir = new Set([
  'tests/pm12/supabase-full/prepare-fixture.mjs',
  'tests/pm12/supabase-full/prepare-production-baseline.mjs',
]);
const lista = m.entries
  .filter(e => e.environment === 'node' && !excluir.has(e.path))
  .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  .map(e => e.path + '\t' + e.classification);
console.log(lista.join('\n'));
")
n_ejecutar=${#archivos[@]}
echo "ARCHIVOS_A_EJECUTAR=$n_ejecutar (environment=node, excluidas 2 utilidades de preparación exclusivas de CI)"

# ---- 3. Ejecutar cada archivo, sin parar en el primer fallo -- acumulando resultado ----
# tests/netlify-publish-boundary.mjs se ejecuta aparte, al final (paso 4):
# compara el árbol fuente contra una copia de build (.netlify-dist), así
# que esa copia solo puede construirse cuando el árbol ya está en su
# estado final y estable -- si se construyera antes, las propias
# escrituras de este runner sobre $OUT (que vive dentro del árbol fuente)
# desincronizarían la copia del original y el test fallaría por una razón
# ajena a Netlify.
NETLIFY_TEST="tests/netlify-publish-boundary.mjs"
mkdir -p "$EVID_DIR"
: > "$OUT"
node_version="$(node --version)"
echo "# INVENTARIO_VERIFICADO=$total_real ARCHIVOS_A_EJECUTAR=$n_ejecutar NODE=$node_version FECHA_UTC=$(date -u +%FT%TZ)" >> "$OUT"
printf 'ruta\tclasificacion\tcodigo_salida\tduracion_ms\tultima_marca\tresultado_final\n' >> "$OUT"

node_active_total=0
node_active_pass=0
node_active_fail=0
utilidades_ejecutadas=0
diagnosticos_ejecutados=0
infra_fail=0
FALLOS_ACTIVOS=()
FALLOS_INFRA=()

ejecutar_uno() {
  local f="$1" clasificacion="$2"
  local start end ms out code lastline resultado

  start=$(date +%s%N)
  out=$(timeout 60 node "$f" 2>&1)
  code=$?
  end=$(date +%s%N)
  ms=$(( (end - start) / 1000000 ))
  lastline=$(printf '%s' "$out" | tail -1 | tr '\t' ' ')

  case "$clasificacion" in
    active_contract)
      node_active_total=$((node_active_total + 1))
      if [ "$code" -eq 0 ]; then
        node_active_pass=$((node_active_pass + 1))
        resultado="PASS"
      else
        node_active_fail=$((node_active_fail + 1))
        resultado="FAIL"
        FALLOS_ACTIVOS+=("$f (exit=$code)")
      fi
      ;;
    utility)
      utilidades_ejecutadas=$((utilidades_ejecutadas + 1))
      if [ "$code" -eq 0 ]; then
        resultado="PASS"
      else
        infra_fail=$((infra_fail + 1))
        resultado="INFRA_FAIL"
        FALLOS_INFRA+=("$f (utilidad, exit=$code)")
      fi
      ;;
    diagnostic)
      diagnosticos_ejecutados=$((diagnosticos_ejecutados + 1))
      if [ "$code" -eq 0 ]; then
        resultado="PASS"
      else
        infra_fail=$((infra_fail + 1))
        resultado="INFRA_FAIL"
        FALLOS_INFRA+=("$f (diagnóstico, exit=$code)")
      fi
      ;;
    *)
      resultado="CLASIFICACION_DESCONOCIDA"
      infra_fail=$((infra_fail + 1))
      FALLOS_INFRA+=("$f (clasificación desconocida: $clasificacion)")
      ;;
  esac

  printf '%s\t%s\t%s\t%sms\t%s\t%s\n' "$f" "$clasificacion" "$code" "$ms" "$lastline" "$resultado" >> "$OUT"
  echo "$f [$clasificacion] -> exit=$code (${ms}ms) resultado=$resultado"
}

for linea in "${archivos[@]}"; do
  f="${linea%%$'\t'*}"
  clasificacion="${linea##*$'\t'}"
  [ "$f" = "$NETLIFY_TEST" ] && continue
  ejecutar_uno "$f" "$clasificacion"
done

# ---- 4. tests/netlify-publish-boundary.mjs, con el árbol ya estable ----
# Se reconstruye .netlify-dist siempre, sin asumir nada sobre si ya
# existía o quién lo creó -- una copia preexistente (de una ejecución
# manual o de un clon no limpio) podría estar desfasada del árbol actual
# y produciría un fallo que no tiene nada que ver con Netlify.
rm -rf .netlify-dist
echo "Generando prerrequisito de build (.netlify-dist) para $NETLIFY_TEST..."
node .github/scripts/build-netlify-publish.mjs >/dev/null
ejecutar_uno "$NETLIFY_TEST" "active_contract"

echo "RESULTADO_ESCRITO=$OUT"

# ---- 5. Limpieza: revertir mutaciones conocidas y borrar artefactos de build ----
# Ya se confirmó en el paso 0 que estas rutas estaban limpias ANTES de
# ejecutar nada, así que revertirlas ahora solo deshace lo que este propio
# runner acaba de escribir.
for p in "${RUTAS_MUTABLES_CONOCIDAS[@]}"; do
  if git ls-files --error-unmatch "$p" >/dev/null 2>&1; then
    git checkout -- "$p" 2>/dev/null || true
  elif [ -e "$p" ]; then
    rm -f "$p"
  fi
done

rm -rf .netlify-dist

# ---- 6. Conteos REALES (nunca fijos) y veredicto -- SIEMPRE se calculan e
# imprimen, pase lo que pase con la limpieza del árbol (paso 7), para que
# un fallo real de un contrato activo nunca quede oculto detrás de un
# aviso distinto. ----
echo "NODE_ACTIVE_TOTAL=$node_active_total"
echo "NODE_ACTIVE_PASS=$node_active_pass"
echo "NODE_ACTIVE_FAIL=$node_active_fail"
echo "UTILITIES_RUN=$utilidades_ejecutadas"
echo "DIAGNOSTICS_RUN=$diagnosticos_ejecutados"
echo "INFRA_FAIL=$infra_fail"

fallo_final=0

if [ "$node_active_total" -ne 121 ]; then
  echo "NODE_ACTIVE_TOTAL_INESPERADO: se esperaban 121 contratos activos Node, el manifiesto tiene $node_active_total." >&2
  fallo_final=1
fi
if [ "$node_active_fail" -ne 0 ]; then
  echo "NODE_ACTIVE_FAIL_DETECTADO ($node_active_fail):" >&2
  printf '  - %s\n' "${FALLOS_ACTIVOS[@]}" >&2
  fallo_final=1
fi
if [ "$infra_fail" -ne 0 ]; then
  echo "INFRA_FAIL_DETECTADO ($infra_fail) -- una utilidad o diagnóstico se bloqueó o lanzó una excepción:" >&2
  printf '  - %s\n' "${FALLOS_INFRA[@]}" >&2
  fallo_final=1
fi

# ---- 7. Verificación de limpieza: el árbol debe quedar limpio salvo los
# propios entregables de cierre-proyecto-a/punto2/. Se comprueba DESPUÉS
# de haber calculado e impreso el veredicto de arriba, nunca antes -- así
# un árbol sucio nunca enmascara un fallo real de un contrato activo (ni
# al revés). ----
sucio=$(git status --porcelain -- . ":(exclude)cierre-proyecto-a/punto2/")
if [ -n "$sucio" ]; then
  echo "ARBOL_NO_LIMPIO_TRAS_LIMPIEZA:" >&2
  echo "$sucio" >&2
  fallo_final=1
else
  echo "ARBOL_LIMPIO_TRAS_EJECUCION=1"
fi

if [ "$fallo_final" -ne 0 ]; then
  echo "BATERIA_NO_DB_FALLO" >&2
  exit 1
fi

echo "BATERIA_NO_DB_COMPLETA"
