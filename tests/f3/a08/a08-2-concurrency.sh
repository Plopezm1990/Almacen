#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${PGHOST:-127.0.0.1}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-postgres}"
DB_NAME="${PGDATABASE:-postgres}"

psql_base=(psql -X -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -qAt)

sql() {
  "${psql_base[@]}" -c "$1"
}

assert_true() {
  local query="$1"
  local label="$2"
  local got
  got="$(sql "$query")"
  if [[ "$got" != "t" ]]; then
    echo "A08_2_2_FAIL:$label got=$got" >&2
    exit 1
  fi
}

wait_until_true() {
  local query="$1"
  local label="$2"
  local i
  for i in $(seq 1 80); do
    if [[ "$(sql "$query")" == "t" ]]; then
      echo "A08_2_2_OBSERVED:$label"
      return 0
    fi
    sleep 0.1
  done
  echo "A08_2_2_FAIL:$label not observed" >&2
  return 1
}

EMP="emp-f"
LOC="loc-f1"
USER_ID="00000000-0000-0000-0000-000000000021"
ACCOUNT_PAY="50000000-0000-0000-0000-000000000011"
ACCOUNT_SPLIT="50000000-0000-0000-0000-000000000012"
LINE_ID="70000000-0000-0000-0000-000000000011"
TERMINAL_A="20000000-0000-0000-0000-000000000013"
TERMINAL_B="20000000-0000-0000-0000-000000000014"
SESSION_ID="40000000-0000-0000-0000-000000000008"
DAY="2026-09-24"
CHECKOUT_ID="83000000-0000-0000-0000-000000000022"
SALE_ID="81000000-0000-0000-0000-000000000001"

PAYMENT_A="84000000-0000-0000-0000-000000000022"
ATTEMPT_A="85000000-0000-0000-0000-000000000022"
PAYMENT_B="84000000-0000-0000-0000-000000000023"
ATTEMPT_B="85000000-0000-0000-0000-000000000023"

# Baseline contract: account 12 must still own at least one movable unit of LINE_ID.
assert_true "
  select exists(
    select 1
      from public.cuenta_linea_repartos
     where empresa_id='$EMP'
       and local_id='$LOC'
       and source_line_id='$LINE_ID'::uuid
       and cuenta_id='$ACCOUNT_SPLIT'::uuid
       and estado='ACTIVO'
       and cantidad>=1
  );
" "movable_baseline"

sql "
  select set_config('request.jwt.claim.sub','$USER_ID',false);
  select public.abc_abrir_checkout(
    'a0822.checkout.open',
    '$EMP','$LOC',
    '$CHECKOUT_ID'::uuid,
    '$ACCOUNT_PAY'::uuid,
    array['$SALE_ID'::uuid],
    date '$DAY'
  );
" >/tmp/a0822-checkout.out

SRC_V="$(sql "select version from public.cuentas_comerciales where id='$ACCOUNT_SPLIT'::uuid;")"
DST_V="$(sql "select version from public.cuentas_comerciales where id='$ACCOUNT_PAY'::uuid;")"
LINE_V="$(sql "select version from public.pedido_lineas where id='$LINE_ID'::uuid;")"

# ---------------------------------------------------------------------------
# Scenario A: checkout/payment obtains the account interlock first.
# The split session must block on that same row lock, then reject after commit
# because the payment is now PENDIENTE / reservation ACTIVA.
# ---------------------------------------------------------------------------
(
  PGAPPNAME="a0822-payment-hold" psql -X -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"     -v ON_ERROR_STOP=1 -qAt > /tmp/a0822-payment-hold.out 2> /tmp/a0822-payment-hold.err <<SQL
begin;
select set_config('request.jwt.claim.sub','$USER_ID',false);
select public.abc_iniciar_cobro(
  'a0822.payment.hold',
  '$EMP','$LOC',
  '$CHECKOUT_ID'::uuid,
  '$PAYMENT_A'::uuid,
  '$ATTEMPT_A'::uuid,
  'TARJETA',11,'EUR',
  '$TERMINAL_A'::uuid,
  null,null
);
select 'A08_2_2_PAYMENT_RPC_RETURNED';
select pg_sleep(7);
commit;
SQL
) &
PAY_PID=$!

wait_until_true "
  select exists(
    select 1
      from pg_stat_activity
     where application_name='a0822-payment-hold'
       and state='active'
       and query like '%pg_sleep(7)%'
       and xact_start is not null
  );
" "payment_transaction_holds_lock"

(
  PGAPPNAME="a0822-split-wait" psql -X -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"     -v ON_ERROR_STOP=1 -qAt > /tmp/a0822-split-wait.out 2> /tmp/a0822-split-wait.err <<SQL
select set_config('request.jwt.claim.sub','$USER_ID',false);
select public.abc_mover_cantidad_linea_cuenta(
  'a0822.split.blocked',
  '$EMP','$LOC',
  '$LINE_ID'::uuid,
  '$ACCOUNT_SPLIT'::uuid,
  '$ACCOUNT_PAY'::uuid,
  1,null,
  $SRC_V,$DST_V,$LINE_V,
  '$TERMINAL_B'::uuid,
  '$SESSION_ID'::uuid,
  date '$DAY'
);
SQL
) &
SPLIT_WAIT_PID=$!

wait_until_true "
  select exists(
    select 1
      from pg_stat_activity b
      join pg_stat_activity a
        on a.application_name='a0822-payment-hold'
     where b.application_name='a0822-split-wait'
       and b.wait_event_type='Lock'
       and a.pid=any(pg_blocking_pids(b.pid))
  );
" "split_waits_for_payment_lock"

wait "$PAY_PID"

set +e
wait "$SPLIT_WAIT_PID"
SPLIT_WAIT_RC=$?
set -e

if [[ "$SPLIT_WAIT_RC" -eq 0 ]]; then
  echo "A08_2_2_FAIL:split accepted after pending payment committed" >&2
  cat /tmp/a0822-split-wait.out >&2 || true
  exit 1
fi
grep -q "cuenta_con_cobro_incierto" /tmp/a0822-split-wait.err

assert_true "select count(*)=1 from public.pagos where id='$PAYMENT_A'::uuid;" "payment_a_single"
assert_true "select count(*)=1 from public.pago_intentos where id='$ATTEMPT_A'::uuid;" "attempt_a_single"
assert_true "
  select count(*)=1
    from public.reservas_saldo
   where intento_id='$ATTEMPT_A'::uuid
     and estado='ACTIVA';
" "reservation_a_single"
assert_true "
  select count(*)=0
    from public.abc_eventos
   where operation_id='a0822.split.blocked'
     and event_type='CUENTA_REPARTO_LINEA_MOVIDO';
" "blocked_split_no_event"
assert_true "select version=$SRC_V from public.cuentas_comerciales where id='$ACCOUNT_SPLIT'::uuid;" "blocked_split_source_version_unchanged"
assert_true "select version=$DST_V from public.cuentas_comerciales where id='$ACCOUNT_PAY'::uuid;" "blocked_split_destination_version_unchanged"

# Resolve the first attempt to remove uncertainty before the reverse-order scenario.
sql "
  select set_config('request.jwt.claim.sub','$USER_ID',false);
  select public.abc_resolver_intento(
    'a0822.payment.reject',
    '$EMP','$LOC',
    '$ATTEMPT_A'::uuid,
    'RECHAZADO','SIMULADOR','a0822-provider-a',
    11,null,null,
    jsonb_build_object('fase','rechazado')
  );
" >/tmp/a0822-reject.out

assert_true "
  select count(*)=0
    from public.reservas_saldo
   where intento_id='$ATTEMPT_A'::uuid
     and estado='ACTIVA';
" "reservation_a_released"

# ---------------------------------------------------------------------------
# Scenario B: A08 split obtains the same account lock first.
# Payment must block until the split transaction commits, then proceed once.
# ---------------------------------------------------------------------------
SRC_V2="$(sql "select version from public.cuentas_comerciales where id='$ACCOUNT_SPLIT'::uuid;")"
DST_V2="$(sql "select version from public.cuentas_comerciales where id='$ACCOUNT_PAY'::uuid;")"
LINE_V2="$(sql "select version from public.pedido_lineas where id='$LINE_ID'::uuid;")"
FISC_SRC_BEFORE="$(sql "select private.abc_cantidad_fiscalizada_linea_cuenta('$EMP','$LOC','$LINE_ID'::uuid,'$ACCOUNT_SPLIT'::uuid);")"
FISC_DST_BEFORE="$(sql "select private.abc_cantidad_fiscalizada_linea_cuenta('$EMP','$LOC','$LINE_ID'::uuid,'$ACCOUNT_PAY'::uuid);")"

(
  PGAPPNAME="a0822-split-hold" psql -X -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"     -v ON_ERROR_STOP=1 -qAt > /tmp/a0822-split-hold.out 2> /tmp/a0822-split-hold.err <<SQL
begin;
select set_config('request.jwt.claim.sub','$USER_ID',false);
select public.abc_mover_cantidad_linea_cuenta(
  'a0822.split.hold',
  '$EMP','$LOC',
  '$LINE_ID'::uuid,
  '$ACCOUNT_SPLIT'::uuid,
  '$ACCOUNT_PAY'::uuid,
  1,null,
  $SRC_V2,$DST_V2,$LINE_V2,
  '$TERMINAL_B'::uuid,
  '$SESSION_ID'::uuid,
  date '$DAY'
);
select 'A08_2_2_SPLIT_RPC_RETURNED';
select pg_sleep(7);
commit;
SQL
) &
SPLIT_HOLD_PID=$!

wait_until_true "
  select exists(
    select 1
      from pg_stat_activity
     where application_name='a0822-split-hold'
       and state='active'
       and query like '%pg_sleep(7)%'
       and xact_start is not null
  );
" "split_transaction_holds_lock"

(
  PGAPPNAME="a0822-payment-wait" psql -X -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"     -v ON_ERROR_STOP=1 -qAt > /tmp/a0822-payment-wait.out 2> /tmp/a0822-payment-wait.err <<SQL
select set_config('request.jwt.claim.sub','$USER_ID',false);
select public.abc_iniciar_cobro(
  'a0822.payment.after-split',
  '$EMP','$LOC',
  '$CHECKOUT_ID'::uuid,
  '$PAYMENT_B'::uuid,
  '$ATTEMPT_B'::uuid,
  'TARJETA',11,'EUR',
  '$TERMINAL_A'::uuid,
  null,null
);
SQL
) &
PAY_WAIT_PID=$!

wait_until_true "
  select exists(
    select 1
      from pg_stat_activity b
      join pg_stat_activity a
        on a.application_name='a0822-split-hold'
     where b.application_name='a0822-payment-wait'
       and b.wait_event_type='Lock'
       and a.pid=any(pg_blocking_pids(b.pid))
  );
" "payment_waits_for_split_lock"

wait "$SPLIT_HOLD_PID"
wait "$PAY_WAIT_PID"

assert_true "select count(*)=1 from public.pagos where id='$PAYMENT_B'::uuid;" "payment_b_single"
assert_true "select count(*)=1 from public.pago_intentos where id='$ATTEMPT_B'::uuid;" "attempt_b_single"
assert_true "
  select count(*)=1
    from public.reservas_saldo
   where intento_id='$ATTEMPT_B'::uuid
     and estado='ACTIVA';
" "reservation_b_single"
assert_true "
  select count(*)=1
    from public.abc_eventos
   where operation_id='a0822.split.hold'
     and event_type='CUENTA_REPARTO_LINEA_MOVIDO';
" "split_event_single"
assert_true "select version=$((SRC_V2+1)) from public.cuentas_comerciales where id='$ACCOUNT_SPLIT'::uuid;" "source_version_increment_once"
assert_true "select version=$((DST_V2+1)) from public.cuentas_comerciales where id='$ACCOUNT_PAY'::uuid;" "destination_version_increment_once"
assert_true "
  select coalesce(sum(r.cantidad),0)=l.cantidad
    from public.pedido_lineas l
    left join public.cuenta_linea_repartos r
      on r.empresa_id=l.empresa_id
     and r.local_id=l.local_id
     and r.source_line_id=l.id
     and r.estado='ACTIVO'
   where l.id='$LINE_ID'::uuid
   group by l.cantidad;
" "reparto_quantity_conserved"

FISC_SRC_AFTER="$(sql "select private.abc_cantidad_fiscalizada_linea_cuenta('$EMP','$LOC','$LINE_ID'::uuid,'$ACCOUNT_SPLIT'::uuid);")"
FISC_DST_AFTER="$(sql "select private.abc_cantidad_fiscalizada_linea_cuenta('$EMP','$LOC','$LINE_ID'::uuid,'$ACCOUNT_PAY'::uuid);")"
if [[ "$FISC_SRC_BEFORE" != "$FISC_SRC_AFTER" || "$FISC_DST_BEFORE" != "$FISC_DST_AFTER" ]]; then
  echo "A08_2_2_FAIL:fiscalized_quantity_changed src=$FISC_SRC_BEFORE->$FISC_SRC_AFTER dst=$FISC_DST_BEFORE->$FISC_DST_AFTER" >&2
  exit 1
fi

# Exact replay of both completed operations must not duplicate effects.
sql "
  select set_config('request.jwt.claim.sub','$USER_ID',false);
  select public.abc_mover_cantidad_linea_cuenta(
    'a0822.split.hold',
    '$EMP','$LOC',
    '$LINE_ID'::uuid,
    '$ACCOUNT_SPLIT'::uuid,
    '$ACCOUNT_PAY'::uuid,
    1,null,
    $SRC_V2,$DST_V2,$LINE_V2,
    '$TERMINAL_B'::uuid,
    '$SESSION_ID'::uuid,
    date '$DAY'
  );
" >/tmp/a0822-split-replay.out

sql "
  select set_config('request.jwt.claim.sub','$USER_ID',false);
  select public.abc_iniciar_cobro(
    'a0822.payment.after-split',
    '$EMP','$LOC',
    '$CHECKOUT_ID'::uuid,
    '$PAYMENT_B'::uuid,
    '$ATTEMPT_B'::uuid,
    'TARJETA',11,'EUR',
    '$TERMINAL_A'::uuid,
    null,null
  );
" >/tmp/a0822-payment-replay.out

assert_true "
  select count(*)=1
    from public.abc_eventos
   where operation_id='a0822.split.hold'
     and event_type='CUENTA_REPARTO_LINEA_MOVIDO';
" "split_replay_no_duplicate"
assert_true "select count(*)=1 from public.pagos where id='$PAYMENT_B'::uuid;" "payment_replay_no_duplicate"
assert_true "select count(*)=1 from public.pago_intentos where id='$ATTEMPT_B'::uuid;" "attempt_replay_no_duplicate"
assert_true "
  select count(*)=1
    from public.reservas_saldo
   where intento_id='$ATTEMPT_B'::uuid
     and estado='ACTIVA';
" "reservation_replay_no_duplicate"

echo "ABC_F3_A08_2_2_CONCURRENCY=PASS"
