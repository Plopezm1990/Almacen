-- Plan Maestro L&A Suite — Etapa 6, T8 (pieza 3): tarifa de horario ("hora feliz").
--
-- Fecha: 24/10/2026. Autorización: Pedro (chat, 24/10/2026), alcance elegido entre tres
-- opciones: "solo horario (hora feliz)" — sin zonas todavía.
--
-- Aviso honesto: el plan (página 6) decía "zonas y tarifas libres (con horario, como una
-- hora feliz)... la parte de servidor ya va en la Hoja QA-3" — pero no existía NADA de esto
-- en el servidor (ninguna tabla, ninguna función). Esta migración lo construye desde cero.
--
-- Qué hace (aditiva; no crea ninguna tabla de las ya existentes, no cambia ningún dato):
--  1. `catalogo_tpv_tarifas_horario`: una tarifa con nombre, los días de la semana en que
--     se aplica (1=lunes...7=domingo) y un rango de horas (hora_fin > hora_inicio; no cruza
--     medianoche). Dos tarifas activas no pueden solaparse en día+hora.
--  2. `catalogo_tpv_tarifa_precios`: el precio especial de un producto concreto dentro de
--     una tarifa (siempre precio base + el impuesto normal del producto; no admite el modo
--     "precio con impuesto incluido" de D31 — ver límite más abajo).
--  3. `private.abc_tarifa_horario_vigente(empresa,local)`: qué tarifa está activa ahora
--     mismo, según la hora local del local (reutiliza el huso horario ya configurado en
--     `private.abc_operating_day_reglas`, el mismo que usa el día operativo). Si algo falla
--     al calcularlo, devuelve NULL (nunca rompe un cobro por un fallo aquí).
--  4. `abc_guardar_tarifa_horario` / `abc_guardar_tarifa_precio`: crear o editar, mismo
--     permiso que ya gestiona el catálogo (Propietario o Encargado) y mismo patrón
--     idempotente del resto del proyecto.
--  5. `private.abc_calcular_linea_tpv` (la función real que fija el precio de cada línea,
--     create or replace, misma firma): si hay una tarifa de horario vigente y el producto
--     tiene un precio especial activo en ella, se usa ese precio en vez del normal. Si no
--     hay ninguna tarifa vigente o el producto no tiene precio especial, el cálculo es
--     exactamente el de antes.
--
-- Límite deliberado (alcance elegido por Pedro): solo productos sin variantes ni
-- modificadores (la línea «simple» de T3-A03). Las líneas configuradas con opciones
-- (T3-A04, `abc_calcular_linea_tpv_configurada`) no se tocan en esta pieza — siguen
-- cobrando siempre el precio normal, sin hora feliz. Tampoco hay "zonas" todavía: la tarifa
-- se aplica igual en todo el local, no por Barra/Mesa/Terraza.

set local lock_timeout = '10s';

do $$
declare v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.catalogo_tpv_productos') is null then v_missing:=array_append(v_missing,'catalogo_tpv_productos'); end if;
  if to_regclass('public.locales') is null then v_missing:=array_append(v_missing,'locales'); end if;
  if to_regclass('private.abc_operating_day_reglas') is null then v_missing:=array_append(v_missing,'abc_operating_day_reglas'); end if;
  if to_regprocedure('private.abc_catalogo_puede_gestionar(text,text)') is null then v_missing:=array_append(v_missing,'abc_catalogo_puede_gestionar'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_fallar'); end if;
  if to_regprocedure('private.abc_calcular_linea_tpv(text,text,text,text,numeric)') is null then v_missing:=array_append(v_missing,'abc_calcular_linea_tpv'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_T8_P3_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if to_regclass('public.catalogo_tpv_tarifas_horario') is not null
     or to_regclass('public.catalogo_tpv_tarifa_precios') is not null
     or to_regprocedure('private.abc_tarifa_horario_vigente(text,text)') is not null
     or to_regprocedure('public.abc_guardar_tarifa_horario(text,text,text,uuid,text,smallint[],time,time,boolean,text)') is not null
     or to_regprocedure('public.abc_guardar_tarifa_precio(text,text,text,uuid,text,text,numeric,boolean,text)') is not null
     or pg_get_functiondef('private.abc_calcular_linea_tpv(text,text,text,text,numeric)'::regprocedure) like '%abc_tarifa_horario_vigente%' then
    raise exception 'ABC_T8_P3_PREFLIGHT_FALLO: objetos ya existen';
  end if;
end $$;

-- 1. Tarifas de horario.
create table public.catalogo_tpv_tarifas_horario (
  id uuid not null,
  empresa_id text not null,
  local_id text not null,
  nombre text not null,
  dias_semana smallint[] not null,
  hora_inicio time not null,
  hora_fin time not null,
  activo boolean not null default true,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  constraint abc_tarifa_horario_nombre check (nullif(btrim(nombre),'') is not null and char_length(nombre)<=80),
  constraint abc_tarifa_horario_dias check (
    dias_semana is not null and cardinality(dias_semana)>0
    and dias_semana <@ array[1,2,3,4,5,6,7]::smallint[]
  ),
  constraint abc_tarifa_horario_rango check (hora_fin>hora_inicio),
  constraint abc_tarifa_horario_version check (version>=1),
  constraint abc_tarifa_horario_local_fk
    foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint abc_tarifa_horario_scope_id_uq unique (empresa_id,local_id,id)
);

create unique index abc_tarifa_horario_nombre_uq
  on public.catalogo_tpv_tarifas_horario(empresa_id,local_id,lower(btrim(nombre)));

-- 2. Precio especial de un producto dentro de una tarifa.
create table public.catalogo_tpv_tarifa_precios (
  empresa_id text not null,
  local_id text not null,
  tarifa_id uuid not null,
  producto_id text not null,
  currency_code text not null,
  precio_unitario numeric(24,8) not null,
  activo boolean not null default true,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (empresa_id,local_id,tarifa_id,producto_id,currency_code),
  constraint abc_tarifa_precio_moneda check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_tarifa_precio_valor check (precio_unitario>=0),
  constraint abc_tarifa_precio_version check (version>=1),
  constraint abc_tarifa_precio_tarifa_fk
    foreign key (empresa_id,local_id,tarifa_id)
    references public.catalogo_tpv_tarifas_horario(empresa_id,local_id,id)
    on delete restrict,
  constraint abc_tarifa_precio_producto_fk
    foreign key (empresa_id,local_id,producto_id,currency_code)
    references public.catalogo_tpv_productos(empresa_id,local_id,producto_id,currency_code)
    on delete restrict
);

alter table public.catalogo_tpv_tarifas_horario enable row level security;
alter table public.catalogo_tpv_tarifa_precios enable row level security;

create policy abc_tarifas_horario_select
on public.catalogo_tpv_tarifas_horario
for select to authenticated
using (private.la_tiene_local(empresa_id,local_id));

create policy abc_tarifa_precios_select
on public.catalogo_tpv_tarifa_precios
for select to authenticated
using (private.la_tiene_local(empresa_id,local_id));

revoke all on table public.catalogo_tpv_tarifas_horario, public.catalogo_tpv_tarifa_precios
  from public,anon,authenticated,service_role;
grant select on table public.catalogo_tpv_tarifas_horario, public.catalogo_tpv_tarifa_precios
  to authenticated;

comment on table public.catalogo_tpv_tarifas_horario is
  'T8 pieza 3: tarifa que se activa sola según el día de la semana y la hora (p. ej. "hora feliz"). Sin zonas todavía: se aplica igual en todo el local.';
comment on table public.catalogo_tpv_tarifa_precios is
  'T8 pieza 3: precio especial de un producto dentro de una tarifa de horario. Solo precio base (nunca sustituye el modo "precio con impuesto incluido" de D31: al aplicarse, la línea pasa a calcularse como precio base + impuesto normal del producto).';

-- 3. Qué tarifa está vigente ahora mismo (o ninguna). Nunca rompe un cobro: si algo falla,
-- devuelve NULL y el cobro sigue al precio normal.
create function private.abc_tarifa_horario_vigente(
  p_empresa_id text,
  p_local_id text
)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_tz text;
  v_local_ts timestamp without time zone;
  v_dow smallint;
  v_hora time;
  v_tarifa_id uuid;
begin
  select r.timezone_name into v_tz
    from private.abc_operating_day_reglas r
   where r.empresa_id=p_empresa_id and r.local_id=p_local_id
     and r.vigente_desde<=now() and (r.vigente_hasta is null or now()<r.vigente_hasta)
   order by r.vigente_desde desc, r.version desc
   limit 1;

  if v_tz is null or not exists(select 1 from pg_catalog.pg_timezone_names tz where tz.name=v_tz) then
    v_tz:='Europe/Madrid';
  end if;

  v_local_ts:=now() at time zone v_tz;
  v_dow:=extract(isodow from v_local_ts)::smallint;
  v_hora:=v_local_ts::time;

  select t.id into v_tarifa_id
    from public.catalogo_tpv_tarifas_horario t
   where t.empresa_id=p_empresa_id and t.local_id=p_local_id and t.activo=true
     and v_dow=any(t.dias_semana)
     and v_hora>=t.hora_inicio and v_hora<t.hora_fin
   order by t.id
   limit 1;

  return v_tarifa_id;
exception when others then
  return null;
end $$;

-- 4a. Crear o editar una tarifa de horario.
create function public.abc_guardar_tarifa_horario(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_tarifa_id uuid,
  p_nombre text,
  p_dias_semana smallint[],
  p_hora_inicio time,
  p_hora_fin time,
  p_activo boolean,
  p_motivo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_nombre text:=nullif(btrim(coalesce(p_nombre,'')),'');
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_dias smallint[]:=p_dias_semana;
  v_request jsonb;
  v_cmd jsonb;
  v_prev public.catalogo_tpv_tarifas_horario%rowtype;
  v_found boolean;
  v_version bigint;
  v_result jsonb;
begin
  if auth.uid() is null or not private.abc_catalogo_puede_gestionar(p_empresa_id,p_local_id) then
    raise exception 'abc_catalogo_no_autorizado';
  end if;
  if p_tarifa_id is null then raise exception 'tarifa_horario_id_requerido'; end if;
  if v_nombre is null or char_length(v_nombre)>80 then raise exception 'tarifa_horario_nombre_invalido'; end if;
  if v_dias is null or cardinality(v_dias)=0 or not (v_dias <@ array[1,2,3,4,5,6,7]::smallint[]) then
    raise exception 'tarifa_horario_dias_invalidos';
  end if;
  if p_hora_inicio is null or p_hora_fin is null or p_hora_fin<=p_hora_inicio then
    raise exception 'tarifa_horario_rango_invalido';
  end if;
  if p_activo is null then raise exception 'tarifa_horario_estado_requerido'; end if;
  if v_motivo is null then raise exception 'tarifa_horario_motivo_requerido'; end if;

  if p_activo and exists (
    select 1 from public.catalogo_tpv_tarifas_horario t
     where t.empresa_id=p_empresa_id and t.local_id=p_local_id and t.activo=true and t.id<>p_tarifa_id
       and t.dias_semana && v_dias
       and t.hora_inicio<p_hora_fin and p_hora_inicio<t.hora_fin
  ) then
    raise exception 'tarifa_horario_solapada';
  end if;

  v_request:=jsonb_build_object(
    'tarifa_id',p_tarifa_id,'nombre',v_nombre,'dias_semana',to_jsonb(v_dias),'hora_inicio',p_hora_inicio,
    'hora_fin',p_hora_fin,'activo',p_activo,'motivo',v_motivo
  );
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_GUARDAR_TARIFA_HORARIO',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  perform pg_advisory_xact_lock(hashtext('abc_tarifas_horario:'||p_empresa_id||'/'||p_local_id));

  select * into v_prev from public.catalogo_tpv_tarifas_horario t
   where t.empresa_id=p_empresa_id and t.local_id=p_local_id and t.id=p_tarifa_id
   for update;
  v_found:=found;

  if not v_found and exists(select 1 from public.catalogo_tpv_tarifas_horario t where t.id=p_tarifa_id) then
    raise exception 'tarifa_horario_id_en_uso';
  end if;
  if exists(
    select 1 from public.catalogo_tpv_tarifas_horario t
     where t.empresa_id=p_empresa_id and t.local_id=p_local_id
       and lower(btrim(t.nombre))=lower(v_nombre) and t.id<>p_tarifa_id
  ) then
    raise exception 'tarifa_horario_nombre_duplicado';
  end if;

  if not v_found then
    insert into public.catalogo_tpv_tarifas_horario(
      id,empresa_id,local_id,nombre,dias_semana,hora_inicio,hora_fin,activo,version
    ) values (
      p_tarifa_id,p_empresa_id,p_local_id,v_nombre,v_dias,p_hora_inicio,p_hora_fin,p_activo,1
    );
    v_version:=1;
  else
    update public.catalogo_tpv_tarifas_horario
       set nombre=v_nombre,dias_semana=v_dias,hora_inicio=p_hora_inicio,hora_fin=p_hora_fin,activo=p_activo,
           version=version+1,updated_at=now()
     where id=v_prev.id
    returning version into v_version;
  end if;

  v_result:=jsonb_build_object(
    'ok',true,'tarifa_id',p_tarifa_id,'creado',not v_found,'version',v_version,
    'tarifa',jsonb_build_object(
      'nombre',v_nombre,'dias_semana',to_jsonb(v_dias),'hora_inicio',p_hora_inicio,'hora_fin',p_hora_fin,'activo',p_activo
    )
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

-- 4b. Crear o editar el precio especial de un producto dentro de una tarifa.
create function public.abc_guardar_tarifa_precio(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_tarifa_id uuid,
  p_producto_id text,
  p_currency_code text,
  p_precio_unitario numeric,
  p_activo boolean,
  p_motivo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_currency text:=upper(btrim(coalesce(p_currency_code,'')));
  v_producto text:=nullif(btrim(coalesce(p_producto_id,'')),'');
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_request jsonb;
  v_cmd jsonb;
  v_prev public.catalogo_tpv_tarifa_precios%rowtype;
  v_found boolean;
  v_version bigint;
  v_result jsonb;
begin
  if auth.uid() is null or not private.abc_catalogo_puede_gestionar(p_empresa_id,p_local_id) then
    raise exception 'abc_catalogo_no_autorizado';
  end if;
  if v_producto is null then raise exception 'tarifa_precio_producto_requerido'; end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'tarifa_precio_moneda_invalida'; end if;
  if p_tarifa_id is null then raise exception 'tarifa_precio_tarifa_requerida'; end if;
  if p_precio_unitario is null or p_precio_unitario<0 then raise exception 'tarifa_precio_valor_invalido'; end if;
  if p_activo is null then raise exception 'tarifa_precio_estado_requerido'; end if;
  if v_motivo is null then raise exception 'tarifa_precio_motivo_requerido'; end if;

  if p_activo then
    if not exists(
      select 1 from public.catalogo_tpv_productos p
       where p.empresa_id=p_empresa_id and p.local_id=p_local_id and p.producto_id=v_producto
         and p.currency_code=v_currency and p.activo=true
    ) then
      raise exception 'tarifa_precio_producto_no_disponible';
    end if;
    if not exists(
      select 1 from public.catalogo_tpv_tarifas_horario t
       where t.empresa_id=p_empresa_id and t.local_id=p_local_id and t.id=p_tarifa_id and t.activo=true
    ) then
      raise exception 'tarifa_precio_tarifa_no_disponible';
    end if;
  else
    if not exists(
      select 1 from public.catalogo_tpv_productos p
       where p.empresa_id=p_empresa_id and p.local_id=p_local_id and p.producto_id=v_producto and p.currency_code=v_currency
    ) then
      raise exception 'tarifa_precio_producto_no_encontrado';
    end if;
    if not exists(
      select 1 from public.catalogo_tpv_tarifas_horario t
       where t.empresa_id=p_empresa_id and t.local_id=p_local_id and t.id=p_tarifa_id
    ) then
      raise exception 'tarifa_precio_tarifa_no_encontrada';
    end if;
  end if;

  v_request:=jsonb_build_object(
    'tarifa_id',p_tarifa_id,'producto_id',v_producto,'currency_code',v_currency,
    'precio_unitario',p_precio_unitario,'activo',p_activo,'motivo',v_motivo
  );
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_GUARDAR_TARIFA_PRECIO',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  perform pg_advisory_xact_lock(hashtext('abc_tarifa_precios:'||p_empresa_id||'/'||p_local_id));

  select * into v_prev from public.catalogo_tpv_tarifa_precios tp
   where tp.empresa_id=p_empresa_id and tp.local_id=p_local_id and tp.tarifa_id=p_tarifa_id
     and tp.producto_id=v_producto and tp.currency_code=v_currency
   for update;
  v_found:=found;

  if not v_found then
    insert into public.catalogo_tpv_tarifa_precios(
      empresa_id,local_id,tarifa_id,producto_id,currency_code,precio_unitario,activo,version
    ) values (
      p_empresa_id,p_local_id,p_tarifa_id,v_producto,v_currency,p_precio_unitario,p_activo,1
    );
    v_version:=1;
  else
    update public.catalogo_tpv_tarifa_precios
       set precio_unitario=p_precio_unitario,activo=p_activo,version=version+1,updated_at=now()
     where empresa_id=v_prev.empresa_id and local_id=v_prev.local_id and tarifa_id=v_prev.tarifa_id
       and producto_id=v_prev.producto_id and currency_code=v_prev.currency_code
    returning version into v_version;
  end if;

  v_result:=jsonb_build_object(
    'ok',true,'tarifa_id',p_tarifa_id,'producto_id',v_producto,'currency_code',v_currency,
    'creado',not v_found,'version',v_version,
    'tarifa_precio',jsonb_build_object('precio_unitario',p_precio_unitario,'activo',p_activo)
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

-- 5. La función real de precio (A03): si hay una tarifa de horario vigente y el producto
-- tiene un precio especial activo en ella, se sustituye precio_unitario y se fuerza
-- precio_con_impuesto a NULL (la línea se calcula como precio base + impuesto normal). Si no
-- hay ninguna tarifa vigente, o el producto no tiene precio especial en ella, el resultado es
-- exactamente el de antes.
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
  v_tarifa_id uuid;
  v_tarifa_precio public.catalogo_tpv_tarifa_precios%rowtype;
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

  v_tarifa_id:=private.abc_tarifa_horario_vigente(p_empresa_id,p_local_id);
  if v_tarifa_id is not null then
    select * into v_tarifa_precio
      from public.catalogo_tpv_tarifa_precios tp
     where tp.empresa_id=p_empresa_id and tp.local_id=p_local_id and tp.tarifa_id=v_tarifa_id
       and tp.producto_id=v_catalog.producto_id and tp.currency_code=v_catalog.currency_code
       and tp.activo=true;
    if found then
      v_catalog.precio_unitario:=v_tarifa_precio.precio_unitario;
      v_catalog.precio_con_impuesto:=null;
    end if;
  end if;

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
    'tarifa_horario_aplicada',v_tarifa_id,
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
      'precio_con_impuesto',v_catalog.precio_con_impuesto,
      'tarifa_horario_aplicada',v_tarifa_id
    )
  );
end $$;

revoke all on function public.abc_guardar_tarifa_horario(text,text,text,uuid,text,smallint[],time,time,boolean,text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_guardar_tarifa_precio(text,text,text,uuid,text,text,numeric,boolean,text)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_guardar_tarifa_horario(text,text,text,uuid,text,smallint[],time,time,boolean,text) to authenticated;
grant execute on function public.abc_guardar_tarifa_precio(text,text,text,uuid,text,text,numeric,boolean,text) to authenticated;
