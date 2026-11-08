-- PM11: do not disclose whether a requested employee ID exists in another tenant.
-- This is intentionally the same read contract as the prior QA function except
-- that absent and out-of-scope employee IDs have an identical public reason.

begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $preflight$
begin
  if to_regprocedure('public.pm11_estado_cuentas_empleados(text,text,text[])') is null then
    raise exception 'PM11_ACCOUNT_STATE_PREFLIGHT:function_missing';
  end if;
end
$preflight$;

create or replace function public.pm11_estado_cuentas_empleados(
  p_empresa_id text,
  p_local_id text,
  p_empleado_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','auth','pg_temp'
as $read_function$
declare
  v_actor uuid := auth.uid();
  v_ids text[];
  v_id text;
  v_empleado record;
  v_perfil record;
  v_perfiles integer;
  v_rol text;
  v_estado text;
  v_motivo text;
  v_cuentas jsonb := '[]'::jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('ok',false,'codigo','no_autenticado','cuentas','[]'::jsonb);
  end if;
  if nullif(btrim(p_empresa_id),'') is null
     or nullif(btrim(p_local_id),'') is null
     or upper(btrim(p_local_id)) in ('TODOS','TODOS LOS LOCALES') then
    return jsonb_build_object('ok',false,'codigo','contexto_invalido','cuentas','[]'::jsonb);
  end if;
  if not exists (
    select 1 from public.perfiles p
     where p.user_id=v_actor and p.activo=true and p.rol='Propietario'
  ) then
    return jsonb_build_object('ok',false,'codigo','perfil_no_autorizado','cuentas','[]'::jsonb);
  end if;
  if not exists (
    select 1 from public.locales l
     where l.id=btrim(p_local_id) and l.empresa_id=btrim(p_empresa_id) and l.activo=true
  ) then
    return jsonb_build_object('ok',false,'codigo','local_inactivo_o_invalido','cuentas','[]'::jsonb);
  end if;
  if not exists (
    select 1 from public.membresias_usuario m
     where m.user_id=v_actor and m.activo=true
       and m.empresa_id=btrim(p_empresa_id) and m.rol='Propietario'
       and (m.todos_locales=true or (m.todos_locales=false and m.local_id=btrim(p_local_id)))
  ) then
    return jsonb_build_object('ok',false,'codigo','sin_alcance','cuentas','[]'::jsonb);
  end if;

  select coalesce(array_agg(x.id order by x.id),'{}'::text[]) into v_ids
    from (
      select distinct nullif(btrim(raw_id),'') as id
        from unnest(coalesce(p_empleado_ids,'{}'::text[])) as u(raw_id)
       where nullif(btrim(raw_id),'') is not null
    ) x;
  if cardinality(v_ids)>500 then
    return jsonb_build_object('ok',false,'codigo','demasiados_empleados','cuentas','[]'::jsonb);
  end if;

  foreach v_id in array v_ids loop
    v_estado := 'incoherente';
    v_motivo := null;
    v_rol := null;
    v_perfil := null;
    select e.id,e.empresa_id,e.local_id,e.estado into v_empleado
      from public.empleados e where e.id=v_id;
    if not found then
      v_motivo := 'empleado_no_disponible';
    elsif v_empleado.empresa_id is distinct from btrim(p_empresa_id)
       or v_empleado.local_id is distinct from btrim(p_local_id) then
      v_motivo := 'empleado_no_disponible';
    else
      select count(*) into v_perfiles from public.perfiles p where p.empleado_id=v_id;
      if v_perfiles=0 then
        v_estado := 'sin_cuenta';
      elsif v_perfiles>1 then
        v_motivo := 'perfiles_duplicados';
      else
        select p.user_id,p.rol,p.activo into v_perfil
          from public.perfiles p where p.empleado_id=v_id;
        v_rol := v_perfil.rol;
        if v_perfil.user_id is null
           or not exists (select 1 from auth.users u where u.id=v_perfil.user_id) then
          v_motivo := 'auth_usuario_no_encontrado';
        elsif v_perfil.activo is null then
          v_motivo := 'activo_nulo';
        elsif nullif(btrim(v_perfil.rol),'') is null
           or v_perfil.rol not in ('Encargado','Básico','Camarero/a','Cajero/a','Churrero/a') then
          v_motivo := 'rol_invalido';
        elsif not exists (
          select 1 from public.membresias_usuario m
           where m.user_id=v_perfil.user_id and m.activo=true
             and m.empresa_id=btrim(p_empresa_id) and m.local_id=btrim(p_local_id)
             and m.todos_locales=false and m.rol=v_perfil.rol
        ) then
          v_motivo := 'membresia_incoherente';
        elsif v_perfil.activo=false then
          v_estado := 'suspendida';
        else
          v_estado := 'activa';
        end if;
      end if;
    end if;
    v_cuentas := v_cuentas || jsonb_build_array(jsonb_build_object(
      'empleado_id',v_id,
      'estado',v_estado,
      'rol',case when v_estado in ('activa','suspendida') then v_rol else null end,
      'activo',case when v_estado='activa' then true when v_estado='suspendida' then false else null end,
      'motivo',v_motivo
    ));
  end loop;

  return jsonb_build_object(
    'ok',true,
    'empresa_id',btrim(p_empresa_id),
    'local_id',btrim(p_local_id),
    'cuentas',v_cuentas
  );
end;
$read_function$;

revoke all on function public.pm11_estado_cuentas_empleados(text,text,text[])
  from public,anon,authenticated,service_role;
grant execute on function public.pm11_estado_cuentas_empleados(text,text,text[]) to authenticated;

commit;
