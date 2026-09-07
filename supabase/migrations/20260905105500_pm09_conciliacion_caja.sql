-- PM09 / Punto 10: conciliacion de Caja.
-- Objetivo: en clientes PM09, la parte de efectivo procedente de ventas se
-- recalcula en servidor desde movimientos_stock. El efectivo de fuentes que
-- aun no tienen ledger propio (p.ej. cobros de encargos legacy) llega separado
-- como efectivoOtros dentro de snapshot.pm09Caja.
-- Compatibilidad: clientes PM08 sin snapshot.pm09Caja mantienen el contrato
-- anterior, para no romper Deploy Previews heredados sobre la misma QA.

create or replace function private.pm09_resumen_caja_ventas(
  p_empresa_id text,
  p_local_id text,
  p_fecha date
) returns jsonb
language sql
stable
security definer
set search_path = public, auth, private, pg_temp
as $$
with mov as (
  select
    m.tipo,
    abs(coalesce(m.cantidad,0))::numeric as cantidad,
    coalesce(nullif(upper(btrim(m.datos->>'medioPago')),''),'EFECTIVO') as medio,
    case when coalesce(m.datos->>'ingresoUnitario','') ~ '^-?[0-9]+([.][0-9]+)?$'
      then abs((m.datos->>'ingresoUnitario')::numeric) else 0 end as ingreso_unitario,
    case when coalesce(m.datos->>'ivaVentaAplicado','') ~ '^-?[0-9]+([.][0-9]+)?$'
      then (m.datos->>'ivaVentaAplicado')::numeric else 0 end as iva,
    case when coalesce(m.datos->'detallePago'->>'efectivo','') ~ '^-?[0-9]+([.][0-9]+)?$'
      then abs((m.datos->'detallePago'->>'efectivo')::numeric) else 0 end as mixto_efectivo,
    case when coalesce(m.datos->'detallePago'->>'tarjeta','') ~ '^-?[0-9]+([.][0-9]+)?$'
      then abs((m.datos->'detallePago'->>'tarjeta')::numeric) else 0 end as mixto_tarjeta
  from public.movimientos_stock m
  where m.empresa_id=p_empresa_id
    and m.local_id=p_local_id
    and timezone('UTC',m.created_at)::date=p_fecha
    and m.tipo in ('VENTA','REVERSO')
), calc as (
  select
    tipo,
    case when medio='MIXTO' then mixto_efectivo
         when medio='EFECTIVO' then cantidad*ingreso_unitario*(1+iva/100)
         else 0 end as efectivo,
    case when medio='MIXTO' then mixto_tarjeta
         when medio='TARJETA' then cantidad*ingreso_unitario*(1+iva/100)
         else 0 end as tarjeta,
    case when medio='TRANSFERENCIA' then cantidad*ingreso_unitario*(1+iva/100) else 0 end as transferencia,
    case when medio not in ('EFECTIVO','TARJETA','TRANSFERENCIA','MIXTO') then cantidad*ingreso_unitario*(1+iva/100) else 0 end as otro
  from mov
)
select jsonb_build_object(
  'ventasEfectivo', round(coalesce(sum(case when tipo='VENTA' then efectivo else 0 end),0),2),
  'ventasTarjeta', round(coalesce(sum(case when tipo='VENTA' then tarjeta else 0 end),0),2),
  'ventasTransferencia', round(coalesce(sum(case when tipo='VENTA' then transferencia else 0 end),0),2),
  'ventasOtro', round(coalesce(sum(case when tipo='VENTA' then otro else 0 end),0),2),
  'reversosEfectivo', -round(coalesce(sum(case when tipo='REVERSO' then efectivo else 0 end),0),2),
  'reversosTarjeta', -round(coalesce(sum(case when tipo='REVERSO' then tarjeta else 0 end),0),2),
  'reversosTransferencia', -round(coalesce(sum(case when tipo='REVERSO' then transferencia else 0 end),0),2),
  'reversosOtro', -round(coalesce(sum(case when tipo='REVERSO' then otro else 0 end),0),2)
)
from calc;
$$;

revoke all on function private.pm09_resumen_caja_ventas(text,text,date) from public, anon, authenticated;

create or replace function public.registrar_arqueo_caja(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_fecha date,
  p_efectivo_base numeric,
  p_efectivo_contado numeric,
  p_notas text default null,
  p_snapshot jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, auth, private, pg_temp
as $$
declare
  v_operation_id text;
  v_base_declarado numeric;
  v_base numeric;
  v_contado numeric;
  v_efectos numeric;
  v_esperado numeric;
  v_notas text;
  v_snapshot jsonb;
  v_payload jsonb;
  v_existente public.arqueos_caja%rowtype;
  v_nuevo public.arqueos_caja%rowtype;
  v_pm09 boolean := false;
  v_resumen_ventas jsonb := '{}'::jsonb;
  v_ventas_efectivo numeric := 0;
  v_reversos_efectivo numeric := 0;
  v_efectivo_otros numeric := 0;
begin
  if auth.uid() is null or not private.pm08_puede_operar_caja() then
    raise exception 'arqueo_no_autorizado';
  end if;
  if p_empresa_id is null or p_local_id is null
     or not private.la_tiene_empresa(p_empresa_id)
     or not private.la_tiene_local(p_empresa_id,p_local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if p_fecha is null then raise exception 'fecha_requerida'; end if;

  v_operation_id := private.pm08_validar_operation_id(p_operation_id);
  v_base_declarado := private.pm08_validar_dinero(p_efectivo_base,true,false);
  v_contado := private.pm08_validar_dinero(p_efectivo_contado,true,false);
  v_notas := left(btrim(coalesce(p_notas,'')),1000);
  v_snapshot := private.pm08_validar_json_objeto(p_snapshot,32768);

  v_pm09 := jsonb_typeof(v_snapshot->'pm09Caja')='object';
  if v_pm09 then
    if coalesce(v_snapshot->'pm09Caja'->>'efectivoOtros','') !~ '^-?[0-9]+([.][0-9]+)?$' then
      raise exception 'efectivo_otros_invalido';
    end if;
    v_efectivo_otros := private.pm08_validar_dinero((v_snapshot->'pm09Caja'->>'efectivoOtros')::numeric,true,false);
    v_resumen_ventas := private.pm09_resumen_caja_ventas(p_empresa_id,p_local_id,p_fecha);
    v_ventas_efectivo := coalesce((v_resumen_ventas->>'ventasEfectivo')::numeric,0);
    v_reversos_efectivo := coalesce((v_resumen_ventas->>'reversosEfectivo')::numeric,0);
    v_base := private.pm08_validar_dinero(v_ventas_efectivo+v_efectivo_otros,true,false);
  else
    -- Compatibilidad estricta con PM08: la base completa sigue siendo la declarada.
    v_base := v_base_declarado;
  end if;

  v_payload := jsonb_build_object(
    'empresaId',p_empresa_id,'localId',p_local_id,'fecha',p_fecha,'alcance','DIA',
    'efectivoBase',v_base_declarado,'efectivoContado',v_contado,'notas',v_notas,
    'snapshot',v_snapshot
  );

  perform private.pm08_bloquear_operation_id(v_operation_id);
  select * into v_existente from public.arqueos_caja where operation_id=v_operation_id;
  if found then
    if v_existente.payload=v_payload then
      return jsonb_build_object('ok',true,'replayed',true,'arqueo',to_jsonb(v_existente));
    end if;
    raise exception 'operation_id_conflict';
  end if;
  if exists(select 1 from public.caja_operaciones where operation_id=v_operation_id)
     or exists(select 1 from public.stock_operaciones where operation_id=v_operation_id)
     or exists(select 1 from public.arqueos_caja_anulaciones where operation_id=v_operation_id) then
    raise exception 'operation_id_conflict';
  end if;
  if not private.pm08_local_operable(p_empresa_id,p_local_id) then raise exception 'local_inactivo'; end if;
  if exists(
    select 1 from public.arqueos_caja
     where empresa_id=p_empresa_id and local_id=p_local_id and fecha=p_fecha and estado='ACTIVO'
  ) then raise exception 'arqueo_ya_existe'; end if;

  select round(coalesce(sum(efecto_efectivo),0),2)
    into v_efectos
    from public.caja_operaciones
   where empresa_id=p_empresa_id and local_id=p_local_id and fecha=p_fecha;

  -- En PM09 las anulaciones completas de venta se obtienen del ledger de stock
  -- y se aplican en la fecha del REVERSO. Las devoluciones cliente NO entran aqui:
  -- sus reembolsos ya viven en caja_operaciones y se sumarían dos veces.
  v_esperado := private.pm08_validar_dinero(v_base+v_reversos_efectivo+v_efectos,true,true);

  begin
    insert into public.arqueos_caja(
      operation_id,empresa_id,local_id,fecha,alcance,efectivo_base,
      efectivo_esperado,efectivo_contado,diferencia,notas,snapshot,payload,
      estado,actor_user_id
    ) values (
      v_operation_id,p_empresa_id,p_local_id,p_fecha,'DIA',v_base,
      v_esperado,v_contado,v_contado-v_esperado,v_notas,
      v_snapshot,v_payload,'ACTIVO',auth.uid()
    ) returning * into v_nuevo;
  exception when unique_violation then
    raise exception 'arqueo_ya_existe';
  end;

  return jsonb_build_object(
    'ok',true,'replayed',false,'arqueo',to_jsonb(v_nuevo),'efectosCaja',v_efectos,
    'modoPm09',v_pm09,'resumenVentasCaja',v_resumen_ventas,
    'efectivoBaseDeclarado',v_base_declarado,'efectivoOtrosDeclarado',v_efectivo_otros,
    'ajustesVentaEfectivo',v_reversos_efectivo
  );
end;
$$;
