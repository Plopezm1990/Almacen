#!/bin/bash
# D13 · prueba de «actualización»: lo que ya existía ANTES de la migración 20261003100000 sigue funcionando DESPUÉS.
#
# Fase 1 (antes): con la base de la pieza 5 y SIN D13, el Encargado y el Propietario piden devoluciones con la función antigua
#   (una con tarjeta, que encola el envío; una en efectivo, pendiente; una con tarjeta que se cancela). Se confirma (COMMIT).
# Se aplica la migración de D13.
# Fase 2 (después): las tres filas antiguas quedan aprobadas por quien las pidió y en el momento en que se pidieron; no se duplica
#   ningún envío; la devolución en efectivo antigua se puede confirmar sin pedir aprobación; y una solicitud nueva ya sigue la regla nueva.
#
# Uso (PostgreSQL con la cadena ABC y las piezas 1 a 5 ya aplicadas en la plantilla; auth.users con los cuatro usuarios de
# tests/cfg/local-fixture.sql):
#   PGHOST=/tmp PGPORT=55432 PGUSER=postgres TEMPLATE=abcchain5 bash tests/cfg/d13-upgrade.sh
# Crea y borra la base «d13up». Termina con código distinto de 0 si algo falla. D13_MIGRACION permite probar otra versión de la migración.
set -u
cd "$(dirname "$0")/../.."
CONTRATO=tests/cfg/d13-contract.sql
MIGRACION=${D13_MIGRACION:-supabase/migrations/20261003100000_abc_config_d13_reembolsos_aprobacion.sql}
DB=d13up
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB template ${TEMPLATE:-abcchain5}" >/dev/null || exit 2
export PGDATABASE=$DB
AYUDAS=$(sed -n '/^-- ==== HELPERS ====$/,/^-- ==== FIXTURE ====$/p' "$CONTRATO" | sed '$d')
FIXTURE=$(sed -n '/^-- ==== FIXTURE ====$/,/^-- ==== CHUNK: catalogo ====$/p' "$CONTRATO" | sed '$d')

{
  echo "begin;"
  echo "$AYUDAS"
  echo "$FIXTURE"
  cat <<'SQL'
select pg_temp.sol('U1 (antes) el Encargado pide 5 € de la tarjeta con la función antigua', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:old:req1', '8d000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-0000000000d1', 5);
select pg_temp.sol('U2 (antes) el Propietario pide 4 € del efectivo con la función antigua', '16c79749-a206-47d9-8d56-fbc7a4a49eb7', 'D13:old:req2', '8d000000-0000-0000-0000-0000000000a2', '50000000-0000-0000-0000-0000000000d2', 4);
select pg_temp.sol('U3 (antes) el Encargado pide 3 € de la tarjeta…', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:old:req3', '8d000000-0000-0000-0000-0000000000a3', '50000000-0000-0000-0000-0000000000d1', 3);
select pg_temp.can('U4 (antes) …y la cancela', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:old:can3', '8d000000-0000-0000-0000-0000000000a3');
select jsonb_build_object('fase', 1, 'total', jsonb_array_length(l), 'fallos', (select count(*) from jsonb_array_elements(l) x where x->>'res' not in ('OK','NEGATIVA_OK'))) from (select current_setting('la.log')::jsonb as l) q;
commit;
SQL
} | psql -tA -v ON_ERROR_STOP=1 -q > /tmp/d13_fase1.out 2>&1 || { echo "FASE1_ERROR"; tail -3 /tmp/d13_fase1.out | cut -c1-300; exit 3; }
tail -1 /tmp/d13_fase1.out

psql -q -v ON_ERROR_STOP=1 -f "$MIGRACION" 2>&1 | grep -v "SET LOCAL" | grep -v '^$'

{
  echo "begin;"
  echo "$AYUDAS"
  cat <<'SQL'
do $t$
declare n integer;
begin
  perform pg_temp.ok('V1 las tres filas antiguas quedan aprobadas por quien las pidió, en el momento en que las pidió',
    (select count(*) from public.reembolsos where id::text like '8d000000-0000-0000-0000-0000000000a_' and aprobado_por = created_by and aprobado_at = created_at) = 3);
  perform pg_temp.ok('V2 ninguna fila antigua queda con una sola de las dos columnas', (select count(*) from public.reembolsos where (aprobado_por is null) <> (aprobado_at is null)) = 0);
  perform pg_temp.ok('V3 el envío de la tarjeta sigue siendo UNO (la migración no duplica ni quita nada)',
    pg_temp.n_efectos('8d000000-0000-0000-0000-0000000000a1') = 1 and pg_temp.n_efectos('8d000000-0000-0000-0000-0000000000a2') = 0);
  perform pg_temp.ok('V4 la antigua cancelada sigue CANCELADA', (pg_temp.reemb('8d000000-0000-0000-0000-0000000000a3')).estado = 'CANCELADO');
  perform pg_temp.efe('V5 la devolución en efectivo antigua se confirma SIN pedir aprobación', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:old:efe2', '8d000000-0000-0000-0000-0000000000a2');
  perform pg_temp.ok('V6 queda CONFIRMADA con su movimiento de caja', (pg_temp.reemb('8d000000-0000-0000-0000-0000000000a2')).estado = 'CONFIRMADO'
    and (select count(*) from public.caja_operaciones where tipo='REEMBOLSO' and origen_id='8d000000-0000-0000-0000-0000000000a2' and efecto_efectivo = -4) = 1);
  perform pg_temp.sol('V7 una solicitud NUEVA del Encargado ya sigue la regla nueva (aprobada en el acto)', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:new:req', '8d000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-0000000000d1', 2);
  perform pg_temp.ok('V8 …con evento APROBADO y un envío', (pg_temp.reemb('8d000000-0000-0000-0000-0000000000b1')).aprobado_at is not null and pg_temp.n_eventos('8d000000-0000-0000-0000-0000000000b1','REEMBOLSO_APROBADO') = 1 and pg_temp.n_efectos('8d000000-0000-0000-0000-0000000000b1') = 1);
end $t$;
select jsonb_build_object('fase', 2, 'total', jsonb_array_length(l), 'fallos', (select count(*) from jsonb_array_elements(l) x where x->>'res' not in ('OK','NEGATIVA_OK')), 'no_ok', (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(l) x where x->>'res' not in ('OK','NEGATIVA_OK'))) from (select current_setting('la.log')::jsonb as l) q;
rollback;
SQL
} | psql -tA -v ON_ERROR_STOP=1 -q > /tmp/d13_fase2.out 2>&1
cat /tmp/d13_fase2.out | tail -3 | cut -c1-600
psql -q -d postgres -c "drop database if exists $DB" >/dev/null
grep -q '"fallos": 0' /tmp/d13_fase2.out
