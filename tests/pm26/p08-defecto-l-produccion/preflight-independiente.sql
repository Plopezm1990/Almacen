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
  v_helper_cuerpo text;
  v_norm_esperado text := '(EXISTS ( SELECT 1 FROM perfiles p WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND (p.activo = true) AND (p.rol = ''Propietario''::text))))';
  v_helper_cuerpo_esperado text := 'CREATE OR REPLACE FUNCTION private.la_tiene_local(p_empresa text, p_local text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '''' AS $function$ select private.la_usuario_activo() and nullif(btrim(p_empresa),'''') is not null and nullif(btrim(p_local),'''') is not null and upper(btrim(p_local)) <> ''TODOS'' and exists( select 1 from public.membresias_usuario m where m.user_id=(select auth.uid()) and m.empresa_id=p_empresa and m.activo=true and (m.todos_locales=true or m.local_id=p_local) ); $function$';
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

  -- 3b) Endurecimiento: no basta con la firma -- el CUERPO real del
  --     helper debe coincidir exactamente (normalizado de espacios) con
  --     el verificado por inspeccion. Una firma identica con un cuerpo
  --     distinto (p.ej. si alguien lo redefiniera para dejar de exigir
  --     todos_locales o el local exacto) pasaria la comprobacion 3 sin
  --     esta, dejando la migracion confiando en una autorizacion que ya
  --     no es la que se reviso.
  select btrim(regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g')) into v_helper_cuerpo
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'la_tiene_local';
  if v_helper_cuerpo is distinct from v_helper_cuerpo_esperado then
    raise exception 'PREFLIGHT_FALLO: el cuerpo de private.la_tiene_local no coincide con el verificado por inspeccion -- pudo haber cambiado desde entonces';
  end if;

  -- 3c) Endurecimiento: descarta explicitamente estar en QA -- si los
  --     helpers pm11_puede_ver_personal/pm11_puede_mutar_personal (que
  --     solo existen en QA, nunca en produccion) estuvieran presentes,
  --     esto no seria produccion y no debe continuar.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and p.proname in ('pm11_puede_ver_personal', 'pm11_puede_mutar_personal')
  ) then
    raise exception 'PREFLIGHT_FALLO: se encontraron helpers pm11_puede_ver_personal/pm11_puede_mutar_personal -- esto parece QA, no produccion, abortando';
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
