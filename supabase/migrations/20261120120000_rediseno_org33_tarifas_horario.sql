-- Rediseño org-33 — tarifas por horario y precios por tarifa.
--
-- Esta migración NO inventa nada: reconstruye en el repositorio cuatro piezas
-- que el 18/11/2026 se crearon a mano directamente en el proyecto de QA y que
-- ninguna migración sabía crear. El cliente ya las usaba: la gestión de sala de
-- org-33 lee `catalogo_tpv_tarifas_horario` y `catalogo_tpv_tarifa_precios` y
-- llama a `abc_guardar_tarifa_horario` y `abc_guardar_tarifa_precio`. La fila
-- figuraba como «Pasa» con evidencia live —y lo era, en QA— pero un despliegue
-- en cualquier otro sitio habría llevado la pantalla y no lo que la pantalla
-- necesita.
--
-- Todo lo que hay aquí sale de un volcado de solo lectura de los catálogos del
-- sistema de QA (docs/rediseno/VOLCAR_TARIFAS_DESDE_QA.sql, ejecutado el
-- 20/11/2026): columnas, restricciones, índices, RLS, políticas, permisos de
-- tabla, el texto completo de las dos funciones y sus permisos de ejecución.
-- Los cuerpos de las funciones son los de `pg_get_functiondef`, no una
-- reescritura.
--
-- Es una migración de reconciliación, así que es idempotente a propósito: en QA
-- no debe hacer nada (los objetos ya están), y en cualquier otro entorno los
-- crea completos. Por eso `if not exists`, `drop policy if exists` y
-- `create or replace function` en lugar del `create` seco del resto del
-- paquete. Al final hay un bloque que comprueba que lo que ha quedado es lo que
-- se esperaba, para que `if not exists` no pueda tragarse una tabla distinta
-- que ya estuviera ahí con ese nombre.
--
-- Aditiva. No mueve stock, no cobra y no crea catálogo real.

-- ---- Comprobaciones previas: las dependencias existen ----
do $$
declare v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.locales') is null then v_missing:=array_append(v_missing,'locales'); end if;
  if to_regclass('public.catalogo_tpv_productos') is null then v_missing:=array_append(v_missing,'catalogo_tpv_productos'); end if;
  if to_regprocedure('private.la_tiene_local(text,text)') is null then v_missing:=array_append(v_missing,'la_tiene_local'); end if;
  if to_regprocedure('private.abc_catalogo_puede_gestionar(text,text)') is null then v_missing:=array_append(v_missing,'abc_catalogo_puede_gestionar'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_fallar'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'REDISENO_ORG33_TARIFAS_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
end $$;

-- ---- Tablas ----
-- `id` no lleva default: lo decide quien llama, porque el id de la tarifa viaja
-- junto al operation_id para que un reintento no cree dos tarifas.
create table if not exists public.catalogo_tpv_tarifas_horario (
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
  constraint abc_tarifa_horario_nombre check (
    nullif(btrim(nombre),'') is not null and char_length(nombre)<=80
  ),
  constraint abc_tarifa_horario_dias check (
    dias_semana is not null
    and cardinality(dias_semana)>0
    and dias_semana <@ array[1,2,3,4,5,6,7]::smallint[]
  ),
  constraint abc_tarifa_horario_rango check (hora_fin>hora_inicio),
  constraint abc_tarifa_horario_version check (version>=1),
  constraint abc_tarifa_horario_local_fk
    foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint abc_tarifa_horario_scope_id_uq unique (empresa_id,local_id,id)
);

create table if not exists public.catalogo_tpv_tarifa_precios (
  empresa_id text not null,
  local_id text not null,
  tarifa_id uuid not null,
  producto_id text not null,
  currency_code text not null,
  precio_unitario numeric not null,
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

-- ---- Índices ----
-- El único índice que no viene de una restricción: el nombre de la tarifa es
-- único por local sin distinguir mayúsculas ni espacios de los extremos. Va
-- como índice y no como restricción porque es sobre una expresión.
-- En QA no hay ningún otro índice sobre estas dos tablas; aquí tampoco se añade
-- ninguno, para no separar el repositorio de lo que de verdad hay.
create unique index if not exists abc_tarifa_horario_nombre_uq
  on public.catalogo_tpv_tarifas_horario(empresa_id,local_id,lower(btrim(nombre)));

-- ---- RLS y políticas ----
alter table public.catalogo_tpv_tarifas_horario enable row level security;
alter table public.catalogo_tpv_tarifa_precios enable row level security;

drop policy if exists abc_tarifas_horario_select on public.catalogo_tpv_tarifas_horario;
create policy abc_tarifas_horario_select
on public.catalogo_tpv_tarifas_horario
for select to authenticated
using (private.la_tiene_local(empresa_id,local_id));

drop policy if exists abc_tarifa_precios_select on public.catalogo_tpv_tarifa_precios;
create policy abc_tarifa_precios_select
on public.catalogo_tpv_tarifa_precios
for select to authenticated
using (private.la_tiene_local(empresa_id,local_id));

-- Solo lectura, y solo del propio local. Escribir es cosa de las dos funciones
-- de abajo, que son `security definer` y comprueban el permiso de gestión.
revoke all on table
  public.catalogo_tpv_tarifas_horario,
  public.catalogo_tpv_tarifa_precios
from public,anon,authenticated,service_role;

grant select on table
  public.catalogo_tpv_tarifas_horario,
  public.catalogo_tpv_tarifa_precios
to authenticated;

-- ---- Funciones ----
-- Cuerpos tomados tal cual del volcado de QA del 20/11/2026.
create or replace function public.abc_guardar_tarifa_horario(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_tarifa_id uuid,
  p_nombre text,
  p_dias_semana smallint[],
  p_hora_inicio time without time zone,
  p_hora_fin time without time zone,
  p_activo boolean,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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
end $function$;

create or replace function public.abc_guardar_tarifa_precio(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_tarifa_id uuid,
  p_producto_id text,
  p_currency_code text,
  p_precio_unitario numeric,
  p_activo boolean,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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
end $function$;

revoke all on function public.abc_guardar_tarifa_horario(
  text,text,text,uuid,text,smallint[],time without time zone,time without time zone,boolean,text
) from public,anon,authenticated,service_role;
revoke all on function public.abc_guardar_tarifa_precio(
  text,text,text,uuid,text,text,numeric,boolean,text
) from public,anon,authenticated,service_role;

grant execute on function public.abc_guardar_tarifa_horario(
  text,text,text,uuid,text,smallint[],time without time zone,time without time zone,boolean,text
) to authenticated;
grant execute on function public.abc_guardar_tarifa_precio(
  text,text,text,uuid,text,text,numeric,boolean,text
) to authenticated;

-- ---- Comprobación final ----
-- `if not exists` acepta en silencio una tabla distinta que ya estuviera ahí con
-- ese nombre. Esto cierra ese hueco: si lo que hay no es lo que esta migración
-- describe, falla aquí y no seis meses después.
do $$
declare
  v_faltan text[]:=array[]::text[];
  v_col text;
begin
  foreach v_col in array array[
    'id','empresa_id','local_id','nombre','dias_semana','hora_inicio','hora_fin',
    'activo','version','created_at','updated_at'
  ] loop
    if not exists (
      select 1 from information_schema.columns
       where table_schema='public' and table_name='catalogo_tpv_tarifas_horario' and column_name=v_col
    ) then v_faltan:=array_append(v_faltan,'tarifas_horario.'||v_col); end if;
  end loop;
  foreach v_col in array array[
    'empresa_id','local_id','tarifa_id','producto_id','currency_code',
    'precio_unitario','activo','version','created_at','updated_at'
  ] loop
    if not exists (
      select 1 from information_schema.columns
       where table_schema='public' and table_name='catalogo_tpv_tarifa_precios' and column_name=v_col
    ) then v_faltan:=array_append(v_faltan,'tarifa_precios.'||v_col); end if;
  end loop;
  foreach v_col in array array[
    'abc_tarifa_horario_scope_id_uq','abc_tarifa_horario_rango','abc_tarifa_horario_dias',
    'abc_tarifa_precio_tarifa_fk','abc_tarifa_precio_producto_fk','abc_tarifa_precio_moneda'
  ] loop
    if not exists (select 1 from pg_constraint where conname=v_col) then
      v_faltan:=array_append(v_faltan,'restriccion '||v_col);
    end if;
  end loop;
  if not exists (select 1 from pg_class where relname='abc_tarifa_horario_nombre_uq') then
    v_faltan:=array_append(v_faltan,'indice abc_tarifa_horario_nombre_uq');
  end if;
  if cardinality(v_faltan)>0 then
    raise exception 'REDISENO_ORG33_TARIFAS_VERIFICACION_FALLO:%',array_to_string(v_faltan,',');
  end if;
end $$;
