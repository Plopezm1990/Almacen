#!/usr/bin/env bash
# PM26 P08c -- prueba REAL de concurrencia con dos sesiones PostgreSQL
# simultaneas sobre el guard endurecido de revertir.sql.
#
# Demuestra, sin depender de suerte de temporizacion, que ningun INSERT
# puede colarse entre el conteo de filas y el DROP COLUMN:
#
#   Escenario 1  un INSERT en vuelo (transaccion abierta, sin confirmar)
#                impide que la reversion empiece: revertir.sql aborta por
#                lock_timeout con un mensaje claro y no toca nada.
#   Escenario 2  mientras la reversion mantiene ACCESS EXCLUSIVE, ningun
#                INSERT puede confirmarse -- el que lo intenta falla.
#   Escenario 3  control negativo: reproduce el ORDEN ANTIGUO (contar sin
#                bloquear y retirar columnas despues) y comprueba que ese
#                orden SI perdia datos. Sin este control, los escenarios
#                1 y 2 podrian pasar de forma vacia.
#
# Se ejecuta EXCLUSIVAMENTE contra un PostgreSQL local aislado, sobre una
# base de datos temporal creada y destruida aqui mismo. Nunca contra QA,
# produccion ni TPV. No aplica nada en ningun entorno real.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRACION="$DIR/migracion-propuesta.sql"
REVERTIR="$DIR/revertir.sql"
DB="pm26_p08c_conc_$$"
PSQL="${POSTGRES_PSQL:-psql}"
RUN_AS_POSTGRES="${POSTGRES_SUDO:-sudo -u postgres}"

fallo() { echo "PM26_P08C_CONC_FALLO: $1" >&2; exit 1; }

limpiar() {
  $RUN_AS_POSTGRES $PSQL -c "drop database if exists \"$DB\" with (force);" >/dev/null 2>&1 || true
}
trap limpiar EXIT

# --- Barrera de entorno: solo PostgreSQL local aislado. ---
if [ -n "${PGHOST:-}" ]; then
  case "$PGHOST" in
    /*|localhost|127.0.0.1|::1) : ;;
    *) fallo "PGHOST apunta a un host no local ($PGHOST) -- esta prueba solo puede ejecutarse contra PostgreSQL local aislado" ;;
  esac
fi
if [ -n "${PGPORT:-}" ] && [ "$PGPORT" != "5432" ]; then
  echo "PM26_P08C_CONC_AVISO: PGPORT=$PGPORT (se asume instancia local)" >&2
fi
[ -f "$MIGRACION" ] || fallo "no se encuentra la migracion propuesta en $MIGRACION"
[ -f "$REVERTIR" ] || fallo "no se encuentra revertir.sql en $REVERTIR"
echo "PM26_P08C_CONC_ENTORNO_LOCAL=PASS"

psql_archivo() {
  cat "$1" | $RUN_AS_POSTGRES $PSQL -d "$DB" -v ON_ERROR_STOP=1
}
consulta() {
  $RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "$1"
}

# Espera, de forma acotada y observable, a que otra sesion tenga
# concedido el bloqueo indicado sobre la tabla. Sincroniza las dos
# sesiones sin depender de un sleep a ciegas.
esperar_lock() {
  local modo="$1" intentos=0 n
  while [ "$intentos" -lt 200 ]; do
    n="$(consulta "select count(*) from pg_locks l join pg_class c on c.oid = l.relation where c.relname = 'prefiltros_candidatos' and l.mode = '$modo' and l.granted and l.pid <> pg_backend_pid();" 2>/dev/null || echo 0)"
    [ "${n:-0}" -ge 1 ] && return 0
    intentos=$((intentos + 1))
    sleep 0.1
  done
  return 1
}

# Espera a que otra sesion este ejecutando activamente su pg_sleep, es
# decir, a que ya haya pasado por el conteo previo.
esperar_pausa_activa() {
  local intentos=0 n
  while [ "$intentos" -lt 200 ]; do
    n="$(consulta "select count(*) from pg_stat_activity where datname = '$DB' and state = 'active' and query like '%pg_sleep%' and pid <> pg_backend_pid();" 2>/dev/null || echo 0)"
    [ "${n:-0}" -ge 1 ] && return 0
    intentos=$((intentos + 1))
    sleep 0.1
  done
  return 1
}

# --- Esquema aislado, ya migrado (columnas + politicas con aislamiento). ---
limpiar
$RUN_AS_POSTGRES $PSQL -c "create database \"$DB\";" >/dev/null
psql_archivo "$DIR/schema.sql" >/dev/null || fallo "no se pudo aplicar schema.sql"
psql_archivo "$DIR/seed.sql" >/dev/null || fallo "no se pudo aplicar seed.sql"
psql_archivo "$MIGRACION" >/dev/null || fallo "no se pudo aplicar la migracion propuesta"
COLUMNAS="$(consulta "select count(*) from information_schema.columns where table_schema='public' and table_name='prefiltros_candidatos' and column_name in ('empresa_id','local_id') and is_nullable='NO';")"
[ "$COLUMNAS" = "2" ] || fallo "el esquema migrado deberia tener empresa_id/local_id NOT NULL, encontrado $COLUMNAS"
echo "PM26_P08C_CONC_ESQUEMA_MIGRADO=PASS"

# Las inserciones de esta prueba las hace el propietario de la tabla: lo
# que se mide aqui son BLOQUEOS, no RLS (el aislamiento por RLS ya esta
# cubierto por comportamiento.sql y transicion-posterior.sql).

# ===================================================================
# Escenario 1: INSERT en vuelo sin confirmar -> la reversion aborta.
# ===================================================================
$RUN_AS_POSTGRES $PSQL -d "$DB" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL_B1' &
begin;
insert into public.prefiltros_candidatos (token, candidato_nombre, estado, empresa_id, local_id)
values ('tok-conc-1', 'Concurrente Uno', 'pendiente', 'EMPRESA_A', 'LOCAL_A1');
select pg_sleep(12);
commit;
SQL_B1
PID_B1=$!

esperar_lock 'RowExclusiveLock' \
  || { kill "$PID_B1" 2>/dev/null || true; fallo "la sesion B no llego a mantener RowExclusiveLock -- no se pudo sincronizar el escenario 1"; }

SALIDA_REV="$(psql_archivo "$REVERTIR" 2>&1 || true)"
echo "$SALIDA_REV" | grep -q "ROLLBACK_FALLO" \
  || { echo "$SALIDA_REV" >&2; kill "$PID_B1" 2>/dev/null || true; fallo "revertir.sql debia abortar con ROLLBACK_FALLO mientras habia un INSERT en vuelo"; }
echo "$SALIDA_REV" | grep -q "no se pudo adquirir ACCESS EXCLUSIVE" \
  || { echo "$SALIDA_REV" >&2; kill "$PID_B1" 2>/dev/null || true; fallo "el mensaje de abort debia identificar el bloqueo no adquirido"; }
echo "PM26_P08C_CONC1_REVERSION_ABORTA_CON_INSERT_EN_VUELO=PASS"

wait "$PID_B1" || fallo "la sesion B del escenario 1 no termino correctamente"

# Nada se revirtio: columnas intactas, fila confirmada intacta y las 3
# politicas siguen exigiendo aislamiento.
COLUMNAS_TRAS_1="$(consulta "select count(*) from information_schema.columns where table_schema='public' and table_name='prefiltros_candidatos' and column_name in ('empresa_id','local_id') and is_nullable='NO';")"
[ "$COLUMNAS_TRAS_1" = "2" ] || fallo "tras el escenario 1 las columnas debian seguir intactas y NOT NULL, encontrado $COLUMNAS_TRAS_1"
FILA_TRAS_1="$(consulta "select token || '|' || empresa_id || '|' || local_id from public.prefiltros_candidatos where token = 'tok-conc-1';")"
[ "$FILA_TRAS_1" = "tok-conc-1|EMPRESA_A|LOCAL_A1" ] || fallo "la fila confirmada por la sesion B debia quedar intacta, encontrado '$FILA_TRAS_1'"
POLITICAS_AISLADAS="$(consulta "select count(*) from pg_policy p join pg_class c on c.oid = p.polrelid where c.relname = 'prefiltros_candidatos' and (coalesce(pg_get_expr(p.polqual, p.polrelid), '') like '%la_tiene_local%' or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like '%la_tiene_local%');")"
[ "$POLITICAS_AISLADAS" = "3" ] || fallo "tras el escenario 1 las 3 politicas debian seguir con aislamiento, encontrado $POLITICAS_AISLADAS"
echo "PM26_P08C_CONC1_SIN_DANO_NI_REVERSION_PARCIAL=PASS"

# ===================================================================
# Escenario 2: con ACCESS EXCLUSIVE tomado, ningun INSERT se cuela.
# Reproduce exactamente la ventana que el guard mantiene abierta entre
# el conteo y el COMMIT de la reversion.
# ===================================================================
FILAS_ANTES_2="$(consulta "select count(*) from public.prefiltros_candidatos;")"
$RUN_AS_POSTGRES $PSQL -d "$DB" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL_B2' &
begin;
set local lock_timeout = '5s';
lock table public.prefiltros_candidatos in access exclusive mode;
select pg_sleep(8);
rollback;
SQL_B2
PID_B2=$!

esperar_lock 'AccessExclusiveLock' \
  || { kill "$PID_B2" 2>/dev/null || true; fallo "la sesion B no llego a mantener AccessExclusiveLock -- no se pudo sincronizar el escenario 2"; }

SALIDA_INS="$($RUN_AS_POSTGRES $PSQL -d "$DB" -v ON_ERROR_STOP=1 2>&1 <<'SQL_A2' || true
set lock_timeout = '2s';
insert into public.prefiltros_candidatos (token, candidato_nombre, estado, empresa_id, local_id)
values ('tok-conc-2', 'Concurrente Dos', 'pendiente', 'EMPRESA_A', 'LOCAL_A1');
SQL_A2
)"
echo "$SALIDA_INS" | grep -qi "lock timeout" \
  || { echo "$SALIDA_INS" >&2; kill "$PID_B2" 2>/dev/null || true; fallo "el INSERT debia fallar por lock timeout mientras la reversion mantiene ACCESS EXCLUSIVE"; }
echo "PM26_P08C_CONC2_INSERT_BLOQUEADO_BAJO_ACCESS_EXCLUSIVE=PASS"

wait "$PID_B2" || fallo "la sesion B del escenario 2 no termino correctamente"

FILAS_TRAS_2="$(consulta "select count(*) from public.prefiltros_candidatos;")"
[ "$FILAS_TRAS_2" = "$FILAS_ANTES_2" ] || fallo "no debia colarse ninguna fila: antes $FILAS_ANTES_2, despues $FILAS_TRAS_2"
COLADA="$(consulta "select count(*) from public.prefiltros_candidatos where token = 'tok-conc-2';")"
[ "$COLADA" = "0" ] || fallo "la fila tok-conc-2 no debia existir -- se colo un INSERT bajo ACCESS EXCLUSIVE"
echo "PM26_P08C_CONC2_CERO_FILAS_COLADAS=PASS"

# ===================================================================
# Escenario 3 (control negativo): el ORDEN ANTIGUO si perdia datos.
# Reproduce aqui, en SQL desechable y solo sobre esta base aislada, el
# orden anterior a P08c -- contar sin bloquear y retirar columnas
# despues. Nunca se ejecuta el archivo committeado en este escenario.
# ===================================================================
$RUN_AS_POSTGRES $PSQL -d "$DB" -c "delete from public.prefiltros_candidatos;" >/dev/null \
  || fallo "no se pudieron limpiar las filas antes del control negativo"

# El cuerpo de abajo es fiel al orden anterior a P08c: contar sin
# bloquear y solo despues sustituir las 3 politicas y retirar las
# columnas. El pg_sleep no inventa una ventana que no existiera --
# ensancha de forma determinista la ventana real que habia entre el
# conteo y la primera sentencia que adquiere ACCESS EXCLUSIVE (el
# primer DROP POLICY). Esa ventana es estrecha en reposo, pero se
# ensancha sola bajo carga, porque esa sentencia puede quedarse
# esperando en la cola de bloqueos mientras otras transacciones que
# llegaron antes terminan de confirmarse.
$RUN_AS_POSTGRES $PSQL -d "$DB" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL_B3' &
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
do $$
declare v_total int;
begin
  select count(*) into v_total from public.prefiltros_candidatos;
  if v_total <> 0 then
    raise exception 'CONTROL_NEGATIVO_ABORTADO: la tabla no estaba vacia al empezar';
  end if;
end
$$;
select pg_sleep(6);
drop policy if exists "prefiltros - propietario lee" on public.prefiltros_candidatos;
create policy "prefiltros - propietario lee"
  on public.prefiltros_candidatos for select to authenticated
  using (exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = true and p.rol = 'Propietario'::text));
drop policy if exists "prefiltros - propietario crea" on public.prefiltros_candidatos;
create policy "prefiltros - propietario crea"
  on public.prefiltros_candidatos for insert to authenticated
  with check (exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = true and p.rol = 'Propietario'::text));
drop policy if exists "prefiltros - propietario borra" on public.prefiltros_candidatos;
create policy "prefiltros - propietario borra"
  on public.prefiltros_candidatos for delete to authenticated
  using (exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = true and p.rol = 'Propietario'::text));
alter table public.prefiltros_candidatos drop column if exists empresa_id;
alter table public.prefiltros_candidatos drop column if exists local_id;
commit;
SQL_B3
PID_B3=$!

esperar_pausa_activa \
  || { kill "$PID_B3" 2>/dev/null || true; fallo "la sesion del control negativo no llego a su pausa -- no se pudo sincronizar el escenario 3"; }

if ! $RUN_AS_POSTGRES $PSQL -d "$DB" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL_A3'
insert into public.prefiltros_candidatos (token, candidato_nombre, estado, empresa_id, local_id)
values ('tok-conc-3', 'Concurrente Tres', 'pendiente', 'EMPRESA_A', 'LOCAL_A1');
SQL_A3
then
  kill "$PID_B3" 2>/dev/null || true
  fallo "el control negativo exige que el INSERT se confirme durante la ventana del orden antiguo"
fi

wait "$PID_B3" || fallo "la sesion del control negativo no termino correctamente"

COLUMNAS_TRAS_3="$(consulta "select count(*) from information_schema.columns where table_schema='public' and table_name='prefiltros_candidatos' and column_name in ('empresa_id','local_id');")"
[ "$COLUMNAS_TRAS_3" = "0" ] || fallo "el control negativo esperaba que el orden antiguo llegara a retirar las columnas, encontrado $COLUMNAS_TRAS_3"
FILA_HUERFANA="$(consulta "select count(*) from public.prefiltros_candidatos where token = 'tok-conc-3';")"
[ "$FILA_HUERFANA" = "1" ] || fallo "el control negativo esperaba la fila colada tok-conc-3, encontrado $FILA_HUERFANA"
echo "PM26_P08C_CONC3_CONTROL_NEGATIVO_ORDEN_ANTIGUO_PIERDE_DATOS=PASS"

echo "PM26_P08C_CONCURRENCIA_COMPLETA=PASS"
