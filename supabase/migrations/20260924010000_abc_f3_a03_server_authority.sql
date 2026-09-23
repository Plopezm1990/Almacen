-- ABC F3 A03 — autoridad servidor de cuenta/pedido/línea y catálogo TPV.
-- Aditiva. No activa frontend, no mueve stock, no cobra y no crea datos reales.
-- Depende de F2 M01–M04D.

do $$
declare v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.cuentas_comerciales') is null then v_missing:=array_append(v_missing,'cuentas_comerciales'); end if;
  if to_regclass('public.pedidos_tpv') is null then v_missing:=array_append(v_missing,'pedidos_tpv'); end if;
  if to_regclass('public.pedido_lineas') is null then v_missing:=array_append(v_missing,'pedido_lineas'); end if;
  if to_regclass('public.entidad_fiscal_local_monedas') is null then v_missing:=array_append(v_missing,'entidad_fiscal_local_monedas'); end if;
  if to_regclass('public.terminales_tpv') is null then v_missing:=array_append(v_missing,'terminales_tpv'); end if;
  if to_regclass('public.caja_sesiones') is null then v_missing:=array_append(v_missing,'caja_sesiones'); end if;
  if to_regclass('public.caja_sesion_terminales') is null then v_missing:=array_append(v_missing,'caja_sesion_terminales'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_usuario_activo_local(text,text,uuid)') is null then v_missing:=array_append(v_missing,'abc_usuario_activo_local'); end if;

  if cardinality(v_missing)>0 then
    raise exception 'ABC_F3_A03_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if to_regclass('public.catalogo_tpv_productos') is not null
     or to_regprocedure('private.abc_terminal_sesion_operativa(text,text,uuid,uuid)') is not null
     or to_regprocedure('private.abc_calcular_linea_tpv(text,text,text,text,numeric)') is not null
     or to_regprocedure('public.abc_abrir_cuenta(text,text,text,uuid,text,text,uuid,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_crear_pedido(text,text,text,uuid,uuid,bigint,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_agregar_linea_pedido(text,text,text,uuid,uuid,text,numeric,bigint,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_actualizar_linea_pedido(text,text,text,uuid,numeric,bigint,bigint,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_confirmar_linea_pedido(text,text,text,uuid,bigint,bigint,uuid,uuid,date)') is not null then
    raise exception 'ABC_F3_A03_PREFLIGHT_FALLO: objetos A03 ya existen';
  end if;
end $$;

create table public.catalogo_tpv_productos (
  empresa_id text not null,
  local_id text not null,
  producto_id text not null,
  currency_code text not null,
  entidad_fiscal_id uuid not null,
  nombre text not null,
  unidad text not null,
  fraccionable boolean not null default false,
  precision_cantidad smallint not null default 0,
  precio_unitario numeric(24,8) not null,
  impuesto_pct numeric(9,4) not null,
  activo boolean not null default true,
  version bigint not null default 1,
  snapshot_origen jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (empresa_id,local_id,producto_id,currency_code),
  constraint abc_catalogo_producto_id check (nullif(btrim(producto_id),'') is not null),
  constraint abc_catalogo_nombre check (nullif(btrim(nombre),'') is not null),
  constraint abc_catalogo_unidad check (nullif(btrim(unidad),'') is not null),
  constraint abc_catalogo_moneda check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_catalogo_precision check (precision_cantidad between 0 and 8),
  constraint abc_catalogo_fraccionable_precision check (fraccionable or precision_cantidad=0),
  constraint abc_catalogo_precio check (precio_unitario>=0),
  constraint abc_catalogo_impuesto check (impuesto_pct>=0 and impuesto_pct<=100),
  constraint abc_catalogo_version check (version>=1),
  constraint abc_catalogo_local_fk
    foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint abc_catalogo_emisor_moneda_fk
    foreign key (empresa_id,local_id,entidad_fiscal_id,currency_code)
    references public.entidad_fiscal_local_monedas(
      empresa_id,local_id,entidad_fiscal_id,currency_code
    ) on delete restrict
);

create index abc_catalogo_scope_activo_idx
  on public.catalogo_tpv_productos(empresa_id,local_id,currency_code,activo,producto_id);

alter table public.catalogo_tpv_productos enable row level security;

create policy abc_catalogo_tpv_select
on public.catalogo_tpv_productos
for select
to authenticated
using (private.la_tiene_local(empresa_id,local_id));

revoke all on table public.catalogo_tpv_productos
from public,anon,authenticated,service_role;
grant select on table public.catalogo_tpv_productos to authenticated;

create function private.abc_terminal_sesion_operativa(
  p_empresa_id text,
  p_local_id text,
  p_terminal_id uuid,
  p_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select p_terminal_id is not null
     and p_session_id is not null
     and exists(
       select 1
         from public.locales l
         join public.terminales_tpv t
           on t.empresa_id=l.empresa_id
          and t.local_id=l.id
         join public.caja_sesion_terminales st
           on st.empresa_id=t.empresa_id
          and st.local_id=t.local_id
          and st.terminal_id=t.id
          and st.hasta is null
         join public.caja_sesiones s
           on s.empresa_id=st.empresa_id
          and s.local_id=st.local_id
          and s.id=st.session_id
        where l.empresa_id=p_empresa_id
          and l.id=p_local_id
          and l.activo=true
          and t.id=p_terminal_id
          and t.activo=true
          and s.id=p_session_id
          and s.estado='ABIERTA'
     )
$$;

create function private.abc_calcular_linea_tpv(
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
  v_bruto:=round(v_cantidad*v_catalog.precio_unitario,8);
  v_base:=(v_bruto-v_descuento)::numeric(24,8);
  v_impuestos:=round(v_base*v_catalog.impuesto_pct/100,8);
  v_total:=round(v_base+v_impuestos,8);

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
      'catalog_snapshot',v_catalog.snapshot_origen
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
      'round_scale',8
    )
  );
end $$;

create function public.abc_abrir_cuenta(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid,
  p_modalidad text,
  p_currency_code text,
  p_responsable_actual uuid,
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
  v_modalidad text:=upper(btrim(coalesce(p_modalidad,'')));
  v_currency text:=upper(btrim(coalesce(p_currency_code,'')));
  v_responsable uuid:=coalesce(p_responsable_actual,auth.uid());
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'abc_cuenta_no_autorizada';
  end if;
  if p_cuenta_id is null or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'cuenta_parametros_requeridos';
  end if;
  if v_modalidad not in ('BARRA','MESA','TERRAZA','TAKEAWAY','OTRO') then
    raise exception 'modalidad_cuenta_invalida';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'moneda_cuenta_invalida'; end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;
  if not private.abc_usuario_activo_local(p_empresa_id,p_local_id,v_responsable) then
    raise exception 'responsable_cuenta_no_pertenece_local';
  end if;
  if not exists(
    select 1
      from public.entidad_fiscal_local_monedas elm
      join public.entidades_fiscales ef
        on ef.empresa_id=elm.empresa_id
       and ef.id=elm.entidad_fiscal_id
     where elm.empresa_id=p_empresa_id
       and elm.local_id=p_local_id
       and elm.currency_code=v_currency
       and elm.activa=true
       and ef.activa=true
  ) then
    raise exception 'moneda_cuenta_no_habilitada';
  end if;

  v_request:=jsonb_build_object(
    'cuenta_id',p_cuenta_id,
    'modalidad',v_modalidad,
    'currency_code',v_currency,
    'responsable_actual',v_responsable,
    'terminal_id',p_terminal_id,
    'session_id',p_session_id,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_ABRIR_CUENTA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  insert into public.cuentas_comerciales(
    id,empresa_id,local_id,currency_code,modalidad,estado,version,
    responsable_actual,created_by,opened_operating_day
  ) values (
    p_cuenta_id,p_empresa_id,p_local_id,v_currency,v_modalidad,'ABIERTA',1,
    v_responsable,auth.uid(),p_operating_day
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CUENTA',p_cuenta_id::text,'CUENTA_ABIERTA',
    jsonb_build_object(
      'modalidad',v_modalidad,'currency_code',v_currency,
      'responsable_actual',v_responsable,'session_id',p_session_id,'version',1
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'cuenta_id',p_cuenta_id,'estado','ABIERTA','version',1,
    'currency_code',v_currency,'modalidad',v_modalidad,'responsable_actual',v_responsable
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_crear_pedido(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_pedido_id uuid,
  p_cuenta_id uuid,
  p_expected_cuenta_version bigint,
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
  v_cuenta public.cuentas_comerciales%rowtype;
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
  v_new_cuenta_version bigint;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'abc_pedido_no_autorizado';
  end if;
  if p_pedido_id is null or p_cuenta_id is null or p_expected_cuenta_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'pedido_parametros_requeridos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  v_request:=jsonb_build_object(
    'pedido_id',p_pedido_id,'cuenta_id',p_cuenta_id,
    'expected_cuenta_version',p_expected_cuenta_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CREAR_PEDIDO',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select *
    into v_cuenta
    from public.cuentas_comerciales
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_cuenta_id
     and estado='ABIERTA'
   for update;
  if not found then raise exception 'cuenta_no_abierta_o_no_encontrada'; end if;
  if v_cuenta.version<>p_expected_cuenta_version then raise exception 'cuenta_version_conflict'; end if;
  if v_cuenta.opened_operating_day<>p_operating_day then raise exception 'operating_day_cuenta_inconsistente'; end if;

  insert into public.pedidos_tpv(
    id,empresa_id,local_id,cuenta_id,currency_code,estado,version,
    created_by,created_operating_day
  ) values (
    p_pedido_id,p_empresa_id,p_local_id,p_cuenta_id,v_cuenta.currency_code,
    'BORRADOR',1,auth.uid(),p_operating_day
  );

  update public.cuentas_comerciales
     set version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_id
  returning version into v_new_cuenta_version;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'PEDIDO',p_pedido_id::text,'PEDIDO_CREADO',
    jsonb_build_object(
      'cuenta_id',p_cuenta_id,'pedido_version',1,
      'cuenta_version',v_new_cuenta_version,'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'pedido_id',p_pedido_id,'estado','BORRADOR','version',1,
    'cuenta_id',p_cuenta_id,'cuenta_version',v_new_cuenta_version,
    'currency_code',v_cuenta.currency_code
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_agregar_linea_pedido(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
  p_pedido_id uuid,
  p_producto_id text,
  p_cantidad numeric,
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
  v_pedido public.pedidos_tpv%rowtype;
  v_calc jsonb;
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
  v_new_pedido_version bigint;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'abc_linea_no_autorizada';
  end if;
  if p_linea_id is null or p_pedido_id is null or p_expected_pedido_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'linea_parametros_requeridos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  v_request:=jsonb_build_object(
    'linea_id',p_linea_id,'pedido_id',p_pedido_id,'producto_id',btrim(coalesce(p_producto_id,'')),
    'cantidad',p_cantidad,'expected_pedido_version',p_expected_pedido_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_AGREGAR_LINEA_PEDIDO',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select *
    into v_pedido
    from public.pedidos_tpv
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_pedido_id
     and estado in ('BORRADOR','ABIERTO')
   for update;
  if not found then raise exception 'pedido_no_editable'; end if;
  if v_pedido.version<>p_expected_pedido_version then raise exception 'pedido_version_conflict'; end if;
  if v_pedido.created_operating_day<>p_operating_day then raise exception 'operating_day_pedido_inconsistente'; end if;

  v_calc:=private.abc_calcular_linea_tpv(
    p_empresa_id,p_local_id,p_producto_id,v_pedido.currency_code,p_cantidad
  );

  insert into public.pedido_lineas(
    id,empresa_id,local_id,pedido_id,producto_id,cantidad,unidad,estado,version,
    entidad_fiscal_id,currency_code,precio_unitario,descuento_total,base,impuestos,total,
    snapshot_comercial,snapshot_calculo,created_by,created_operating_day
  ) values (
    p_linea_id,p_empresa_id,p_local_id,p_pedido_id,v_calc->>'producto_id',
    (v_calc->>'cantidad')::numeric,v_calc->>'unidad','BORRADOR',1,
    (v_calc->>'entidad_fiscal_id')::uuid,v_calc->>'currency_code',
    (v_calc->>'precio_unitario')::numeric,(v_calc->>'descuento_total')::numeric,
    (v_calc->>'base')::numeric,(v_calc->>'impuestos')::numeric,(v_calc->>'total')::numeric,
    v_calc->'snapshot_comercial',v_calc->'snapshot_calculo',auth.uid(),p_operating_day
  );

  update public.pedidos_tpv
     set estado=case when estado='BORRADOR' then 'ABIERTO' else estado end,
         version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_pedido_id
  returning version into v_new_pedido_version;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'PEDIDO_LINEA',p_linea_id::text,'PEDIDO_LINEA_AGREGADA',
    jsonb_build_object(
      'pedido_id',p_pedido_id,'producto_id',v_calc->>'producto_id',
      'cantidad',(v_calc->>'cantidad')::numeric,'total',(v_calc->>'total')::numeric,
      'linea_version',1,'pedido_version',v_new_pedido_version,
      'catalog_version',(v_calc->>'catalog_version')::bigint,'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'linea_id',p_linea_id,'linea_version',1,
    'pedido_id',p_pedido_id,'pedido_version',v_new_pedido_version,
    'estado','BORRADOR','producto_id',v_calc->>'producto_id',
    'cantidad',(v_calc->>'cantidad')::numeric,'unidad',v_calc->>'unidad',
    'precio_unitario',(v_calc->>'precio_unitario')::numeric,
    'descuento_total',(v_calc->>'descuento_total')::numeric,
    'base',(v_calc->>'base')::numeric,'impuestos',(v_calc->>'impuestos')::numeric,
    'total',(v_calc->>'total')::numeric,'currency_code',v_calc->>'currency_code',
    'entidad_fiscal_id',v_calc->>'entidad_fiscal_id'
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_actualizar_linea_pedido(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
  p_cantidad numeric,
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
  v_pedido_id uuid;
  v_pedido public.pedidos_tpv%rowtype;
  v_linea public.pedido_lineas%rowtype;
  v_calc jsonb;
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
  v_new_pedido_version bigint;
  v_new_linea_version bigint;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'abc_linea_no_autorizada';
  end if;
  if p_linea_id is null or p_expected_linea_version is null or p_expected_pedido_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'linea_parametros_requeridos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  v_request:=jsonb_build_object(
    'linea_id',p_linea_id,'cantidad',p_cantidad,
    'expected_linea_version',p_expected_linea_version,
    'expected_pedido_version',p_expected_pedido_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_ACTUALIZAR_LINEA_PEDIDO',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select pedido_id into v_pedido_id
    from public.pedido_lineas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id;
  if not found then raise exception 'linea_no_encontrada'; end if;

  select *
    into v_pedido
    from public.pedidos_tpv
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_pedido_id
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

  v_calc:=private.abc_calcular_linea_tpv(
    p_empresa_id,p_local_id,v_linea.producto_id,v_pedido.currency_code,p_cantidad
  );

  update public.pedido_lineas
     set cantidad=(v_calc->>'cantidad')::numeric,
         unidad=v_calc->>'unidad',
         entidad_fiscal_id=(v_calc->>'entidad_fiscal_id')::uuid,
         precio_unitario=(v_calc->>'precio_unitario')::numeric,
         descuento_total=(v_calc->>'descuento_total')::numeric,
         base=(v_calc->>'base')::numeric,
         impuestos=(v_calc->>'impuestos')::numeric,
         total=(v_calc->>'total')::numeric,
         snapshot_comercial=v_calc->'snapshot_comercial',
         snapshot_calculo=v_calc->'snapshot_calculo',
         version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id
  returning version into v_new_linea_version;

  update public.pedidos_tpv
     set version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_pedido_id
  returning version into v_new_pedido_version;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'PEDIDO_LINEA',p_linea_id::text,'PEDIDO_LINEA_ACTUALIZADA',
    jsonb_build_object(
      'pedido_id',v_pedido_id,'cantidad',(v_calc->>'cantidad')::numeric,
      'total',(v_calc->>'total')::numeric,'linea_version',v_new_linea_version,
      'pedido_version',v_new_pedido_version,
      'catalog_version',(v_calc->>'catalog_version')::bigint,'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'linea_id',p_linea_id,'linea_version',v_new_linea_version,
    'pedido_id',v_pedido_id,'pedido_version',v_new_pedido_version,
    'estado','BORRADOR','cantidad',(v_calc->>'cantidad')::numeric,
    'precio_unitario',(v_calc->>'precio_unitario')::numeric,
    'descuento_total',(v_calc->>'descuento_total')::numeric,
    'base',(v_calc->>'base')::numeric,'impuestos',(v_calc->>'impuestos')::numeric,
    'total',(v_calc->>'total')::numeric
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_confirmar_linea_pedido(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
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
  v_pedido_id uuid;
  v_pedido public.pedidos_tpv%rowtype;
  v_linea public.pedido_lineas%rowtype;
  v_calc jsonb;
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
  v_new_pedido_version bigint;
  v_new_linea_version bigint;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'abc_linea_no_autorizada';
  end if;
  if p_linea_id is null or p_expected_linea_version is null or p_expected_pedido_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'linea_parametros_requeridos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  v_request:=jsonb_build_object(
    'linea_id',p_linea_id,'expected_linea_version',p_expected_linea_version,
    'expected_pedido_version',p_expected_pedido_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIRMAR_LINEA_PEDIDO',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select pedido_id into v_pedido_id
    from public.pedido_lineas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id;
  if not found then raise exception 'linea_no_encontrada'; end if;

  select *
    into v_pedido
    from public.pedidos_tpv
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_pedido_id
     and estado in ('BORRADOR','ABIERTO')
   for update;
  if not found then raise exception 'pedido_no_confirmable'; end if;
  if v_pedido.version<>p_expected_pedido_version then raise exception 'pedido_version_conflict'; end if;
  if v_pedido.created_operating_day<>p_operating_day then raise exception 'operating_day_pedido_inconsistente'; end if;

  select *
    into v_linea
    from public.pedido_lineas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id
   for update;
  if not found then raise exception 'linea_no_encontrada'; end if;
  if v_linea.estado<>'BORRADOR' then raise exception 'linea_no_confirmable'; end if;
  if v_linea.version<>p_expected_linea_version then raise exception 'linea_version_conflict'; end if;

  v_calc:=private.abc_calcular_linea_tpv(
    p_empresa_id,p_local_id,v_linea.producto_id,v_pedido.currency_code,v_linea.cantidad
  );

  update public.pedido_lineas
     set cantidad=(v_calc->>'cantidad')::numeric,
         unidad=v_calc->>'unidad',
         estado='CONFIRMADA',
         entidad_fiscal_id=(v_calc->>'entidad_fiscal_id')::uuid,
         precio_unitario=(v_calc->>'precio_unitario')::numeric,
         descuento_total=(v_calc->>'descuento_total')::numeric,
         base=(v_calc->>'base')::numeric,
         impuestos=(v_calc->>'impuestos')::numeric,
         total=(v_calc->>'total')::numeric,
         snapshot_comercial=v_calc->'snapshot_comercial',
         snapshot_calculo=v_calc->'snapshot_calculo',
         version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id
  returning version into v_new_linea_version;

  update public.pedidos_tpv
     set estado='ABIERTO',
         version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_pedido_id
  returning version into v_new_pedido_version;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'PEDIDO_LINEA',p_linea_id::text,'PEDIDO_LINEA_CONFIRMADA',
    jsonb_build_object(
      'pedido_id',v_pedido_id,'cantidad',(v_calc->>'cantidad')::numeric,
      'precio_unitario',(v_calc->>'precio_unitario')::numeric,
      'descuento_total',(v_calc->>'descuento_total')::numeric,
      'base',(v_calc->>'base')::numeric,'impuestos',(v_calc->>'impuestos')::numeric,
      'total',(v_calc->>'total')::numeric,'linea_version',v_new_linea_version,
      'pedido_version',v_new_pedido_version,
      'catalog_version',(v_calc->>'catalog_version')::bigint,'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'linea_id',p_linea_id,'linea_version',v_new_linea_version,
    'pedido_id',v_pedido_id,'pedido_version',v_new_pedido_version,
    'estado','CONFIRMADA','cantidad',(v_calc->>'cantidad')::numeric,
    'precio_unitario',(v_calc->>'precio_unitario')::numeric,
    'descuento_total',(v_calc->>'descuento_total')::numeric,
    'base',(v_calc->>'base')::numeric,'impuestos',(v_calc->>'impuestos')::numeric,
    'total',(v_calc->>'total')::numeric
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

revoke all on function private.abc_terminal_sesion_operativa(text,text,uuid,uuid)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_calcular_linea_tpv(text,text,text,text,numeric)
  from public,anon,authenticated,service_role;

revoke all on function public.abc_abrir_cuenta(
  text,text,text,uuid,text,text,uuid,uuid,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_crear_pedido(
  text,text,text,uuid,uuid,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_agregar_linea_pedido(
  text,text,text,uuid,uuid,text,numeric,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_actualizar_linea_pedido(
  text,text,text,uuid,numeric,bigint,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_confirmar_linea_pedido(
  text,text,text,uuid,bigint,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;

grant execute on function public.abc_abrir_cuenta(
  text,text,text,uuid,text,text,uuid,uuid,uuid,date
) to authenticated;
grant execute on function public.abc_crear_pedido(
  text,text,text,uuid,uuid,bigint,uuid,uuid,date
) to authenticated;
grant execute on function public.abc_agregar_linea_pedido(
  text,text,text,uuid,uuid,text,numeric,bigint,uuid,uuid,date
) to authenticated;
grant execute on function public.abc_actualizar_linea_pedido(
  text,text,text,uuid,numeric,bigint,bigint,uuid,uuid,date
) to authenticated;
grant execute on function public.abc_confirmar_linea_pedido(
  text,text,text,uuid,bigint,bigint,uuid,uuid,date
) to authenticated;
