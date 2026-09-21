#!/usr/bin/env bash
set -euo pipefail

STATUS='tests/pm12/supabase-full/supabase/.temp/status.env'
BACKUP='/tmp/pm25-p02-stock-ubicacion.sql'

test -f "$STATUS"
DB_URL="$(sed -n 's/^DB_URL="\(.*\)"$/\1/p' "$STATUS" | tail -1)"
if [[ ! "$DB_URL" =~ @(127\.0\.0\.1|localhost):[0-9]+/postgres$ ]]; then
  echo "PM25_P02_RESTORE_FALLO: DB_URL no es local" >&2
  exit 1
fi

DB_CONTAINER="$(docker ps --format '{{.Names}}' | grep '^supabase_db_pm12-p08-supabase-full$' | head -1 || true)"
if [ -z "$DB_CONTAINER" ]; then
  echo "PM25_P02_RESTORE_FALLO: contenedor PostgreSQL local no encontrado" >&2
  docker ps --format '{{.Names}}' >&2
  exit 1
fi

sql() {
  docker exec "$DB_CONTAINER" psql -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 -c "$1"
}

before_count="$(sql "select count(*) from public.stock_ubicacion;")"
before_hash="$(sql "select md5(coalesce(string_agg(row_to_json(s)::text,'|' order by empresa_id,local_id,producto_id),'')) from public.stock_ubicacion s;")"

if [ "$before_count" -lt 1 ]; then
  echo "PM25_P02_RESTORE_FALLO: baseline stock_ubicacion vacía" >&2
  exit 1
fi

docker exec "$DB_CONTAINER" pg_dump   -U postgres -d postgres   --data-only --inserts --rows-per-insert=100   --table=public.stock_ubicacion > "$BACKUP"

test -s "$BACKUP"
grep -q 'INSERT INTO public.stock_ubicacion' "$BACKUP"
backup_sha="$(sha256sum "$BACKUP" | awk '{print $1}')"
echo "PM25_P02_BACKUP_SHA256=$backup_sha"
echo "PM25_P02_BACKUP_FILAS=$before_count"

sql "delete from public.stock_ubicacion;" >/dev/null
lost_count="$(sql "select count(*) from public.stock_ubicacion;")"
test "$lost_count" = "0"
echo 'PM25_P02_PERDIDA_CONTROLADA=PASS'

cat "$BACKUP" | docker exec -i "$DB_CONTAINER"   psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 >/tmp/pm25-p02-restore.log

after_count="$(sql "select count(*) from public.stock_ubicacion;")"
after_hash="$(sql "select md5(coalesce(string_agg(row_to_json(s)::text,'|' order by empresa_id,local_id,producto_id),'')) from public.stock_ubicacion s;")"

test "$after_count" = "$before_count"
test "$after_hash" = "$before_hash"

echo "PM25_P02_RESTORE_FILAS=$after_count"
echo "PM25_P02_RESTORE_HASH=$after_hash"
echo 'PM25_P02_RESTORE_HASH_MATCH=PASS'
