-- Plataforma · Blindaje en servidor de la contraseña inicial obligatoria (D01, decisión 3).
-- Cuarta parte: extiende el bloqueo al almacén clásico (Caja, Stock, Finanzas, Configuración ABC),
-- priorizado en la auditoría de hoy (docs/plan-empresas/D01_AUDITORIA_FUNCIONES_SIN_BLINDAJE_2026-10-16.md).
--
-- A diferencia de abc_tiene_capacidad, estas ~22 funciones de dinero/stock y ~6 de configuración no
-- comparten un único filtro: pasan por SIETE funciones privadas «puede_X()» más pequeñas. Blindar
-- esas siete (más una, abc_configurar_descuento_politica, que no usa ninguna función compartida)
-- cubre todo el bloque de prioridad alta, incluidas las variantes *_pm09 (que llaman a la función
-- base y heredan el bloqueo sin tocarlas):
--
--   private.pm06_puede_gestionar_finanzas()        -- registrar/revertir_pago_factura
--   private.pm07_puede_vender()                     -- registrar_venta_stock(_carrito)(_pm09)
--   private.pm07_puede_gestionar_stock()             -- revertir_venta_stock(_carrito)(_pm09),
--                                                        registrar_devolucion_proveedor,
--                                                        trasladar_stock_entre_locales/interno
--   private.pm08_puede_operar_caja()                 -- registrar_arqueo_caja, registrar_movimiento_caja,
--                                                        registrar_encargo, registrar_pago_encargo,
--                                                        registrar_devolucion_venta(_pm09)
--   private.pm08_puede_corregir_caja()               -- anular_arqueo_caja, revertir_movimiento_caja
--   private.abc_config_puede_configurar(text,text)            -- abc_configurar_ajuste/dia_operativo/
--                                                                 equipo_local/modalidad_local
--   private.abc_config_puede_configurar_empresa(text,text)    -- abc_configurar_capacidad_rol (ámbito EMPRESA)
--   public.abc_configurar_descuento_politica(...)    -- condición propia, sin función compartida
--
-- abc_configurar_modalidad_fiscal queda fuera: ya pasa por private.abc_tiene_capacidad (blindada
-- desde el subpunto 3), comprobado al revisar su texto durante esta auditoría.
--
-- Mismo patrón que el subpunto 3: texto EXACTO (byte a byte, leído de pg_proc.prosrc, sin
-- retipear) capturado hoy de QA, con huella antes y después (md5(replace(prosrc,chr(13),''))).
-- NOTA para cuando se prepare PROD: tres de las siete funciones (pm06_puede_gestionar_finanzas,
-- pm07_puede_vender, pm07_puede_gestionar_stock) tienen en PRODUCCIÓN el mismo texto pero con
-- saltos de línea distintos (comprobado hoy) — huella distinta, misma lógica. Este archivo lleva
-- el texto de QA; la aplicación en PROD necesitará su propio preflight con las huellas de PROD y,
-- para esas tres, el texto exacto de PROD (no el de aquí).
--
-- No aplicar en QA ni en PROD sin autorización expresa para ese entorno.

do $$
declare
  v_h text;
begin
  if to_regprocedure('private.plataforma_debe_cambiar_password(uuid)') is null then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_PREFLIGHT_FALLO:falta_20261016120000';
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'private.pm06_puede_gestionar_finanzas()'::regprocedure;
  if v_h is distinct from 'bdda0898d5efd69697ef00eda35a577e' then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_PREFLIGHT_FALLO:funcion_distinta:pm06_puede_gestionar_finanzas:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'private.pm07_puede_vender()'::regprocedure;
  if v_h is distinct from '5e0162f33865a5d9691743b7c3ad4564' then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_PREFLIGHT_FALLO:funcion_distinta:pm07_puede_vender:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'private.pm07_puede_gestionar_stock()'::regprocedure;
  if v_h is distinct from '5347940840c537d0ad2abf6db928c3f1' then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_PREFLIGHT_FALLO:funcion_distinta:pm07_puede_gestionar_stock:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'private.pm08_puede_operar_caja()'::regprocedure;
  if v_h is distinct from 'ce7b8bc1b2bc789e1e8a236d588874c2' then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_PREFLIGHT_FALLO:funcion_distinta:pm08_puede_operar_caja:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'private.pm08_puede_corregir_caja()'::regprocedure;
  if v_h is distinct from '5347940840c537d0ad2abf6db928c3f1' then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_PREFLIGHT_FALLO:funcion_distinta:pm08_puede_corregir_caja:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'private.abc_config_puede_configurar(text,text)'::regprocedure;
  if v_h is distinct from '529c30577b010921dd7ae564d8a564d4' then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_PREFLIGHT_FALLO:funcion_distinta:abc_config_puede_configurar:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'private.abc_config_puede_configurar_empresa(text,text)'::regprocedure;
  if v_h is distinct from '8114340d1568bf1a3ba247e7f7f6617b' then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_PREFLIGHT_FALLO:funcion_distinta:abc_config_puede_configurar_empresa:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'public.abc_configurar_descuento_politica(text,text,text,text,uuid,numeric,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text,date)'::regprocedure;
  if v_h is distinct from '105141d7fd1d26f98e566b824bf9ab61' then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_PREFLIGHT_FALLO:funcion_distinta:abc_configurar_descuento_politica:%', v_h;
  end if;
end $$;

-- 1. private.pm06_puede_gestionar_finanzas -- mismo texto exacto, con una condición añadida.
CREATE OR REPLACE FUNCTION private.pm06_puede_gestionar_finanzas()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
  select private.la_usuario_activo() and not private.plataforma_debe_cambiar_password() and coalesce(private.la_rol() in ('Propietario','Encargado'), false);
$function$;

-- 2. private.pm07_puede_vender -- mismo texto exacto, con una condición añadida.
CREATE OR REPLACE FUNCTION private.pm07_puede_vender()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
  select private.la_usuario_activo() and not private.plataforma_debe_cambiar_password()
     and coalesce(private.la_rol(),'') in ('Propietario','Encargado','Cajero/a','Camarero/a','Churrero/a');
$function$;

-- 3. private.pm07_puede_gestionar_stock -- mismo texto exacto, con una condición añadida.
CREATE OR REPLACE FUNCTION private.pm07_puede_gestionar_stock()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
  select private.la_usuario_activo() and not private.plataforma_debe_cambiar_password()
     and coalesce(private.la_rol(),'') in ('Propietario','Encargado');
$function$;

-- 4. private.pm08_puede_operar_caja -- mismo texto exacto, con una condición añadida.
CREATE OR REPLACE FUNCTION private.pm08_puede_operar_caja()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
  select private.la_usuario_activo() and not private.plataforma_debe_cambiar_password()
     and coalesce(private.la_rol(),'') in ('Propietario','Encargado','Cajero/a');
$function$;

-- 5. private.pm08_puede_corregir_caja -- mismo texto exacto, con una condición añadida.
CREATE OR REPLACE FUNCTION private.pm08_puede_corregir_caja()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.la_usuario_activo() and not private.plataforma_debe_cambiar_password()
     and coalesce(private.la_rol(),'') in ('Propietario','Encargado');
$function$;

-- 6. private.abc_config_puede_configurar -- mismo texto exacto, con una línea añadida
--    justo después de "if auth.uid() is null then return false; end if;".
CREATE OR REPLACE FUNCTION private.abc_config_puede_configurar(p_empresa_id text, p_local_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rol text;
begin
  if auth.uid() is null then return false; end if;
  if private.plataforma_debe_cambiar_password() then return false; end if;
  if nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null then
    return false;
  end if;
  if not coalesce(private.la_tiene_local(p_empresa_id,p_local_id),false) then return false; end if;

  select m.rol
    into v_rol
    from public.membresias_usuario m
   where m.user_id=auth.uid()
     and m.empresa_id=p_empresa_id
     and m.activo=true
     and (
       (m.todos_locales=false and m.local_id=p_local_id)
       or (m.todos_locales=true and m.local_id is null)
     )
   order by
     case when m.todos_locales=false and m.local_id=p_local_id then 0 else 1 end,
     m.id desc
   limit 1;

  return coalesce(v_rol,'')='Propietario';
end $function$;

-- 7. private.abc_config_puede_configurar_empresa -- mismo texto exacto, con una línea añadida.
CREATE OR REPLACE FUNCTION private.abc_config_puede_configurar_empresa(p_empresa_id text, p_local_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then return false; end if;
  if private.plataforma_debe_cambiar_password() then return false; end if;
  if not coalesce(private.abc_config_puede_configurar(p_empresa_id,p_local_id),false) then return false; end if;
  return exists(
    select 1
      from public.membresias_usuario m
     where m.user_id=auth.uid()
       and m.empresa_id=p_empresa_id
       and m.activo=true
       and m.todos_locales=true
       and m.local_id is null
       and m.rol='Propietario'
  );
end $function$;

-- 8. public.abc_configurar_descuento_politica -- mismo texto exacto, con la condición añadida
--    en la misma cadena "or" que ya bloqueaba a quien no es Propietario del local.
CREATE OR REPLACE FUNCTION public.abc_configurar_descuento_politica(p_operation_id text, p_empresa_id text, p_local_id text, p_rol text, p_user_id uuid, p_max_percent numeric, p_permite_cortesia boolean, p_puede_solicitar boolean, p_puede_aplicar boolean, p_puede_autorizar boolean, p_permite_escalado boolean, p_requiere_doble_aprobacion boolean, p_activa boolean, p_motivo text, p_operating_day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text:=nullif(btrim(coalesce(p_rol,'')),'');
  v_reason text:=btrim(coalesce(p_motivo,''));
  v_request jsonb;
  v_command jsonb;
  v_existing public.abc_descuento_politicas%rowtype;
  v_before jsonb;
  v_policy_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null or private.plataforma_debe_cambiar_password() or not exists (
    select 1 from public.membresias_usuario m
    where m.user_id=auth.uid() and m.empresa_id=p_empresa_id
      and m.activo=true and m.rol='Propietario'
      and ((m.todos_locales=true and m.local_id is null)
        or (m.todos_locales=false and m.local_id=p_local_id))
  ) then raise exception 'descuento_politica_no_autorizada'; end if;
  if p_local_id is null or ((v_role is null)=(p_user_id is null))
     or p_max_percent is null or p_max_percent<0 or p_max_percent>100
     or p_max_percent<>round(p_max_percent,4)
     or p_permite_cortesia is null or p_puede_solicitar is null
     or p_puede_aplicar is null or p_puede_autorizar is null
     or p_permite_escalado is null or p_requiere_doble_aprobacion is null
     or p_activa is null or p_operating_day is null
     or char_length(v_reason) not between 1 and 500
     or (p_permite_cortesia and p_max_percent<>100)
     or (p_permite_escalado and not p_puede_solicitar)
     or (p_puede_aplicar and p_max_percent=0)
     or (p_puede_autorizar and p_max_percent=0)
     or (p_requiere_doble_aprobacion and not p_puede_solicitar) then
    raise exception 'descuento_politica_parametros_invalidos';
  end if;
  if p_user_id is not null and not exists (
    select 1 from public.membresias_usuario m
    where m.user_id=p_user_id and m.empresa_id=p_empresa_id and m.activo=true
      and ((m.todos_locales=true and m.local_id is null)
        or (m.todos_locales=false and m.local_id=p_local_id))
  ) then raise exception 'descuento_politica_usuario_fuera_de_local'; end if;

  v_request:=jsonb_build_object(
    'operation_id',p_operation_id,'empresa_id',p_empresa_id,'local_id',p_local_id,
    'rol',v_role,'user_id',p_user_id,'max_percent',p_max_percent::numeric(9,4)::text,
    'permite_cortesia',p_permite_cortesia,'puede_solicitar',p_puede_solicitar,
    'puede_aplicar',p_puede_aplicar,'puede_autorizar',p_puede_autorizar,
    'permite_escalado',p_permite_escalado,
    'requiere_doble_aprobacion',p_requiere_doble_aprobacion,'activa',p_activa,
    'motivo',v_reason,'operating_day',p_operating_day,'actor_user_id',auth.uid()
  );
  perform private.abc_a09_lock_config_context_write(p_empresa_id,p_local_id);
  v_command:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,
    'ABC_CONFIGURAR_DESCUENTO_POLITICA',v_request,null);
  if (v_command->>'replayed')::boolean then
    if v_command->>'status'='COMPLETADA' then return v_command->'resultado'; end if;
    if v_command->>'status'='FALLIDA' then return coalesce(v_command->'error',v_command); end if;
  end if;

  if v_role is not null then
    select * into v_existing from public.abc_descuento_politicas p
    where p.empresa_id=p_empresa_id and p.local_id=p_local_id and p.rol=v_role
    for update;
  else
    select * into v_existing from public.abc_descuento_politicas p
    where p.empresa_id=p_empresa_id and p.local_id=p_local_id and p.user_id=p_user_id
    for update;
  end if;
  if found then
    v_policy_id:=v_existing.id;
    v_before:=to_jsonb(v_existing);
    update public.abc_descuento_politicas set
      max_percent=p_max_percent,permite_cortesia=p_permite_cortesia,
      puede_solicitar=p_puede_solicitar,puede_aplicar=p_puede_aplicar,
      puede_autorizar=p_puede_autorizar,permite_escalado=p_permite_escalado,
      requiere_doble_aprobacion=p_requiere_doble_aprobacion,activa=p_activa
    where id=v_policy_id;
  else
    insert into public.abc_descuento_politicas(
      empresa_id,local_id,rol,user_id,max_percent,permite_cortesia,
      puede_solicitar,puede_aplicar,puede_autorizar,permite_escalado,
      requiere_doble_aprobacion,activa
    ) values (
      p_empresa_id,p_local_id,v_role,p_user_id,p_max_percent,p_permite_cortesia,
      p_puede_solicitar,p_puede_aplicar,p_puede_autorizar,p_permite_escalado,
      p_requiere_doble_aprobacion,p_activa
    ) returning id into v_policy_id;
  end if;
  v_result:=jsonb_build_object('ok',true,'status','CONFIGURADA',
    'operation_id',p_operation_id,'policy_id',v_policy_id,
    'local_id',p_local_id,'rol',v_role,'user_id',p_user_id,
    'configuracion',v_request-'operation_id'-'motivo'-'operating_day'-'actor_user_id',
    'replayed',false);
  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'DESCUENTO_POLITICA',v_policy_id::text,
    'DESCUENTO_POLITICA_CONFIGURADA',
    jsonb_build_object('before',v_before,'after',to_jsonb((
      select p from public.abc_descuento_politicas p where p.id=v_policy_id
    )),'reason',v_reason),
    auth.uid(),clock_timestamp(),p_operating_day
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $function$;

do $$
begin
  if (select md5(replace(p.prosrc,chr(13),'')) from pg_proc p where p.oid = 'private.pm06_puede_gestionar_finanzas()'::regprocedure)
     = 'bdda0898d5efd69697ef00eda35a577e' then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_POSTFLIGHT_FALLO:pm06_puede_gestionar_finanzas_sin_cambios';
  end if;
  if not exists (
    select 1 from pg_proc p where p.oid = 'public.abc_configurar_descuento_politica(text,text,text,text,uuid,numeric,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text,date)'::regprocedure
      and p.prosrc like '%plataforma_debe_cambiar_password%'
  ) then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_POSTFLIGHT_FALLO:descuento_politica_sin_cambio';
  end if;
  if not exists (
    select 1 from pg_proc p where p.oid = 'private.abc_config_puede_configurar_empresa(text,text)'::regprocedure
      and p.prosrc like '%plataforma_debe_cambiar_password%'
  ) then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_POSTFLIGHT_FALLO:abc_config_puede_configurar_empresa_sin_cambio';
  end if;
end $$;
