-- Plan Maestro L&A Suite — Etapa 6, T8 (pieza 1): biblioteca de opciones reutilizables.
--
-- Fecha: 24/10/2026. Autorización: Hoja QA-10 (Pedro, 24/10/2026, chat).
--
-- Qué arregla: el esquema de T3-A04 (catalogo_tpv_grupos_opciones / catalogo_tpv_opciones /
-- catalogo_tpv_producto_grupos) ya está diseñado para que un mismo grupo de opciones (p. ej.
-- "Tamaño") se enlace a varios productos sin duplicarlo — pero no existía ninguna función para
-- crear o editar esas filas: hoy solo existen porque se insertaron a mano por SQL en QA, para
-- poder probar la compra con variantes/modificadores (T3-A04). Esta pieza añade las 3 funciones
-- que faltaban, con el mismo permiso que ya gestiona el catálogo
-- (private.abc_catalogo_puede_gestionar: Propietario o Encargado) y el mismo patrón idempotente
-- del resto del proyecto. No cambia ninguna función ni tabla existente, no toca T3-A04.
--
-- 1. abc_guardar_grupo_opciones: crea o edita un grupo de la biblioteca (nombre, tipo fijo una
--    vez creado: VARIANTE o MODIFICADOR).
-- 2. abc_guardar_opcion: crea o edita una opción dentro de un grupo (nombre, tipo, precio
--    añadido, impuesto, cantidad máxima) — exige la misma coherencia tipo_grupo/tipo_opcion que
--    ya comprueba la compra (abc_calcular_linea_tpv_configurada): un grupo VARIANTE solo admite
--    opciones VARIANTE; un grupo MODIFICADOR no admite ninguna opción VARIANTE.
-- 3. abc_vincular_grupo_producto: enlaza (o desenlaza, desactivando) un grupo con un producto,
--    con su propio mínimo/máximo de selección para ese producto — así un mismo grupo se puede
--    aplicar a varios productos sin duplicar nada.
--
-- La lectura (ver la biblioteca, ver qué productos usan un grupo) no necesita función nueva: las
-- 3 tablas ya tienen SELECT abierto a cualquier miembro del local (políticas
-- abc_grupos_opciones_select / abc_opciones_select / abc_producto_grupos_select, de F3-A04).
--
-- Límite deliberado: no existe todavía ningún «editor de producto» en la pantalla (pieza 2 de
-- T8, sin empezar) — por eso abc_vincular_grupo_producto se usa aquí desde un panel de enlace
-- sencillo (elegir producto y grupo), no desde dentro de la ficha de un producto.

set local lock_timeout = '10s';

do $$
declare v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.catalogo_tpv_grupos_opciones') is null then v_missing:=array_append(v_missing,'catalogo_tpv_grupos_opciones'); end if;
  if to_regclass('public.catalogo_tpv_opciones') is null then v_missing:=array_append(v_missing,'catalogo_tpv_opciones'); end if;
  if to_regclass('public.catalogo_tpv_producto_grupos') is null then v_missing:=array_append(v_missing,'catalogo_tpv_producto_grupos'); end if;
  if to_regclass('public.catalogo_tpv_productos') is null then v_missing:=array_append(v_missing,'catalogo_tpv_productos'); end if;
  if to_regprocedure('private.abc_catalogo_puede_gestionar(text,text)') is null then v_missing:=array_append(v_missing,'abc_catalogo_puede_gestionar'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_fallar'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_T8_P1_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if to_regprocedure('public.abc_guardar_grupo_opciones(text,text,text,uuid,text,text,integer,boolean,text)') is not null
     or to_regprocedure('public.abc_guardar_opcion(text,text,text,uuid,uuid,text,text,text,numeric,boolean,numeric,smallint,integer,boolean,text)') is not null
     or to_regprocedure('public.abc_vincular_grupo_producto(text,text,text,text,text,uuid,smallint,smallint,integer,boolean,text)') is not null then
    raise exception 'ABC_T8_P1_PREFLIGHT_FALLO: objetos ya existen';
  end if;
end $$;

-- Nombre único de grupo dentro de un local (no existía todavía — igual que ya exige "Equipos del local").
create unique index abc_grupo_opciones_nombre_uq
  on public.catalogo_tpv_grupos_opciones(empresa_id,local_id,lower(btrim(nombre)));

-- Nombre único de opción dentro de su grupo (no existía todavía).
create unique index abc_opcion_nombre_uq
  on public.catalogo_tpv_opciones(empresa_id,local_id,grupo_id,lower(btrim(nombre)));

-- 1. Crear o editar un grupo de la biblioteca.
create function public.abc_guardar_grupo_opciones(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_grupo_id uuid,
  p_nombre text,
  p_tipo_grupo text,
  p_orden integer,
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
  v_tipo text:=upper(btrim(coalesce(p_tipo_grupo,'')));
  v_nombre text:=nullif(btrim(coalesce(p_nombre,'')),'');
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_orden integer:=coalesce(p_orden,0);
  v_request jsonb;
  v_cmd jsonb;
  v_prev public.catalogo_tpv_grupos_opciones%rowtype;
  v_found boolean;
  v_version bigint;
  v_result jsonb;
begin
  if auth.uid() is null or not private.abc_catalogo_puede_gestionar(p_empresa_id,p_local_id) then
    raise exception 'abc_catalogo_no_autorizado';
  end if;
  if p_grupo_id is null then raise exception 'grupo_id_requerido'; end if;
  if v_tipo not in ('VARIANTE','MODIFICADOR') then raise exception 'grupo_tipo_invalido'; end if;
  if v_nombre is null or char_length(v_nombre)>80 then raise exception 'grupo_nombre_invalido'; end if;
  if p_activo is null then raise exception 'grupo_estado_requerido'; end if;
  if v_motivo is null then raise exception 'grupo_motivo_requerido'; end if;

  v_request:=jsonb_build_object(
    'grupo_id',p_grupo_id,'nombre',v_nombre,'tipo_grupo',v_tipo,'orden',v_orden,'activo',p_activo,'motivo',v_motivo
  );
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_GUARDAR_GRUPO_OPCIONES',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  perform pg_advisory_xact_lock(hashtext('abc_grupos_opciones:'||p_empresa_id||'/'||p_local_id));

  select * into v_prev from public.catalogo_tpv_grupos_opciones g
   where g.empresa_id=p_empresa_id and g.local_id=p_local_id and g.id=p_grupo_id
   for update;
  v_found:=found;

  if not v_found and exists(select 1 from public.catalogo_tpv_grupos_opciones g where g.id=p_grupo_id) then
    raise exception 'grupo_id_en_uso';
  end if;
  if exists(
    select 1 from public.catalogo_tpv_grupos_opciones g
     where g.empresa_id=p_empresa_id and g.local_id=p_local_id
       and lower(btrim(g.nombre))=lower(v_nombre) and g.id<>p_grupo_id
  ) then
    raise exception 'grupo_nombre_duplicado';
  end if;

  if not v_found then
    insert into public.catalogo_tpv_grupos_opciones(
      id,empresa_id,local_id,nombre,tipo_grupo,orden,activo,version
    ) values (
      p_grupo_id,p_empresa_id,p_local_id,v_nombre,v_tipo,v_orden,p_activo,1
    );
    v_version:=1;
  else
    if v_prev.tipo_grupo<>v_tipo then raise exception 'grupo_tipo_inmutable'; end if;
    update public.catalogo_tpv_grupos_opciones
       set nombre=v_nombre,orden=v_orden,activo=p_activo,version=version+1,updated_at=now()
     where id=v_prev.id
    returning version into v_version;
  end if;

  v_result:=jsonb_build_object(
    'ok',true,'grupo_id',p_grupo_id,'creado',not v_found,'version',v_version,
    'grupo',jsonb_build_object('nombre',v_nombre,'tipo_grupo',v_tipo,'orden',v_orden,'activo',p_activo)
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

-- 2. Crear o editar una opción dentro de un grupo.
create function public.abc_guardar_opcion(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_opcion_id uuid,
  p_grupo_id uuid,
  p_currency_code text,
  p_nombre text,
  p_tipo_opcion text,
  p_delta_precio numeric,
  p_hereda_impuesto boolean,
  p_impuesto_pct numeric,
  p_max_cantidad smallint,
  p_orden integer,
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
  v_nombre text:=nullif(btrim(coalesce(p_nombre,'')),'');
  v_tipo text:=upper(btrim(coalesce(p_tipo_opcion,'')));
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_orden integer:=coalesce(p_orden,0);
  v_max smallint:=coalesce(p_max_cantidad,1);
  v_request jsonb;
  v_cmd jsonb;
  v_grupo public.catalogo_tpv_grupos_opciones%rowtype;
  v_prev public.catalogo_tpv_opciones%rowtype;
  v_found boolean;
  v_version bigint;
  v_result jsonb;
begin
  if auth.uid() is null or not private.abc_catalogo_puede_gestionar(p_empresa_id,p_local_id) then
    raise exception 'abc_catalogo_no_autorizado';
  end if;
  if p_opcion_id is null then raise exception 'opcion_id_requerido'; end if;
  if p_grupo_id is null then raise exception 'opcion_grupo_requerido'; end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'opcion_moneda_invalida'; end if;
  if v_nombre is null or char_length(v_nombre)>80 then raise exception 'opcion_nombre_invalido'; end if;
  if v_tipo not in ('VARIANTE','EXTRA','RETIRADA','SUSTITUCION','COMPLEMENTO') then raise exception 'opcion_tipo_invalido'; end if;
  if p_hereda_impuesto is null then raise exception 'opcion_impuesto_requerido'; end if;
  if p_hereda_impuesto and p_impuesto_pct is not null then raise exception 'opcion_impuesto_incoherente'; end if;
  if not p_hereda_impuesto and (p_impuesto_pct is null or p_impuesto_pct<0 or p_impuesto_pct>100) then raise exception 'opcion_impuesto_invalido'; end if;
  if v_max<1 then raise exception 'opcion_max_cantidad_invalida'; end if;
  if p_activo is null then raise exception 'opcion_estado_requerido'; end if;
  if v_motivo is null then raise exception 'opcion_motivo_requerido'; end if;

  select * into v_grupo from public.catalogo_tpv_grupos_opciones g
   where g.empresa_id=p_empresa_id and g.local_id=p_local_id and g.id=p_grupo_id;
  if not found then raise exception 'opcion_grupo_no_encontrado'; end if;
  if p_activo and not v_grupo.activo then raise exception 'opcion_grupo_inactivo'; end if;
  if v_grupo.tipo_grupo='VARIANTE' and v_tipo<>'VARIANTE' then raise exception 'opcion_tipo_incoherente_variante'; end if;
  if v_grupo.tipo_grupo='MODIFICADOR' and v_tipo='VARIANTE' then raise exception 'opcion_tipo_incoherente_modificador'; end if;

  v_request:=jsonb_build_object(
    'opcion_id',p_opcion_id,'grupo_id',p_grupo_id,'currency_code',v_currency,'nombre',v_nombre,'tipo_opcion',v_tipo,
    'delta_precio',p_delta_precio,'hereda_impuesto',p_hereda_impuesto,'impuesto_pct',p_impuesto_pct,
    'max_cantidad',v_max,'orden',v_orden,'activo',p_activo,'motivo',v_motivo
  );
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_GUARDAR_OPCION',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  perform pg_advisory_xact_lock(hashtext('abc_opciones:'||p_empresa_id||'/'||p_local_id));

  select * into v_prev from public.catalogo_tpv_opciones o
   where o.empresa_id=p_empresa_id and o.local_id=p_local_id and o.id=p_opcion_id
   for update;
  v_found:=found;

  if not v_found and exists(select 1 from public.catalogo_tpv_opciones o where o.id=p_opcion_id) then
    raise exception 'opcion_id_en_uso';
  end if;
  if exists(
    select 1 from public.catalogo_tpv_opciones o
     where o.empresa_id=p_empresa_id and o.local_id=p_local_id and o.grupo_id=p_grupo_id
       and lower(btrim(o.nombre))=lower(v_nombre) and o.id<>p_opcion_id
  ) then
    raise exception 'opcion_nombre_duplicado';
  end if;

  if not v_found then
    insert into public.catalogo_tpv_opciones(
      id,empresa_id,local_id,grupo_id,currency_code,nombre,tipo_opcion,delta_precio,hereda_impuesto,
      impuesto_pct,max_cantidad,orden,activo,version
    ) values (
      p_opcion_id,p_empresa_id,p_local_id,p_grupo_id,v_currency,v_nombre,v_tipo,coalesce(p_delta_precio,0),
      p_hereda_impuesto,p_impuesto_pct,v_max,v_orden,p_activo,1
    );
    v_version:=1;
  else
    if v_prev.grupo_id<>p_grupo_id then raise exception 'opcion_grupo_inmutable'; end if;
    if v_prev.currency_code<>v_currency then raise exception 'opcion_moneda_inmutable'; end if;
    update public.catalogo_tpv_opciones
       set nombre=v_nombre,tipo_opcion=v_tipo,delta_precio=coalesce(p_delta_precio,0),hereda_impuesto=p_hereda_impuesto,
           impuesto_pct=p_impuesto_pct,max_cantidad=v_max,orden=v_orden,activo=p_activo,version=version+1,updated_at=now()
     where id=v_prev.id
    returning version into v_version;
  end if;

  v_result:=jsonb_build_object(
    'ok',true,'opcion_id',p_opcion_id,'creado',not v_found,'version',v_version,
    'opcion',jsonb_build_object(
      'grupo_id',p_grupo_id,'currency_code',v_currency,'nombre',v_nombre,'tipo_opcion',v_tipo,
      'delta_precio',coalesce(p_delta_precio,0),'hereda_impuesto',p_hereda_impuesto,'impuesto_pct',p_impuesto_pct,
      'max_cantidad',v_max,'orden',v_orden,'activo',p_activo
    )
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

-- 3. Enlazar (o desenlazar, desactivando) un grupo de la biblioteca con un producto.
create function public.abc_vincular_grupo_producto(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_producto_id text,
  p_currency_code text,
  p_grupo_id uuid,
  p_min_selecciones smallint,
  p_max_selecciones smallint,
  p_orden integer,
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
  v_min smallint:=coalesce(p_min_selecciones,0);
  v_max smallint:=coalesce(p_max_selecciones,1);
  v_orden integer:=coalesce(p_orden,0);
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_request jsonb;
  v_cmd jsonb;
  v_prev public.catalogo_tpv_producto_grupos%rowtype;
  v_found boolean;
  v_version bigint;
  v_result jsonb;
  v_opciones_activas integer;
begin
  if auth.uid() is null or not private.abc_catalogo_puede_gestionar(p_empresa_id,p_local_id) then
    raise exception 'abc_catalogo_no_autorizado';
  end if;
  if v_producto is null then raise exception 'vinculo_producto_requerido'; end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'vinculo_moneda_invalida'; end if;
  if p_grupo_id is null then raise exception 'vinculo_grupo_requerido'; end if;
  if v_min<0 then raise exception 'vinculo_min_invalido'; end if;
  if v_max<1 then raise exception 'vinculo_max_invalido'; end if;
  if v_max<v_min then raise exception 'vinculo_rango_invalido'; end if;
  if p_activo is null then raise exception 'vinculo_estado_requerido'; end if;
  if v_motivo is null then raise exception 'vinculo_motivo_requerido'; end if;

  if p_activo then
    if not exists(
      select 1 from public.catalogo_tpv_productos p
       where p.empresa_id=p_empresa_id and p.local_id=p_local_id and p.producto_id=v_producto
         and p.currency_code=v_currency and p.activo=true
    ) then
      raise exception 'vinculo_producto_no_disponible';
    end if;
    if not exists(
      select 1 from public.catalogo_tpv_grupos_opciones g
       where g.empresa_id=p_empresa_id and g.local_id=p_local_id and g.id=p_grupo_id and g.activo=true
    ) then
      raise exception 'vinculo_grupo_no_disponible';
    end if;
    if v_min>0 then
      select count(*) into v_opciones_activas
        from public.catalogo_tpv_opciones o
       where o.empresa_id=p_empresa_id and o.local_id=p_local_id and o.grupo_id=p_grupo_id
         and o.currency_code=v_currency and o.activo=true;
      if v_opciones_activas=0 then raise exception 'vinculo_grupo_sin_opciones'; end if;
    end if;
  else
    if not exists(
      select 1 from public.catalogo_tpv_productos p
       where p.empresa_id=p_empresa_id and p.local_id=p_local_id and p.producto_id=v_producto
         and p.currency_code=v_currency
    ) then
      raise exception 'vinculo_producto_no_encontrado';
    end if;
    if not exists(
      select 1 from public.catalogo_tpv_grupos_opciones g
       where g.empresa_id=p_empresa_id and g.local_id=p_local_id and g.id=p_grupo_id
    ) then
      raise exception 'vinculo_grupo_no_encontrado';
    end if;
  end if;

  v_request:=jsonb_build_object(
    'producto_id',v_producto,'currency_code',v_currency,'grupo_id',p_grupo_id,'min_selecciones',v_min,
    'max_selecciones',v_max,'orden',v_orden,'activo',p_activo,'motivo',v_motivo
  );
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_VINCULAR_GRUPO_PRODUCTO',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  perform pg_advisory_xact_lock(hashtext('abc_vinculos_grupo:'||p_empresa_id||'/'||p_local_id));

  select * into v_prev from public.catalogo_tpv_producto_grupos pg
   where pg.empresa_id=p_empresa_id and pg.local_id=p_local_id and pg.producto_id=v_producto
     and pg.currency_code=v_currency and pg.grupo_id=p_grupo_id
   for update;
  v_found:=found;

  if not v_found then
    insert into public.catalogo_tpv_producto_grupos(
      empresa_id,local_id,producto_id,currency_code,grupo_id,min_selecciones,max_selecciones,orden,activo,version
    ) values (
      p_empresa_id,p_local_id,v_producto,v_currency,p_grupo_id,v_min,v_max,v_orden,p_activo,1
    );
    v_version:=1;
  else
    update public.catalogo_tpv_producto_grupos
       set min_selecciones=v_min,max_selecciones=v_max,orden=v_orden,activo=p_activo,version=version+1,updated_at=now()
     where empresa_id=v_prev.empresa_id and local_id=v_prev.local_id and producto_id=v_prev.producto_id
       and currency_code=v_prev.currency_code and grupo_id=v_prev.grupo_id
    returning version into v_version;
  end if;

  v_result:=jsonb_build_object(
    'ok',true,'producto_id',v_producto,'currency_code',v_currency,'grupo_id',p_grupo_id,
    'creado',not v_found,'version',v_version,
    'vinculo',jsonb_build_object('min_selecciones',v_min,'max_selecciones',v_max,'orden',v_orden,'activo',p_activo)
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

revoke all on function public.abc_guardar_grupo_opciones(text,text,text,uuid,text,text,integer,boolean,text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_guardar_opcion(text,text,text,uuid,uuid,text,text,text,numeric,boolean,numeric,smallint,integer,boolean,text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_vincular_grupo_producto(text,text,text,text,text,uuid,smallint,smallint,integer,boolean,text)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_guardar_grupo_opciones(text,text,text,uuid,text,text,integer,boolean,text) to authenticated;
grant execute on function public.abc_guardar_opcion(text,text,text,uuid,uuid,text,text,text,numeric,boolean,numeric,smallint,integer,boolean,text) to authenticated;
grant execute on function public.abc_vincular_grupo_producto(text,text,text,text,text,uuid,smallint,smallint,integer,boolean,text) to authenticated;
