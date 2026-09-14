-- PM27 / C24 — postflight agregado de migraciones C13 -> C23.
-- SOLO LECTURA. Se ejecuta después del lote y falla si falta una postcondición.

begin;
set local transaction read only;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $c24_postflight$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.obtener_contexto_operativo()'::regprocedure);
  if strpos(v_def, 'contexto_roles_inconsistentes') = 0
     or strpos(v_def, 'private.la_usuario_activo()') = 0 then
    raise exception 'PM27_C24_POSTFLIGHT_FALLO: C13 contexto no instalado';
  end if;

  -- C13-P5 admite dos estados finales seguros. Si el helper sigue existiendo,
  -- debe quedar endurecido exactamente con search_path vacío y EXECUTE solo para
  -- authenticated. Si ya fue retirado, su ausencia solo es válida cuando ninguna
  -- política ni función activa conserva una referencia textual al helper.
  if pg_catalog.to_regprocedure('private.es_propietario_activo()') is null then
    if exists (
      select 1
        from pg_catalog.pg_policies p
       where coalesce(p.qual, '') ilike '%es_propietario_activo%'
          or coalesce(p.with_check, '') ilike '%es_propietario_activo%'
    ) or exists (
      select 1
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where coalesce(p.prosrc, '') ilike '%es_propietario_activo%'
         and not (n.nspname = 'private' and p.proname = 'es_propietario_activo')
    ) then
      raise exception 'PM27_C24_POSTFLIGHT_FALLO: helper es_propietario_activo ausente pero aun referenciado';
    end if;
    raise notice 'PM27_C24_POSTFLIGHT: helper es_propietario_activo ya ausente y sin dependencias';
  else
    -- PostgreSQL 17 serializa ALTER FUNCTION ... SET search_path = '' como el
    -- elemento de proconfig search_path="". Se valida el elemento exacto del
    -- array, no una expresión LIKE que confunda las comillas con contenido.
    if not exists (
      select 1
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        cross join lateral unnest(coalesce(p.proconfig, array[]::text[])) cfg
       where n.nspname = 'private'
         and p.proname = 'es_propietario_activo'
         and pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
         and cfg = 'search_path=""'
    ) then
      raise exception 'PM27_C24_POSTFLIGHT_FALLO: C13 helper sin search_path vacío';
    end if;

    -- PUBLIC es una pseudo-función de ACL, no un rol consultable por nombre en
    -- has_function_privilege(). aclexplode representa PUBLIC con grantee=0.
    if exists (
      select 1
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        cross join lateral pg_catalog.aclexplode(
          coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
        ) acl
       where n.nspname = 'private'
         and p.proname = 'es_propietario_activo'
         and pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
         and acl.grantee = 0
         and acl.privilege_type = 'EXECUTE'
    ) then
      raise exception 'PM27_C24_POSTFLIGHT_FALLO: C13 helper ejecutable por PUBLIC';
    end if;
    if pg_catalog.has_function_privilege('anon', 'private.es_propietario_activo()', 'EXECUTE') then
      raise exception 'PM27_C24_POSTFLIGHT_FALLO: C13 helper ejecutable por anon';
    end if;
    if not pg_catalog.has_function_privilege('authenticated', 'private.es_propietario_activo()', 'EXECUTE') then
      raise exception 'PM27_C24_POSTFLIGHT_FALLO: C13 helper no ejecutable por authenticated';
    end if;
  end if;

  -- Las RPC legacy pueden no existir en instalaciones modernas. Primero se
  -- resuelve su OID; solo si existe se consulta el privilegio. Así el postflight
  -- no depende de que PostgreSQL cortocircuite una firma inexistente.
  if to_regprocedure('public.descontar_stock_carrito(jsonb,text)') is not null then
    if has_function_privilege('authenticated','public.descontar_stock_carrito(jsonb,text)','EXECUTE') then
      raise exception 'PM27_C24_POSTFLIGHT_FALLO: RPC legacy descontar_stock_carrito sigue ejecutable';
    end if;
  end if;
  if to_regprocedure('public.anular_venta_tpv(text,text)') is not null then
    if has_function_privilege('authenticated','public.anular_venta_tpv(text,text)','EXECUTE') then
      raise exception 'PM27_C24_POSTFLIGHT_FALLO: RPC legacy anular_venta_tpv sigue ejecutable';
    end if;
  end if;

  v_def := pg_get_functiondef('public.registrar_venta_stock(text,text,text,text,numeric,jsonb)'::regprocedure);
  if strpos(v_def,'pm09_bloquear_operation_id_stock') = 0 then
    raise exception 'PM27_C24_POSTFLIGHT_FALLO: C18 venta sin guard global';
  end if;
  v_def := pg_get_functiondef('public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)'::regprocedure);
  if strpos(v_def,'pm09_bloquear_operation_id_stock') = 0 then
    raise exception 'PM27_C24_POSTFLIGHT_FALLO: C18 carrito sin guard global';
  end if;

  v_def := pg_get_functiondef('public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb)'::regprocedure);
  if strpos(v_def,'pm09_bloquear_operation_id_stock') = 0 then
    raise exception 'PM27_C24_POSTFLIGHT_FALLO: C19 traslado interno sin guard global';
  end if;
  v_def := pg_get_functiondef('public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb)'::regprocedure);
  if strpos(v_def,'pm09_bloquear_operation_id_stock') = 0 then
    raise exception 'PM27_C24_POSTFLIGHT_FALLO: C19 traslado interlocal sin guard global';
  end if;

  v_def := pg_get_functiondef('private.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb)'::regprocedure);
  if strpos(v_def, 'op.payload ? ''bases''') = 0 then
    raise exception 'PM27_C24_POSTFLIGHT_FALLO: C20 identidad de bases ausente';
  end if;

  v_def := pg_get_functiondef('public.registrar_encargo(text,text,text,text,numeric,text,jsonb)'::regprocedure);
  if strpos(v_def,'cliente_otro_contexto') = 0
     or strpos(v_def,'transicion_encargo_invalida') = 0
     or strpos(v_def,'encargo_terminal_inmutable') = 0 then
    raise exception 'PM27_C24_POSTFLIGHT_FALLO: C21 incompleto';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid='public.pagos_encargo'::regclass
       and conname='pm27_c22_pagos_encargo_estado_reverso_ck'
       and contype='c' and convalidated
  ) then
    raise exception 'PM27_C24_POSTFLIGHT_FALLO: C22 CHECK ausente/no validado';
  end if;
  if to_regclass('public.pm27_c22_pagos_encargo_un_reverso_por_pago') is null then
    raise exception 'PM27_C24_POSTFLIGHT_FALLO: C22 índice único de reverso ausente';
  end if;
  if (select count(*) from pg_trigger t where t.tgrelid='public.pagos_encargo'::regclass
       and not t.tgisinternal and t.tgname in ('pm27_c22_pagos_encargo_integridad','pm27_c22_pagos_encargo_no_truncate')) <> 2 then
    raise exception 'PM27_C24_POSTFLIGHT_FALLO: C22 triggers incompletos';
  end if;
  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema='public' and table_name='pagos_encargo'
       and grantee in ('anon','authenticated')
       and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
  ) then
    raise exception 'PM27_C24_POSTFLIGHT_FALLO: C22 grants directos de escritura persisten';
  end if;

  v_def := pg_get_functiondef('public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)'::regprocedure);
  if strpos(v_def,'movimientos_datos_norm') = 0
     or strpos(v_def,'lineas_datos_norm') = 0 then
    raise exception 'PM27_C24_POSTFLIGHT_FALLO: C23 identidad de metadatos de línea ausente';
  end if;

  raise notice 'PM27_C24_POSTFLIGHT=PASS';
end
$c24_postflight$;

rollback;
