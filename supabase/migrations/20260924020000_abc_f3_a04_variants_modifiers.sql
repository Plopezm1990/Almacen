-- ABC F3 A04 — variantes, modificadores y snapshot histórico de configuración.
-- Aditiva. No activa frontend, no mueve stock, no cobra y no crea catálogo real.
-- Depende de F3 A03.

do $$
declare v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.catalogo_tpv_productos') is null then v_missing:=array_append(v_missing,'catalogo_tpv_productos'); end if;
  if to_regclass('public.pedido_lineas') is null then v_missing:=array_append(v_missing,'pedido_lineas'); end if;
  if to_regprocedure('private.abc_calcular_linea_tpv(text,text,text,text,numeric)') is null then v_missing:=array_append(v_missing,'abc_calcular_linea_tpv'); end if;
  if to_regprocedure('private.abc_terminal_sesion_operativa(text,text,uuid,uuid)') is null then v_missing:=array_append(v_missing,'abc_terminal_sesion_operativa'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F3_A04_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if to_regclass('public.catalogo_tpv_grupos_opciones') is not null
     or to_regclass('public.catalogo_tpv_producto_grupos') is not null
     or to_regclass('public.catalogo_tpv_opciones') is not null
     or to_regclass('public.pedido_linea_opciones') is not null
     or to_regprocedure('private.abc_calcular_linea_tpv_configurada(text,text,text,text,numeric,bigint,jsonb)') is not null
     or to_regprocedure('public.abc_agregar_linea_pedido_configurada(text,text,text,uuid,uuid,text,numeric,bigint,jsonb,bigint,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_actualizar_linea_pedido_configurada(text,text,text,uuid,numeric,bigint,jsonb,bigint,bigint,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_confirmar_linea_pedido_configurada(text,text,text,uuid,bigint,jsonb,bigint,bigint,uuid,uuid,date)') is not null then
    raise exception 'ABC_F3_A04_PREFLIGHT_FALLO: objetos A04 ya existen';
  end if;
end $$;

create table public.catalogo_tpv_grupos_opciones (
  id uuid not null default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  nombre text not null,
  tipo_grupo text not null,
  orden integer not null default 0,
  activo boolean not null default true,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  constraint abc_grupo_nombre check (nullif(btrim(nombre),'') is not null),
  constraint abc_grupo_tipo check (tipo_grupo in ('VARIANTE','MODIFICADOR')),
  constraint abc_grupo_version check (version>=1),
  constraint abc_grupo_local_fk
    foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint abc_grupo_scope_id_uq unique (empresa_id,local_id,id)
);

create table public.catalogo_tpv_producto_grupos (
  empresa_id text not null,
  local_id text not null,
  producto_id text not null,
  currency_code text not null,
  grupo_id uuid not null,
  min_selecciones smallint not null default 0,
  max_selecciones smallint not null default 1,
  orden integer not null default 0,
  activo boolean not null default true,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (empresa_id,local_id,producto_id,currency_code,grupo_id),
  constraint abc_producto_grupo_moneda check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_producto_grupo_min check (min_selecciones>=0),
  constraint abc_producto_grupo_max check (max_selecciones>=1),
  constraint abc_producto_grupo_rango check (max_selecciones>=min_selecciones),
  constraint abc_producto_grupo_version check (version>=1),
  constraint abc_producto_grupo_producto_fk
    foreign key (empresa_id,local_id,producto_id,currency_code)
    references public.catalogo_tpv_productos(empresa_id,local_id,producto_id,currency_code)
    on delete restrict,
  constraint abc_producto_grupo_grupo_fk
    foreign key (empresa_id,local_id,grupo_id)
    references public.catalogo_tpv_grupos_opciones(empresa_id,local_id,id)
    on delete restrict
);

create table public.catalogo_tpv_opciones (
  id uuid not null default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  grupo_id uuid not null,
  currency_code text not null,
  nombre text not null,
  tipo_opcion text not null,
  delta_precio numeric(24,8) not null default 0,
  hereda_impuesto boolean not null default true,
  impuesto_pct numeric(9,4),
  max_cantidad smallint not null default 1,
  orden integer not null default 0,
  activo boolean not null default true,
  version bigint not null default 1,
  snapshot_origen jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  constraint abc_opcion_nombre check (nullif(btrim(nombre),'') is not null),
  constraint abc_opcion_tipo check (
    tipo_opcion in ('VARIANTE','EXTRA','RETIRADA','SUSTITUCION','COMPLEMENTO')
  ),
  constraint abc_opcion_moneda check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_opcion_impuesto check (
    (hereda_impuesto and impuesto_pct is null)
    or
    (not hereda_impuesto and impuesto_pct is not null and impuesto_pct>=0 and impuesto_pct<=100)
  ),
  constraint abc_opcion_max_cantidad check (max_cantidad>=1),
  constraint abc_opcion_version check (version>=1),
  constraint abc_opcion_grupo_fk
    foreign key (empresa_id,local_id,grupo_id)
    references public.catalogo_tpv_grupos_opciones(empresa_id,local_id,id)
    on delete restrict,
  constraint abc_opcion_scope_id_currency_uq
    unique (empresa_id,local_id,grupo_id,id,currency_code)
);

create table public.pedido_linea_opciones (
  id uuid not null default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  linea_id uuid not null,
  grupo_id uuid not null,
  opcion_id uuid not null,
  tipo_grupo text not null,
  tipo_opcion text not null,
  nombre_grupo text not null,
  nombre_opcion text not null,
  cantidad smallint not null,
  delta_precio_unitario numeric(24,8) not null,
  impuesto_pct numeric(9,4) not null,
  base numeric(24,8) not null,
  impuestos numeric(24,8) not null,
  total numeric(24,8) not null,
  catalog_group_version bigint not null,
  catalog_product_group_version bigint not null,
  catalog_option_version bigint not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  created_operating_day date not null,
  primary key (id),
  constraint abc_linea_opcion_cantidad check (cantidad>=1),
  constraint abc_linea_opcion_grupo_tipo check (tipo_grupo in ('VARIANTE','MODIFICADOR')),
  constraint abc_linea_opcion_tipo check (
    tipo_opcion in ('VARIANTE','EXTRA','RETIRADA','SUSTITUCION','COMPLEMENTO')
  ),
  constraint abc_linea_opcion_impuesto check (impuesto_pct>=0 and impuesto_pct<=100),
  constraint abc_linea_opcion_versions check (
    catalog_group_version>=1
    and catalog_product_group_version>=1
    and catalog_option_version>=1
  ),
  constraint abc_linea_opcion_linea_fk
    foreign key (empresa_id,local_id,linea_id)
    references public.pedido_lineas(empresa_id,local_id,id)
    on delete cascade,
  constraint abc_linea_opcion_actor_fk
    foreign key (created_by) references auth.users(id) on delete restrict,
  constraint abc_linea_opcion_unica
    unique (empresa_id,local_id,linea_id,grupo_id,opcion_id)
);

create index abc_grupo_scope_activo_idx
  on public.catalogo_tpv_grupos_opciones(empresa_id,local_id,activo,tipo_grupo,orden,id);

create index abc_producto_grupo_scope_idx
  on public.catalogo_tpv_producto_grupos(
    empresa_id,local_id,producto_id,currency_code,activo,orden,grupo_id
  );

create index abc_opcion_scope_activo_idx
  on public.catalogo_tpv_opciones(
    empresa_id,local_id,grupo_id,currency_code,activo,orden,id
  );

create index abc_linea_opcion_linea_idx
  on public.pedido_linea_opciones(empresa_id,local_id,linea_id,created_at,id);

alter table public.catalogo_tpv_grupos_opciones enable row level security;
alter table public.catalogo_tpv_producto_grupos enable row level security;
alter table public.catalogo_tpv_opciones enable row level security;
alter table public.pedido_linea_opciones enable row level security;

create policy abc_grupos_opciones_select
on public.catalogo_tpv_grupos_opciones
for select to authenticated
using (private.la_tiene_local(empresa_id,local_id));

create policy abc_producto_grupos_select
on public.catalogo_tpv_producto_grupos
for select to authenticated
using (private.la_tiene_local(empresa_id,local_id));

create policy abc_opciones_select
on public.catalogo_tpv_opciones
for select to authenticated
using (private.la_tiene_local(empresa_id,local_id));

create policy abc_linea_opciones_select
on public.pedido_linea_opciones
for select to authenticated
using (private.la_tiene_local(empresa_id,local_id));

revoke all on table
  public.catalogo_tpv_grupos_opciones,
  public.catalogo_tpv_producto_grupos,
  public.catalogo_tpv_opciones,
  public.pedido_linea_opciones
from public,anon,authenticated,service_role;

grant select on table
  public.catalogo_tpv_grupos_opciones,
  public.catalogo_tpv_producto_grupos,
  public.catalogo_tpv_opciones,
  public.pedido_linea_opciones
to authenticated;

create function private.abc_normalizar_selecciones_tpv(
  p_selecciones jsonb
)
returns jsonb
language plpgsql
immutable
security definer
set search_path=''
as $$
declare
  v_input jsonb:=coalesce(p_selecciones,'[]'::jsonb);
  v_item jsonb;
  v_out jsonb:='[]'::jsonb;
  v_grupo uuid;
  v_opcion uuid;
  v_cantidad integer;
  v_gv bigint;
  v_pgv bigint;
  v_ov bigint;
  v_key text;
  v_seen text[]:=array[]::text[];
begin
  if jsonb_typeof(v_input)<>'array' then
    raise exception 'selecciones_formato_invalido';
  end if;

  for v_item in select value from jsonb_array_elements(v_input)
  loop
    if jsonb_typeof(v_item)<>'object' then
      raise exception 'seleccion_formato_invalido';
    end if;

    if exists(
      select 1
        from jsonb_object_keys(v_item) k
       where k not in (
         'grupo_id','opcion_id','cantidad',
         'expected_group_version','expected_product_group_version','expected_option_version'
       )
    ) then
      raise exception 'seleccion_campos_no_permitidos';
    end if;

    if nullif(v_item->>'grupo_id','') is null
       or nullif(v_item->>'opcion_id','') is null
       or nullif(v_item->>'expected_group_version','') is null
       or nullif(v_item->>'expected_product_group_version','') is null
       or nullif(v_item->>'expected_option_version','') is null then
      raise exception 'seleccion_campos_requeridos';
    end if;

    begin
      v_grupo:=(v_item->>'grupo_id')::uuid;
      v_opcion:=(v_item->>'opcion_id')::uuid;
      v_cantidad:=coalesce((v_item->>'cantidad')::integer,1);
      v_gv:=(v_item->>'expected_group_version')::bigint;
      v_pgv:=(v_item->>'expected_product_group_version')::bigint;
      v_ov:=(v_item->>'expected_option_version')::bigint;
    exception when others then
      raise exception 'seleccion_tipos_invalidos';
    end;

    if v_cantidad<1 or v_gv<1 or v_pgv<1 or v_ov<1 then
      raise exception 'seleccion_valores_invalidos';
    end if;

    v_key:=v_grupo::text||':'||v_opcion::text;
    if v_key=any(v_seen) then
      raise exception 'seleccion_duplicada';
    end if;
    v_seen:=array_append(v_seen,v_key);

    v_out:=v_out||jsonb_build_array(jsonb_build_object(
      'grupo_id',v_grupo,
      'opcion_id',v_opcion,
      'cantidad',v_cantidad,
      'expected_group_version',v_gv,
      'expected_product_group_version',v_pgv,
      'expected_option_version',v_ov
    ));
  end loop;

  select coalesce(jsonb_agg(x order by x->>'grupo_id',x->>'opcion_id'),'[]'::jsonb)
    into v_out
    from jsonb_array_elements(v_out) x;

  return v_out;
end $$;

create function private.abc_calcular_linea_tpv_configurada(
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

  v_base_product_base:=round(v_cantidad*v_catalog.precio_unitario,8);
  v_base_product_tax:=round(v_base_product_base*v_catalog.impuesto_pct/100,8);
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
      'opciones',v_options
    )
  );
end $$;

create function private.abc_persistir_opciones_linea(
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
  p_calc jsonb,
  p_actor uuid,
  p_operating_day date
)
returns void
language plpgsql
volatile
security definer
set search_path=''
as $$
declare v jsonb;
begin
  delete from public.pedido_linea_opciones
   where empresa_id=p_empresa_id and local_id=p_local_id and linea_id=p_linea_id;

  for v in select value from jsonb_array_elements(coalesce(p_calc->'opciones','[]'::jsonb))
  loop
    insert into public.pedido_linea_opciones(
      empresa_id,local_id,linea_id,grupo_id,opcion_id,
      tipo_grupo,tipo_opcion,nombre_grupo,nombre_opcion,cantidad,
      delta_precio_unitario,impuesto_pct,base,impuestos,total,
      catalog_group_version,catalog_product_group_version,catalog_option_version,
      snapshot,created_by,created_operating_day
    ) values (
      p_empresa_id,p_local_id,p_linea_id,
      (v->>'grupo_id')::uuid,(v->>'opcion_id')::uuid,
      v->>'tipo_grupo',v->>'tipo_opcion',v->>'grupo_nombre',v->>'opcion_nombre',
      (v->>'cantidad')::smallint,
      (v->>'delta_precio_unitario')::numeric,(v->>'impuesto_pct')::numeric,
      (v->>'base')::numeric,(v->>'impuestos')::numeric,(v->>'total')::numeric,
      (v->>'catalog_group_version')::bigint,
      (v->>'catalog_product_group_version')::bigint,
      (v->>'catalog_option_version')::bigint,
      coalesce(v->'snapshot','{}'::jsonb),p_actor,p_operating_day
    );
  end loop;
end $$;

create function private.abc_guard_linea_configurada()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if exists(
    select 1
      from public.catalogo_tpv_producto_grupos pg
      join public.catalogo_tpv_grupos_opciones g
        on g.empresa_id=pg.empresa_id
       and g.local_id=pg.local_id
       and g.id=pg.grupo_id
     where pg.empresa_id=new.empresa_id
       and pg.local_id=new.local_id
       and pg.producto_id=new.producto_id
       and pg.currency_code=new.currency_code
       and pg.activo=true
       and g.activo=true
       and pg.min_selecciones>0
  ) and coalesce(new.snapshot_calculo->>'modo','')<>'SERVER_AUTHORITY_A04' then
    raise exception 'configuracion_requerida';
  end if;

  if tg_op='UPDATE'
     and exists(
       select 1 from public.pedido_linea_opciones o
        where o.empresa_id=old.empresa_id
          and o.local_id=old.local_id
          and o.linea_id=old.id
     )
     and coalesce(new.snapshot_calculo->>'modo','')<>'SERVER_AUTHORITY_A04' then
    raise exception 'linea_configurada_requiere_rpc_configurada';
  end if;

  return new;
end $$;

create trigger abc_guard_linea_configurada
before insert or update on public.pedido_lineas
for each row execute function private.abc_guard_linea_configurada();

create function private.abc_mutar_linea_configurada(
  p_accion text,
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
  p_pedido_id uuid,
  p_producto_id text,
  p_cantidad numeric,
  p_expected_product_version bigint,
  p_selecciones jsonb,
  p_expected_linea_version bigint,
  p_expected_pedido_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_accion text:=upper(btrim(coalesce(p_accion,'')));
  v_pedido public.pedidos_tpv%rowtype;
  v_linea public.pedido_lineas%rowtype;
  v_calc jsonb;
  v_norm jsonb;
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
  v_real_pedido_id uuid;
  v_real_producto_id text;
  v_new_pedido_version bigint;
  v_new_linea_version bigint;
  v_new_estado text;
  v_operation_type text;
  v_event_type text;
begin
  if v_accion not in ('AGREGAR','ACTUALIZAR','CONFIRMAR') then
    raise exception 'accion_linea_configurada_invalida';
  end if;
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'abc_linea_no_autorizada';
  end if;
  if p_linea_id is null or p_expected_product_version is null
     or p_expected_pedido_version is null or p_terminal_id is null
     or p_session_id is null or p_operating_day is null then
    raise exception 'linea_configurada_parametros_requeridos';
  end if;
  if v_accion='AGREGAR' and (p_pedido_id is null or nullif(btrim(coalesce(p_producto_id,'')),'') is null) then
    raise exception 'linea_configurada_alta_parametros_requeridos';
  end if;
  if v_accion<>'AGREGAR' and p_expected_linea_version is null then
    raise exception 'linea_configurada_version_requerida';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  v_norm:=private.abc_normalizar_selecciones_tpv(p_selecciones);
  v_operation_type:=case v_accion
    when 'AGREGAR' then 'ABC_AGREGAR_LINEA_CONFIGURADA'
    when 'ACTUALIZAR' then 'ABC_ACTUALIZAR_LINEA_CONFIGURADA'
    else 'ABC_CONFIRMAR_LINEA_CONFIGURADA'
  end;
  v_event_type:=case v_accion
    when 'AGREGAR' then 'PEDIDO_LINEA_CONFIGURADA_AGREGADA'
    when 'ACTUALIZAR' then 'PEDIDO_LINEA_CONFIGURADA_ACTUALIZADA'
    else 'PEDIDO_LINEA_CONFIGURADA_CONFIRMADA'
  end;

  v_request:=jsonb_build_object(
    'accion',v_accion,'linea_id',p_linea_id,'pedido_id',p_pedido_id,
    'producto_id',nullif(btrim(coalesce(p_producto_id,'')),''),
    'cantidad',p_cantidad,'expected_product_version',p_expected_product_version,
    'selecciones',v_norm,'expected_linea_version',p_expected_linea_version,
    'expected_pedido_version',p_expected_pedido_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,v_operation_type,v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  if v_accion='AGREGAR' then
    v_real_pedido_id:=p_pedido_id;
    v_real_producto_id:=btrim(p_producto_id);

    select *
      into v_pedido
      from public.pedidos_tpv
     where empresa_id=p_empresa_id
       and local_id=p_local_id
       and id=v_real_pedido_id
       and estado in ('BORRADOR','ABIERTO')
     for update;
    if not found then raise exception 'pedido_no_editable'; end if;
    if v_pedido.version<>p_expected_pedido_version then raise exception 'pedido_version_conflict'; end if;
    if v_pedido.created_operating_day<>p_operating_day then raise exception 'operating_day_pedido_inconsistente'; end if;
  else
    select pedido_id
      into v_real_pedido_id
      from public.pedido_lineas
     where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id;
    if not found then raise exception 'linea_no_encontrada'; end if;

    select *
      into v_pedido
      from public.pedidos_tpv
     where empresa_id=p_empresa_id
       and local_id=p_local_id
       and id=v_real_pedido_id
       and estado in ('BORRADOR','ABIERTO')
     for update;
    if not found then raise exception 'pedido_no_editable'; end if;
    if v_pedido.version<>p_expected_pedido_version then raise exception 'pedido_version_conflict'; end if;
    if v_pedido.created_operating_day<>p_operating_day then raise exception 'operating_day_pedido_inconsistente'; end if;

    select *
      into v_linea
      from public.pedido_lineas
     where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id
     for update;
    if not found then raise exception 'linea_no_encontrada'; end if;
    if v_linea.estado<>'BORRADOR' then raise exception 'linea_no_editable'; end if;
    if v_linea.version<>p_expected_linea_version then raise exception 'linea_version_conflict'; end if;
    v_real_producto_id:=v_linea.producto_id;
  end if;

  v_calc:=private.abc_calcular_linea_tpv_configurada(
    p_empresa_id,p_local_id,v_real_producto_id,v_pedido.currency_code,
    p_cantidad,p_expected_product_version,v_norm
  );

  if v_accion='AGREGAR' then
    insert into public.pedido_lineas(
      id,empresa_id,local_id,pedido_id,producto_id,cantidad,unidad,estado,version,
      entidad_fiscal_id,currency_code,precio_unitario,descuento_total,base,impuestos,total,
      snapshot_comercial,snapshot_calculo,created_by,created_operating_day
    ) values (
      p_linea_id,p_empresa_id,p_local_id,v_real_pedido_id,v_calc->>'producto_id',
      (v_calc->>'cantidad')::numeric,v_calc->>'unidad','BORRADOR',1,
      (v_calc->>'entidad_fiscal_id')::uuid,v_calc->>'currency_code',
      (v_calc->>'precio_unitario')::numeric,0,
      (v_calc->>'base')::numeric,(v_calc->>'impuestos')::numeric,(v_calc->>'total')::numeric,
      v_calc->'snapshot_comercial',v_calc->'snapshot_calculo',auth.uid(),p_operating_day
    );
    v_new_linea_version:=1;
  else
    v_new_estado:=case when v_accion='CONFIRMAR' then 'CONFIRMADA' else 'BORRADOR' end;
    update public.pedido_lineas
       set cantidad=(v_calc->>'cantidad')::numeric,
           unidad=v_calc->>'unidad',
           estado=v_new_estado,
           entidad_fiscal_id=(v_calc->>'entidad_fiscal_id')::uuid,
           precio_unitario=(v_calc->>'precio_unitario')::numeric,
           descuento_total=0,
           base=(v_calc->>'base')::numeric,
           impuestos=(v_calc->>'impuestos')::numeric,
           total=(v_calc->>'total')::numeric,
           snapshot_comercial=v_calc->'snapshot_comercial',
           snapshot_calculo=v_calc->'snapshot_calculo',
           version=version+1
     where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id
    returning version into v_new_linea_version;
  end if;

  perform private.abc_persistir_opciones_linea(
    p_empresa_id,p_local_id,p_linea_id,v_calc,auth.uid(),p_operating_day
  );

  update public.pedidos_tpv
     set estado='ABIERTO',
         version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_real_pedido_id
  returning version into v_new_pedido_version;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'PEDIDO_LINEA',p_linea_id::text,v_event_type,
    jsonb_build_object(
      'pedido_id',v_real_pedido_id,
      'producto_id',v_calc->>'producto_id',
      'cantidad',(v_calc->>'cantidad')::numeric,
      'precio_unitario',(v_calc->>'precio_unitario')::numeric,
      'base',(v_calc->>'base')::numeric,
      'impuestos',(v_calc->>'impuestos')::numeric,
      'total',(v_calc->>'total')::numeric,
      'opciones',v_calc->'opciones',
      'catalog_version',(v_calc->>'catalog_version')::bigint,
      'linea_version',v_new_linea_version,
      'pedido_version',v_new_pedido_version,
      'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,
    'linea_id',p_linea_id,
    'linea_version',v_new_linea_version,
    'pedido_id',v_real_pedido_id,
    'pedido_version',v_new_pedido_version,
    'estado',case when v_accion='CONFIRMAR' then 'CONFIRMADA' else 'BORRADOR' end,
    'producto_id',v_calc->>'producto_id',
    'cantidad',(v_calc->>'cantidad')::numeric,
    'precio_unitario',(v_calc->>'precio_unitario')::numeric,
    'descuento_total',0,
    'base',(v_calc->>'base')::numeric,
    'impuestos',(v_calc->>'impuestos')::numeric,
    'total',(v_calc->>'total')::numeric,
    'opciones',v_calc->'opciones'
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_agregar_linea_pedido_configurada(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
  p_pedido_id uuid,
  p_producto_id text,
  p_cantidad numeric,
  p_expected_product_version bigint,
  p_selecciones jsonb,
  p_expected_pedido_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language sql
volatile
security definer
set search_path=''
as $$
  select private.abc_mutar_linea_configurada(
    'AGREGAR',$1,$2,$3,$4,$5,$6,$7,$8,$9,null,$10,$11,$12,$13
  )
$$;

create function public.abc_actualizar_linea_pedido_configurada(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
  p_cantidad numeric,
  p_expected_product_version bigint,
  p_selecciones jsonb,
  p_expected_linea_version bigint,
  p_expected_pedido_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language sql
volatile
security definer
set search_path=''
as $$
  select private.abc_mutar_linea_configurada(
    'ACTUALIZAR',$1,$2,$3,$4,null,null,$5,$6,$7,$8,$9,$10,$11,$12
  )
$$;

create function public.abc_confirmar_linea_pedido_configurada(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
  p_expected_product_version bigint,
  p_selecciones jsonb,
  p_expected_linea_version bigint,
  p_expected_pedido_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language sql
volatile
security definer
set search_path=''
as $$
  select private.abc_mutar_linea_configurada(
    'CONFIRMAR',$1,$2,$3,$4,null,null,
    (select cantidad from public.pedido_lineas where id=$4 and empresa_id=$2 and local_id=$3),
    $5,$6,$7,$8,$9,$10,$11
  )
$$;

revoke all on function private.abc_normalizar_selecciones_tpv(jsonb)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_calcular_linea_tpv_configurada(text,text,text,text,numeric,bigint,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_persistir_opciones_linea(text,text,uuid,jsonb,uuid,date)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_guard_linea_configurada()
  from public,anon,authenticated,service_role;
revoke all on function private.abc_mutar_linea_configurada(
  text,text,text,text,uuid,uuid,text,numeric,bigint,jsonb,bigint,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;

revoke all on function public.abc_agregar_linea_pedido_configurada(
  text,text,text,uuid,uuid,text,numeric,bigint,jsonb,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_actualizar_linea_pedido_configurada(
  text,text,text,uuid,numeric,bigint,jsonb,bigint,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_confirmar_linea_pedido_configurada(
  text,text,text,uuid,bigint,jsonb,bigint,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;

grant execute on function public.abc_agregar_linea_pedido_configurada(
  text,text,text,uuid,uuid,text,numeric,bigint,jsonb,bigint,uuid,uuid,date
) to authenticated;
grant execute on function public.abc_actualizar_linea_pedido_configurada(
  text,text,text,uuid,numeric,bigint,jsonb,bigint,bigint,uuid,uuid,date
) to authenticated;
grant execute on function public.abc_confirmar_linea_pedido_configurada(
  text,text,text,uuid,bigint,jsonb,bigint,bigint,uuid,uuid,date
) to authenticated;
