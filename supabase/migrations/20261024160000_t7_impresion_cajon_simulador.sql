-- Plan Maestro L&A Suite — Etapa 5, T7: impresoras y cajón (modo simulador).
-- Hoja QA-9 (Pedro, 24/10/2026).
--
-- T7 queda bloqueada para pruebas físicas reales hasta disponer de una
-- impresora de prueba (ETAPA5_PREVUELO_QA3_2026-10-23.md). Pedro confirmó
-- (24/10/2026) que no tiene impresora todavía y que el cajón monedero se
-- abre a través de la impresora de tickets (lo habitual). Esta migración
-- construye la parte de software que SÍ se puede probar sin hardware: dos
-- funciones que dejan constancia de lo que se habría enviado a un equipo
-- ya registrado (tabla abc_local_equipos, existente desde antes — solo un
-- catálogo, "no los conecta ni los configura"), sin conectar nunca con
-- ningún aparato real. No se crea ninguna tabla nueva: se reutiliza
-- abc_eventos, igual que el resto del histórico del proyecto.
--
--   1. abc_simular_impresion_ticket: exige el mismo permiso que iniciar un
--      cobro (ABC_COBRO_INICIAR); la cuenta debe estar PAGADO y el equipo
--      debe ser una impresora de tickets activa.
--   2. abc_simular_apertura_cajon: exige el mismo permiso que operar la
--      caja (ABC_CAJA_OPERAR); exige una sesión de caja abierta y un
--      equipo cajón activo. Si se abre sin una venta asociada, exige un
--      motivo — igual que ya exigen las entradas/salidas de caja.

do $$
begin
  if to_regclass('public.abc_local_equipos') is null or to_regclass('public.checkouts') is null
     or to_regclass('public.caja_sesiones') is null or to_regclass('public.abc_eventos') is null then
    raise exception 'T7_SIMULADOR_PREFLIGHT_FALLO: falta alguna tabla base';
  end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null
     or to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null
     or to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null
     or to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null
     or to_regprocedure('public.abc_obtener_dia_operativo_local(text,text)') is null then
    raise exception 'T7_SIMULADOR_PREFLIGHT_FALLO: helpers ausentes';
  end if;
end $$;

create or replace function public.abc_simular_impresion_ticket(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_equipo_id uuid,
  p_checkout_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_cmd jsonb; v_request jsonb; v_result jsonb;
  v_equipo public.abc_local_equipos%rowtype;
  v_checkout public.checkouts%rowtype;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR') then
    raise exception 'abc_impresion_no_autorizada';
  end if;
  if p_equipo_id is null or p_checkout_id is null then raise exception 'impresion_parametros_requeridos'; end if;

  v_request := jsonb_build_object('equipo_id',p_equipo_id,'checkout_id',p_checkout_id);
  v_cmd := private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_SIMULAR_IMPRESION_TICKET',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_equipo from public.abc_local_equipos e
   where e.empresa_id=p_empresa_id and e.local_id=p_local_id and e.id=p_equipo_id;
  if not found then raise exception 'impresion_equipo_no_encontrado'; end if;
  if not v_equipo.activo then raise exception 'impresion_equipo_inactivo'; end if;
  if v_equipo.tipo <> 'IMPRESORA_TICKET' then raise exception 'impresion_equipo_tipo_incorrecto'; end if;

  select * into v_checkout from public.checkouts c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=p_checkout_id;
  if not found then raise exception 'impresion_checkout_no_encontrado'; end if;
  if v_checkout.estado <> 'PAGADO' then raise exception 'impresion_cuenta_no_pagada'; end if;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'EQUIPO',p_equipo_id::text,'TRABAJO_IMPRESION_SIMULADO',
    jsonb_build_object('equipo_nombre',v_equipo.nombre,'checkout_id',p_checkout_id,'modo','SIMULADO'),
    auth.uid(),v_equipo.terminal_id,now(),v_checkout.operating_day
  );

  v_result := jsonb_build_object(
    'ok',true,'equipo_id',v_equipo.id,'equipo_nombre',v_equipo.nombre,
    'mensaje','Se habría impreso el ticket en '||v_equipo.nombre||' (modo simulador: no hay conexión real con el aparato).'
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

comment on function public.abc_simular_impresion_ticket is
  'T7 Hoja QA-9: deja constancia de un trabajo de impresión que se habría enviado a un equipo registrado. Modo simulador: nunca conecta con ningún aparato real.';

revoke all on function public.abc_simular_impresion_ticket(text,text,text,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.abc_simular_impresion_ticket(text,text,text,uuid,uuid)
  to authenticated;

create or replace function public.abc_simular_apertura_cajon(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_equipo_id uuid,
  p_motivo text,
  p_terminal_id uuid,
  p_checkout_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_cmd jsonb; v_request jsonb; v_result jsonb;
  v_equipo public.abc_local_equipos%rowtype;
  v_motivo text := btrim(coalesce(p_motivo,''));
  v_operating_day date;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then
    raise exception 'abc_cajon_no_autorizado';
  end if;
  if p_equipo_id is null then raise exception 'cajon_parametros_requeridos'; end if;
  if p_checkout_id is null and v_motivo = '' then raise exception 'cajon_motivo_requerido'; end if;

  v_request := jsonb_build_object('equipo_id',p_equipo_id,'motivo',v_motivo,'checkout_id',p_checkout_id);
  v_cmd := private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_SIMULAR_APERTURA_CAJON',v_request,p_terminal_id);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_equipo from public.abc_local_equipos e
   where e.empresa_id=p_empresa_id and e.local_id=p_local_id and e.id=p_equipo_id;
  if not found then raise exception 'cajon_equipo_no_encontrado'; end if;
  if not v_equipo.activo then raise exception 'cajon_equipo_inactivo'; end if;
  if v_equipo.tipo <> 'CAJON_MONEDERO' then raise exception 'cajon_equipo_tipo_incorrecto'; end if;

  if not exists (
    select 1 from public.caja_sesiones s
     where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.estado='ABIERTA'
  ) then
    raise exception 'sesion_caja_no_abierta';
  end if;

  select (public.abc_obtener_dia_operativo_local(p_empresa_id,p_local_id)->>'operating_day')::date into v_operating_day;
  if v_operating_day is null then raise exception 'operating_day_servidor_ausente'; end if;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'EQUIPO',p_equipo_id::text,'CAJON_ABIERTO_SIMULADO',
    jsonb_build_object('equipo_nombre',v_equipo.nombre,'motivo',nullif(v_motivo,''),'checkout_id',p_checkout_id,'modo','SIMULADO'),
    auth.uid(),p_terminal_id,now(),v_operating_day
  );

  v_result := jsonb_build_object(
    'ok',true,'equipo_id',v_equipo.id,'equipo_nombre',v_equipo.nombre,
    'mensaje','Se habría abierto el cajón '||v_equipo.nombre||' (modo simulador: no hay conexión real con el aparato).'
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

comment on function public.abc_simular_apertura_cajon is
  'T7 Hoja QA-9: deja constancia de una apertura de cajón que se habría enviado a un equipo registrado (exige motivo si no hay venta asociada). Modo simulador: nunca conecta con ningún aparato real.';

revoke all on function public.abc_simular_apertura_cajon(text,text,text,uuid,text,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.abc_simular_apertura_cajon(text,text,text,uuid,text,uuid,uuid)
  to authenticated;
