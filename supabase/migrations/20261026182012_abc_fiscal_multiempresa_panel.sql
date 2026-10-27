-- C07-B: lectura segura de emisores para el panel fiscal multiempresa y
-- compatibilidad de los borradores con la purga controlada de una empresa.
-- No habilita emision fiscal, no acepta secretos y no conecta con la AEAT.
begin;

do $$
begin
  if to_regclass('private.abc_fiscal_borradores') is null
    or to_regprocedure('private.abc_fiscal_config_acceso(text,text,uuid)') is null
    or to_regprocedure('public.abc_fiscal_leer_borrador(text,text,uuid)') is null then
    raise exception 'FISCAL_CONFIG_PANEL_DEPENDENCIAS_AUSENTES';
  end if;
end $$;

create or replace function private.abc_fiscal_config_acceso(p_empresa text, p_local text, p_entidad uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and coalesce(private.abc_tiene_capacidad(p_empresa,p_local,'ABC_EMISOR_CAMBIAR'),false)
    and exists (select 1 from public.membresias_usuario m
      where m.user_id=auth.uid() and m.empresa_id=p_empresa and m.activo
        and m.rol='Propietario' and m.todos_locales and m.local_id is null)
    and exists (select 1 from public.empresas emp where emp.id=p_empresa and emp.activo)
    and exists (select 1 from public.locales l
      where l.empresa_id=p_empresa and l.id=p_local and l.activo)
    and exists (select 1 from public.entidades_fiscales e
      join public.entidad_fiscal_locales el
        on el.empresa_id = e.empresa_id and el.entidad_fiscal_id = e.id and el.activa
      where e.empresa_id = p_empresa and e.id = p_entidad and e.activa
        and el.local_id = p_local);
$$;

create or replace function public.abc_fiscal_listar_emisores(p_empresa_id text, p_local_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  emisores jsonb;
begin
  if auth.uid() is null
     or not exists (select 1 from public.membresias_usuario m
       where m.user_id=auth.uid() and m.empresa_id=p_empresa_id and m.activo
         and m.rol='Propietario' and m.todos_locales and m.local_id is null)
     or not exists (select 1 from public.empresas emp where emp.id=p_empresa_id and emp.activo)
     or not exists (select 1 from public.locales l
       where l.empresa_id=p_empresa_id and l.id=p_local_id and l.activo) then
    raise exception 'FISCAL_CONFIG_NO_AUTORIZADO' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'nombre_legal',e.nombre_legal,'nif',e.identificador_fiscal,
      'pais',e.country_code,'simulada',e.simulada,'version_emisor',e.version,
      'estado','BORRADOR','conexion','NO_CONFIGURADA','emision_habilitada',false
    ) order by e.nombre_legal,e.id),'[]'::jsonb) into emisores
    from public.entidades_fiscales e
    join public.entidad_fiscal_locales el
      on el.empresa_id=e.empresa_id and el.entidad_fiscal_id=e.id and el.activa
    where e.empresa_id=p_empresa_id and e.activa and el.local_id=p_local_id;
  return jsonb_build_object('empresa_id',p_empresa_id,'local_id',p_local_id,'emisores',emisores);
end $$;

-- Las revisiones siguen siendo inmutables para la aplicacion. La unica excepcion
-- es la purga definitiva ya protegida por administrador, empresa desactivada,
-- plazo de gracia, copia/motivo, nombre exacto y codigo de un solo uso.
create or replace function private.abc_fiscal_borrador_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  es_admin boolean := false;
begin
  if tg_op = 'DELETE' then
    if to_regprocedure('private.es_admin_plataforma()') is not null then
      execute 'select private.es_admin_plataforma()' into es_admin;
    end if;
    if coalesce(es_admin,false)
      and exists (select 1 from public.empresas e where e.id=old.empresa_id and not e.activo) then
      return old;
    end if;
    raise exception 'FISCAL_CONFIG_HISTORIAL_INMUTABLE';
  end if;
  if tg_table_name = 'abc_fiscal_borrador_revisiones' then
    raise exception 'FISCAL_CONFIG_HISTORIAL_INMUTABLE';
  end if;
  if old.empresa_id is distinct from new.empresa_id
    or old.entidad_fiscal_id is distinct from new.entidad_fiscal_id then
    raise exception 'FISCAL_CONFIG_ALCANCE_INMUTABLE';
  end if;
  return new;
end $$;

revoke all on function public.abc_fiscal_listar_emisores(text,text) from public,anon,authenticated,service_role;
grant execute on function public.abc_fiscal_listar_emisores(text,text) to authenticated;

commit;
