-- C07-C complemento: aceptación de invitación y permisos efectivos del panel.
-- La aceptación solo prueba la identidad de la cuenta; no acredita representación.
begin;

create function private.abc_fiscal_delegacion_puede(
  p_empresa text, p_local text, p_entidad uuid, p_permiso text
)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.abc_fiscal_delegacion_propietario(p_empresa,p_local,p_entidad)
    or exists (
      select 1 from private.abc_fiscal_delegaciones d
      where d.empresa_id=p_empresa and d.entidad_fiscal_id=p_entidad
        and d.aceptada_por=auth.uid() and d.estado='ACEPTADA'
        and d.expira_at > now()
        and (p_permiso='CONSULTAR' or d.permiso=p_permiso)
        and exists (select 1 from public.entidad_fiscal_locales el
          where el.empresa_id=p_empresa and el.entidad_fiscal_id=p_entidad
            and el.local_id=p_local and el.activa)
    );
$$;

create or replace function private.abc_fiscal_config_acceso(p_empresa text, p_local text, p_entidad uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.abc_fiscal_delegacion_puede(p_empresa,p_local,p_entidad,'CONSULTAR');
$$;

create function private.abc_fiscal_config_puede_guardar(p_empresa text, p_local text, p_entidad uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.abc_fiscal_delegacion_puede(p_empresa,p_local,p_entidad,'PROPONER');
$$;

create function public.abc_fiscal_aceptar_delegacion(p_operation_id uuid, p_delegacion_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare d private.abc_fiscal_delegaciones%rowtype; v_email text; v_result jsonb; v_prev private.abc_fiscal_delegacion_revisiones%rowtype; v_version bigint;
begin
  if auth.uid() is null or p_operation_id is null or p_delegacion_id is null then raise exception 'FISCAL_DELEGACION_PARAMETROS_INVALIDOS'; end if;
  select * into d from private.abc_fiscal_delegaciones where id=p_delegacion_id for update;
  if not found then raise exception 'FISCAL_DELEGACION_NO_ENCONTRADA'; end if;
  select lower(email) into v_email from auth.users where id=auth.uid();
  if v_email is null or v_email<>d.invitado_email then raise exception 'FISCAL_DELEGACION_IDENTIDAD_NO_COINCIDE' using errcode='42501'; end if;
  if d.estado='INVITADA' and d.expira_at<=now() then update private.abc_fiscal_delegaciones set estado='CADUCADA',actualizada_at=now() where id=d.id; raise exception 'FISCAL_DELEGACION_CADUCADA'; end if;
  if d.estado<>'INVITADA' then raise exception 'FISCAL_DELEGACION_ESTADO_INVALIDO'; end if;
  select * into v_prev from private.abc_fiscal_delegacion_revisiones where operation_id=p_operation_id;
  if found then return v_prev.resultado; end if;
  select coalesce(max(version),0)+1 into v_version from private.abc_fiscal_delegacion_revisiones where delegacion_id=d.id;
  update private.abc_fiscal_delegaciones set estado='ACEPTADA',aceptada_at=now(),aceptada_por=auth.uid(),actualizada_at=now() where id=d.id;
  v_result := jsonb_build_object('id',d.id,'empresa_id',d.empresa_id,'entidad_fiscal_id',d.entidad_fiscal_id,'permiso',d.permiso,'estado','ACEPTADA','aceptada_at',(select aceptada_at from private.abc_fiscal_delegaciones where id=d.id),'emision_habilitada',false);
  insert into private.abc_fiscal_delegacion_revisiones(delegacion_id,version,operation_id,accion,request,resultado,actor_user_id)
    values(d.id,v_version,p_operation_id,'ACEPTAR',jsonb_build_object('id',d.id),v_result,auth.uid());
  return v_result;
end $$;

create or replace function public.abc_fiscal_guardar_borrador(
  p_operation_id uuid, p_empresa_id text, p_local_id text, p_entidad_fiscal_id uuid,
  p_version_esperada bigint, p_configuracion jsonb
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare c jsonb; req jsonb; prev private.abc_fiscal_borrador_revisiones%rowtype; b private.abc_fiscal_borradores%rowtype; res jsonb;
begin
  if not coalesce(private.abc_fiscal_config_puede_guardar(p_empresa_id,p_local_id,p_entidad_fiscal_id),false) then
    raise exception 'FISCAL_CONFIG_NO_AUTORIZADO' using errcode = '42501';
  end if;
  if p_operation_id is null or p_version_esperada is null or p_version_esperada < 0 then raise exception 'FISCAL_CONFIG_VERSION_REQUERIDA'; end if;
  c := private.abc_fiscal_config_normalizar(p_configuracion);
  req := jsonb_build_object('configuracion',c,'version_esperada',p_version_esperada);
  perform pg_advisory_xact_lock(hashtextextended(jsonb_build_array('fiscal-config',p_empresa_id,p_entidad_fiscal_id)::text,0));
  select * into prev from private.abc_fiscal_borrador_revisiones where empresa_id=p_empresa_id and entidad_fiscal_id=p_entidad_fiscal_id and operation_id=p_operation_id;
  if found then
    if prev.request is distinct from req then raise exception 'FISCAL_CONFIG_OPERATION_CONFLICT'; end if;
    return prev.resultado;
  end if;
  select * into b from private.abc_fiscal_borradores where empresa_id=p_empresa_id and entidad_fiscal_id=p_entidad_fiscal_id for update;
  if coalesce(b.version,0) <> p_version_esperada then raise exception 'FISCAL_CONFIG_VERSION_OBSOLETA'; end if;
  insert into private.abc_fiscal_borradores(empresa_id,entidad_fiscal_id,version,configuracion,updated_by)
    values(p_empresa_id,p_entidad_fiscal_id,p_version_esperada+1,c,auth.uid())
    on conflict (empresa_id,entidad_fiscal_id) do update set version=excluded.version,configuracion=excluded.configuracion,updated_at=now(),updated_by=excluded.updated_by;
  res := public.abc_fiscal_leer_borrador(p_empresa_id,p_local_id,p_entidad_fiscal_id);
  insert into private.abc_fiscal_borrador_revisiones(empresa_id,entidad_fiscal_id,version,operation_id,request,resultado,actor_user_id)
    values(p_empresa_id,p_entidad_fiscal_id,p_version_esperada+1,p_operation_id,req,res,auth.uid());
  return res;
end $$;

revoke all on function private.abc_fiscal_delegacion_puede(text,text,uuid,text) from public,anon,authenticated,service_role;
revoke all on function private.abc_fiscal_config_acceso(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.abc_fiscal_config_puede_guardar(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.abc_fiscal_aceptar_delegacion(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.abc_fiscal_guardar_borrador(uuid,text,text,uuid,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.abc_fiscal_aceptar_delegacion(uuid,uuid) to authenticated;
grant execute on function public.abc_fiscal_guardar_borrador(uuid,text,text,uuid,bigint,jsonb) to authenticated;

commit;
