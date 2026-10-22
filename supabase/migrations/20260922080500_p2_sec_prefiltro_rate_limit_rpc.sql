-- P2-SEC · dependencia de rate limit para prefiltro-candidato.
-- Reconstruye exclusivamente la RPC ya existente en PROD y ausente en QA.
-- No modifica datos ni concede acceso directo a clientes.

begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $preflight$
declare
  v_missing text[] := array[]::text[];
  v_other_overloads integer := 0;
begin
  if to_regclass('public.prefiltro_limites') is null then
    v_missing := array_append(v_missing,'prefiltro_limites');
  else
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='prefiltro_limites'
        and column_name='clave' and data_type='text' and is_nullable='NO'
    ) then v_missing := array_append(v_missing,'prefiltro_limites.clave'); end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='prefiltro_limites'
        and column_name='ventana_inicio' and data_type='timestamp with time zone' and is_nullable='NO'
    ) then v_missing := array_append(v_missing,'prefiltro_limites.ventana_inicio'); end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='prefiltro_limites'
        and column_name='intentos' and data_type='integer' and is_nullable='NO'
    ) then v_missing := array_append(v_missing,'prefiltro_limites.intentos'); end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='prefiltro_limites'
        and column_name='actualizado_en' and data_type='timestamp with time zone' and is_nullable='NO'
    ) then v_missing := array_append(v_missing,'prefiltro_limites.actualizado_en'); end if;

    if not exists (
      select 1
      from pg_constraint c
      where c.conrelid='public.prefiltro_limites'::regclass
        and c.contype='p'
        and pg_get_constraintdef(c.oid,true)='PRIMARY KEY (clave)'
    ) then v_missing := array_append(v_missing,'prefiltro_limites.pk_clave'); end if;

    if not coalesce((select relrowsecurity from pg_class where oid='public.prefiltro_limites'::regclass),false) then
      v_missing := array_append(v_missing,'prefiltro_limites.rls');
    end if;
  end if;

  if not exists(select 1 from pg_roles where rolname='service_role') then
    v_missing := array_append(v_missing,'service_role');
  end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then
    v_missing := array_append(v_missing,'authenticated');
  end if;
  if not exists(select 1 from pg_roles where rolname='anon') then
    v_missing := array_append(v_missing,'anon');
  end if;

  if to_regclass('public.prefiltro_limites') is not null
     and exists(select 1 from pg_roles where rolname='service_role') then
    if not has_table_privilege('service_role','public.prefiltro_limites','SELECT')
       or not has_table_privilege('service_role','public.prefiltro_limites','INSERT')
       or not has_table_privilege('service_role','public.prefiltro_limites','UPDATE')
       or not has_table_privilege('service_role','public.prefiltro_limites','DELETE') then
      v_missing := array_append(v_missing,'service_role_prefiltro_limites_dml');
    end if;
  end if;

  if to_regclass('public.prefiltro_limites') is not null
     and exists(select 1 from pg_roles where rolname='authenticated') then
    if has_table_privilege('authenticated','public.prefiltro_limites','SELECT')
       or has_table_privilege('authenticated','public.prefiltro_limites','INSERT')
       or has_table_privilege('authenticated','public.prefiltro_limites','UPDATE')
       or has_table_privilege('authenticated','public.prefiltro_limites','DELETE') then
      v_missing := array_append(v_missing,'authenticated_direct_table_access_open');
    end if;
  end if;

  if to_regclass('public.prefiltro_limites') is not null
     and exists(select 1 from pg_roles where rolname='anon') then
    if has_table_privilege('anon','public.prefiltro_limites','SELECT')
       or has_table_privilege('anon','public.prefiltro_limites','INSERT')
       or has_table_privilege('anon','public.prefiltro_limites','UPDATE')
       or has_table_privilege('anon','public.prefiltro_limites','DELETE') then
      v_missing := array_append(v_missing,'anon_direct_table_access_open');
    end if;
  end if;

  select count(*) into v_other_overloads
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='registrar_intento_prefiltro'
    and p.oid <> coalesce(to_regprocedure('public.registrar_intento_prefiltro(text)')::oid,0);

  if v_other_overloads <> 0 then
    v_missing := array_append(v_missing,'registrar_intento_prefiltro_overload_conflict');
  end if;

  if cardinality(v_missing)>0 then
    raise exception 'P2_SEC_PREFILTRO_RATE_LIMIT_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
end
$preflight$;

create or replace function public.registrar_intento_prefiltro(p_clave text)
returns integer
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_ahora timestamptz := statement_timestamp();
  v_ventana timestamptz := date_trunc('minute', v_ahora);
  v_intentos integer;
begin
  if p_clave is null or p_clave !~ '^[0-9a-f]{64}$' then
    raise exception 'Clave de rate limit no válida';
  end if;

  insert into public.prefiltro_limites (
    clave,
    ventana_inicio,
    intentos,
    actualizado_en
  )
  values (
    p_clave,
    v_ventana,
    1,
    v_ahora
  )
  on conflict (clave) do update
  set
    ventana_inicio = case
      when public.prefiltro_limites.ventana_inicio < v_ventana then v_ventana
      else public.prefiltro_limites.ventana_inicio
    end,
    intentos = case
      when public.prefiltro_limites.ventana_inicio < v_ventana then 1
      else least(public.prefiltro_limites.intentos + 1, 2147483647)
    end,
    actualizado_en = v_ahora
  returning intentos into v_intentos;

  if random() < 0.01 then
    delete from public.prefiltro_limites
    where actualizado_en < v_ahora - interval '1 day';
  end if;

  return v_intentos;
end;
$function$;

revoke all on function public.registrar_intento_prefiltro(text) from public,anon,authenticated,service_role;
grant execute on function public.registrar_intento_prefiltro(text) to service_role;

commit;
