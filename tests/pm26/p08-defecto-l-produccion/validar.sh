#!/usr/bin/env bash
# PM26 P08 -- valida de punta a punta, en un Postgres local aislado
# (nunca contra QA ni produccion), la propuesta del Defecto L: anadir
# aislamiento por empresa/local a prefiltros_candidatos en PRODUCCION,
# reutilizando el helper private.la_tiene_local ya vigente y probado
# ahi mismo (movimientos_stock, stock_operaciones, stock_ubicacion).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRACION="$DIR/migracion-propuesta.sql"
PREFLIGHT="$DIR/preflight-independiente.sql"
DB="pm26_p08_defecto_l_$$"
PSQL="${POSTGRES_PSQL:-psql}"
RUN_AS_POSTGRES="${POSTGRES_SUDO:-sudo -u postgres}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"; $RUN_AS_POSTGRES $PSQL -c "drop database if exists \"$DB\";" >/dev/null 2>&1 || true' EXIT

fallo() { echo "PM26_P08_FALLO: $1" >&2; exit 1; }

psql_archivo() {
  local archivo="$1" db="$2"
  cat "$archivo" | $RUN_AS_POSTGRES $PSQL -d "$db" -v ON_ERROR_STOP=1
}

[ -f "$MIGRACION" ] || fallo "no se encuentra la migracion propuesta en $MIGRACION"
[ -f "$PREFLIGHT" ] || fallo "no se encuentra el preflight independiente en $PREFLIGHT"
if [ -f "/home/user/Almacen/supabase/migrations/$(basename "$MIGRACION")" ] || [ -f "/home/user/Almacen/supabase/qa-solo/$(basename "$MIGRACION")" ]; then
  fallo "la migracion propuesta del Defecto L no debe existir dentro de supabase/ -- no esta autorizada su aplicacion"
fi
echo "PM26_P08_FUERA_DE_SUPABASE=PASS"

$RUN_AS_POSTGRES $PSQL -c "drop database if exists \"$DB\";" >/dev/null
$RUN_AS_POSTGRES $PSQL -c "create database \"$DB\";" >/dev/null

psql_archivo "$DIR/schema.sql" "$DB" >/dev/null \
  || fallo "no se pudo aplicar schema.sql"
echo "PM26_P08_SCHEMA=PASS"

psql_archivo "$DIR/seed.sql" "$DB" >/dev/null \
  || fallo "no se pudo aplicar seed.sql"
echo "PM26_P08_SEED=PASS"

# --- PM26 P08b: comportamiento del cliente ANTES de la migracion --
# confirma que el cliente actual sigue funcionando y reproduce, de
# forma real, la brecha exacta que el Defecto L corrige. ---
SALIDA_ANTERIOR="$(psql_archivo "$DIR/transicion-anterior.sql" "$DB" 2>&1)" \
  || { echo "$SALIDA_ANTERIOR" >&2; fallo "transicion-anterior.sql fallo al ejecutarse"; }
echo "$SALIDA_ANTERIOR" > "$WORKDIR/anterior.txt"
for n in ANT1 ANT2_BRECHA_REPRODUCIDA; do
  grep -q "$n=PASS" "$WORKDIR/anterior.txt" || { echo "$SALIDA_ANTERIOR" >&2; fallo "falta o no paso el caso $n (esquema anterior)"; }
done
FILAS_TRAS_ANTERIOR="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from public.prefiltros_candidatos;")"
[ "$FILAS_TRAS_ANTERIOR" = "0" ] || fallo "tras la transicion anterior deberian quedar 0 filas, encontrado $FILAS_TRAS_ANTERIOR"
echo "PM26_P08_TRANSICION_ANTERIOR=PASS"

# --- Positivo: el preflight independiente, de solo lectura, pasa sobre
# el catalogo aislado limpio (las 3 politicas reales de produccion,
# sin aislamiento todavia). ---
PREFLIGHT_OK="$(psql_archivo "$PREFLIGHT" "$DB" 2>&1)" \
  || { echo "$PREFLIGHT_OK" >&2; fallo "el preflight independiente no paso sobre el catalogo limpio"; }
echo "$PREFLIGHT_OK" | grep -q "PREFLIGHT_CATALOGO=PASS" \
  || fallo "el preflight independiente no emitio PREFLIGHT_CATALOGO=PASS"
echo "PM26_P08_PREFLIGHT_INDEPENDIENTE=PASS"

# --- Negativo: simular un catalogo distinto (renombrar una politica
# real, dentro de una transaccion que se revierte) -- el preflight debe
# abortar por no encontrar las 3 politicas esperadas. ---
$RUN_AS_POSTGRES $PSQL -d "$DB" -c \
  'alter policy "prefiltros - propietario lee" on public.prefiltros_candidatos using (true);' >/dev/null
NEG_CATALOGO="$(psql_archivo "$PREFLIGHT" "$DB" 2>&1 || true)"
echo "$NEG_CATALOGO" | grep -q "PREFLIGHT_FALLO" \
  || fallo "el preflight debia fallar al detectar un catalogo distinto, y no fallo"
$RUN_AS_POSTGRES $PSQL -d "$DB" -c \
  "alter policy \"prefiltros - propietario lee\" on public.prefiltros_candidatos using (exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = true and p.rol = 'Propietario'::text));" >/dev/null
echo "PM26_P08_PREFLIGHT_DETECTA_CATALOGO_DISTINTO=PASS"

# --- Negativo: simular una fila existente -- el preflight debe abortar
# porque exige 0 filas. ---
$RUN_AS_POSTGRES $PSQL -d "$DB" -c \
  "insert into public.prefiltros_candidatos (token, candidato_nombre) values ('token-simulado', 'Simulado');" >/dev/null
NEG_FILAS="$(psql_archivo "$PREFLIGHT" "$DB" 2>&1 || true)"
echo "$NEG_FILAS" | grep -q "PREFLIGHT_FALLO" \
  || fallo "el preflight debia fallar al encontrar una fila existente simulada, y no fallo"
$RUN_AS_POSTGRES $PSQL -d "$DB" -c \
  "delete from public.prefiltros_candidatos where token='token-simulado';" >/dev/null
echo "PM26_P08_PREFLIGHT_DETECTA_FILAS_EXISTENTES=PASS"

FILAS_TRAS_LIMPIEZA="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from public.prefiltros_candidatos;")"
[ "$FILAS_TRAS_LIMPIEZA" = "0" ] || fallo "tras limpiar los simulacros deberian quedar 0 filas, encontrado $FILAS_TRAS_LIMPIEZA"

# --- Negativo (endurecimiento): redefinir la_tiene_local con un cuerpo
# distinto pero la misma firma -- el preflight debe abortar por la
# comprobacion de huella del cuerpo, no solo de la firma. ---
$RUN_AS_POSTGRES $PSQL -d "$DB" -c \
  "create or replace function private.la_tiene_local(p_empresa text, p_local text) returns boolean language sql stable security definer set search_path to '' as \$\$ select true; \$\$;" >/dev/null
NEG_CUERPO="$(psql_archivo "$PREFLIGHT" "$DB" 2>&1 || true)"
echo "$NEG_CUERPO" | grep -q "el cuerpo de private.la_tiene_local no coincide" \
  || fallo "el preflight debia fallar al detectar un cuerpo distinto del helper, y no fallo"
$RUN_AS_POSTGRES $PSQL -d "$DB" -c "
create or replace function private.la_tiene_local(p_empresa text, p_local text) returns boolean
language sql stable security definer
set search_path to ''
as \$\$
  select private.la_usuario_activo()
     and nullif(btrim(p_empresa),'') is not null
     and nullif(btrim(p_local),'') is not null
     and upper(btrim(p_local)) <> 'TODOS'
     and exists(
       select 1 from public.membresias_usuario m
        where m.user_id=(select auth.uid()) and m.empresa_id=p_empresa and m.activo=true
          and (m.todos_locales=true or m.local_id=p_local)
     );
\$\$;
" >/dev/null || fallo "no se pudo restaurar la_tiene_local original tras el simulacro de cuerpo distinto"
echo "PM26_P08_PREFLIGHT_DETECTA_CUERPO_HELPER_DISTINTO=PASS"

# --- Negativo (endurecimiento): simular presencia de un helper de QA
# -- el preflight debe abortar por no ser produccion. ---
$RUN_AS_POSTGRES $PSQL -d "$DB" -c \
  "create function private.pm11_puede_ver_personal(p_empresa_id text, p_local_id text) returns boolean language sql as \$\$ select true; \$\$;" >/dev/null
NEG_QA="$(psql_archivo "$PREFLIGHT" "$DB" 2>&1 || true)"
echo "$NEG_QA" | grep -q "esto parece QA, no produccion" \
  || fallo "el preflight debia fallar al detectar un helper de QA, y no fallo"
$RUN_AS_POSTGRES $PSQL -d "$DB" -c \
  "drop function private.pm11_puede_ver_personal(text, text);" >/dev/null
echo "PM26_P08_PREFLIGHT_DETECTA_HELPER_QA=PASS"

# --- Negativo: simular un estado parcial donde SOLO local_id ya
# existe (empresa_id no) -- el preflight debe abortar especificamente
# por local_id, no solo por empresa_id (que en este simulacro ni
# siquiera existe todavia). ---
$RUN_AS_POSTGRES $PSQL -d "$DB" -c \
  "alter table public.prefiltros_candidatos add column local_id text;" >/dev/null
NEG_LOCAL_ID="$(psql_archivo "$PREFLIGHT" "$DB" 2>&1 || true)"
echo "$NEG_LOCAL_ID" | grep -q "prefiltros_candidatos.local_id ya existe" \
  || { echo "$NEG_LOCAL_ID" >&2; fallo "el preflight debia fallar especificamente por local_id ya existente, y no fallo"; }
$RUN_AS_POSTGRES $PSQL -d "$DB" -c \
  "alter table public.prefiltros_candidatos drop column local_id;" >/dev/null
echo "PM26_P08_PREFLIGHT_DETECTA_LOCAL_ID_PARCIAL=PASS"

# --- Aplicar la migracion propuesta (positivo). ---
psql_archivo "$MIGRACION" "$DB" >/dev/null \
  || fallo "la migracion propuesta no se aplico limpiamente"
echo "PM26_P08_MIGRACION_APLICADA=PASS"

# --- PM26 P08b: comportamiento del cliente DESPUES de la migracion --
# el cliente antiguo (sin empresa/local) debe fallar de forma real, el
# cliente nuevo debe funcionar, y el patron DELETE...RETURNING (lo que
# hace .delete().select() en supabase-js) debe cerrar la brecha
# reproducida en el esquema anterior sin dejar residuo. ---
SALIDA_POSTERIOR="$(psql_archivo "$DIR/transicion-posterior.sql" "$DB" 2>&1)" \
  || { echo "$SALIDA_POSTERIOR" >&2; fallo "transicion-posterior.sql fallo al ejecutarse"; }
echo "$SALIDA_POSTERIOR" > "$WORKDIR/posterior.txt"
for n in POST1_CLIENTE_ANTIGUO_FALLA POST2_CLIENTE_NUEVO_FUNCIONA POST3_BRECHA_CERRADA POST3_SIN_RESIDUO_BORRADO POST4_BORRADO_PROPIO_FUNCIONA; do
  grep -q "$n=PASS" "$WORKDIR/posterior.txt" || { echo "$SALIDA_POSTERIOR" >&2; fallo "falta o no paso el caso $n (esquema posterior)"; }
done
FILAS_TRAS_POSTERIOR="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from public.prefiltros_candidatos;")"
[ "$FILAS_TRAS_POSTERIOR" = "0" ] || fallo "tras la transicion posterior deberian quedar 0 filas, encontrado $FILAS_TRAS_POSTERIOR"
echo "PM26_P08_TRANSICION_POSTERIOR=PASS"

# --- Bateria de comportamiento. ---
SALIDA="$(psql_archivo "$DIR/comportamiento.sql" "$DB" 2>&1)" \
  || { echo "$SALIDA" >&2; fallo "la bateria de comportamiento fallo al ejecutarse"; }
echo "$SALIDA" > "$WORKDIR/comportamiento.txt"
FALLOS="$(grep -c '=FAIL' "$WORKDIR/comportamiento.txt" || true)"
if [ "$FALLOS" != "0" ]; then
  grep '=FAIL' "$WORKDIR/comportamiento.txt" >&2
  fallo "$FALLOS caso(s) de la bateria de comportamiento fallaron"
fi
for n in P1 P2 P3 N4 N5 N6 N7 N8 P9 N10 P11 N12 N12_SIN_RESIDUO_BORRADO N13; do
  # psql antepone "NOTICE:  " a cada linea -- no anclar a inicio de linea.
  grep -q "$n=PASS" "$WORKDIR/comportamiento.txt" || { echo "$SALIDA" >&2; fallo "falta o no paso el caso $n"; }
done
echo "PM26_P08_BATERIA_CASOS=PASS"

# --- Reaplicar inmediatamente despues debe fallar (columnas ya existen). ---
REAPLICAR="$(psql_archivo "$MIGRACION" "$DB" 2>&1 || true)"
echo "$REAPLICAR" | grep -q "PREFLIGHT_FALLO" \
  || fallo "reaplicar la migracion inmediatamente despues debia fallar por PREFLIGHT_FALLO y no fallo"
echo "PM26_P08_REAPLICACION_RECHAZADA=PASS"

# --- PM26 P08b: rollback CONSERVADOR -- simula que ya hubo trafico
# real (las filas que dejo la bateria de comportamiento, con
# empresa_id/local_id reales) y comprueba que revertir.sql (el
# exacto/destructivo) se niega a ejecutarse, y que
# revertir-conservador.sql revierte el comportamiento sin perder ni un
# byte de esos datos. ---
CONSERVADOR="$DIR/revertir-conservador.sql"
[ -f "$CONSERVADOR" ] || fallo "no se encuentra revertir-conservador.sql en $CONSERVADOR"

FILAS_ANTES_ROLLBACK="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from public.prefiltros_candidatos;")"
[ "$FILAS_ANTES_ROLLBACK" != "0" ] || fallo "se esperaban filas reales de la bateria antes de probar el rollback conservador, encontrado 0"
SNAPSHOT_ANTES="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select token || '|' || empresa_id || '|' || local_id from public.prefiltros_candidatos order by token;")"

# Negativo: revertir.sql (exacto) debe abortar sin tocar nada porque hay filas.
NEG_REVERTIR="$(psql_archivo "$DIR/revertir.sql" "$DB" 2>&1 || true)"
echo "$NEG_REVERTIR" | grep -q "ROLLBACK_FALLO" \
  || { echo "$NEG_REVERTIR" >&2; fallo "revertir.sql debia abortar con filas existentes (ROLLBACK_FALLO) y no lo hizo"; }
FILAS_TRAS_NEG="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from public.prefiltros_candidatos;")"
[ "$FILAS_TRAS_NEG" = "$FILAS_ANTES_ROLLBACK" ] || fallo "revertir.sql no debia cambiar el numero de filas al abortar, encontrado $FILAS_TRAS_NEG vs $FILAS_ANTES_ROLLBACK"
COLUMNAS_TRAS_NEG="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from information_schema.columns where table_schema='public' and table_name='prefiltros_candidatos' and column_name in ('empresa_id','local_id') and is_nullable='NO';")"
[ "$COLUMNAS_TRAS_NEG" = "2" ] || fallo "revertir.sql no debia tocar las columnas al abortar -- se esperaban 2 NOT NULL, encontrado $COLUMNAS_TRAS_NEG"
echo "PM26_P08_ROLLBACK_EXACTO_RECHAZA_CON_TRAFICO=PASS"

# Negativo (PM26 P08c): sin la autorizacion declarada a mano en la
# sesion, el rollback conservador debe abortar. Es un procedimiento
# excepcional y manual que REABRE el Defecto L: no puede ejecutarse por
# inercia ni desde un automatismo, y el rechazo no debe tocar nada.
NEG_CONSERVADOR="$(psql_archivo "$CONSERVADOR" "$DB" 2>&1 || true)"
echo "$NEG_CONSERVADOR" | grep -q "ROLLBACK_CONSERVADOR_BLOQUEADO" \
  || { echo "$NEG_CONSERVADOR" >&2; fallo "revertir-conservador.sql debia abortar sin autorizacion explicita en la sesion"; }
POLITICAS_TRAS_NEG_CONS="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid where c.relname='prefiltros_candidatos' and (coalesce(pg_get_expr(p.polqual,p.polrelid),'') ~ 'la_tiene_local' or coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'') ~ 'la_tiene_local');")"
[ "$POLITICAS_TRAS_NEG_CONS" = "3" ] || fallo "el rechazo por falta de autorizacion no debia tocar las politicas con aislamiento, encontrado $POLITICAS_TRAS_NEG_CONS de 3"
COLUMNAS_TRAS_NEG_CONS="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from information_schema.columns where table_schema='public' and table_name='prefiltros_candidatos' and column_name in ('empresa_id','local_id') and is_nullable='NO';")"
[ "$COLUMNAS_TRAS_NEG_CONS" = "2" ] || fallo "el rechazo por falta de autorizacion no debia relajar NOT NULL, encontrado $COLUMNAS_TRAS_NEG_CONS de 2"
echo "PM26_P08_ROLLBACK_CONSERVADOR_EXIGE_AUTORIZACION=PASS"

# Positivo: con la autorizacion declarada a mano en la sesion (nunca
# dentro del archivo), revierte las 3 politicas y relaja NOT NULL sin
# borrar ni modificar ninguna fila.
{ echo "set pm26.autorizacion_reapertura_defecto_l = 'CONFIRMADA';"; cat "$CONSERVADOR"; } \
  | $RUN_AS_POSTGRES $PSQL -d "$DB" -v ON_ERROR_STOP=1 >/dev/null \
  || fallo "revertir-conservador.sql no se aplico limpiamente con la autorizacion declarada"
SNAPSHOT_DESPUES="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select token || '|' || empresa_id || '|' || local_id from public.prefiltros_candidatos order by token;")"
[ "$SNAPSHOT_ANTES" = "$SNAPSHOT_DESPUES" ] \
  || fallo "revertir-conservador.sql no debia alterar ningun dato existente -- filas distintas antes/despues"
COLUMNAS_NULLABLE="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from information_schema.columns where table_schema='public' and table_name='prefiltros_candidatos' and column_name in ('empresa_id','local_id') and is_nullable='YES';")"
[ "$COLUMNAS_NULLABLE" = "2" ] || fallo "revertir-conservador.sql debia dejar empresa_id/local_id nullable, encontrado $COLUMNAS_NULLABLE de 2"
POLITICAS_ORIGINALES="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid where c.relname='prefiltros_candidatos' and coalesce(pg_get_expr(p.polqual,p.polrelid),'') !~ 'la_tiene_local' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'') !~ 'la_tiene_local';")"
[ "$POLITICAS_ORIGINALES" = "3" ] || fallo "revertir-conservador.sql debia restaurar las 3 politicas originales sin la_tiene_local, encontrado $POLITICAS_ORIGINALES de 3"
echo "PM26_P08_ROLLBACK_CONSERVADOR_PRESERVA_DATOS=PASS"

# El arnes reaplica manualmente el aislamiento (politicas + NOT NULL)
# para poder seguir ejercitando el resto de la bateria ya existente
# sobre el esquema migrado -- esto es bookkeeping del arnes de pruebas,
# no forma parte de ningun procedimiento real de despliegue/rollback.
$RUN_AS_POSTGRES $PSQL -d "$DB" -c "alter table public.prefiltros_candidatos alter column empresa_id set not null;" >/dev/null
$RUN_AS_POSTGRES $PSQL -d "$DB" -c "alter table public.prefiltros_candidatos alter column local_id set not null;" >/dev/null
$RUN_AS_POSTGRES $PSQL -d "$DB" -c "drop policy if exists \"prefiltros - propietario lee\" on public.prefiltros_candidatos;" >/dev/null
$RUN_AS_POSTGRES $PSQL -d "$DB" -c "create policy \"prefiltros - propietario lee\" on public.prefiltros_candidatos for select to authenticated using (exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = true and p.rol = 'Propietario'::text) and private.la_tiene_local(empresa_id, local_id));" >/dev/null
$RUN_AS_POSTGRES $PSQL -d "$DB" -c "drop policy if exists \"prefiltros - propietario crea\" on public.prefiltros_candidatos;" >/dev/null
$RUN_AS_POSTGRES $PSQL -d "$DB" -c "create policy \"prefiltros - propietario crea\" on public.prefiltros_candidatos for insert to authenticated with check (exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = true and p.rol = 'Propietario'::text) and private.la_tiene_local(empresa_id, local_id));" >/dev/null
$RUN_AS_POSTGRES $PSQL -d "$DB" -c "drop policy if exists \"prefiltros - propietario borra\" on public.prefiltros_candidatos;" >/dev/null
$RUN_AS_POSTGRES $PSQL -d "$DB" -c "create policy \"prefiltros - propietario borra\" on public.prefiltros_candidatos for delete to authenticated using (exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = true and p.rol = 'Propietario'::text) and private.la_tiene_local(empresa_id, local_id));" >/dev/null
FILAS_TRAS_RESTAURAR="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from public.prefiltros_candidatos;")"
[ "$FILAS_TRAS_RESTAURAR" = "$FILAS_ANTES_ROLLBACK" ] || fallo "el arnes no debia perder filas al reaplicar el aislamiento tras el simulacro de rollback conservador"

# --- La bateria de comportamiento dejo filas de prueba (tok-p1,
# tok-p2) -- revertir.sql NO las borra a proposito (un revert real no
# debe destruir datos); aqui, solo en este arnes aislado, se limpian
# para que el preflight de "tabla vacia" pueda volver a pasar despues
# de revertir. ---
$RUN_AS_POSTGRES $PSQL -d "$DB" -c "delete from public.prefiltros_candidatos;" >/dev/null \
  || fallo "no se pudieron limpiar las filas de prueba antes de revertir"

# --- Reversion exacta. ---
psql_archivo "$DIR/revertir.sql" "$DB" >/dev/null \
  || fallo "la reversion no se aplico limpiamente"

COLUMNAS_TRAS_REVERTIR="$($RUN_AS_POSTGRES $PSQL -d "$DB" -tAc "select count(*) from information_schema.columns where table_schema='public' and table_name='prefiltros_candidatos' and column_name in ('empresa_id','local_id');")"
[ "$COLUMNAS_TRAS_REVERTIR" = "0" ] || fallo "tras revertir no deberian quedar las columnas empresa_id/local_id, encontrado $COLUMNAS_TRAS_REVERTIR"
echo "PM26_P08_REVERSION_EXACTA=PASS"

PREFLIGHT_TRAS_REVERTIR="$(psql_archivo "$PREFLIGHT" "$DB" 2>&1)" \
  || { echo "$PREFLIGHT_TRAS_REVERTIR" >&2; fallo "el preflight independiente debia volver a pasar tras revertir"; }
echo "$PREFLIGHT_TRAS_REVERTIR" | grep -q "PREFLIGHT_CATALOGO=PASS" \
  || fallo "el preflight independiente no volvio a pasar tras revertir"
echo "PM26_P08_PREFLIGHT_PASA_TRAS_REVERTIR=PASS"

# --- Reaplicar limpio tras revertir (la tabla ya quedo vacia antes de
# revertir). ---
psql_archivo "$MIGRACION" "$DB" >/dev/null \
  || fallo "no se pudo reaplicar la migracion propuesta tras revertir"
echo "PM26_P08_REAPLICACION_LIMPIA_TRAS_REVERTIR=PASS"

echo "PM26_P08_VALIDACION_COMPLETA=PASS"
