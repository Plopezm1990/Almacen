#!/usr/bin/env bash
# Prepara un Postgres 16 local desechable para los 10 casos de tests/{pm12,pm14,pm33}/db/*.mjs
# que no requieren Auth/PostgREST (esos 3 casos van en .github/workflows/punto2-p08-supabase-full.yml,
# porque necesitan Docker, no disponible en este entorno de trabajo).
set -euo pipefail
cd "$(dirname "$0")/../../.."

service postgresql start || sudo service postgresql start
sleep 1
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" 2>/dev/null || \
  psql -U postgres -c "ALTER USER postgres PASSWORD 'postgres';"

export PGPASSWORD=postgres
for db in pm12_p08_test pm14_p02_test pm33_p05_test; do
  dropdb -h 127.0.0.1 -U postgres --if-exists "$db"
  createdb -h 127.0.0.1 -U postgres "$db"
done

npm install --silent --prefix tests/pm12/db
npm install --silent --prefix tests/pm14/db
npm install --silent --prefix tests/pm33/db

# pm33/db necesita fixtures + la migración P05 real cargados por adelantado
# (pm12/db y pm14/db cargan sus propias migraciones dentro del propio script .mjs).
psql -h 127.0.0.1 -U postgres -d pm33_p05_test -v ON_ERROR_STOP=1 -f tests/pm33/db/fixtures.sql
psql -h 127.0.0.1 -U postgres -d pm33_p05_test -v ON_ERROR_STOP=1 -f tests/pm33/db/fixtures_p02_extra.sql
psql -h 127.0.0.1 -U postgres -d pm33_p05_test -v ON_ERROR_STOP=1 -f tests/pm33/db/fixtures_p03_extra.sql
psql -h 127.0.0.1 -U postgres -d pm33_p05_test -v ON_ERROR_STOP=1 -f tests/pm33/db/fixtures_p04_extra.sql
psql -h 127.0.0.1 -U postgres -d pm33_p05_test -v ON_ERROR_STOP=1 -f tests/pm33/db/fixtures_p05_extra.sql
psql -h 127.0.0.1 -U postgres -d pm33_p05_test -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20260919225831_pm33_p05_identidad_antes_de_actividad.sql

export PM12_TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/pm12_p08_test'
export PM14_TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/pm14_p02_test'
export PM33_TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/pm33_p05_test'

for f in tests/pm12/db/p08-postgres-contract.mjs \
         tests/pm14/db/p02-postgres-contract.mjs \
         tests/pm14/db/p05-postgres-contract.mjs \
         tests/pm14/db/p07-postgres-concurrencia-contract.mjs \
         tests/pm33/db/contrato-vigente-contract.mjs \
         tests/pm33/db/p01-aislamiento-multiempresa-contract.mjs \
         tests/pm33/db/p02-regresion-rol-no-gestionado.mjs \
         tests/pm33/db/p03-aislamiento-camarero-contract.mjs \
         tests/pm33/db/p04-identidad-y-revocacion-contract.mjs \
         tests/pm33/db/p05-identidad-antes-de-actividad-contract.mjs; do
  echo "=== $f ==="
  node "$f"
  echo
done
