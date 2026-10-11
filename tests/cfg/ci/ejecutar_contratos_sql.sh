#!/usr/bin/env bash
# Capa de configuración (F6) · ejecuta los contratos SQL contra un PostgreSQL 16 efímero, construyendo la cadena de migraciones desde cero.
#
# Qué hace:
#   1. Construye la base «cfgchain»: el esquema de prueba (tests/f3/a08/fixture-a08.sql), las 19 migraciones F2/F3 (m01…A08, A09 y A11), los usuarios
#      de prueba (tests/cfg/local-fixture.sql), las migraciones A10, A10b, B04, PM10 (cierre de sesión), C04 y las piezas 1 a 5. En ese punto guarda una
#      copia («cfgchain5») para la prueba de actualización de D13. Después aplica D13, la pieza 6d y A09 eventos.
#   2. Ejecuta cada contrato SQL de tests/cfg en su propia base (copia de «cfgchain»), dentro de una transacción que termina en ROLLBACK, y exige:
#      cero fallos y el número exacto de comprobaciones (una consulta que falla a medias o un contrato recortado no pasan).
#   3. Ejecuta la prueba de actualización de D13 (tests/cfg/d13-upgrade.sh) y el contrato de la corrección de PM07 (tests/cfg/pm07-fix-run.sh).
#
# Necesita: un PostgreSQL 16 con un superusuario (variables PGHOST, PGPORT, PGUSER y, si hace falta, PGPASSWORD) y el cliente `psql`. No usa credenciales
# ni proyectos remotos. Termina con código distinto de 0 si algo falla. Escribe un resumen en tests/ci/evidencia/resultado_cfg_sql.tsv (ignorado por git).
#
# Variables opcionales: CFG_SQL_SOLO = lista de contratos separados por espacio para ejecutar solo esos (por ejemplo «cfg1 d13»).
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
export PGCLIENTENCODING=UTF8
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"

CAD=cfgchain
CAD5=cfgchain5
EVID="tests/ci/evidencia"
OUT="$EVID/resultado_cfg_sql.tsv"
mkdir -p "$EVID"
: > "$OUT"

psql -d postgres -tAc 'select 1' >/dev/null 2>&1 || { echo "SIN_POSTGRES: no hay conexión con PostgreSQL (revisa PGHOST/PGPORT/PGUSER/PGPASSWORD)" >&2; exit 2; }
VERSION=$(psql -d postgres -tAc 'show server_version_num' | tr -d '[:space:]')
[ "${VERSION:0:2}" = "16" ] || { echo "POSTGRES_VERSION_INESPERADA: se esperaba PostgreSQL 16, server_version_num=$VERSION" >&2; exit 2; }
echo "POSTGRES_VERSION_VERIFICADA=16"

mig() { echo "supabase/migrations/$1.sql"; }
aplicar() { # aplicar <base> <migración>...
  local base="$1"; shift
  for m in "$@"; do
    psql -q -d "$base" -v ON_ERROR_STOP=1 -f "$(mig "$m")" >/dev/null 2>"$EVID/err_cfg.txt" || { echo "FALLA_AL_APLICAR: $m"; tail -3 "$EVID/err_cfg.txt"; exit 3; }
  done
}

# ---------------------------------------------------------------- 1. cadena
for d in "$CAD" "$CAD5"; do psql -q -d postgres -c "drop database if exists $d" >/dev/null; done
psql -q -d postgres -c "create database $CAD" >/dev/null || exit 3
psql -q -d "$CAD" -v ON_ERROR_STOP=1 -f tests/f3/a08/fixture-a08.sql >/dev/null 2>"$EVID/err_cfg.txt" || { echo "FALLA_FIXTURE_A08"; tail -3 "$EVID/err_cfg.txt"; exit 3; }
aplicar "$CAD" \
  20260923210000_abc_f2_m01_base_transaccional_caja 20260923210100_abc_f2_m01b_acl_hardening 20260923220000_abc_f2_m02a_core_comercial_fiscal \
  20260923230000_abc_f2_m02b_pagos_reservas_reembolsos 20260923233000_abc_f2_m03a_autoridad_transaccional 20260923234500_abc_f2_m03b_checkout_cobro \
  20260923235900_abc_f2_m03c_reembolsos_transaccionales 20260924001000_abc_f2_m04a_caja_sesiones 20260924002000_abc_f2_m04b_movimientos_caja \
  20260924003000_abc_f2_m04c_outbox_persistente 20260924004000_abc_f2_m04d_acl_parity 20260924010000_abc_f3_a03_server_authority \
  20260924020000_abc_f3_a04_variants_modifiers 20260924030000_abc_f3_a05_order_state_machine 20260924040000_abc_f3_a06_account_recovery \
  20260924050000_abc_f3_a07_tables_zones 20260924060000_abc_f3_a08_account_split_merge 20260924160739_abc_f3_a09_descuentos_cortesias \
  20260926203000_abc_f3_a02_operating_day_a11
psql -q -d "$CAD" -v ON_ERROR_STOP=1 -f tests/cfg/local-fixture.sql >/dev/null 2>"$EVID/err_cfg.txt" || { echo "FALLA_LOCAL_FIXTURE"; tail -3 "$EVID/err_cfg.txt"; exit 3; }
aplicar "$CAD" \
  20260926110000_abc_f3_a10_kitchen_commands 20260926140000_abc_f3_a10b_kitchen_audit 20260929213000_abc_f4_b04_unknown_payment \
  20260928223000_pm10_cierre_sesion_caja 20261001140000_abc_f5_c04_close_reopen \
  20261002190000_abc_config_pieza1_dia_cajas 20261002210000_abc_config_pieza2_diferencia_caja 20261002220000_abc_config_pieza3_modalidades \
  20261002230000_abc_config_pieza4_equipos 20261002240000_abc_config_pieza5_permisos
psql -q -d postgres -c "create database $CAD5 template $CAD" >/dev/null || exit 3   # copia «antes de D13»
aplicar "$CAD" 20261003100000_abc_config_d13_reembolsos_aprobacion 20261002250000_abc_config_pieza6d_dia_operativo 20261003120000_abc_a09_eventos_descuento_cuenta
echo "CADENA_CONSTRUIDA: $CAD (hasta A09 eventos) y $CAD5 (hasta la pieza 5)"

# ---------------------------------------------------------------- 2. contratos SQL (nombre:archivo:comprobaciones esperadas)
CONTRATOS=(
  "cfg1:tests/cfg/cfg1-contract.sql:102"
  "cfg2:tests/cfg/cfg2-contract.sql:201"
  "cfg3:tests/cfg/cfg3-contract.sql:79"
  "cfg4:tests/cfg/cfg4-contract.sql:72"
  "cfg5:tests/cfg/cfg5-contract.sql:154"
  "cfg6d:tests/cfg/cfg6d-contract.sql:56"
  "d13:tests/cfg/d13-contract.sql:85"
  "a09ev:tests/cfg/a09-eventos-contract.sql:40"
)
FALLOS=0
RESUMEN='select jsonb_build_object($$total$$, jsonb_array_length(l), $$fallos$$, (select count(*) from jsonb_array_elements(l) x where x->>$$res$$ not in ($$OK$$,$$NEGATIVA_OK$$))) as registro from (select current_setting($$la.log$$)::jsonb as l) q;'
for c in "${CONTRATOS[@]}"; do
  IFS=: read -r nombre archivo esperado <<<"$c"
  if [ -n "${CFG_SQL_SOLO:-}" ] && [[ " $CFG_SQL_SOLO " != *" $nombre "* ]]; then continue; fi
  psql -q -d postgres -c "drop database if exists cfgrun" -c "create database cfgrun template $CAD" >/dev/null || exit 3
  res=$({ echo "begin;"; cat "$archivo"; echo "$RESUMEN"; echo "rollback;"; } | psql -d cfgrun -tA -q -v ON_ERROR_STOP=1 2>&1 | grep -v '^$' | tail -1)
  total=$(echo "$res" | sed -n 's/.*"total": *\([0-9]*\).*/\1/p'); fallos=$(echo "$res" | sed -n 's/.*"fallos": *\([0-9]*\).*/\1/p')
  if [ "${fallos:-x}" = "0" ] && [ "${total:-x}" = "$esperado" ]; then estado=PASS; else estado=FAIL; FALLOS=$((FALLOS+1)); fi
  printf '%s\t%s\ttotal=%s\tfallos=%s\tesperado=%s\n' "$estado" "$nombre" "${total:-?}" "${fallos:-?}" "$esperado" | tee -a "$OUT"
  [ "$estado" = FAIL ] && echo "   $res" | cut -c1-400
done

# ---------------------------------------------------------------- 3. D13 (actualización) y PM07 (corrección)
if [ -z "${CFG_SQL_SOLO:-}" ] || [[ " $CFG_SQL_SOLO " == *" d13up "* ]]; then
  if TEMPLATE="$CAD5" bash tests/cfg/d13-upgrade.sh >"$EVID/d13_upgrade.txt" 2>&1; then estado=PASS; else estado=FAIL; FALLOS=$((FALLOS+1)); tail -5 "$EVID/d13_upgrade.txt" | cut -c1-300; fi
  printf '%s\td13-upgrade\n' "$estado" | tee -a "$OUT"
fi
if [ -z "${CFG_SQL_SOLO:-}" ] || [[ " $CFG_SQL_SOLO " == *" pm07fix "* ]]; then
  if bash tests/cfg/pm07-fix-run.sh >"$EVID/pm07_fix.txt" 2>&1; then estado=PASS; else estado=FAIL; FALLOS=$((FALLOS+1)); tail -5 "$EVID/pm07_fix.txt" | cut -c1-300; fi
  printf '%s\tpm07-fix\n' "$estado" | tee -a "$OUT"
fi

for d in cfgrun "$CAD" "$CAD5"; do psql -q -d postgres -c "drop database if exists $d" >/dev/null 2>&1; done
if [ "$FALLOS" -gt 0 ]; then echo "CFG_SQL_FALLOS=$FALLOS"; exit 1; fi
echo "CFG_SQL_OK"
