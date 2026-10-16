-- Plataforma · Blindaje en servidor de la contraseña inicial obligatoria (D01, decisión 3).
-- Quinta parte: extiende el bloqueo al bloque de PRIORIDAD MEDIA de la auditoría de hoy
-- (docs/plan-empresas/D01_AUDITORIA_FUNCIONES_SIN_BLINDAJE_2026-10-16.md §3):
--   * aprobación de descuentos (dinero, con un paso de aprobación de por medio)
--   * personal y fichajes (datos sensibles de personas)
--   * conteos e inventario
--
-- A diferencia del bloque de prioridad alta, aquí NO hay un único patrón de siete funciones
-- compartidas: hay tres funciones de permiso compartidas del propio estilo pm11 (que cubren 12 de
-- las 19 funciones de personal/fichajes), cinco funciones «huérfanas» con su guardia de acceso
-- escrito en línea dentro de la propia función (sin pasar por ningún «puede_X» compartido), y dos
-- funciones de aprobación de descuentos con su propia lógica de autorización, también en línea.
-- Catorce piezas distintas en total, cada una con su propio texto EXACTO (byte a byte, leído de
-- pg_proc.prosrc, sin retipear) capturado hoy de QA y comprobado por huella antes y después, mismo
-- patrón que los subpuntos 3 y 4.
--
-- Qué cubre cada pieza:
--   public.abc_aplicar_descuento_cuenta(...)            -- ella misma, condición propia
--   public.abc_aprobar_descuento_cuenta(...)             -- ella misma, condición propia
--   private.pm11_puede_mutar_personal(text,text)         -- pm11_alta/baja/editar/reactivar_empleado,
--                                                            pm11_crear/eliminar_prefiltro_candidato,
--                                                            pm13_registrar/anular_ausencia (8 funciones)
--   private.pm11_propietario_puede_gestionar_vinculo(text,text) -- pm11_anonimizar/vincular/
--                                                                    desvincular_cuenta_empleado (3)
--   private.pm11_puede_migrar_personal(text,text)        -- pm11_migrar_empleados_legacy (1)
--   public.pm11_estado_cuentas_empleados(...)            -- ella misma, condición propia (p_actor_user_id)
--   public.pm11_preparar_cuenta_empleado(...)            -- ella misma, condición propia (p_actor_user_id)
--   public.pm11_finalizar_creacion_cuenta_empleado(...)  -- ella misma, condición propia (p_actor_user_id)
--   public.pm13_fichar(...)                              -- ella misma (autoservicio, sin rol)
--   public.pm13_fichaje_manual(...)                      -- ella misma
--   public.pm13_corregir_fichaje(...)                    -- ella misma
--   public.pm13_anular_fichaje(...)                      -- ella misma
--   private.pm12_cancelar_conteo_stock(...)              -- ella misma (el envoltorio público
--                                                            public.pm12_cancelar_conteo_stock solo
--                                                            llama a esta; hereda el bloqueo sin tocarlo)
--   public.pm12_cerrar_conteo(...)                       -- ella misma
--   public.pm12_listar_cierres(...)                      -- ella misma
--
-- Deliberadamente NO incluida: public.pm12_confirmar_ajuste_stock (su implementación real,
-- private.pm12_confirmar_ajuste_stock, ya llama a private.pm07_puede_gestionar_stock -- blindada
-- desde el subpunto 4 de hoy -- comprobado leyendo su texto real durante esta tarea).
--
-- Deliberadamente NO se toca private.la_usuario_activo() ni private.la_rol(): son primitivas de
-- muy bajo nivel usadas por decenas de funciones no auditadas todavía; cambiar su comportamiento
-- ampliaría el alcance de este cambio más allá de lo revisado hoy. El guardia se añade en cada
-- punto de entrada de las 15 piezas de arriba, igual que en los subpuntos 3 y 4.
--
-- No aplicar en QA ni en PROD sin autorización expresa para ese entorno.

do $$
declare
  v_h text;
begin
  if to_regprocedure('private.plataforma_debe_cambiar_password(uuid)') is null then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_PREFLIGHT_FALLO:falta_20261016120000';
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'public.abc_aplicar_descuento_cuenta(text,text,text,uuid,text,numeric,text,bigint,uuid,uuid,date)'::regprocedure;
  if v_h is distinct from 'ed151626fc4777ea91d41886a6b3261c' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_PREFLIGHT_FALLO:funcion_distinta:abc_aplicar_descuento_cuenta:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'public.abc_aprobar_descuento_cuenta(text,text,text,text,uuid,text,text)'::regprocedure;
  if v_h is distinct from '3683db7753bb37e77ab9cc3a3553d774' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_PREFLIGHT_FALLO:funcion_distinta:abc_aprobar_descuento_cuenta:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'private.pm11_puede_mutar_personal(text,text)'::regprocedure;
  if v_h is distinct from 'e4ea974c9240774fd9835f20325f5690' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_PREFLIGHT_FALLO:funcion_distinta:pm11_puede_mutar_personal:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'private.pm11_propietario_puede_gestionar_vinculo(text,text)'::regprocedure;
  if v_h is distinct from 'cae161db6011ca7be1450a8c8369e9af' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_PREFLIGHT_FALLO:funcion_distinta:pm11_propietario_puede_gestionar_vinculo:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'private.pm11_puede_migrar_personal(text,text)'::regprocedure;
  if v_h is distinct from '97d51e5931f0b18d86281ed026d9c548' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_PREFLIGHT_FALLO:funcion_distinta:pm11_puede_migrar_personal:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'public.pm11_estado_cuentas_empleados(text,text,text[])'::regprocedure;
  if v_h is distinct from 'b4dcbdc5b0d1794e3f8330fe22c2f25b' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_PREFLIGHT_FALLO:funcion_distinta:pm11_estado_cuentas_empleados:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'public.pm11_preparar_cuenta_empleado(uuid,text)'::regprocedure;
  if v_h is distinct from '8c207ef70ef013edfc5481bbceb8d3ef' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_PREFLIGHT_FALLO:funcion_distinta:pm11_preparar_cuenta_empleado:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'public.pm11_finalizar_creacion_cuenta_empleado(uuid,uuid,text,text,text,text,text)'::regprocedure;
  if v_h is distinct from '7d7e3ba5458ab1d157cdd26fd988d5c8' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_PREFLIGHT_FALLO:funcion_distinta:pm11_finalizar_creacion_cuenta_empleado:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'public.pm13_fichar(text,text,text,text)'::regprocedure;
  if v_h is distinct from '055e04b2c834a7338821ceb1dd656670' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_PREFLIGHT_FALLO:funcion_distinta:pm13_fichar:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'public.pm13_fichaje_manual(text,text,date,text,text,text,text)'::regprocedure;
  if v_h is distinct from '95376137adabd45a1e08f5690867db4c' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_PREFLIGHT_FALLO:funcion_distinta:pm13_fichaje_manual:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'public.pm13_corregir_fichaje(text,date,text,text,text,text)'::regprocedure;
  if v_h is distinct from '2cad81982d0eaacfcb7d3d531aafa734' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_PREFLIGHT_FALLO:funcion_distinta:pm13_corregir_fichaje:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'public.pm13_anular_fichaje(text,text,text)'::regprocedure;
  if v_h is distinct from '6199cb57fa27262a7407e30c8dcdfb93' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_PREFLIGHT_FALLO:funcion_distinta:pm13_anular_fichaje:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'private.pm12_cancelar_conteo_stock(text,text,jsonb,jsonb)'::regprocedure;
  if v_h is distinct from '60dd4f8477990a362cf35bb385558b6b' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_PREFLIGHT_FALLO:funcion_distinta:pm12_cancelar_conteo_stock:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'public.pm12_cerrar_conteo(text,text,jsonb)'::regprocedure;
  if v_h is distinct from 'b141d981e9fd660ea783a08c9bb20f1d' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_PREFLIGHT_FALLO:funcion_distinta:pm12_cerrar_conteo:%', v_h;
  end if;

  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid = 'public.pm12_listar_cierres(text,text)'::regprocedure;
  if v_h is distinct from 'cd064470f8260a246471d98f992e83a9' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_PREFLIGHT_FALLO:funcion_distinta:pm12_listar_cierres:%', v_h;
  end if;
end $$;

-- 1. public.abc_aplicar_descuento_cuenta -- mismo texto exacto, con la condición añadida en la
--    misma comprobación que ya exigía auth.uid() y pertenencia al local.
CREATE OR REPLACE FUNCTION public.abc_aplicar_descuento_cuenta(p_operation_id text, p_empresa_id text, p_local_id text, p_cuenta_id uuid, p_tipo text, p_valor numeric, p_motivo text, p_expected_cuenta_version bigint, p_terminal_id uuid, p_session_id uuid, p_operating_day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_policy jsonb;
  v_requester_policy jsonb;
  v_authorizer_policy jsonb;
  v_snapshot jsonb;
  v_snapshot_hash text;
  v_authorization public.abc_descuento_autorizaciones%rowtype;
  v_has_authorization boolean:=false;
  v_requires_dual boolean:=false;
  v_over_requester_limit boolean:=false;
  v_escalated boolean:=false;
  v_authorizer_id uuid;
  v_authorization_id uuid;
  v_max numeric(9,4);
  v_authorizer_max numeric(9,4);
  v_kind text:=upper(btrim(coalesce(p_tipo,'')));
  v_reason text:=btrim(coalesce(p_motivo,''));
  v_request jsonb;
  v_cmd jsonb;
  v_cuenta public.cuentas_comerciales%rowtype;
  v_line public.pedido_lineas%rowtype;
  v_row public.cuenta_linea_repartos%rowtype;
  v_line_id uuid;
  v_rate numeric(9,4);
  v_source_ids uuid[]:=array[]::uuid[];
  v_changed_source_ids uuid[]:=array[]::uuid[];
  v_account_ids uuid[]:=array[]::uuid[];
  v_base numeric(24,8);
  v_amount numeric(24,8);
  v_delta numeric(24,8);
  v_tax numeric(24,8);
  v_new_base numeric(24,8);
  v_new_total numeric(24,8);
  v_agg record;
  v_alloc record;
  v_version bigint;
  v_result jsonb;
begin
  if auth.uid() is null or private.plataforma_debe_cambiar_password() or not private.la_tiene_local(p_empresa_id,p_local_id) then
    raise exception 'descuento_no_autorizado';
  end if;
  perform private.abc_a09_lock_config_context(p_empresa_id,p_local_id);
  v_policy:=private.abc_descuento_politica(p_empresa_id,p_local_id);
  v_requester_policy:=private.abc_descuento_politica_usuario(
    auth.uid(),p_empresa_id,p_local_id
  );
  v_max:=(v_policy->>'max_percent')::numeric;
  if p_cuenta_id is null or p_expected_cuenta_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null
     or char_length(v_reason) not between 1 and 500
     or v_kind not in ('PERCENT','AMOUNT','COURTESY')
     or (v_kind='COURTESY' and p_valor is not null)
     or (v_kind<>'COURTESY' and (p_valor is null or p_valor<=0
       or p_valor<>round(p_valor,8)))
     or (v_kind='PERCENT' and p_valor>100) then
    raise exception 'descuento_parametros_invalidos';
  end if;
  if not coalesce((v_requester_policy->>'puede_solicitar')::boolean,false) then
    raise exception 'descuento_solicitar_no_autorizado';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then raise exception 'terminal_sesion_no_operativa'; end if;

  v_request:=jsonb_build_object(
    'operation_id',p_operation_id,'empresa_id',p_empresa_id,'local_id',p_local_id,
    'cuenta_id',p_cuenta_id,'tipo',v_kind,'valor',p_valor,'motivo',v_reason,
    'expected_cuenta_version',p_expected_cuenta_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,
    'operating_day',p_operating_day,'actor_user_id',auth.uid()
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_APLICAR_DESCUENTO_CUENTA',
    v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    if v_cmd->>'status'='COMPLETADA' then return v_cmd->'resultado'; end if;
    if v_cmd->>'status'='FALLIDA' then return coalesce(v_cmd->'error',v_cmd); end if;
  end if;
  select * into v_authorization from public.abc_descuento_autorizaciones a
  where a.operation_id=p_operation_id and a.empresa_id=p_empresa_id and a.local_id=p_local_id;
  v_has_authorization:=found;
  v_escalated:=case when v_has_authorization then coalesce(
    (v_authorization.snapshot#>>'{operation,requiere_escalado}')::boolean,false)
    else false end;
  if v_has_authorization and (
    v_requester_policy is distinct from v_authorization.politica_solicitante
    or v_max<=0
    or (v_kind='COURTESY' and not coalesce((v_policy->>'permite_cortesia')::boolean,false))
    or not coalesce((v_requester_policy->>'puede_solicitar')::boolean,false)
    or (v_escalated and not coalesce((v_requester_policy->>'permite_escalado')::boolean,false))
    or (not v_escalated and not coalesce(
      (v_requester_policy->>'requiere_doble_aprobacion')::boolean,false))
  ) then
    v_result:=jsonb_build_object('ok',false,'status','INVALIDADA',
      'operation_id',p_operation_id,'error','descuento_autorizacion_configuracion_cambiada');
    update public.abc_descuento_autorizaciones
      set estado='INVALIDADA',resultado=v_result where id=v_authorization.id;
    perform private.abc_operacion_fallar(p_operation_id,v_result);
    return v_result;
  end if;
  if not v_has_authorization and v_max<=0 then raise exception 'descuento_no_autorizado'; end if;
  if v_kind='COURTESY' and not coalesce((v_policy->>'permite_cortesia')::boolean,false) then
    if v_has_authorization then
      v_result:=jsonb_build_object('ok',false,'status','INVALIDADA',
        'operation_id',p_operation_id,'error','cortesia_no_autorizada');
      update public.abc_descuento_autorizaciones
        set estado='INVALIDADA',resultado=v_result where id=v_authorization.id;
      perform private.abc_operacion_fallar(p_operation_id,v_result);
      return v_result;
    end if;
    raise exception 'cortesia_no_autorizada';
  end if;
  v_authorizer_id:=auth.uid();

  -- Bloquear en orden todas las cuentas con participacion en las lineas
  -- visibles en la cuenta objetivo, como hace A08 en operaciones bilaterales.
  perform 1 from public.cuentas_comerciales c
  where c.empresa_id=p_empresa_id and c.local_id=p_local_id
    and (c.id=p_cuenta_id or c.id in (
      select r2.cuenta_id from public.cuenta_linea_repartos r2
      where r2.empresa_id=p_empresa_id and r2.local_id=p_local_id
        and r2.estado='ACTIVO' and r2.source_line_id in (
          select l.id from public.pedido_lineas l
          join public.pedidos_tpv p on p.empresa_id=l.empresa_id
            and p.local_id=l.local_id and p.id=l.pedido_id
          where l.empresa_id=p_empresa_id and l.local_id=p_local_id
            and (p.cuenta_id=p_cuenta_id or exists (
              select 1 from public.cuenta_linea_repartos rt
              where rt.empresa_id=l.empresa_id and rt.local_id=l.local_id
                and rt.source_line_id=l.id and rt.cuenta_id=p_cuenta_id
                and rt.estado='ACTIVO'
            ))
        )
    ))
  order by c.id for update;

  select * into v_cuenta from public.cuentas_comerciales c
  where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=p_cuenta_id
  for update;
  if not found then
    if v_has_authorization then
      v_result:=jsonb_build_object('ok',false,'status','INVALIDADA',
        'operation_id',p_operation_id,'error','descuento_cuenta_no_encontrada');
      update public.abc_descuento_autorizaciones
        set estado='INVALIDADA',resultado=v_result where id=v_authorization.id;
      perform private.abc_operacion_fallar(p_operation_id,v_result);
      return v_result;
    end if;
    raise exception 'descuento_cuenta_no_encontrada';
  end if;
  if v_cuenta.estado<>'ABIERTA' then
    if v_has_authorization then
      v_result:=jsonb_build_object('ok',false,'status','INVALIDADA',
        'operation_id',p_operation_id,'error','descuento_cuenta_no_abierta');
      update public.abc_descuento_autorizaciones
        set estado='INVALIDADA',resultado=v_result where id=v_authorization.id;
      perform private.abc_operacion_fallar(p_operation_id,v_result);
      return v_result;
    end if;
    raise exception 'descuento_cuenta_no_abierta';
  end if;
  if v_cuenta.version<>p_expected_cuenta_version then
    if v_has_authorization then
      v_result:=jsonb_build_object('ok',false,'status','INVALIDADA',
        'operation_id',p_operation_id,'error','cuenta_version_conflict');
      update public.abc_descuento_autorizaciones
        set estado='INVALIDADA',resultado=v_result where id=v_authorization.id;
      perform private.abc_operacion_fallar(p_operation_id,v_result);
      return v_result;
    end if;
    raise exception 'cuenta_version_conflict';
  end if;
  if v_cuenta.opened_operating_day<>p_operating_day then
    raise exception 'descuento_operating_day_incompatible';
  end if;

  -- El orden cuenta -> linea -> reparto sigue las RPC A08. La transaccion
  -- completa se revierte ante cualquier version/conflicto.
  for v_line_id in
    select distinct l.id
    from public.pedido_lineas l
    join public.pedidos_tpv p on p.empresa_id=l.empresa_id
      and p.local_id=l.local_id and p.id=l.pedido_id
    where l.empresa_id=p_empresa_id and l.local_id=p_local_id
      and l.estado<>'CANCELADA'
      and (p.cuenta_id=p_cuenta_id or exists (
        select 1 from public.cuenta_linea_repartos r
        where r.empresa_id=l.empresa_id and r.local_id=l.local_id
          and r.source_line_id=l.id and r.cuenta_id=p_cuenta_id and r.estado='ACTIVO'
      ))
    order by l.id
  loop
    select * into v_line from public.pedido_lineas l
    where l.empresa_id=p_empresa_id and l.local_id=p_local_id and l.id=v_line_id
    for update;
    -- Una linea originaria de esta cuenta puede haberse movido por completo.
    if exists (
      select 1 from public.cuenta_linea_repartos r
      where r.empresa_id=p_empresa_id and r.local_id=p_local_id
        and r.source_line_id=v_line_id and r.estado='ACTIVO'
    ) and not exists (
      select 1 from public.cuenta_linea_repartos r
      where r.empresa_id=p_empresa_id and r.local_id=p_local_id
        and r.source_line_id=v_line_id and r.cuenta_id=p_cuenta_id
        and r.estado='ACTIVO'
    ) then continue; end if;
    if v_line.estado in ('BORRADOR','CANCELADA') or v_line.base is null
       or v_line.descuento_total is null or v_line.impuestos is null
       or v_line.total is null then raise exception 'descuento_linea_no_apta'; end if;
    v_rate:=coalesce(
      nullif(v_line.snapshot_calculo->>'impuesto_base_pct','')::numeric,
      nullif(v_line.snapshot_calculo->>'impuesto_pct','')::numeric,
      nullif(v_line.snapshot_comercial->>'impuesto_pct','')::numeric,
      nullif(v_line.snapshot_comercial->>'impuesto_base_pct','')::numeric
    );
    if v_rate is null or v_rate<0 or v_rate>100 then
      raise exception 'descuento_tipo_iva_desconocido';
    end if;
    if exists (
      select 1 from public.pedido_linea_opciones o
      where o.empresa_id=p_empresa_id and o.local_id=p_local_id
        and o.linea_id=v_line_id and o.base<>0 and o.impuesto_pct<>v_rate
    ) then raise exception 'descuento_reparto_iva_mixto_no_soportado'; end if;
    if exists (
      select 1 from public.venta_fiscal_lineas vl
      join public.ventas_fiscales vf on vf.empresa_id=vl.empresa_id
        and vf.local_id=vl.local_id and vf.id=vl.venta_fiscal_id
      where vl.empresa_id=p_empresa_id and vl.local_id=p_local_id
        and vl.source_line_id=v_line_id and vf.estado<>'CANCELADA'
    ) then raise exception 'descuento_linea_fiscalizada'; end if;
    if not exists (
      select 1 from public.cuenta_linea_repartos r
      where r.empresa_id=p_empresa_id and r.local_id=p_local_id
        and r.source_line_id=v_line_id and r.estado='ACTIVO'
    ) then
      perform private.abc_materializar_reparto_linea(p_empresa_id,p_local_id,v_line_id);
    end if;
    v_source_ids:=array_append(v_source_ids,v_line_id);
  end loop;
  if cardinality(v_source_ids)=0 then raise exception 'descuento_cuenta_sin_lineas'; end if;

  perform 1 from public.cuenta_linea_repartos r
  where r.empresa_id=p_empresa_id and r.local_id=p_local_id
    and r.source_line_id=any(v_source_ids) and r.estado='ACTIVO'
  order by r.source_line_id,r.id for update;
  if exists (
    select 1 from public.cuenta_linea_repartos r
    where r.empresa_id=p_empresa_id and r.local_id=p_local_id
      and r.source_line_id=any(v_source_ids) and r.estado='ACTIVO'
      and r.total<>r.base+r.impuestos
  ) then raise exception 'descuento_reparto_importes_invalidos'; end if;

  select array_agg(distinct r.cuenta_id order by r.cuenta_id)
    into v_account_ids
  from public.cuenta_linea_repartos r
  where r.empresa_id=p_empresa_id and r.local_id=p_local_id
    and r.source_line_id=any(v_source_ids) and r.estado='ACTIVO';

  if exists (
    select 1 from public.cuentas_comerciales c
    where c.empresa_id=p_empresa_id and c.local_id=p_local_id
      and c.id=any(v_account_ids) and c.estado<>'ABIERTA'
  ) then raise exception 'descuento_reparto_cuenta_no_abierta'; end if;

  if exists (
    select 1 from public.cuenta_cuotas_importe q
    where q.empresa_id=p_empresa_id and q.local_id=p_local_id and q.estado='ACTIVA'
      and (q.cuenta_origen_id=any(v_account_ids)
        or q.cuenta_destino_id=any(v_account_ids))
  ) or exists (
    select 1 from public.checkouts c
    where c.empresa_id=p_empresa_id and c.local_id=p_local_id
      and c.cuenta_id=any(v_account_ids) and c.estado<>'CANCELADO'
  ) then raise exception 'descuento_compromiso_financiero'; end if;

  -- La fuente siempre debe conciliar con todos los repartos antes de tocarla.
  for v_line_id in select unnest(v_source_ids) loop
    select sum(r.descuento) descuento,sum(r.base) base,
           sum(r.impuestos) impuestos,sum(r.total) total
      into v_agg
    from public.cuenta_linea_repartos r
    where r.empresa_id=p_empresa_id and r.local_id=p_local_id
      and r.source_line_id=v_line_id and r.estado='ACTIVO';
    select * into v_line from public.pedido_lineas where id=v_line_id;
    if v_line.descuento_total<>v_agg.descuento or v_line.base<>v_agg.base
       or v_line.impuestos<>v_agg.impuestos or v_line.total<>v_agg.total then
      raise exception 'descuento_reparto_fuente_inconsistente';
    end if;
  end loop;

  select coalesce(sum(r.base),0)::numeric(24,8) into v_base
  from public.cuenta_linea_repartos r
  where r.empresa_id=p_empresa_id and r.local_id=p_local_id
    and r.cuenta_id=p_cuenta_id and r.estado='ACTIVO'
    and r.source_line_id=any(v_source_ids);
  if v_base<=0 then raise exception 'descuento_base_no_positiva'; end if;
  v_amount:=case v_kind
    when 'COURTESY' then v_base
    when 'PERCENT' then round(v_base*p_valor/100,8)
    else p_valor end;
  if v_amount<=0 or v_amount>v_base then raise exception 'descuento_importe_fuera_base'; end if;
  if v_kind<>'COURTESY' and v_amount=v_base then
    raise exception 'descuento_cortesia_requerida';
  end if;

  v_snapshot:=private.abc_a09_snapshot_solicitud(
    v_request,v_source_ids,v_requester_policy
  );
  v_snapshot_hash:=private.abc_a09_snapshot_hash(v_snapshot);
  v_over_requester_limit:=coalesce(
    (v_snapshot#>>'{operation,requiere_escalado}')::boolean,false
  );
  if v_over_requester_limit
     and not coalesce((v_requester_policy->>'permite_escalado')::boolean,false) then
    raise exception 'descuento_escalado_no_permitido';
  end if;
  v_requires_dual:=coalesce(
    (v_requester_policy->>'requiere_doble_aprobacion')::boolean,false)
    or v_over_requester_limit or v_has_authorization;
  if not coalesce((v_requester_policy->>'puede_aplicar')::boolean,false) then
    raise exception 'descuento_aplicar_no_autorizado';
  end if;

  if v_requires_dual then
    if not v_has_authorization then
      v_result:=jsonb_build_object('ok',false,'status','PENDIENTE_AUTORIZACION',
        'operation_id',p_operation_id,'approval_hash',v_snapshot_hash,
        'amount',v_amount::text,'snapshot',v_snapshot,'replayed',false);
      insert into public.abc_descuento_autorizaciones(
        empresa_id,local_id,operation_id,cuenta_id,solicitante_id,motivo,
        snapshot,snapshot_hash,politica_solicitante,resultado
      ) values (
        p_empresa_id,p_local_id,p_operation_id,p_cuenta_id,auth.uid(),v_reason,
        v_snapshot,v_snapshot_hash,v_requester_policy,v_result
      ) returning id into v_authorization_id;
      v_authorization.id:=v_authorization_id;
      v_authorization.estado:='PENDIENTE';
      v_authorization.snapshot:=v_snapshot;
      v_authorization.snapshot_hash:=v_snapshot_hash;
      v_authorization.politica_solicitante:=v_requester_policy;
      v_authorization.solicitante_id:=auth.uid();
      v_authorization.motivo:=v_reason;
      v_has_authorization:=true;
      return v_result;
    end if;
    if v_authorization.estado='PENDIENTE' then
      if v_authorization.snapshot_hash<>v_snapshot_hash
         or v_authorization.snapshot is distinct from v_snapshot then
        v_result:=jsonb_build_object('ok',false,'status','INVALIDADA',
          'operation_id',p_operation_id,'error','descuento_autorizacion_version_obsoleta');
        update public.abc_descuento_autorizaciones
          set estado='INVALIDADA',resultado=v_result where id=v_authorization.id;
        perform private.abc_operacion_fallar(p_operation_id,v_result);
        return v_result;
      end if;
      return (v_authorization.resultado||jsonb_build_object('replayed',true));
    end if;
    if v_authorization.estado<>'APROBADA' then
      return coalesce(v_authorization.resultado,
        jsonb_build_object('ok',false,'status',v_authorization.estado,
          'operation_id',p_operation_id));
    end if;
    v_authorizer_id:=v_authorization.autorizador_id;
    v_authorizer_policy:=private.abc_descuento_politica_usuario(
      v_authorizer_id,p_empresa_id,p_local_id
    );
    if v_authorizer_policy is distinct from v_authorization.politica_autorizador
       or not private.abc_a09_politica_puede_autorizar(v_snapshot,v_authorizer_policy)
       or v_snapshot_hash<>v_authorization.snapshot_hash
       or v_snapshot is distinct from v_authorization.snapshot then
      v_result:=jsonb_build_object('ok',false,'status','INVALIDADA',
        'operation_id',p_operation_id,'error','descuento_autorizacion_contexto_cambiado');
      update public.abc_descuento_autorizaciones
        set estado='INVALIDADA',resultado=v_result where id=v_authorization.id;
      perform private.abc_operacion_fallar(p_operation_id,v_result);
      return v_result;
    end if;
    v_authorizer_max:=(v_authorizer_policy->>'max_percent')::numeric;
    if coalesce((v_snapshot#>>'{operation,requiere_escalado}')::boolean,false) then
      v_max:=v_authorizer_max;
    else
      v_max:=least(v_max,v_authorizer_max);
    end if;
    v_authorization_id:=v_authorization.id;
  end if;

  -- Unidades de 10^-8, restos mayores y empate por reparto.id.
  for v_alloc in
    with raw as (
      select r.id,
        floor(v_amount*r.base/v_base*100000000) units,
        v_amount*r.base/v_base*100000000
          - floor(v_amount*r.base/v_base*100000000) fraction
      from public.cuenta_linea_repartos r
      where r.empresa_id=p_empresa_id and r.local_id=p_local_id
        and r.cuenta_id=p_cuenta_id and r.estado='ACTIVO'
        and r.source_line_id=any(v_source_ids)
    ), ranked as (
      select raw.*,
        row_number() over(order by fraction desc,id) rank_remainder,
        sum(units) over() floor_total
      from raw
    )
    select id,
      (units+case when rank_remainder<=round(v_amount*100000000)-floor_total
        then 1 else 0 end)/100000000::numeric as amount
    from ranked order by id
  loop
    if v_alloc.amount=0 then continue; end if;
    select * into v_row from public.cuenta_linea_repartos where id=v_alloc.id for update;
    if v_kind<>'COURTESY' and v_alloc.amount=v_row.base then
      raise exception 'descuento_cortesia_requerida';
    end if;
    select coalesce(
      nullif(l.snapshot_calculo->>'impuesto_base_pct','')::numeric,
      nullif(l.snapshot_calculo->>'impuesto_pct','')::numeric,
      nullif(l.snapshot_comercial->>'impuesto_pct','')::numeric,
      nullif(l.snapshot_comercial->>'impuesto_base_pct','')::numeric
    ) into v_rate
    from public.pedido_lineas l where l.id=v_row.source_line_id;
    v_new_base:=v_row.base-v_alloc.amount;
    v_tax:=case when v_new_base=0 then 0
      else v_row.impuestos-round(v_alloc.amount*v_rate/100,8) end;
    if v_new_base<0 or v_tax<0 or v_row.total<>v_row.base+v_row.impuestos then
      raise exception 'descuento_reparto_importes_invalidos';
    end if;
    v_new_total:=v_new_base+v_tax;
    update public.cuenta_linea_repartos
      set descuento=descuento+v_alloc.amount,base=v_new_base,
          impuestos=v_tax,total=v_new_total,version=version+1
      where id=v_row.id;
    insert into public.abc_descuentos_aplicados(
      empresa_id,local_id,operation_id,cuenta_id,reparto_id,source_line_id,
      tipo,importe,base_antes,base_despues,iva_antes,iva_despues,motivo,
      solicitante_id,autorizador_id,autorizacion_id,terminal_id,session_id,operating_day
    ) values (
      p_empresa_id,p_local_id,p_operation_id,p_cuenta_id,v_row.id,v_row.source_line_id,
      v_kind,v_alloc.amount,v_row.base,v_new_base,v_row.impuestos,v_tax,v_reason,
      auth.uid(),v_authorizer_id,v_authorization_id,p_terminal_id,p_session_id,p_operating_day
    );
    if not v_row.source_line_id=any(v_changed_source_ids) then
      v_changed_source_ids:=array_append(v_changed_source_ids,v_row.source_line_id);
    end if;
  end loop;

  for v_line_id in select unnest(v_changed_source_ids) loop
    select sum(r.descuento) descuento,sum(r.base) base,
           sum(r.impuestos) impuestos,sum(r.total) total,
           sum(r.descuento+r.base) gross
      into v_agg
    from public.cuenta_linea_repartos r
    where r.empresa_id=p_empresa_id and r.local_id=p_local_id
      and r.source_line_id=v_line_id and r.estado='ACTIVO';
    if v_agg.gross<=0 or v_agg.descuento*100>v_agg.gross*v_max
       or v_agg.total<>v_agg.base+v_agg.impuestos then
      raise exception 'descuento_limite_acumulado_excedido';
    end if;
    update public.pedido_lineas
      set descuento_total=v_agg.descuento,base=v_agg.base,
          impuestos=v_agg.impuestos,total=v_agg.total,version=version+1,
          snapshot_calculo=snapshot_calculo || jsonb_build_object(
            'a09_ultimo_operation_id',p_operation_id
          )
      where empresa_id=p_empresa_id and local_id=p_local_id and id=v_line_id;
  end loop;

  update public.cuentas_comerciales set version=version+1
  where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_id
  returning version into v_version;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CUENTA',p_cuenta_id::text,
    'CUENTA_DESCUENTO_APLICADO',
    jsonb_build_object('tipo',v_kind,'valor',p_valor,'importe',v_amount,
      'motivo',v_reason,'solicitante_id',auth.uid(),'autorizador_id',v_authorizer_id,
      'autorizacion_id',v_authorization_id,
      'cuenta_version',v_version,'session_id',p_session_id),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );
  v_result:=jsonb_build_object(
    'ok',true,'status','APLICADA','cuenta_id',p_cuenta_id,'tipo',v_kind,'descuento',v_amount,
    'autorizador_id',v_authorizer_id,'autorizacion_id',v_authorization_id,
    'cuenta_version',v_version,
    'total_comercial',private.abc_total_comercial_cuenta(
      p_empresa_id,p_local_id,p_cuenta_id
    )
  );
  if v_authorization_id is not null then
    update public.abc_descuento_autorizaciones
      set estado='APLICADA',aplicada_at=now(),resultado=v_result
      where id=v_authorization_id and estado='APROBADA';
    if not found then raise exception 'descuento_autorizacion_no_aprobada'; end if;
  end if;
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $function$;

-- 2. public.abc_aprobar_descuento_cuenta -- mismo texto exacto, con la condición añadida en la
--    comprobación de contexto (pertenencia al local).
CREATE OR REPLACE FUNCTION public.abc_aprobar_descuento_cuenta(p_operation_id text, p_empresa_id text, p_local_id text, p_snapshot_hash text, p_attempt_id uuid, p_decision text, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_operation public.abc_operaciones%rowtype;
  v_authorization public.abc_descuento_autorizaciones%rowtype;
  v_existing_attempt public.abc_descuento_aprobacion_intentos%rowtype;
  v_requester_policy jsonb;
  v_authorizer_policy jsonb;
  v_snapshot jsonb;
  v_source_ids uuid[];
  v_attempt_hash text;
  v_escalated boolean:=false;
  v_decision text:=upper(btrim(coalesce(p_decision,'')));
  v_reason text:=btrim(coalesce(p_motivo,''));
  v_result jsonb;
begin
  if auth.uid() is null or p_attempt_id is null
     or p_snapshot_hash !~ '^[0-9a-f]{64}$'
     or v_decision not in ('APROBAR','RECHAZAR')
     or char_length(v_reason) not between 1 and 500 then
    raise exception 'descuento_aprobacion_parametros_invalidos';
  end if;
  if not private.la_tiene_local(p_empresa_id,p_local_id) or private.plataforma_debe_cambiar_password() then
    raise exception 'contexto_no_autorizado';
  end if;
  perform private.abc_a09_lock_config_context(p_empresa_id,p_local_id);
  perform private.abc_lock_operation_id(p_operation_id);
  select * into v_operation from public.abc_operaciones o
  where o.operation_id=p_operation_id and o.empresa_id=p_empresa_id
    and o.local_id=p_local_id and o.command_type='ABC_APLICAR_DESCUENTO_CUENTA'
  for update;
  if not found then raise exception 'descuento_solicitud_no_encontrada'; end if;
  select * into v_authorization from public.abc_descuento_autorizaciones a
  where a.operation_id=p_operation_id and a.empresa_id=p_empresa_id
    and a.local_id=p_local_id for update;
  if not found then raise exception 'descuento_solicitud_no_encontrada'; end if;

  v_attempt_hash:=private.abc_request_hash(jsonb_build_object(
    'actor_user_id',auth.uid(),'snapshot_hash',p_snapshot_hash,
    'decision',v_decision,'motivo',v_reason
  ));
  select * into v_existing_attempt
  from public.abc_descuento_aprobacion_intentos i
  where i.operation_id=p_operation_id and i.attempt_id=p_attempt_id;
  if found then
    if v_existing_attempt.autorizador_id is distinct from auth.uid()
       or v_existing_attempt.attempt_hash<>v_attempt_hash then
      raise exception 'descuento_aprobacion_attempt_id_conflict';
    end if;
    return v_existing_attempt.resultado||jsonb_build_object('replayed',true);
  end if;

  if p_snapshot_hash<>v_authorization.snapshot_hash then
    v_result:=jsonb_build_object('ok',false,'status','RECHAZADA',
      'operation_id',p_operation_id,'error','descuento_aprobacion_snapshot_conflict');
    insert into public.abc_descuento_aprobacion_intentos(
      empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
      snapshot_hash,decision,motivo,attempt_hash,resultado
    ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
      v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
      v_attempt_hash,v_result);
    return v_result;
  end if;
  if v_authorization.estado<>'PENDIENTE' then
    v_result:=jsonb_build_object('ok',false,'status',v_authorization.estado,
      'operation_id',p_operation_id,
      'error',case when v_authorization.estado='APROBADA'
        then 'descuento_ya_aprobado' else 'descuento_solicitud_cerrada' end,
      'autorizador_id',coalesce(v_authorization.autorizador_id::text,''));
    insert into public.abc_descuento_aprobacion_intentos(
      empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
      snapshot_hash,decision,motivo,attempt_hash,resultado
    ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
      v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
      v_attempt_hash,v_result);
    return v_result;
  end if;

  if auth.uid()=v_authorization.solicitante_id then
    v_result:=jsonb_build_object('ok',false,'status','RECHAZADA',
      'operation_id',p_operation_id,'error','descuento_autoaprobacion_rechazada');
    insert into public.abc_descuento_aprobacion_intentos(
      empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
      snapshot_hash,decision,motivo,attempt_hash,resultado
    ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
      v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
      v_attempt_hash,v_result);
    return v_result;
  end if;

  -- Lock in the A08 order so a split/merge cannot change the approved shares
  -- while the amount snapshot is checked.
  perform 1 from public.cuentas_comerciales c
  where c.empresa_id=p_empresa_id and c.local_id=p_local_id
    and c.id in (select (x->>'cuenta_id')::uuid
      from jsonb_array_elements(v_authorization.snapshot->'accounts') x)
  order by c.id for update;
  perform 1 from public.pedido_lineas l
  where l.empresa_id=p_empresa_id and l.local_id=p_local_id
    and l.id in (select (x->>'line_id')::uuid
      from jsonb_array_elements(v_authorization.snapshot->'lines') x)
  order by l.id for update;
  perform 1 from public.cuenta_linea_repartos r
  where r.empresa_id=p_empresa_id and r.local_id=p_local_id
    and r.id in (select (x->>'reparto_id')::uuid
      from jsonb_array_elements(v_authorization.snapshot->'shares') x)
  order by r.source_line_id,r.id for update;

  select array_agg((x #>> '{}')::uuid order by (x #>> '{}')) into v_source_ids
  from jsonb_array_elements(v_authorization.snapshot->'source_line_ids') x;
  v_requester_policy:=private.abc_descuento_politica_usuario(
    v_authorization.solicitante_id,p_empresa_id,p_local_id
  );
  v_authorizer_policy:=private.abc_descuento_politica_usuario(
    auth.uid(),p_empresa_id,p_local_id
  );
  v_snapshot:=private.abc_a09_snapshot_solicitud(
    v_operation.request,v_source_ids,v_requester_policy
  );
  v_escalated:=coalesce(
    (v_authorization.snapshot#>>'{operation,requiere_escalado}')::boolean,false
  );
  if v_requester_policy is distinct from v_authorization.politica_solicitante
     or not coalesce((v_requester_policy->>'puede_solicitar')::boolean,false)
     or (v_escalated and not coalesce(
       (v_requester_policy->>'permite_escalado')::boolean,false))
     or (not v_escalated and not coalesce(
       (v_requester_policy->>'requiere_doble_aprobacion')::boolean,false))
     or private.abc_a09_snapshot_hash(v_snapshot)<>v_authorization.snapshot_hash
     or v_snapshot is distinct from v_authorization.snapshot then
    v_result:=jsonb_build_object('ok',false,'status','INVALIDADA',
      'operation_id',p_operation_id,'error','descuento_autorizacion_version_obsoleta');
    update public.abc_descuento_autorizaciones
      set estado='INVALIDADA',resultado=v_result where id=v_authorization.id;
    if v_operation.status='PROCESANDO' then
      perform private.abc_operacion_fallar(p_operation_id,v_result);
    end if;
    insert into public.abc_descuento_aprobacion_intentos(
      empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
      snapshot_hash,decision,motivo,attempt_hash,resultado
    ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
      v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
      v_attempt_hash,v_result);
    return v_result;
  end if;
  if not coalesce((v_authorizer_policy->>'puede_autorizar')::boolean,false)
     or (v_decision='APROBAR' and not private.abc_a09_politica_puede_autorizar(
       v_snapshot,v_authorizer_policy
     )) then
    v_result:=jsonb_build_object('ok',false,'status','RECHAZADA',
      'operation_id',p_operation_id,'error','descuento_aprobador_sin_permiso');
    insert into public.abc_descuento_aprobacion_intentos(
      empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
      snapshot_hash,decision,motivo,attempt_hash,resultado
    ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
      v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
      v_attempt_hash,v_result);
    return v_result;
  end if;

  if v_decision='RECHAZAR' then
    v_result:=jsonb_build_object('ok',false,'status','RECHAZADA',
      'operation_id',p_operation_id,'autorizador_id',auth.uid(),
      'motivo',v_reason,'error','descuento_rechazado_por_autorizador');
    update public.abc_descuento_autorizaciones set estado='RECHAZADA',
      autorizador_id=auth.uid(),politica_autorizador=v_authorizer_policy,
      motivo_autorizacion=v_reason,autorizada_at=now(),resultado=v_result
    where id=v_authorization.id and estado='PENDIENTE';
    perform private.abc_operacion_fallar(p_operation_id,v_result);
  else
    v_result:=jsonb_build_object('ok',true,'status','APROBADA',
      'operation_id',p_operation_id,'approval_hash',v_authorization.snapshot_hash,
      'solicitante_id',v_authorization.solicitante_id,
      'autorizador_id',auth.uid(),'motivo',v_reason,'replayed',false);
    update public.abc_descuento_autorizaciones set estado='APROBADA',
      autorizador_id=auth.uid(),politica_autorizador=v_authorizer_policy,
      motivo_autorizacion=v_reason,autorizada_at=now(),resultado=v_result
    where id=v_authorization.id and estado='PENDIENTE';
    if not found then raise exception 'descuento_autorizacion_estado_conflict'; end if;
  end if;
  insert into public.abc_descuento_aprobacion_intentos(
    empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
    snapshot_hash,decision,motivo,attempt_hash,resultado
  ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
    v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
    v_attempt_hash,v_result);
  return v_result;
end $function$;

-- 3. private.pm11_puede_mutar_personal -- mismo texto exacto, con la condición añadida.
CREATE OR REPLACE FUNCTION private.pm11_puede_mutar_personal(p_empresa_id text, p_local_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.la_usuario_activo() and not private.plataforma_debe_cambiar_password() and private.pm11_local_activo(p_empresa_id,p_local_id)
  and exists(select 1 from public.membresias_usuario m where m.user_id=(select auth.uid()) and m.empresa_id=p_empresa_id and m.activo=true
    and ((m.rol='Propietario' and (m.todos_locales=true or m.local_id=p_local_id)) or (m.rol='Encargado' and m.todos_locales=false and m.local_id=p_local_id))); $function$;

-- 4. private.pm11_propietario_puede_gestionar_vinculo -- mismo texto exacto, con la condición añadida.
CREATE OR REPLACE FUNCTION private.pm11_propietario_puede_gestionar_vinculo(p_empresa_id text, p_local_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
  select private.la_usuario_activo() and not private.plataforma_debe_cambiar_password()
     and nullif(btrim(p_empresa_id), '') is not null
     and nullif(btrim(p_local_id), '') is not null
     and upper(btrim(p_local_id)) not in ('TODOS', 'TODOS LOS LOCALES')
     and exists (
       select 1
         from public.membresias_usuario m
        where m.user_id = auth.uid()
          and m.empresa_id = p_empresa_id
          and m.activo = true
          and m.rol = 'Propietario'
          and (m.todos_locales = true or m.local_id = p_local_id)
     );
$function$;

-- 5. private.pm11_puede_migrar_personal -- mismo texto exacto, con la condición añadida.
CREATE OR REPLACE FUNCTION private.pm11_puede_migrar_personal(p_empresa_id text, p_local_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.la_usuario_activo() and not private.plataforma_debe_cambiar_password() and private.pm11_local_activo(p_empresa_id,p_local_id)
  and exists(select 1 from public.membresias_usuario m where m.user_id=(select auth.uid()) and m.empresa_id=p_empresa_id and m.activo=true and m.rol='Propietario'
    and (m.todos_locales=true or m.local_id=p_local_id)); $function$;

-- 6. public.pm11_estado_cuentas_empleados -- mismo texto exacto, con una comprobación nueva justo
--    después de la de "no autenticado" (condición propia: usa p_actor_user_id/v_actor, no auth.uid()
--    directamente en el resto del cuerpo, pero v_actor SE INICIALIZA con auth.uid()).
CREATE OR REPLACE FUNCTION public.pm11_estado_cuentas_empleados(p_empresa_id text, p_local_id text, p_empleado_ids text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_ids text[];
  v_id text;
  v_empleado record;
  v_perfil record;
  v_perfiles integer;
  v_rol text;
  v_estado text;
  v_motivo text;
  v_cuentas jsonb := '[]'::jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('ok',false,'codigo','no_autenticado','cuentas','[]'::jsonb);
  end if;
  if private.plataforma_debe_cambiar_password(v_actor) then
    return jsonb_build_object('ok',false,'codigo','password_pendiente','cuentas','[]'::jsonb);
  end if;
  if nullif(btrim(p_empresa_id),'') is null
     or nullif(btrim(p_local_id),'') is null
     or upper(btrim(p_local_id)) in ('TODOS','TODOS LOS LOCALES') then
    return jsonb_build_object('ok',false,'codigo','contexto_invalido','cuentas','[]'::jsonb);
  end if;
  if not exists (
    select 1 from public.perfiles p
     where p.user_id=v_actor and p.activo=true and p.rol='Propietario'
  ) then
    return jsonb_build_object('ok',false,'codigo','perfil_no_autorizado','cuentas','[]'::jsonb);
  end if;
  if not exists (
    select 1 from public.locales l
     where l.id=btrim(p_local_id) and l.empresa_id=btrim(p_empresa_id) and l.activo=true
  ) then
    return jsonb_build_object('ok',false,'codigo','local_inactivo_o_invalido','cuentas','[]'::jsonb);
  end if;
  if not exists (
    select 1 from public.membresias_usuario m
     where m.user_id=v_actor and m.activo=true
       and m.empresa_id=btrim(p_empresa_id) and m.rol='Propietario'
       and (m.todos_locales=true or (m.todos_locales=false and m.local_id=btrim(p_local_id)))
  ) then
    return jsonb_build_object('ok',false,'codigo','sin_alcance','cuentas','[]'::jsonb);
  end if;

  select coalesce(array_agg(x.id order by x.id),'{}'::text[]) into v_ids
    from (
      select distinct nullif(btrim(raw_id),'') as id
        from unnest(coalesce(p_empleado_ids,'{}'::text[])) as u(raw_id)
       where nullif(btrim(raw_id),'') is not null
    ) x;
  if cardinality(v_ids)>500 then
    return jsonb_build_object('ok',false,'codigo','demasiados_empleados','cuentas','[]'::jsonb);
  end if;

  foreach v_id in array v_ids loop
    v_estado := 'incoherente';
    v_motivo := null;
    v_rol := null;
    v_perfil := null;
    select e.id,e.empresa_id,e.local_id,e.estado into v_empleado
      from public.empleados e where e.id=v_id;
    if not found then
      v_motivo := 'empleado_no_disponible';
    elsif v_empleado.empresa_id is distinct from btrim(p_empresa_id)
       or v_empleado.local_id is distinct from btrim(p_local_id) then
      v_motivo := 'empleado_no_disponible';
    else
      select count(*) into v_perfiles from public.perfiles p where p.empleado_id=v_id;
      if v_perfiles=0 then
        v_estado := 'sin_cuenta';
      elsif v_perfiles>1 then
        v_motivo := 'perfiles_duplicados';
      else
        select p.user_id,p.rol,p.activo into v_perfil
          from public.perfiles p where p.empleado_id=v_id;
        v_rol := v_perfil.rol;
        if v_perfil.user_id is null
           or not exists (select 1 from auth.users u where u.id=v_perfil.user_id) then
          v_motivo := 'auth_usuario_no_encontrado';
        elsif v_perfil.activo is null then
          v_motivo := 'activo_nulo';
        elsif nullif(btrim(v_perfil.rol),'') is null
           or v_perfil.rol not in ('Encargado','Básico','Camarero/a','Cajero/a','Churrero/a') then
          v_motivo := 'rol_invalido';
        elsif not exists (
          select 1 from public.membresias_usuario m
           where m.user_id=v_perfil.user_id and m.activo=true
             and m.empresa_id=btrim(p_empresa_id) and m.local_id=btrim(p_local_id)
             and m.todos_locales=false and m.rol=v_perfil.rol
        ) then
          v_motivo := 'membresia_incoherente';
        elsif v_perfil.activo=false then
          v_estado := 'suspendida';
        else
          v_estado := 'activa';
        end if;
      end if;
    end if;
    v_cuentas := v_cuentas || jsonb_build_array(jsonb_build_object(
      'empleado_id',v_id,
      'estado',v_estado,
      'rol',case when v_estado in ('activa','suspendida') then v_rol else null end,
      'activo',case when v_estado='activa' then true when v_estado='suspendida' then false else null end,
      'motivo',v_motivo
    ));
  end loop;

  return jsonb_build_object(
    'ok',true,
    'empresa_id',btrim(p_empresa_id),
    'local_id',btrim(p_local_id),
    'cuentas',v_cuentas
  );
end;
$function$;

-- 7. public.pm11_preparar_cuenta_empleado -- mismo texto exacto, con una comprobación nueva justo
--    después de la validación de datos de entrada (condición propia: p_actor_user_id).
CREATE OR REPLACE FUNCTION public.pm11_preparar_cuenta_empleado(p_actor_user_id uuid, p_empleado_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
declare
  v_empleado record;
  v_cuenta record;
  v_email text;
begin
  if p_actor_user_id is null or nullif(btrim(p_empleado_id),'') is null then
    return jsonb_build_object('ok',false,'codigo','datos_invalidos');
  end if;
  if private.plataforma_debe_cambiar_password(p_actor_user_id) then
    return jsonb_build_object('ok',false,'codigo','password_pendiente');
  end if;
  if not exists (select 1 from public.perfiles p where p.user_id=p_actor_user_id and p.activo=true) then
    return jsonb_build_object('ok',false,'codigo','perfil_no_activo');
  end if;
  select e.id,e.empresa_id,e.local_id,e.estado,e.nombre into v_empleado
    from public.empleados e where e.id=btrim(p_empleado_id);
  if not found then return jsonb_build_object('ok',false,'codigo','empleado_no_disponible'); end if;
  if not exists (
    select 1 from public.membresias_usuario m
     where m.user_id=p_actor_user_id and m.activo=true
       and m.empresa_id=v_empleado.empresa_id and m.rol='Propietario'
       and (m.todos_locales=true or (m.todos_locales=false and m.local_id=v_empleado.local_id))
  ) then return jsonb_build_object('ok',false,'codigo','empleado_no_disponible'); end if;
  if not private.pm11_local_activo(v_empleado.empresa_id,v_empleado.local_id) then
    return jsonb_build_object('ok',false,'codigo','local_inactivo');
  end if;
  if v_empleado.estado <> 'activo' then return jsonb_build_object('ok',false,'codigo','empleado_no_activo'); end if;
  select p.user_id,p.rol,p.activo into v_cuenta
    from public.perfiles p where p.empleado_id=v_empleado.id limit 1;
  if not found or v_cuenta.user_id is null then
    return jsonb_build_object('ok',true,'estado','disponible','empleado',jsonb_build_object(
      'id',v_empleado.id,'empresa_id',v_empleado.empresa_id,'local_id',v_empleado.local_id,
      'estado',v_empleado.estado,'nombre',v_empleado.nombre));
  end if;
  select u.email into v_email from auth.users u where u.id=v_cuenta.user_id;
  return jsonb_build_object('ok',true,'estado','vinculado','empleado',jsonb_build_object(
    'id',v_empleado.id,'empresa_id',v_empleado.empresa_id,'local_id',v_empleado.local_id,
    'estado',v_empleado.estado,'nombre',v_empleado.nombre),'cuenta',jsonb_build_object(
    'userId',v_cuenta.user_id,'rol',v_cuenta.rol,'activo',v_cuenta.activo,'email',coalesce(v_email,'')));
end;
$function$;

-- 8. public.pm11_finalizar_creacion_cuenta_empleado -- mismo texto exacto, con una comprobación
--    nueva justo después de la de actor/usuario resuelto (condición propia: p_actor_user_id).
CREATE OR REPLACE FUNCTION public.pm11_finalizar_creacion_cuenta_empleado(p_actor_user_id uuid, p_user_id uuid, p_empresa_id text, p_local_id text, p_empleado_id text, p_nombre text, p_rol text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
declare
  v_empleado public.empleados%rowtype;
  v_perfil public.perfiles%rowtype;
  v_audit_id text;
begin
  if p_actor_user_id is null or p_user_id is null then
    raise exception 'cuenta_actor_o_usuario_no_resuelto';
  end if;
  if private.plataforma_debe_cambiar_password(p_actor_user_id) then
    raise exception 'cuenta_creacion_no_autorizada';
  end if;
  if p_actor_user_id = p_user_id then
    raise exception 'cuenta_objetivo_actor_no_permitida';
  end if;
  if nullif(btrim(p_empresa_id), '') is null
     or nullif(btrim(p_local_id), '') is null
     or upper(btrim(p_local_id)) in ('TODOS', 'TODOS LOS LOCALES') then
    raise exception 'cuenta_contexto_local_invalido';
  end if;
  if nullif(btrim(p_empleado_id), '') is null or nullif(btrim(p_nombre), '') is null then
    raise exception 'cuenta_datos_empleado_incompletos';
  end if;
  if p_rol not in ('Encargado', 'Básico', 'Camarero/a', 'Cajero/a', 'Churrero/a') then
    raise exception 'cuenta_rol_no_permitido';
  end if;

  if not exists (
    select 1
      from public.perfiles p
     where p.user_id = p_actor_user_id
       and p.activo = true
  ) or not exists (
    select 1
      from public.membresias_usuario m
     where m.user_id = p_actor_user_id
       and m.activo = true
       and m.empresa_id = p_empresa_id
       and m.rol = 'Propietario'
       and (m.todos_locales = true or (m.todos_locales = false and m.local_id = p_local_id))
  ) then
    raise exception 'cuenta_creacion_no_autorizada';
  end if;

  if not private.pm11_local_activo(p_empresa_id, p_local_id) then
    raise exception 'cuenta_local_inactivo';
  end if;

  select * into v_empleado
    from public.empleados e
   where e.id = p_empleado_id
   for update;

  if not found then
    raise exception 'empleado_no_encontrado';
  end if;
  if v_empleado.empresa_id <> p_empresa_id or v_empleado.local_id <> p_local_id then
    raise exception 'empleado_contexto_no_coincide';
  end if;
  if v_empleado.estado <> 'activo' then
    raise exception 'empleado_no_activo_para_crear_cuenta';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'auth_usuario_objetivo_no_existe';
  end if;

  select * into v_perfil
    from public.perfiles p
   where p.user_id = p_user_id
   for update;

  if found then
    if v_perfil.empleado_id = p_empleado_id
       and v_perfil.activo = true
       and v_perfil.rol = p_rol
       and exists (
         select 1 from public.membresias_usuario m
          where m.user_id = p_user_id
            and m.activo = true
            and m.empresa_id = p_empresa_id
            and m.local_id = p_local_id
            and m.todos_locales = false
            and m.rol = p_rol
       )
       and not exists (
         select 1 from public.membresias_usuario m
          where m.user_id = p_user_id
            and m.activo = true
            and (
              m.empresa_id <> p_empresa_id
              or m.local_id is distinct from p_local_id
              or m.todos_locales = true
              or m.rol <> p_rol
            )
       ) then
      return jsonb_build_object(
        'ok', true,
        'yaCreada', true,
        'userId', p_user_id,
        'empleadoId', p_empleado_id,
        'rol', p_rol
      );
    end if;
    raise exception 'cuenta_objetivo_ya_configurada';
  end if;

  if exists (select 1 from public.membresias_usuario m where m.user_id = p_user_id) then
    raise exception 'cuenta_objetivo_tiene_membresias_previas';
  end if;

  if exists (
    select 1 from public.perfiles p
     where p.empleado_id = p_empleado_id
       and p.user_id <> p_user_id
  ) then
    raise exception 'empleado_cuenta_ya_vinculada';
  end if;

  insert into public.membresias_usuario(
    user_id, empresa_id, local_id, todos_locales, rol, activo
  ) values (
    p_user_id, p_empresa_id, p_local_id, false, p_rol, true
  );

  insert into public.perfiles(
    user_id, rol, nombre, empleado_id, activo
  ) values (
    p_user_id, p_rol, btrim(p_nombre), p_empleado_id, true
  );

  v_audit_id := gen_random_uuid()::text;
  insert into public.auditoria_registro(
    id, fecha, datos, empresa_id, local_id, actor_user_id
  ) values (
    v_audit_id,
    current_date,
    jsonb_build_object(
      'id', v_audit_id,
      'accion', 'Personal · crear cuenta empleado',
      'empleadoId', p_empleado_id,
      'empresaId', p_empresa_id,
      'localId', p_local_id,
      'actorUserId', p_actor_user_id,
      'cuentaUserId', p_user_id,
      'rol', p_rol
    ),
    p_empresa_id,
    p_local_id,
    p_actor_user_id
  );

  return jsonb_build_object(
    'ok', true,
    'yaCreada', false,
    'userId', p_user_id,
    'empleadoId', p_empleado_id,
    'rol', p_rol
  );
end;
$function$;

-- 9. public.pm13_fichar -- mismo texto exacto, con la condición añadida en la comprobación de
--    sesión activa (autoservicio: cualquier empleado activo puede fichar sobre sí mismo, sin rol).
CREATE OR REPLACE FUNCTION public.pm13_fichar(p_empleado_id text, p_local_id text, p_tipo text, p_operation_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_emp public.empleados%rowtype;
  v_existente public.fichajes_registro%rowtype;
  v_id text;
  v_ahora timestamptz;
  v_fecha date;
  v_hora text;
  v_datos jsonb;
begin
  if (select auth.uid()) is null or not private.la_usuario_activo() or private.plataforma_debe_cambiar_password() then raise exception 'fichaje_sesion_no_autorizada'; end if;
  if nullif(btrim(coalesce(p_operation_id,'')),'') is null then raise exception 'fichaje_operation_id_requerido'; end if;
  if p_tipo not in('entrada','salida') then raise exception 'fichaje_tipo_invalido'; end if;
  if nullif(btrim(coalesce(p_local_id,'')),'') is null or upper(btrim(p_local_id)) in('TODOS','TODOS LOS LOCALES') then
    raise exception 'fichaje_local_concreto_requerido';
  end if;

  select * into v_emp from public.empleados e where e.id=p_empleado_id for share;
  if not found or v_emp.local_id<>p_local_id or v_emp.estado<>'activo' or not private.pm11_local_activo(v_emp.empresa_id,v_emp.local_id) then
    raise exception 'fichaje_empleado_no_activo_o_fuera_de_local';
  end if;
  if not private.pm13_fichaje_actor_es_empleado(v_emp.id) and not private.pm11_puede_mutar_personal(v_emp.empresa_id,v_emp.local_id) then
    raise exception 'fichaje_actor_no_autorizado';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:fichaje-op:'||p_operation_id,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:fichaje:'||v_emp.id,0));

  select * into v_existente
    from public.fichajes_registro f
   where f.datos->>'operationId'=p_operation_id
   order by f.creado_en desc limit 1;
  if found then
    if v_existente.datos->>'empleadoId'=v_emp.id
       and v_existente.datos->>'localId'=v_emp.local_id
       and v_existente.datos->>'tipo'=p_tipo
       and coalesce(lower(v_existente.datos->>'manual'),'false')='false' then
      return jsonb_build_object('ok',true,'replay',true,'fichaje',v_existente.datos);
    end if;
    raise exception 'fichaje_operation_id_conflicto';
  end if;

  v_ahora:=pg_catalog.clock_timestamp();
  v_fecha:=current_date;
  v_hora:=to_char(v_ahora,'HH24:MI');
  v_id:='fichaje-'||pg_catalog.gen_random_uuid()::text;
  v_datos:=jsonb_build_object('id',v_id,'empleadoId',v_emp.id,'localId',v_emp.local_id,'fecha',v_fecha::text,'hora',v_hora,'tipo',p_tipo,'timestamp',v_ahora,'operationId',p_operation_id,'manual',false,'anulado',false);

  if not private.pm13_fichaje_secuencia_valida(v_emp.id,v_emp.local_id,null,v_datos) then
    return jsonb_build_object('ok',false,'codigo',case when p_tipo='entrada' then 'FICHAJE_YA_ABIERTO' else 'FICHAJE_SIN_ENTRADA_ABIERTA' end);
  end if;

  insert into public.fichajes_registro(id,fecha,datos) values(v_id,v_fecha,v_datos);
  perform private.pm11_auditar_empleado('Personal · fichaje '||p_tipo,v_emp.id,v_emp.empresa_id,v_emp.local_id,jsonb_build_object('fichajeId',v_id,'operationIdInformado',true));
  return jsonb_build_object('ok',true,'replay',false,'fichaje',v_datos);
end;
$function$;

-- 10. public.pm13_fichaje_manual -- mismo texto exacto, con la condición añadida.
CREATE OR REPLACE FUNCTION public.pm13_fichaje_manual(p_empleado_id text, p_local_id text, p_fecha date, p_hora text, p_tipo text, p_operation_id text, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_emp public.empleados%rowtype;
  v_existente public.fichajes_registro%rowtype;
  v_id text;
  v_datos jsonb;
begin
  if (select auth.uid()) is null or not private.la_usuario_activo() or private.plataforma_debe_cambiar_password() then raise exception 'fichaje_sesion_no_autorizada'; end if;
  if nullif(btrim(coalesce(p_operation_id,'')),'') is null then raise exception 'fichaje_operation_id_requerido'; end if;
  if p_tipo not in('entrada','salida') or p_hora !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception 'fichaje_manual_datos_invalidos'; end if;
  if p_fecha is null or p_fecha>current_date then raise exception 'fichaje_manual_fecha_invalida'; end if;

  select * into v_emp from public.empleados e where e.id=p_empleado_id for share;
  if not found or v_emp.local_id<>p_local_id or v_emp.estado<>'activo' or not private.pm11_local_activo(v_emp.empresa_id,v_emp.local_id) then
    raise exception 'fichaje_empleado_no_activo_o_fuera_de_local';
  end if;
  if not private.pm11_puede_mutar_personal(v_emp.empresa_id,v_emp.local_id) then raise exception 'fichaje_manual_no_autorizado'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:fichaje-op:'||p_operation_id,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:fichaje:'||v_emp.id,0));

  select * into v_existente from public.fichajes_registro f where f.datos->>'operationId'=p_operation_id order by f.creado_en desc limit 1;
  if found then
    if v_existente.datos->>'empleadoId'=v_emp.id
       and v_existente.datos->>'localId'=v_emp.local_id
       and v_existente.datos->>'tipo'=p_tipo
       and v_existente.fecha=p_fecha
       and v_existente.datos->>'hora'=p_hora
       and coalesce(lower(v_existente.datos->>'manual'),'false')='true' then
      return jsonb_build_object('ok',true,'replay',true,'fichaje',v_existente.datos);
    end if;
    raise exception 'fichaje_operation_id_conflicto';
  end if;

  v_id:='fichaje-'||pg_catalog.gen_random_uuid()::text;
  v_datos:=jsonb_build_object('id',v_id,'empleadoId',v_emp.id,'localId',v_emp.local_id,'fecha',p_fecha::text,'hora',p_hora,'tipo',p_tipo,'timestamp',p_fecha::text||'T'||p_hora||':00','operationId',p_operation_id,'manual',true,'motivoManual',nullif(btrim(coalesce(p_motivo,'')),''),'anulado',false);
  if not private.pm13_fichaje_secuencia_valida(v_emp.id,v_emp.local_id,null,v_datos) then return jsonb_build_object('ok',false,'codigo','FICHAJE_SECUENCIA_INVALIDA'); end if;

  insert into public.fichajes_registro(id,fecha,datos) values(v_id,p_fecha,v_datos);
  perform private.pm11_auditar_empleado('Personal · fichaje manual',v_emp.id,v_emp.empresa_id,v_emp.local_id,jsonb_build_object('fichajeId',v_id,'tipo',p_tipo,'fecha',p_fecha,'hora',p_hora));
  return jsonb_build_object('ok',true,'replay',false,'fichaje',v_datos);
end;
$function$;

-- 11. public.pm13_corregir_fichaje -- mismo texto exacto, con la condición añadida.
CREATE OR REPLACE FUNCTION public.pm13_corregir_fichaje(p_fichaje_id text, p_fecha date, p_hora text, p_tipo text, p_operation_id text, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_reg public.fichajes_registro%rowtype;
  v_emp public.empleados%rowtype;
  v_datos jsonb;
  v_original jsonb;
  v_historial jsonb;
  v_op_fichaje_id text;
  v_op_entry jsonb;
begin
  if (select auth.uid()) is null or not private.la_usuario_activo() or private.plataforma_debe_cambiar_password() then raise exception 'fichaje_sesion_no_autorizada'; end if;
  if nullif(btrim(coalesce(p_operation_id,'')),'') is null or nullif(btrim(coalesce(p_motivo,'')),'') is null then raise exception 'fichaje_correccion_operacion_y_motivo_requeridos'; end if;
  if p_tipo not in('entrada','salida') or p_hora !~ '^([01]\d|2[0-3]):[0-5]\d$' or p_fecha is null or p_fecha>current_date then raise exception 'fichaje_correccion_datos_invalidos'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:correccion-op:'||p_operation_id,0));

  select f.id,h.elem into v_op_fichaje_id,v_op_entry
    from public.fichajes_registro f
    cross join lateral jsonb_array_elements(case when jsonb_typeof(f.datos->'historialCorrecciones')='array' then f.datos->'historialCorrecciones' else '[]'::jsonb end) h(elem)
   where h.elem->>'operationId'=p_operation_id
   limit 1;
  if found then
    if v_op_fichaje_id=p_fichaje_id
       and v_op_entry->'despues'=jsonb_build_object('fecha',p_fecha::text,'hora',p_hora,'tipo',p_tipo)
       and v_op_entry->>'motivo'=btrim(p_motivo) then
      select * into v_reg from public.fichajes_registro f where f.id=p_fichaje_id;
      return jsonb_build_object('ok',true,'replay',true,'fichaje',v_reg.datos);
    end if;
    raise exception 'fichaje_correccion_operation_id_conflicto';
  end if;

  select * into v_reg from public.fichajes_registro f where f.id=p_fichaje_id for update;
  if not found then raise exception 'fichaje_no_encontrado'; end if;
  if coalesce(lower(v_reg.datos->>'anulado'),'false')='true' then raise exception 'fichaje_anulado_no_editable'; end if;

  select * into v_emp from public.empleados e where e.id=v_reg.datos->>'empleadoId' for share;
  if not found or v_emp.local_id<>v_reg.datos->>'localId' or not private.pm11_local_activo(v_emp.empresa_id,v_emp.local_id) then raise exception 'fichaje_contexto_invalido'; end if;
  if not private.pm11_puede_mutar_personal(v_emp.empresa_id,v_emp.local_id) then raise exception 'fichaje_correccion_no_autorizada'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:fichaje:'||v_emp.id,0));

  v_datos:=v_reg.datos||jsonb_build_object('fecha',p_fecha::text,'hora',p_hora,'tipo',p_tipo,'timestamp',p_fecha::text||'T'||p_hora||':00','corregido',true,'corregidoAt',pg_catalog.clock_timestamp(),'motivoCorreccion',btrim(p_motivo),'ultimaCorreccionOperationId',p_operation_id);
  if not private.pm13_fichaje_secuencia_valida(v_emp.id,v_emp.local_id,v_reg.id,v_datos) then return jsonb_build_object('ok',false,'codigo','FICHAJE_SECUENCIA_INVALIDA'); end if;

  v_original:=coalesce(v_reg.datos->'original',jsonb_build_object('fecha',v_reg.datos->>'fecha','hora',v_reg.datos->>'hora','tipo',v_reg.datos->>'tipo','timestamp',v_reg.datos->>'timestamp'));
  v_historial:=coalesce(case when jsonb_typeof(v_reg.datos->'historialCorrecciones')='array' then v_reg.datos->'historialCorrecciones' else '[]'::jsonb end,'[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
      'operationId',p_operation_id,
      'antes',jsonb_build_object('fecha',v_reg.datos->>'fecha','hora',v_reg.datos->>'hora','tipo',v_reg.datos->>'tipo'),
      'despues',jsonb_build_object('fecha',p_fecha::text,'hora',p_hora,'tipo',p_tipo),
      'motivo',btrim(p_motivo),
      'corregidoAt',pg_catalog.clock_timestamp()
    ));
  v_datos:=v_datos||jsonb_build_object('original',v_original,'historialCorrecciones',v_historial);

  update public.fichajes_registro set fecha=p_fecha,datos=v_datos where id=v_reg.id;
  perform private.pm11_auditar_empleado('Personal · corregir fichaje',v_emp.id,v_emp.empresa_id,v_emp.local_id,jsonb_build_object('fichajeId',v_reg.id,'operationId',p_operation_id,'motivoInformado',true));
  return jsonb_build_object('ok',true,'replay',false,'fichaje',v_datos);
end;
$function$;

-- 12. public.pm13_anular_fichaje -- mismo texto exacto, con la condición añadida.
CREATE OR REPLACE FUNCTION public.pm13_anular_fichaje(p_fichaje_id text, p_operation_id text, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_reg public.fichajes_registro%rowtype;
  v_emp public.empleados%rowtype;
  v_datos jsonb;
  v_op_reg public.fichajes_registro%rowtype;
begin
  if (select auth.uid()) is null or not private.la_usuario_activo() or private.plataforma_debe_cambiar_password() then raise exception 'fichaje_sesion_no_autorizada'; end if;
  if nullif(btrim(coalesce(p_operation_id,'')),'') is null or nullif(btrim(coalesce(p_motivo,'')),'') is null then raise exception 'fichaje_anulacion_operacion_y_motivo_requeridos'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:anulacion-op:'||p_operation_id,0));
  select * into v_op_reg from public.fichajes_registro f where f.datos->>'anulacionOperationId'=p_operation_id order by f.creado_en desc limit 1;
  if found then
    if v_op_reg.id=p_fichaje_id and v_op_reg.datos->>'motivoAnulacion'=btrim(p_motivo) then
      return jsonb_build_object('ok',true,'replay',true,'fichaje',v_op_reg.datos);
    end if;
    raise exception 'fichaje_anulacion_operation_id_conflicto';
  end if;

  select * into v_reg from public.fichajes_registro f where f.id=p_fichaje_id for update;
  if not found then raise exception 'fichaje_no_encontrado'; end if;

  select * into v_emp from public.empleados e where e.id=v_reg.datos->>'empleadoId' for share;
  if not found or v_emp.local_id<>v_reg.datos->>'localId' or not private.pm11_local_activo(v_emp.empresa_id,v_emp.local_id) then raise exception 'fichaje_contexto_invalido'; end if;
  if not private.pm11_puede_mutar_personal(v_emp.empresa_id,v_emp.local_id) then raise exception 'fichaje_anulacion_no_autorizada'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:fichaje:'||v_emp.id,0));

  if coalesce(lower(v_reg.datos->>'anulado'),'false')='true' then raise exception 'fichaje_ya_anulado'; end if;
  if not private.pm13_fichaje_secuencia_valida(v_emp.id,v_emp.local_id,v_reg.id,null) then return jsonb_build_object('ok',false,'codigo','FICHAJE_ANULACION_ROMPE_SECUENCIA'); end if;

  v_datos:=v_reg.datos||jsonb_build_object('anulado',true,'anuladoAt',pg_catalog.clock_timestamp(),'motivoAnulacion',btrim(p_motivo),'anulacionOperationId',p_operation_id);
  update public.fichajes_registro set datos=v_datos where id=v_reg.id;
  perform private.pm11_auditar_empleado('Personal · anular fichaje',v_emp.id,v_emp.empresa_id,v_emp.local_id,jsonb_build_object('fichajeId',v_reg.id,'operationId',p_operation_id,'motivoInformado',true));
  return jsonb_build_object('ok',true,'replay',false,'fichaje',v_datos);
end;
$function$;

-- 13. private.pm12_cancelar_conteo_stock -- mismo texto exacto, con la condición añadida. El
--     envoltorio public.pm12_cancelar_conteo_stock solo llama a esta función y hereda el bloqueo
--     sin tocarlo (mismo patrón de herencia que las variantes _pm09 del subpunto 4).
CREATE OR REPLACE FUNCTION private.pm12_cancelar_conteo_stock(p_empresa_id text, p_local_id text, p_conteo jsonb, p_cancelacion jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  original public.stock_operaciones%rowtype; previous public.stock_operaciones%rowtype;
  s public.stock_ubicacion%rowtype; rec record; m public.movimientos_stock%rowtype;
  original_id text; cancel_id text; corte text; reverse_id text; result jsonb; document jsonb;
  reversos jsonb := '[]'::jsonb; datos jsonb;
begin
  if auth.uid() is null or not coalesce(private.la_usuario_activo(),false) or private.plataforma_debe_cambiar_password() then raise exception 'cancelacion_no_autorizada'; end if;
  if p_local_id is null or lower(p_local_id)='todos' or not coalesce(private.la_tiene_empresa(p_empresa_id),false) or not coalesce(private.la_tiene_local(p_empresa_id,p_local_id),false)
     or p_conteo->>'empresaId' is distinct from p_empresa_id or p_conteo->>'localId' is distinct from p_local_id then raise exception 'contexto_no_autorizado'; end if;
  if nullif(p_conteo->>'id','') is null or nullif(btrim(p_cancelacion->>'motivo'),'') is null or nullif(btrim(p_cancelacion->>'responsable'),'') is null then raise exception 'cancelacion_incompleta'; end if;
  corte := coalesce(nullif(p_conteo->>'cerradoEn',''),nullif(p_conteo->>'iniciadoEn',''),nullif(p_conteo->>'fecha',''),'sin-corte');
  cancel_id := 'pm12-cancelar-conteo:'||(p_conteo->>'id')||':'||corte;
  if p_cancelacion->>'operationId' is distinct from cancel_id then raise exception 'operation_id_conflict'; end if;
  perform private.pm08_bloquear_operation_id('pm12-conteo:'||p_empresa_id||':'||p_local_id||':'||(p_conteo->>'id'));
  perform private.pm09_bloquear_operation_id_stock(cancel_id);
  select * into previous from public.stock_operaciones where operation_id=cancel_id;
  if found then
    if previous.tipo<>'REVERSO' or previous.empresa_id<>p_empresa_id or previous.local_id<>p_local_id or previous.payload->>'conteoId' is distinct from p_conteo->>'id' then raise exception 'operation_id_conflict'; end if;
    if coalesce((previous.payload->'resultado'->>'revertidos')::integer,0)>0 and not coalesce(private.pm07_puede_gestionar_stock(),false) then raise exception 'ajuste_no_autorizado'; end if;
    return previous.payload->'resultado'||jsonb_build_object('replayed',true);
  end if;
  select * into original from public.stock_operaciones where tipo='INVENTARIO_PM12' and empresa_id=p_empresa_id and local_id=p_local_id and payload->'intencion'->>'id'=p_conteo->>'id' for update;
  if not found then
    if coalesce((p_conteo->>'ajustesAplicados')::boolean,false) or coalesce((p_conteo->>'ajustesPendientesRevision')::boolean,false) then raise exception 'conteo_legacy_requiere_revision'; end if;
    original_id := 'pm12-ajuste-conteo:'||(p_conteo->>'id')||':'||corte;
    perform private.pm09_bloquear_operation_id_stock(original_id);
    insert into public.stock_operaciones(operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id)
      values(original_id,'INVENTARIO_PM12',p_empresa_id,p_local_id,'__CONTEO__',jsonb_build_object('intencion',p_conteo,'plan','[]'::jsonb),auth.uid()) returning * into original;
  end if;
  if original.payload->'resultado'->'conteo'->>'estado'='CANCELADO' then raise exception 'conteo_cancelado'; end if;
  if exists(select 1 from public.movimientos_stock where operation_id=original.operation_id) and not coalesce(private.pm07_puede_gestionar_stock(),false) then raise exception 'ajuste_no_autorizado'; end if;
  for rec in select producto_id,sum(delta_almacen) da,sum(delta_piso) dp from public.movimientos_stock where operation_id=original.operation_id group by producto_id order by producto_id loop
    select * into s from public.stock_ubicacion where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=rec.producto_id for update;
    if not found or not s.local_operable then raise exception 'stock_no_operable'; end if;
    if s.almacen-rec.da<0 or s.piso-rec.dp<0 then raise exception 'reverso_sin_cobertura'; end if;
  end loop;
  insert into public.stock_operaciones(operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id,ref_operation_id)
    values(cancel_id,'REVERSO',p_empresa_id,p_local_id,'__CONTEO__',jsonb_build_object('conteoId',p_conteo->>'id'),auth.uid(),original.operation_id);
  for rec in select producto_id,sum(delta_almacen) da,sum(delta_piso) dp from public.movimientos_stock where operation_id=original.operation_id group by producto_id order by producto_id loop
    update public.stock_ubicacion set almacen=almacen-rec.da,piso=piso-rec.dp,updated_at=now() where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=rec.producto_id;
  end loop;
  for m in select * from public.movimientos_stock where operation_id=original.operation_id order by id loop
    reverse_id := 'pm12-cancelar-conteo:'||(p_conteo->>'id')||':'||(m.datos->>'movimientoId');
    datos := m.datos||jsonb_build_object('movimientoId',reverse_id,'operationId',cancel_id,'origen','cancelarConteo','revierteMovimientoId',m.datos->>'movimientoId','cantidad',-(m.datos->>'cantidad')::numeric,'motivo',p_cancelacion->>'motivo');
    insert into public.movimientos_stock(operation_id,tipo,empresa_id,local_id,producto_id,delta_almacen,delta_piso,delta_total,cantidad,movimiento_original_id,datos,actor_user_id)
      values(cancel_id,'REVERSO',p_empresa_id,p_local_id,m.producto_id,-m.delta_almacen,-m.delta_piso,-m.delta_total,m.cantidad,m.id,datos,auth.uid());
    reversos := reversos||jsonb_build_array(jsonb_build_object('movimientoOriginalId',m.datos->>'movimientoId','movimientoReversoId',reverse_id,'productoId',m.producto_id,'cantidad',-(m.datos->>'cantidad')::numeric,'tipo',m.datos->>'tipo'));
  end loop;
  document := coalesce(original.payload->'resultado'->'conteo',p_conteo)||jsonb_build_object('estado','CANCELADO','cancelado',true,'canceladoEn',now(),'motivoCancelacion',p_cancelacion->>'motivo','responsableCancelacion',p_cancelacion->>'responsable','estadoAnteriorCancelacion',p_conteo->>'estado','cancelacionOperationId',cancel_id,'reversosCancelacion',reversos,'cancelacion',p_cancelacion||jsonb_build_object('reversos',reversos,'actorId',auth.uid(),'rol',private.la_rol()));
  result := jsonb_build_object('ok',true,'replayed',false,'cancelado',true,'eliminado',false,'operationId',cancel_id,'revertidos',jsonb_array_length(reversos),'reversos',reversos,'conteo',document);
  update public.stock_operaciones set payload=payload||jsonb_build_object('resultado',result) where operation_id=cancel_id;
  update public.stock_operaciones set payload=jsonb_set(payload,'{resultado}',coalesce(payload->'resultado','{}'::jsonb)||jsonb_build_object('conteo',document)) where operation_id=original.operation_id;
  return result;
end $function$;

-- 14. public.pm12_cerrar_conteo -- mismo texto exacto, con la condición añadida.
CREATE OR REPLACE FUNCTION public.pm12_cerrar_conteo(p_empresa_id text, p_local_id text, p_conteo jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
declare v_id text; v_responsable_id text; v_responsable_nombre text; v_cerrado_en timestamptz; v_empleado public.empleados%rowtype; v_existente public.pm12_conteo_cierres%rowtype; v_conteo jsonb; v_cierre jsonb; v_responsables jsonb; v_audit_id text;
begin
 if auth.uid() is null or not coalesce(private.la_usuario_activo(),false) or coalesce(private.la_rol(),'') <> 'Propietario' or private.plataforma_debe_cambiar_password() then raise exception 'cierre_no_autorizado'; end if;
 if p_empresa_id is null or p_local_id is null or lower(p_local_id)='todos' or not coalesce(private.la_tiene_empresa(p_empresa_id),false) or not coalesce(private.la_tiene_local(p_empresa_id,p_local_id),false) then raise exception 'contexto_no_autorizado'; end if;
 if jsonb_typeof(p_conteo) is distinct from 'object' then raise exception 'conteo_invalido'; end if;
 v_id:=nullif(btrim(p_conteo->>'id'),'');
 if v_id is null or p_conteo->>'empresaId' is distinct from p_empresa_id or p_conteo->>'localId' is distinct from p_local_id or coalesce((p_conteo->>'completado')::boolean,false) is not true or coalesce(p_conteo->>'estado','') not in ('COMPLETADO','PARCIAL') then raise exception 'conteo_invalido'; end if;
 v_responsable_id:=coalesce(nullif(btrim(p_conteo->'cierre'->>'responsableId'),''),nullif(btrim(p_conteo->'responsables'->>'contadoPorId'),''));
 if v_responsable_id is null then raise exception 'responsable_obligatorio'; end if;
 select * into v_empleado from public.empleados where id=v_responsable_id and empresa_id=p_empresa_id and local_id=p_local_id and estado='activo' for share;
 if not found then raise exception 'responsable_no_valido'; end if;
 v_responsable_nombre:=coalesce(nullif(btrim(p_conteo->'cierre'->>'responsableNombre'),''),v_empleado.nombre);
 if v_responsable_nombre is distinct from v_empleado.nombre then raise exception 'responsable_no_valido'; end if;
 v_cerrado_en:=coalesce(nullif(p_conteo->>'cerradoEn','')::timestamptz,now());
 select * into v_existente from public.pm12_conteo_cierres where empresa_id=p_empresa_id and local_id=p_local_id and conteo_id=v_id for update;
 if found then return jsonb_build_object('ok',true,'replayed',true,'conteo',v_existente.conteo,'responsableId',v_existente.responsable_id,'responsableNombre',v_existente.responsable_nombre,'cerradoEn',v_existente.cerrado_en); end if;
 v_responsables:=coalesce(p_conteo->'responsables','{}'::jsonb)||jsonb_build_object('contadoPorId',v_empleado.id,'contadoPor',v_empleado.nombre);
 v_cierre:=coalesce(p_conteo->'cierre','{}'::jsonb)||jsonb_build_object('actorId',v_empleado.id,'actorNombre',v_empleado.nombre,'responsableId',v_empleado.id,'responsableNombre',v_empleado.nombre,'cerradoEn',v_cerrado_en);
 v_conteo:=p_conteo||jsonb_build_object('empresaId',p_empresa_id,'localId',p_local_id,'completado',true,'cerradoEn',v_cerrado_en,'responsables',v_responsables,'cierre',v_cierre);
 insert into public.pm12_conteo_cierres(empresa_id,local_id,conteo_id,conteo,responsable_id,responsable_nombre,actor_user_id,cerrado_en) values(p_empresa_id,p_local_id,v_id,v_conteo,v_empleado.id,v_empleado.nombre,auth.uid(),v_cerrado_en);
 v_audit_id:='pm12-cierre-conteo:'||p_empresa_id||':'||p_local_id||':'||v_id;
 insert into public.auditoria_registro(id,fecha,datos,empresa_id,local_id,actor_user_id) values(v_audit_id,current_date,jsonb_build_object('accion','Finalizar conteo','conteoId',v_id,'responsableId',v_empleado.id,'responsableNombre',v_empleado.nombre,'cerradoEn',v_cerrado_en,'estado',v_conteo->>'estado'),p_empresa_id,p_local_id,auth.uid()) on conflict(id) do nothing;
 return jsonb_build_object('ok',true,'replayed',false,'conteo',v_conteo,'responsableId',v_empleado.id,'responsableNombre',v_empleado.nombre,'cerradoEn',v_cerrado_en);
end;$function$;

-- 15. public.pm12_listar_cierres -- mismo texto exacto, con la condición añadida.
CREATE OR REPLACE FUNCTION public.pm12_listar_cierres(p_empresa_id text, p_local_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
begin
 if auth.uid() is null or not coalesce(private.la_usuario_activo(),false) or not coalesce(private.la_tiene_empresa(p_empresa_id),false) or not coalesce(private.la_tiene_local(p_empresa_id,p_local_id),false) or private.plataforma_debe_cambiar_password() then raise exception 'contexto_no_autorizado'; end if;
 return coalesce((select jsonb_agg(conteo order by cerrado_en desc) from public.pm12_conteo_cierres where empresa_id=p_empresa_id and local_id=p_local_id),'[]'::jsonb);
end;$function$;

do $$
begin
  if (select md5(replace(p.prosrc,chr(13),'')) from pg_proc p where p.oid = 'public.abc_aplicar_descuento_cuenta(text,text,text,uuid,text,numeric,text,bigint,uuid,uuid,date)'::regprocedure)
     = 'ed151626fc4777ea91d41886a6b3261c' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_POSTFLIGHT_FALLO:abc_aplicar_descuento_cuenta_sin_cambios';
  end if;
  if (select md5(replace(p.prosrc,chr(13),'')) from pg_proc p where p.oid = 'private.pm11_puede_mutar_personal(text,text)'::regprocedure)
     = 'e4ea974c9240774fd9835f20325f5690' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_POSTFLIGHT_FALLO:pm11_puede_mutar_personal_sin_cambios';
  end if;
  if (select md5(replace(p.prosrc,chr(13),'')) from pg_proc p where p.oid = 'public.pm13_fichar(text,text,text,text)'::regprocedure)
     = '055e04b2c834a7338821ceb1dd656670' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_POSTFLIGHT_FALLO:pm13_fichar_sin_cambios';
  end if;
  if (select md5(replace(p.prosrc,chr(13),'')) from pg_proc p where p.oid = 'private.pm12_cancelar_conteo_stock(text,text,jsonb,jsonb)'::regprocedure)
     = '60dd4f8477990a362cf35bb385558b6b' then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_POSTFLIGHT_FALLO:pm12_cancelar_conteo_stock_sin_cambios';
  end if;
  if not exists (
    select 1 from pg_proc p where p.oid = 'public.pm11_estado_cuentas_empleados(text,text,text[])'::regprocedure
      and p.prosrc like '%plataforma_debe_cambiar_password%'
  ) then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_POSTFLIGHT_FALLO:pm11_estado_cuentas_empleados_sin_cambio';
  end if;
  if not exists (
    select 1 from pg_proc p where p.oid = 'public.pm11_finalizar_creacion_cuenta_empleado(uuid,uuid,text,text,text,text,text)'::regprocedure
      and p.prosrc like '%plataforma_debe_cambiar_password%'
  ) then
    raise exception 'PLATAFORMA_PASSWORD_MEDIA_POSTFLIGHT_FALLO:pm11_finalizar_creacion_cuenta_empleado_sin_cambio';
  end if;
end $$;
