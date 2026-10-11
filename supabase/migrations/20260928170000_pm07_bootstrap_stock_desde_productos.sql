-- PM-07 · Inicialización segura del stock autoritativo desde el catálogo legado.
--
-- El catálogo de la aplicación se conserva en public.almacen_kv mientras que
-- las operaciones de venta/traspaso trabajan con public.stock_ubicacion. Esta
-- migración enlaza ambos mundos únicamente cuando la fila autoritativa aún no
-- existe; nunca reemplaza saldos que ya hayan sido modificados por RPCs.

create or replace function private.pm07_numero_catalogo(p_valor text, p_defecto numeric default 0)
returns numeric
language plpgsql
immutable
set search_path='pg_catalog','pg_temp'
as $$
begin
  if coalesce(btrim(p_valor),'') ~ '^[0-9]+(\.[0-9]+)?$' then
    return greatest(0, p_valor::numeric);
  end if;
  return greatest(0, coalesce(p_defecto,0));
end;
$$;

create or replace function private.pm07_inicializar_stock_desde_productos_kv()
returns trigger
language plpgsql
security definer
set search_path='public','auth','private','pg_catalog','pg_temp'
as $$
declare
  producto jsonb;
  v_empresa_id text;
  v_local_id text;
  v_producto_id text;
  v_total numeric;
  v_piso numeric;
  v_minimo numeric;
  v_precision smallint;
  v_fraccionable boolean;
  v_unidad text;
begin
  if new.key <> 'productos' then return new; end if;
  -- Solo un usuario autenticado con capacidad de gestionar stock puede
  -- provocar esta inicialización desde una escritura de catálogo.
  if auth.uid() is null or not coalesce(private.pm07_puede_gestionar_stock(),false) then
    return new;
  end if;

  for producto in select value from jsonb_array_elements(case when jsonb_typeof(new.value)='array' then new.value else '[]'::jsonb end)
  loop
    v_producto_id := nullif(btrim(producto->>'id'),'');
    v_empresa_id := nullif(btrim(coalesce(nullif(btrim(producto->>'empresaId'),''), nullif(btrim(new.empresa_id),''))),'');
    v_local_id := nullif(btrim(coalesce(nullif(btrim(producto->>'localId'),''), nullif(btrim(new.local_id),''))),'');
    if v_producto_id is null or v_empresa_id is null or v_local_id is null then continue; end if;
    if not private.la_tiene_empresa(v_empresa_id) or not private.la_tiene_local(v_empresa_id,v_local_id) then continue; end if;

    v_total := private.pm07_numero_catalogo(producto->>'stock');
    v_piso := least(v_total, private.pm07_numero_catalogo(producto->>'stockPisoVenta'));
    v_minimo := private.pm07_numero_catalogo(producto->>'stockMinimo');
    v_precision := least(6,greatest(0,round(private.pm07_numero_catalogo(coalesce(producto->>'precisionCantidad',producto->>'precision_cantidad')))::smallint));
    v_fraccionable := lower(coalesce(producto->>'fraccionable','false')) in ('true','t','1');
    v_unidad := coalesce(nullif(btrim(producto->>'unidad'),''),'ud');

    insert into public.stock_ubicacion(
      empresa_id,local_id,producto_id,almacen,piso,minimo,fraccionable,precision_cantidad,unidad,local_operable
    ) values (
      v_empresa_id,v_local_id,v_producto_id,v_total-v_piso,v_piso,v_minimo,v_fraccionable,v_precision,v_unidad,true
    ) on conflict (empresa_id,local_id,producto_id) do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists pm07_bootstrap_stock_desde_productos_kv on public.almacen_kv;
create trigger pm07_bootstrap_stock_desde_productos_kv
after insert or update of value, empresa_id, local_id on public.almacen_kv
for each row execute function private.pm07_inicializar_stock_desde_productos_kv();

-- Backfill único para productos existentes. La operación es idempotente y no
-- toca filas de stock que ya tengan movimientos u otro saldo autoritativo.
insert into public.stock_ubicacion(
  empresa_id,local_id,producto_id,almacen,piso,minimo,fraccionable,precision_cantidad,unidad,local_operable
)
select
  nullif(btrim(coalesce(nullif(btrim(producto->>'empresaId'),''), nullif(btrim(k.empresa_id),''))),'') as empresa_id,
  nullif(btrim(coalesce(nullif(btrim(producto->>'localId'),''), nullif(btrim(k.local_id),''))),'') as local_id,
  nullif(btrim(producto->>'id'),'') as producto_id,
  private.pm07_numero_catalogo(producto->>'stock')
    - least(private.pm07_numero_catalogo(producto->>'stock'),private.pm07_numero_catalogo(producto->>'stockPisoVenta')) as almacen,
  least(private.pm07_numero_catalogo(producto->>'stock'),private.pm07_numero_catalogo(producto->>'stockPisoVenta')) as piso,
  private.pm07_numero_catalogo(producto->>'stockMinimo') as minimo,
  lower(coalesce(producto->>'fraccionable','false')) in ('true','t','1') as fraccionable,
  least(6,greatest(0,round(private.pm07_numero_catalogo(coalesce(producto->>'precisionCantidad',producto->>'precision_cantidad')))::smallint)) as precision_cantidad,
  coalesce(nullif(btrim(producto->>'unidad'),''),'ud') as unidad,
  true as local_operable
from public.almacen_kv k
cross join lateral jsonb_array_elements(case when jsonb_typeof(k.value)='array' then k.value else '[]'::jsonb end) producto
where k.key='productos'
  and nullif(btrim(coalesce(nullif(btrim(producto->>'empresaId'),''), nullif(btrim(k.empresa_id),''))),'') is not null
  and nullif(btrim(coalesce(nullif(btrim(producto->>'localId'),''), nullif(btrim(k.local_id),''))),'') is not null
  and nullif(btrim(producto->>'id'),'') is not null
on conflict (empresa_id,local_id,producto_id) do nothing;

revoke all on function private.pm07_numero_catalogo(text,numeric) from public,anon,authenticated;
revoke all on function private.pm07_inicializar_stock_desde_productos_kv() from public,anon,authenticated;
