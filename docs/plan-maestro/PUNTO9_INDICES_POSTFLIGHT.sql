-- PUNTO 9 · POSTFLIGHT READ-ONLY
-- Verifica que los dos índices creados por el candidato existen,
-- son B-tree, válidos, listos y cubren como primera clave la FK esperada.

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
