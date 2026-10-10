-- PLATAFORMA F4d — una empresa dada de baja no cuenta al decidir «en qué empresa guarda esta cuenta».
--
-- Problema que resuelve
--   F4 decide la empresa de una cuenta mirando sus membresías activas. Una cuenta que tuviera
--   membresía activa en dos empresas queda «ambigua» y falla cerrado (almacen_kv_empresa_no_determinada /
--   almacen_kv_empresa_ambigua). Eso ocurría también cuando una de las dos empresas estaba dada de
--   baja, porque la membresía seguía activa aunque la empresa no (estado heredado de pruebas y de
--   producción anteriores a la baja de empresas; la baja actual de la plataforma desactiva también las
--   membresías). Resultado visible: la persona abría su empresa viva y el programa no podía guardar
--   (banner rojo «No se han podido cargar tus datos guardados (productos — revisa el acceso)»).
--
-- Qué hace
--   Redefine, con `create or replace` y la misma firma, las tres funciones de F4 que miran membresías:
--     * private.plataforma_kv_permitido     — acceso a una fila: ahora exige además que la empresa esté activa;
--     * private.plataforma_kv_empresa_llamante — empresa de la fila `key` que ve la cuenta: solo empresas activas;
--     * private.plataforma_f4_kv_empresa    — empresa de las filas nuevas: solo empresas activas.
--   Las políticas no cambian (llaman a plataforma_kv_permitido). Las empresas activas no notan ningún
--   cambio. Una empresa dada de baja queda invisible y no escribible en almacen_kv para sus antiguos
--   miembros, igual que ya lo está para quien no pertenece a ella; sus datos no se tocan. Si se reactiva,
--   vuelve a ser visible.
--   Una cuenta con membresía activa en DOS empresas ACTIVAS sigue fallando cerrado (una cuenta = una empresa).
--
-- No cambia datos, tablas, claves ni políticas. Debe aplicarse DESPUÉS de F4.
-- Este archivo NO se aplica automáticamente a producción desde esta rama.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $f4d$
declare
  v_def text;
begin
  if to_regprocedure('private.plataforma_kv_permitido(text,text,text,text)') is null
     or to_regprocedure('private.plataforma_kv_empresa_llamante(text)') is null
     or to_regprocedure('private.plataforma_f4_kv_empresa()') is null then
    raise exception 'PLATAFORMA_F4D_PREVIO:falta_F4';
  end if;
  if to_regclass('public.empresas') is null
     or not exists (
       select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'empresas' and column_name = 'activo'
     ) then
    raise exception 'PLATAFORMA_F4D_PREVIO:empresas_sin_columna_activo';
  end if;
  -- Debe ser la versión de F4 (todavía sin el filtro de empresa activa), o ya la de F4d.
  v_def := pg_get_functiondef('private.plataforma_kv_permitido(text,text,text,text)'::regprocedure);
  if position('private.plataforma_kv_rol_puede' in v_def) = 0 then
    raise exception 'PLATAFORMA_F4D_PREVIO:plataforma_kv_permitido_inesperada';
  end if;
end
$f4d$;

-- Decisión de acceso a una fila: la empresa está activa, la persona pertenece a ella (membresía activa)
-- y su rol EN ESA EMPRESA puede tocar esa clave. p_accion = 'borrar' exige Propietario.
create or replace function private.plataforma_kv_permitido(p_empresa text, p_local text, p_key text, p_accion text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_empresa is not null
     and p_key is not null
     and private.la_tiene_empresa(p_empresa)
     and (p_local is null or private.la_tiene_local(p_empresa, p_local))
     and exists (
       select 1
         from public.membresias_usuario m
         join public.empresas e on e.id = m.empresa_id and e.activo = true
        where m.user_id = auth.uid()
          and m.empresa_id = p_empresa
          and m.activo = true
          and (p_accion is distinct from 'borrar' or m.rol = 'Propietario')
          and private.plataforma_kv_rol_puede(m.rol, p_key)
     )
$$;

-- Empresa de la fila `p_key` que ve el llamante: null si no hay ninguna; error si hay varias.
create or replace function private.plataforma_kv_empresa_llamante(p_key text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_n integer;
  v_empresa text;
begin
  select count(*), min(k.empresa_id)
    into v_n, v_empresa
    from public.almacen_kv k
   where k.key = p_key
     and exists (
       select 1
         from public.membresias_usuario m
         join public.empresas e on e.id = m.empresa_id and e.activo = true
        where m.user_id = auth.uid() and m.empresa_id = k.empresa_id and m.activo = true
     );
  if v_n = 0 then return null; end if;
  if v_n > 1 then
    raise exception 'almacen_kv_empresa_ambigua' using errcode = '42501';
  end if;
  return v_empresa;
end
$$;

-- Disparador: empresa de las filas nuevas y empresa inmutable desde la API.
create or replace function private.plataforma_f4_kv_empresa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
  v_empresa text;
begin
  if tg_op = 'INSERT' then
    if nullif(btrim(coalesce(new.empresa_id, '')), '') is not null then
      return new;
    end if;
    new.empresa_id := null;
    if jsonb_typeof(new.value) = 'object'
       and nullif(btrim(coalesce(new.value->>'empresaId', '')), '') is not null then
      new.empresa_id := btrim(new.value->>'empresaId');
      return new;
    end if;
    if v_uid is null then
      return new; -- sin usuario (servicio, migración): lo resuelve NOT NULL
    end if;
    select count(distinct m.empresa_id), min(m.empresa_id)
      into v_n, v_empresa
      from public.membresias_usuario m
      join public.empresas e on e.id = m.empresa_id and e.activo = true
     where m.user_id = v_uid and m.activo = true;
    if v_n = 1 then
      new.empresa_id := v_empresa;
      return new;
    end if;
    raise exception 'almacen_kv_empresa_no_determinada' using errcode = '42501';
  end if;

  if v_uid is not null and new.empresa_id is distinct from old.empresa_id then
    raise exception 'almacen_kv_empresa_inmutable' using errcode = '42501';
  end if;
  return new;
end
$$;

revoke all on function private.plataforma_kv_permitido(text, text, text, text) from public, anon, authenticated;
revoke all on function private.plataforma_kv_empresa_llamante(text) from public, anon, authenticated;
revoke all on function private.plataforma_f4_kv_empresa() from public, anon, authenticated;
-- Las políticas se evalúan con el rol del usuario: necesita ejecutar esta función.
grant execute on function private.plataforma_kv_permitido(text, text, text, text) to authenticated;

do $f4d$
begin
  if position('e.activo = true' in pg_get_functiondef('private.plataforma_kv_permitido(text,text,text,text)'::regprocedure)) = 0
     or position('e.activo = true' in pg_get_functiondef('private.plataforma_kv_empresa_llamante(text)'::regprocedure)) = 0
     or position('e.activo = true' in pg_get_functiondef('private.plataforma_f4_kv_empresa()'::regprocedure)) = 0 then
    raise exception 'PLATAFORMA_F4D_FINAL:funciones_sin_filtro_de_empresa_activa';
  end if;
  if (select count(*) from pg_policy where polrelid = 'public.almacen_kv'::regclass
         and polname in ('plataforma_kv_select','plataforma_kv_insert','plataforma_kv_update','plataforma_kv_delete')) <> 4 then
    raise exception 'PLATAFORMA_F4D_FINAL:politicas_de_F4_ausentes';
  end if;
end
$f4d$;

commit;
