-- N-02: la aplicación usa este RPC con la sesión authenticated.
-- QA conservaba un EXECUTE histórico adicional para service_role que no
-- existe en producción ni en la migración canónica de PM33/N-02. Se revoca
-- explícitamente para que el estado reconstruible sea inequívoco.
revoke all on function public.obtener_contexto_operativo(text) from service_role;
grant execute on function public.obtener_contexto_operativo(text) to authenticated;
