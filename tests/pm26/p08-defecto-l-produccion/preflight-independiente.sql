-- PM26 P08 -- preflight independiente, de solo lectura, para el
-- Defecto L en produccion. Bloque critico byte a byte identico al
-- embebido en migracion-propuesta.sql (verificado por contrato).
-- Termina siempre en ROLLBACK -- no muta catalogo ni datos.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- PM26_P08_PREFLIGHT_INICIO
do $$
declare
  v_total int;
  v_politicas_ok int;
  v_helper_ok boolean;
  v_norm_esperado text := '(EXISTS ( SELECT 1 FROM perfiles p WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND (p.activo = true) AND (p.rol = ''Propietario''::text))))';
begin
  -- 1) Las 3 politicas reales de produccion existen con su texto
  --    exacto (normalizado de espacios) -- solo restriccion por rol,
  --    sin ninguna referencia a empresa_id/local_id todavia. Si el
  --    texto difiere, el catalogo no es el esperado y se aborta.
  select count(*) into v_politicas_ok
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
   where c.relname = 'prefiltros_candidatos'
     and (
       (p.polname = 'prefiltros - propietario lee'
         and regexp_replace(pg_get_expr(p.polqual, p.polrelid), '\s+', ' ', 'g') = v_norm_esperado
         and pg_get_expr(p.polwithcheck, p.polrelid) is null)
       or (p.polname = 'prefiltros - propietario crea'
         and pg_get_expr(p.polqual, p.polrelid) is null
         and regexp_replace(pg_get_expr(p.polwithcheck, p.polrelid), '\s+', ' ', 'g') = v_norm_esperado)
       or (p.polname = 'prefiltros - propietario borra'
         and regexp_replace(pg_get_expr(p.polqual, p.polrelid), '\s+', ' ', 'g') = v_norm_esperado
         and pg_get_expr(p.polwithcheck, p.polrelid) is null)
     );
  if v_politicas_ok <> 3 then
    raise exception 'PREFLIGHT_FALLO: no se encontraron las 3 politicas originales de produccion con el texto exacto esperado -- catalogo distinto al esperado, abortando';
  end if;

  -- 2) No aplicado ya.
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='prefiltros_candidatos' and column_name='empresa_id') then
    raise exception 'PREFLIGHT_FALLO: prefiltros_candidatos.empresa_id ya existe -- esta migracion puede haberse aplicado ya';
  end if;

  -- 3) El helper que se va a reutilizar existe con la firma esperada.
  select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and p.proname = 'la_tiene_local'
       and pg_get_function_arguments(p.oid) = 'p_empresa text, p_local text'
  ) into v_helper_ok;
  if not v_helper_ok then
    raise exception 'PREFLIGHT_FALLO: private.la_tiene_local(p_empresa text, p_local text) no existe con la firma esperada -- ¿es este realmente el proyecto de produccion?';
  end if;

  -- 4) Tabla vacia -- sin esto, NOT NULL directo no es seguro y hace
  --    falta backfill en dos fases (ver documento de diseno).
  select count(*) into v_total from public.prefiltros_candidatos;
  if v_total <> 0 then
    raise exception 'PREFLIGHT_FALLO: prefiltros_candidatos tiene % filas -- esta migracion exige 0 filas; con filas existentes hace falta backfill en dos fases, no esta migracion combinada', v_total;
  end if;

  raise notice 'PREFLIGHT_CATALOGO=PASS';
end
$$;
-- PM26_P08_PREFLIGHT_FIN

rollback;
