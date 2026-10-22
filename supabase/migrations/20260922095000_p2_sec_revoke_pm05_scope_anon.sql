-- P2-SEC-F01 · mínimo privilegio para la función trigger pm05_scope_almacen_kv.
-- Solo revoca EXECUTE heredado de PUBLIC/anon. No modifica datos ni el trigger.

begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $preflight$
declare
  v_oid oid;
begin
  v_oid := to_regprocedure('public.pm05_scope_almacen_kv()')::oid;
  if v_oid is null then
    raise exception 'P2_SEC_F01_PREFLIGHT_FALLO:pm05_scope_almacen_kv_ausente';
  end if;

  if (select p.prorettype <> 'trigger'::regtype from pg_proc p where p.oid=v_oid) then
    raise exception 'P2_SEC_F01_PREFLIGHT_FALLO:pm05_scope_no_es_trigger';
  end if;

  if not exists (
    select 1
      from pg_trigger t
      join pg_class c on c.oid=t.tgrelid
      join pg_namespace n on n.oid=c.relnamespace
     where not t.tgisinternal
       and n.nspname='public'
       and c.relname='almacen_kv'
       and t.tgfoid=v_oid
       and t.tgname='pm05_scope_almacen_kv_trg'
  ) then
    raise exception 'P2_SEC_F01_PREFLIGHT_FALLO:trigger_pm05_scope_no_encontrado';
  end if;
end
$preflight$;

revoke execute on function public.pm05_scope_almacen_kv() from public, anon;

do $postflight$
declare
  v_oid oid := to_regprocedure('public.pm05_scope_almacen_kv()')::oid;
begin
  if has_function_privilege('public',v_oid,'EXECUTE')
     or has_function_privilege('anon',v_oid,'EXECUTE') then
    raise exception 'P2_SEC_F01_POSTFLIGHT_FALLO:execute_publico_o_anon_sigue_abierto';
  end if;

  if not has_function_privilege('authenticated',v_oid,'EXECUTE')
     or not has_function_privilege('service_role',v_oid,'EXECUTE') then
    raise exception 'P2_SEC_F01_POSTFLIGHT_FALLO:acl_legitima_alterada';
  end if;
end
$postflight$;

commit;
