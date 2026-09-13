#!/usr/bin/env bash
# PM26 P08d -- valida el candidato exacto de despliegue del Defecto L
# sobre un worktree TEMPORAL creado desde el SHA exacto de release.
#
# Demuestra que el parche:
#   1. aplica limpio sobre release (git apply --check y aplicacion real),
#   2. toca EXCLUSIVAMENTE fuente.js y source-recovery/fuente-recuperado.js,
#   3. deja el cliente con el comportamiento del Defecto L y sin nada de
#      los paquetes K/F/H acumulados en la rama tecnica,
#   4. reconstruye de forma determinista,
#   5. no rompe ninguno de los contratos que release ya tiene,
#   6. revierte limpio dejando el arbol identico a release.
#
# No aplica ninguna migracion, no escribe en Supabase, no despliega en
# Netlify y no modifica release ni main: el worktree es efimero, esta en
# HEAD separado y se destruye al terminar.
set -euo pipefail

RELEASE_SHA='93a570badba1c5375febfbddc1dffdbcef003dcd'
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$DIR/../../.." && pwd)"
PARCHE="$DIR/defecto-l-cliente.patch"
WT="$(mktemp -d)/p08d-release"

fallo() { echo "PM26_P08D_FALLO: $1" >&2; exit 1; }

limpiar() {
  git -C "$RAIZ" worktree remove "$WT" --force >/dev/null 2>&1 || true
  rm -rf "$(dirname "$WT")" >/dev/null 2>&1 || true
}
trap limpiar EXIT

[ -f "$PARCHE" ] || fallo "no se encuentra el parche en $PARCHE"

# --- El parche solo puede tocar los dos archivos autorizados. ---
ARCHIVOS="$(grep '^diff --git ' "$PARCHE" | sed 's#^diff --git a/##; s# b/.*##' | sort -u)"
ESPERADOS="$(printf '%s\n' 'fuente.js' 'source-recovery/fuente-recuperado.js' | sort)"
[ "$ARCHIVOS" = "$ESPERADOS" ] || fallo "el parche toca archivos no autorizados:
$ARCHIVOS"
echo "PM26_P08D_PARCHE_SOLO_DOS_ARCHIVOS=PASS"

# --- Nada de K/F/H ni senales de QA en el contenido anadido. ---
AJENOS="$(grep '^+' "$PARCHE" | grep -E '__modoPruebasQA|__qaNubeUrl|pm11_(crear|eliminar)_prefiltro_candidato|origenSupabasePublicoPM26|invocarFuncionPublicaPM26' || true)"
[ -z "$AJENOS" ] || fallo "el parche arrastra contenido ajeno al Defecto L:
$AJENOS"
echo "PM26_P08D_SIN_ARRASTRE_K_F_H=PASS"

# --- Worktree efimero desde el SHA exacto de release. ---
git -C "$RAIZ" cat-file -e "${RELEASE_SHA}^{commit}" || fallo "el SHA de release no existe en este checkout"
git -C "$RAIZ" worktree add --detach "$WT" "$RELEASE_SHA" >/dev/null 2>&1 \
  || fallo "no se pudo crear el worktree temporal desde release"
[ "$(git -C "$WT" rev-parse HEAD)" = "$RELEASE_SHA" ] || fallo "el worktree no quedo en el SHA de release"
[ -z "$(git -C "$WT" status --porcelain)" ] || fallo "el worktree de partida no esta limpio"
echo "PM26_P08D_WORKTREE_DESDE_RELEASE=PASS"

# --- 1) git apply --check ---
git -C "$WT" apply --check "$PARCHE" || fallo "git apply --check fallo sobre release"
echo "PM26_P08D_APPLY_CHECK=PASS"

# --- 2) Aplicacion limpia ---
git -C "$WT" apply "$PARCHE" || fallo "la aplicacion del parche fallo"
CAMBIADOS="$(git -C "$WT" diff --name-only | sort)"
[ "$CAMBIADOS" = "$ESPERADOS" ] || fallo "tras aplicar, los archivos cambiados no son los esperados:
$CAMBIADOS"
node --check "$WT/fuente.js" || fallo "fuente.js parcheado no es JavaScript valido"
node --check "$WT/source-recovery/fuente-recuperado.js" || fallo "la fuente canonica parcheada no es JavaScript valida"
echo "PM26_P08D_APLICACION_LIMPIA=PASS"

# --- 3) Comportamiento del Defecto L presente en ambos artefactos ---
node -e "
const fs = require('fs');
const rutas = ['$WT/fuente.js', '$WT/source-recovery/fuente-recuperado.js'];
for (const ruta of rutas) {
  const s = fs.readFileSync(ruta, 'utf8');
  const comprobaciones = [
    ['firma con empresa/local', /function crearLogicaPrefiltros\(\{ registrarAuditoria, empresaId, localId \}\)/],
    ['call site pasa empresa', /empresaId: empresaDelLocalActivo\?\.id \|\| null/],
    ['call site pasa local', /localId: localActivoId \|\| null/],
    ['INSERT con empresa/local', /empresa_id: empresaId, local_id: localId/],
    ['DELETE con .select()', /\.delete\(\)\.eq\(\"token\", token\)\.select\(\)/],
    ['exige exactamente una fila', /!Array\.isArray\(data\) \|\| data\.length !== 1/],
  ];
  for (const [etiqueta, patron] of comprobaciones) {
    if (!patron.test(s)) { console.error('falta en ' + ruta + ': ' + etiqueta); process.exit(1); }
  }
  if (/__modoPruebasQA|pm11_crear_prefiltro_candidato|origenSupabasePublicoPM26/.test(s)) {
    console.error('el artefacto parcheado arrastra contenido de K/F: ' + ruta); process.exit(1);
  }
}
" || fallo "el comportamiento del Defecto L no quedo correctamente aplicado"
echo "PM26_P08D_COMPORTAMIENTO_DEFECTO_L=PASS"

# --- 4) Reversion limpia, comprobada con el arbol todavia intacto ---
# Se hace AQUI, antes de construir y de ejecutar la regresion, porque
# varios contratos de release regeneran como efecto colateral sus
# propios JSON de evidencia (tests/pm13). Comprobar la reversion antes
# permite exigir que el arbol ENTERO vuelva a ser identico a release,
# sin confundir ese ruido ajeno con un residuo del parche.
git -C "$WT" apply -R "$PARCHE" || fallo "la reversion del parche fallo"
[ -z "$(git -C "$WT" status --porcelain)" ] || fallo "tras revertir quedan cambios en el arbol"
[ -z "$(git -C "$WT" diff "$RELEASE_SHA" --name-only)" ] || fallo "tras revertir el arbol no es identico a release"
echo "PM26_P08D_REVERSION_LIMPIA=PASS"

# Se vuelve a aplicar para las pruebas de abajo: reaplicar sobre el
# arbol ya revertido demuestra ademas que el parche es idempotente.
git -C "$WT" apply --check "$PARCHE" || fallo "el parche no vuelve a aplicar tras revertir"
git -C "$WT" apply "$PARCHE" || fallo "la reaplicacion del parche fallo"
echo "PM26_P08D_REAPLICACION_TRAS_REVERTIR=PASS"

# --- 5) Build reproducible desde la fuente canonica parcheada ---
( cd "$WT/source-recovery" && npm ci --silent >/dev/null 2>&1 ) || fallo "npm ci fallo en el worktree"
( cd "$WT/source-recovery" && npm run build >/dev/null 2>&1 ) || fallo "el primer build fallo"
H1="$(sha256sum "$WT/source-recovery/dist/fuente.js" | cut -d' ' -f1)"
( cd "$WT/source-recovery" && npm run build >/dev/null 2>&1 ) || fallo "el segundo build fallo"
H2="$(sha256sum "$WT/source-recovery/dist/fuente.js" | cut -d' ' -f1)"
[ "$H1" = "$H2" ] || fallo "el build no es determinista: $H1 vs $H2"
node --check "$WT/source-recovery/dist/fuente.js" || fallo "el build no es JavaScript valido"
grep -q 'empresa_id: empresaId, local_id: localId' "$WT/source-recovery/dist/fuente.js" \
  || fallo "la logica del Defecto L no sobrevive al build"
echo "PM26_P08D_BUILD_DETERMINISTA=$H2"
echo "PM26_P08D_BUILD_REPRODUCIBLE=PASS"

# --- 6) Regresion: los contratos que release ya tiene siguen pasando ---
TOTAL=0; FALLOS=0
for d in tests/g1 tests/pm04 tests/pm05 tests/pm07 tests/pm08 tests/pm09 tests/pm10 \
         tests/pm11-compra tests/pm12 tests/pm13 tests/pm14 tests/pm15 tests/pm16 \
         tests/pm17 tests/pm18 tests/pm19 tests/pm20; do
  [ -d "$WT/$d" ] || continue
  for t in "$WT/$d"/*.mjs; do
    [ -f "$t" ] || continue
    TOTAL=$((TOTAL + 1))
    if ! ( cd "$WT" && node "${t#$WT/}" ) >/tmp/p08d_reg_$$.log 2>&1; then
      FALLOS=$((FALLOS + 1)); echo "FALLO: ${t#$WT/}" >&2; tail -8 /tmp/p08d_reg_$$.log >&2
    fi
  done
done
rm -f /tmp/p08d_reg_$$.log
[ "$TOTAL" -ge 100 ] || fallo "se esperaban al menos 100 contratos de release, se ejecutaron $TOTAL"
[ "$FALLOS" = "0" ] || fallo "$FALLOS contrato(s) de release fallaron con el parche aplicado"
echo "PM26_P08D_REGRESION_RELEASE=$TOTAL contratos, 0 fallos"
echo "PM26_P08D_REGRESION_RELEASE_COMPLETA=PASS"

# --- 7) Cierre: el parche sigue siendo lo unico que separa este arbol
# de release en los dos archivos autorizados, y su huella es la
# documentada. Los JSON de evidencia que regeneran algunos contratos de
# tests/pm13 quedan fuera de esta comprobacion a proposito: son ruido
# del arnes de pruebas, ajeno al parche. ---
RESTANTES="$(git -C "$WT" diff "$RELEASE_SHA" --name-only -- fuente.js source-recovery/fuente-recuperado.js | sort)"
[ "$RESTANTES" = "$ESPERADOS" ] || fallo "los archivos que difieren de release no son los dos autorizados:
$RESTANTES"
HASH_FUENTE="$(sha256sum "$WT/fuente.js" | cut -d' ' -f1)"
HASH_CANONICA="$(sha256sum "$WT/source-recovery/fuente-recuperado.js" | cut -d' ' -f1)"
echo "PM26_P08D_SHA_FUENTE_PARCHEADA=$HASH_FUENTE"
echo "PM26_P08D_SHA_CANONICA_PARCHEADA=$HASH_CANONICA"

echo "PM26_P08D_CANDIDATO_VALIDADO=PASS"
