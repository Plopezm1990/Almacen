-- Plataforma · Blindaje en servidor de la contraseña inicial obligatoria (D01, decisión 3).
-- Segunda parte: engancha el bloqueo en los filtros de permisos compartidos reales
-- y marca a los nuevos dueños al asignarlos.
-- Diseño: docs/plan-empresas/D01_BLINDAJE_PASSWORD_INICIAL_DISENO_2026-10-16.md
-- Depende de: 20261016120000_plataforma_password_inicial_pendiente.sql (ya aplicada antes que esta).
--
-- Sustituye el texto EXACTO (byte a byte, capturado por lectura de pg_proc.prosrc,
-- sin retipear) de cuatro funciones ya existentes en producción, comprobando antes
-- su huella (mismo patrón que F4d/F4e, misma fórmula: md5(replace(prosrc,chr(13),''))):
-- si alguna ha cambiado desde que se leyó su texto para preparar esta migración, se
-- detiene sin tocar nada.
--
-- Cambia:
--   * private.abc_tiene_capacidad   (122 usos en 39 migraciones)       -- añade 1 línea
--   * private.plataforma_kv_permitido                                  -- añade 1 condición
--   * private.plataforma_mov_permitido                                 -- añade 1 condición
--   * public.plataforma_asignar_propietario                            -- marca al nuevo dueño
--
-- Deliberadamente NO incluida en esta migración: la familia de políticas
-- RLS de suscripciones_push (plataforma_push_select/insert/update/delete).
-- No son funciones sustituibles con CREATE OR REPLACE: son condiciones
-- escritas directamente en la política, y cambiarlas exige DROP POLICY +
-- CREATE POLICY -- la propia herramienta de migraciones cancela los lotes
-- que mezclan DROP POLICY con otras sentencias (ya documentado en el
-- informe de traspaso, §8.2). Se prepara como subpunto 3b, aparte.
--
-- No aplicar en QA ni en PROD sin autorización expresa para ese entorno.

do $$
declare
  v_h text;
begin
  if to_regprocedure('private.plataforma_debe_cambiar_password(uuid)') is null then
    raise exception 'PLATAFORMA_PASSWORD_FILTROS_PREFLIGHT_FALLO:falta_20261016120000';
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h
    from pg_proc p where p.oid = 'private.abc_tiene_capacidad(text,text,text)'::regprocedure;
  if v_h is distinct from '7e7885540674529319b91362783eb0f0' then
    raise exception 'PLATAFORMA_PASSWORD_FILTROS_PREFLIGHT_FALLO:funcion_distinta:abc_tiene_capacidad:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h
    from pg_proc p where p.oid = 'private.plataforma_kv_permitido(text,text,text,text)'::regprocedure;
  if v_h is distinct from '64381389d574e5b85b372e92ebd443cc' then
    raise exception 'PLATAFORMA_PASSWORD_FILTROS_PREFLIGHT_FALLO:funcion_distinta:plataforma_kv_permitido:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h
    from pg_proc p where p.oid = 'private.plataforma_mov_permitido(text,text,text)'::regprocedure;
  if v_h is distinct from '0bd40a2617bdb6c9debf3ca6fedd20fd' then
    raise exception 'PLATAFORMA_PASSWORD_FILTROS_PREFLIGHT_FALLO:funcion_distinta:plataforma_mov_permitido:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h
    from pg_proc p where p.oid = 'public.plataforma_asignar_propietario(text,text,uuid)'::regprocedure;
  if v_h is distinct from '1071c280375e71c2fa62bfbd6137b8af' then
    raise exception 'PLATAFORMA_PASSWORD_FILTROS_PREFLIGHT_FALLO:funcion_distinta:plataforma_asignar_propietario:%', v_h;
  end if;
end $$;

-- 1. private.abc_tiene_capacidad -- mismo texto exacto, con una línea añadida
--    justo después de "if auth.uid() is null then return false; end if;".
CREATE OR REPLACE FUNCTION private.abc_tiene_capacidad(p_empresa_id text, p_local_id text, p_capacidad text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rol text;
  v_capacidad text := upper(btrim(coalesce(p_capacidad,'')));
begin
  if auth.uid() is null then return false; end if;
  if private.plataforma_debe_cambiar_password() then return false; end if;
  if nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or v_capacidad='' then
    return false;
  end if;
  if not private.la_tiene_local(p_empresa_id,p_local_id) then return false; end if;

  select m.rol into v_rol
    from public.membresias_usuario m
   where m.user_id=auth.uid()
     and m.empresa_id=p_empresa_id
     and m.activo=true
     and ((m.todos_locales=false and m.local_id=p_local_id)
       or (m.todos_locales=true and m.local_id is null))
   order by case when m.todos_locales=false and m.local_id=p_local_id then 0 else 1 end,m.id desc
   limit 1;

  if v_rol is null then return false; end if;

  return private.abc_cap_efectiva(p_empresa_id,p_local_id,v_rol,v_capacidad,'GENERAL');
end $function$;

-- 2. private.plataforma_kv_permitido -- mismo texto exacto, con una condición añadida.
CREATE OR REPLACE FUNCTION private.plataforma_kv_permitido(p_empresa text, p_local text, p_key text, p_accion text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_empresa is not null
     and p_key is not null
     and private.la_tiene_empresa(p_empresa)
     and (p_local is null or private.la_tiene_local(p_empresa, p_local))
     and not private.plataforma_debe_cambiar_password()
     and exists (
       select 1
         from public.membresias_usuario m
         join public.empresas e on e.id = m.empresa_id and e.activo = true
        where m.user_id = auth.uid()
          and m.empresa_id = p_empresa
          and m.activo = true
          and (p_accion is distinct from 'borrar' or m.rol = 'Propietario')
          and private.plataforma_kv_rol_puede(m.rol, p_key)
     )
$function$;

-- 3. private.plataforma_mov_permitido -- mismo texto exacto, con una condición añadida.
CREATE OR REPLACE FUNCTION private.plataforma_mov_permitido(p_empresa text, p_local text, p_accion text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_empresa is not null
     and private.la_tiene_empresa(p_empresa)
     and (p_local is null or private.la_tiene_local(p_empresa, p_local))
     and not private.plataforma_debe_cambiar_password()
     and exists (
       select 1
         from public.membresias_usuario m
         join public.empresas e on e.id = m.empresa_id and e.activo = true
        where m.user_id = auth.uid()
          and m.empresa_id = p_empresa
          and m.activo = true
          and (p_accion is distinct from 'borrar' or m.rol = 'Propietario')
     )
$function$;

-- 4. public.plataforma_asignar_propietario -- mismo texto exacto, con una línea
--    añadida justo después de vincular al dueño: lo marca como pendiente de
--    cambiar la contraseña inicial, en la MISMA transacción (todo o nada).
CREATE OR REPLACE FUNCTION public.plataforma_asignar_propietario(p_operation_id text, p_empresa_id text, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_empresa public.empresas%rowtype;
  v_peticion text;
  v_prev record;
  v_res jsonb;
begin
  perform private.plataforma_exigir_admin();
  perform private.plataforma_validar_operation_id(p_operation_id);

  v_peticion := jsonb_build_object('e', p_empresa_id, 'u', p_user_id)::text;

  perform pg_advisory_xact_lock(hashtextextended('la-suite:plataforma:op:' || p_operation_id, 0));
  select a.accion, a.peticion, a.resultado into v_prev
    from private.plataforma_auditoria a where a.operation_id = p_operation_id;
  if found then
    if v_prev.accion <> 'asignar_propietario' or v_prev.peticion is distinct from v_peticion then
      raise exception 'operation_id reutilizado con otra petición' using errcode = '22023';
    end if;
    return v_prev.resultado || jsonb_build_object('idempotente', true);
  end if;

  select * into v_empresa from public.empresas e where e.id = p_empresa_id for update;
  if not found then
    raise exception 'Empresa no encontrada' using errcode = 'P0002';
  end if;
  if v_empresa.activo is not true then
    raise exception 'La empresa está desactivada: reactívala antes de asignarle un propietario' using errcode = '22023';
  end if;

  perform private.plataforma_vincular_propietario(p_empresa_id, p_user_id, null);
  perform private.plataforma_marcar_password_pendiente(p_user_id);

  v_res := jsonb_build_object('ok', true, 'empresa_id', p_empresa_id, 'propietario_vinculado', true);

  insert into private.plataforma_auditoria(actor, accion, empresa_id, operation_id, peticion, detalle, resultado)
  values (auth.uid(), 'asignar_propietario', p_empresa_id, p_operation_id, v_peticion, '{}'::jsonb, v_res);

  return v_res;
end;
$function$;

do $$
begin
  if (select md5(replace(p.prosrc,chr(13),'')) from pg_proc p where p.oid = 'private.abc_tiene_capacidad(text,text,text)'::regprocedure)
     = '7e7885540674529319b91362783eb0f0' then
    raise exception 'PLATAFORMA_PASSWORD_FILTROS_POSTFLIGHT_FALLO:abc_tiene_capacidad_sin_cambios';
  end if;
  if not exists (
    select 1 from pg_proc p where p.oid = 'public.plataforma_asignar_propietario(text,text,uuid)'::regprocedure
      and p.prosrc like '%plataforma_marcar_password_pendiente%'
  ) then
    raise exception 'PLATAFORMA_PASSWORD_FILTROS_POSTFLIGHT_FALLO:asignar_propietario_sin_marca';
  end if;
end $$;
