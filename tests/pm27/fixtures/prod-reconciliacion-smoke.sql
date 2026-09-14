\set ON_ERROR_STOP on
begin;

create or replace function auth.uid()
returns uuid language sql stable
as $$ select '11111111-1111-1111-1111-111111111111'::uuid $$;

insert into auth.users(id) values ('11111111-1111-1111-1111-111111111111');
insert into public.encargos_empresa(id,empresa_id,local_id,cliente_id,datos)
values (
  'enc-test','emp-test','loc-test','cli-test',
  '{"total":"10.00","estado":"Pendiente","empresaId":"emp-test","localId":"loc-test"}'::jsonb
);

do $smoke$
declare
  r1 jsonb;
  r2 jsonb;
begin
  r1 := public.registrar_pago_encargo(
    'pago-test','pay-test-0001','enc-test','emp-test','loc-test',
    'SEÑAL',4.00,current_date,'Efectivo','{}'::jsonb
  );
  if coalesce((r1->>'ok')::boolean,false) is not true
     or coalesce((r1->>'replayed')::boolean,true) is not false then
    raise exception 'smoke_pago_alta';
  end if;

  r2 := public.registrar_pago_encargo(
    'pago-test','pay-test-0001','enc-test','emp-test','loc-test',
    'SEÑAL',4.00,current_date,'Efectivo','{}'::jsonb
  );
  if coalesce((r2->>'replayed')::boolean,false) is not true then
    raise exception 'smoke_pago_replay';
  end if;

  if not exists (
    select 1 from private.g1_operation_ids_global
     where operation_id='pay-test-0001' and ledger='pagos_encargo'
  ) then
    raise exception 'smoke_pago_ledger_global';
  end if;
end
$smoke$;

rollback;
select 'PM27_PROD_RECON_PAGOS_SMOKE=PASS' as resultado;
