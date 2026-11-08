-- PM-10 · Corrección de alcance del bootstrap fiscal y catálogo TPV.
--
-- La migración original filtraba por nombres exactos y no funcionaba cuando
-- producción tenía la misma empresa/local con otra capitalización o nombre
-- comercial. Esta corrección usa las relaciones y el estado activo reales.
-- Es idempotente, conserva los locales inactivos y no sustituye catálogo
-- autoritativo ya existente.

do $$
begin
  if to_regclass('public.empresas') is null
     or to_regclass('public.locales') is null
     or to_regclass('public.entidades_fiscales') is null
     or to_regclass('public.entidad_fiscal_locales') is null
     or to_regclass('public.entidad_fiscal_monedas') is null
     or to_regclass('public.entidad_fiscal_local_monedas') is null
     or to_regclass('public.almacen_kv') is null
     or to_regclass('public.catalogo_tpv_productos') is null then
    raise exception 'PM10_BOOTSTRAP_SCOPE_FIX_PREFLIGHT_FALLO: dependencias ausentes';
  end if;
end $$;

-- Una entidad simulada por empresa solo cuando existe al menos un local activo
-- y todavía no hay contexto fiscal activo para esa empresa.
insert into public.entidades_fiscales(
  empresa_id,nombre_legal,country_code,simulada,activa,datos_legales
)
select distinct
  e.id,
  coalesce(nullif(btrim(e.nombre),''),'Empresa') || ' · Fiscal TPV simulado',
  'ES',
  true,
  true,
  jsonb_build_object('origen','pm10_bootstrap_scope_fix','modo','simulado')
from public.empresas e
where e.activo=true
  and exists (
    select 1
    from public.locales l
    where l.empresa_id=e.id
      and l.activo=true
  )
  and not exists (
    select 1
    from public.entidades_fiscales ef
    where ef.empresa_id=e.id
      and ef.activa=true
  );

-- Vincula cada local activo con la entidad fiscal activa más estable. Una
-- relación activa existente no se desplaza.
insert into public.entidad_fiscal_locales(
  empresa_id,local_id,entidad_fiscal_id,activa
)
select
  l.empresa_id,
  l.id,
  ef.id,
  true
from public.locales l
join lateral (
  select ef0.id
  from public.entidades_fiscales ef0
  where ef0.empresa_id=l.empresa_id
    and ef0.activa=true
  order by ef0.simulada desc,ef0.created_at,ef0.id
  limit 1
) ef on true
where l.activo=true
  and not exists (
    select 1
    from public.entidad_fiscal_locales efl0
    where efl0.empresa_id=l.empresa_id
      and efl0.local_id=l.id
      and efl0.activa=true
  )
on conflict (empresa_id,local_id,entidad_fiscal_id)
do update set activa=true;

-- La aplicación trabaja en EUR en el flujo TPV/caja.
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
 and l.activo=true
join public.entidades_fiscales ef
  on ef.empresa_id=efl.empresa_id
 and ef.id=efl.entidad_fiscal_id
 and ef.activa=true
where efl.activa=true
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
 and l.activo=true
join public.entidad_fiscal_monedas efm
  on efm.empresa_id=efl.empresa_id
 and efm.entidad_fiscal_id=efl.entidad_fiscal_id
 and efm.currency_code='EUR'
 and efm.activa=true
where efl.activa=true
on conflict (empresa_id,local_id,entidad_fiscal_id,currency_code)
do update set activa=true;

-- Proyecta todos los productos legados del local activo. La empresa/local se
-- toma del propio registro JSON cuando existe y, si no, del contexto de KV.
-- Nunca se leen productos de locales inactivos.
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
  least(8,greatest(0,trunc(private.pm10_numero_catalogo(
    coalesce(producto->>'precisionCantidad',producto->>'precision_cantidad'),0
  ))::smallint)),
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
  join public.locales l
    on l.empresa_id=efl.empresa_id
   and l.id=efl.local_id
   and l.activo=true
  join public.entidad_fiscal_local_monedas efm
    on efm.empresa_id=efl.empresa_id
   and efm.local_id=efl.local_id
   and efm.entidad_fiscal_id=efl.entidad_fiscal_id
   and efm.currency_code='EUR'
   and efm.activa=true
  where efl.activa=true
    and efl.empresa_id=coalesce(nullif(btrim(producto->>'empresaId'),''),nullif(btrim(k.empresa_id),''))
    and efl.local_id=coalesce(nullif(btrim(producto->>'localId'),''),nullif(btrim(k.local_id),''))
  order by efl.entidad_fiscal_id
  limit 1
) scope on true
where k.key='productos'
  and nullif(btrim(producto->>'id'),'') is not null
on conflict (empresa_id,local_id,producto_id,currency_code) do nothing;

