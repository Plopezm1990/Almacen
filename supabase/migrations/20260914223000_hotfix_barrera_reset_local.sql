-- Hotfix P1: invalida de forma segura las copias locales de instalaciones
-- anteriores. No modifica Auth, perfiles, empresas, locales ni datos de negocio.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '20s';

create schema if not exists private;

create table if not exists private.la_instalacion_estado (
  singleton boolean primary key default true check (singleton),
  generation text not null check (length(generation) >= 24),
  created_at timestamptz not null default now()
);

-- La generación se crea una sola vez en el servidor. Es deliberadamente un
-- marcador no secreto: únicamente separa los datos locales anteriores de la
-- instalación vacía actual.
insert into private.la_instalacion_estado (singleton, generation)
select true, md5(random()::text || clock_timestamp()::text) || md5(txid_current()::text || clock_timestamp()::text)
where not exists (select 1 from private.la_instalacion_estado where singleton = true);

alter table private.la_instalacion_estado enable row level security;
revoke all on table private.la_instalacion_estado from public, anon, authenticated;

create or replace function public.obtener_generacion_instalacion()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_generation text;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select generation into v_generation
  from private.la_instalacion_estado
  where singleton = true;

  if v_generation is null then
    raise exception 'Estado de instalación no disponible' using errcode = 'P0001';
  end if;

  return jsonb_build_object('generation', v_generation);
end;
$$;

revoke all on function public.obtener_generacion_instalacion() from public, anon;
grant execute on function public.obtener_generacion_instalacion() to authenticated;

commit;
