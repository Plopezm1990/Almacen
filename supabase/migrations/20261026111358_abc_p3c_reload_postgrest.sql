-- Supabase aplica las funciones en PostgreSQL antes de que PostgREST
-- refresque automáticamente su caché de firmas RPC. La notificación hace
-- visible en QA la sobrecarga contextual de P3c sin tocar producción.
select pg_notify('pgrst', 'reload schema');
