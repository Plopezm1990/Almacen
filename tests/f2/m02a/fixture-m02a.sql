\set ON_ERROR_STOP on
\ir ../m01/fixture-legacy.sql

create or replace function private.la_tiene_empresa(p_empresa text)
returns boolean language sql stable security definer set search_path=''
as $$
  select p_empresa = current_setting('app.test_empresa',true)
$$;

grant execute on function private.la_tiene_empresa(text) to authenticated;
