-- P2-R03B · Auditoría tenant-aware post-reset
-- Preparado para la rama p2-r03a-runtime-post-reset.
-- Objetivo:
--   * restaurar el contrato de 8 parámetros que consume fuente.js;
--   * conservar auditoria_registro y su payload JSON histórico;
--   * aislar lectura por empresa/local sin ampliar el acceso más allá de Propietario;
--   * hacer la escritura append-only y exclusiva por RPC;
--   * detectar replay conflictivo en vez de ocultarlo con ON CONFLICT DO NOTHING.
--
-- IMPORTANTE: esta migración se prepara primero en GitHub. No implica aplicación a QA/PROD.

begin;

-- ---------------------------------------------------------------------------
-- 0. Preflight: fallar cerrado si el sustrato post-reset no coincide.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.auditoria_registro') is null
     or to_regclass('public.empresas') is null
     or to_regclass('public.locales') is null
     or to_regclass('public.membresias_usuario') is null then
    raise exception 'P2_R03B_PREFLIGHT_FALLO: tablas base ausentes';
  end if;

  if to_regprocedure('private.la_usuario_activo()') is null
     or to_regprocedure('private.la_tiene_empresa(text)') is null
     or to_regprocedure('private.la_tiene_local(text,text)') is null then
    raise exception 'P2_R03B_PREFLIGHT_FALLO: helpers tenant ausentes';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='locales'
      and column_name='empresa_id' and data_type='text'
  ) then
    raise exception 'P2_R03B_PREFLIGHT_FALLO: locales.empresa_id incompatible';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='membresias_usuario'
      and column_name='todos_locales' and data_type='boolean'
  ) then
    raise exception 'P2_R03B_PREFLIGHT_FALLO: membresias_usuario.todos_locales ausente';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Contexto tenant explícito. Se conserva la estructura/payload existente.
--    Columnas nullable para no destruir posibles filas legacy sin tenant.
-- ---------------------------------------------------------------------------
alter table public.auditoria_registro
  add column if not exists empresa_id text,
  add column if not exists local_id text,
  add column if not exists actor_user_id uuid;

create index if not exists auditoria_registro_tenant_fecha_idx
  on public.auditoria_registro(empresa_id,local_id,fecha,creado_en);

-- ---------------------------------------------------------------------------
-- 2. RLS fail-closed. El paquete pasa a ser dueño del contrato RLS de auditoría:
--    se retira cualquier política histórica y se crea una única lectura.
--    No existe política INSERT/UPDATE/DELETE para roles de aplicación.
-- ---------------------------------------------------------------------------
alter table public.auditoria_registro enable row level security;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
      from pg_policies
     where schemaname='public'
       and tablename='auditoria_registro'
  loop
    execute format(
      'drop policy %I on public.auditoria_registro',
      v_policy.policyname
    );
  end loop;
end;
$$;

create policy auditoria_p2_r03b_select
on public.auditoria_registro
for select
to authenticated
using (
  private.la_usuario_activo()
  and empresa_id is not null
  and exists (
    select 1
      from public.membresias_usuario m
     where m.user_id=(select auth.uid())
       and m.empresa_id=auditoria_registro.empresa_id
       and m.activo=true
       and m.rol='Propietario'
       and (
         auditoria_registro.local_id is null
         or m.todos_locales=true
         or m.local_id=auditoria_registro.local_id
       )
  )
  and (
    local_id is null
    or exists (
      select 1
        from public.locales l
       where l.id=auditoria_registro.local_id
         and l.empresa_id=auditoria_registro.empresa_id
    )
  )
);

-- Auditoría append-only para la aplicación: lectura por RLS, mutación solo por RPC.
revoke all privileges on table public.auditoria_registro
  from public, anon, authenticated;
grant select on table public.auditoria_registro to authenticated;

-- ---------------------------------------------------------------------------
-- 3. RPC de 8 parámetros compatible con el frontend actual.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_auditoria(
  p_id text,
  p_usuario text,
  p_accion text,
  p_detalle text,
  p_fecha date,
  p_hora text,
  p_empresa_id text,
  p_local_id text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id text := nullif(btrim(p_id),'');
  v_usuario text := coalesce(nullif(btrim(p_usuario),''),'Sin identificar');
  v_accion text := nullif(btrim(p_accion),'');
  v_detalle text := coalesce(p_detalle,'');
  v_fecha date := coalesce(p_fecha,current_date);
  v_hora text := coalesce(nullif(btrim(p_hora),''),to_char(clock_timestamp(),'HH24:MI'));
  v_empresa text := nullif(btrim(p_empresa_id),'');
  v_local text := nullif(btrim(p_local_id),'');
  v_datos jsonb;
  v_actor_existente uuid;
  v_empresa_existente text;
  v_local_existente text;
  v_fecha_existente date;
  v_datos_existentes jsonb;
  v_insertados integer := 0;
begin
  if v_uid is null or not private.la_usuario_activo() then
    raise exception 'usuario_inactivo_o_no_autenticado';
  end if;

  if v_id is null then
    raise exception 'auditoria_id_invalido';
  end if;

  if v_accion is null then
    raise exception 'auditoria_accion_requerida';
  end if;

  -- Compatibilidad controlada: si empresa llega vacía, solo se infiere cuando
  -- el actor posee exactamente una empresa activa. Multiempresa ambiguo falla.
  if v_empresa is null then
    select case when count(distinct m.empresa_id)=1 then min(m.empresa_id) end
      into v_empresa
      from public.membresias_usuario m
     where m.user_id=v_uid
       and m.activo=true;
  end if;

  if v_empresa is null or not private.la_tiene_empresa(v_empresa) then
    raise exception 'empresa_no_autorizada';
  end if;

  if v_local is not null and upper(v_local)='TODOS' then
    v_local := null;
  end if;

  if v_local is not null then
    if not exists (
      select 1
        from public.locales l
       where l.id=v_local
         and l.empresa_id=v_empresa
    ) then
      raise exception 'local_empresa_incompatible';
    end if;

    if not private.la_tiene_local(v_empresa,v_local) then
      raise exception 'local_no_autorizado';
    end if;
  end if;

  v_datos := jsonb_build_object(
    'id',v_id,
    'fecha',v_fecha::text,
    'hora',v_hora,
    'usuario',v_usuario,
    'usuarioAutenticado',v_uid::text,
    'accion',v_accion,
    'detalle',v_detalle,
    'empresaId',v_empresa,
    'localId',v_local,
    'actorUserId',v_uid
  );

  insert into public.auditoria_registro(
    id,fecha,datos,empresa_id,local_id,actor_user_id
  ) values (
    v_id,v_fecha,v_datos,v_empresa,v_local,v_uid
  )
  on conflict (id) do nothing;

  get diagnostics v_insertados = row_count;

  if v_insertados=0 then
    select a.fecha,a.datos,a.empresa_id,a.local_id,a.actor_user_id
      into v_fecha_existente,v_datos_existentes,v_empresa_existente,
           v_local_existente,v_actor_existente
      from public.auditoria_registro a
     where a.id=v_id;

    if not found then
      raise exception 'auditoria_replay_no_resuelto';
    end if;

    if v_fecha_existente is distinct from v_fecha
       or v_datos_existentes is distinct from v_datos
       or v_empresa_existente is distinct from v_empresa
       or v_local_existente is distinct from v_local
       or v_actor_existente is distinct from v_uid then
      raise exception 'auditoria_id_conflict';
    end if;
  end if;

  return jsonb_build_object(
    'ok',true,
    'id',v_id,
    'empresaId',v_empresa,
    'localId',v_local,
    'actorUserId',v_uid,
    'replayed',(v_insertados=0)
  );
end;
$$;

-- SECURITY DEFINER no debe heredar EXECUTE público implícito.
revoke all on function public.registrar_auditoria(
  text,text,text,text,date,text,text,text
) from public, anon, authenticated;
grant execute on function public.registrar_auditoria(
  text,text,text,text,date,text,text,text
) to authenticated;

-- Las firmas legacy permanecen para compatibilidad histórica del catálogo,
-- pero dejan de ser puntos de entrada de la aplicación.
do $$
begin
  if to_regprocedure('public.registrar_auditoria(text,text,text)') is not null then
    execute 'revoke all on function public.registrar_auditoria(text,text,text) from public, anon, authenticated';
  end if;

  if to_regprocedure('public.registrar_auditoria(text,text,text,text,text,text)') is not null then
    execute 'revoke all on function public.registrar_auditoria(text,text,text,text,text,text) from public, anon, authenticated';
  end if;
end;
$$;

-- Guardia explícita: este paquete nunca reabre RPC legacy cerradas en P2-R02.
do $$
begin
  if to_regprocedure('public.anular_venta_tpv(text,text)') is not null then
    execute 'revoke all on function public.anular_venta_tpv(text,text) from public, anon, authenticated';
  end if;
  if to_regprocedure('public.descontar_stock(text,numeric,text,jsonb)') is not null then
    execute 'revoke all on function public.descontar_stock(text,numeric,text,jsonb) from public, anon, authenticated';
  end if;
  if to_regprocedure('public.descontar_stock_carrito(jsonb,text)') is not null then
    execute 'revoke all on function public.descontar_stock_carrito(jsonb,text) from public, anon, authenticated';
  end if;
end;
$$;

commit;
