begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- PM26_P06H_PREFLIGHT_INICIO
do $$
declare
  v_total int;
  v_ya_existe int;
begin
  -- 1) No es producción: las 3 políticas reales de producción para
  --    esta tabla no deben existir aquí.
  select count(*) into v_ya_existe
    from pg_policies
   where tablename = 'prefiltros_candidatos'
     and policyname in ('prefiltros - propietario lee', 'prefiltros - propietario crea', 'prefiltros - propietario borra');
  if v_ya_existe > 0 then
    raise exception 'PREFLIGHT_FALLO: se encontraron políticas de producción sobre prefiltros_candidatos -- esto no es QA, abortando';
  end if;

  -- 2) No aplicado ya: ninguna de las dos columnas, la política nueva
  --    ni ninguna de las dos RPC deben existir todavía.
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='prefiltros_candidatos' and column_name in ('empresa_id', 'local_id')) then
    raise exception 'PREFLIGHT_FALLO: ya existe empresa_id o local_id en prefiltros_candidatos -- esta migración puede haberse aplicado ya';
  end if;
  if exists (select 1 from pg_policies where tablename='prefiltros_candidatos' and policyname='prefiltros_candidatos_select_gestion') then
    raise exception 'PREFLIGHT_FALLO: la política prefiltros_candidatos_select_gestion ya existe';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('pm11_crear_prefiltro_candidato', 'pm11_eliminar_prefiltro_candidato')) then
    raise exception 'PREFLIGHT_FALLO: ya existe alguna RPC PM11 de prefiltros';
  end if;

  -- 3) La tabla debe estar vacía -- si no lo está, esta migración
  --    combinada NO es segura (impondría NOT NULL sin backfill). Debe
  --    rediseñarse en dos fases (ver documento de diseño) en vez de
  --    forzarlo aquí.
  select count(*) into v_total from public.prefiltros_candidatos;
  if v_total <> 0 then
    raise exception 'PREFLIGHT_FALLO: prefiltros_candidatos tiene % filas -- esta migración combinada exige 0 filas; con filas existentes hace falta la migración en dos fases (Fase A aditiva + Fase C con backfill), no esta', v_total;
  end if;

  raise notice 'PREFLIGHT_CATALOGO=PASS';
end
$$;
-- PM26_P06H_PREFLIGHT_FIN

rollback;
