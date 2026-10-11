-- ABC F2 M04C — outbox persistente y workers con lease.
-- Aditiva; conecta cobros/reembolsos externos a efectos_pendientes dentro de la misma transaccion.
-- No almacena PAN/CVV ni datos sensibles de tarjeta.

do $$
declare
  v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.efectos_pendientes') is null then v_missing:=array_append(v_missing,'efectos_pendientes'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('public.abc_iniciar_cobro(text,text,text,uuid,uuid,uuid,text,numeric,text,uuid,numeric,numeric)') is null then v_missing:=array_append(v_missing,'abc_iniciar_cobro'); end if;
  if to_regprocedure('public.abc_resolver_intento(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb)') is null then v_missing:=array_append(v_missing,'abc_resolver_intento'); end if;
  if to_regprocedure('public.abc_solicitar_reembolso(text,text,text,uuid,uuid,numeric,text,uuid,date)') is null then v_missing:=array_append(v_missing,'abc_solicitar_reembolso'); end if;
  if to_regprocedure('public.abc_cancelar_reembolso(text,text,text,uuid,text,uuid,date)') is null then v_missing:=array_append(v_missing,'abc_cancelar_reembolso'); end if;
  if to_regprocedure('public.abc_resolver_reembolso(text,text,text,uuid,text,text,text,jsonb,date)') is null then v_missing:=array_append(v_missing,'abc_resolver_reembolso'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F2_M04C_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if exists(select 1 from public.efectos_pendientes where estado='EN_PROCESO') then
    raise exception 'ABC_F2_M04C_PREFLIGHT_FALLO: efectos EN_PROCESO sin lease historico';
  end if;

  if to_regprocedure('private.abc_encolar_efecto(text,text,text,text,text,jsonb)') is not null
     or to_regprocedure('public.abc_reclamar_efectos(text,integer,integer)') is not null
     or exists(
       select 1 from information_schema.columns
       where table_schema='public' and table_name='efectos_pendientes'
         and column_name in ('locked_at','lease_until','worker_ref','last_attempt_at')
       group by table_schema,table_name
       having count(*)>0
     ) then
    raise exception 'ABC_F2_M04C_PREFLIGHT_FALLO: objetos M04C ya existen';
  end if;
end $$;

alter table public.efectos_pendientes
  add column locked_at timestamptz,
  add column lease_until timestamptz,
  add column worker_ref text,
  add column last_attempt_at timestamptz;

alter table public.efectos_pendientes
  alter column next_attempt_at set default now();

update public.efectos_pendientes
   set next_attempt_at=coalesce(next_attempt_at,created_at)
 where estado in ('PENDIENTE','ERROR');

update public.efectos_pendientes
   set next_attempt_at=null
 where estado in ('COMPLETADO','ABANDONADO');

alter table public.efectos_pendientes
  add constraint abc_efecto_worker_ref
    check (worker_ref is null or nullif(btrim(worker_ref),'') is not null),
  add constraint abc_efecto_lease_consistente
    check (
      (
        estado='EN_PROCESO'
        and locked_at is not null
        and lease_until is not null
        and lease_until>locked_at
        and nullif(btrim(worker_ref),'') is not null
        and completed_at is null
        and next_attempt_at is null
      )
      or (
        estado in ('PENDIENTE','ERROR')
        and locked_at is null
        and lease_until is null
        and worker_ref is null
        and completed_at is null
        and next_attempt_at is not null
      )
      or (
        estado='COMPLETADO'
        and locked_at is null
        and lease_until is null
        and worker_ref is null
        and completed_at is not null
        and next_attempt_at is null
      )
      or (
        estado='ABANDONADO'
        and locked_at is null
        and lease_until is null
        and worker_ref is null
        and completed_at is null
        and next_attempt_at is null
      )
    );

create index abc_efecto_worker_claim_idx
  on public.efectos_pendientes(estado,next_attempt_at,lease_until,created_at,id)
  where estado in ('PENDIENTE','ERROR','EN_PROCESO');

create function private.abc_encolar_efecto(
  p_empresa_id text,
  p_local_id text,
  p_abc_command_id text,
  p_tipo text,
  p_dedupe_key text,
  p_payload jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_tipo text:=upper(btrim(coalesce(p_tipo,'')));
  v_dedupe text:=btrim(coalesce(p_dedupe_key,''));
  v_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
  v_row public.efectos_pendientes%rowtype;
begin
  if v_tipo='' or v_dedupe='' then raise exception 'efecto_tipo_dedupe_requeridos'; end if;
  if jsonb_typeof(v_payload)<>'object' then raise exception 'efecto_payload_invalido'; end if;
  if v_payload ?| array['pan','PAN','cvv','CVV','card_number','numero_tarjeta'] then
    raise exception 'efecto_payload_datos_tarjeta_prohibidos';
  end if;

  insert into public.efectos_pendientes(
    empresa_id,local_id,abc_command_id,tipo,dedupe_key,payload,
    estado,attempt_count,next_attempt_at
  ) values (
    p_empresa_id,p_local_id,p_abc_command_id,v_tipo,v_dedupe,v_payload,
    'PENDIENTE',0,now()
  )
  on conflict (empresa_id,dedupe_key) do nothing
  returning * into v_row;

  if found then return v_row.id; end if;

  select * into v_row
    from public.efectos_pendientes
   where empresa_id=p_empresa_id and dedupe_key=v_dedupe
   for update;

  if not found
     or v_row.local_id<>p_local_id
     or v_row.abc_command_id<>p_abc_command_id
     or v_row.tipo<>v_tipo
     or v_row.payload<>v_payload then
    raise exception 'efecto_dedupe_conflict';
  end if;

  return v_row.id;
end $$;

create function private.abc_completar_efecto_dedupe(
  p_empresa_id text,
  p_dedupe_key text
)
returns boolean
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_id uuid;
begin
  select id into v_id
    from public.efectos_pendientes
   where empresa_id=p_empresa_id
     and dedupe_key=p_dedupe_key
   for update;

  if not found then return false; end if;

  update public.efectos_pendientes
     set estado='COMPLETADO',
         completed_at=coalesce(completed_at,now()),
         locked_at=null,lease_until=null,worker_ref=null,
         next_attempt_at=null,last_error=null
   where id=v_id
     and estado<>'ABANDONADO';

  return true;
end $$;

create function private.abc_abandonar_efecto_dedupe(
  p_empresa_id text,
  p_dedupe_key text,
  p_error jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_row public.efectos_pendientes%rowtype;
begin
  select * into v_row
    from public.efectos_pendientes
   where empresa_id=p_empresa_id
     and dedupe_key=p_dedupe_key
   for update;

  if not found then return false; end if;
  if v_row.estado='EN_PROCESO' then raise exception 'efecto_proveedor_en_proceso'; end if;
  if v_row.estado='COMPLETADO' then raise exception 'efecto_proveedor_ya_completado'; end if;

  update public.efectos_pendientes
     set estado='ABANDONADO',
         locked_at=null,lease_until=null,worker_ref=null,
         next_attempt_at=null,last_error=coalesce(p_error,'{}'::jsonb)
   where id=v_row.id;

  return true;
end $$;

create function public.abc_reclamar_efectos(
  p_worker_ref text,
  p_limite integer default 10,
  p_lease_seconds integer default 60
)
returns setof public.efectos_pendientes
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_worker text:=btrim(coalesce(p_worker_ref,''));
begin
  if v_worker='' then raise exception 'worker_ref_requerido'; end if;
  if p_limite is null or p_limite<1 or p_limite>100 then raise exception 'limite_efectos_invalido'; end if;
  if p_lease_seconds is null or p_lease_seconds<5 or p_lease_seconds>3600 then
    raise exception 'lease_seconds_invalido';
  end if;

  return query
  with candidatos as (
    select e.id
      from public.efectos_pendientes e
     where (
       e.estado in ('PENDIENTE','ERROR')
       and e.next_attempt_at<=now()
     ) or (
       e.estado='EN_PROCESO'
       and e.lease_until<=now()
     )
     order by
       case when e.estado='EN_PROCESO' then e.lease_until else e.next_attempt_at end,
       e.created_at,e.id
     for update skip locked
     limit p_limite
  )
  update public.efectos_pendientes e
     set estado='EN_PROCESO',
         attempt_count=e.attempt_count+1,
         last_attempt_at=now(),
         locked_at=now(),
         lease_until=now()+make_interval(secs=>p_lease_seconds),
         worker_ref=v_worker,
         next_attempt_at=null
    from candidatos c
   where e.id=c.id
  returning e.*;
end $$;

create function public.abc_reprogramar_efecto(
  p_efecto_id uuid,
  p_worker_ref text,
  p_next_attempt_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_worker text:=btrim(coalesce(p_worker_ref,''));
  v_next timestamptz:=coalesce(p_next_attempt_at,now());
  v_row public.efectos_pendientes%rowtype;
begin
  select * into v_row from public.efectos_pendientes
   where id=p_efecto_id for update;
  if not found then raise exception 'efecto_no_encontrado'; end if;
  if v_row.estado<>'EN_PROCESO' or v_row.worker_ref is distinct from v_worker then
    raise exception 'efecto_lease_no_poseida';
  end if;
  if v_row.lease_until<=now() then raise exception 'efecto_lease_expirada'; end if;

  update public.efectos_pendientes
     set estado='PENDIENTE',locked_at=null,lease_until=null,worker_ref=null,
         next_attempt_at=greatest(v_next,now())
   where id=p_efecto_id;

  return jsonb_build_object('ok',true,'efecto_id',p_efecto_id,'estado','PENDIENTE');
end $$;

create function public.abc_registrar_error_efecto(
  p_efecto_id uuid,
  p_worker_ref text,
  p_error jsonb,
  p_next_attempt_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_worker text:=btrim(coalesce(p_worker_ref,''));
  v_next timestamptz:=coalesce(p_next_attempt_at,now());
  v_error jsonb:=coalesce(p_error,'{}'::jsonb);
  v_row public.efectos_pendientes%rowtype;
begin
  if jsonb_typeof(v_error)<>'object' or v_error='{}'::jsonb then
    raise exception 'efecto_error_requerido';
  end if;
  select * into v_row from public.efectos_pendientes
   where id=p_efecto_id for update;
  if not found then raise exception 'efecto_no_encontrado'; end if;
  if v_row.estado<>'EN_PROCESO' or v_row.worker_ref is distinct from v_worker then
    raise exception 'efecto_lease_no_poseida';
  end if;
  if v_row.lease_until<=now() then raise exception 'efecto_lease_expirada'; end if;

  update public.efectos_pendientes
     set estado='ERROR',locked_at=null,lease_until=null,worker_ref=null,
         next_attempt_at=greatest(v_next,now()),last_error=v_error
   where id=p_efecto_id;

  return jsonb_build_object('ok',true,'efecto_id',p_efecto_id,'estado','ERROR');
end $$;

create function public.abc_completar_efecto(
  p_efecto_id uuid,
  p_worker_ref text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_worker text:=btrim(coalesce(p_worker_ref,''));
  v_row public.efectos_pendientes%rowtype;
  v_estado_dominio text;
begin
  select * into v_row from public.efectos_pendientes
   where id=p_efecto_id for update;
  if not found then raise exception 'efecto_no_encontrado'; end if;

  if v_row.estado='COMPLETADO' then
    return jsonb_build_object('ok',true,'already_completed',true,'efecto_id',p_efecto_id);
  end if;
  if v_row.estado<>'EN_PROCESO' or v_row.worker_ref is distinct from v_worker then
    raise exception 'efecto_lease_no_poseida';
  end if;
  if v_row.lease_until<=now() then raise exception 'efecto_lease_expirada'; end if;

  if v_row.tipo='PROVIDER_COBRO' then
    select estado into v_estado_dominio
      from public.pago_intentos
     where empresa_id=v_row.empresa_id
       and local_id=v_row.local_id
       and id=(v_row.payload->>'intento_id')::uuid;
    if v_estado_dominio not in ('CONFIRMADO','RECHAZADO','CANCELADO') then
      raise exception 'efecto_dominio_no_resuelto';
    end if;
  elsif v_row.tipo='PROVIDER_REEMBOLSO' then
    select estado into v_estado_dominio
      from public.reembolsos
     where empresa_id=v_row.empresa_id
       and local_id=v_row.local_id
       and id=(v_row.payload->>'reembolso_id')::uuid;
    if v_estado_dominio not in ('CONFIRMADO','RECHAZADO','CANCELADO') then
      raise exception 'efecto_dominio_no_resuelto';
    end if;
  else
    raise exception 'efecto_tipo_no_completable';
  end if;

  update public.efectos_pendientes
     set estado='COMPLETADO',completed_at=now(),
         locked_at=null,lease_until=null,worker_ref=null,
         next_attempt_at=null,last_error=null
   where id=p_efecto_id;

  return jsonb_build_object('ok',true,'efecto_id',p_efecto_id,'estado','COMPLETADO');
end $$;

create function public.abc_abandonar_efecto(
  p_efecto_id uuid,
  p_worker_ref text,
  p_error jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_worker text:=btrim(coalesce(p_worker_ref,''));
  v_error jsonb:=coalesce(p_error,'{}'::jsonb);
  v_row public.efectos_pendientes%rowtype;
begin
  if jsonb_typeof(v_error)<>'object' or v_error='{}'::jsonb then
    raise exception 'efecto_error_requerido';
  end if;
  select * into v_row from public.efectos_pendientes
   where id=p_efecto_id for update;
  if not found then raise exception 'efecto_no_encontrado'; end if;
  if v_row.estado<>'EN_PROCESO' or v_row.worker_ref is distinct from v_worker then
    raise exception 'efecto_lease_no_poseida';
  end if;
  if v_row.lease_until<=now() then raise exception 'efecto_lease_expirada'; end if;

  update public.efectos_pendientes
     set estado='ABANDONADO',locked_at=null,lease_until=null,worker_ref=null,
         next_attempt_at=null,last_error=v_error
   where id=p_efecto_id;

  return jsonb_build_object('ok',true,'efecto_id',p_efecto_id,'estado','ABANDONADO');
end $$;


create or replace function public.abc_iniciar_cobro(
  p_operation_id text,p_empresa_id text,p_local_id text,p_checkout_id uuid,
  p_pago_id uuid,p_intento_id uuid,p_medio text,p_importe_objetivo numeric,
  p_payment_currency_code text,p_terminal_id uuid,
  p_importe_recibido numeric default null,p_cambio_entregado numeric default null
) returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_cmd jsonb; v_request jsonb; v_medio text:=upper(btrim(coalesce(p_medio,'')));
  v_payment_currency text:=upper(btrim(coalesce(p_payment_currency_code,'')));
  v_sale_currency text; v_operating_day date; v_total numeric(24,8):=0;
  v_restante numeric(24,8); v_disponible numeric(24,8); v_asignado numeric(24,8);
  v_ids uuid[]; r record; v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR') then
    raise exception 'abc_cobro_no_autorizado';
  end if;
  if v_medio='EFECTIVO'
     and not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_EFECTIVO') then
    raise exception 'abc_efectivo_no_autorizado';
  end if;
  if p_checkout_id is null or p_pago_id is null or p_intento_id is null or p_terminal_id is null then
    raise exception 'cobro_parametros_requeridos';
  end if;
  if v_medio not in ('EFECTIVO','TARJETA','TRANSFERENCIA','OTRO') then raise exception 'medio_pago_invalido'; end if;
  if p_importe_objetivo is null or p_importe_objetivo<=0 then raise exception 'importe_pago_invalido'; end if;
  if v_payment_currency !~ '^[A-Z]{3}$' then raise exception 'moneda_pago_invalida'; end if;

  v_request:=jsonb_build_object(
    'checkout_id',p_checkout_id,'pago_id',p_pago_id,'intento_id',p_intento_id,
    'medio',v_medio,'importe_objetivo',p_importe_objetivo,
    'payment_currency_code',v_payment_currency,'terminal_id',p_terminal_id,
    'importe_recibido',p_importe_recibido,'cambio_entregado',p_cambio_entregado
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_INICIAR_COBRO',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select c.currency_code,c.operating_day into v_sale_currency,v_operating_day
    from public.checkouts c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=p_checkout_id
     and c.estado in ('ABIERTO','EN_COBRO') for update;
  if not found then raise exception 'checkout_no_cobrable'; end if;
  if v_payment_currency<>v_sale_currency then raise exception 'conversion_divisa_no_habilitada'; end if;

  select array_agg(cv.venta_fiscal_id order by cv.venta_fiscal_id) into v_ids
    from public.checkout_ventas cv
   where cv.empresa_id=p_empresa_id and cv.local_id=p_local_id and cv.checkout_id=p_checkout_id;
  if v_ids is null then raise exception 'checkout_sin_ventas'; end if;
  perform private.abc_bloquear_ventas(p_empresa_id,p_local_id,v_ids);

  for r in select cv.id,cv.venta_fiscal_id from public.checkout_ventas cv
    where cv.empresa_id=p_empresa_id and cv.local_id=p_local_id and cv.checkout_id=p_checkout_id
    order by cv.venta_fiscal_id,cv.id
  loop
    v_total:=v_total+private.abc_saldo_disponible(p_empresa_id,p_local_id,r.venta_fiscal_id);
  end loop;
  if p_importe_objetivo>v_total then raise exception 'saldo_insuficiente'; end if;

  if v_medio='EFECTIVO' then
    if p_importe_recibido is null or p_cambio_entregado is null
       or p_importe_recibido<p_importe_objetivo or p_cambio_entregado<0
       or p_importe_recibido-p_cambio_entregado<>p_importe_objetivo then
      raise exception 'efectivo_recibido_cambio_inconsistente';
    end if;
  elsif p_importe_recibido is not null or p_cambio_entregado is not null then
    raise exception 'efectivo_solo_para_medio_efectivo';
  end if;

  insert into public.pagos(
    id,empresa_id,local_id,checkout_id,medio,estado,sale_currency_code,payment_currency_code,
    importe_objetivo,importe_recibido,cambio_entregado,version,created_by
  ) values (
    p_pago_id,p_empresa_id,p_local_id,p_checkout_id,v_medio,'PENDIENTE',
    v_sale_currency,v_payment_currency,p_importe_objetivo,p_importe_recibido,p_cambio_entregado,1,auth.uid()
  );
  insert into public.pago_intentos(
    id,empresa_id,local_id,pago_id,abc_command_id,estado,requested_amount,payment_currency_code,
    authorization_status,capture_status,settlement_status
  ) values (
    p_intento_id,p_empresa_id,p_local_id,p_pago_id,p_operation_id,'PENDIENTE',
    p_importe_objetivo,v_payment_currency,
    case when v_medio='EFECTIVO' then 'NO_APLICA' else 'PENDIENTE' end,
    case when v_medio='EFECTIVO' then 'NO_APLICA' else 'PENDIENTE' end,
    case when v_medio='EFECTIVO' then 'NO_APLICA' else 'PENDIENTE' end
  );

  v_restante:=p_importe_objetivo;
  for r in select cv.id,cv.venta_fiscal_id from public.checkout_ventas cv
    where cv.empresa_id=p_empresa_id and cv.local_id=p_local_id and cv.checkout_id=p_checkout_id
    order by cv.venta_fiscal_id,cv.id
  loop
    exit when v_restante<=0;
    v_disponible:=private.abc_saldo_disponible(p_empresa_id,p_local_id,r.venta_fiscal_id);
    if v_disponible>0 then
      v_asignado:=least(v_restante,v_disponible);
      insert into public.reservas_saldo(
        id,empresa_id,local_id,intento_id,checkout_venta_id,venta_fiscal_id,
        sale_currency_code,importe_reservado,estado
      ) values (
        gen_random_uuid(),p_empresa_id,p_local_id,p_intento_id,r.id,
        r.venta_fiscal_id,v_sale_currency,v_asignado,'ACTIVA'
      );
      v_restante:=v_restante-v_asignado;
    end if;
  end loop;
  if v_restante<>0 then raise exception 'reserva_incompleta'; end if;

  update public.checkouts set estado='EN_COBRO',
    version=case when estado='ABIERTO' then version+1 else version end
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_checkout_id;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'PAGO',p_pago_id::text,'PAGO_INTENTO_INICIADO',
    jsonb_build_object('checkout_id',p_checkout_id,'intento_id',p_intento_id,
      'medio',v_medio,'importe',p_importe_objetivo,'currency_code',v_payment_currency),
    auth.uid(),p_terminal_id,now(),v_operating_day
  );


  if v_medio<>'EFECTIVO' then
    perform private.abc_encolar_efecto(
      p_empresa_id,p_local_id,p_operation_id,
      'PROVIDER_COBRO',
      'pago-intento:'||p_intento_id::text,
      jsonb_build_object(
        'pago_id',p_pago_id,
        'intento_id',p_intento_id,
        'checkout_id',p_checkout_id,
        'medio',v_medio,
        'importe',p_importe_objetivo,
        'currency_code',v_payment_currency,
        'terminal_id',p_terminal_id,
        'operating_day',v_operating_day
      )
    );
  end if;

  v_result:=jsonb_build_object('ok',true,'pago_id',p_pago_id,'intento_id',p_intento_id,
    'estado','PENDIENTE','importe_reservado',p_importe_objetivo);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create or replace function public.abc_resolver_intento(
  p_operation_id text,p_empresa_id text,p_local_id text,p_intento_id uuid,p_estado text,
  p_provider_code text,p_provider_reference text,p_authorized_amount numeric,
  p_captured_amount numeric,p_settled_amount numeric,p_provider_snapshot jsonb default '{}'::jsonb
) returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_estado text:=upper(btrim(coalesce(p_estado,'')));
  v_provider text:=nullif(btrim(coalesce(p_provider_code,'')),'');
  v_reference text:=nullif(btrim(coalesce(p_provider_reference,'')),'');
  v_request jsonb; v_cmd jsonb; v_intento public.pago_intentos%rowtype;
  v_pago public.pagos%rowtype; v_terminal uuid; v_day date;
  v_aplicado numeric(24,8):=0; v_liberado numeric(24,8):=0;
  v_checkout_estado text; v_ids uuid[]; v_result jsonb;
begin
  if v_estado not in ('AUTORIZADO','CONFIRMADO','RECHAZADO','CANCELADO','DESCONOCIDO') then
    raise exception 'estado_resolucion_invalido';
  end if;
  if v_provider is null or v_reference is null then raise exception 'provider_requerido'; end if;

  select * into v_intento from public.pago_intentos
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_intento_id;
  if not found then raise exception 'intento_no_encontrado'; end if;
  select * into v_pago from public.pagos
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_intento.pago_id;
  if v_pago.medio='EFECTIVO' then raise exception 'efectivo_usa_confirmacion_local'; end if;
  select terminal_id into v_terminal from public.abc_operaciones where operation_id=v_intento.abc_command_id;
  select operating_day into v_day from public.checkouts
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_pago.checkout_id;

  v_request:=jsonb_build_object('intento_id',p_intento_id,'estado',v_estado,
    'provider_code',v_provider,'provider_reference',v_reference,
    'authorized_amount',p_authorized_amount,'captured_amount',p_captured_amount,
    'settled_amount',p_settled_amount,'provider_snapshot',coalesce(p_provider_snapshot,'{}'::jsonb));
  v_cmd:=private.abc_operacion_iniciar_sistema(
    p_operation_id,p_empresa_id,p_local_id,'ABC_RESOLVER_INTENTO',
    v_request,v_pago.created_by,v_terminal,v_provider
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_intento from public.pago_intentos
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_intento_id for update;
  select * into v_pago from public.pagos
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_intento.pago_id for update;

  if v_intento.estado in ('CONFIRMADO','RECHAZADO','CANCELADO') then
    if v_intento.estado=v_estado
       and v_intento.provider_code is not distinct from v_provider
       and v_intento.provider_reference is not distinct from v_reference
       and v_intento.authorized_amount is not distinct from
         (case when v_estado='CONFIRMADO'
               then coalesce(p_authorized_amount,p_captured_amount)
               else p_authorized_amount end)
       and v_intento.captured_amount is not distinct from p_captured_amount
       and v_intento.settled_amount is not distinct from p_settled_amount then
      perform private.abc_completar_efecto_dedupe(
        p_empresa_id,'pago-intento:'||p_intento_id::text
      );
      v_result:=jsonb_build_object(
        'ok',true,'already_resolved',true,
        'intento_id',p_intento_id,'pago_id',v_pago.id,
        'estado',v_estado
      );
      perform private.abc_operacion_completar(p_operation_id,v_result);
      return v_result;
    end if;
    raise exception 'intento_ya_resuelto';
  end if;
  if v_intento.provider_code is not null
     and (v_intento.provider_code<>v_provider
          or v_intento.provider_reference is distinct from v_reference) then
    raise exception 'provider_reference_conflict';
  end if;

  if v_estado='AUTORIZADO' then
    if p_authorized_amount is null or p_authorized_amount<=0
       or p_authorized_amount>v_intento.requested_amount then
      raise exception 'importe_autorizado_invalido';
    end if;
    update public.pago_intentos set estado='AUTORIZADO',
      provider_code=v_provider,provider_reference=v_reference,
      authorized_amount=p_authorized_amount,captured_amount=null,settled_amount=null,
      authorization_status='AUTORIZADO',capture_status='PENDIENTE',
      settlement_status='PENDIENTE',provider_snapshot=coalesce(p_provider_snapshot,'{}'::jsonb),
      resolved_at=null where id=p_intento_id;
    update public.pagos set estado='AUTORIZADO',resolved_at=null,version=version+1 where id=v_pago.id;
  elsif v_estado='DESCONOCIDO' then
    update public.pago_intentos set estado='DESCONOCIDO',
      provider_code=v_provider,provider_reference=v_reference,
      authorized_amount=p_authorized_amount,captured_amount=p_captured_amount,
      settled_amount=p_settled_amount,
      authorization_status=case when p_authorized_amount is null then 'DESCONOCIDO' else 'AUTORIZADO' end,
      capture_status='DESCONOCIDO',settlement_status='PENDIENTE',
      provider_snapshot=coalesce(p_provider_snapshot,'{}'::jsonb),resolved_at=null
      where id=p_intento_id;
    update public.pagos set estado='DESCONOCIDO',resolved_at=null,version=version+1 where id=v_pago.id;
  elsif v_estado in ('RECHAZADO','CANCELADO') then
    v_liberado:=private.abc_liberar_reservas_intento(p_empresa_id,p_local_id,p_intento_id);
    update public.pago_intentos set estado=v_estado,
      provider_code=v_provider,provider_reference=v_reference,
      authorized_amount=p_authorized_amount,captured_amount=p_captured_amount,settled_amount=p_settled_amount,
      authorization_status=case when v_estado='RECHAZADO' then 'RECHAZADO' else 'CANCELADO' end,
      capture_status=case when v_estado='RECHAZADO' then 'RECHAZADO' else 'CANCELADO' end,
      settlement_status=case when v_estado='RECHAZADO' then 'RECHAZADO' else 'CANCELADO' end,
      provider_snapshot=coalesce(p_provider_snapshot,'{}'::jsonb),resolved_at=now()
      where id=p_intento_id;
    update public.pagos set estado=v_estado,resolved_at=now(),version=version+1 where id=v_pago.id;
  else
    if p_captured_amount is null or p_captured_amount<>v_intento.requested_amount
       or p_captured_amount<>v_pago.importe_objetivo then
      raise exception 'captura_parcial_no_habilitada';
    end if;
    if p_authorized_amount is not null and p_authorized_amount<p_captured_amount then
      raise exception 'captura_supera_autorizacion';
    end if;
    select array_agg(venta_fiscal_id order by venta_fiscal_id) into v_ids
      from public.reservas_saldo
     where empresa_id=p_empresa_id and local_id=p_local_id
       and intento_id=p_intento_id and estado='ACTIVA';
    if v_ids is null then raise exception 'reservas_activas_requeridas'; end if;
    perform private.abc_bloquear_ventas(p_empresa_id,p_local_id,v_ids);
    v_aplicado:=private.abc_aplicar_intento_confirmado(p_empresa_id,p_local_id,p_intento_id);
    update public.pago_intentos set estado='CONFIRMADO',
      provider_code=v_provider,provider_reference=v_reference,
      authorized_amount=coalesce(p_authorized_amount,p_captured_amount),
      captured_amount=p_captured_amount,settled_amount=p_settled_amount,
      authorization_status='AUTORIZADO',capture_status='CONFIRMADO',
      settlement_status=case when p_settled_amount is null then 'PENDIENTE' else 'LIQUIDADO' end,
      provider_snapshot=coalesce(p_provider_snapshot,'{}'::jsonb),resolved_at=now()
      where id=p_intento_id;
    update public.pagos set estado='CONFIRMADO',resolved_at=now(),version=version+1 where id=v_pago.id;
    v_checkout_estado:=private.abc_actualizar_checkout_estado(p_empresa_id,p_local_id,v_pago.checkout_id);
  end if;

  if v_estado in ('CONFIRMADO','RECHAZADO','CANCELADO') then
    perform private.abc_completar_efecto_dedupe(
      p_empresa_id,'pago-intento:'||p_intento_id::text
    );
  end if;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,
    actor_user_id,terminal_id,occurred_at,operating_day,executor_kind,executor_ref
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'PAGO',v_pago.id::text,'PAGO_INTENTO_RESUELTO',
    jsonb_build_object('intento_id',p_intento_id,'estado',v_estado,'provider_code',v_provider,
      'provider_reference',v_reference,'aplicado',v_aplicado,'liberado',v_liberado,
      'checkout_estado',v_checkout_estado),
    v_pago.created_by,v_terminal,now(),v_day,'SYSTEM_PROVIDER',v_provider
  );

  v_result:=jsonb_build_object('ok',true,'intento_id',p_intento_id,'pago_id',v_pago.id,
    'estado',v_estado,'aplicado',v_aplicado,'liberado',v_liberado,
    'checkout_estado',v_checkout_estado);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create or replace function public.abc_solicitar_reembolso(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_reembolso_id uuid,
  p_pago_id uuid,
  p_importe_solicitado numeric,
  p_motivo text,
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
  v_cmd jsonb;
  v_request jsonb;
  v_pago public.pagos%rowtype;
  v_importe numeric(24,8);
  v_motivo text:=btrim(coalesce(p_motivo,''));
  v_ids uuid[];
  v_total_disponible numeric(24,8):=0;
  v_restante numeric(24,8);
  v_disp_pago numeric(24,8);
  v_disp_venta numeric(24,8);
  v_asignado numeric(24,8);
  r record;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(
       p_empresa_id,p_local_id,'ABC_REEMBOLSO_SOLICITAR'
     ) then
    raise exception 'abc_reembolso_no_autorizado';
  end if;

  if p_reembolso_id is null or p_pago_id is null or p_operating_day is null then
    raise exception 'reembolso_parametros_requeridos';
  end if;
  if p_importe_solicitado is null or p_importe_solicitado<=0 then
    raise exception 'importe_reembolso_invalido';
  end if;
  if p_importe_solicitado<>round(p_importe_solicitado,8) then
    raise exception 'importe_reembolso_precision_invalida';
  end if;
  if v_motivo='' then raise exception 'motivo_reembolso_requerido'; end if;

  v_importe:=p_importe_solicitado::numeric(24,8);
  v_request:=jsonb_build_object(
    'reembolso_id',p_reembolso_id,
    'pago_id',p_pago_id,
    'importe_solicitado',v_importe,
    'motivo',v_motivo,
    'terminal_id',p_terminal_id,
    'operating_day',p_operating_day
  );

  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_SOLICITAR_REEMBOLSO',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select *
    into v_pago
    from public.pagos
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_pago_id
   for update;

  if not found then raise exception 'pago_no_encontrado'; end if;
  if v_pago.estado<>'CONFIRMADO' then raise exception 'pago_no_reembolsable'; end if;
  if v_pago.payment_currency_code<>v_pago.sale_currency_code then
    raise exception 'conversion_reembolso_no_habilitada';
  end if;

  select array_agg(a.id order by a.id)
    into v_ids
    from public.pago_aplicaciones a
   where a.empresa_id=p_empresa_id
     and a.local_id=p_local_id
     and a.pago_id=p_pago_id;

  if v_ids is null or cardinality(v_ids)=0 then
    raise exception 'pago_sin_aplicaciones_confirmadas';
  end if;

  perform private.abc_bloquear_aplicaciones(
    p_empresa_id,p_local_id,v_ids
  );

  for r in
    select a.*
      from public.pago_aplicaciones a
     where a.empresa_id=p_empresa_id
       and a.local_id=p_local_id
       and a.pago_id=p_pago_id
     order by a.confirmed_at,a.id
  loop
    if r.payment_currency_code<>r.sale_currency_code
       or r.payment_amount<>r.sale_amount then
      raise exception 'conversion_reembolso_no_habilitada';
    end if;
    v_disp_pago:=private.abc_max_reembolsable_pago(
      p_empresa_id,p_local_id,r.id
    );
    v_disp_venta:=private.abc_max_reembolsable_venta(
      p_empresa_id,p_local_id,r.id
    );
    v_total_disponible:=v_total_disponible+least(v_disp_pago,v_disp_venta);
  end loop;

  if v_importe>v_total_disponible then
    raise exception 'saldo_reembolsable_insuficiente';
  end if;

  insert into public.reembolsos(
    id,empresa_id,local_id,pago_id,abc_command_id,estado,
    payment_currency_code,importe_solicitado,motivo,created_by
  ) values (
    p_reembolso_id,p_empresa_id,p_local_id,p_pago_id,p_operation_id,'PENDIENTE',
    v_pago.payment_currency_code,v_importe,v_motivo,auth.uid()
  );

  v_restante:=v_importe;
  for r in
    select a.*
      from public.pago_aplicaciones a
     where a.empresa_id=p_empresa_id
       and a.local_id=p_local_id
       and a.pago_id=p_pago_id
     order by a.confirmed_at,a.id
  loop
    exit when v_restante<=0;

    v_disp_pago:=private.abc_max_reembolsable_pago(
      p_empresa_id,p_local_id,r.id
    );
    v_disp_venta:=private.abc_max_reembolsable_venta(
      p_empresa_id,p_local_id,r.id
    );
    v_asignado:=least(v_restante,v_disp_pago,v_disp_venta);

    if v_asignado>0 then
      insert into public.reembolso_aplicaciones(
        id,empresa_id,local_id,reembolso_id,pago_aplicacion_id,
        venta_fiscal_id,importe_venta,sale_currency_code,
        importe_pago,payment_currency_code
      ) values (
        gen_random_uuid(),p_empresa_id,p_local_id,p_reembolso_id,r.id,
        r.venta_fiscal_id,v_asignado,r.sale_currency_code,
        v_asignado,r.payment_currency_code
      );
      v_restante:=v_restante-v_asignado;
    end if;
  end loop;

  if v_restante<>0 then raise exception 'reembolso_reserva_incompleta'; end if;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'REEMBOLSO',p_reembolso_id::text,
    'REEMBOLSO_SOLICITADO',
    jsonb_build_object(
      'pago_id',p_pago_id,
      'importe',v_importe,
      'currency_code',v_pago.payment_currency_code,
      'motivo',v_motivo
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  if v_pago.medio<>'EFECTIVO' then
    perform private.abc_encolar_efecto(
      p_empresa_id,p_local_id,p_operation_id,
      'PROVIDER_REEMBOLSO',
      'reembolso:'||p_reembolso_id::text,
      jsonb_build_object(
        'reembolso_id',p_reembolso_id,
        'pago_id',p_pago_id,
        'importe',v_importe,
        'currency_code',v_pago.payment_currency_code,
        'motivo',v_motivo,
        'terminal_id',p_terminal_id,
        'operating_day',p_operating_day
      )
    );
  end if;

  v_result:=jsonb_build_object(
    'ok',true,
    'reembolso_id',p_reembolso_id,
    'pago_id',p_pago_id,
    'estado','PENDIENTE',
    'importe_comprometido',v_importe,
    'currency_code',v_pago.payment_currency_code
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create or replace function public.abc_cancelar_reembolso(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_reembolso_id uuid,
  p_motivo_cancelacion text,
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
  v_cmd jsonb;
  v_request jsonb;
  v_reembolso public.reembolsos%rowtype;
  v_motivo text:=btrim(coalesce(p_motivo_cancelacion,''));
  v_ids uuid[];
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(
       p_empresa_id,p_local_id,'ABC_REEMBOLSO_CONFIRMAR'
     ) then
    raise exception 'abc_cancelar_reembolso_no_autorizado';
  end if;
  if p_reembolso_id is null or p_operating_day is null then
    raise exception 'cancelacion_reembolso_parametros_requeridos';
  end if;
  if v_motivo='' then raise exception 'motivo_cancelacion_requerido'; end if;

  v_request:=jsonb_build_object(
    'reembolso_id',p_reembolso_id,
    'motivo_cancelacion',v_motivo,
    'terminal_id',p_terminal_id,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_CANCELAR_REEMBOLSO',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select *
    into v_reembolso
    from public.reembolsos
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_reembolso_id
   for update;

  if not found then raise exception 'reembolso_no_encontrado'; end if;
  if v_reembolso.estado<>'PENDIENTE' then
    raise exception 'reembolso_no_cancelable';
  end if;
  if v_reembolso.provider_code is not null
     or v_reembolso.provider_reference is not null then
    raise exception 'reembolso_enviado_a_proveedor';
  end if;

  perform private.abc_abandonar_efecto_dedupe(
    p_empresa_id,
    'reembolso:'||p_reembolso_id::text,
    jsonb_build_object('motivo','REEMBOLSO_CANCELADO_ANTES_DE_ENVIO')
  );

  select array_agg(ra.pago_aplicacion_id order by ra.pago_aplicacion_id)
    into v_ids
    from public.reembolso_aplicaciones ra
   where ra.empresa_id=p_empresa_id
     and ra.local_id=p_local_id
     and ra.reembolso_id=p_reembolso_id;

  if v_ids is null then raise exception 'reembolso_sin_aplicaciones'; end if;
  perform private.abc_bloquear_aplicaciones(
    p_empresa_id,p_local_id,v_ids
  );

  update public.reembolsos
     set estado='CANCELADO',
         resolved_at=now()
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_reembolso_id;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'REEMBOLSO',p_reembolso_id::text,
    'REEMBOLSO_CANCELADO',
    jsonb_build_object(
      'pago_id',v_reembolso.pago_id,
      'importe',v_reembolso.importe_solicitado,
      'motivo_cancelacion',v_motivo
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'reembolso_id',p_reembolso_id,'estado','CANCELADO'
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create or replace function public.abc_resolver_reembolso(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_reembolso_id uuid,
  p_estado text,
  p_provider_code text,
  p_provider_reference text,
  p_provider_snapshot jsonb,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_estado text:=upper(btrim(coalesce(p_estado,'')));
  v_provider text:=nullif(btrim(coalesce(p_provider_code,'')),'');
  v_reference text:=nullif(btrim(coalesce(p_provider_reference,'')),'');
  v_snapshot jsonb:=coalesce(p_provider_snapshot,'{}'::jsonb);
  v_reembolso public.reembolsos%rowtype;
  v_pago public.pagos%rowtype;
  v_terminal_id uuid;
  v_request jsonb;
  v_cmd jsonb;
  v_ids uuid[];
  v_pago_estado text;
  v_result jsonb;
begin
  if p_reembolso_id is null or p_operating_day is null then
    raise exception 'resolucion_reembolso_parametros_requeridos';
  end if;
  if v_estado not in ('CONFIRMADO','RECHAZADO','CANCELADO','DESCONOCIDO') then
    raise exception 'estado_reembolso_invalido';
  end if;
  if v_provider is null or v_reference is null then
    raise exception 'provider_reembolso_requerido';
  end if;

  select *
    into v_reembolso
    from public.reembolsos
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_reembolso_id;
  if not found then raise exception 'reembolso_no_encontrado'; end if;

  select *
    into v_pago
    from public.pagos
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=v_reembolso.pago_id;
  if not found then raise exception 'pago_no_encontrado'; end if;
  if v_pago.medio='EFECTIVO' then
    raise exception 'reembolso_efectivo_usa_confirmacion_local';
  end if;

  select o.terminal_id
    into v_terminal_id
    from public.abc_operaciones o
   where o.operation_id=v_reembolso.abc_command_id;

  v_request:=jsonb_build_object(
    'reembolso_id',p_reembolso_id,
    'estado',v_estado,
    'provider_code',v_provider,
    'provider_reference',v_reference,
    'provider_snapshot',v_snapshot,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar_sistema(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_RESOLVER_REEMBOLSO',v_request,
    v_reembolso.created_by,v_terminal_id,v_provider
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select *
    into v_reembolso
    from public.reembolsos
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_reembolso_id
   for update;

  if not found then raise exception 'reembolso_no_encontrado'; end if;

  select *
    into v_pago
    from public.pagos
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=v_reembolso.pago_id
   for update;

  if not found then raise exception 'pago_no_encontrado'; end if;

  if v_reembolso.estado in ('CONFIRMADO','RECHAZADO','CANCELADO') then
    if v_reembolso.estado=v_estado
       and v_reembolso.provider_code is not distinct from v_provider
       and v_reembolso.provider_reference is not distinct from v_reference then
      v_result:=jsonb_build_object(
        'ok',true,
        'already_resolved',true,
        'reembolso_id',p_reembolso_id,
        'estado',v_estado,
        'pago_estado',v_pago.estado
      );
      perform private.abc_completar_efecto_dedupe(
        p_empresa_id,'reembolso:'||p_reembolso_id::text
      );
      perform private.abc_operacion_completar(p_operation_id,v_result);
      return v_result;
    end if;
    raise exception 'reembolso_ya_resuelto';
  end if;

  if v_reembolso.provider_code is not null
     and (
       v_reembolso.provider_code<>v_provider
       or v_reembolso.provider_reference is distinct from v_reference
     ) then
    raise exception 'provider_reembolso_reference_conflict';
  end if;

  select array_agg(ra.pago_aplicacion_id order by ra.pago_aplicacion_id)
    into v_ids
    from public.reembolso_aplicaciones ra
   where ra.empresa_id=p_empresa_id
     and ra.local_id=p_local_id
     and ra.reembolso_id=p_reembolso_id;

  if v_ids is null then raise exception 'reembolso_sin_aplicaciones'; end if;
  perform private.abc_bloquear_aplicaciones(
    p_empresa_id,p_local_id,v_ids
  );

  if v_estado='DESCONOCIDO' then
    update public.reembolsos
       set estado='DESCONOCIDO',
           provider_code=v_provider,
           provider_reference=v_reference,
           provider_snapshot=v_snapshot,
           resolved_at=null
     where empresa_id=p_empresa_id
       and local_id=p_local_id
       and id=p_reembolso_id;
    v_pago_estado:=v_pago.estado;
  elsif v_estado in ('RECHAZADO','CANCELADO') then
    update public.reembolsos
       set estado=v_estado,
           provider_code=v_provider,
           provider_reference=v_reference,
           provider_snapshot=v_snapshot,
           resolved_at=now()
     where empresa_id=p_empresa_id
       and local_id=p_local_id
       and id=p_reembolso_id;
    v_pago_estado:=v_pago.estado;
  else
    update public.reembolsos
       set estado='CONFIRMADO',
           provider_code=v_provider,
           provider_reference=v_reference,
           provider_snapshot=v_snapshot,
           resolved_at=now()
     where empresa_id=p_empresa_id
       and local_id=p_local_id
       and id=p_reembolso_id;

    v_pago_estado:=private.abc_actualizar_pago_reembolso_estado(
      p_empresa_id,p_local_id,v_reembolso.pago_id
    );
  end if;

  if v_estado in ('CONFIRMADO','RECHAZADO','CANCELADO') then
    perform private.abc_completar_efecto_dedupe(
      p_empresa_id,'reembolso:'||p_reembolso_id::text
    );
  end if;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day,
    executor_kind,executor_ref
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'REEMBOLSO',p_reembolso_id::text,
    'REEMBOLSO_RESUELTO',
    jsonb_build_object(
      'pago_id',v_reembolso.pago_id,
      'estado',v_estado,
      'importe',v_reembolso.importe_solicitado,
      'provider_code',v_provider,
      'provider_reference',v_reference,
      'pago_estado',v_pago_estado
    ),
    v_reembolso.created_by,v_terminal_id,now(),p_operating_day,
    'SYSTEM_PROVIDER',v_provider
  );

  v_result:=jsonb_build_object(
    'ok',true,
    'reembolso_id',p_reembolso_id,
    'estado',v_estado,
    'pago_estado',v_pago_estado
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;


revoke all on function private.abc_encolar_efecto(text,text,text,text,text,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_completar_efecto_dedupe(text,text)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_abandonar_efecto_dedupe(text,text,jsonb)
  from public,anon,authenticated,service_role;

revoke all on function public.abc_reclamar_efectos(text,integer,integer)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_reprogramar_efecto(uuid,text,timestamptz)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_registrar_error_efecto(uuid,text,jsonb,timestamptz)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_completar_efecto(uuid,text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_abandonar_efecto(uuid,text,jsonb)
  from public,anon,authenticated,service_role;

grant execute on function public.abc_reclamar_efectos(text,integer,integer) to service_role;
grant execute on function public.abc_reprogramar_efecto(uuid,text,timestamptz) to service_role;
grant execute on function public.abc_registrar_error_efecto(uuid,text,jsonb,timestamptz) to service_role;
grant execute on function public.abc_completar_efecto(uuid,text) to service_role;
grant execute on function public.abc_abandonar_efecto(uuid,text,jsonb) to service_role;

revoke insert,update,delete,truncate on table public.efectos_pendientes from service_role;
grant select on table public.efectos_pendientes to service_role;
