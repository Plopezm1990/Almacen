#!/usr/bin/env bash
# Ejecuta todos los .mjs no dependientes de DB/red bajo tests/, sin parar en el primer fallo.
set -u
cd /home/user/Almacen
OUT=/tmp/claude-0/-home-user-Almacen/34d4f5fa-1556-5298-b3ad-9e882c3d7680/scratchpad/punto2/results_non_db.tsv
> "$OUT"
DB_LIST=/tmp/claude-0/-home-user-Almacen/34d4f5fa-1556-5298-b3ad-9e882c3d7680/scratchpad/mjs_list.txt
EXCLUDE_DB="tests/pm12/db/|tests/pm12/supabase-full/|tests/pm14/db/|tests/pm33/db/|tests/pm33/supabase-full/"

while IFS= read -r f; do
  if echo "$f" | grep -qE "$EXCLUDE_DB"; then
    continue
  fi
  start=$(date +%s%N)
  out=$(timeout 60 node "$f" 2>&1)
  code=$?
  end=$(date +%s%N)
  ms=$(( (end - start) / 1000000 ))
  lastline=$(echo "$out" | tail -1 | tr '\t' ' ')
  printf '%s\t%s\t%sms\t%s\n' "$f" "$code" "$ms" "$lastline" >> "$OUT"
  echo "$f -> exit=$code (${ms}ms)"
done < "$DB_LIST"
echo "DONE"
