#!/usr/bin/env bash
# PM26 P08e -- valida en PostgreSQL local aislado la PRECONDICION de
# autorizacion del Defecto L: que exista una membresia activa y
# coherente antes de aplicar la migracion.
#
# Reproduce el estado REAL de produccion (membresias_usuario vacia) y
# comprueba que el preflight endurecido lo rechaza de forma explicita,
# ademas de los casos de membresia incoherente, membresia valida,
# empresa/local ajenos, usuario sin membresia, lecturas y borrados
# cruzados, reaplicacion, rollback y compatibilidad con el parche P08d.
#
# Nunca toca produccion, QA ni TPV: crea y destruye su propia base
# temporal. No aplica ninguna migracion en ningun entorno real.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="$DIR/../p08-defecto-l-produccion"
MIGRACION="$BASE/migracion-propuesta.sql"
PREFLIGHT="$BASE/preflight-independiente.sql"
REVERTIR="$BASE/revertir.sql"
DB="pm26_p08e_$$"
PSQL="${POSTGRES_PSQL:-psql}"
RUN_AS_POSTGRES="${POSTGRES_SUDO:-sudo -u postgres}"

fallo() { echo "PM26_P08E_FALLO: $1" >&2; exit 1; }
limpiar() { $RUN_AS_POSTGRES $PSQL -c "drop database if exists \"$DB\" with (force);" >/dev/null 2>&1 || true; }
trap limpiar EXIT

if [ -n "${PGHOST:-}" ]; then
  case "$PGHOST" in
    /*|localhost|127.0.0.1|::1) : ;;
    *) fallo "PGHOST apunta a un host no local ($PGHOST) -- esta prueba solo corre contra PostgreSQL local aislado" ;;
  esac
fi
for f in "$MIGRACION" "$PREFLIGHT" "$REVERTIR" "$DIR/comportamiento-membresias.sql"; do
  [ -f "$f" ] || fallo "no se encuentra $f"
done
echo "PM26_P08E_ENTORNO_LOCAL=PASS"

psql_archivo() { cat "$1" | $RUN_AS_POSTGRES $PSQL -d "$DB" -v ON_ERROR_STOP=1; }
consulta() { $RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "$1"; }
ejecutar() { $RUN_AS_POSTGRES $PSQL -d "$DB" -v ON_ERROR_STOP=1 -c "$1" >/dev/null; }

limpiar
$RUN_AS_POSTGRES $PSQL -c "create database \"$DB\";" >/dev/null
psql_archivo "$BASE/schema.sql" >/dev/null || fallo "no se pudo aplicar schema.sql"
psql_archivo "$BASE/seed.sql" >/dev/null || fallo "no se pudo aplicar seed.sql"
echo "PM26_P08E_ESQUEMA_Y_SEED=PASS"

# ===================================================================
# A) Estado REAL de produccion hoy: membresias_usuario vacia.
#    El preflight debe rechazarlo de forma explicita.
# ===================================================================
ejecutar "delete from public.membresias_usuario;"
[ "$(consulta "select count(*) from public.membresias_usuario;")" = "0" ] || fallo "no se pudo vaciar membresias_usuario"

SALIDA_VACIA="$(psql_archivo "$PREFLIGHT" 2>&1 || true)"
echo "$SALIDA_VACIA" | grep -q "membresias_usuario no tiene ninguna fila activa" \
  || { echo "$SALIDA_VACIA" >&2; fallo "el preflight debia rechazar el estado de 0 membresias con mensaje explicito"; }
echo "PM26_P08E_CERO_MEMBRESIAS_PREFLIGHT_RECHAZA=PASS"

# La migracion completa tambien debe abortar, no solo el preflight suelto.
SALIDA_MIG="$(psql_archivo "$MIGRACION" 2>&1 || true)"
echo "$SALIDA_MIG" | grep -q "PREFLIGHT_FALLO" \
  || { echo "$SALIDA_MIG" >&2; fallo "la migracion debia abortar con 0 membresias"; }
COLS="$(consulta "select count(*) from information_schema.columns where table_schema='public' and table_name='prefiltros_candidatos' and column_name in ('empresa_id','local_id');")"
[ "$COLS" = "0" ] || fallo "la migracion abortada no debia dejar columnas creadas, encontrado $COLS"
echo "PM26_P08E_CERO_MEMBRESIAS_MIGRACION_ABORTA=PASS"

# Restaura las membresias sembradas.
psql_archivo "$BASE/seed.sql" >/dev/null 2>&1 || true
ejecutar "insert into public.membresias_usuario (user_id, empresa_id, local_id, todos_locales, rol, activo)
  select '11111111-1111-1111-1111-111111111111','EMPRESA_A',null,true,'Propietario',true
  where not exists (select 1 from public.membresias_usuario where user_id='11111111-1111-1111-1111-111111111111');"
ejecutar "insert into public.membresias_usuario (user_id, empresa_id, local_id, todos_locales, rol, activo)
  select '22222222-2222-2222-2222-222222222222','EMPRESA_A','LOCAL_A1',false,'Propietario',true
  where not exists (select 1 from public.membresias_usuario where user_id='22222222-2222-2222-2222-222222222222');"
ejecutar "insert into public.membresias_usuario (user_id, empresa_id, local_id, todos_locales, rol, activo)
  select '44444444-4444-4444-4444-444444444444','EMPRESA_B',null,true,'Propietario',true
  where not exists (select 1 from public.membresias_usuario where user_id='44444444-4444-4444-4444-444444444444');"
ejecutar "insert into public.membresias_usuario (user_id, empresa_id, local_id, todos_locales, rol, activo)
  select '55555555-5555-5555-5555-555555555555','EMPRESA_A','LOCAL_A1',false,'Propietario',true
  where not exists (select 1 from public.membresias_usuario where user_id='55555555-5555-5555-5555-555555555555');"

# ===================================================================
# B) Un Propietario activo sin membresia coherente tambien se rechaza.
# ===================================================================
ejecutar "update public.membresias_usuario set activo=false where user_id='22222222-2222-2222-2222-222222222222';"
SALIDA_SIN="$(psql_archivo "$PREFLIGHT" 2>&1 || true)"
echo "$SALIDA_SIN" | grep -q "propietario(s) activo(s) sin membresia activa y coherente" \
  || { echo "$SALIDA_SIN" >&2; fallo "el preflight debia rechazar un Propietario activo sin membresia"; }
ejecutar "update public.membresias_usuario set activo=true where user_id='22222222-2222-2222-2222-222222222222';"
echo "PM26_P08E_PROPIETARIO_SIN_MEMBRESIA_RECHAZADO=PASS"

# ===================================================================
# C) Membresia presente pero INCOHERENTE con lo que exige el helper:
#    local_id = 'TODOS' sin todos_locales. la_tiene_local lo rechaza,
#    asi que el preflight tambien debe hacerlo.
# ===================================================================
ejecutar "update public.membresias_usuario set local_id='TODOS', todos_locales=false where user_id='22222222-2222-2222-2222-222222222222';"
SALIDA_INC="$(psql_archivo "$PREFLIGHT" 2>&1 || true)"
echo "$SALIDA_INC" | grep -q "propietario(s) activo(s) sin membresia activa y coherente" \
  || { echo "$SALIDA_INC" >&2; fallo "el preflight debia rechazar una membresia incoherente (local TODOS sin todos_locales)"; }
ejecutar "update public.membresias_usuario set local_id='LOCAL_A1', todos_locales=false where user_id='22222222-2222-2222-2222-222222222222';"
echo "PM26_P08E_MEMBRESIA_INCOHERENTE_RECHAZADA=PASS"

# ===================================================================
# D) Con membresias validas y coherentes, el preflight pasa.
# ===================================================================
SALIDA_OK="$(psql_archivo "$PREFLIGHT" 2>&1)" || { echo "$SALIDA_OK" >&2; fallo "el preflight debia pasar con membresias validas"; }
echo "$SALIDA_OK" | grep -q "PREFLIGHT_CATALOGO=PASS" || fallo "el preflight no emitio PREFLIGHT_CATALOGO=PASS"
echo "PM26_P08E_MEMBRESIA_VALIDA_PREFLIGHT_PASA=PASS"

# ===================================================================
# E) Aplicacion y bateria de comportamiento ligada a la membresia.
# ===================================================================
psql_archivo "$MIGRACION" >/dev/null || fallo "la migracion no se aplico con membresias validas"
echo "PM26_P08E_MIGRACION_APLICADA=PASS"

SALIDA_M="$(psql_archivo "$DIR/comportamiento-membresias.sql" 2>&1)" \
  || { echo "$SALIDA_M" >&2; fallo "la bateria de membresias fallo al ejecutarse"; }
echo "$SALIDA_M" | grep -q "=FAIL" && { echo "$SALIDA_M" | grep "=FAIL" >&2; fallo "hay casos en FAIL en la bateria de membresias"; }
for n in M1 M2 M3 M4 M5 M6 M7 M8; do
  echo "$SALIDA_M" | grep -q "$n=PASS" || { echo "$SALIDA_M" >&2; fallo "falta o no paso el caso $n"; }
done
echo "PM26_P08E_BATERIA_MEMBRESIAS=PASS"

# ===================================================================
# F) Reaplicacion rechazada y rollback controlado.
# ===================================================================
REAPLICAR="$(psql_archivo "$MIGRACION" 2>&1 || true)"
echo "$REAPLICAR" | grep -q "PREFLIGHT_FALLO" || fallo "reaplicar la migracion debia fallar"
echo "PM26_P08E_REAPLICACION_RECHAZADA=PASS"

ejecutar "delete from public.prefiltros_candidatos;"
psql_archivo "$REVERTIR" >/dev/null || fallo "la reversion no se aplico limpiamente"
COLS_TRAS="$(consulta "select count(*) from information_schema.columns where table_schema='public' and table_name='prefiltros_candidatos' and column_name in ('empresa_id','local_id');")"
[ "$COLS_TRAS" = "0" ] || fallo "tras revertir no deberian quedar las columnas, encontrado $COLS_TRAS"
echo "PM26_P08E_ROLLBACK_CONTROLADO=PASS"

# Tras revertir, con las membresias todavia validas, el preflight vuelve
# a pasar -- salvo por el Propietario sin membresia que anadio la
# bateria (usuario 6), que debe seguir bloqueando. Eso confirma que el
# guard no es un chequeo de una sola vez.
SALIDA_TRAS="$(psql_archivo "$PREFLIGHT" 2>&1 || true)"
echo "$SALIDA_TRAS" | grep -q "propietario(s) activo(s) sin membresia activa y coherente" \
  || { echo "$SALIDA_TRAS" >&2; fallo "tras revertir, el guard debia seguir detectando al Propietario sin membresia"; }
echo "PM26_P08E_GUARD_SIGUE_ACTIVO_TRAS_REVERTIR=PASS"

echo "PM26_P08E_VALIDACION_COMPLETA=PASS"
