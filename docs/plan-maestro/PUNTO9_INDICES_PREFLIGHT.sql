-- PUNTO 9 · PREFLIGHT READ-ONLY · NO MODIFICA DATOS NI ESQUEMA
-- Baseline esperado: release@3e1e2558951e630a021f970c023e4731499de189
-- Objetivo: validar que siguen existiendo exactamente los dos huecos de índice
-- seleccionados para el candidato mínimo antes de ejecutar cualquier DDL.

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
