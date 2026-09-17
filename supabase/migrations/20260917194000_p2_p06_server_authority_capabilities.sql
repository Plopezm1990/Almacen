-- P2 · P06 · marcador de autoridad servidor para Personal/Fichajes
-- Permite que el frontend desactive persistencia legacy solo cuando PM11/PM13
-- están realmente presentes en el backend objetivo.

begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $preflight$
declare v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.empleados') is null then v_missing:=array_append(v_missing,'empleados'); end if;
  if to_regclass('public.fichajes_registro') is null then v_missing:=array_append(v_missing,'fichajes_registro'); end if;
  if to_regprocedure('public.pm11_alta_empleado(text,text,text,text,jsonb)') is null then v_missing:=array_append(v_missing,'pm11_alta_empleado'); end if;
  if to_regprocedure('public.pm11_editar_empleado(text,text,jsonb)') is null then v_missing:=array_append(v_missing,'pm11_editar_empleado'); end if;
  if to_regprocedure('public.pm13_fichar(text,text,text,text)') is null then v_missing:=array_append(v_missing,'pm13_fichar'); end if;
  if to_regprocedure('public.pm13_fichaje_manual(text,text,date,text,text,text,text)') is null then v_missing:=array_append(v_missing,'pm13_fichaje_manual'); end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then v_missing:=array_append(v_missing,'authenticated'); end if;
  if not exists(select 1 from pg_roles where rolname='anon') then v_missing:=array_append(v_missing,'anon'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'P2_P06_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
end $preflight$;

create or replace function public.p2_server_authority_capabilities()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'personal','pm11',
    'fichajes','pm13',
    'legacyPersistence',false
  );
$function$;

revoke all on function public.p2_server_authority_capabilities() from public,anon,authenticated;
grant execute on function public.p2_server_authority_capabilities() to authenticated;

commit;
