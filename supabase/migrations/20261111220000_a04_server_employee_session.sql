begin;

-- A-04: el modo empleado puede ejecutarse en un terminal compartido con la
-- misma cuenta Supabase propietaria. El PIN se verifica en servidor, pero la
-- identidad seleccionada no puede quedar solo en localStorage. Esta sesión
-- opaca, corta y ligada a auth.uid()/empresa/local permite que el registrador
-- resuelva el empleado en servidor sin aceptar un nombre o un id del cliente.
create table if not exists private.pm11_empleado_sesion (
  token_hash text primary key,
  user_id uuid not null,
  empleado_id text not null references public.empleados(id) on delete cascade,
  empresa_id text not null,
  local_id text not null,
  created_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null
);

create index if not exists pm11_empleado_sesion_user_idx
  on private.pm11_empleado_sesion (user_id, empresa_id, local_id, expires_at);

revoke all on table private.pm11_empleado_sesion from public, anon, authenticated, service_role;

create or replace function public.pm11_iniciar_sesion_empleado(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_hash text;
  v_token text;
  v_empleado public.empleados%rowtype;
begin
  if v_uid is null or not private.pm11_puede_ver_personal(p_empresa_id, p_local_id) then
    return jsonb_build_object('ok', false, 'verificado', false, 'codigo', 'no_autorizado');
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then
    return jsonb_build_object('ok', true, 'verificado', false);
  end if;

  select * into v_empleado
    from public.empleados e
   where e.id = p_empleado_id
     and e.empresa_id = p_empresa_id
     and e.local_id = p_local_id
     and e.estado = 'activo';
  if not found then
    return jsonb_build_object('ok', true, 'verificado', false);
  end if;

  select h.pin_hash into v_hash
    from private.pm11_empleado_pin h
   where h.empleado_id = p_empleado_id;
  if v_hash is null or extensions.crypt(p_pin, v_hash) <> v_hash then
    return jsonb_build_object('ok', true, 'verificado', false);
  end if;

  v_token := gen_random_uuid()::text || gen_random_uuid()::text;
  insert into private.pm11_empleado_sesion (
    token_hash, user_id, empleado_id, empresa_id, local_id, expires_at
  ) values (
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_uid, v_empleado.id, v_empleado.empresa_id, v_empleado.local_id,
    clock_timestamp() + interval '12 hours'
  );

  return jsonb_build_object(
    'ok', true,
    'verificado', true,
    'token', v_token,
    'empleado', private.pm11_empleado_publico(v_empleado)
  );
end;
$function$;

create or replace function public.pm11_cerrar_sesion_empleado(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  delete from private.pm11_empleado_sesion
   where user_id = (select auth.uid())
     and token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  select true;
$function$;

revoke all on function public.pm11_iniciar_sesion_empleado(text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.pm11_iniciar_sesion_empleado(text,text,text,text)
  to authenticated;
revoke all on function public.pm11_cerrar_sesion_empleado(text)
  from public, anon, authenticated;
grant execute on function public.pm11_cerrar_sesion_empleado(text)
  to authenticated;

create or replace function private.pm11_registrar_auditoria(
  p_id text,
  p_usuario text,
  p_accion text,
  p_detalle text,
  p_fecha date,
  p_hora text,
  p_empresa_id text,
  p_local_id text,
  p_empleado_sesion text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_empleado_id text;
  v_actor_nombre text;
  v_id text := nullif(btrim(p_id), '');
  v_accion text := nullif(btrim(p_accion), '');
  v_fecha date := coalesce(p_fecha, current_date);
  v_hora text := coalesce(nullif(btrim(p_hora), ''), to_char(clock_timestamp(), 'HH24:MI'));
  v_empresa text := nullif(btrim(p_empresa_id), '');
  v_local text := nullif(btrim(p_local_id), '');
  v_datos jsonb;
  v_existente public.auditoria_registro%rowtype;
  v_insertados integer := 0;
begin
  if v_uid is null or not private.la_usuario_activo() then
    raise exception 'usuario_inactivo_o_no_autenticado';
  end if;
  if v_id is null then raise exception 'auditoria_id_invalido'; end if;
  if v_accion is null then raise exception 'auditoria_accion_requerida'; end if;
  if v_empresa is null then
    select case when count(distinct m.empresa_id) = 1 then min(m.empresa_id) end
      into v_empresa from public.membresias_usuario m
     where m.user_id = v_uid and m.activo = true;
  end if;
  if v_empresa is null or not private.la_tiene_empresa(v_empresa) then
    raise exception 'empresa_no_autorizada';
  end if;
  if v_local is not null and upper(v_local) = 'TODOS' then v_local := null; end if;
  if v_local is not null and not private.la_tiene_local(v_empresa, v_local) then
    raise exception 'local_no_autorizado';
  end if;

  if nullif(btrim(p_empleado_sesion), '') is not null then
    select s.empleado_id, e.nombre
      into v_empleado_id, v_actor_nombre
      from private.pm11_empleado_sesion s
      join public.empleados e on e.id = s.empleado_id
     where s.token_hash = encode(extensions.digest(btrim(p_empleado_sesion), 'sha256'), 'hex')
       and s.user_id = v_uid
       and s.empresa_id = v_empresa
       and (v_local is null or s.local_id = v_local)
       and e.estado = 'activo'
       and s.expires_at > clock_timestamp();
    if v_empleado_id is null then
      raise exception 'auditoria_sesion_empleado_no_autorizada';
    end if;
    update private.pm11_empleado_sesion
       set last_seen_at = clock_timestamp(), expires_at = clock_timestamp() + interval '12 hours'
     where token_hash = encode(extensions.digest(btrim(p_empleado_sesion), 'sha256'), 'hex');
  else
    select p.empleado_id, p.nombre into v_empleado_id, v_actor_nombre
      from public.perfiles p where p.user_id = v_uid and p.activo = true;
  end if;

  v_datos := jsonb_build_object(
    'id', v_id, 'fecha', v_fecha::text, 'hora', v_hora,
    'usuario', coalesce(nullif(v_actor_nombre, ''), 'Cuenta sin nombre'),
    'usuarioAutenticado', v_uid::text, 'accion', v_accion,
    'detalle', coalesce(p_detalle, ''), 'empresaId', v_empresa,
    'localId', v_local, 'actorUserId', v_uid
  ) || case when v_empleado_id is null then '{}'::jsonb
            else jsonb_build_object('empleadoId', v_empleado_id) end;

  insert into public.auditoria_registro (
    id, fecha, datos, empresa_id, local_id, actor_user_id, actor_empleado_id
  ) values (
    v_id, v_fecha, v_datos, v_empresa, v_local, v_uid, v_empleado_id
  ) on conflict (id) do nothing;
  get diagnostics v_insertados = row_count;
  select * into v_existente from public.auditoria_registro where id = v_id;
  if not found then raise exception 'auditoria_replay_no_resuelto'; end if;
  if v_insertados = 0 and (
       v_existente.fecha is distinct from v_fecha
       or v_existente.datos is distinct from v_datos
       or v_existente.empresa_id is distinct from v_empresa
       or v_existente.local_id is distinct from v_local
       or v_existente.actor_user_id is distinct from v_uid
       or v_existente.actor_empleado_id is distinct from v_empleado_id
     ) then
    raise exception 'auditoria_id_conflict';
  end if;
  return jsonb_build_object(
    'ok', true, 'id', v_id, 'empresaId', v_empresa, 'localId', v_local,
    'actorUserId', v_uid, 'actorEmpleadoId', v_empleado_id,
    'replayed', v_insertados = 0
  );
end;
$function$;

create or replace function public.registrar_auditoria(
  p_id text,
  p_usuario text,
  p_accion text,
  p_detalle text,
  p_fecha date,
  p_hora text,
  p_empresa_id text,
  p_local_id text
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select private.pm11_registrar_auditoria(
    p_id, p_usuario, p_accion, p_detalle, p_fecha, p_hora,
    p_empresa_id, p_local_id, null
  );
$function$;

create or replace function public.registrar_auditoria(
  p_id text,
  p_usuario text,
  p_accion text,
  p_detalle text,
  p_fecha date,
  p_hora text,
  p_empresa_id text,
  p_local_id text,
  p_empleado_sesion text
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select private.pm11_registrar_auditoria(
    p_id, p_usuario, p_accion, p_detalle, p_fecha, p_hora,
    p_empresa_id, p_local_id, p_empleado_sesion
  );
$function$;

revoke all on function public.registrar_auditoria(text,text,text,text,date,text,text,text)
  from public, anon, authenticated;
grant execute on function public.registrar_auditoria(text,text,text,text,date,text,text,text)
  to authenticated;
revoke all on function public.registrar_auditoria(text,text,text,text,date,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.registrar_auditoria(text,text,text,text,date,text,text,text,text)
  to authenticated;

do $post$
begin
  if to_regclass('private.pm11_empleado_sesion') is null then
    raise exception 'A04_POSTFLIGHT:employee_session_table';
  end if;
  if to_regprocedure('public.pm11_iniciar_sesion_empleado(text,text,text,text)') is null then
    raise exception 'A04_POSTFLIGHT:employee_session_rpc';
  end if;
  if to_regprocedure('public.registrar_auditoria(text,text,text,text,date,text,text,text,text)') is null then
    raise exception 'A04_POSTFLIGHT:auditoria_session_overload';
  end if;
end $post$;

commit;
