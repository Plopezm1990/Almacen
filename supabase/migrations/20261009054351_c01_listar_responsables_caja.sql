-- ABC F7 C01 — responsables elegibles para relevo de caja.
-- Lectura específica de caja: usa ABC_CAJA_OPERAR y conserva el ámbito de
-- empresa/local y la sesión operativa del terminal que realiza la consulta.

do $$
begin
  if to_regclass('public.membresias_usuario') is null then
    raise exception 'ABC_F7_C01_PREFLIGHT_FALLO:membresias_usuario';
  end if;
  if to_regclass('public.perfiles') is null then
    raise exception 'ABC_F7_C01_PREFLIGHT_FALLO:perfiles';
  end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then
    raise exception 'ABC_F7_C01_PREFLIGHT_FALLO:abc_tiene_capacidad';
  end if;
  if to_regprocedure('private.abc_terminal_sesion_operativa(text,text,uuid,uuid)') is null then
    raise exception 'ABC_F7_C01_PREFLIGHT_FALLO:abc_terminal_sesion_operativa';
  end if;
end $$;

create function public.abc_listar_responsables_caja(
  p_empresa_id text,
  p_local_id text,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_responsables jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(
       p_empresa_id,p_local_id,'ABC_CAJA_OPERAR'
     ) then
    raise exception 'responsables_caja_listar_no_autorizado';
  end if;

  if p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'responsables_caja_listar_parametros_requeridos';
  end if;

  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id',x.user_id,
        'nombre',x.nombre,
        'rol',x.rol,
        'todos_locales',x.todos_locales
      )
      order by x.nombre nulls last,x.rol,x.user_id
    ),
    '[]'::jsonb
  )
  into v_responsables
  from (
    select distinct on (m.user_id)
      m.user_id,
      coalesce(nullif(btrim(p.nombre),''),'Usuario '||right(m.user_id::text,8)) as nombre,
      m.rol,
      m.todos_locales
    from public.membresias_usuario m
    left join public.perfiles p
      on p.user_id=m.user_id
     and coalesce(p.activo,true)=true
    where m.empresa_id=p_empresa_id
      and m.activo=true
      and (
        (m.todos_locales=false and m.local_id=p_local_id)
        or
        (m.todos_locales=true and m.local_id is null)
      )
    order by
      m.user_id,
      case when m.todos_locales=false and m.local_id=p_local_id then 0 else 1 end,
      m.updated_at desc,
      m.id desc
  ) x;

  return jsonb_build_object(
    'ok',true,
    'empresa_id',p_empresa_id,
    'local_id',p_local_id,
    'terminal_id',p_terminal_id,
    'session_id',p_session_id,
    'operating_day',p_operating_day,
    'responsables',v_responsables
  );
end $$;

revoke all on function public.abc_listar_responsables_caja(
  text,text,uuid,uuid,date
) from public,anon,authenticated,service_role;

grant execute on function public.abc_listar_responsables_caja(
  text,text,uuid,uuid,date
) to authenticated;

comment on function public.abc_listar_responsables_caja(text,text,uuid,uuid,date)
is 'C01: lista miembros activos elegibles para relevo de una sesión de caja operativa.';
