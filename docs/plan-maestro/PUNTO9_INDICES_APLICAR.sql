-- PUNTO 9 · CANDIDATO DDL · NO EJECUTAR SIN AUTORIZACIÓN PRODUCTIVA SEPARADA
-- Este archivo está deliberadamente en docs/plan-maestro, NO en supabase/migrations.
-- No usar db push ni migration repair para este candidato.
--
-- Diseño:
-- - transacción única: o se crean ambos índices o no se crea ninguno;
-- - lock_timeout=5s: si hay contención real, aborta en vez de esperar;
-- - statement_timeout=30s;
-- - sin cambios en datos, RLS, grants, funciones ni constraints.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_count integer;
  v_def text;
begin
  if to_regclass('public.locales') is null
     or to_regclass('public.movimientos_stock') is null
     or to_regclass('public.empresas') is null
     or to_regclass('public.stock_operaciones') is null then
    raise exception 'P09_PREFLIGHT_FALLO: falta una tabla requerida';
  end if;

  select pg_get_constraintdef(c.oid, true)
    into v_def
    from pg_constraint c
   where c.conrelid = 'public.locales'::regclass
     and c.conname = 'locales_empresa_id_fkey'
     and c.contype = 'f';

  if v_def is distinct from 'FOREIGN KEY (empresa_id) REFERENCES empresas(id)' then
    raise exception 'P09_PREFLIGHT_FALLO: FK locales_empresa_id_fkey inesperada: %', coalesce(v_def, '<ausente>');
  end if;

  select pg_get_constraintdef(c.oid, true)
    into v_def
    from pg_constraint c
   where c.conrelid = 'public.movimientos_stock'::regclass
     and c.conname = 'movimientos_stock_operation_id_fkey'
     and c.contype = 'f';

  if v_def is distinct from 'FOREIGN KEY (operation_id) REFERENCES stock_operaciones(operation_id) ON DELETE RESTRICT' then
    raise exception 'P09_PREFLIGHT_FALLO: FK movimientos_stock_operation_id_fkey inesperada: %', coalesce(v_def, '<ausente>');
  end if;

  if to_regclass('public.idx_locales_empresa_id') is not null then
    raise exception 'P09_PREFLIGHT_FALLO: idx_locales_empresa_id ya existe';
  end if;

  if to_regclass('public.idx_movimientos_stock_operation_id') is not null then
    raise exception 'P09_PREFLIGHT_FALLO: idx_movimientos_stock_operation_id ya existe';
  end if;

  select count(*)
    into v_count
    from pg_index ix
    join pg_class t on t.oid = ix.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a
      on a.attrelid = t.oid
     and a.attnum = ix.indkey[0]
   where n.nspname = 'public'
     and t.relname = 'locales'
     and ix.indisvalid
     and ix.indisready
     and a.attname = 'empresa_id';

  if v_count <> 0 then
    raise exception 'P09_PREFLIGHT_FALLO: locales(empresa_id) ya tiene % índice(s) de cobertura', v_count;
  end if;

  select count(*)
    into v_count
    from pg_index ix
    join pg_class t on t.oid = ix.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a
      on a.attrelid = t.oid
     and a.attnum = ix.indkey[0]
   where n.nspname = 'public'
     and t.relname = 'movimientos_stock'
     and ix.indisvalid
     and ix.indisready
     and a.attname = 'operation_id';

  if v_count <> 0 then
    raise exception 'P09_PREFLIGHT_FALLO: movimientos_stock(operation_id) ya tiene % índice(s) de cobertura', v_count;
  end if;

  raise notice 'P09_PREFLIGHT=PASS';
end
$preflight$;

create index idx_locales_empresa_id
  on public.locales using btree (empresa_id);

create index idx_movimientos_stock_operation_id
  on public.movimientos_stock using btree (operation_id);

do $postflight$
declare
  v_ok boolean;
begin
  select exists (
    select 1
      from pg_index ix
      join pg_class i on i.oid = ix.indexrelid
      join pg_class t on t.oid = ix.indrelid
      join pg_namespace n on n.oid = t.relnamespace
      join pg_am am on am.oid = i.relam
      join pg_attribute a
        on a.attrelid = t.oid
       and a.attnum = ix.indkey[0]
     where n.nspname = 'public'
       and t.relname = 'locales'
       and i.relname = 'idx_locales_empresa_id'
       and am.amname = 'btree'
       and ix.indisvalid
       and ix.indisready
       and not ix.indisunique
       and a.attname = 'empresa_id'
  ) into v_ok;

  if not v_ok then
    raise exception 'P09_POSTFLIGHT_FALLO: idx_locales_empresa_id no cumple el contrato';
  end if;

  select exists (
    select 1
      from pg_index ix
      join pg_class i on i.oid = ix.indexrelid
      join pg_class t on t.oid = ix.indrelid
      join pg_namespace n on n.oid = t.relnamespace
      join pg_am am on am.oid = i.relam
      join pg_attribute a
        on a.attrelid = t.oid
       and a.attnum = ix.indkey[0]
     where n.nspname = 'public'
       and t.relname = 'movimientos_stock'
       and i.relname = 'idx_movimientos_stock_operation_id'
       and am.amname = 'btree'
       and ix.indisvalid
       and ix.indisready
       and not ix.indisunique
       and a.attname = 'operation_id'
  ) into v_ok;

  if not v_ok then
    raise exception 'P09_POSTFLIGHT_FALLO: idx_movimientos_stock_operation_id no cumple el contrato';
  end if;

  raise notice 'P09_POSTFLIGHT=PASS';
end
$postflight$;

commit;
