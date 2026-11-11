begin;

-- M-01 follow-up: the private PIN table must also be protected by RLS.
-- The SECURITY DEFINER RPCs remain the intended access path and are owned by
-- postgres, so enabling RLS does not block their server-side reads/writes.
alter table private.pm11_empleado_pin enable row level security;

do $post$
begin
  if not exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'private'
       and c.relname = 'pm11_empleado_pin'
       and c.relrowsecurity
  ) then
    raise exception 'M01_POSTFLIGHT:pin_table_rls';
  end if;
end $post$;

commit;
