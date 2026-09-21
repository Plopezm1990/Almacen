-- PUNTO 9 · ROLLBACK HACIA DELANTE · NO EJECUTAR SIN AUTORIZACIÓN SEPARADA
-- Solo elimina los dos índices del candidato si su estructura coincide
-- exactamente con el contrato esperado. No toca ningún índice preexistente.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $rollback_preflight$
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
    raise exception 'P09_ROLLBACK_PREFLIGHT_FALLO: idx_locales_empresa_id ausente o con drift';
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
    raise exception 'P09_ROLLBACK_PREFLIGHT_FALLO: idx_movimientos_stock_operation_id ausente o con drift';
  end if;

  raise notice 'P09_ROLLBACK_PREFLIGHT=PASS';
end
$rollback_preflight$;

drop index public.idx_movimientos_stock_operation_id;
drop index public.idx_locales_empresa_id;

do $rollback_postflight$
begin
  if to_regclass('public.idx_locales_empresa_id') is not null
     or to_regclass('public.idx_movimientos_stock_operation_id') is not null then
    raise exception 'P09_ROLLBACK_POSTFLIGHT_FALLO: persiste al menos un índice del candidato';
  end if;

  raise notice 'P09_ROLLBACK_POSTFLIGHT=PASS';
end
$rollback_postflight$;

commit;
