-- ABC · capa de configuración por empresa y local, PIEZA 3 (solo QA hasta que Pedro autorice otra cosa).
--
-- Decisión de Pedro (2/10/2026, hoja F1): D02 «todas las modalidades que se puedan seleccionar; cada empresa o
-- cada local usa las suyas». Inventario y diseño en docs/plan-abc/F6_INVENTARIO_CAPA_CONFIGURACION_2026-10-02.md.
--
-- Qué hace (aditiva; no cambia ninguna función existente ni ningún dato al aplicarse):
--  1. Tabla `abc_local_modalidades` (sin acceso directo): decisiones explícitas del propietario sobre qué
--     modalidades de cuenta (BARRA, MESA, TERRAZA, TAKEAWAY, OTRO) tiene habilitadas cada local. **Sin fila,
--     la modalidad está habilitada**: el comportamiento de hoy no cambia hasta que un propietario decide.
--  2. `abc_configurar_modalidad_local`: solo el Propietario de la empresa; habilita o deshabilita una modalidad
--     de un local, con motivo y `operation_id` idempotente. Siempre queda al menos una modalidad habilitada.
--     Deshabilitar no cierra ni toca las cuentas ya abiertas en esa modalidad: solo impide abrir nuevas o
--     cambiar a ella una cuenta existente.
--  3. `abc_obtener_modalidades_local`: cualquier miembro del local lee las cinco modalidades con su estado.
--  4. Guarda en `cuentas_comerciales` (trigger): `modalidad_no_habilitada:<MODALIDAD>` al crear una cuenta en
--     una modalidad deshabilitada o al cambiar la modalidad de una cuenta a una deshabilitada (por ejemplo, al
--     asignarla a una mesa o a la terraza). Vale para cualquier camino. Un cambio que no modifica la modalidad
--     no se comprueba, y la repetición idempotente de una apertura anterior sigue devolviendo su resultado.
--  Cada cambio real deja un evento en `abc_eventos` (MODALIDAD_LOCAL_CONFIGURADA) con valor anterior, nuevo,
--  motivo, actor y cuántas cuentas abiertas había en esa modalidad.
--
-- Efecto conocido: la pantalla actual abre siempre las cuentas en BARRA; un local que deshabilite BARRA no
-- podrá abrir cuentas desde ella hasta que la pantalla elija entre las modalidades habilitadas (pieza 6).
-- Esta pieza no implementa valores por defecto a nivel de empresa (solo por local).

set local lock_timeout = '10s';

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.locales') is null then v_missing:=array_append(v_missing,'locales'); end if;
  if to_regclass('public.cuentas_comerciales') is null then v_missing:=array_append(v_missing,'cuentas_comerciales'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.la_tiene_local(text,text)') is null then v_missing:=array_append(v_missing,'la_tiene_local'); end if;
  if to_regprocedure('private.abc_config_puede_configurar(text,text)') is null then v_missing:=array_append(v_missing,'abc_config_puede_configurar (pieza 1)'); end if;
  if to_regprocedure('private.abc_config_dia_evento(text,text)') is null then v_missing:=array_append(v_missing,'abc_config_dia_evento (pieza 1)'); end if;
  if to_regprocedure('public.abc_abrir_cuenta(text,text,text,uuid,text,text,uuid,uuid,uuid,date)') is null then v_missing:=array_append(v_missing,'abc_abrir_cuenta'); end if;
  if to_regprocedure('auth.uid()') is null then v_missing:=array_append(v_missing,'auth.uid'); end if;

  if cardinality(v_missing)>0 then
    raise exception 'ABC_CFG3_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if to_regclass('public.abc_local_modalidades') is not null
     or to_regprocedure('public.abc_configurar_modalidad_local(text,text,text,text,boolean,text)') is not null
     or to_regprocedure('public.abc_obtener_modalidades_local(text,text)') is not null
     or exists(select 1 from pg_trigger t where t.tgname='abc_f6_cfg3_guard_modalidad_cuenta') then
    raise exception 'ABC_CFG3_PREFLIGHT_FALLO: objetos de la pieza 3 ya existen';
  end if;
end $$;

-- 1. Decisiones del propietario por local y modalidad (sin acceso directo).
create table public.abc_local_modalidades (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  modalidad text not null,
  habilitada boolean not null,
  version bigint not null default 1,
  motivo text not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint abc_local_modalidad_local_fk foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint abc_local_modalidad_valor check (modalidad in ('BARRA','MESA','TERRAZA','TAKEAWAY','OTRO')),
  constraint abc_local_modalidad_motivo check (nullif(btrim(motivo),'') is not null),
  constraint abc_local_modalidad_version check (version>=1),
  constraint abc_local_modalidad_uq unique (empresa_id,local_id,modalidad)
);

alter table public.abc_local_modalidades enable row level security;
revoke all on table public.abc_local_modalidades from public,anon,authenticated,service_role;

comment on table public.abc_local_modalidades is
  'Modalidades de cuenta habilitadas por local (capa de configuración, pieza 3). Sin fila, la modalidad está habilitada. Sin acceso directo: abc_obtener_modalidades_local y abc_configurar_modalidad_local.';

-- 2. Ayudas privadas.
create function private.abc_modalidad_habilitada(
  p_empresa_id text,
  p_local_id text,
  p_modalidad text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(
    (select m.habilitada
       from public.abc_local_modalidades m
      where m.empresa_id=p_empresa_id
        and m.local_id=p_local_id
        and m.modalidad=p_modalidad),
    true
  )
$$;

create function private.abc_modalidades_habilitadas(
  p_empresa_id text,
  p_local_id text
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(jsonb_agg(t.m order by t.ord),'[]'::jsonb)
    from unnest(array['BARRA','MESA','TERRAZA','TAKEAWAY','OTRO']) with ordinality as t(m,ord)
   where private.abc_modalidad_habilitada(p_empresa_id,p_local_id,t.m)
$$;

-- 3. Habilitar o deshabilitar una modalidad en un local (solo el Propietario).
create function public.abc_configurar_modalidad_local(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_modalidad text,
  p_habilitada boolean,
  p_motivo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_modalidad text:=upper(btrim(coalesce(p_modalidad,'')));
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_request jsonb;
  v_cmd jsonb;
  v_prev public.abc_local_modalidades%rowtype;
  v_found boolean;
  v_antes boolean;
  v_version bigint;
  v_restantes integer;
  v_abiertas integer;
  v_cambio boolean;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_config_puede_configurar(p_empresa_id,p_local_id) then
    raise exception 'abc_config_no_autorizado';
  end if;
  if v_modalidad not in ('BARRA','MESA','TERRAZA','TAKEAWAY','OTRO') then raise exception 'modalidad_invalida'; end if;
  if p_habilitada is null then raise exception 'modalidad_estado_requerido'; end if;
  if v_motivo is null then raise exception 'modalidad_motivo_requerido'; end if;
  if not exists(
    select 1 from public.locales l
     where l.empresa_id=p_empresa_id and l.id=p_local_id and l.activo=true
  ) then
    raise exception 'modalidad_local_no_disponible';
  end if;

  v_request:=jsonb_build_object('modalidad',v_modalidad,'habilitada',p_habilitada,'motivo',v_motivo);
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIGURAR_MODALIDAD_LOCAL',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  perform pg_advisory_xact_lock(hashtext('abc_modalidades:'||p_empresa_id||'/'||p_local_id));

  select * into v_prev
    from public.abc_local_modalidades m
   where m.empresa_id=p_empresa_id and m.local_id=p_local_id and m.modalidad=v_modalidad
   for update;
  v_found:=found;
  v_antes:=case when v_found then v_prev.habilitada else true end;

  select count(*) into v_abiertas
    from public.cuentas_comerciales c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id
     and c.modalidad=v_modalidad and c.estado='ABIERTA';

  v_cambio:=v_antes<>p_habilitada;
  if not v_cambio then
    v_version:=case when v_found then v_prev.version else 0 end;
  else
    if not p_habilitada then
      select count(*) into v_restantes
        from unnest(array['BARRA','MESA','TERRAZA','TAKEAWAY','OTRO']) as t(m)
       where t.m<>v_modalidad
         and private.abc_modalidad_habilitada(p_empresa_id,p_local_id,t.m);
      if v_restantes=0 then raise exception 'modalidades_minimo_una'; end if;
    end if;

    if v_found then
      update public.abc_local_modalidades
         set habilitada=p_habilitada, version=version+1, motivo=v_motivo,
             updated_by=auth.uid(), updated_at=now()
       where id=v_prev.id
      returning version into v_version;
    else
      insert into public.abc_local_modalidades(empresa_id,local_id,modalidad,habilitada,version,motivo,updated_by)
      values (p_empresa_id,p_local_id,v_modalidad,p_habilitada,1,v_motivo,auth.uid());
      v_version:=1;
    end if;

    insert into public.abc_eventos(
      empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
      payload,actor_user_id,terminal_id,occurred_at,operating_day
    ) values (
      p_empresa_id,p_local_id,p_operation_id,'LOCAL_CONFIG','modalidad:'||v_modalidad,'MODALIDAD_LOCAL_CONFIGURADA',
      jsonb_build_object(
        'modalidad',v_modalidad,
        'anterior',v_antes,
        'nuevo',p_habilitada,
        'version',v_version,
        'motivo',v_motivo,
        'cuentas_abiertas',v_abiertas
      ),
      auth.uid(),null,now(),private.abc_config_dia_evento(p_empresa_id,p_local_id)
    );
  end if;

  v_result:=jsonb_build_object(
    'ok',true,'modalidad',v_modalidad,'habilitada',p_habilitada,'version',v_version,'cambio',v_cambio,
    'cuentas_abiertas',v_abiertas,
    'habilitadas',private.abc_modalidades_habilitadas(p_empresa_id,p_local_id)
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

-- 4. Leer las modalidades de un local (cualquier miembro del local).
create function public.abc_obtener_modalidades_local(
  p_empresa_id text,
  p_local_id text
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
    'modalidades',
    (select jsonb_agg(
              jsonb_build_object(
                'modalidad',t.m,
                'habilitada',coalesce(r.habilitada,true),
                'origen',case when r.id is null then 'defecto' else 'local' end,
                'version',coalesce(r.version,0)
              ) order by t.ord)
       from unnest(array['BARRA','MESA','TERRAZA','TAKEAWAY','OTRO']) with ordinality as t(m,ord)
       left join public.abc_local_modalidades r
         on r.empresa_id=p_empresa_id and r.local_id=p_local_id and r.modalidad=t.m),
    'habilitadas',private.abc_modalidades_habilitadas(p_empresa_id,p_local_id)
  );
end $$;

-- 5. Guarda: no se crea una cuenta en una modalidad deshabilitada ni se cambia a ella una cuenta existente.
create function private.abc_modalidad_guard_cuenta()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op='INSERT' or new.modalidad is distinct from old.modalidad then
    if not private.abc_modalidad_habilitada(new.empresa_id,new.local_id,new.modalidad) then
      raise exception 'modalidad_no_habilitada:%',new.modalidad;
    end if;
  end if;
  return new;
end $$;

create trigger abc_f6_cfg3_guard_modalidad_cuenta
before insert or update of modalidad on public.cuentas_comerciales
for each row execute function private.abc_modalidad_guard_cuenta();

revoke all on function private.abc_modalidad_habilitada(text,text,text) from public,anon,authenticated,service_role;
revoke all on function private.abc_modalidades_habilitadas(text,text) from public,anon,authenticated,service_role;
revoke all on function private.abc_modalidad_guard_cuenta() from public,anon,authenticated,service_role;
revoke all on function public.abc_configurar_modalidad_local(text,text,text,text,boolean,text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_obtener_modalidades_local(text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_configurar_modalidad_local(text,text,text,text,boolean,text) to authenticated;
grant execute on function public.abc_obtener_modalidades_local(text,text) to authenticated;
