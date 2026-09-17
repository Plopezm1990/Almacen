-- P2 · PM11 · sustrato Personal post-reset
-- Candidato GitHub-only. Restaura empleados, helpers de alcance, ciclo de vida
-- y auditoría tenant-aware. PM13, RLS final de perfiles/KV y limpieza legacy
-- permanecen como paquetes posteriores.

begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $preflight$
declare v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.empresas') is null then v_missing:=array_append(v_missing,'empresas'); end if;
  if to_regclass('public.locales') is null then v_missing:=array_append(v_missing,'locales'); end if;
  if to_regclass('public.membresias_usuario') is null then v_missing:=array_append(v_missing,'membresias_usuario'); end if;
  if to_regclass('public.perfiles') is null then v_missing:=array_append(v_missing,'perfiles'); end if;
  if to_regclass('public.auditoria_registro') is null then v_missing:=array_append(v_missing,'auditoria_registro'); end if;
  if to_regprocedure('auth.uid()') is null then v_missing:=array_append(v_missing,'auth.uid'); end if;
  if to_regprocedure('private.la_usuario_activo()') is null then v_missing:=array_append(v_missing,'la_usuario_activo'); end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then v_missing:=array_append(v_missing,'authenticated'); end if;
  if not exists(select 1 from pg_roles where rolname='anon') then v_missing:=array_append(v_missing,'anon'); end if;
  if cardinality(v_missing)>0 then raise exception 'P2_PM11_PREFLIGHT_FALLO:%',array_to_string(v_missing,','); end if;

  if exists(
    select 1 from (values
      ('membresias_usuario','user_id','uuid'),('membresias_usuario','empresa_id','text'),
      ('membresias_usuario','local_id','text'),('membresias_usuario','todos_locales','boolean'),
      ('membresias_usuario','rol','text'),('membresias_usuario','activo','boolean'),
      ('locales','id','text'),('locales','empresa_id','text'),('locales','activo','boolean'),
      ('perfiles','user_id','uuid'),('perfiles','empleado_id','text'),('perfiles','activo','boolean'),
      ('auditoria_registro','empresa_id','text'),('auditoria_registro','local_id','text'),
      ('auditoria_registro','actor_user_id','uuid')
    ) r(t,c,d)
    where not exists(select 1 from information_schema.columns x
      where x.table_schema='public' and x.table_name=r.t and x.column_name=r.c and x.data_type=r.d)
  ) then raise exception 'P2_PM11_PREFLIGHT_FALLO:contrato_incompatible'; end if;
end $preflight$;

create table if not exists public.empleados(
  id text primary key,
  empresa_id text not null,
  local_id text not null,
  estado text not null default 'activo',
  nombre text,
  datos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  baja_at timestamptz,
  reactivado_at timestamptz,
  anonimizado_at timestamptz,
  constraint pm11_empleado_id_no_vacio check(nullif(btrim(id),'') is not null),
  constraint pm11_empleado_empresa_no_vacia check(nullif(btrim(empresa_id),'') is not null),
  constraint pm11_empleado_local_concreto check(nullif(btrim(local_id),'') is not null and upper(btrim(local_id)) not in('TODOS','TODOS LOS LOCALES')),
  constraint pm11_empleado_estado_valido check(estado in('activo','inactivo','anonimizado')),
  constraint pm11_empleado_nombre_segun_estado check((estado='anonimizado' and nombre is null) or (estado in('activo','inactivo') and nullif(btrim(nombre),'') is not null)),
  constraint pm11_empleado_baja_coherente check(estado<>'inactivo' or baja_at is not null),
  constraint pm11_empleado_anonimizacion_coherente check((estado='anonimizado' and baja_at is not null and anonimizado_at is not null) or (estado<>'anonimizado' and anonimizado_at is null)),
  constraint pm11_empleado_reactivacion_coherente check(reactivado_at is null or baja_at is not null)
);

do $shape$
begin
  if exists(
    select 1 from (values
      ('id','text'),('empresa_id','text'),('local_id','text'),('estado','text'),('nombre','text'),('datos','jsonb'),
      ('created_at','timestamp with time zone'),('updated_at','timestamp with time zone'),('baja_at','timestamp with time zone'),
      ('reactivado_at','timestamp with time zone'),('anonimizado_at','timestamp with time zone')
    ) r(c,d)
    where not exists(select 1 from information_schema.columns x where x.table_schema='public' and x.table_name='empleados' and x.column_name=r.c and x.data_type=r.d)
  ) then raise exception 'P2_PM11_PREFLIGHT_FALLO:empleados_incompatible'; end if;
end $shape$;

create index if not exists pm11_empleados_scope_estado on public.empleados(empresa_id,local_id,estado,id);

create or replace function private.pm11_local_pertenece_empresa(p_empresa_id text,p_local_id text)
returns boolean language sql stable security definer set search_path=''
as $$ select nullif(btrim(p_empresa_id),'') is not null and nullif(btrim(p_local_id),'') is not null
  and upper(btrim(p_local_id)) not in('TODOS','TODOS LOS LOCALES')
  and exists(select 1 from public.locales l where l.id=p_local_id and l.empresa_id=p_empresa_id); $$;

create or replace function private.pm11_local_activo(p_empresa_id text,p_local_id text)
returns boolean language sql stable security definer set search_path=''
as $$ select private.pm11_local_pertenece_empresa(p_empresa_id,p_local_id)
  and exists(select 1 from public.locales l where l.id=p_local_id and l.empresa_id=p_empresa_id and l.activo=true); $$;

create or replace function private.pm11_puede_ver_personal(p_empresa_id text,p_local_id text)
returns boolean language sql stable security definer set search_path=''
as $$ select private.la_usuario_activo() and private.pm11_local_pertenece_empresa(p_empresa_id,p_local_id)
  and exists(select 1 from public.membresias_usuario m where m.user_id=(select auth.uid()) and m.empresa_id=p_empresa_id and m.activo=true
    and ((m.rol='Propietario' and (m.todos_locales=true or m.local_id=p_local_id)) or (m.rol='Encargado' and m.todos_locales=false and m.local_id=p_local_id))); $$;

create or replace function private.pm11_puede_mutar_personal(p_empresa_id text,p_local_id text)
returns boolean language sql stable security definer set search_path=''
as $$ select private.la_usuario_activo() and private.pm11_local_activo(p_empresa_id,p_local_id)
  and exists(select 1 from public.membresias_usuario m where m.user_id=(select auth.uid()) and m.empresa_id=p_empresa_id and m.activo=true
    and ((m.rol='Propietario' and (m.todos_locales=true or m.local_id=p_local_id)) or (m.rol='Encargado' and m.todos_locales=false and m.local_id=p_local_id))); $$;

create or replace function private.pm11_puede_migrar_personal(p_empresa_id text,p_local_id text)
returns boolean language sql stable security definer set search_path=''
as $$ select private.la_usuario_activo() and private.pm11_local_activo(p_empresa_id,p_local_id)
  and exists(select 1 from public.membresias_usuario m where m.user_id=(select auth.uid()) and m.empresa_id=p_empresa_id and m.activo=true and m.rol='Propietario'
    and (m.todos_locales=true or m.local_id=p_local_id)); $$;

create or replace function private.pm11_validar_datos_laborales(p_datos jsonb)
returns void language plpgsql immutable set search_path='pg_catalog'
as $$ declare v_key text; v_text text; v_num numeric; begin
  if p_datos is null or jsonb_typeof(p_datos)<>'object' then raise exception 'empleado_datos_invalidos'; end if;
  foreach v_key in array array['horasSemanales','pagas','salarioBrutoMensual','costeEmpresaMensual','diasVacacionesAnuales'] loop
    if not(p_datos?v_key) or p_datos->v_key='null'::jsonb then continue; end if;
    v_text:=btrim(p_datos->>v_key); if v_text='' then continue; end if;
    begin v_num:=v_text::numeric; exception when others then raise exception 'empleado_numero_no_finito:%',v_key; end;
    if lower(v_num::text) in('nan','infinity','-infinity') then raise exception 'empleado_numero_no_finito:%',v_key; end if;
    if v_key='pagas' then if v_num<=0 then raise exception 'empleado_valor_fuera_rango:%',v_key; end if;
    elsif v_num<0 then raise exception 'empleado_valor_fuera_rango:%',v_key; end if;
  end loop;
end $$;

create or replace function private.pm11_auditar_empleado(p_accion text,p_empleado_id text,p_empresa_id text,p_local_id text,p_detalle jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=''
as $$ declare v_id text:=pg_catalog.gen_random_uuid()::text; v_actor uuid:=(select auth.uid()); begin
  if v_actor is null then raise exception 'auditoria_actor_requerido'; end if;
  insert into public.auditoria_registro(id,fecha,datos,empresa_id,local_id,actor_user_id)
  values(v_id,current_date,jsonb_build_object('id',v_id,'accion',p_accion,'empleadoId',p_empleado_id,'empresaId',p_empresa_id,'localId',p_local_id,'actorUserId',v_actor)||coalesce(p_detalle,'{}'::jsonb),p_empresa_id,p_local_id,v_actor);
end $$;

create or replace function private.pm11_empleados_guard()
returns trigger language plpgsql set search_path=''
as $$ begin
  if new.id is distinct from old.id then raise exception 'empleado_id_inmutable'; end if;
  if new.empresa_id is distinct from old.empresa_id then raise exception 'empleado_empresa_inmutable'; end if;
  if new.local_id is distinct from old.local_id then raise exception 'empleado_local_cambio_requiere_traslado'; end if;
  if new.created_at is distinct from old.created_at then raise exception 'empleado_created_at_inmutable'; end if;
  if old.estado='activo' and new.estado not in('activo','inactivo') then raise exception 'empleado_transicion_estado_invalida';
  elsif old.estado='inactivo' and new.estado not in('inactivo','activo','anonimizado') then raise exception 'empleado_transicion_estado_invalida';
  elsif old.estado='anonimizado' and new.estado<>'anonimizado' then raise exception 'empleado_anonimizado_terminal'; end if;
  new.updated_at:=now(); return new;
end $$;

drop trigger if exists pm11_empleados_guard on public.empleados;
create trigger pm11_empleados_guard before update on public.empleados for each row execute function private.pm11_empleados_guard();

grant usage on schema private to authenticated;
revoke all on function private.pm11_local_pertenece_empresa(text,text) from public,anon,authenticated;
revoke all on function private.pm11_local_activo(text,text) from public,anon,authenticated;
revoke all on function private.pm11_puede_mutar_personal(text,text) from public,anon,authenticated;
revoke all on function private.pm11_puede_migrar_personal(text,text) from public,anon,authenticated;
revoke all on function private.pm11_validar_datos_laborales(jsonb) from public,anon,authenticated;
revoke all on function private.pm11_auditar_empleado(text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function private.pm11_empleados_guard() from public,anon,authenticated;
revoke all on function private.pm11_puede_ver_personal(text,text) from public,anon,authenticated;
grant execute on function private.pm11_puede_ver_personal(text,text) to authenticated;

alter table public.empleados enable row level security;
do $pol$ declare v record; begin
  for v in select policyname from pg_policies where schemaname='public' and tablename='empleados' loop
    execute format('drop policy %I on public.empleados',v.policyname);
  end loop;
end $pol$;
create policy pm11_empleados_select_gestion on public.empleados for select to authenticated using(private.pm11_puede_ver_personal(empresa_id,local_id));
revoke all privileges on table public.empleados from public,anon,authenticated;
grant select on table public.empleados to authenticated;

create or replace function public.pm11_alta_empleado(p_empresa_id text,p_local_id text,p_empleado_id text,p_nombre text,p_datos jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_empleado public.empleados%rowtype; v_datos jsonb; v_operation_id text:=nullif(btrim(coalesce(p_datos->>'pm13AltaOperationId','')),''); begin
  if (select auth.uid()) is null or not private.pm11_puede_mutar_personal(p_empresa_id,p_local_id) then raise exception 'personal_contexto_no_autorizado'; end if;
  if nullif(btrim(p_empleado_id),'') is null then raise exception 'empleado_id_requerido'; end if;
  if nullif(btrim(p_nombre),'') is null then raise exception 'empleado_nombre_requerido'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm11:empleado:alta:'||p_empresa_id||':'||p_local_id||':'||p_empleado_id,0));
  select * into v_empleado from public.empleados e where e.id=p_empleado_id for update;
  if found then
    if v_operation_id is not null and v_empleado.empresa_id=p_empresa_id and v_empleado.local_id=p_local_id and v_empleado.datos->>'pm13AltaOperationId'=v_operation_id then
      return jsonb_build_object('ok',true,'yaCreado',true,'empleado',to_jsonb(v_empleado));
    end if;
    raise exception 'empleado_id_ya_existe';
  end if;
  perform private.pm11_validar_datos_laborales(coalesce(p_datos,'{}'::jsonb));
  v_datos:=coalesce(p_datos,'{}'::jsonb)||jsonb_build_object('id',p_empleado_id,'empresaId',p_empresa_id,'localId',p_local_id,'nombre',btrim(p_nombre),'activo',true,'estado','activo');
  insert into public.empleados(id,empresa_id,local_id,estado,nombre,datos) values(p_empleado_id,p_empresa_id,p_local_id,'activo',btrim(p_nombre),v_datos) returning * into v_empleado;
  perform private.pm11_auditar_empleado('Personal · alta empleado',p_empleado_id,p_empresa_id,p_local_id,jsonb_build_object('estadoNuevo','activo','operationIdInformado',v_operation_id is not null));
  return jsonb_build_object('ok',true,'yaCreado',false,'empleado',to_jsonb(v_empleado));
end $$;

create or replace function public.pm11_editar_empleado(p_empresa_id text,p_local_id text,p_empleado_id text,p_cambios jsonb default '{}'::jsonb,p_nombre text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_empleado public.empleados%rowtype; v_nombre text; v_datos jsonb; v_campos jsonb; begin
  if (select auth.uid()) is null or not private.pm11_puede_mutar_personal(p_empresa_id,p_local_id) then raise exception 'personal_contexto_no_autorizado'; end if;
  if p_cambios is null or jsonb_typeof(p_cambios)<>'object' then raise exception 'empleado_cambios_invalidos'; end if;
  select * into v_empleado from public.empleados e where e.id=p_empleado_id for update;
  if not found then raise exception 'empleado_no_encontrado'; end if;
  if v_empleado.empresa_id<>p_empresa_id or v_empleado.local_id<>p_local_id then raise exception 'empleado_contexto_no_coincide'; end if;
  if v_empleado.estado<>'activo' then raise exception 'empleado_no_activo'; end if;
  v_nombre:=case when p_nombre is null then v_empleado.nombre else btrim(p_nombre) end;
  if nullif(v_nombre,'') is null then raise exception 'empleado_nombre_requerido'; end if;
  v_datos:=v_empleado.datos||p_cambios||jsonb_build_object('id',v_empleado.id,'empresaId',v_empleado.empresa_id,'localId',v_empleado.local_id,'nombre',v_nombre,'activo',true,'estado','activo');
  perform private.pm11_validar_datos_laborales(v_datos);
  if v_nombre is not distinct from v_empleado.nombre and v_datos is not distinct from v_empleado.datos then return jsonb_build_object('ok',true,'yaSinCambios',true,'empleado',to_jsonb(v_empleado)); end if;
  update public.empleados set nombre=v_nombre,datos=v_datos where id=v_empleado.id returning * into v_empleado;
  select coalesce(jsonb_agg(k order by k),'[]'::jsonb) into v_campos from jsonb_object_keys(p_cambios) k;
  perform private.pm11_auditar_empleado('Personal · editar empleado',v_empleado.id,v_empleado.empresa_id,v_empleado.local_id,jsonb_build_object('campos',v_campos,'nombreModificado',p_nombre is not null));
  return jsonb_build_object('ok',true,'yaSinCambios',false,'empleado',to_jsonb(v_empleado));
end $$;

create or replace function public.pm11_baja_empleado(p_empresa_id text,p_local_id text,p_empleado_id text,p_motivo text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_empleado public.empleados%rowtype; v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),''); v_datos jsonb; begin
  if (select auth.uid()) is null or not private.pm11_puede_mutar_personal(p_empresa_id,p_local_id) then raise exception 'personal_contexto_no_autorizado'; end if;
  select * into v_empleado from public.empleados e where e.id=p_empleado_id for update;
  if not found then raise exception 'empleado_no_encontrado'; end if;
  if v_empleado.empresa_id<>p_empresa_id or v_empleado.local_id<>p_local_id then raise exception 'empleado_contexto_no_coincide'; end if;
  if v_empleado.estado='inactivo' then return jsonb_build_object('ok',true,'yaBaja',true,'empleado',to_jsonb(v_empleado)); end if;
  if v_empleado.estado<>'activo' then raise exception 'empleado_baja_estado_invalido'; end if;
  v_datos:=v_empleado.datos||jsonb_build_object('activo',false,'estado','inactivo','fechaBaja',current_date::text);
  if v_motivo is not null then v_datos:=v_datos||jsonb_build_object('motivoBaja',v_motivo); end if;
  update public.empleados set estado='inactivo',baja_at=now(),datos=v_datos where id=v_empleado.id returning * into v_empleado;
  perform private.pm11_auditar_empleado('Personal · baja empleado',v_empleado.id,v_empleado.empresa_id,v_empleado.local_id,jsonb_build_object('estadoAnterior','activo','estadoNuevo','inactivo','motivoInformado',v_motivo is not null));
  return jsonb_build_object('ok',true,'yaBaja',false,'empleado',to_jsonb(v_empleado));
end $$;

create or replace function public.pm11_reactivar_empleado(p_empresa_id text,p_local_id text,p_empleado_id text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_empleado public.empleados%rowtype; begin
  if (select auth.uid()) is null or not private.pm11_puede_mutar_personal(p_empresa_id,p_local_id) then raise exception 'personal_contexto_no_autorizado'; end if;
  select * into v_empleado from public.empleados e where e.id=p_empleado_id for update;
  if not found then raise exception 'empleado_no_encontrado'; end if;
  if v_empleado.empresa_id<>p_empresa_id or v_empleado.local_id<>p_local_id then raise exception 'empleado_contexto_no_coincide'; end if;
  if v_empleado.estado='activo' then return jsonb_build_object('ok',true,'yaActivo',true,'empleado',to_jsonb(v_empleado)); end if;
  if v_empleado.estado<>'inactivo' then raise exception 'empleado_reactivacion_estado_invalido'; end if;
  update public.empleados set estado='activo',reactivado_at=now(),datos=(datos-'fechaBaja'-'motivoBaja')||jsonb_build_object('activo',true,'estado','activo') where id=v_empleado.id returning * into v_empleado;
  perform private.pm11_auditar_empleado('Personal · reactivar empleado',v_empleado.id,v_empleado.empresa_id,v_empleado.local_id,jsonb_build_object('estadoAnterior','inactivo','estadoNuevo','activo'));
  return jsonb_build_object('ok',true,'yaActivo',false,'empleado',to_jsonb(v_empleado));
end $$;

revoke all on function public.pm11_alta_empleado(text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.pm11_editar_empleado(text,text,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.pm11_baja_empleado(text,text,text,text) from public,anon,authenticated;
revoke all on function public.pm11_reactivar_empleado(text,text,text) from public,anon,authenticated;
grant execute on function public.pm11_alta_empleado(text,text,text,text,jsonb) to authenticated;
grant execute on function public.pm11_editar_empleado(text,text,text,jsonb,text) to authenticated;
grant execute on function public.pm11_baja_empleado(text,text,text,text) to authenticated;
grant execute on function public.pm11_reactivar_empleado(text,text,text) to authenticated;

do $post$
begin
  if to_regclass('public.empleados') is null then raise exception 'P2_PM11_POSTFLIGHT:empleados'; end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename='empleados')<>1 then raise exception 'P2_PM11_POSTFLIGHT:rls_count'; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='empleados' and policyname<>'pm11_empleados_select_gestion') then raise exception 'P2_PM11_POSTFLIGHT:rls_name'; end if;
  if has_table_privilege('anon','public.empleados','SELECT') or has_table_privilege('anon','public.empleados','INSERT') then raise exception 'P2_PM11_POSTFLIGHT:anon'; end if;
  if not has_table_privilege('authenticated','public.empleados','SELECT') then raise exception 'P2_PM11_POSTFLIGHT:select'; end if;
  if has_table_privilege('authenticated','public.empleados','INSERT') or has_table_privilege('authenticated','public.empleados','UPDATE') or has_table_privilege('authenticated','public.empleados','DELETE') then raise exception 'P2_PM11_POSTFLIGHT:direct_write'; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
    ((n.nspname='private' and p.proname in('pm11_local_pertenece_empresa','pm11_local_activo','pm11_puede_ver_personal','pm11_puede_mutar_personal','pm11_puede_migrar_personal','pm11_auditar_empleado'))
      or (n.nspname='public' and p.proname in('pm11_alta_empleado','pm11_editar_empleado','pm11_baja_empleado','pm11_reactivar_empleado')))
    and array_to_string(coalesce(p.proconfig,array[]::text[]),',') not like '%search_path=""%') then raise exception 'P2_PM11_POSTFLIGHT:search_path'; end if;
end $post$;

commit;