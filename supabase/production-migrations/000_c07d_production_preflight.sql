-- C07-D production preflight — READ ONLY
--
-- Este archivo no es una migración automática. Está fuera de
-- supabase/migrations/ para impedir que el pipeline lo aplique por accidente.
-- Comprueba la base destino antes de preparar la variante productiva.
-- No inserta, actualiza, borra ni crea objetos.

do $$
declare
  v_missing text[] := array[]::text[];
  v_partial integer := 0;
  v_series integer := 0;
  v_documents integer := 0;
  v_ambiguous_series integer := 0;
  v_ambiguous_documents integer := 0;
  v_active_production_adapters integer := 0;
  v_active_production_configs integer := 0;
begin
  if to_regclass('public.locales') is null then
    v_missing := array_append(v_missing, 'public.locales');
  end if;
  if to_regclass('public.entidades_fiscales') is null then
    v_missing := array_append(v_missing, 'public.entidades_fiscales');
  end if;
  if to_regclass('public.entidad_fiscal_locales') is null then
    v_missing := array_append(v_missing, 'public.entidad_fiscal_locales');
  end if;
  if to_regclass('public.abc_c05_series_documentales') is null then
    v_missing := array_append(v_missing, 'public.abc_c05_series_documentales');
  end if;
  if to_regclass('public.abc_c05_documentos_emitidos') is null then
    v_missing := array_append(v_missing, 'public.abc_c05_documentos_emitidos');
  end if;

  if cardinality(v_missing) > 0 then
    raise exception 'C07D_PRODUCTION_PREFLIGHT_MISSING_BASE:%',
      array_to_string(v_missing, ',');
  end if;

  -- Si hay una parte de C07-D ya instalada, se detiene para evitar una
  -- promoción sobre un estado intermedio o una mezcla QA/producción.
  select count(*) into v_partial
  from (values
    (to_regclass('public.abc_c07d_registros_fiscales')),
    (to_regclass('public.abc_c07d_cola_fiscal')),
    (to_regclass('private.abc_c07d_adaptadores_fiscales')),
    (to_regclass('private.abc_c07d_emision_config')),
    (to_regclass('private.abc_c07d_emision_config_revisiones')),
    (to_regclass('private.abc_c07d_pilotos_sandbox'))
  ) objects(regclass)
  where regclass is not null;

  if v_partial > 0 and v_partial < 6 then
    raise exception 'C07D_PRODUCTION_PREFLIGHT_PARTIAL_STATE:%/6', v_partial;
  end if;

  execute 'select count(*) from public.abc_c05_series_documentales'
    into v_series;
  execute 'select count(*) from public.abc_c05_documentos_emitidos'
    into v_documents;

  -- Esta consulta funciona con el esquema actual, anterior a la columna
  -- entidad_fiscal_id, y detecta conflictos antes de C05 reconciliation.
  execute $q$
    select count(*) from (
      select s.id
      from public.abc_c05_series_documentales s
      left join public.entidad_fiscal_locales efl
        on efl.empresa_id = s.empresa_id
       and efl.local_id = s.local_id
       and efl.activa = true
      group by s.id
      having count(efl.entidad_fiscal_id) <> 1
    ) q
  $q$ into v_ambiguous_series;

  execute $q$
    select count(*) from (
      select d.id
      from public.abc_c05_documentos_emitidos d
      left join public.entidad_fiscal_locales efl
        on efl.empresa_id = d.empresa_id
       and efl.local_id = d.local_id
       and efl.activa = true
      group by d.id
      having count(efl.entidad_fiscal_id) <> 1
    ) q
  $q$ into v_ambiguous_documents;

  if to_regclass('private.abc_c07d_adaptadores_fiscales') is not null then
    execute $q$
      select count(*)
      from private.abc_c07d_adaptadores_fiscales
      where enabled = true and 'PRODUCCION' = any(environments)
    $q$ into v_active_production_adapters;
  end if;

  if to_regclass('private.abc_c07d_emision_config') is not null then
    execute $q$
      select count(*)
      from private.abc_c07d_emision_config
      where environment = 'PRODUCCION' and estado = 'ACTIVA'
    $q$ into v_active_production_configs;
  end if;

  if v_ambiguous_series > 0 or v_ambiguous_documents > 0 then
    raise exception 'C07D_PRODUCTION_PREFLIGHT_C05_AMBIGUOUS:series=%,documents=%',
      v_ambiguous_series, v_ambiguous_documents;
  end if;

  if v_active_production_adapters > 0 or v_active_production_configs > 0 then
    raise exception 'C07D_PRODUCTION_PREFLIGHT_REAL_ACTIVATION_PRESENT:adapters=%,configs=%',
      v_active_production_adapters, v_active_production_configs;
  end if;

  raise notice 'C07D_PRODUCTION_PREFLIGHT=PASS';
  raise notice 'C07D_PRODUCTION_PREFLIGHT_C05=series %, documents %', v_series, v_documents;
  raise notice 'C07D_PRODUCTION_PREFLIGHT_REAL_ACTIVATION=NONE';
end $$;
