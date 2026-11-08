-- A-02 — Al saldar la cuenta, su venta fiscal queda cerrada y sellada.
--
-- `ventas_fiscales` admite ABIERTA / BLOQUEADA / CERRADA / CANCELADA y tiene
-- una restricción, `abc_venta_lock`, que exige `locked_at` cuando el estado es
-- CERRADA o BLOQUEADA. El esquema preveía el sello de inmutabilidad, pero
-- **nada lo usaba**: medido el 2026-11-08, ninguna función ni disparador
-- escribía `ventas_fiscales.estado` ni `locked_at` en ningún entorno. Las 14
-- funciones que mencionan la tabla solo la leen; las 9 que tocan `locked_at`
-- lo hacen sobre `efectos_pendientes`, que es otra tabla.
--
-- Resultado en los datos: producción 8 ventas, las 8 ABIERTA, 0 selladas;
-- QA 61 ventas, las 61 ABIERTA, 0 selladas — incluidas las cobradas ese mismo
-- día con la cuenta ya cerrada.
--
-- El informe de auditoría lo atribuía a un cierre manual que nadie pulsaba.
-- La revisión del 8-nov lo corrige: `abc_cerrar_cuenta_pagada` cierra los
-- pedidos y la cuenta, y lee las ventas fiscales para cuadrar importes, pero
-- nunca las escribe. No era un botón sin pulsar: no había ningún camino.
--
-- Esta migración cierra y sella la venta fiscal en el mismo punto en que la
-- cuenta se da por saldada, que es cuando el importe ya está confirmado: la
-- propia función exige `abs(v_total-v_confirmado)<=0.000001` antes de llegar
-- aquí.
--
-- Qué NO hace: no impide modificar una venta sellada. Hoy ningún código lee
-- `locked_at` de `ventas_fiscales`, así que el sello es un hecho registrado,
-- no una barrera. Hacerlo cumplir es un paso aparte, que debe decidirse
-- mirando devoluciones y rectificativas.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

do $preflight$
declare
  v_falta text[] := array[]::text[];
begin
  if to_regclass('public.ventas_fiscales') is null then v_falta := v_falta || 'public.ventas_fiscales'::text; end if;
  if to_regclass('public.cuentas_comerciales') is null then v_falta := v_falta || 'public.cuentas_comerciales'::text; end if;
  if to_regclass('public.checkout_ventas') is null then v_falta := v_falta || 'public.checkout_ventas'::text; end if;
  if array_length(v_falta, 1) is not null then
    raise exception 'a02_preflight_faltan_objetos: %', array_to_string(v_falta, ', ');
  end if;
end
$preflight$;

create or replace function public.abc_cerrar_cuenta_pagada(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid,
  p_checkout_id uuid,
  p_expected_cuenta_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cmd jsonb;
  v_request jsonb;
  v_result jsonb;
  v_cuenta public.cuentas_comerciales%rowtype;
  v_checkout public.checkouts%rowtype;
  v_total numeric(24,8) := 0;
  v_confirmado numeric(24,8) := 0;
  v_pedidos_cerrados integer := 0;
  v_ventas_selladas integer := 0;
  v_pedido record;
  v_pedido_ids uuid[] := array[]::uuid[];
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'cuenta_cierre_no_autorizado';
  end if;
  if nullif(btrim(coalesce(p_operation_id,'')),'') is null
     or p_empresa_id is null or p_local_id is null or p_cuenta_id is null
     or p_checkout_id is null or p_expected_cuenta_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'cuenta_cierre_parametros_requeridos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  v_request := jsonb_build_object(
    'cuenta_id',p_cuenta_id,
    'checkout_id',p_checkout_id,
    'expected_cuenta_version',p_expected_cuenta_version,
    'terminal_id',p_terminal_id,
    'session_id',p_session_id,
    'operating_day',p_operating_day
  );
  v_cmd := private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CERRAR_CUENTA_PAGADA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select * into v_cuenta
    from public.cuentas_comerciales
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_id
   for update;
  if not found then raise exception 'cuenta_no_encontrada'; end if;
  if v_cuenta.estado='CERRADA' then raise exception 'cuenta_ya_cerrada'; end if;
  if v_cuenta.estado<>'ABIERTA' then raise exception 'cuenta_no_cerrable'; end if;
  if v_cuenta.version<>p_expected_cuenta_version then raise exception 'cuenta_version_conflict'; end if;

  select * into v_checkout
    from public.checkouts
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_checkout_id
     and cuenta_id=p_cuenta_id and estado='COMPLETADO'
   for update;
  if not found then raise exception 'checkout_no_completado'; end if;
  if v_checkout.operating_day<>p_operating_day then raise exception 'operating_day_checkout_inconsistente'; end if;

  if exists(
    select 1 from public.checkouts c
     where c.empresa_id=p_empresa_id and c.local_id=p_local_id
       and c.cuenta_id=p_cuenta_id and c.estado in ('ABIERTO','EN_COBRO')
  ) then
    raise exception 'cuenta_checkout_abierto';
  end if;
  if not exists(
    select 1 from public.checkout_ventas cv
     where cv.empresa_id=p_empresa_id and cv.local_id=p_local_id
       and cv.checkout_id=p_checkout_id
  ) then
    raise exception 'checkout_sin_ventas';
  end if;

  select coalesce(sum(v.total),0)::numeric(24,8)
    into v_total
    from public.ventas_fiscales v
   where v.empresa_id=p_empresa_id and v.local_id=p_local_id
     and v.cuenta_id=p_cuenta_id and v.estado<>'CANCELADA';
  select coalesce(sum(a.sale_amount),0)::numeric(24,8)
    into v_confirmado
    from public.pago_aplicaciones a
    join public.pago_intentos i
      on i.empresa_id=a.empresa_id and i.local_id=a.local_id and i.id=a.intento_id
    join public.ventas_fiscales v
      on v.empresa_id=a.empresa_id and v.local_id=a.local_id and v.id=a.venta_fiscal_id
   where a.empresa_id=p_empresa_id and a.local_id=p_local_id
     and v.cuenta_id=p_cuenta_id and v.estado<>'CANCELADA' and i.estado='CONFIRMADO';
  if v_total<=0 then raise exception 'cuenta_sin_importe_cobrable'; end if;
  if abs(v_total-v_confirmado)>0.000001 then raise exception 'cuenta_saldo_pendiente'; end if;

  if exists(
    select 1 from public.pagos p
     where p.empresa_id=p_empresa_id and p.local_id=p_local_id
       and p.checkout_id=p_checkout_id
       and p.estado not in ('CONFIRMADO','REEMBOLSADO')
  ) then
    raise exception 'cuenta_pago_no_resuelto';
  end if;
  if exists(
    select 1
      from public.reservas_saldo r
      join public.checkout_ventas cv
        on cv.empresa_id=r.empresa_id and cv.local_id=r.local_id and cv.id=r.checkout_venta_id
     where r.empresa_id=p_empresa_id and r.local_id=p_local_id
       and cv.checkout_id=p_checkout_id and r.estado='ACTIVA'
  ) then
    raise exception 'cuenta_reserva_saldo_activa';
  end if;
  if to_regclass('public.abc_cobro_incidencias') is not null and exists(
    select 1
      from public.abc_cobro_incidencias i
      join public.pago_intentos pi
        on pi.empresa_id=i.empresa_id and pi.local_id=i.local_id and pi.id=i.intento_id
      join public.pagos p
        on p.empresa_id=pi.empresa_id and p.local_id=pi.local_id and p.id=pi.pago_id
      join public.checkouts c
        on c.empresa_id=p.empresa_id and c.local_id=p.local_id and c.id=p.checkout_id
     where i.empresa_id=p_empresa_id and i.local_id=p_local_id
       and c.cuenta_id=p_cuenta_id and i.estado='ABIERTA'
  ) then
    raise exception 'cuenta_incidencia_cobro_abierta';
  end if;

  for v_pedido in
    select p.*
      from public.pedidos_tpv p
     where p.empresa_id=p_empresa_id and p.local_id=p_local_id and p.cuenta_id=p_cuenta_id
     order by p.created_at,p.id
     for update
  loop
    if v_pedido.estado not in ('SERVIDO','CERRADO','CANCELADO') then
      raise exception 'cuenta_pedido_no_cerrable';
    end if;
    if v_pedido.estado='SERVIDO' then
      update public.pedidos_tpv
         set estado='CERRADO',closed_at=now(),version=version+1
       where empresa_id=p_empresa_id and local_id=p_local_id and id=v_pedido.id;
      perform private.abc_registrar_transicion_pedido(
        p_empresa_id,p_local_id,v_pedido.id,p_operation_id,
        v_pedido.estado,'CERRADO',null,auth.uid(),p_terminal_id,p_session_id,
        p_operating_day,jsonb_build_object('cierre','CUENTA_PAGADA','checkout_id',p_checkout_id)
      );
      v_pedidos_cerrados:=v_pedidos_cerrados+1;
      v_pedido_ids:=array_append(v_pedido_ids,v_pedido.id);
    end if;
  end loop;

  update public.cuentas_comerciales
     set estado='CERRADA',closed_at=now(),version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_id
  returning version into v_cuenta.version;

  -- A-02: cerrar y sellar la venta fiscal de la cuenta. Hasta ahora nada en
  -- la base escribía `ventas_fiscales.estado` ni `locked_at`: toda venta
  -- quedaba ABIERTA para siempre, aunque estuviera cobrada y su cuenta
  -- cerrada. Se acota por cuenta, igual que el cálculo de importes de más
  -- arriba, y solo toca las ABIERTA, así que repetir el cierre es inocuo.
  update public.ventas_fiscales
     set estado='CERRADA',locked_at=now(),version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id
     and cuenta_id=p_cuenta_id and estado='ABIERTA';
  get diagnostics v_ventas_selladas = row_count;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CUENTA',p_cuenta_id::text,
    'CUENTA_CERRADA_PAGADA',
    jsonb_build_object(
      'checkout_id',p_checkout_id,
      'importe_total',v_total,
      'importe_confirmado',v_confirmado,
      'cuenta_version',v_cuenta.version,
      'pedidos_cerrados',v_pedidos_cerrados,'ventas_selladas',v_ventas_selladas,
      'pedido_ids',to_jsonb(v_pedido_ids)
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'replayed',false,'cuenta_id',p_cuenta_id,
    'checkout_id',p_checkout_id,'estado','CERRADA',
    'cuenta_version',v_cuenta.version,'closed_at',now(),
    'importe_total',v_total,'importe_confirmado',v_confirmado,
    'pedidos_cerrados',v_pedidos_cerrados,'ventas_selladas',v_ventas_selladas
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin
    perform private.abc_operacion_fallar(
      p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)
    );
  exception when others then null; end;
  raise;
end $$;

revoke all on function public.abc_cerrar_cuenta_pagada(text,text,text,uuid,uuid,bigint,uuid,uuid,date)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_cerrar_cuenta_pagada(text,text,text,uuid,uuid,bigint,uuid,uuid,date)
  to authenticated;

commit;
