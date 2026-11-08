#!/bin/bash
# PM-07 · ejecuta el contrato vivo de la corrección de `private.pm07_numero_catalogo` (migración 20261003130000) y sus pruebas de rechazo.
#
# Solo necesita un PostgreSQL con permiso para crear una base de datos y los roles `authenticated` (el contrato le da un permiso conocido a la función
# y comprueba que la migración lo conserva). Crea una base de usuario propia («pm07fix»), crea en ella el esquema `private` y la borra al terminar.
#   PGHOST=/tmp PGPORT=55432 PGUSER=postgres bash tests/cfg/pm07-fix-run.sh
# PM07_MIGRACION permite probar otra versión de la migración (mutantes). Termina con código distinto de 0 si algo falla.
set -u
cd "$(dirname "$0")/../.."
MIGRACION=${PM07_MIGRACION:-supabase/migrations/20261003130000_abc_pm07_correccion_numero_catalogo.sql}
CONTRATO=tests/cfg/pm07-fix-contract.sql
DB=pm07fix
FALLOS=0
fallo() { echo "FALLA: $1"; FALLOS=$((FALLOS+1)); }

psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null || exit 2
export PGDATABASE=$DB
psql -q -v ON_ERROR_STOP=1 -c "create schema private" -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end \$\$" >/dev/null || exit 2

# El contrato referencia la migración con \i: se sustituye por la que se quiere probar (PM07_MIGRACION).
CONTRATO_TMP=$(mktemp)
sed "s#supabase/migrations/20261003130000_abc_pm07_correccion_numero_catalogo.sql#$MIGRACION#" "$CONTRATO" > "$CONTRATO_TMP"
RES=$({
  echo "begin;"
  cat "$CONTRATO_TMP"
  echo "select jsonb_build_object('total', jsonb_array_length(l), 'fallos', (select count(*) from jsonb_array_elements(l) x where x->>'res' not in ('OK','NEGATIVA_OK')), 'no_ok', (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(l) x where x->>'res' not in ('OK','NEGATIVA_OK'))) as registro from (select current_setting('la.log')::jsonb as l) q;"
  echo "rollback;"
} | psql -tA -v ON_ERROR_STOP=1 -q 2>&1 | grep -v "SET LOCAL" | grep -v '^$')
rm -f "$CONTRATO_TMP"
echo "$RES" | tail -1 | cut -c1-600
case "$RES" in *'"fallos": 0'*) ;; *) fallo "el contrato vivo no pasa";; esac

# Rechazos: la migración se niega a aplicarse y NO cambia la función.
OTRO="create function private.pm07_numero_catalogo(p_valor text, p_defecto numeric default 0) returns numeric language plpgsql immutable set search_path='pg_catalog','pg_temp' as \$\$ begin return 99; end; \$\$;"
H_OTRO=$(psql -tA -c "select md5(\$x\$
begin return 99; end; \$x\$)" | tr -d ' ')
SALIDA=$({
  echo "begin;"
  echo "$OTRO"
  echo "savepoint s;"
  echo "\\i $MIGRACION"
  echo "rollback to savepoint s;"
  echo "select 'HUELLA_TRAS_EL_RECHAZO=' || md5(replace(p.prosrc, chr(13), '')) || ' VALOR=' || private.pm07_numero_catalogo('1') from pg_proc p where p.oid = 'private.pm07_numero_catalogo(text,numeric)'::regprocedure;"
  echo "rollback;"
} | psql -tA -v ON_ERROR_STOP=0 -q 2>&1)
case "$SALIDA" in *"ABC_PM07_FIX_PREFLIGHT_FALLO:funcion_distinta:pm07_numero_catalogo:"*) ;; *) fallo "con una función de cuerpo desconocido la migración debe negarse (funcion_distinta)";; esac
case "$SALIDA" in *"VALOR=99"*) ;; *) fallo "tras el rechazo la función debe seguir siendo la desconocida (devuelve 99)";; esac
echo "rechazo cuerpo desconocido: $(echo "$SALIDA" | grep -o 'ABC_PM07_FIX_PREFLIGHT_FALLO:[a-z0-9_:]*' | head -1) / $(echo "$SALIDA" | grep -o 'VALOR=[0-9]*' | head -1)"

SALIDA=$({
  echo "begin;"
  echo "savepoint s;"
  echo "\\i $MIGRACION"
  echo "rollback to savepoint s;"
  echo "select 'EXISTE_TRAS_EL_RECHAZO=' || (to_regprocedure('private.pm07_numero_catalogo(text,numeric)') is not null);"
  echo "rollback;"
} | psql -tA -v ON_ERROR_STOP=0 -q 2>&1)
case "$SALIDA" in *"ABC_PM07_FIX_PREFLIGHT_FALLO:funcion_ausente:pm07_numero_catalogo"*) ;; *) fallo "sin la función la migración debe negarse (funcion_ausente)";; esac
case "$SALIDA" in *"EXISTE_TRAS_EL_RECHAZO=false"*) ;; *) fallo "la migración no debe crear la función si no existe";; esac
echo "rechazo sin función: $(echo "$SALIDA" | grep -o 'ABC_PM07_FIX_PREFLIGHT_FALLO:[a-z0-9_:]*' | head -1) / $(echo "$SALIDA" | grep -o 'EXISTE_TRAS_EL_RECHAZO=[a-z]*' | head -1)"

psql -q -d postgres -c "drop database if exists $DB" >/dev/null
if [ "$FALLOS" -gt 0 ]; then echo "pm07-fix: $FALLOS FALLO(S)"; exit 1; fi
echo "pm07-fix: OK"
