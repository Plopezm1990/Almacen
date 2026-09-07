-- Test-only prerequisite for the isolated full Supabase stack.
-- The repository starts at PM07 and does not contain the earlier membership schema.
create schema if not exists private;

create table public.membresias_usuario (
  user_id uuid not null references auth.users(id) on delete cascade,
  empresa_id text not null,
  local_id text,
  todos_locales boolean not null default false,
  activo boolean not null default true,
  rol text not null,
  primary key(user_id,empresa_id,local_id)
);
alter table public.membresias_usuario enable row level security;
revoke all on public.membresias_usuario from anon, authenticated;

create or replace function private.la_usuario_activo() returns boolean
language sql stable security definer set search_path='public','auth','private','pg_temp' as $$
  select auth.uid() is not null and exists(
    select 1 from public.membresias_usuario m where m.user_id=auth.uid() and m.activo=true
  );
$$;
create or replace function private.la_rol() returns text
language sql stable security definer set search_path='public','auth','private','pg_temp' as $$
  select m.rol from public.membresias_usuario m
   where m.user_id=auth.uid() and m.activo=true order by m.empresa_id,m.local_id limit 1;
$$;
create or replace function private.la_tiene_empresa(p_empresa text) returns boolean
language sql stable security definer set search_path='public','auth','private','pg_temp' as $$
  select private.la_usuario_activo() and exists(
    select 1 from public.membresias_usuario m
     where m.user_id=auth.uid() and m.empresa_id=p_empresa and m.activo=true
  );
$$;
create or replace function private.la_tiene_local(p_empresa text,p_local text) returns boolean
language sql stable security definer set search_path='public','auth','private','pg_temp' as $$
  select private.la_usuario_activo()
     and nullif(btrim(p_local),'') is not null and upper(btrim(p_local))<>'TODOS'
     and exists(select 1 from public.membresias_usuario m
       where m.user_id=auth.uid() and m.empresa_id=p_empresa and m.activo=true
         and (m.todos_locales=true or m.local_id=p_local));
$$;

revoke all on function private.la_usuario_activo() from public,anon,authenticated;
revoke all on function private.la_rol() from public,anon,authenticated;
revoke all on function private.la_tiene_empresa(text) from public,anon,authenticated;
revoke all on function private.la_tiene_local(text,text) from public,anon,authenticated;
grant execute on function private.la_tiene_local(text,text) to authenticated;

create table public.caja_operaciones(operation_id text primary key);
create table public.arqueos_caja(operation_id text primary key);
create table public.arqueos_caja_anulaciones(operation_id text primary key);
create table public.pagos_factura(operation_id text primary key);
revoke all on public.caja_operaciones,public.arqueos_caja,public.arqueos_caja_anulaciones,public.pagos_factura from anon,authenticated;
