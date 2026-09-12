-- PM26 / P09f-B3 · integrar pagos_encargo en la idempotencia global existente.
--
-- Este parche NO crea un segundo motor de idempotencia. Reutiliza exclusivamente:
--   private.g1_operation_ids_global
--   private.g1_claim_operation_id()
--
-- Política de seguridad del despliegue:
-- - abortar si falta cualquier dependencia esperada;
-- - abortar ante una colisión histórica de operation_id con otro ledger;
-- - bloquear brevemente pagos_encargo y el ledger global durante preflight/backfill;
-- - no modificar RPC ni datos económicos;
-- - no resolver silenciosamente colisiones existentes.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Preflight estructural antes de adquirir locks.
do $preflight$
begin
  if to_regclass('public.pagos_encargo') is null then
    raise exception 'PREFLIGHT_FALLO: falta public.pagos_encargo';
  end if;
  if to_regclass('private.g1_operation_ids_global') is null then
    raise exception 'PREFLIGHT_FALLO: falta private.g1_operation_ids_global';
  end if;
  if to_regprocedure('private.g1_claim_operation_id()') is null then
    raise exception 'PREFLIGHT_FALLO: falta private.g1_claim_operation_id()';
  end if;
end
$preflight$;

-- Evita una carrera entre el preflight, el backfill y nuevas reclamaciones globales.
lock table public.pagos_encargo in share row exclusive mode;
lock table private.g1_operation_ids_global in share row exclusive mode;

-- Con los locks ya adquiridos, una colisión histórica es un error duro.
do $preflight_locked$
begin
  if exists (
    select 1
      from public.pagos_encargo p
      join private.g1_operation_ids_global g
        on g.operation_id = p.operation_id
     where g.ledger <> 'pagos_encargo'
  ) then
    raise exception 'PREFLIGHT_FALLO: operation_id de pagos_encargo ya reclamado por otro ledger';
  end if;
end
$preflight_locked$;

-- Backfill conservador. El preflight anterior garantiza que un conflicto existente
-- solo puede pertenecer ya al mismo ledger.
insert into private.g1_operation_ids_global(operation_id, ledger)
select p.operation_id, 'pagos_encargo'
  from public.pagos_encargo p
on conflict (operation_id) do nothing;

-- Postcondición: cada pago existente debe quedar reclamado por pagos_encargo.
do $post_backfill$
begin
  if exists (
    select 1
      from public.pagos_encargo p
      left join private.g1_operation_ids_global g
        on g.operation_id = p.operation_id
     where g.operation_id is null
        or g.ledger <> 'pagos_encargo'
  ) then
    raise exception 'POSTCHECK_FALLO: backfill global incompleto para pagos_encargo';
  end if;
end
$post_backfill$;

-- Misma protección usada por pagos_factura, caja, stock y arqueos.
drop trigger if exists g1_operation_id_global on public.pagos_encargo;
create trigger g1_operation_id_global
before insert on public.pagos_encargo
for each row execute function private.g1_claim_operation_id();

-- Verificación final exacta del trigger instalado.
do $post_trigger$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace pn on pn.oid = p.pronamespace
   where not t.tgisinternal
     and n.nspname = 'public'
     and c.relname = 'pagos_encargo'
     and t.tgname = 'g1_operation_id_global'
     and pn.nspname = 'private'
     and p.proname = 'g1_claim_operation_id';

  if v_count <> 1 then
    raise exception 'POSTCHECK_FALLO: trigger global de pagos_encargo no instalado exactamente una vez';
  end if;
end
$post_trigger$;

commit;
