begin;

-- M-01: los PIN de empleados no son credenciales del cliente. El hash lento
-- queda en un esquema privado y el cliente solo recibe identidad y un booleano
-- de configuración. Los PIN heredados eran SHA-256 del navegador y no se
-- pueden transformar en bcrypt sin conocer el PIN: se eliminan y habrá que
-- volver a configurarlos desde Personal.

create table if not exists private.pm11_empleado_pin (
  empleado_id text primary key references public.empleados(id) on delete cascade,
  pin_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table private.pm11_empleado_pin from public, anon, authenticated, service_role;

-- Retira secretos que pudieran estar en las dos superficies legacy. No se
-- intenta migrar el SHA-256: sería conservar el problema bajo otro nombre.
update public.empleados
   set datos = datos - 'pin'
 where datos ? 'pin';

update public.almacen_kv k
   set value = coalesce((
     select jsonb_agg(e - 'pin')
       from jsonb_array_elements(k.value) e
   ), '[]'::jsonb)
 where k.key = 'empleados'
   and jsonb_typeof(k.value) = 'array';

create or replace function private.pm11_empleado_publico(p_empleado public.empleados)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select to_jsonb(p_empleado)
    || jsonb_build_object('datos', coalesce(p_empleado.datos, '{}'::jsonb) - 'pin');
$$;

revoke all on function private.pm11_empleado_publico(public.empleados) from public, anon, authenticated;

-- Mantiene la firma existente: el PIN viaja como entrada efímera por TLS,
-- nunca como hash calculado en JavaScript, y se retira de p_datos antes de
-- persistir la ficha.
create or replace function public.pm11_alta_empleado(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text,
  p_nombre text,
  p_datos jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_empleado public.empleados%rowtype;
  v_datos jsonb;
  v_datos_entrada jsonb := coalesce(p_datos, '{}'::jsonb);
  v_pin text := nullif(btrim(coalesce(p_datos->>'pin', '')), '');
  v_operation_id text := nullif(btrim(coalesce(p_datos->>'pm13AltaOperationId', '')), '');
begin
  if auth.uid() is null or not private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) then
    raise exception 'personal_contexto_no_autorizado';
  end if;
  if nullif(btrim(p_empleado_id), '') is null then raise exception 'empleado_id_requerido'; end if;
  if upper(btrim(p_local_id)) in ('TODOS', 'TODOS LOS LOCALES') then raise exception 'personal_local_concreto_requerido'; end if;
  if nullif(btrim(p_nombre), '') is null then raise exception 'empleado_nombre_requerido'; end if;
  if v_pin is not null and v_pin !~ '^[0-9]{4,6}$' then raise exception 'empleado_pin_invalido'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pm13:empleado:alta:' || p_empresa_id || ':' || p_local_id || ':' || p_empleado_id, 0)
  );

  select * into v_empleado
    from public.empleados e
   where e.id = p_empleado_id
   for update;

  if found then
    if v_operation_id is not null
       and v_empleado.empresa_id = p_empresa_id
       and v_empleado.local_id = p_local_id
       and v_empleado.datos->>'pm13AltaOperationId' = v_operation_id then
      return jsonb_build_object('ok', true, 'yaCreado', true, 'empleado', private.pm11_empleado_publico(v_empleado));
    end if;
    raise exception 'empleado_id_ya_existe';
  end if;

  v_datos_entrada := v_datos_entrada - 'pin';
  perform private.pm11_validar_datos_laborales(v_datos_entrada);
  v_datos := v_datos_entrada || jsonb_build_object(
    'id', p_empleado_id, 'empresaId', p_empresa_id, 'localId', p_local_id,
    'nombre', btrim(p_nombre), 'activo', true, 'estado', 'activo'
  );

  insert into public.empleados(id, empresa_id, local_id, estado, nombre, datos)
  values (p_empleado_id, p_empresa_id, p_local_id, 'activo', btrim(p_nombre), v_datos)
  returning * into v_empleado;

  if v_pin is not null then
    insert into private.pm11_empleado_pin(empleado_id, pin_hash)
    values (v_empleado.id, extensions.crypt(v_pin, extensions.gen_salt('bf', 12)));
  end if;

  perform private.pm11_auditar_empleado(
    'Personal · alta empleado', p_empleado_id, p_empresa_id, p_local_id,
    jsonb_build_object('estadoNuevo', 'activo', 'operationIdInformado', v_operation_id is not null, 'pinConfigurado', v_pin is not null)
  );
  return jsonb_build_object('ok', true, 'yaCreado', false, 'empleado', private.pm11_empleado_publico(v_empleado));
end;
$function$;

create or replace function public.pm11_editar_empleado(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text,
  p_cambios jsonb default '{}'::jsonb,
  p_nombre text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_empleado public.empleados%rowtype;
  v_nombre text;
  v_datos jsonb;
  v_cambios jsonb := coalesce(p_cambios, '{}'::jsonb);
  v_campos jsonb;
  v_pin text := nullif(btrim(coalesce(p_cambios->>'pin', '')), '');
  v_cambio_datos boolean;
begin
  if auth.uid() is null or not private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) then raise exception 'personal_contexto_no_autorizado'; end if;
  if p_cambios is null or jsonb_typeof(p_cambios) <> 'object' then raise exception 'empleado_cambios_invalidos'; end if;
  if v_pin is not null and v_pin !~ '^[0-9]{4,6}$' then raise exception 'empleado_pin_invalido'; end if;
  select * into v_empleado from public.empleados e where e.id = p_empleado_id for update;
  if not found then raise exception 'empleado_no_encontrado'; end if;
  if v_empleado.empresa_id <> p_empresa_id or v_empleado.local_id <> p_local_id then raise exception 'empleado_contexto_no_coincide'; end if;
  if v_empleado.estado <> 'activo' then raise exception 'empleado_no_activo'; end if;
  v_nombre := case when p_nombre is null then v_empleado.nombre else btrim(p_nombre) end;
  if nullif(v_nombre, '') is null then raise exception 'empleado_nombre_requerido'; end if;

  v_cambios := v_cambios - 'pin';
  v_datos := (v_empleado.datos - 'pin') || v_cambios || jsonb_build_object(
    'id', v_empleado.id, 'empresaId', v_empleado.empresa_id, 'localId', v_empleado.local_id,
    'nombre', v_nombre, 'activo', true, 'estado', 'activo'
  );
  perform private.pm11_validar_datos_laborales(v_datos);
  v_cambio_datos := v_nombre is distinct from v_empleado.nombre or v_datos is distinct from v_empleado.datos;

  if v_cambio_datos then
    update public.empleados set nombre = v_nombre, datos = v_datos where id = v_empleado.id returning * into v_empleado;
  end if;
  if v_pin is not null then
    insert into private.pm11_empleado_pin(empleado_id, pin_hash)
    values (v_empleado.id, extensions.crypt(v_pin, extensions.gen_salt('bf', 12)))
    on conflict (empleado_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
  end if;
  if not v_cambio_datos and v_pin is null then
    return jsonb_build_object('ok', true, 'yaSinCambios', true, 'empleado', private.pm11_empleado_publico(v_empleado));
  end if;
  select coalesce(jsonb_agg(k order by k), '[]'::jsonb) into v_campos from jsonb_object_keys(v_cambios) k;
  perform private.pm11_auditar_empleado(
    'Personal · editar empleado', v_empleado.id, v_empleado.empresa_id, v_empleado.local_id,
    jsonb_build_object('campos', v_campos, 'nombreModificado', p_nombre is not null, 'pinConfigurado', v_pin is not null)
  );
  return jsonb_build_object('ok', true, 'yaSinCambios', false, 'empleado', private.pm11_empleado_publico(v_empleado));
end;
$function$;

create or replace function public.pm11_listar_empleados_modo(p_empresa_id text, p_local_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not private.pm11_puede_ver_personal(p_empresa_id, p_local_id) then
    return jsonb_build_object('ok', false, 'empleados', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'ok', true,
    'empleados', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'nombre', e.nombre, 'empresaId', e.empresa_id, 'localId', e.local_id,
        'activo', true,
        'pinConfigurado', exists(select 1 from private.pm11_empleado_pin h where h.empleado_id = e.id)
      ) order by e.nombre, e.id)
      from public.empleados e
      where e.empresa_id = p_empresa_id and e.local_id = p_local_id and e.estado = 'activo'
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.pm11_verificar_pin_empleado(p_empresa_id text, p_local_id text, p_empleado_id text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_hash text;
begin
  if auth.uid() is null or not private.pm11_puede_ver_personal(p_empresa_id, p_local_id) then
    return jsonb_build_object('ok', false, 'verificado', false, 'codigo', 'no_autorizado');
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then
    return jsonb_build_object('ok', true, 'verificado', false);
  end if;
  if not exists(select 1 from public.empleados e where e.id = p_empleado_id and e.empresa_id = p_empresa_id and e.local_id = p_local_id and e.estado = 'activo') then
    return jsonb_build_object('ok', true, 'verificado', false);
  end if;
  select h.pin_hash into v_hash from private.pm11_empleado_pin h where h.empleado_id = p_empleado_id;
  return jsonb_build_object('ok', true, 'verificado', v_hash is not null and extensions.crypt(p_pin, v_hash) = v_hash);
end;
$function$;

revoke all on function public.pm11_alta_empleado(text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.pm11_editar_empleado(text,text,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.pm11_listar_empleados_modo(text,text) from public, anon, authenticated;
revoke all on function public.pm11_verificar_pin_empleado(text,text,text,text) from public, anon, authenticated;
grant execute on function public.pm11_alta_empleado(text,text,text,text,jsonb) to authenticated;
grant execute on function public.pm11_editar_empleado(text,text,text,jsonb,text) to authenticated;
grant execute on function public.pm11_listar_empleados_modo(text,text) to authenticated;
grant execute on function public.pm11_verificar_pin_empleado(text,text,text,text) to authenticated;

do $post$
begin
  if to_regclass('private.pm11_empleado_pin') is null then raise exception 'M01_POSTFLIGHT:pin_table'; end if;
  if has_table_privilege('anon','private.pm11_empleado_pin','SELECT') or has_table_privilege('authenticated','private.pm11_empleado_pin','SELECT') then raise exception 'M01_POSTFLIGHT:pin_table_acl'; end if;
  if to_regprocedure('public.pm11_listar_empleados_modo(text,text)') is null or to_regprocedure('public.pm11_verificar_pin_empleado(text,text,text,text)') is null then raise exception 'M01_POSTFLIGHT:pin_rpc'; end if;
end $post$;

commit;
