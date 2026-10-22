\set ON_ERROR_STOP on
\ir ../m03a/fixture-m03a.sql

do $$
begin
  if not exists(select 1 from pg_roles where rolname='service_role') then
    create role service_role nologin;
  end if;
end $$;

grant usage on schema public to authenticated,service_role;
grant usage on schema private to service_role;
