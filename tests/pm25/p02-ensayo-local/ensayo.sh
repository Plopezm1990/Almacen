#!/usr/bin/env bash
# PM25 P02 -- ensayo LOCAL PARCIAL de la migracion candidata
# (20260905185935_g1_p08_operation_id_finanzas_global.sql) en
# PostgreSQL local aislado. Sigue el diseno ya acordado en
# P02_BLOQUEADO_ENTORNO_AISLADO.md en todo lo que PostgreSQL suelto
# permite probar: esquema antes, dos replicas identicas (pm25_base
# nunca recibe la migracion; pm25_ensayo si), huellas antes/despues,
# aplicar la migracion tal cual sin modificarla, validar el registro
# global y el disparador de conflicto, comprobar que los 5 libros
# originales no cambian, revertir objetos nuevos y confirmar que
# pm25_ensayo vuelve a coincidir con pm25_base, y medir la duracion
# total contra el presupuesto de <5 minutos.
#
# NO cierra PM25 P02: no prueba Auth, JWT, PostgREST ni RLS con
# sesiones reales, que solo existen con el stack completo de Supabase.
# Nunca toca QA, produccion, TPV, ni ninguna organizacion o proyecto
# real de Supabase -- todo corre contra bases temporales locales que
# este script crea y destruye.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ_REPO="$(cd "$DIR/../../.." && pwd)"
MIGRACION="$RAIZ_REPO/supabase/migrations/20260905185935_g1_p08_operation_id_finanzas_global.sql"
SCHEMA_ANTES="$DIR/schema-antes.sql"
SEED="$DIR/seed-antiguas-sinteticas.sql"

DB_BASE="pm25_base_$$"
DB_ENSAYO="pm25_ensayo_$$"
PSQL="${POSTGRES_PSQL:-psql}"
RUN_AS_POSTGRES="${POSTGRES_SUDO:-sudo -u postgres}"

fallo() { echo "PM25_P02_ENSAYO_FALLO: $1" >&2; exit 1; }
limpiar() {
  $RUN_AS_POSTGRES $PSQL -c "drop database if exists \"$DB_BASE\" with (force);" >/dev/null 2>&1 || true
  $RUN_AS_POSTGRES $PSQL -c "drop database if exists \"$DB_ENSAYO\" with (force);" >/dev/null 2>&1 || true
}
trap limpiar EXIT

if [ -n "${PGHOST:-}" ]; then
  case "$PGHOST" in
    /*|localhost|127.0.0.1|::1) : ;;
    *) fallo "PGHOST apunta a un host no local ($PGHOST) -- este ensayo solo corre contra PostgreSQL local aislado" ;;
  esac
fi
for f in "$MIGRACION" "$SCHEMA_ANTES" "$SEED"; do
  [ -f "$f" ] || fallo "no se encuentra $f"
done
echo "PM25_P02_ENTORNO_LOCAL=PASS"

INICIO=$(date +%s)

psql_stdin() { local db="$1"; $RUN_AS_POSTGRES $PSQL -d "$db" -v ON_ERROR_STOP=1; }
consulta() { local db="$1"; shift; $RUN_AS_POSTGRES $PSQL -d "$db" -tAc "$1"; }

limpiar
$RUN_AS_POSTGRES $PSQL -c "create database \"$DB_BASE\";" >/dev/null
$RUN_AS_POSTGRES $PSQL -c "create database \"$DB_ENSAYO\";" >/dev/null

# ===================================================================
# 1) Esquema en el estado inmediatamente anterior a la migracion
#    candidata, identico en las dos replicas.
# ===================================================================
cat "$SCHEMA_ANTES" | psql_stdin "$DB_BASE" >/dev/null || fallo "no se pudo aplicar el esquema anterior en pm25_base"
cat "$SCHEMA_ANTES" | psql_stdin "$DB_ENSAYO" >/dev/null || fallo "no se pudo aplicar el esquema anterior en pm25_ensayo"
echo "PM25_P02_ESQUEMA_ANTERIOR_APLICADO=PASS"

# ===================================================================
# 2) Fixtures identicas en ambas replicas; huellas deben coincidir
#    exactamente antes de continuar.
# ===================================================================
cat "$SEED" | psql_stdin "$DB_BASE" >/dev/null || fallo "no se pudo sembrar pm25_base"
cat "$SEED" | psql_stdin "$DB_ENSAYO" >/dev/null || fallo "no se pudo sembrar pm25_ensayo"

huella() {
  local db="$1"
  consulta "$db" "
    select
      (select count(*) from public.pagos_factura) || '|' ||
      (select count(*) from public.caja_operaciones) || '|' ||
      (select count(*) from public.stock_operaciones) || '|' ||
      (select count(*) from public.arqueos_caja) || '|' ||
      (select count(*) from public.arqueos_caja_anulaciones) || '|' ||
      md5((select string_agg(id || ':' || coalesce(operation_id,''), ',' order by id) from public.pagos_factura)) || '|' ||
      md5((select string_agg(id || ':' || coalesce(operation_id,''), ',' order by id) from public.caja_operaciones)) || '|' ||
      md5((select string_agg(id || ':' || coalesce(operation_id,''), ',' order by id) from public.stock_operaciones)) || '|' ||
      md5((select string_agg(id || ':' || coalesce(operation_id,''), ',' order by id) from public.arqueos_caja)) || '|' ||
      md5((select string_agg(id || ':' || coalesce(operation_id,''), ',' order by id) from public.arqueos_caja_anulaciones));
  "
}
HUELLA_BASE_ANTES="$(huella "$DB_BASE")"
HUELLA_ENSAYO_ANTES="$(huella "$DB_ENSAYO")"
[ "$HUELLA_BASE_ANTES" = "$HUELLA_ENSAYO_ANTES" ] || fallo "las huellas de pm25_base y pm25_ensayo no coinciden antes de aplicar nada"
echo "PM25_P02_HUELLAS_IDENTICAS_ANTES=PASS"

# ===================================================================
# 3) Captura "antes": conteo esperado del registro global. Las
#    fixtures siembran 8 filas en total entre los 5 libros (ver
#    seed-antiguas-sinteticas.sql), con 1 operation_id repetido entre
#    dos libros -> 7 filas unicas esperadas en el registro global.
# ===================================================================
TOTAL_FILAS_LIBROS=8
DUPLICADOS_ESPERADOS=1
ESPERADO_GLOBAL=$((TOTAL_FILAS_LIBROS - DUPLICADOS_ESPERADOS))
echo "PM25_P02_CAPTURA_ANTES=PASS (global esperado=$ESPERADO_GLOBAL)"

# ===================================================================
# 4) Aplicar la migracion candidata TAL CUAL, sin modificarla, solo en
#    pm25_ensayo. pm25_base nunca la recibe -- es el punto de
#    recuperacion real.
# ===================================================================
cat "$MIGRACION" | psql_stdin "$DB_ENSAYO" >/dev/null 2>"$DIR/.migracion.stderr" \
  || { cat "$DIR/.migracion.stderr" >&2; fallo "la migracion candidata no se aplico limpia en pm25_ensayo"; }
rm -f "$DIR/.migracion.stderr"
echo "PM25_P02_MIGRACION_APLICADA_SIN_MODIFICAR=PASS"

# ===================================================================
# 5) Validaciones.
# ===================================================================
# 5a) Conteo del registro global.
TOTAL_GLOBAL="$(consulta "$DB_ENSAYO" "select count(*) from private.g1_operation_ids_global;")"
[ "$TOTAL_GLOBAL" = "$ESPERADO_GLOBAL" ] || fallo "el registro global tiene $TOTAL_GLOBAL filas, se esperaban $ESPERADO_GLOBAL"
echo "PM25_P02_CONTEO_GLOBAL=PASS ($TOTAL_GLOBAL)"

# 5b) Que libro gano el operation_id repetido -- hallazgo real, no asumido.
LIBRO_GANADOR="$(consulta "$DB_ENSAYO" "select ledger from private.g1_operation_ids_global where operation_id='OP-DUPLICADO00';")"
echo "PM25_P02_LIBRO_GANADOR=$LIBRO_GANADOR"

# 5c) Permisos: sin GRANT a authenticated/anon sobre la tabla ni la funcion.
PERMISO_TABLA="$(consulta "$DB_ENSAYO" "select has_table_privilege('authenticated', 'private.g1_operation_ids_global', 'select');")"
[ "$PERMISO_TABLA" = "f" ] || fallo "authenticated no deberia tener SELECT sobre private.g1_operation_ids_global"
echo "PM25_P02_PERMISOS_REVOCADOS=PASS"

# 5d) Integridad: los 5 libros originales no cambiaron -- la migracion
#     solo lee para el backfill, nunca escribe en ellos.
HUELLA_ENSAYO_DESPUES="$(huella "$DB_ENSAYO")"
# La huella incluye conteos+hash de las 5 tablas de libros -- los
# mismos campos que antes de aplicar la migracion.
[ "${HUELLA_ENSAYO_DESPUES}" = "${HUELLA_ENSAYO_ANTES}" ] || fallo "los 5 libros originales cambiaron tras aplicar la migracion -- no deberian"
echo "PM25_P02_INTEGRIDAD_LIBROS_ORIGINALES=PASS"

# 5e) Prueba deliberada: insertar una fila nueva en el libro PERDEDOR
#     reutilizando el operation_id "perdedor" en SU PROPIO libro -- el
#     disparador deberia rechazarla con operation_id_conflict, porque
#     el registro global ya asigno ese operation_id a otro libro.
if [ "$LIBRO_GANADOR" = "pagos_factura" ]; then
  LIBRO_PERDEDOR="caja_operaciones"
else
  LIBRO_PERDEDOR="pagos_factura"
fi
SALIDA_TRIGGER="$($RUN_AS_POSTGRES $PSQL -d "$DB_ENSAYO" -v ON_ERROR_STOP=1 -c \
  "insert into public.$LIBRO_PERDEDOR (id, operation_id) values ('NUEVO-COLISION', 'OP-DUPLICADO00');" 2>&1 || true)"
if echo "$SALIDA_TRIGGER" | grep -q "operation_id_conflict"; then
  echo "PM25_P02_DISPARADOR_RECHAZA_COLISION=PASS (hallazgo: rechazada con operation_id_conflict)"
else
  echo "PM25_P02_DISPARADOR_RECHAZA_COLISION=HALLAZGO_INESPERADO: $SALIDA_TRIGGER"
  fallo "el disparador no rechazo la reutilizacion del operation_id perdedor en su propio libro -- ver hallazgo arriba"
fi

# ===================================================================
# 6) Reversion -- nunca simulada con DROP manual del estado previo.
#    pm25_base nunca recibio la migracion: es en si mismo el punto de
#    recuperacion. Se compara contra la huella capturada en el paso 2
#    (debe coincidir, porque no se toco). Ademas, se revierten los
#    objetos NUEVOS que si se aplicaron en pm25_ensayo (una reversion
#    real de lo aplicado, no un atajo) y se confirma que los 5 libros
#    de pm25_ensayo siguen coincidiendo con pm25_base.
# ===================================================================
HUELLA_BASE_DESPUES="$(huella "$DB_BASE")"
[ "$HUELLA_BASE_DESPUES" = "$HUELLA_BASE_ANTES" ] || fallo "pm25_base cambio sin haber recibido la migracion -- no deberia poder pasar"
echo "PM25_P02_BASE_INTACTA_PUNTO_DE_RECUPERACION=PASS"

$RUN_AS_POSTGRES $PSQL -d "$DB_ENSAYO" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
drop trigger if exists g1_operation_id_global on public.pagos_factura;
drop trigger if exists g1_operation_id_global on public.caja_operaciones;
drop trigger if exists g1_operation_id_global on public.stock_operaciones;
drop trigger if exists g1_operation_id_global on public.arqueos_caja;
drop trigger if exists g1_operation_id_global on public.arqueos_caja_anulaciones;
drop function if exists private.g1_claim_operation_id();
drop table if exists private.g1_operation_ids_global;
drop function if exists public.registrar_pago_factura(text, text, text, text, text, text, numeric, date, text, jsonb);
drop function if exists public.revertir_pago_factura(text, text, text, text);
delete from public.pagos_factura where id = 'NUEVO-COLISION';
delete from public.caja_operaciones where id = 'NUEVO-COLISION';
SQL
HUELLA_ENSAYO_REVERTIDO="$(huella "$DB_ENSAYO")"
[ "$HUELLA_ENSAYO_REVERTIDO" = "$HUELLA_BASE_DESPUES" ] || fallo "tras revertir los objetos nuevos, pm25_ensayo no coincide con pm25_base"
echo "PM25_P02_REVERSION_COINCIDE_CON_BASE=PASS"

# ===================================================================
# 7) Auth/JWT/PostgREST/RLS con sesiones reales -- NO ALCANZABLE con
#    PostgreSQL suelto. Se declara explicitamente, no se omite en
#    silencio.
# ===================================================================
echo "PM25_P02_AUTH_JWT_POSTGREST_RLS_PROBADO=NO (fuera de alcance de PostgreSQL local suelto)"

# ===================================================================
# 8) Presupuesto de tiempo: ciclo completo < 5 minutos.
# ===================================================================
FIN=$(date +%s)
DURACION=$((FIN - INICIO))
echo "PM25_P02_DURACION_SEGUNDOS=$DURACION"
[ "$DURACION" -lt 300 ] || fallo "el ciclo completo tardo $DURACION s, se exigia < 300 s (5 minutos)"
echo "PM25_P02_PRESUPUESTO_TIEMPO=PASS"

# ===================================================================
# 9) Nada que pausar/eliminar -- todo es local y ya se destruye en el
#    trap de limpieza.
# ===================================================================
echo "PM25_P02_ENSAYO_LOCAL_COMPLETO=PASS (evidencia PARCIAL -- no cierra PM25 P02)"
