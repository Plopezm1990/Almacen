-- PM11 · Personal / Empleados · P08
-- Integridad Cuenta de acceso ↔ Perfil ↔ Membresía ↔ Empleado.
-- Aplicar únicamente en QA hasta autorización expresa. Producción/main no se toca.

-- 1) empleado_id deja de ser texto libre: referencia real y vínculo 1:1.
alter table public.perfiles
  add constraint pm11_perfiles_empleado_no_vacio
  check (empleado_id is null or nullif(btrim(empleado_id), '') is not null);

alter table public.perfiles
  add constraint pm11_perfiles_empleado_fk
  foreign key (empleado_id)
  references public.empleados(id)
  on update restrict
  on delete restrict;

create unique index pm11_perfiles_empleado_unico
  on public.perfiles (empleado_id)
  where empleado_id is not null;

-- 2) Un perfil vinculado solo puede apuntar a un empleado para el que exista
-- al menos una membresía activa compatible. Además, ninguna membresía activa
-- del mismo usuario puede pertenecer a otra empresa/local incompatible.
create or replace function private.pm11_perfiles_vinculo_guard()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
declare
  v_empleado public.empleados%rowtype;
begin
  if tg_op = 'UPDATE'
     and old.empleado_id is not null
     and new.empleado_id is not null
     and new.empleado_id is distinct from old.empleado_id then
    raise exception 'perfil_empleado_cambio_requiere_desvincular';
  end if;

  if new.empleado_id is null then
    return new;
  end if;

  select * into v_empleado
    from public.empleados e
   where e.id = new.empleado_id;

  if not found then
    raise exception 'perfil_empleado_no_existe';
  end if;

  if exists (
    select 1
      from public.perfiles p
     where p.empleado_id = new.empleado_id
       and p.user_id <> new.user_id
  ) then
    raise exception 'empleado_cuenta_ya_vinculada';
  end if;

  if not exists (
    select 1
      from public.membresias_usuario m
     where m.user_id = new.user_id
       and m.activo = true
       and m.empresa_id = v_empleado.empresa_id
       and (
         m.todos_locales = true
         or (m.todos_locales = false and m.local_id = v_empleado.local_id)
       )
  ) then
    raise exception 'cuenta_sin_membresia_compatible_empleado';
  end if;

  if exists (
    select 1
      from public.membresias_usuario m
     where m.user_id = new.user_id
       and m.activo = true
       and (
         m.empresa_id <> v_empleado.empresa_id
         or not (
           m.todos_locales = true
           or (m.todos_locales = false and m.local_id = v_empleado.local_id)
         )
       )
  ) then
    raise exception 'cuenta_membresia_activa_incompatible_empleado';
  end if;

  return new;
end;
$$;

revoke all on function private.pm11_perfiles_vinculo_guard() from public, anon, authenticated;

drop trigger if exists pm11_perfiles_vinculo_guard on public.perfiles;
create trigger pm11_perfiles_vinculo_guard
before insert or update of empleado_id on public.perfiles
for each row execute function private.pm11_perfiles_vinculo_guard();

-- 3) Una vez vinculada la cuenta, no se puede activar una membresía que saque
-- a ese usuario fuera de la empresa/local que contiene su empleado.
create or replace function private.pm11_membresias_vinculo_guard()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
declare
  v_empleado public.empleados%rowtype;
  v_empleado_id text;
begin
  if new.activo is distinct from true then
    return new;
  end if;

  select p.empleado_id into v_empleado_id
    from public.perfiles p
   where p.user_id = new.user_id;

  if v_empleado_id is null then
    return new;
  end if;

  select * into v_empleado
    from public.empleados e
   where e.id = v_empleado_id;

  if not found then
    raise exception 'membresia_empleado_vinculado_no_existe';
  end if;

  if new.empresa_id <> v_empleado.empresa_id
     or not (
       new.todos_locales = true
       or (new.todos_locales = false and new.local_id = v_empleado.local_id)
     ) then
    raise exception 'membresia_incompatible_con_empleado_vinculado';
  end if;

  return new;
end;
$$;

revoke all on function private.pm11_membresias_vinculo_guard() from public, anon, authenticated;

drop trigger if exists pm11_membresias_vinculo_guard on public.membresias_usuario;
create trigger pm11_membresias_vinculo_guard
before insert or update of user_id, empresa_id, local_id, todos_locales, activo
on public.membresias_usuario
for each row execute function private.pm11_membresias_vinculo_guard();

-- 4) El acceso efectivo de una cuenta vinculada queda condicionado al estado
-- activo de su empleado y a una membresía activa compatible. Baja lógica =>
-- acceso suspendido automáticamente; reactivación => vuelve a ser elegible.
create or replace function private.la_usuario_activo()
returns boolean
language sql
stable security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
  select exists (
    select 1
      from public.perfiles p
     where p.user_id = auth.uid()
       and p.activo = true
       and (
         (
           p.empleado_id is null
           and exists (
             select 1
               from public.membresias_usuario m
              where m.user_id = p.user_id
                and m.activo = true
           )
         )
         or
         (
           p.empleado_id is not null
           and exists (
             select 1
               from public.empleados e
               join public.membresias_usuario m
                 on m.user_id = p.user_id
                and m.activo = true
                and m.empresa_id = e.empresa_id
                and (
                  m.todos_locales = true
                  or (m.todos_locales = false and m.local_id = e.local_id)
                )
              where e.id = p.empleado_id
                and e.estado = 'activo'
           )
         )
       )
  );
$$;

revoke all on function private.la_usuario_activo() from public, anon;
grant execute on function private.la_usuario_activo() to authenticated;

-- 5) Solo Propietario puede gestionar el vínculo de cuenta en P08.
-- Vincular exige local activo; desvincular puede hacerse también con local cerrado
-- para permitir cierres administrativos/anonimización posterior.
create or replace function private.pm11_propietario_puede_gestionar_vinculo(
  p_empresa_id text,
  p_local_id text
) returns boolean
language sql
stable security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
  select private.la_usuario_activo()
     and nullif(btrim(p_empresa_id), '') is not null
     and nullif(btrim(p_local_id), '') is not null
     and upper(btrim(p_local_id)) not in ('TODOS', 'TODOS LOS LOCALES')
     and exists (
       select 1
         from public.membresias_usuario m
        where m.user_id = auth.uid()
          and m.empresa_id = p_empresa_id
          and m.activo = true
          and m.rol = 'Propietario'
          and (m.todos_locales = true or m.local_id = p_local_id)
     );
$$;

revoke all on function private.pm11_propietario_puede_gestionar_vinculo(text, text)
  from public, anon, authenticated;

create or replace function public.pm11_vincular_cuenta_empleado(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text,
  p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
declare
  v_empleado public.empleados%rowtype;
  v_perfil public.perfiles%rowtype;
begin
  if auth.uid() is null
     or not private.pm11_propietario_puede_gestionar_vinculo(p_empresa_id, p_local_id) then
    raise exception 'vinculo_cuenta_no_autorizado';
  end if;

  if not private.pm11_local_activo(p_empresa_id, p_local_id) then
    raise exception 'vinculo_cuenta_local_inactivo';
  end if;

  select * into v_empleado
    from public.empleados e
   where e.id = p_empleado_id
   for update;

  if not found then
    raise exception 'empleado_no_encontrado';
  end if;
  if v_empleado.empresa_id <> p_empresa_id or v_empleado.local_id <> p_local_id then
    raise exception 'empleado_contexto_no_coincide';
  end if;
  if v_empleado.estado <> 'activo' then
    raise exception 'empleado_no_activo_para_vincular_cuenta';
  end if;

  select * into v_perfil
    from public.perfiles p
   where p.user_id = p_user_id
   for update;

  if not found then
    raise exception 'cuenta_perfil_no_encontrado';
  end if;

  if v_perfil.empleado_id = p_empleado_id then
    return jsonb_build_object(
      'ok', true,
      'yaVinculado', true,
      'empleadoId', p_empleado_id,
      'userId', p_user_id
    );
  end if;

  if v_perfil.empleado_id is not null then
    raise exception 'cuenta_ya_vinculada_otro_empleado';
  end if;

  if exists (
    select 1 from public.perfiles p
     where p.empleado_id = p_empleado_id
       and p.user_id <> p_user_id
  ) then
    raise exception 'empleado_cuenta_ya_vinculada';
  end if;

  if not exists (
    select 1
      from public.membresias_usuario m
     where m.user_id = p_user_id
       and m.activo = true
       and m.empresa_id = v_empleado.empresa_id
       and (
         m.todos_locales = true
         or (m.todos_locales = false and m.local_id = v_empleado.local_id)
       )
  ) then
    raise exception 'cuenta_sin_membresia_compatible_empleado';
  end if;

  if exists (
    select 1
      from public.membresias_usuario m
     where m.user_id = p_user_id
       and m.activo = true
       and (
         m.empresa_id <> v_empleado.empresa_id
         or not (
           m.todos_locales = true
           or (m.todos_locales = false and m.local_id = v_empleado.local_id)
         )
       )
  ) then
    raise exception 'cuenta_membresia_activa_incompatible_empleado';
  end if;

  update public.perfiles
     set empleado_id = p_empleado_id,
         updated_at = now()
   where user_id = p_user_id
  returning * into v_perfil;

  perform private.pm11_auditar_empleado(
    'Personal · vincular cuenta empleado',
    v_empleado.id,
    v_empleado.empresa_id,
    v_empleado.local_id,
    jsonb_build_object('cuentaUserId', p_user_id)
  );

  return jsonb_build_object(
    'ok', true,
    'yaVinculado', false,
    'empleadoId', v_empleado.id,
    'userId', v_perfil.user_id
  );
end;
$$;

create or replace function public.pm11_desvincular_cuenta_empleado(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text,
  p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
declare
  v_empleado public.empleados%rowtype;
  v_perfil public.perfiles%rowtype;
begin
  if auth.uid() is null
     or not private.pm11_propietario_puede_gestionar_vinculo(p_empresa_id, p_local_id) then
    raise exception 'desvinculo_cuenta_no_autorizado';
  end if;

  select * into v_empleado
    from public.empleados e
   where e.id = p_empleado_id
   for update;

  if not found then
    raise exception 'empleado_no_encontrado';
  end if;
  if v_empleado.empresa_id <> p_empresa_id or v_empleado.local_id <> p_local_id then
    raise exception 'empleado_contexto_no_coincide';
  end if;

  select * into v_perfil
    from public.perfiles p
   where p.user_id = p_user_id
   for update;

  if not found then
    raise exception 'cuenta_perfil_no_encontrado';
  end if;

  if v_perfil.empleado_id is null then
    return jsonb_build_object(
      'ok', true,
      'yaDesvinculado', true,
      'empleadoId', p_empleado_id,
      'userId', p_user_id
    );
  end if;

  if v_perfil.empleado_id <> p_empleado_id then
    raise exception 'cuenta_vinculada_otro_empleado';
  end if;

  update public.perfiles
     set empleado_id = null,
         updated_at = now()
   where user_id = p_user_id;

  perform private.pm11_auditar_empleado(
    'Personal · desvincular cuenta empleado',
    v_empleado.id,
    v_empleado.empresa_id,
    v_empleado.local_id,
    jsonb_build_object('cuentaUserId', p_user_id)
  );

  return jsonb_build_object(
    'ok', true,
    'yaDesvinculado', false,
    'empleadoId', v_empleado.id,
    'userId', p_user_id
  );
end;
$$;

revoke all on function public.pm11_vincular_cuenta_empleado(text, text, text, uuid)
  from public, anon;
revoke all on function public.pm11_desvincular_cuenta_empleado(text, text, text, uuid)
  from public, anon;
grant execute on function public.pm11_vincular_cuenta_empleado(text, text, text, uuid)
  to authenticated;
grant execute on function public.pm11_desvincular_cuenta_empleado(text, text, text, uuid)
  to authenticated;
