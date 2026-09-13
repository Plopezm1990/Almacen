-- PM25 P02 -- ensayo LOCAL PARCIAL. Reproduccion minima del estado
-- INMEDIATAMENTE ANTERIOR a la migracion candidata
-- (supabase/migrations/20260905185935_g1_p08_operation_id_finanzas_global.sql):
-- solo las 5 tablas de libros que esa migracion lee para el backfill,
-- con las columnas minimas necesarias para ejercitar su logica real
-- (operation_id + clave primaria). NO es el esquema completo de QA --
-- esa es una limitacion adicional de este ensayo parcial, documentada
-- en el informe.

create schema if not exists private;

create table public.pagos_factura (
  id text primary key,
  operation_id text
);

create table public.caja_operaciones (
  id text primary key,
  operation_id text
);

create table public.stock_operaciones (
  id text primary key,
  operation_id text
);

create table public.arqueos_caja (
  id text primary key,
  operation_id text
);

create table public.arqueos_caja_anulaciones (
  id text primary key,
  operation_id text
);

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end
$$;
grant usage on schema public, private to anon, authenticated;
