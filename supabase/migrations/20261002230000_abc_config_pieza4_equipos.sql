-- ABC · capa de configuración por empresa y local, PIEZA 4 (solo QA hasta que Pedro autorice otra cosa).
--
-- Decisión de Pedro (2/10/2026, hoja F1): D04 «no tengo ningún equipo por ahora; que sea configurable para los
-- equipos que tengan las empresas o los locales». Inventario y diseño en
-- docs/plan-abc/F6_INVENTARIO_CAPA_CONFIGURACION_2026-10-02.md.
--
-- Qué hace (aditiva; no cambia ninguna función existente ni ningún dato al aplicarse; no integra ni conecta nada):
--  1. Tabla `abc_local_equipos` (sin acceso directo): el REGISTRO de los equipos de cada local (impresora de
--     tickets, impresora de cocina, cajón monedero, datáfono u otro) con su nombre, una referencia libre (modelo,
--     número de serie o etiqueta; nunca contraseñas ni claves), el terminal TPV al que está asociado (opcional),
--     su estado (activo o no) y notas. No se borra nunca: se desactiva. Empieza vacía (D04: ningún equipo).
--  2. `abc_configurar_equipo_local`: solo el Propietario de la empresa; da de alta o actualiza un equipo (el
--     identificador lo aporta quien llama, como en el resto de ABC), con motivo y `operation_id` idempotente.
--     El nombre no se repite dentro de un local (sin distinguir mayúsculas) y el tipo no cambia una vez creado.
--  3. `abc_listar_equipos_local`: cualquier miembro del local ve los equipos (por defecto solo los activos).
--  Cada cambio real deja un evento en `abc_eventos` (EQUIPO_LOCAL_REGISTRADO / EQUIPO_LOCAL_ACTUALIZADO).
--
-- Límite deliberado: es solo un registro. Ningún flujo (impresión, cobro, apertura de cajón) lo lee todavía.

set local lock_timeout = '10s';

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.locales') is null then v_missing:=array_append(v_missing,'locales'); end if;
  if to_regclass('public.terminales_tpv') is null then v_missing:=array_append(v_missing,'terminales_tpv'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.la_tiene_local(text,text)') is null then v_missing:=array_append(v_missing,'la_tiene_local'); end if;
  if to_regprocedure('private.abc_config_puede_configurar(text,text)') is null then v_missing:=array_append(v_missing,'abc_config_puede_configurar (pieza 1)'); end if;
  if to_regprocedure('private.abc_config_dia_evento(text,text)') is null then v_missing:=array_append(v_missing,'abc_config_dia_evento (pieza 1)'); end if;
  if to_regprocedure('auth.uid()') is null then v_missing:=array_append(v_missing,'auth.uid'); end if;
  if not exists(
    select 1 from pg_index i
     where i.indrelid='public.terminales_tpv'::regclass and i.indisunique
       and (select array_agg(a.attname::text order by k.ord)
              from unnest(i.indkey) with ordinality as k(attnum,ord)
              join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum)
           = array['empresa_id','local_id','id']
  ) then v_missing:=array_append(v_missing,'indice único terminales_tpv(empresa_id,local_id,id)'); end if;

  if cardinality(v_missing)>0 then
    raise exception 'ABC_CFG4_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if to_regclass('public.abc_local_equipos') is not null
     or to_regprocedure('public.abc_configurar_equipo_local(text,text,text,uuid,text,text,text,uuid,boolean,text,text)') is not null
     or to_regprocedure('public.abc_listar_equipos_local(text,text,boolean)') is not null then
    raise exception 'ABC_CFG4_PREFLIGHT_FALLO: objetos de la pieza 4 ya existen';
  end if;
end $$;

-- 1. Registro de equipos por local (sin acceso directo).
create table public.abc_local_equipos (
  id uuid primary key,
  empresa_id text not null,
  local_id text not null,
  tipo text not null,
  nombre text not null,
  referencia text,
  terminal_id uuid,
  activo boolean not null default true,
  notas text,
  version bigint not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint abc_local_equipo_local_fk foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint abc_local_equipo_terminal_fk foreign key (empresa_id,local_id,terminal_id)
    references public.terminales_tpv(empresa_id,local_id,id) on delete restrict,
  constraint abc_local_equipo_tipo check (tipo in ('IMPRESORA_TICKET','IMPRESORA_COCINA','CAJON_MONEDERO','DATAFONO','OTRO')),
  constraint abc_local_equipo_nombre check (char_length(btrim(nombre)) between 1 and 80),
  constraint abc_local_equipo_referencia check (referencia is null or char_length(btrim(referencia)) between 1 and 120),
  constraint abc_local_equipo_notas check (notas is null or char_length(btrim(notas)) between 1 and 500),
  constraint abc_local_equipo_version check (version>=1)
);

create unique index abc_local_equipo_nombre_uq
  on public.abc_local_equipos(empresa_id,local_id,lower(btrim(nombre)));
create index abc_local_equipo_local_idx
  on public.abc_local_equipos(empresa_id,local_id,activo);

alter table public.abc_local_equipos enable row level security;
revoke all on table public.abc_local_equipos from public,anon,authenticated,service_role;

comment on table public.abc_local_equipos is
  'Registro de equipos de cada local (capa de configuración, pieza 4): solo registro, sin integración. Sin acceso directo: abc_listar_equipos_local y abc_configurar_equipo_local. La referencia no debe contener contraseñas ni claves.';

-- 2. Alta o actualización de un equipo (solo el Propietario).
create function public.abc_configurar_equipo_local(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_equipo_id uuid,
  p_tipo text,
  p_nombre text,
  p_referencia text,
  p_terminal_id uuid,
  p_activo boolean,
  p_notas text,
  p_motivo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_tipo text:=upper(btrim(coalesce(p_tipo,'')));
  v_nombre text:=nullif(btrim(coalesce(p_nombre,'')),'');
  v_ref text:=nullif(btrim(coalesce(p_referencia,'')),'');
  v_notas text:=nullif(btrim(coalesce(p_notas,'')),'');
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_request jsonb;
  v_cmd jsonb;
  v_prev public.abc_local_equipos%rowtype;
  v_found boolean;
  v_version bigint;
  v_cambio boolean;
  v_creado boolean;
  v_anterior jsonb;
  v_nuevo jsonb;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_config_puede_configurar(p_empresa_id,p_local_id) then
    raise exception 'abc_config_no_autorizado';
  end if;
  if p_equipo_id is null then raise exception 'equipo_id_requerido'; end if;
  if v_tipo not in ('IMPRESORA_TICKET','IMPRESORA_COCINA','CAJON_MONEDERO','DATAFONO','OTRO') then raise exception 'equipo_tipo_invalido'; end if;
  if v_nombre is null or char_length(v_nombre)>80 then raise exception 'equipo_nombre_invalido'; end if;
  if v_ref is not null and char_length(v_ref)>120 then raise exception 'equipo_referencia_invalida'; end if;
  if v_notas is not null and char_length(v_notas)>500 then raise exception 'equipo_notas_invalidas'; end if;
  if p_activo is null then raise exception 'equipo_estado_requerido'; end if;
  if v_motivo is null then raise exception 'equipo_motivo_requerido'; end if;
  if not exists(
    select 1 from public.locales l
     where l.empresa_id=p_empresa_id and l.id=p_local_id and l.activo=true
  ) then
    raise exception 'equipo_local_no_disponible';
  end if;
  if p_terminal_id is not null and not exists(
    select 1 from public.terminales_tpv t
     where t.empresa_id=p_empresa_id and t.local_id=p_local_id and t.id=p_terminal_id and t.activo=true
  ) then
    raise exception 'equipo_terminal_no_disponible';
  end if;

  v_request:=jsonb_build_object(
    'equipo_id',p_equipo_id,'tipo',v_tipo,'nombre',v_nombre,'referencia',v_ref,'terminal_id',p_terminal_id,
    'activo',p_activo,'notas',v_notas,'motivo',v_motivo
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIGURAR_EQUIPO_LOCAL',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  perform pg_advisory_xact_lock(hashtext('abc_equipos:'||p_empresa_id||'/'||p_local_id));

  select * into v_prev
    from public.abc_local_equipos e
   where e.empresa_id=p_empresa_id and e.local_id=p_local_id and e.id=p_equipo_id
   for update;
  v_found:=found;

  if not v_found and exists(select 1 from public.abc_local_equipos e where e.id=p_equipo_id) then
    raise exception 'equipo_id_en_uso';
  end if;
  if exists(
    select 1 from public.abc_local_equipos e
     where e.empresa_id=p_empresa_id and e.local_id=p_local_id
       and lower(btrim(e.nombre))=lower(v_nombre) and e.id<>p_equipo_id
  ) then
    raise exception 'equipo_nombre_duplicado';
  end if;

  v_nuevo:=jsonb_build_object(
    'tipo',v_tipo,'nombre',v_nombre,'referencia',v_ref,'terminal_id',p_terminal_id,'activo',p_activo,'notas',v_notas
  );

  if not v_found then
    v_creado:=true;
    v_cambio:=true;
    insert into public.abc_local_equipos(
      id,empresa_id,local_id,tipo,nombre,referencia,terminal_id,activo,notas,version,created_by,updated_by
    ) values (
      p_equipo_id,p_empresa_id,p_local_id,v_tipo,v_nombre,v_ref,p_terminal_id,p_activo,v_notas,1,auth.uid(),auth.uid()
    );
    v_version:=1;
    insert into public.abc_eventos(
      empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
      payload,actor_user_id,terminal_id,occurred_at,operating_day
    ) values (
      p_empresa_id,p_local_id,p_operation_id,'EQUIPO_LOCAL',p_equipo_id::text,'EQUIPO_LOCAL_REGISTRADO',
      jsonb_build_object('equipo',v_nuevo,'version',1,'motivo',v_motivo),
      auth.uid(),null,now(),private.abc_config_dia_evento(p_empresa_id,p_local_id)
    );
  else
    v_creado:=false;
    if v_prev.tipo<>v_tipo then raise exception 'equipo_tipo_inmutable'; end if;
    v_anterior:=jsonb_build_object(
      'tipo',v_prev.tipo,'nombre',v_prev.nombre,'referencia',v_prev.referencia,'terminal_id',v_prev.terminal_id,
      'activo',v_prev.activo,'notas',v_prev.notas
    );
    v_cambio:=v_anterior is distinct from v_nuevo;
    if not v_cambio then
      v_version:=v_prev.version;
    else
      update public.abc_local_equipos
         set nombre=v_nombre,referencia=v_ref,terminal_id=p_terminal_id,activo=p_activo,notas=v_notas,
             version=version+1,updated_by=auth.uid(),updated_at=now()
       where id=v_prev.id
      returning version into v_version;
      insert into public.abc_eventos(
        empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
        payload,actor_user_id,terminal_id,occurred_at,operating_day
      ) values (
        p_empresa_id,p_local_id,p_operation_id,'EQUIPO_LOCAL',p_equipo_id::text,'EQUIPO_LOCAL_ACTUALIZADO',
        jsonb_build_object('anterior',v_anterior,'nuevo',v_nuevo,'version',v_version,'motivo',v_motivo),
        auth.uid(),null,now(),private.abc_config_dia_evento(p_empresa_id,p_local_id)
      );
    end if;
  end if;

  v_result:=jsonb_build_object(
    'ok',true,'equipo_id',p_equipo_id,'creado',v_creado,'cambio',v_cambio,'version',v_version,'equipo',v_nuevo
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

-- 3. Listar los equipos de un local (cualquier miembro del local).
create function public.abc_listar_equipos_local(
  p_empresa_id text,
  p_local_id text,
  p_incluir_inactivos boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null
     or nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or not coalesce(private.la_tiene_local(p_empresa_id,p_local_id),false) then
    raise exception 'abc_config_no_autorizado';
  end if;

  return jsonb_build_object(
    'equipos',
    coalesce(
      (select jsonb_agg(
                jsonb_build_object(
                  'id',e.id,'tipo',e.tipo,'nombre',e.nombre,'referencia',e.referencia,
                  'terminal_id',e.terminal_id,'terminal_nombre',t.nombre,
                  'activo',e.activo,'notas',e.notas,'version',e.version
                ) order by e.tipo,lower(btrim(e.nombre)),e.id)
         from public.abc_local_equipos e
         left join public.terminales_tpv t
           on t.empresa_id=e.empresa_id and t.local_id=e.local_id and t.id=e.terminal_id
        where e.empresa_id=p_empresa_id and e.local_id=p_local_id
          and (coalesce(p_incluir_inactivos,false) or e.activo)),
      '[]'::jsonb
    )
  );
end $$;

revoke all on function public.abc_configurar_equipo_local(text,text,text,uuid,text,text,text,uuid,boolean,text,text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_listar_equipos_local(text,text,boolean)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_configurar_equipo_local(text,text,text,uuid,text,text,text,uuid,boolean,text,text) to authenticated;
grant execute on function public.abc_listar_equipos_local(text,text,boolean) to authenticated;
