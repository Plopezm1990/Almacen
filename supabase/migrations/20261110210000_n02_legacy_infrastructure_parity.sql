-- N-02: paridad de tres objetos de infraestructura observados en producción.
--
-- Medición de solo lectura del 2026-11-10: producción tenía estas funciones,
-- dos triggers de updated_at y el event trigger ensure_rls; QA no los tenía.
-- El cuerpo se extrajo de pg_get_functiondef() desplegado en producción.
-- Esta migración se aplica primero en QA para hacer reproducible la fotografía
-- de producción. No crea datos ni ejecuta operaciones de negocio.

create or replace function public.actualizar_fecha()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
                      begin
                        new.updated_at = now();
                          return new;
                          end;
                          $function$;

create or replace function public.actualizar_fecha_perfil()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
          begin
            new.updated_at = now();
              return new;
              end;
              $function$;

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
     if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog','information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
     else
        raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     end if;
  end loop;
end;
$function$;

revoke all on function public.actualizar_fecha() from public, anon, authenticated, service_role;
revoke all on function public.actualizar_fecha_perfil() from public, anon, authenticated, service_role;
revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role;
grant execute on function public.actualizar_fecha() to postgres;
grant execute on function public.actualizar_fecha_perfil() to postgres;
grant execute on function public.rls_auto_enable() to postgres;

do $migration$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and n.nspname = 'public'
      and c.relname = 'almacen_kv'
      and t.tgname = 'almacen_kv_actualizar_fecha'
  ) then
    create trigger almacen_kv_actualizar_fecha
      before update on public.almacen_kv
      for each row execute function public.actualizar_fecha();
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and n.nspname = 'public'
      and c.relname = 'perfiles'
      and t.tgname = 'perfiles_actualizar_fecha'
  ) then
    create trigger perfiles_actualizar_fecha
      before update on public.perfiles
      for each row execute function public.actualizar_fecha_perfil();
  end if;

  if not exists (
    select 1 from pg_event_trigger where evtname = 'ensure_rls'
  ) then
    create event trigger ensure_rls
      on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
end;
$migration$;
