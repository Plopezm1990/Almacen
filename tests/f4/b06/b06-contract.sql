\set ON_ERROR_STOP on

-- F4 B06 / subpunto 1: los conceptos no venta tienen frontera propia,
-- no dependen de checkout_ventas/pagos y no admiten escritura directa.

do $$
declare
  v_rls boolean;
  v_def text;
begin
  if to_regclass('public.abc_cobros_no_venta') is null then
    raise exception 'F4_B06_FAIL: falta ledger no venta';
  end if;

  select c.relrowsecurity into v_rls
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='abc_cobros_no_venta';
  if v_rls is not true then
    raise exception 'F4_B06_FAIL: RLS no activado';
  end if;

  if has_table_privilege('anon','public.abc_cobros_no_venta','SELECT')
     or has_table_privilege('authenticated','public.abc_cobros_no_venta','INSERT')
     or has_table_privilege('authenticated','public.abc_cobros_no_venta','UPDATE')
     or has_table_privilege('authenticated','public.abc_cobros_no_venta','DELETE')
     or not has_table_privilege('authenticated','public.abc_cobros_no_venta','SELECT') then
    raise exception 'F4_B06_FAIL: ACL de ledger no venta incorrecta';
  end if;

  select pg_get_constraintdef(oid) into v_def
    from pg_constraint
   where conrelid='public.abc_cobros_no_venta'::regclass
     and conname='abc_cobro_no_venta_concepto';
  if coalesce(v_def,'') not like '%PROPINA%'
     or coalesce(v_def,'') not like '%ANTICIPO%'
     or coalesce(v_def,'') not like '%FIANZA%' then
    raise exception 'F4_B06_FAIL: conceptos no venta incompletos';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema='public'
       and table_name='abc_cobros_no_venta'
       and column_name in ('venta_fiscal_id','checkout_id','checkout_venta_id')
  ) then
    raise exception 'F4_B06_FAIL: ledger no venta acoplado a venta ordinaria';
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname='public'
       and tablename='abc_cobros_no_venta'
       and policyname='abc_cobros_no_venta_select'
       and cmd='SELECT'
  ) then
    raise exception 'F4_B06_FAIL: política de lectura ausente';
  end if;
end $$;

select 'ABC_F4_B06_SEPARATION=PASS' as result;
