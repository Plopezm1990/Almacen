-- ABC P3 · ruta autoritativa del catálogo de venta del TPV y precio con impuesto incluido (D31).
--
-- Problema que resuelve: la pantalla mantiene los productos en la colección heredada
-- `productos` (almacen_kv), pero A02/A03/A04 venden contra `catalogo_tpv_productos`, y
-- no existía ningún camino general que llevase uno al otro (la proyección PM10 solo
-- copia un producto de prueba con nombre fijo). En QA, además, la política PM05 de
-- `almacen_kv` rechaza las listas, así que el catálogo no se podía llenar.
--
-- Qué hace (aditiva, sin tocar datos existentes):
--  1. `catalogo_tpv_productos.precio_con_impuesto` (nullable). Si es NULL el producto
--     se calcula como hasta ahora (precio base + impuesto). Si tiene valor, es el
--     precio de carta con impuesto incluido (decisión D31 de Pedro, 2/10/2026): el total
--     de la línea sale exacto de cantidad x precio, y base e impuesto se derivan de él
--     (suman exactamente el total). `precio_unitario` sigue siendo el precio base, para
--     que lo que ya lo consuma (vista previa de la pantalla, instantáneas) no cambie.
--  2. `abc_calcular_linea_tpv` y `abc_calcular_linea_tpv_configurada` entienden esa
--     columna. Con NULL su resultado es idéntico al anterior.
--  3. `abc_catalogo_guardar_productos`: RPC transaccional con permiso por local
--     (Propietario/Encargado), operation_id (reintento idempotente y conflicto si el
--     mismo id llega con otro contenido) y resultado por producto. Crea o actualiza el
--     catálogo (sube la versión solo si algo de venta cambió), desactiva lo que deja de
--     ser vendible y crea la fila de stock inicial si falta (nunca la pisa).
--
-- No elige impuestos ni emisor fiscal: toma el contexto fiscal ya vinculado al local y
-- falla si no hay uno. No mueve stock existente. No activa proveedores.

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.catalogo_tpv_productos') is null then v_missing:=array_append(v_missing,'catalogo_tpv_productos'); end if;
  if to_regclass('public.catalogo_tpv_opciones') is null then v_missing:=array_append(v_missing,'catalogo_tpv_opciones'); end if;
  if to_regclass('public.stock_ubicacion') is null then v_missing:=array_append(v_missing,'stock_ubicacion'); end if;
  if to_regclass('public.entidad_fiscal_locales') is null then v_missing:=array_append(v_missing,'entidad_fiscal_locales'); end if;
  if to_regclass('public.entidad_fiscal_local_monedas') is null then v_missing:=array_append(v_missing,'entidad_fiscal_local_monedas'); end if;
  if to_regclass('public.entidades_fiscales') is null then v_missing:=array_append(v_missing,'entidades_fiscales'); end if;
  if to_regclass('public.membresias_usuario') is null then v_missing:=array_append(v_missing,'membresias_usuario'); end if;
  if to_regprocedure('private.abc_calcular_linea_tpv(text,text,text,text,numeric)') is null then v_missing:=array_append(v_missing,'abc_calcular_linea_tpv'); end if;
  if to_regprocedure('private.abc_calcular_linea_tpv_configurada(text,text,text,text,numeric,bigint,jsonb)') is null then v_missing:=array_append(v_missing,'abc_calcular_linea_tpv_configurada'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.la_tiene_local(text,text)') is null then v_missing:=array_append(v_missing,'la_tiene_local'); end if;
  if to_regprocedure('auth.uid()') is null then v_missing:=array_append(v_missing,'auth.uid'); end if;

  if cardinality(v_missing)>0 then
    raise exception 'ABC_P3_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if exists (
       select 1 from information_schema.columns
        where table_schema='public' and table_name='catalogo_tpv_productos'
          and column_name='precio_con_impuesto'
     )
     or to_regprocedure('private.abc_catalogo_puede_gestionar(text,text)') is not null
     or to_regprocedure('public.abc_catalogo_guardar_productos(text,text,text,text,jsonb)') is not null then
    raise exception 'ABC_P3_PREFLIGHT_FALLO: objetos P3 ya existen';
  end if;
end $$;

-- 1. Precio de carta con impuesto incluido (NULL = comportamiento anterior).
alter table public.catalogo_tpv_productos
  add column precio_con_impuesto numeric(24,8);

alter table public.catalogo_tpv_productos
  add constraint abc_catalogo_precio_con_impuesto check (
    precio_con_impuesto is null
    or (
      precio_con_impuesto>=0
      and abs(precio_unitario-round(precio_con_impuesto/(1+impuesto_pct/100),8))<=0.00000001
    )
  );

comment on column public.catalogo_tpv_productos.precio_con_impuesto is
  'Precio de carta con impuesto incluido (D31). NULL: precio_unitario es base y el impuesto se suma. Con valor: el total de linea sale de cantidad x este precio; precio_unitario es la base derivada y debe coincidir.';

-- 2. Calculo de linea en servidor (A03 y A04) con precio con impuesto incluido.
create or replace function private.abc_calcular_linea_tpv(
  p_empresa_id text,
  p_local_id text,
  p_producto_id text,
  p_currency_code text,
  p_cantidad numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_catalog public.catalogo_tpv_productos%rowtype;
  v_currency text:=upper(btrim(coalesce(p_currency_code,'')));
  v_cantidad numeric(24,8);
  v_bruto numeric(24,8);
  v_descuento numeric(24,8):=0;
  v_base numeric(24,8);
  v_impuestos numeric(24,8);
  v_total numeric(24,8);
begin
  if nullif(btrim(coalesce(p_producto_id,'')),'') is null then
    raise exception 'producto_id_requerido';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'moneda_linea_invalida'; end if;
  if p_cantidad is null or p_cantidad<=0 then raise exception 'cantidad_invalida'; end if;
  if p_cantidad<>round(p_cantidad,8) then raise exception 'cantidad_precision_maxima_excedida'; end if;

  select c.*
    into v_catalog
    from public.catalogo_tpv_productos c
    join public.entidad_fiscal_local_monedas elm
      on elm.empresa_id=c.empresa_id
     and elm.local_id=c.local_id
     and elm.entidad_fiscal_id=c.entidad_fiscal_id
     and elm.currency_code=c.currency_code
    join public.entidades_fiscales ef
      on ef.empresa_id=c.empresa_id
     and ef.id=c.entidad_fiscal_id
   where c.empresa_id=p_empresa_id
     and c.local_id=p_local_id
     and c.producto_id=btrim(p_producto_id)
     and c.currency_code=v_currency
     and c.activo=true
     and elm.activa=true
     and ef.activa=true;

  if not found then raise exception 'producto_tpv_no_disponible'; end if;

  if not v_catalog.fraccionable and p_cantidad<>trunc(p_cantidad) then
    raise exception 'cantidad_no_fraccionable';
  end if;
  if round(p_cantidad,v_catalog.precision_cantidad::integer)<>p_cantidad then
    raise exception 'cantidad_precision_invalida';
  end if;

  v_cantidad:=p_cantidad::numeric(24,8);
  if v_catalog.precio_con_impuesto is null then
    v_bruto:=round(v_cantidad*v_catalog.precio_unitario,8);
    v_base:=(v_bruto-v_descuento)::numeric(24,8);
    v_impuestos:=round(v_base*v_catalog.impuesto_pct/100,8);
    v_total:=round(v_base+v_impuestos,8);
  else
    -- D31: precio de carta con impuesto incluido. El total sale exacto de
    -- cantidad x precio con impuesto; base e impuesto se derivan de ese total
    -- y siempre suman exactamente el total.
    v_total:=round(v_cantidad*v_catalog.precio_con_impuesto,8);
    v_base:=round(v_total/(1+v_catalog.impuesto_pct/100),8);
    v_impuestos:=round(v_total-v_base,8);
    v_bruto:=round(v_base+v_descuento,8);
  end if;

  return jsonb_build_object(
    'producto_id',v_catalog.producto_id,
    'nombre',v_catalog.nombre,
    'unidad',v_catalog.unidad,
    'cantidad',v_cantidad,
    'currency_code',v_catalog.currency_code,
    'entidad_fiscal_id',v_catalog.entidad_fiscal_id,
    'precio_unitario',v_catalog.precio_unitario,
    'descuento_total',v_descuento,
    'base',v_base,
    'impuesto_pct',v_catalog.impuesto_pct,
    'impuestos',v_impuestos,
    'total',v_total,
    'catalog_version',v_catalog.version,
    'snapshot_comercial',jsonb_build_object(
      'producto_id',v_catalog.producto_id,
      'nombre',v_catalog.nombre,
      'unidad',v_catalog.unidad,
      'fraccionable',v_catalog.fraccionable,
      'precision_cantidad',v_catalog.precision_cantidad,
      'currency_code',v_catalog.currency_code,
      'entidad_fiscal_id',v_catalog.entidad_fiscal_id,
      'precio_unitario',v_catalog.precio_unitario,
      'impuesto_pct',v_catalog.impuesto_pct,
      'catalog_version',v_catalog.version,
      'catalog_snapshot',v_catalog.snapshot_origen,
      'precio_con_impuesto',v_catalog.precio_con_impuesto
    ),
    'snapshot_calculo',jsonb_build_object(
      'modo','SERVER_AUTHORITY_A03',
      'cantidad',v_cantidad,
      'precio_unitario',v_catalog.precio_unitario,
      'bruto',v_bruto,
      'descuento_total',v_descuento,
      'base',v_base,
      'impuesto_pct',v_catalog.impuesto_pct,
      'impuestos',v_impuestos,
      'total',v_total,
      'round_scale',8,
      'precio_con_impuesto',v_catalog.precio_con_impuesto
    )
  );
end $$;

create or replace function private.abc_calcular_linea_tpv_configurada(
  p_empresa_id text,
  p_local_id text,
  p_producto_id text,
  p_currency_code text,
  p_cantidad numeric,
  p_expected_product_version bigint,
  p_selecciones jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_catalog public.catalogo_tpv_productos%rowtype;
  v_currency text:=upper(btrim(coalesce(p_currency_code,'')));
  v_cantidad numeric(24,8);
  v_norm jsonb;
  v_pg record;
  v_sel jsonb;
  v_opt public.catalogo_tpv_opciones%rowtype;
  v_group_count integer;
  v_seen integer:=0;
  v_option_unit_delta numeric(24,8):=0;
  v_option_base numeric(24,8):=0;
  v_option_tax numeric(24,8):=0;
  v_option_total numeric(24,8):=0;
  v_component_base numeric(24,8);
  v_component_tax numeric(24,8);
  v_component_total numeric(24,8);
  v_component_tax_pct numeric(9,4);
  v_configured_unit numeric(24,8);
  v_base_product_base numeric(24,8);
  v_base_product_tax numeric(24,8);
  v_base_product_total numeric(24,8);
  v_base numeric(24,8);
  v_impuestos numeric(24,8);
  v_total numeric(24,8);
  v_options jsonb:='[]'::jsonb;
begin
  if nullif(btrim(coalesce(p_producto_id,'')),'') is null then
    raise exception 'producto_id_requerido';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'moneda_linea_invalida'; end if;
  if p_cantidad is null or p_cantidad<=0 then raise exception 'cantidad_invalida'; end if;
  if p_cantidad<>round(p_cantidad,8) then raise exception 'cantidad_precision_maxima_excedida'; end if;
  if p_expected_product_version is null or p_expected_product_version<1 then
    raise exception 'catalogo_producto_version_requerida';
  end if;

  v_norm:=private.abc_normalizar_selecciones_tpv(p_selecciones);

  select c.*
    into v_catalog
    from public.catalogo_tpv_productos c
    join public.entidad_fiscal_local_monedas elm
      on elm.empresa_id=c.empresa_id
     and elm.local_id=c.local_id
     and elm.entidad_fiscal_id=c.entidad_fiscal_id
     and elm.currency_code=c.currency_code
    join public.entidades_fiscales ef
      on ef.empresa_id=c.empresa_id
     and ef.id=c.entidad_fiscal_id
   where c.empresa_id=p_empresa_id
     and c.local_id=p_local_id
     and c.producto_id=btrim(p_producto_id)
     and c.currency_code=v_currency
     and c.activo=true
     and elm.activa=true
     and ef.activa=true
   for share of c;

  if not found then raise exception 'producto_tpv_no_disponible'; end if;
  if v_catalog.version<>p_expected_product_version then
    raise exception 'catalogo_producto_version_conflict';
  end if;

  if not v_catalog.fraccionable and p_cantidad<>trunc(p_cantidad) then
    raise exception 'cantidad_no_fraccionable';
  end if;
  if round(p_cantidad,v_catalog.precision_cantidad::integer)<>p_cantidad then
    raise exception 'cantidad_precision_invalida';
  end if;
  v_cantidad:=p_cantidad::numeric(24,8);

  for v_pg in
    select
      pg.grupo_id,pg.min_selecciones,pg.max_selecciones,
      pg.version as product_group_version,
      g.nombre as grupo_nombre,g.tipo_grupo,g.version as group_version
    from public.catalogo_tpv_producto_grupos pg
    join public.catalogo_tpv_grupos_opciones g
      on g.empresa_id=pg.empresa_id
     and g.local_id=pg.local_id
     and g.id=pg.grupo_id
    where pg.empresa_id=p_empresa_id
      and pg.local_id=p_local_id
      and pg.producto_id=v_catalog.producto_id
      and pg.currency_code=v_currency
      and pg.activo=true
      and g.activo=true
    order by pg.orden,g.orden,pg.grupo_id
    for share of pg,g
  loop
    if v_pg.tipo_grupo='VARIANTE' and v_pg.max_selecciones<>1 then
      raise exception 'grupo_variante_config_invalida';
    end if;

    select coalesce(sum((x->>'cantidad')::integer),0)::integer
      into v_group_count
      from jsonb_array_elements(v_norm) x
     where (x->>'grupo_id')::uuid=v_pg.grupo_id;

    if v_group_count<v_pg.min_selecciones then
      raise exception 'grupo_min_selecciones_incumplido:%',v_pg.grupo_id;
    end if;
    if v_group_count>v_pg.max_selecciones then
      raise exception 'grupo_max_selecciones_excedido:%',v_pg.grupo_id;
    end if;

    for v_sel in
      select value
        from jsonb_array_elements(v_norm)
       where (value->>'grupo_id')::uuid=v_pg.grupo_id
       order by value->>'opcion_id'
    loop
      if (v_sel->>'expected_group_version')::bigint<>v_pg.group_version then
        raise exception 'catalogo_grupo_version_conflict';
      end if;
      if (v_sel->>'expected_product_group_version')::bigint<>v_pg.product_group_version then
        raise exception 'catalogo_producto_grupo_version_conflict';
      end if;

      select o.*
        into v_opt
        from public.catalogo_tpv_opciones o
       where o.empresa_id=p_empresa_id
         and o.local_id=p_local_id
         and o.grupo_id=v_pg.grupo_id
         and o.id=(v_sel->>'opcion_id')::uuid
         and o.currency_code=v_currency
         and o.activo=true
       for share;

      if not found then raise exception 'opcion_tpv_no_disponible'; end if;
      if v_opt.version<>(v_sel->>'expected_option_version')::bigint then
        raise exception 'catalogo_opcion_version_conflict';
      end if;
      if (v_sel->>'cantidad')::integer>v_opt.max_cantidad then
        raise exception 'opcion_max_cantidad_excedida';
      end if;
      if v_pg.tipo_grupo='VARIANTE' and v_opt.tipo_opcion<>'VARIANTE' then
        raise exception 'opcion_incompatible_con_grupo_variante';
      end if;
      if v_pg.tipo_grupo='MODIFICADOR' and v_opt.tipo_opcion='VARIANTE' then
        raise exception 'opcion_variante_en_grupo_modificador';
      end if;

      v_component_tax_pct:=case
        when v_opt.hereda_impuesto then v_catalog.impuesto_pct
        else v_opt.impuesto_pct
      end;
      v_component_base:=round(
        v_cantidad*(v_sel->>'cantidad')::integer*v_opt.delta_precio,8
      );
      v_component_tax:=round(v_component_base*v_component_tax_pct/100,8);
      v_component_total:=round(v_component_base+v_component_tax,8);

      v_option_unit_delta:=v_option_unit_delta+
        ((v_sel->>'cantidad')::integer*v_opt.delta_precio);
      v_option_base:=v_option_base+v_component_base;
      v_option_tax:=v_option_tax+v_component_tax;
      v_option_total:=v_option_total+v_component_total;
      v_seen:=v_seen+1;

      v_options:=v_options||jsonb_build_array(jsonb_build_object(
        'grupo_id',v_pg.grupo_id,
        'grupo_nombre',v_pg.grupo_nombre,
        'tipo_grupo',v_pg.tipo_grupo,
        'opcion_id',v_opt.id,
        'opcion_nombre',v_opt.nombre,
        'tipo_opcion',v_opt.tipo_opcion,
        'cantidad',(v_sel->>'cantidad')::integer,
        'delta_precio_unitario',v_opt.delta_precio,
        'impuesto_pct',v_component_tax_pct,
        'base',v_component_base,
        'impuestos',v_component_tax,
        'total',v_component_total,
        'catalog_group_version',v_pg.group_version,
        'catalog_product_group_version',v_pg.product_group_version,
        'catalog_option_version',v_opt.version,
        'snapshot',jsonb_build_object(
          'hereda_impuesto',v_opt.hereda_impuesto,
          'catalog_snapshot',v_opt.snapshot_origen
        )
      ));
    end loop;
  end loop;

  if v_seen<>jsonb_array_length(v_norm) then
    raise exception 'seleccion_no_pertenece_producto';
  end if;

  v_configured_unit:=round(v_catalog.precio_unitario+v_option_unit_delta,8);
  if v_configured_unit<0 then raise exception 'precio_configurado_negativo'; end if;

  if v_catalog.precio_con_impuesto is null then
    v_base_product_base:=round(v_cantidad*v_catalog.precio_unitario,8);
    v_base_product_tax:=round(v_base_product_base*v_catalog.impuesto_pct/100,8);
  else
    -- D31: el componente del producto sale exacto de cantidad x precio con
    -- impuesto; base e impuesto se derivan del total. Las opciones mantienen
    -- su propia base de calculo.
    v_base_product_total:=round(v_cantidad*v_catalog.precio_con_impuesto,8);
    v_base_product_base:=round(v_base_product_total/(1+v_catalog.impuesto_pct/100),8);
    v_base_product_tax:=round(v_base_product_total-v_base_product_base,8);
  end if;
  v_base:=round(v_base_product_base+v_option_base,8);
  v_impuestos:=round(v_base_product_tax+v_option_tax,8);
  v_total:=round(v_base+v_impuestos,8);

  if v_base<0 or v_impuestos<0 or v_total<0 then
    raise exception 'importe_configurado_negativo';
  end if;

  return jsonb_build_object(
    'producto_id',v_catalog.producto_id,
    'nombre',v_catalog.nombre,
    'unidad',v_catalog.unidad,
    'cantidad',v_cantidad,
    'currency_code',v_catalog.currency_code,
    'entidad_fiscal_id',v_catalog.entidad_fiscal_id,
    'precio_unitario',v_configured_unit,
    'descuento_total',0,
    'base',v_base,
    'impuesto_base_pct',v_catalog.impuesto_pct,
    'impuestos',v_impuestos,
    'total',v_total,
    'catalog_version',v_catalog.version,
    'opciones',v_options,
    'snapshot_comercial',jsonb_build_object(
      'producto_id',v_catalog.producto_id,
      'nombre',v_catalog.nombre,
      'unidad',v_catalog.unidad,
      'currency_code',v_catalog.currency_code,
      'entidad_fiscal_id',v_catalog.entidad_fiscal_id,
      'precio_base_unitario',v_catalog.precio_unitario,
      'precio_configurado_unitario',v_configured_unit,
      'impuesto_base_pct',v_catalog.impuesto_pct,
      'precio_con_impuesto',v_catalog.precio_con_impuesto,
      'catalog_version',v_catalog.version,
      'catalog_snapshot',v_catalog.snapshot_origen,
      'opciones',v_options
    ),
    'snapshot_calculo',jsonb_build_object(
      'modo','SERVER_AUTHORITY_A04',
      'cantidad',v_cantidad,
      'precio_base_unitario',v_catalog.precio_unitario,
      'delta_opciones_unitario',v_option_unit_delta,
      'precio_configurado_unitario',v_configured_unit,
      'base_producto',v_base_product_base,
      'impuesto_producto',v_base_product_tax,
      'base_opciones',v_option_base,
      'impuesto_opciones',v_option_tax,
      'descuento_total',0,
      'base',v_base,
      'impuestos',v_impuestos,
      'total',v_total,
      'round_scale',8,
      'precio_con_impuesto',v_catalog.precio_con_impuesto,
      'opciones',v_options
    )
  );
end $$;

-- 3. Permiso para gestionar el catálogo de un local.
create function private.abc_catalogo_puede_gestionar(
  p_empresa_id text,
  p_local_id text
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_rol text;
begin
  if auth.uid() is null then return false; end if;
  if nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null then
    return false;
  end if;
  if not private.la_tiene_local(p_empresa_id,p_local_id) then return false; end if;

  select m.rol
    into v_rol
    from public.membresias_usuario m
   where m.user_id=auth.uid()
     and m.empresa_id=p_empresa_id
     and m.activo=true
     and (
       (m.todos_locales=false and m.local_id=p_local_id)
       or (m.todos_locales=true and m.local_id is null)
     )
   order by
     case when m.todos_locales=false and m.local_id=p_local_id then 0 else 1 end,
     m.id desc
   limit 1;

  return coalesce(v_rol,'') in ('Propietario','Encargado');
end $$;

-- Lectura numerica tolerante: devuelve NULL si el texto no es un numero decimal simple.
create function private.abc_catalogo_numero(p_texto text)
returns numeric
language sql
immutable
set search_path=''
as $$
  select case
    when btrim(coalesce(p_texto,'')) ~ '^[0-9]{1,15}(\.[0-9]{1,20})?$' then round(btrim(p_texto)::numeric,8)
    else null
  end
$$;

-- 4. RPC autoritativa. Recibe productos con la forma de la coleccion heredada
--    (id, localId, nombre, unidad, fraccionable, precisionCantidad, precioVenta CON
--    impuesto, ivaVenta, activo, tipo, stock, stockPisoVenta, stockMinimo) y devuelve un
--    resultado por producto. Solo toca los productos recibidos: lo ausente no se desactiva.
create function public.abc_catalogo_guardar_productos(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_currency_code text,
  p_productos jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_currency text:=upper(btrim(coalesce(p_currency_code,'')));
  v_n integer;
  v_ef_count integer;
  v_ef uuid;
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
  v_item jsonb;
  v_out jsonb:='[]'::jsonb;
  v_seen text[]:=array[]::text[];
  v_id text;
  v_loc text;
  v_emp text;
  v_nombre text;
  v_unidad text;
  v_tipo text;
  v_activo boolean;
  v_vendible boolean;
  v_frac boolean;
  v_prec integer;
  v_precio numeric;
  v_iva numeric;
  v_base numeric(24,8);
  v_stock numeric;
  v_piso numeric;
  v_minimo numeric;
  v_row public.catalogo_tpv_productos%rowtype;
  v_found boolean;
  v_rc integer;
  v_snapshot jsonb;
  v_estado text;
  v_motivo text;
  v_version bigint;
  c_creados integer:=0;
  c_actualizados integer:=0;
  c_sin_cambios integer:=0;
  c_desactivados integer:=0;
  c_omitidos integer:=0;
  c_stock integer:=0;
begin
  if auth.uid() is null
     or not private.abc_catalogo_puede_gestionar(p_empresa_id,p_local_id) then
    raise exception 'abc_catalogo_no_autorizado';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'moneda_catalogo_invalida'; end if;
  if p_productos is null or jsonb_typeof(p_productos)<>'array' then
    raise exception 'catalogo_productos_formato_invalido';
  end if;
  v_n:=jsonb_array_length(p_productos);
  if v_n=0 then raise exception 'catalogo_productos_vacio'; end if;
  if v_n>200 then raise exception 'catalogo_productos_demasiados'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_productos) e where jsonb_typeof(e)<>'object'
  ) then
    raise exception 'catalogo_producto_formato_invalido';
  end if;

  -- Contexto fiscal ya vinculado al local: exactamente uno activo con la moneda activa.
  select count(*), min(efl.entidad_fiscal_id::text)::uuid
    into v_ef_count, v_ef
    from public.entidad_fiscal_locales efl
    join public.entidades_fiscales ef
      on ef.empresa_id=efl.empresa_id and ef.id=efl.entidad_fiscal_id and ef.activa=true
    join public.entidad_fiscal_local_monedas elm
      on elm.empresa_id=efl.empresa_id and elm.local_id=efl.local_id
     and elm.entidad_fiscal_id=efl.entidad_fiscal_id
     and elm.currency_code=v_currency and elm.activa=true
   where efl.empresa_id=p_empresa_id
     and efl.local_id=p_local_id
     and efl.activa=true;
  if v_ef_count=0 then raise exception 'catalogo_contexto_fiscal_ausente'; end if;
  if v_ef_count>1 then raise exception 'catalogo_contexto_fiscal_ambiguo'; end if;

  v_request:=jsonb_build_object('currency_code',v_currency,'productos',p_productos);
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CATALOGO_GUARDAR_PRODUCTOS',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  -- Orden estable por id para que dos sincronizaciones simultaneas no se bloqueen entre si.
  for v_item in
    select e from jsonb_array_elements(p_productos) e order by e->>'id'
  loop
    v_estado:=null; v_motivo:=null; v_version:=null;
    v_id:=nullif(btrim(coalesce(v_item->>'id','')),'');
    v_loc:=nullif(btrim(coalesce(v_item->>'localId','')),'');
    v_emp:=nullif(btrim(coalesce(v_item->>'empresaId','')),'');

    if v_id is null or length(v_id)>200 then
      v_estado:='OMITIDO'; v_motivo:='id_invalido';
    elsif v_id=any(v_seen) then
      v_estado:='OMITIDO'; v_motivo:='id_duplicado';
    elsif v_emp is not null and v_emp<>p_empresa_id then
      v_estado:='OMITIDO'; v_motivo:='empresa_distinta';
    elsif v_loc is null then
      v_estado:='OMITIDO'; v_motivo:='sin_local';
    elsif v_loc<>p_local_id then
      v_estado:='OMITIDO'; v_motivo:='local_distinto';
    end if;
    if v_id is not null and not (v_id=any(v_seen)) then v_seen:=array_append(v_seen,v_id); end if;

    if v_estado is null then
      v_nombre:=nullif(btrim(coalesce(v_item->>'nombre','')),'');
      v_unidad:=coalesce(nullif(btrim(coalesce(v_item->>'unidad','')),''),'ud');
      v_tipo:=lower(btrim(coalesce(v_item->>'tipo','')));
      v_activo:=lower(btrim(coalesce(v_item->>'activo','true'))) not in ('false','f','0');
      v_frac:=lower(btrim(coalesce(v_item->>'fraccionable','false'))) in ('true','t','1');
      v_prec:=case
        when v_frac then least(6,greatest(0,coalesce(round(private.abc_catalogo_numero(v_item->>'precisionCantidad'))::integer,0)))
        else 0 end;
      v_vendible:=false;
      if v_activo then
        v_precio:=case
          when btrim(coalesce(v_item->>'precioVenta','')) = '' then 0
          else private.abc_catalogo_numero(v_item->>'precioVenta') end;
        v_iva:=round(private.abc_catalogo_numero(v_item->>'ivaVenta'),4);
        v_vendible:=(v_tipo='elaborado' or coalesce(v_precio,0)>0);
        if v_precio is null then
          v_estado:='OMITIDO'; v_motivo:='precio_invalido';
        elsif v_vendible and (v_iva is null or v_iva>100) then
          v_estado:='OMITIDO'; v_motivo:='iva_invalido';
        end if;
      end if;
    end if;

    if v_estado is null then
      select * into v_row
        from public.catalogo_tpv_productos c
       where c.empresa_id=p_empresa_id and c.local_id=p_local_id
         and c.producto_id=v_id and c.currency_code=v_currency
       for update;
      v_found:=found;

      if not v_activo or not v_vendible then
        if v_found and v_row.activo then
          update public.catalogo_tpv_productos
             set activo=false, version=version+1, updated_at=now()
           where empresa_id=p_empresa_id and local_id=p_local_id
             and producto_id=v_id and currency_code=v_currency
          returning version into v_version;
          v_estado:='DESACTIVADO'; c_desactivados:=c_desactivados+1;
        elsif v_found then
          v_estado:='SIN_CAMBIOS'; v_version:=v_row.version; c_sin_cambios:=c_sin_cambios+1;
        else
          v_estado:='OMITIDO';
          v_motivo:=case when not v_activo then 'inactivo' else 'no_vendible' end;
        end if;
      elsif v_nombre is null then
        v_estado:='OMITIDO'; v_motivo:='nombre_requerido';
      else
        v_base:=round(v_precio/(1+v_iva/100),8);
        v_snapshot:=jsonb_build_object(
          'origen','ABC_P3_GUARDAR_PRODUCTOS',
          'operation_id',p_operation_id,
          'codigo',nullif(btrim(coalesce(v_item->>'codigo','')),''),
          'categoria',nullif(btrim(coalesce(v_item->>'categoria','')),'')
        );
        if not v_found then
          insert into public.catalogo_tpv_productos(
            empresa_id,local_id,producto_id,currency_code,entidad_fiscal_id,
            nombre,unidad,fraccionable,precision_cantidad,
            precio_unitario,precio_con_impuesto,impuesto_pct,activo,version,snapshot_origen
          ) values (
            p_empresa_id,p_local_id,v_id,v_currency,v_ef,
            v_nombre,v_unidad,v_frac,v_prec,
            v_base,round(v_precio,8),v_iva,true,1,v_snapshot
          );
          v_estado:='CREADO'; v_version:=1; c_creados:=c_creados+1;
        elsif v_row.nombre is distinct from v_nombre
           or v_row.unidad is distinct from v_unidad
           or v_row.fraccionable is distinct from v_frac
           or v_row.precision_cantidad::integer is distinct from v_prec
           or v_row.precio_con_impuesto is distinct from round(v_precio,8)
           or v_row.precio_unitario is distinct from v_base
           or v_row.impuesto_pct is distinct from v_iva
           or v_row.activo is distinct from true then
          update public.catalogo_tpv_productos
             set nombre=v_nombre, unidad=v_unidad, fraccionable=v_frac,
                 precision_cantidad=v_prec, precio_unitario=v_base,
                 precio_con_impuesto=round(v_precio,8), impuesto_pct=v_iva,
                 activo=true, version=version+1, snapshot_origen=v_snapshot,
                 updated_at=now()
           where empresa_id=p_empresa_id and local_id=p_local_id
             and producto_id=v_id and currency_code=v_currency
          returning version into v_version;
          v_estado:='ACTUALIZADO'; c_actualizados:=c_actualizados+1;
        else
          v_estado:='SIN_CAMBIOS'; v_version:=v_row.version; c_sin_cambios:=c_sin_cambios+1;
        end if;

        -- Stock inicial solo si no existe fila: el stock vivo es del motor PM07.
        v_stock:=coalesce(private.abc_catalogo_numero(v_item->>'stock'),0);
        v_piso:=least(v_stock,coalesce(private.abc_catalogo_numero(v_item->>'stockPisoVenta'),0));
        v_minimo:=coalesce(private.abc_catalogo_numero(v_item->>'stockMinimo'),0);
        insert into public.stock_ubicacion(
          empresa_id,local_id,producto_id,almacen,piso,minimo,
          fraccionable,precision_cantidad,local_operable,unidad
        ) values (
          p_empresa_id,p_local_id,v_id,v_stock-v_piso,v_piso,v_minimo,
          v_frac,v_prec,true,v_unidad
        ) on conflict (empresa_id,local_id,producto_id) do nothing;
        get diagnostics v_rc = row_count;
        if v_rc>0 then c_stock:=c_stock+1; end if;
      end if;
    end if;

    if v_estado='OMITIDO' then c_omitidos:=c_omitidos+1; end if;
    v_out:=v_out||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'id',v_id,'resultado',v_estado,'motivo',v_motivo,'version',v_version
    )));
  end loop;

  v_result:=jsonb_build_object(
    'ok',true,
    'currency_code',v_currency,
    'resumen',jsonb_build_object(
      'creados',c_creados,'actualizados',c_actualizados,'sin_cambios',c_sin_cambios,
      'desactivados',c_desactivados,'omitidos',c_omitidos,'stock_inicial_creado',c_stock
    ),
    'productos',v_out
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

revoke all on function private.abc_catalogo_puede_gestionar(text,text)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_catalogo_numero(text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_catalogo_guardar_productos(text,text,text,text,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_catalogo_guardar_productos(text,text,text,text,jsonb)
  to authenticated;
