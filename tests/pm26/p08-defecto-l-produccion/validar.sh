#!/usr/bin/env bash
# PM26 P08 -- valida de punta a punta, en un Postgres local aislado
# (nunca contra QA ni produccion), la propuesta del Defecto L: anadir
# aislamiento por empresa/local a prefiltros_candidatos en PRODUCCION,
# reutilizando el helper private.la_tiene_local ya vigente y probado
# ahi mismo (movimientos_stock, stock_operaciones, stock_ubicacion).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRACION="$DIR/migracion-propuesta.sql"
PREFLIGHT="$DIR/preflight-independiente.sql"
DB="pm26_p08_defecto_l_$$"
PSQL="${POSTGRES_PSQL:-psql}"
RUN_AS_POSTGRES="${POSTGRES_SUDO:-sudo -u postgres}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"; $RUN_AS_POSTGRES $PSQL -c "drop database if exists \"$DB\";" >/dev/null 2>&1 || true' EXIT

fallo() { echo "PM26_P08_FALLO: $1" >&2; exit 1; }

psql_archivo() {
  local archivo="$1" db="$2"
  cat "$archivo" | $RUN_AS_POSTGRES $PSQL -d "$db" -v ON_ERROR_STOP=1
}

[ -f "$MIGRACION" ] || fallo "no se encuentra la migracion propuesta en $MIGRACION"
[ -f "$PREFLIGHT" ] || fallo "no se encuentra el preflight independiente en $PREFLIGHT"
if [ -f "/home/user/Almacen/supabase/migrations/$(basename "$MIGRACION")" ] || [ -f "/home/user/Almacen/supabase/qa-solo/$(basename "$MIGRACION")" ]; then
  fallo "la migracion propuesta del Defecto L no debe existir dentro de supabase/ -- no esta autorizada su aplicacion"
fi
echo "PM26_P08_FUERA_DE_SUPABASE=PASS"

$RUN_AS_POSTGRES $PSQL -c "drop database if exists \"$DB\";" >/dev/null
$RUN_AS_POSTGRES $PSQL -c "create database \"$DB\";" >/dev/null

psql_archivo "$DIR/schema.sql" "$DB" >/dev/null \
  || fallo "no se pudo aplicar schema.sql"
echo "PM26_P08_SCHEMA=PASS"

psql_archivo "$DIR/seed.sql" "$DB" >/dev/null \
  || fallo "no se pudo aplicar seed.sql"
echo "PM26_P08_SEED=PASS"

# --- Positivo: el preflight independiente, de solo lectura, pasa sobre
# el catalogo aislado limpio (las 3 politicas reales de produccion,
# sin aislamiento todavia). ---
PREFLIGHT_OK="$(psql_archivo "$PREFLIGHT" "$DB" 2>&1)" \
  || { echo "$PREFLIGHT_OK" >&2; fallo "el preflight independiente no paso sobre el catalogo limpio"; }
echo "$PREFLIGHT_OK" | grep -q "PREFLIGHT_CATALOGO=PASS" \
  || fallo "el preflight independiente no emitio PREFLIGHT_CATALOGO=PASS"
echo "PM26_P08_PREFLIGHT_INDEPENDIENTE=PASS"

# --- Negativo: simular un catalogo distinto (renombrar una politica
# real, dentro de una transaccion que se revierte) -- el preflight debe
# abortar por no encontrar las 3 politicas esperadas. ---
$RUN_AS_POSTGRES $PSQL -d "$DB" -c \
  'alter policy "prefiltros - propietario lee" on public.prefiltros_candidatos using (true);' >/dev/null
NEG_CATALOGO="$(psql_archivo "$PREFLIGHT" "$DB" 2>&1 || true)"
echo "$NEG_CATALOGO" | grep -q "PREFLIGHT_FALLO" \
  || fallo "el preflight debia fallar al detectar un catalogo distinto, y no fallo"
$RUN_AS_POSTGRES $PSQL -d "$DB" -c \
  "alter policy \"prefiltros - propietario lee\" on public.prefiltros_candidatos using (exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = true and p.rol = 'Propietario'::text));" >/dev/null
echo "PM26_P08_PREFLIGHT_DETECTA_CATALOGO_DISTINTO=PASS"

# --- Negativo: simular una fila existente -- el preflight debe abortar
# porque exige 0 filas. ---
$RUN_AS_POSTGRES $PSQL -d "$DB" -c \
  "insert into public.prefiltros_candidatos (token, candidato_nombre) values ('token-simulado', 'Simulado');" >/dev/null
NEG_FILAS="$(psql_archivo "$PREFLIGHT" "$DB" 2>&1 || true)"
echo "$NEG_FILAS" | grep -q "PREFLIGHT_FALLO" \
  || fallo "el preflight debia fallar al encontrar una fila existente simulada, y no fallo"
$RUN_AS_POSTGRES $PSQL -d "$DB" -c \
  "delete from public.prefiltros_candidatos where token='token-simulado';" >/dev/null
echo "PM26_P08_PREFLIGHT_DETECTA_FILAS_EXISTENTES=PASS"

FILAS_TRAS_LIMPIEZA="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from public.prefiltros_candidatos;")"
[ "$FILAS_TRAS_LIMPIEZA" = "0" ] || fallo "tras limpiar los simulacros deberian quedar 0 filas, encontrado $FILAS_TRAS_LIMPIEZA"

# --- Aplicar la migracion propuesta (positivo). ---
psql_archivo "$MIGRACION" "$DB" >/dev/null \
  || fallo "la migracion propuesta no se aplico limpiamente"
echo "PM26_P08_MIGRACION_APLICADA=PASS"

# --- Bateria de comportamiento. ---
SALIDA="$(psql_archivo "$DIR/comportamiento.sql" "$DB" 2>&1)" \
  || { echo "$SALIDA" >&2; fallo "la bateria de comportamiento fallo al ejecutarse"; }
echo "$SALIDA" > "$WORKDIR/comportamiento.txt"
FALLOS="$(grep -c '=FAIL' "$WORKDIR/comportamiento.txt" || true)"
if [ "$FALLOS" != "0" ]; then
  grep '=FAIL' "$WORKDIR/comportamiento.txt" >&2
  fallo "$FALLOS caso(s) de la bateria de comportamiento fallaron"
fi
for n in P1 P2 P3 N4 N5 N6 N7 N8 P9 N10 P11 N12 N12_SIN_RESIDUO_BORRADO N13; do
  # psql antepone "NOTICE:  " a cada linea -- no anclar a inicio de linea.
  grep -q "$n=PASS" "$WORKDIR/comportamiento.txt" || { echo "$SALIDA" >&2; fallo "falta o no paso el caso $n"; }
done
echo "PM26_P08_BATERIA_CASOS=PASS"

# --- Reaplicar inmediatamente despues debe fallar (columnas ya existen). ---
REAPLICAR="$(psql_archivo "$MIGRACION" "$DB" 2>&1 || true)"
echo "$REAPLICAR" | grep -q "PREFLIGHT_FALLO" \
  || fallo "reaplicar la migracion inmediatamente despues debia fallar por PREFLIGHT_FALLO y no fallo"
echo "PM26_P08_REAPLICACION_RECHAZADA=PASS"

# --- La bateria de comportamiento dejo filas de prueba (tok-p1,
# tok-p2) -- revertir.sql NO las borra a proposito (un revert real no
# debe destruir datos); aqui, solo en este arnes aislado, se limpian
# para que el preflight de "tabla vacia" pueda volver a pasar despues
# de revertir. ---
$RUN_AS_POSTGRES $PSQL -d "$DB" -c "delete from public.prefiltros_candidatos;" >/dev/null \
  || fallo "no se pudieron limpiar las filas de prueba antes de revertir"

# --- Reversion exacta. ---
psql_archivo "$DIR/revertir.sql" "$DB" >/dev/null \
  || fallo "la reversion no se aplico limpiamente"

COLUMNAS_TRAS_REVERTIR="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from information_schema.columns where table_schema='public' and table_name='prefiltros_candidatos' and column_name in ('empresa_id','local_id');")"
[ "$COLUMNAS_TRAS_REVERTIR" = "0" ] || fallo "tras revertir no deberian quedar las columnas empresa_id/local_id, encontrado $COLUMNAS_TRAS_REVERTIR"
echo "PM26_P08_REVERSION_EXACTA=PASS"

PREFLIGHT_TRAS_REVERTIR="$(psql_archivo "$PREFLIGHT" "$DB" 2>&1)" \
  || { echo "$PREFLIGHT_TRAS_REVERTIR" >&2; fallo "el preflight independiente debia volver a pasar tras revertir"; }
echo "$PREFLIGHT_TRAS_REVERTIR" | grep -q "PREFLIGHT_CATALOGO=PASS" \
  || fallo "el preflight independiente no volvio a pasar tras revertir"
echo "PM26_P08_PREFLIGHT_PASA_TRAS_REVERTIR=PASS"

# --- Reaplicar limpio tras revertir (la tabla ya quedo vacia antes de
# revertir). ---
psql_archivo "$MIGRACION" "$DB" >/dev/null \
  || fallo "no se pudo reaplicar la migracion propuesta tras revertir"
echo "PM26_P08_REAPLICACION_LIMPIA_TRAS_REVERTIR=PASS"

echo "PM26_P08_VALIDACION_COMPLETA=PASS"
