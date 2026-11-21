-- ============================================================================
-- Rediseno · Apariencia: gestion de la delegacion por cargo
-- ----------------------------------------------------------------------------
-- La migracion 20261113090000 creo `apariencia_delegaciones` y la consulta al
-- autorizar, pero no dejo ninguna via para concederla ni retirarla: solo una
-- escritura directa en la base podia crear una fila. La especificacion exige
-- que el propietario pueda delegar la accion en un cargo, asi que faltaba la
-- mitad del contrato.
--
-- Esta migracion es ADITIVA: annade el registro de eventos y tres RPC. No
-- modifica las tablas ni las funciones anteriores, y el frontend sin ella
-- sigue funcionando (sin seccion de delegacion).
-- ============================================================================

create table if not exists public.apariencia_delegacion_eventos (
  id            bigserial primary key,
  empresa_id    text not null,
  rol           text not null,
  accion        text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  creado_en     timestamptz not null default now(),
  constraint apariencia_deleg_evento_accion check (accion in ('ALTA','BAJA'))
);

alter table public.apariencia_delegacion_eventos enable row level security;
revoke all on table public.apariencia_delegacion_eventos from anon, authenticated;

create index if not exists apariencia_deleg_eventos_empresa_idx
  on public.apariencia_delegacion_eventos (empresa_id, id desc);

-- ----------------------------------------------------------------------------
-- Correccion de autorizacion sobre 20261113090000.
--
-- `private.abc_apariencia_rol` devuelve UNA sola membresia, la de mayor
-- alcance. `abc_apariencia_puede_aplicar` decidia con ella, asi que un usuario
-- con dos membresias en la misma empresa (por ejemplo Encargado en un local y
-- Camarero/a en otro, que el modelo permite) quedaba a merced del orden: si la
-- delegada no era la que ganaba, se le denegaba teniendo permiso.
--
-- La autorizacion pasa a mirar TODAS sus membresias activas de esa empresa.
-- `abc_apariencia_rol` se conserva intacta para mostrar el cargo.
-- ----------------------------------------------------------------------------
create or replace function private.abc_apariencia_es_propietario(p_empresa_id text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1 from public.membresias_usuario m
     where m.user_id = auth.uid()
       and m.empresa_id = p_empresa_id
       and m.activo = true
       and m.rol = 'Propietario'
  );
$$;

create or replace function private.abc_apariencia_puede_aplicar(p_empresa_id text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select auth.uid() is not null and exists(
    select 1
      from public.membresias_usuario m
     where m.user_id = auth.uid()
       and m.empresa_id = p_empresa_id
       and m.activo = true
       and (
         m.rol = 'Propietario'
         or exists(
           select 1 from public.apariencia_delegaciones d
            where d.empresa_id = p_empresa_id and d.rol = m.rol
         )
       )
  );
$$;

-- Un cargo solo se delega si existe de verdad en la empresa: evita filas
-- muertas por una errata y que se conceda a un rol inventado.
create or replace function private.abc_apariencia_rol_existe(p_empresa_id text, p_rol text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1 from public.membresias_usuario m
     where m.empresa_id = p_empresa_id
       and m.activo = true
       and m.rol = p_rol
  );
$$;

create or replace function public.abc_apariencia_listar_delegaciones(p_empresa_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_filas jsonb;
begin
  if not private.abc_apariencia_es_propietario(p_empresa_id) then
    raise exception 'apariencia_no_autorizada';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'rol', d.rol,
           'concedido_por', d.concedido_por,
           'concedido_en', d.concedido_en
         ) order by d.rol), '[]'::jsonb)
    into v_filas
    from public.apariencia_delegaciones d
   where d.empresa_id = p_empresa_id;

  return jsonb_build_object(
    'ok', true,
    'delegaciones', v_filas,
    'cargos', coalesce((
      select jsonb_agg(distinct m.rol order by m.rol)
        from public.membresias_usuario m
       where m.empresa_id = p_empresa_id and m.activo = true and m.rol <> 'Propietario'
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.abc_apariencia_delegar(p_empresa_id text, p_rol text)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare v_rol text := nullif(btrim(coalesce(p_rol, '')), '');
begin
  if not private.abc_apariencia_es_propietario(p_empresa_id) then
    raise exception 'apariencia_no_autorizada';
  end if;
  if v_rol is null then raise exception 'apariencia_rol_requerido'; end if;
  if v_rol = 'Propietario' then raise exception 'apariencia_rol_no_delegable'; end if;
  if not private.abc_apariencia_rol_existe(p_empresa_id, v_rol) then
    raise exception 'apariencia_rol_inexistente';
  end if;

  insert into public.apariencia_delegaciones(empresa_id, rol, concedido_por)
  values (p_empresa_id, v_rol, auth.uid())
  on conflict (empresa_id, rol) do nothing;

  if found then
    insert into public.apariencia_delegacion_eventos(empresa_id, rol, accion, actor_user_id)
    values (p_empresa_id, v_rol, 'ALTA', auth.uid());
  end if;

  return public.abc_apariencia_listar_delegaciones(p_empresa_id);
end $$;

create or replace function public.abc_apariencia_retirar_delegacion(p_empresa_id text, p_rol text)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare v_rol text := nullif(btrim(coalesce(p_rol, '')), '');
begin
  if not private.abc_apariencia_es_propietario(p_empresa_id) then
    raise exception 'apariencia_no_autorizada';
  end if;
  if v_rol is null then raise exception 'apariencia_rol_requerido'; end if;

  delete from public.apariencia_delegaciones
   where empresa_id = p_empresa_id and rol = v_rol;

  if found then
    insert into public.apariencia_delegacion_eventos(empresa_id, rol, accion, actor_user_id)
    values (p_empresa_id, v_rol, 'BAJA', auth.uid());
  end if;

  return public.abc_apariencia_listar_delegaciones(p_empresa_id);
end $$;

revoke all on function public.abc_apariencia_listar_delegaciones(text)        from public, anon, authenticated, service_role;
revoke all on function public.abc_apariencia_delegar(text,text)               from public, anon, authenticated, service_role;
revoke all on function public.abc_apariencia_retirar_delegacion(text,text)    from public, anon, authenticated, service_role;

grant execute on function public.abc_apariencia_listar_delegaciones(text)     to authenticated;
grant execute on function public.abc_apariencia_delegar(text,text)            to authenticated;
grant execute on function public.abc_apariencia_retirar_delegacion(text,text) to authenticated;
