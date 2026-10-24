-- Plan Maestro L&A Suite — Etapa 5, T6, punto 5: vale regalo.
-- Hoja QA-7 (Pedro, 24/10/2026).
--
-- Dos flujos separados, pensados para no tocar ni una línea del cobro en
-- efectivo/tarjeta ya probado:
--
--   1. Vender un vale (abc_emitir_vale_regalo): importe libre, solo
--      efectivo en esta primera versión. Genera un código único y registra
--      el dinero en caja exactamente igual que cualquier cobro en efectivo
--      (mismo patrón que la propina, Hoja QA-4).
--   2. Canjear un vale como forma de pago en Cobro·F4
--      (abc_confirmar_pago_vale_regalo): usa abc_iniciar_cobro con
--      medio='OTRO', que el servidor YA admite sin ningún cambio — y un
--      resolutor nuevo que llama a abc_resolver_intento (la misma pieza
--      interna que ya usa el resolvedor de tarjeta simulado de QA-3) en
--      vez de inventar un cobro aparte. No entra dinero nuevo en caja al
--      canjear: ya entró cuando se vendió el vale.
--
-- Sin caducidad (decisión de Pedro, 24/10/2026). No se puede anular un
-- vale ya emitido en esta primera versión. El tratamiento fiscal/contable
-- de vender y canjear vales queda PENDIENTE_ASESORIA, igual que la
-- propina: esto solo lleva la cuenta interna del dinero y del saldo.

do $$
begin
  if to_regclass('public.caja_sesiones') is null or to_regclass('public.caja_sesion_terminales') is null
     or to_regclass('public.caja_operaciones') is null or to_regclass('public.pagos') is null
     or to_regclass('public.pago_intentos') is null or to_regclass('public.abc_eventos') is null then
    raise exception 'T6_VALE_REGALO_PREFLIGHT_FALLO: falta alguna tabla base';
  end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null
     or to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null
     or to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null
     or to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null
     or to_regprocedure('private.abc_request_hash(jsonb)') is null
     or to_regprocedure('public.abc_resolver_intento(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb)') is null then
    raise exception 'T6_VALE_REGALO_PREFLIGHT_FALLO: helpers ausentes';
  end if;
  if to_regclass('public.abc_vales_regalo') is not null then
    raise exception 'T6_VALE_REGALO_PREFLIGHT_FALLO: la tabla ya existe';
  end if;
end $$;

create table public.abc_vales_regalo (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  codigo text not null,
  importe_inicial numeric(24,8) not null,
  saldo_actual numeric(24,8) not null,
  estado text not null default 'ACTIVO',
  currency_code text not null default 'EUR',
  emitido_por uuid not null,
  emitido_operation_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint abc_vale_regalo_importe check (importe_inicial > 0),
  constraint abc_vale_regalo_saldo check (saldo_actual >= 0 and saldo_actual <= importe_inicial),
  constraint abc_vale_regalo_estado check (estado in ('ACTIVO','AGOTADO','ANULADO')),
  constraint abc_vale_regalo_moneda check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_vale_regalo_codigo_uq unique (empresa_id, codigo)
);

revoke all on table public.abc_vales_regalo from public, anon, authenticated, service_role;
alter table public.abc_vales_regalo enable row level security;

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
    v_codigo := 'VALE-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,6));
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

comment on function public.abc_emitir_vale_regalo is
  'T6 Hoja QA-7: vende un vale regalo (importe libre, solo efectivo en esta versión). Genera un código único y registra el dinero en caja igual que cualquier cobro en efectivo.';

revoke all on function public.abc_emitir_vale_regalo(text,text,text,numeric,uuid,uuid,uuid,date)
  from public, anon, authenticated, service_role;
grant execute on function public.abc_emitir_vale_regalo(text,text,text,numeric,uuid,uuid,uuid,date)
  to authenticated;

create or replace function public.abc_consultar_vale_regalo(
  p_empresa_id text,
  p_local_id text,
  p_codigo text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_vale public.abc_vales_regalo%rowtype;
  v_codigo text := upper(btrim(coalesce(p_codigo,'')));
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR') then
    raise exception 'abc_vale_regalo_no_autorizado';
  end if;
  if v_codigo = '' then raise exception 'vale_regalo_codigo_requerido'; end if;

  select * into v_vale from public.abc_vales_regalo v
   where v.empresa_id=p_empresa_id and v.local_id=p_local_id and v.codigo=v_codigo;
  if not found then raise exception 'vale_regalo_no_encontrado'; end if;

  return jsonb_build_object(
    'ok',true,'vale_id',v_vale.id,'codigo',v_vale.codigo,'estado',v_vale.estado,
    'saldo',v_vale.saldo_actual,'importe_inicial',v_vale.importe_inicial
  );
end $$;

comment on function public.abc_consultar_vale_regalo is
  'T6 Hoja QA-7: consulta de solo lectura del saldo de un vale regalo por su código, para validar antes de intentar canjearlo.';

revoke all on function public.abc_consultar_vale_regalo(text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.abc_consultar_vale_regalo(text,text,text)
  to authenticated;

create or replace function public.abc_confirmar_pago_vale_regalo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_intento_id uuid,
  p_codigo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_request jsonb; v_cmd jsonb; v_result jsonb; v_resolucion jsonb;
  v_intento public.pago_intentos%rowtype;
  v_pago public.pagos%rowtype;
  v_vale public.abc_vales_regalo%rowtype;
  v_codigo text := upper(btrim(coalesce(p_codigo,'')));
  v_nuevo_saldo numeric(24,8);
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR') then
    raise exception 'abc_vale_regalo_no_autorizado';
  end if;
  if p_intento_id is null or v_codigo = '' then raise exception 'vale_regalo_pago_parametros_invalidos'; end if;

  v_request:=jsonb_build_object('intento_id',p_intento_id,'codigo',v_codigo);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIRMAR_PAGO_VALE_REGALO',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_intento from public.pago_intentos
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_intento_id for update;
  if not found then raise exception 'vale_regalo_intento_no_encontrado'; end if;
  select * into v_pago from public.pagos
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_intento.pago_id for update;
  if not found then raise exception 'vale_regalo_pago_no_encontrado'; end if;
  if v_pago.medio <> 'OTRO' then raise exception 'vale_regalo_medio_incorrecto'; end if;
  if v_intento.estado <> 'PENDIENTE' then raise exception 'vale_regalo_intento_ya_resuelto'; end if;

  select * into v_vale from public.abc_vales_regalo v
   where v.empresa_id=p_empresa_id and v.local_id=p_local_id and v.codigo=v_codigo for update;
  if not found then raise exception 'vale_regalo_no_encontrado'; end if;
  if v_vale.estado <> 'ACTIVO' then raise exception 'vale_regalo_no_activo'; end if;
  if v_vale.saldo_actual < v_pago.importe_objetivo then raise exception 'vale_regalo_saldo_insuficiente'; end if;

  v_nuevo_saldo := v_vale.saldo_actual - v_pago.importe_objetivo;
  update public.abc_vales_regalo
     set saldo_actual = v_nuevo_saldo,
         estado = case when v_nuevo_saldo = 0 then 'AGOTADO' else estado end,
         updated_at = now()
   where id = v_vale.id;

  v_resolucion := public.abc_resolver_intento(
    'vale.regalo.resolver.' || replace(p_intento_id::text,'-',''),
    p_empresa_id, p_local_id, p_intento_id, 'CONFIRMADO',
    'VALE_REGALO', v_vale.codigo,
    v_pago.importe_objetivo, v_pago.importe_objetivo, v_pago.importe_objetivo,
    jsonb_build_object('vale_id', v_vale.id, 'modo', 'VALE_REGALO')
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'VALE_REGALO',v_vale.id::text,'VALE_REGALO_CANJEADO',
    jsonb_build_object('pago_id',v_pago.id,'intento_id',p_intento_id,'importe',v_pago.importe_objetivo,'saldo_restante',v_nuevo_saldo),
    auth.uid(),null,now(),current_date
  );

  v_result:=jsonb_build_object('ok',true,'vale_id',v_vale.id,'codigo',v_vale.codigo,'importe_aplicado',v_pago.importe_objetivo,'saldo_restante',v_nuevo_saldo,'resolucion',v_resolucion);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

comment on function public.abc_confirmar_pago_vale_regalo is
  'T6 Hoja QA-7: resuelve, mediante abc_resolver_intento, un pago de medio OTRO como canje de vale regalo. No crea dinero nuevo en caja: solo descuenta el saldo del vale.';

revoke all on function public.abc_confirmar_pago_vale_regalo(text,text,text,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.abc_confirmar_pago_vale_regalo(text,text,text,uuid,text)
  to authenticated;
