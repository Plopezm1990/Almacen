-- PM-10 · Bootstrap idempotente del contexto fiscal y catálogo TPV.
--
-- La aplicación conserva el catálogo de productos en public.almacen_kv,
-- mientras que A02/A03/A04 exigen un catálogo fiscal autoritativo en
-- public.catalogo_tpv_productos. Esta migración crea únicamente el contexto
-- fiscal simulado que falta en locales activos sin configuración y proyecta
-- los productos existentes que todavía no tienen fila TPV.
--
-- No reemplaza filas de catálogo existentes ni modifica precios, stock o
-- productos locales. La operación es idempotente.

do $$
begin
  if to_regclass('public.empresas') is null
     or to_regclass('public.locales') is null
     or to_regclass('public.almacen_kv') is null
     or to_regclass('public.entidades_fiscales') is null
     or to_regclass('public.entidad_fiscal_locales') is null
     or to_regclass('public.entidad_fiscal_monedas') is null
     or to_regclass('public.entidad_fiscal_local_monedas') is null
     or to_regclass('public.catalogo_tpv_productos') is null then
    raise exception 'PM10_TPV_CATALOGO_PREFLIGHT_FALLO: dependencias ausentes';
  end if;
end $$;

create or replace function private.pm10_numero_catalogo(
  p_valor text,
  p_defecto numeric default 0
)
returns numeric
language plpgsql
immutable
set search_path='pg_catalog','pg_temp'
as $$
begin
  if coalesce(btrim(p_valor),'') ~ '^-?[0-9]+(\.[0-9]+)?$' then
    return p_valor::numeric;
  end if;
  return coalesce(p_defecto,0);
end;
$$;

-- Si el proyecto aún no tiene ninguna entidad fiscal activa, crea una entidad
-- simulada por empresa. Se usa solo para habilitar el flujo TPV de pruebas.
insert into public.entidades_fiscales(
  empresa_id,nombre_legal,country_code,simulada,activa,datos_legales
)
select distinct
  e.id,
  coalesce(nullif(btrim(e.nombre),''),'Empresa') || ' · Fiscal TPV simulado',
  'ES',
  true,
  true,
  jsonb_build_object('origen','pm10_bootstrap_tpv_catalogo','modo','simulado')
from public.empresas e
join public.locales l
  on l.empresa_id=e.id
 and l.activo=true
 and l.nombre='Chocoloyos S.L'
where e.activo=true
  and e.nombre='Chocolateria San Gines'
  and not exists (
    select 1
    from public.entidades_fiscales ef
    where ef.empresa_id=e.id
      and ef.activa=true
  );

-- Enlaza una única entidad fiscal activa con cada local activo que aún no la
-- tenga, sin desplazar una configuración ya existente.
insert into public.entidad_fiscal_locales(
  empresa_id,local_id,entidad_fiscal_id,activa
)
select
  l.empresa_id,
  l.id,
  ef.id,
  true
from public.locales l
join public.empresas e
  on e.id=l.empresa_id
 and e.nombre='Chocolateria San Gines'
join lateral (
  select ef0.id
  from public.entidades_fiscales ef0
  where ef0.empresa_id=l.empresa_id
    and ef0.activa=true
  order by ef0.simulada desc,ef0.created_at,ef0.id
  limit 1
) ef on true
where l.activo=true
  and l.nombre='Chocoloyos S.L'
  and not exists (
    select 1
    from public.entidad_fiscal_locales efl0
    where efl0.empresa_id=l.empresa_id
      and efl0.local_id=l.id
      and efl0.activa=true
  )
on conflict (empresa_id,local_id,entidad_fiscal_id)
do update set activa=true;

-- EUR es la moneda que ya utiliza el TPV y la apertura de caja del proyecto.
insert into public.entidad_fiscal_monedas(
  empresa_id,entidad_fiscal_id,currency_code,es_principal,activa
)
select distinct
  efl.empresa_id,
  efl.entidad_fiscal_id,
  'EUR',
  true,
  true
from public.entidad_fiscal_locales efl
join public.locales l
  on l.empresa_id=efl.empresa_id
 and l.id=efl.local_id
 and l.nombre='Chocoloyos S.L'
join public.empresas e
  on e.id=efl.empresa_id
 and e.nombre='Chocolateria San Gines'
join public.entidades_fiscales ef
  on ef.empresa_id=efl.empresa_id
 and ef.id=efl.entidad_fiscal_id
where efl.activa=true
  and ef.activa=true
on conflict (empresa_id,entidad_fiscal_id,currency_code) do nothing;

insert into public.entidad_fiscal_local_monedas(
  empresa_id,local_id,entidad_fiscal_id,currency_code,activa
)
select distinct
  efl.empresa_id,
  efl.local_id,
  efl.entidad_fiscal_id,
  'EUR',
  true
from public.entidad_fiscal_locales efl
join public.locales l
  on l.empresa_id=efl.empresa_id
 and l.id=efl.local_id
 and l.nombre='Chocoloyos S.L'
join public.empresas e
  on e.id=efl.empresa_id
 and e.nombre='Chocolateria San Gines'
join public.entidad_fiscal_monedas efm
  on efm.empresa_id=efl.empresa_id
 and efm.entidad_fiscal_id=efl.entidad_fiscal_id
 and efm.currency_code='EUR'
where efl.activa=true
  and efm.activa=true
on conflict (empresa_id,local_id,entidad_fiscal_id,currency_code)
do update set activa=true;

-- Proyección única desde el catálogo legado. ON CONFLICT DO NOTHING protege
-- cualquier catálogo que ya haya sido mantenido con autoridad del servidor.
insert into public.catalogo_tpv_productos(
  empresa_id,
  local_id,
  producto_id,
  currency_code,
  entidad_fiscal_id,
  nombre,
  unidad,
  fraccionable,
  precision_cantidad,
  precio_unitario,
  impuesto_pct,
  activo,
  version,
  snapshot_origen
)
select
  scope.empresa_id,
  scope.local_id,
  nullif(btrim(producto->>'id'),''),
  scope.currency_code,
  scope.entidad_fiscal_id,
  coalesce(nullif(btrim(producto->>'nombre'),''),'Producto'),
  coalesce(nullif(btrim(producto->>'unidad'),''),'ud'),
  lower(coalesce(producto->>'fraccionable','false')) in ('true','t','1'),
  least(
    8,
    greatest(
      0,
      trunc(private.pm10_numero_catalogo(
        coalesce(producto->>'precisionCantidad',producto->>'precision_cantidad'),0
      ))::smallint
    )
  ),
  greatest(0,private.pm10_numero_catalogo(
    coalesce(producto->>'precioVenta',producto->>'precio_venta'),0
  )),
  least(100,greatest(0,private.pm10_numero_catalogo(
    coalesce(producto->>'ivaVenta',producto->>'iva_venta'),21
  ))),
  lower(coalesce(producto->>'activo','true')) not in ('false','f','0'),
  1,
  producto
from public.almacen_kv k
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(k.value)='array' then k.value else '[]'::jsonb end
) producto
join lateral (
  select
    efl.empresa_id,
    efl.local_id,
    efl.entidad_fiscal_id,
    efm.currency_code
  from public.entidad_fiscal_locales efl
  join public.entidad_fiscal_local_monedas efm
    on efm.empresa_id=efl.empresa_id
   and efm.local_id=efl.local_id
   and efm.entidad_fiscal_id=efl.entidad_fiscal_id
   and efm.currency_code='EUR'
  where efl.activa=true
    and efm.activa=true
    and efl.empresa_id=coalesce(nullif(btrim(producto->>'empresaId'),''),nullif(btrim(k.empresa_id),''))
    and efl.local_id=coalesce(nullif(btrim(producto->>'localId'),''),nullif(btrim(k.local_id),''))
  order by efl.entidad_fiscal_id
  limit 1
) scope on true
where k.key='productos'
  and producto->>'nombre'='PRUEBA A10 VALIDACION'
  and nullif(btrim(producto->>'id'),'') is not null
on conflict (empresa_id,local_id,producto_id,currency_code) do nothing;

revoke all on function private.pm10_numero_catalogo(text,numeric)
from public,anon,authenticated;
