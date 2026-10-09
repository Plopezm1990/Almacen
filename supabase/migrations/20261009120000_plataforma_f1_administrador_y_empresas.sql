-- PLATAFORMA F1: administrador de la plataforma + alta, baja y reactivación
-- de empresas clientes (decisión D01: producto multiempresa; el propietario
-- de la plataforma da de alta a las empresas).
--
-- Qué añade (todo nuevo, nada existente se reescribe salvo la guarda de
-- guardar_contexto_instalacion_ui descrita abajo):
--   * private.plataforma_admins: quién es administrador de la plataforma. Una
--     cuenta se registra a mano (private.plataforma_registrar_admin), nunca desde
--     el navegador.
--   * public.plataforma_estado / listar_empresas / crear_empresa /
--     asignar_propietario / desactivar_empresa / reactivar_empresa: funciones de
--     servidor que comprueban SIEMPRE el permiso de administrador.
--   * private.plataforma_bajas: qué se desactivó en una baja, para que reactivar
--     devuelva exactamente eso y no más.
--   * private.plataforma_auditoria: apunte por cada operación, con operation_id
--     único (repetir la misma orden devuelve el mismo resultado) y sin datos de
--     negocio de la empresa.
--
-- Qué NO hace: no borra nada (el borrado definitivo es la fase 2), no lee datos
-- de negocio de ninguna empresa, no crea cuentas de acceso (eso lo hará una
-- función de servidor con clave de servicio) y no toca obtener_estado_instalacion.
--
-- Cambio en una función existente: guardar_contexto_instalacion_ui (versión
-- PM29, comprobada por huella md5) gana una guarda en la rama «empresa nueva»:
-- mientras exista al menos un administrador de plataforma, solo un administrador
-- puede crear empresas. Si no hay ninguno registrado, se comporta como antes.
--
-- Una baja desactiva la empresa, sus locales y las membresías de sus usuarios
-- (así dejan de ver datos protegidos por pertenencia a la empresa). Los datos no
-- se tocan. La baja y la reactivación son reversibles.
--
-- Este archivo NO se aplica automáticamente a producción desde esta rama.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '20s';

do $$
begin
  if to_regclass('public.empresas') is null
     or to_regclass('public.locales') is null
     or to_regclass('public.membresias_usuario') is null
     or to_regclass('public.perfiles') is null
     or to_regclass('auth.users') is null then
    raise exception 'PREFLIGHT_FALLO: faltan tablas base (empresas, locales, membresias_usuario, perfiles, auth.users)';
  end if;

  if to_regprocedure('public.guardar_contexto_instalacion_ui(text,jsonb)') is null then
    raise exception 'PREFLIGHT_FALLO: falta guardar_contexto_instalacion_ui';
  end if;

  if (select md5(p.prosrc)
        from pg_proc p
       where p.oid = 'public.guardar_contexto_instalacion_ui(text,jsonb)'::regprocedure)
     <> '0110df5a2e37f879c7086be3c33a69af' then
    raise exception 'PREFLIGHT_FALLO: guardar_contexto_instalacion_ui no es la versión PM29 esperada; revisar antes de reemplazarla';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tablas privadas (el navegador no puede leerlas ni escribirlas)
-- ---------------------------------------------------------------------------
create table if not exists private.plataforma_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  creado_en timestamptz not null default now(),
  nota text
);

create table if not exists private.plataforma_bajas (
  empresa_id text primary key,
  baja_en timestamptz not null default now(),
  motivo text,
  por_user uuid,
  membresias_desactivadas bigint[] not null default '{}',
  locales_desactivados text[] not null default '{}',
  reactivada_en timestamptz
);

-- Una baja reactivada no se borra: queda marcada (historial). La baja vigente es
-- la que tiene reactivada_en nulo.
alter table private.plataforma_bajas add column if not exists reactivada_en timestamptz;

create table if not exists private.plataforma_auditoria (
  id bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  actor uuid,
  accion text not null,
  empresa_id text,
  operation_id text unique,
  peticion text,
  detalle jsonb not null default '{}'::jsonb,
  resultado jsonb
);

alter table private.plataforma_admins enable row level security;
alter table private.plataforma_bajas enable row level security;
alter table private.plataforma_auditoria enable row level security;

revoke all on table private.plataforma_admins, private.plataforma_bajas, private.plataforma_auditoria
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ayudas privadas
-- ---------------------------------------------------------------------------
create or replace function private.es_admin_plataforma()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select auth.uid() is not null
     and exists (
       select 1 from private.plataforma_admins a where a.user_id = auth.uid()
     )
     and exists (
       select 1
         from public.perfiles p
        where p.user_id = auth.uid()
          and p.activo = true
          and p.rol = 'Propietario'
     );
$$;

create or replace function private.plataforma_exigir_admin()
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;
  if not private.es_admin_plataforma() then
    raise exception 'Administrador de plataforma requerido' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.plataforma_validar_operation_id(p_operation_id text)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_operation_id is null or p_operation_id !~ '^[A-Za-z0-9._:-]{8,120}$' then
    raise exception 'operation_id inválido' using errcode = '22023';
  end if;
end;
$$;

-- Alta manual de un administrador. No se concede a ningún rol de la API: solo
-- se ejecuta desde el editor SQL / migraciones con autorización de Pedro.
create or replace function private.plataforma_registrar_admin(p_user_id uuid, p_nota text default null)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not exists (
    select 1 from public.perfiles p
     where p.user_id = p_user_id and p.activo = true and p.rol = 'Propietario'
  ) then
    raise exception 'La cuenta debe tener un perfil Propietario activo' using errcode = '22023';
  end if;
  insert into private.plataforma_admins(user_id, nota)
  values (p_user_id, left(nullif(btrim(coalesce(p_nota, '')), ''), 200))
  on conflict (user_id) do nothing;
end;
$$;

-- Hace Propietario de una empresa a una cuenta que ya existe en Auth. Si la
-- cuenta no tiene perfil, lo crea como Propietario; si ya tiene otro rol, se
-- rechaza (una cuenta de empleado no puede pasar a ser dueña de una empresa).
create or replace function private.plataforma_vincular_propietario(
  p_empresa_id text,
  p_user_id uuid,
  p_nombre text default null
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_rol text;
  v_activo boolean;
  v_empleado text;
  v_perfil_existe boolean := false;
  v_membresia_id bigint;
begin
  if not exists (
    select 1 from auth.users u where u.id = p_user_id and u.deleted_at is null
  ) then
    raise exception 'La cuenta indicada no existe' using errcode = '22023';
  end if;

  select true, p.rol, p.activo, p.empleado_id
    into v_perfil_existe, v_rol, v_activo, v_empleado
    from public.perfiles p
   where p.user_id = p_user_id;

  if not coalesce(v_perfil_existe, false) then
    insert into public.perfiles(user_id, rol, empleado_id, nombre, activo)
    values (p_user_id, 'Propietario', null, left(nullif(btrim(coalesce(p_nombre, '')), ''), 160), true);
  else
    if v_rol <> 'Propietario' or v_empleado is not null then
      raise exception 'La cuenta ya tiene otro rol y no puede ser Propietario de una empresa' using errcode = '22023';
    end if;
    if v_activo is not true then
      raise exception 'La cuenta está desactivada' using errcode = '22023';
    end if;
  end if;

  v_membresia_id := hashtextextended(
    'la-suite-owner-membership:' || p_user_id::text || ':' || p_empresa_id, 0
  ) & 9223372036854775807::bigint;

  insert into public.membresias_usuario(id, user_id, empresa_id, local_id, todos_locales, rol, activo)
  values (v_membresia_id, p_user_id, p_empresa_id, null, true, 'Propietario', true)
  on conflict (id) do update set activo = true;

  return v_membresia_id;
end;
$$;

revoke all on function private.plataforma_registrar_admin(uuid, text) from public, anon, authenticated;
revoke all on function private.plataforma_vincular_propietario(text, uuid, text) from public, anon, authenticated;
revoke all on function private.plataforma_validar_operation_id(text) from public, anon;
revoke all on function private.plataforma_exigir_admin() from public, anon;
revoke all on function private.es_admin_plataforma() from public, anon;
grant execute on function private.es_admin_plataforma() to authenticated;

-- ---------------------------------------------------------------------------
-- Funciones de plataforma (API)
-- ---------------------------------------------------------------------------
create or replace function public.plataforma_estado()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;
  v_admin := private.es_admin_plataforma();
  if not v_admin then
    -- Quien no es administrador solo averigua si la plataforma está activa (hay algún administrador
    -- registrado): la pantalla de Empresas lo usa para no ofrecer «Añadir empresa» a un dueño cliente.
    return jsonb_build_object(
      'es_admin', false,
      'plataforma_activa', exists (select 1 from private.plataforma_admins)
    );
  end if;
  return jsonb_build_object(
    'es_admin', true,
    'plataforma_activa', true,
    'mis_empresas', (
      select count(distinct m.empresa_id)
        from public.membresias_usuario m
        join public.empresas e on e.id = m.empresa_id and e.activo = true
       where m.user_id = auth.uid() and m.activo = true
    ),
    'empresas_activas', (select count(*) from public.empresas e where e.activo = true),
    'empresas_desactivadas', (select count(*) from public.empresas e where e.activo = false)
  );
end;
$$;

create or replace function public.plataforma_listar_empresas()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.plataforma_exigir_admin();

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'nombre', e.nombre,
        'activa', e.activo,
        'creada_en', e.created_at,
        'baja_en', b.baja_en,
        'baja_motivo', b.motivo,
        'locales_activos', (select count(*) from public.locales l where l.empresa_id = e.id and l.activo = true),
        'locales_total', (select count(*) from public.locales l where l.empresa_id = e.id),
        'usuarios_activos', (select count(distinct m.user_id) from public.membresias_usuario m where m.empresa_id = e.id and m.activo = true),
        'usuarios_total', (select count(distinct m.user_id) from public.membresias_usuario m where m.empresa_id = e.id),
        'propietarios', coalesce((
          select jsonb_agg(
                   jsonb_build_object('user_id', m.user_id, 'nombre', p.nombre, 'email', u.email, 'activo', m.activo)
                   order by m.user_id)
            from public.membresias_usuario m
            left join public.perfiles p on p.user_id = m.user_id
            left join auth.users u on u.id = m.user_id
           where m.empresa_id = e.id and m.rol = 'Propietario'
        ), '[]'::jsonb)
      )
      order by e.created_at, e.id
    )
    from public.empresas e
    left join private.plataforma_bajas b on b.empresa_id = e.id and b.reactivada_en is null
  ), '[]'::jsonb);
end;
$$;

create or replace function public.plataforma_crear_empresa(
  p_operation_id text,
  p_nombre text,
  p_local_nombre text,
  p_cif text default null,
  p_propietario_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_nombre text := regexp_replace(btrim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  v_local text := regexp_replace(btrim(coalesce(p_local_nombre, '')), '\s+', ' ', 'g');
  v_cif text := nullif(upper(regexp_replace(coalesce(p_cif, ''), '[\s.-]', '', 'g')), '');
  v_peticion text;
  v_prev record;
  v_empresa_id text;
  v_local_id text;
  v_res jsonb;
begin
  perform private.plataforma_exigir_admin();
  perform private.plataforma_validar_operation_id(p_operation_id);

  if char_length(v_nombre) < 2 or char_length(v_nombre) > 160 then
    raise exception 'Nombre de empresa inválido' using errcode = '22023';
  end if;
  if char_length(v_local) < 2 or char_length(v_local) > 160 then
    raise exception 'Nombre de local inválido' using errcode = '22023';
  end if;
  if v_cif is not null and v_cif !~ '^[A-Z0-9]{5,20}$' then
    raise exception 'CIF/NIF no válido' using errcode = '22023';
  end if;

  v_peticion := jsonb_build_object('n', v_nombre, 'l', v_local, 'c', v_cif, 'u', p_propietario_user_id)::text;

  perform pg_advisory_xact_lock(hashtextextended('la-suite:plataforma:op:' || p_operation_id, 0));
  select a.accion, a.peticion, a.resultado into v_prev
    from private.plataforma_auditoria a where a.operation_id = p_operation_id;
  if found then
    if v_prev.accion <> 'crear_empresa' or v_prev.peticion is distinct from v_peticion then
      raise exception 'operation_id reutilizado con otra petición' using errcode = '22023';
    end if;
    return v_prev.resultado || jsonb_build_object('idempotente', true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('la-suite:plataforma:alta', 0));
  if exists (select 1 from public.empresas e where lower(btrim(e.nombre)) = lower(v_nombre)) then
    raise exception 'Ya existe una empresa con ese nombre' using errcode = '23505';
  end if;
  if v_cif is not null and exists (select 1 from public.empresas e where upper(e.datos ->> 'nif') = v_cif) then
    raise exception 'Ya existe una empresa con ese CIF/NIF' using errcode = '23505';
  end if;

  v_empresa_id := 'empresa-' || substr(md5(gen_random_uuid()::text), 1, 16);
  v_local_id := 'local-' || substr(md5(gen_random_uuid()::text), 1, 16);

  insert into public.empresas(id, nombre, activo, datos)
  values (
    v_empresa_id, v_nombre, true,
    jsonb_strip_nulls(jsonb_build_object('razonSocial', v_nombre, 'marca', v_nombre, 'nif', v_cif))
  );

  insert into public.locales(id, empresa_id, nombre, activo, datos)
  values (v_local_id, v_empresa_id, v_local, true, '{}'::jsonb);

  if p_propietario_user_id is not null then
    perform private.plataforma_vincular_propietario(v_empresa_id, p_propietario_user_id, null);
  end if;

  v_res := jsonb_build_object(
    'ok', true,
    'empresa_id', v_empresa_id,
    'local_id', v_local_id,
    'propietario_vinculado', p_propietario_user_id is not null
  );

  insert into private.plataforma_auditoria(actor, accion, empresa_id, operation_id, peticion, detalle, resultado)
  values (auth.uid(), 'crear_empresa', v_empresa_id, p_operation_id, v_peticion,
          jsonb_build_object('local_id', v_local_id, 'propietario_vinculado', p_propietario_user_id is not null), v_res);

  return v_res;
end;
$$;

create or replace function public.plataforma_asignar_propietario(
  p_operation_id text,
  p_empresa_id text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_empresa public.empresas%rowtype;
  v_peticion text;
  v_prev record;
  v_res jsonb;
begin
  perform private.plataforma_exigir_admin();
  perform private.plataforma_validar_operation_id(p_operation_id);

  v_peticion := jsonb_build_object('e', p_empresa_id, 'u', p_user_id)::text;

  perform pg_advisory_xact_lock(hashtextextended('la-suite:plataforma:op:' || p_operation_id, 0));
  select a.accion, a.peticion, a.resultado into v_prev
    from private.plataforma_auditoria a where a.operation_id = p_operation_id;
  if found then
    if v_prev.accion <> 'asignar_propietario' or v_prev.peticion is distinct from v_peticion then
      raise exception 'operation_id reutilizado con otra petición' using errcode = '22023';
    end if;
    return v_prev.resultado || jsonb_build_object('idempotente', true);
  end if;

  select * into v_empresa from public.empresas e where e.id = p_empresa_id for update;
  if not found then
    raise exception 'Empresa no encontrada' using errcode = 'P0002';
  end if;
  if v_empresa.activo is not true then
    raise exception 'La empresa está desactivada: reactívala antes de asignarle un propietario' using errcode = '22023';
  end if;

  perform private.plataforma_vincular_propietario(p_empresa_id, p_user_id, null);

  v_res := jsonb_build_object('ok', true, 'empresa_id', p_empresa_id, 'propietario_vinculado', true);

  insert into private.plataforma_auditoria(actor, accion, empresa_id, operation_id, peticion, detalle, resultado)
  values (auth.uid(), 'asignar_propietario', p_empresa_id, p_operation_id, v_peticion, '{}'::jsonb, v_res);

  return v_res;
end;
$$;

create or replace function public.plataforma_desactivar_empresa(
  p_operation_id text,
  p_empresa_id text,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_empresa public.empresas%rowtype;
  v_motivo text := left(nullif(btrim(coalesce(p_motivo, '')), ''), 500);
  v_peticion text;
  v_prev record;
  v_mems bigint[];
  v_locs text[];
  v_res jsonb;
begin
  perform private.plataforma_exigir_admin();
  perform private.plataforma_validar_operation_id(p_operation_id);

  v_peticion := jsonb_build_object('e', p_empresa_id, 'm', v_motivo)::text;

  perform pg_advisory_xact_lock(hashtextextended('la-suite:plataforma:op:' || p_operation_id, 0));
  select a.accion, a.peticion, a.resultado into v_prev
    from private.plataforma_auditoria a where a.operation_id = p_operation_id;
  if found then
    if v_prev.accion <> 'desactivar_empresa' or v_prev.peticion is distinct from v_peticion then
      raise exception 'operation_id reutilizado con otra petición' using errcode = '22023';
    end if;
    return v_prev.resultado || jsonb_build_object('idempotente', true);
  end if;

  select * into v_empresa from public.empresas e where e.id = p_empresa_id for update;
  if not found then
    raise exception 'Empresa no encontrada' using errcode = 'P0002';
  end if;

  if v_empresa.activo is not true then
    v_res := jsonb_build_object('ok', true, 'empresa_id', p_empresa_id, 'ya_estaba_desactivada', true);
  else
    select coalesce(array_agg(m.id order by m.id), '{}'::bigint[]) into v_mems
      from public.membresias_usuario m
     where m.empresa_id = p_empresa_id and m.activo = true;
    select coalesce(array_agg(l.id order by l.id), '{}'::text[]) into v_locs
      from public.locales l
     where l.empresa_id = p_empresa_id and l.activo = true;

    update public.membresias_usuario set activo = false where id = any(v_mems);
    update public.locales set activo = false where empresa_id = p_empresa_id and id = any(v_locs);
    update public.empresas set activo = false where id = p_empresa_id;

    insert into private.plataforma_bajas(empresa_id, motivo, por_user, membresias_desactivadas, locales_desactivados, reactivada_en)
    values (p_empresa_id, v_motivo, auth.uid(), v_mems, v_locs, null)
    on conflict (empresa_id) do update
      set baja_en = now(),
          motivo = excluded.motivo,
          por_user = excluded.por_user,
          membresias_desactivadas = excluded.membresias_desactivadas,
          locales_desactivados = excluded.locales_desactivados,
          reactivada_en = null;

    v_res := jsonb_build_object(
      'ok', true,
      'empresa_id', p_empresa_id,
      'ya_estaba_desactivada', false,
      'membresias_desactivadas', cardinality(v_mems),
      'locales_desactivados', cardinality(v_locs)
    );
  end if;

  insert into private.plataforma_auditoria(actor, accion, empresa_id, operation_id, peticion, detalle, resultado)
  values (auth.uid(), 'desactivar_empresa', p_empresa_id, p_operation_id, v_peticion,
          jsonb_build_object('motivo', v_motivo), v_res);

  return v_res;
end;
$$;

create or replace function public.plataforma_reactivar_empresa(
  p_operation_id text,
  p_empresa_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_empresa public.empresas%rowtype;
  v_baja private.plataforma_bajas%rowtype;
  v_hay_baja boolean := false;
  v_peticion text;
  v_prev record;
  v_locs int := 0;
  v_mems int := 0;
  v_res jsonb;
begin
  perform private.plataforma_exigir_admin();
  perform private.plataforma_validar_operation_id(p_operation_id);

  v_peticion := jsonb_build_object('e', p_empresa_id)::text;

  perform pg_advisory_xact_lock(hashtextextended('la-suite:plataforma:op:' || p_operation_id, 0));
  select a.accion, a.peticion, a.resultado into v_prev
    from private.plataforma_auditoria a where a.operation_id = p_operation_id;
  if found then
    if v_prev.accion <> 'reactivar_empresa' or v_prev.peticion is distinct from v_peticion then
      raise exception 'operation_id reutilizado con otra petición' using errcode = '22023';
    end if;
    return v_prev.resultado || jsonb_build_object('idempotente', true);
  end if;

  select * into v_empresa from public.empresas e where e.id = p_empresa_id for update;
  if not found then
    raise exception 'Empresa no encontrada' using errcode = 'P0002';
  end if;

  if v_empresa.activo is true then
    v_res := jsonb_build_object('ok', true, 'empresa_id', p_empresa_id, 'ya_estaba_activa', true);
  else
    select * into v_baja from private.plataforma_bajas b where b.empresa_id = p_empresa_id and b.reactivada_en is null;
    v_hay_baja := found;

    update public.empresas set activo = true where id = p_empresa_id;

    if v_hay_baja then
      update public.locales set activo = true
       where empresa_id = p_empresa_id and id = any(v_baja.locales_desactivados);
      get diagnostics v_locs = row_count;

      update public.membresias_usuario set activo = true
       where empresa_id = p_empresa_id and id = any(v_baja.membresias_desactivadas);
      get diagnostics v_mems = row_count;
    else
      -- Baja hecha por otra vía (pantalla de Empresas): no hay registro de qué
      -- se desactivó. Se reactiva la empresa y su local más antiguo, para no
      -- dejar una empresa activa sin ningún local activo.
      update public.locales set activo = true
       where id = (
         select l.id from public.locales l
          where l.empresa_id = p_empresa_id
          order by l.created_at, l.id
          limit 1
       );
      get diagnostics v_locs = row_count;
    end if;

    update private.plataforma_bajas set reactivada_en = now()
     where empresa_id = p_empresa_id and reactivada_en is null;

    v_res := jsonb_build_object(
      'ok', true,
      'empresa_id', p_empresa_id,
      'ya_estaba_activa', false,
      'sin_registro_de_baja', not v_hay_baja,
      'locales_reactivados', v_locs,
      'membresias_reactivadas', v_mems
    );
  end if;

  insert into private.plataforma_auditoria(actor, accion, empresa_id, operation_id, peticion, detalle, resultado)
  values (auth.uid(), 'reactivar_empresa', p_empresa_id, p_operation_id, v_peticion, '{}'::jsonb, v_res);

  return v_res;
end;
$$;

revoke all on function public.plataforma_estado() from public, anon;
revoke all on function public.plataforma_listar_empresas() from public, anon;
revoke all on function public.plataforma_crear_empresa(text, text, text, text, uuid) from public, anon;
revoke all on function public.plataforma_asignar_propietario(text, text, uuid) from public, anon;
revoke all on function public.plataforma_desactivar_empresa(text, text, text) from public, anon;
revoke all on function public.plataforma_reactivar_empresa(text, text) from public, anon;
grant execute on function public.plataforma_estado() to authenticated;
grant execute on function public.plataforma_listar_empresas() to authenticated;
grant execute on function public.plataforma_crear_empresa(text, text, text, text, uuid) to authenticated;
grant execute on function public.plataforma_asignar_propietario(text, text, uuid) to authenticated;
grant execute on function public.plataforma_desactivar_empresa(text, text, text) to authenticated;
grant execute on function public.plataforma_reactivar_empresa(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Guarda en guardar_contexto_instalacion_ui (versión PM29 + guarda de plataforma)
-- ---------------------------------------------------------------------------
create or replace function public.guardar_contexto_instalacion_ui(
  p_clave text,
  p_valor jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_clave text := btrim(coalesce(p_clave, ''));
  v_item jsonb;
  v_id text;
  v_empresa_id text;
  v_nombre text;
  v_activo boolean;
  v_membresia_id bigint;
  v_datos jsonb;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.perfiles p
    where p.user_id = v_uid
      and p.activo = true
      and p.rol = 'Propietario'
  ) then
    raise exception 'Propietario requerido' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('la-suite:ui-context:' || v_uid::text, 0));

  if v_clave = 'empresas' then
    if jsonb_typeof(p_valor) <> 'array' then
      raise exception 'empresas debe ser una lista' using errcode = '22023';
    end if;

    for v_item in select value from jsonb_array_elements(p_valor)
    loop
      if jsonb_typeof(v_item) <> 'object' or octet_length(v_item::text) > 131072 then
        raise exception 'Empresa inválida' using errcode = '22023';
      end if;

      v_id := btrim(coalesce(v_item->>'id', ''));
      v_nombre := nullif(btrim(coalesce(v_item->>'razonSocial', v_item->>'marca', v_item->>'nombre', '')), '');
      if v_id !~ '^[A-Za-z0-9._:-]{1,120}$' or v_nombre is null or char_length(v_nombre) > 160 then
        raise exception 'Identidad de empresa inválida' using errcode = '22023';
      end if;

      -- PM29: omitir 'activo' conserva el valor ya guardado. Antes se descartaba
      -- el campo entero, asi que una baja logica se aceptaba y se ignoraba en
      -- silencio; con este coalesce tampoco se reactiva nada sin pedirlo.
      v_activo := case
        when v_item ? 'activo' then (v_item->>'activo')::boolean
        else coalesce((select e.activo from public.empresas e where e.id = v_id), true)
      end;

      if exists (select 1 from public.empresas e where e.id = v_id) then
        if not exists (
          select 1 from public.membresias_usuario m
          where m.user_id = v_uid and m.empresa_id = v_id
            and m.activo = true and m.rol = 'Propietario'
        ) then
          raise exception 'Empresa fuera del alcance del Propietario' using errcode = '42501';
        end if;

        -- PM29: la baja de una empresa es logica (la fila nunca se borra) y
        -- arrastra sus locales en la misma operacion.
        --
        -- Se intento lo contrario: bloquear la baja mientras la empresa tuviera
        -- locales activos. No funciona. Como ademas no se puede quitar a una
        -- empresa activa su ultimo local, una empresa de un solo local no se
        -- habria podido dar de baja jamas. Y relajar aquel freno para romper el
        -- bloqueo dejaba algo peor: empresas activas sin ningun local, y la
        -- lectura del contexto emparejando una empresa con el local de otra.
        -- Arrastrar los locales es lo que "dar de baja la empresa" significa.
        if v_activo = false
           and exists (select 1 from public.empresas e where e.id = v_id and e.activo = true) then
          if not exists (
            select 1
            from public.membresias_usuario m
            join public.empresas e on e.id = m.empresa_id and e.activo = true
            where m.user_id = v_uid
              and m.activo = true
              and e.id <> v_id
          ) then
            raise exception 'No se puede desactivar la ultima empresa activa' using errcode = '22023';
          end if;

          update public.locales
          set activo = false
          where empresa_id = v_id
            and activo = true;
        end if;
      else
        -- PLATAFORMA F1: en cuanto existe un administrador de plataforma, solo un
        -- administrador puede crear empresas. Mientras no haya ninguno
        -- registrado, todo funciona como hasta ahora (instalaciones y pruebas sin
        -- administrador no cambian).
        if exists (select 1 from private.plataforma_admins)
           and not private.es_admin_plataforma() then
          raise exception 'Solo el administrador de la plataforma puede crear empresas' using errcode = '42501';
        end if;

        if v_activo = false then
          raise exception 'Una empresa nueva debe crearse activa' using errcode = '22023';
        end if;

        insert into public.empresas(id, nombre, activo, datos)
        values (v_id, v_nombre, true, '{}'::jsonb);

        v_membresia_id := hashtextextended(
          'la-suite-owner-membership:' || v_uid::text || ':' || v_id, 0
        ) & 9223372036854775807::bigint;

        insert into public.membresias_usuario(
          id, user_id, empresa_id, local_id, todos_locales, rol, activo
        ) values (
          v_membresia_id, v_uid, v_id, null, true, 'Propietario', true
        );
      end if;

      v_datos := v_item - 'id' - 'activo' - 'created_at' - 'createdAt';
      update public.empresas
      set nombre = v_nombre,
          activo = v_activo,
          datos = v_datos
      where id = v_id;
    end loop;

  elsif v_clave = 'locales' then
    if jsonb_typeof(p_valor) <> 'array' then
      raise exception 'locales debe ser una lista' using errcode = '22023';
    end if;

    for v_item in select value from jsonb_array_elements(p_valor)
    loop
      if jsonb_typeof(v_item) <> 'object' or octet_length(v_item::text) > 131072 then
        raise exception 'Local inválido' using errcode = '22023';
      end if;

      v_id := btrim(coalesce(v_item->>'id', ''));
      v_empresa_id := btrim(coalesce(v_item->>'empresaId', v_item->>'empresa_id', ''));
      v_nombre := nullif(btrim(coalesce(v_item->>'nombre', '')), '');
      v_activo := case
        when v_item ? 'activo' then (v_item->>'activo')::boolean
        else true
      end;

      if v_id !~ '^[A-Za-z0-9._:-]{1,120}$'
         or v_empresa_id !~ '^[A-Za-z0-9._:-]{1,120}$'
         or v_nombre is null or char_length(v_nombre) > 160 then
        raise exception 'Identidad de local inválida' using errcode = '22023';
      end if;

      -- La pertenencia se exige siempre: el local tiene que ser de una empresa
      -- del propietario.
      if not exists (
        select 1
        from public.membresias_usuario m
        where m.user_id = v_uid
          and m.empresa_id = v_empresa_id
          and m.activo = true
          and m.rol = 'Propietario'
      ) then
        raise exception 'Empresa del local fuera del alcance del Propietario' using errcode = '42501';
      end if;

      -- Que la empresa este activa solo se exige para tener el local ACTIVO. Un
      -- local ya inactivo de una empresa dada de baja tiene que poder seguir en
      -- la lista sin tumbar el guardado de todos los demas.
      if v_activo = true
         and not exists (
           select 1 from public.empresas e
           where e.id = v_empresa_id and e.activo = true
         ) then
        raise exception 'La empresa del local esta dada de baja: reactivala antes' using errcode = '22023';
      end if;

      if exists (select 1 from public.locales l where l.id = v_id) then
        if not exists (
          select 1 from public.locales l
          where l.id = v_id and l.empresa_id = v_empresa_id
        ) then
          raise exception 'El local pertenece a otra empresa' using errcode = '42501';
        end if;

        if v_activo = false
           and exists (select 1 from public.locales l where l.id = v_id and l.activo = true)
           and not exists (
             select 1 from public.locales l
             where l.empresa_id = v_empresa_id and l.activo = true and l.id <> v_id
           ) then
          raise exception 'No se puede desactivar el último local activo de la empresa' using errcode = '22023';
        end if;
      elsif v_activo = false then
        raise exception 'Un local nuevo debe crearse activo' using errcode = '22023';
      end if;

      v_datos := v_item - 'id' - 'empresaId' - 'empresa_id' - 'nombre' - 'activo' - 'created_at' - 'createdAt';

      insert into public.locales(id, empresa_id, nombre, activo, datos)
      values (v_id, v_empresa_id, v_nombre, v_activo, v_datos)
      on conflict (id) do update
      set nombre = excluded.nombre,
          activo = excluded.activo,
          datos = excluded.datos
      where public.locales.empresa_id = excluded.empresa_id;
    end loop;

  elsif v_clave = 'localActivoId' then
    if p_valor is null or jsonb_typeof(p_valor) = 'null' then
      if not exists (
        select 1
        from public.membresias_usuario m
        where m.user_id = v_uid
          and m.activo = true
          and m.rol = 'Propietario'
          and m.todos_locales = true
      ) then
        raise exception 'Vista consolidada no permitida' using errcode = '42501';
      end if;
    elsif jsonb_typeof(p_valor) = 'string' then
      v_id := p_valor #>> '{}';
      if not exists (
        select 1
        from public.membresias_usuario m
        join public.locales l
          on l.empresa_id = m.empresa_id
         and l.id = v_id
         and l.activo = true
         and (m.todos_locales = true or m.local_id = l.id)
        where m.user_id = v_uid
          and m.activo = true
          and m.rol = 'Propietario'
      ) then
        raise exception 'Local activo fuera del alcance del Propietario' using errcode = '42501';
      end if;
    else
      raise exception 'localActivoId inválido' using errcode = '22023';
    end if;
  else
    raise exception 'Clave de contexto UI no permitida' using errcode = '22023';
  end if;

  return public.obtener_contexto_instalacion_ui();
end;
$$;

revoke all on function public.guardar_contexto_instalacion_ui(text, jsonb) from public, anon;
grant execute on function public.guardar_contexto_instalacion_ui(text, jsonb) to authenticated;

commit;
