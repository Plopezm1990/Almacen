#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${PGHOST:-127.0.0.1}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-postgres}"
DB_NAME="${PGDATABASE:-postgres}"

run_one() {
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -Atc "
    select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
    set role authenticated;
    select public.pm13_fichaje_manual('emp-conc','l1',current_date-2,'08:00','entrada','conc-same-op','race')->>'ok';
  "
}

run_one > /tmp/p2-pm13-conc-a.out &
P1=$!
run_one > /tmp/p2-pm13-conc-b.out &
P2=$!
wait "$P1"
wait "$P2"

cat /tmp/p2-pm13-conc-a.out
cat /tmp/p2-pm13-conc-b.out

COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Atc "select count(*) from public.fichajes_registro where datos->>'operationId'='conc-same-op';")
if [[ "$COUNT" != "1" ]]; then
  echo "P2_PM13_CONCURRENCY_FALLO=count:$COUNT"
  exit 1
fi

DUP=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Atc "select count(distinct id) from public.fichajes_registro where datos->>'operationId'='conc-same-op';")
if [[ "$DUP" != "1" ]]; then
  echo "P2_PM13_CONCURRENCY_FALLO=distinct:$DUP"
  exit 1
fi

echo "P2_PM13_CONCURRENCY_OK=1"
