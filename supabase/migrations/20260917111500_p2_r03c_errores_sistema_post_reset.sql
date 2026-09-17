-- P2-R03C · errores_sistema post-reset
-- Candidato GitHub-only: reconcilia el contrato real del frontend con el estado
-- legacy/post-reset sin tocar datos existentes ni inventar tenant para filas históricas.
-- Las filas sin empresa_id permanecen deliberadamente invisibles (fail closed).

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  v_bad_columns text;
begin
  if to_regclass('public.errores_sistema') is null
     or to_regclass('public.membresias_usuario') is null
     or to_regclass('public.locales') is null
     or to_regprocedure('auth.uid()') is null
     or to_regprocedure('private.la_usuario_activo()') is null then
    raise exception 'P2_R03C_PREFLIGHT_FALLO: dependencias requeridas ausentes';
  end if;

  if not exists (
       select 1 from information_schema.columns
        where table_schema='public' and table_name='membresias_usuario' and column_name='user_id'
     )
     or not exists (
       select 1 from information_schema.columns
        where table_schema='public' and table_name='membresias_usuario' and column_name='empresa_id'
     )
     or not exists (
       select 1 from information_schema.columns
        where table_schema='public' and table_name='membresias_usuario' and column_name='local_id'
     )
     or not exists (
       select 1 from information_schema.columns
        where table_schema='public' and table_name='membresias_usuario' and column_name='todos_locales'
     )
     or not exists (
       select 1 from information_schema.columns
        where table_schema='public' and table_name='membresias_usuario' and column_name='rol'
     )
     or not exists (
       select 1 from information_schema.columns
        where table_schema='public' and table_name='membresias_usuario' and column_name='activo'
     )
     or not exists (
       select 1 from information_schema.columns
        where table_schema='public' and table_name='locales' and column_name='id'
     )
     or not exists (
       select 1 from information_schema.columns
        where table_schema='public' and table_name='locales' and column_name='empresa_id'
     ) then
    raise exception 'P2_R03C_PREFLIGHT_FALLO: contrato tenant incompleto';
  end if;

  select string_agg(c.column_name, ', ' order by c.column_name)
    into v_bad_columns
    from information_schema.columns c
   where c.table_schema='public'
     and c.table_name='errores_sistema'
     and c.column_name in ('empresa_id','local_id','url','vista','detalle','contexto')
     and (
       (c.column_name in ('empresa_id','local_id','url','vista','detalle') and c.data_type <> 'text')
       or (c.column_name='contexto' and c.data_type <> 'jsonb')
     );

  if v_bad_columns is not null then
    raise exception 'P2_R03C_PREFLIGHT_FALLO: tipos incompatibles en %', v_bad_columns;
  end if;
end;
$$;

alter table public.errores_sistema
  add column if not exists empresa_id text,
  add column if not exists local_id text,
  add column if not exists url text,
  add column if not exists vista text,
  add column if not exists detalle text,
  add column if not exists contexto jsonb;

alter table public.errores_sistema enable row level security;

create or replace function private.p2_r03c_puede_insertar_error(
  p_empresa text,
  p_local text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select private.la_usuario_activo()
     and nullif(btrim(p_empresa),'') is not null
     and exists (
       select 1
         from public.membresias_usuario m
        where m.user_id=(select auth.uid())
          and m.empresa_id=p_empresa
          and m.activo=true
          and (
            p_local is null
            or (
              nullif(btrim(p_local),'') is not null
              and upper(btrim(p_local)) <> 'TODOS'
              and (m.todos_locales=true or m.local_id=p_local)
            )
          )
     )
     and (
       p_local is null
       or exists (
         select 1
           from public.locales l
          where l.id=p_local
            and l.empresa_id=p_empresa
       )
     );
$$;

create or replace function private.p2_r03c_puede_leer_error(
  p_empresa text,
  p_local text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select private.la_usuario_activo()
     and nullif(btrim(p_empresa),'') is not null
     and exists (
       select 1
         from public.membresias_usuario m
        where m.user_id=(select auth.uid())
          and m.empresa_id=p_empresa
          and m.activo=true
          and lower(btrim(m.rol))='propietario'
          and (
            p_local is null
            or (
              nullif(btrim(p_local),'') is not null
              and upper(btrim(p_local)) <> 'TODOS'
              and (m.todos_locales=true or m.local_id=p_local)
            )
          )
     )
     and (
       p_local is null
       or exists (
         select 1
           from public.locales l
          where l.id=p_local
            and l.empresa_id=p_empresa
       )
     );
$$;

revoke all on function private.p2_r03c_puede_insertar_error(text,text) from public, anon, authenticated;
revoke all on function private.p2_r03c_puede_leer_error(text,text) from public, anon, authenticated;
grant execute on function private.p2_r03c_puede_insertar_error(text,text) to authenticated;
grant execute on function private.p2_r03c_puede_leer_error(text,text) to authenticated;

-- El reset dejó nombres de políticas diferentes entre entornos. Se eliminan todas
-- las políticas de esta tabla antes de instalar exactamente el contrato R03C.
do $$
declare
  r record;
begin
  for r in
    select policyname
      from pg_policies
     where schemaname='public'
       and tablename='errores_sistema'
  loop
    execute format('drop policy if exists %I on public.errores_sistema', r.policyname);
  end loop;
end;
$$;

create policy errores_sistema_p2_r03c_select
  on public.errores_sistema
  for select
  to authenticated
  using (private.p2_r03c_puede_leer_error(empresa_id,local_id));

create policy errores_sistema_p2_r03c_insert
  on public.errores_sistema
  for insert
  to authenticated
  with check (private.p2_r03c_puede_insertar_error(empresa_id,local_id));

revoke all privileges on table public.errores_sistema from public, anon, authenticated;
grant select, insert on table public.errores_sistema to authenticated;

commit;
