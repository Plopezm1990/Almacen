\set ON_ERROR_STOP on
\ir ../m04c/fixture-m04c.sql

-- Reproduce el origen real del drift observado en QA: DEFAULT PRIVILEGES amplios
-- antes de aplicar M01-M04C. M04D debe converger desde este estado.
alter default privileges for role postgres in schema public
  grant all privileges on tables to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all privileges on sequences to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant execute on functions to anon, authenticated, service_role;
