#!/usr/bin/env bash
# PM26 P08g -- valida en PostgreSQL local aislado el catalogo de
# empresas/locales y la plantilla de bootstrap de membresia.
#
# La plantilla real (bootstrap-membresia-plantilla.sql) contiene
# marcadores <<...>> sin ningun valor real: este script los sustituye
# por identificadores SINTETICOS solo para probar que el SQL es
# correcto y que el flujo completo funciona, nunca para crear nada
# real. Nunca toca produccion, QA ni TPV: crea y destruye su propia
# base temporal.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="$DIR/../p08-defecto-l-produccion"
CATALOGO="$DIR/catalogo-empresas-locales-propuesta.sql"
PLANTILLA="$DIR/bootstrap-membresia-plantilla.sql"
COMPORTAMIENTO="$DIR/comportamiento-catalogo.sql"
PREFLIGHT="$BASE/preflight-independiente.sql"
DB="pm26_p08g_$$"
PSQL="${POSTGRES_PSQL:-psql}"
RUN_AS_POSTGRES="${POSTGRES_SUDO:-sudo -u postgres}"

fallo() { echo "PM26_P08G_FALLO: $1" >&2; exit 1; }
limpiar() { $RUN_AS_POSTGRES $PSQL -c "drop database if exists \"$DB\" with (force);" >/dev/null 2>&1 || true; }
trap limpiar EXIT

if [ -n "${PGHOST:-}" ]; then
  case "$PGHOST" in
    /*|localhost|127.0.0.1|::1) : ;;
    *) fallo "PGHOST apunta a un host no local ($PGHOST) -- esta prueba solo corre contra PostgreSQL local aislado" ;;
  esac
fi
for f in "$CATALOGO" "$PLANTILLA" "$COMPORTAMIENTO" "$PREFLIGHT" "$BASE/schema.sql" "$BASE/seed.sql"; do
  [ -f "$f" ] || fallo "no se encuentra $f"
done
echo "PM26_P08G_ENTORNO_LOCAL=PASS"

psql_stdin() { $RUN_AS_POSTGRES $PSQL -d "$DB" -v ON_ERROR_STOP=1; }
consulta() { $RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "$1"; }

limpiar
$RUN_AS_POSTGRES $PSQL -c "create database \"$DB\";" >/dev/null
cat "$BASE/schema.sql" | psql_stdin >/dev/null || fallo "no se pudo aplicar schema.sql"
cat "$BASE/seed.sql" | psql_stdin >/dev/null || fallo "no se pudo aplicar seed.sql"
echo "PM26_P08G_ESQUEMA_Y_SEED=PASS"

# ===================================================================
# A) El catalogo no existe todavia -- estado real de produccion hoy.
# ===================================================================
EXISTE_ANTES="$(consulta "select to_regclass('public.empresas') is not null;")"
[ "$EXISTE_ANTES" = "f" ] || fallo "el catalogo no deberia existir antes de aplicar la propuesta"
echo "PM26_P08G_CATALOGO_NO_EXISTE_ANTES=PASS"

# ===================================================================
# B) Aplica el catalogo y su bateria de comportamiento.
# ===================================================================
cat "$CATALOGO" | psql_stdin >/dev/null || fallo "no se pudo aplicar catalogo-empresas-locales-propuesta.sql"
echo "PM26_P08G_CATALOGO_APLICADO=PASS"

SALIDA_C="$(cat "$COMPORTAMIENTO" | $RUN_AS_POSTGRES $PSQL -d "$DB" -v ON_ERROR_STOP=1 2>&1)" \
  || { echo "$SALIDA_C" >&2; fallo "la bateria de comportamiento del catalogo fallo al ejecutarse"; }
echo "$SALIDA_C" | grep -q "=FAIL" && { echo "$SALIDA_C" | grep "=FAIL" >&2; fallo "hay casos en FAIL en la bateria del catalogo"; }
for n in C1 C2 C3 C4 C5; do
  echo "$SALIDA_C" | grep -q "$n=PASS" || { echo "$SALIDA_C" >&2; fallo "falta o no paso el caso $n"; }
done
echo "PM26_P08G_BATERIA_CATALOGO=PASS"

# Reaplicar debe ser idempotente (create table/policy if not exists,
# y los revoke no fallan si ya estaban revocados).
cat "$CATALOGO" | psql_stdin >/dev/null || fallo "la reaplicacion del catalogo no fue idempotente"
echo "PM26_P08G_CATALOGO_REAPLICACION_IDEMPOTENTE=PASS"

# ===================================================================
# C) La plantilla de bootstrap, probada con valores SINTETICOS. Nunca
#    se ejecuta la plantilla real: se sustituyen los marcadores por
#    identificadores sinteticos (un solo digito repetido, igual que el
#    resto de la bateria de PM26) solo para esta prueba.
# ===================================================================
EMPRESA_SINT='EEEEEEEE'
LOCAL_SINT='LLLLLLLL'
UUID_SINT='99999999-9999-9999-9999-999999999999'
ejecutar_plantilla_sintetica() {
  sed \
    -e "s/<<EMPRESA_ID>>/$EMPRESA_SINT/g" \
    -e "s/<<EMPRESA_NOMBRE>>/Empresa sintetica P08g/g" \
    -e "s/<<LOCAL_ID>>/$LOCAL_SINT/g" \
    -e "s/<<LOCAL_NOMBRE>>/Local sintetico P08g/g" \
    -e "s/<<UUID_PROPIETARIO>>/$UUID_SINT/g" \
    "$PLANTILLA" | psql_stdin
}
# La plantilla referencia un user_id de auth.users por FK implicita de
# membresias_usuario (no hay FK real, pero refleja el uso real): se
# registra el usuario sintetico primero, como en cualquier alta real.
$RUN_AS_POSTGRES $PSQL -d "$DB" -v ON_ERROR_STOP=1 -c "insert into auth.users (id) values ('$UUID_SINT') on conflict do nothing;" >/dev/null

ejecutar_plantilla_sintetica >/dev/null || fallo "la plantilla de bootstrap (con valores sinteticos) no se aplico limpia"
echo "PM26_P08G_PLANTILLA_APLICADA=PASS"

FILAS_EMPRESA="$(consulta "select count(*) from public.empresas where id = '$EMPRESA_SINT';")"
FILAS_LOCAL="$(consulta "select count(*) from public.locales where id = '$LOCAL_SINT';")"
FILAS_MEMBRESIA="$(consulta "select count(*) from public.membresias_usuario where user_id = '$UUID_SINT' and empresa_id = '$EMPRESA_SINT' and activo = true;")"
[ "$FILAS_EMPRESA" = "1" ] || fallo "la plantilla no creo exactamente 1 fila de empresa, encontrado $FILAS_EMPRESA"
[ "$FILAS_LOCAL" = "1" ] || fallo "la plantilla no creo exactamente 1 fila de local, encontrado $FILAS_LOCAL"
[ "$FILAS_MEMBRESIA" = "1" ] || fallo "la plantilla no creo exactamente 1 fila de membresia, encontrado $FILAS_MEMBRESIA"
echo "PM26_P08G_PLANTILLA_CREA_EXACTAMENTE_UNA_FILA_CADA_UNA=PASS"

# Reaplicar la plantilla debe ser idempotente: no debe duplicar nada.
ejecutar_plantilla_sintetica >/dev/null || fallo "la reaplicacion de la plantilla fallo"
FILAS_MEMBRESIA_TRAS="$(consulta "select count(*) from public.membresias_usuario where user_id = '$UUID_SINT' and empresa_id = '$EMPRESA_SINT';")"
[ "$FILAS_MEMBRESIA_TRAS" = "1" ] || fallo "la reaplicacion de la plantilla duplico la membresia, encontrado $FILAS_MEMBRESIA_TRAS"
echo "PM26_P08G_PLANTILLA_REAPLICACION_IDEMPOTENTE=PASS"

# ===================================================================
# D) Con el catalogo y la membresia sintetica ya creados, el preflight
#    endurecido de P08e sigue pasando (el catalogo es una precondicion
#    adicional -- construida al margen -- no una que el guard actual
#    compruebe todavia; el guard sigue validando solo lo que P08e
#    documenta que valida: presencia y coherencia estructural).
# ===================================================================
SALIDA_PRE="$(cat "$PREFLIGHT" | $RUN_AS_POSTGRES $PSQL -d "$DB" -v ON_ERROR_STOP=1 2>&1)" \
  || { echo "$SALIDA_PRE" >&2; fallo "el preflight de P08e debia seguir pasando tras crear el catalogo y la membresia"; }
echo "$SALIDA_PRE" | grep -q "PREFLIGHT_CATALOGO=PASS" || { echo "$SALIDA_PRE" >&2; fallo "el preflight no emitio PREFLIGHT_CATALOGO=PASS"; }
echo "PM26_P08G_PREFLIGHT_P08E_SIGUE_PASANDO=PASS"

echo "PM26_P08G_VALIDACION_COMPLETA=PASS"
