-- Plan Maestro L&A Suite — Etapa 5, T6, punto 5: vale regalo.
-- Corrección encontrada en prueba en vivo (Cowork, 24/10/2026).
--
-- abc_emitir_vale_regalo llamaba a gen_random_bytes(4) sin especificar
-- esquema. La función es security definer con search_path='' (medida de
-- seguridad estándar de este proyecto), y pgcrypto está instalado en el
-- esquema "extensions" en este entorno, no en "public" ni en pg_catalog
-- (que sí se busca siempre, aunque search_path esté vacío). Por eso la
-- llamada fallaba siempre con:
--   function gen_random_bytes(integer) does not exist
-- "Vender vale regalo" no llegaba nunca a crear ningún vale.
--
-- Corregido igual que ya hace pm11_crear_prefiltro_candidato en este mismo
-- proyecto: encode(extensions.gen_random_bytes(4),'hex').

create or replace function public.abc_emitir_vale_regalo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_importe numeric,
  p_caja_id uuid,
  p_session_id uuid,
  p_terminal_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_cmd jsonb; v_request jsonb; v_result jsonb;
  v_vale public.abc_vales_regalo%rowtype;
  v_codigo text; v_intentos int := 0;
  v_caja_operation_id text;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR')
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_EFECTIVO') then
    raise exception 'abc_vale_regalo_no_autorizado';
  end if;
  if p_importe is null or p_importe <= 0 or p_importe <> round(p_importe,8) then
    raise exception 'vale_regalo_importe_invalido';
  end if;
  if p_caja_id is null or p_session_id is null or p_terminal_id is null or p_operating_day is null then
    raise exception 'vale_regalo_parametros_requeridos';
  end if;

  v_request:=jsonb_build_object('importe',p_importe,'caja_id',p_caja_id,'session_id',p_session_id,'terminal_id',p_terminal_id,'operating_day',p_operating_day);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_EMITIR_VALE_REGALO',v_request,p_terminal_id);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  perform 1 from public.caja_sesiones s where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.id=p_session_id and s.caja_id=p_caja_id and s.estado='ABIERTA' for update;
  if not found then raise exception 'sesion_caja_no_abierta'; end if;
  if not exists(select 1 from public.caja_sesion_terminales st where st.empresa_id=p_empresa_id and st.local_id=p_local_id and st.session_id=p_session_id and st.terminal_id=p_terminal_id and st.hasta is null) then
    raise exception 'terminal_no_vinculado_sesion';
  end if;

  loop
    v_intentos := v_intentos + 1;
    v_codigo := 'VALE-' || upper(substr(encode(extensions.gen_random_bytes(4),'hex'),1,6));
    begin
      insert into public.abc_vales_regalo(
        empresa_id,local_id,codigo,importe_inicial,saldo_actual,estado,currency_code,emitido_por,emitido_operation_id
      ) values (
        p_empresa_id,p_local_id,v_codigo,p_importe,p_importe,'ACTIVO','EUR',auth.uid(),p_operation_id
      ) returning * into v_vale;
      exit;
    exception when unique_violation then
      if v_intentos >= 5 then raise exception 'vale_regalo_codigo_no_generado'; end if;
    end;
  end loop;

  v_caja_operation_id:='abc.vale.emitir.'||private.abc_request_hash(jsonb_build_object('command',p_operation_id,'vale_id',v_vale.id));
  insert into public.caja_operaciones(
    operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,medio_pago,concepto,origen_tipo,origen_id,payload,actor_user_id,abc_command_id,caja_id,session_id,terminal_id,currency_code,operating_day,occurred_at,categoria
  ) values (
    v_caja_operation_id,'ENTRADA',p_empresa_id,p_local_id,p_operating_day,p_importe,p_importe,'EFECTIVO','Vale regalo vendido','VALE_REGALO_EMITIDO',v_vale.id::text,
    jsonb_build_object('vale_id',v_vale.id,'codigo',v_vale.codigo),auth.uid(),p_operation_id,p_caja_id,p_session_id,p_terminal_id,'EUR',p_operating_day,now(),'VALE_REGALO'
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'VALE_REGALO',v_vale.id::text,'VALE_REGALO_EMITIDO',
    jsonb_build_object('codigo',v_vale.codigo,'importe',p_importe,'caja_operation_id',v_caja_operation_id),auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object('ok',true,'vale_id',v_vale.id,'codigo',v_vale.codigo,'importe',p_importe,'saldo',v_vale.saldo_actual);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;
