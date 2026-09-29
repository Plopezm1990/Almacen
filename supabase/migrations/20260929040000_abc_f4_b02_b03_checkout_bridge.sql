-- ABC F4 B02/B03 — puente de cuenta/pedido al checkout de cobro.
-- Aditiva. No integra adquirentes reales, no emite documentos fiscales y no almacena datos de tarjeta.
-- Reutiliza la autoridad F2 (checkout/pagos/reservas/outbox) y respeta repartos A08 por producto.
-- Las cuotas A08 por importe quedan fail-closed hasta B05 para no fabricar una imputación fiscal ambigua.

do $$
declare
  v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.cuentas_comerciales') is null then v_missing:=array_append(v_missing,'cuentas_comerciales'); end if;
  if to_regclass('public.pedidos_tpv') is null then v_missing:=array_append(v_missing,'pedidos_tpv'); end if;
  if to_regclass('public.pedido_lineas') is null then v_missing:=array_append(v_missing,'pedido_lineas'); end if;
  if to_regclass('public.ventas_fiscales') is null then v_missing:=array_append(v_missing,'ventas_fiscales'); end if;
  if to_regclass('public.venta_fiscal_lineas') is null then v_missing:=array_append(v_missing,'venta_fiscal_lineas'); end if;
  if to_regclass('public.checkouts') is null then v_missing:=array_append(v_missing,'checkouts'); end if;
  if to_regclass('public.checkout_ventas') is null then v_missing:=array_append(v_missing,'checkout_ventas'); end if;
  if to_regclass('public.cuenta_linea_repartos') is null then v_missing:=array_append(v_missing,'cuenta_linea_repartos'); end if;
  if to_regclass('public.cuenta_cuotas_importe') is null then v_missing:=array_append(v_missing,'cuenta_cuotas_importe'); end if;
  if to_regprocedure('public.abc_abrir_checkout(text,text,text,uuid,uuid,uuid[],date)') is null then v_missing:=array_append(v_missing,'abc_abrir_checkout'); end if;
  if to_regprocedure('private.abc_terminal_sesion_operativa(text,text,uuid,uuid)') is null then v_missing:=array_append(v_missing,'abc_terminal_sesion_operativa'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F4_B02_B03_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
  if to_regprocedure('private.abc_f4_lineas_cobrables_cuenta(text,text,uuid)') is not null
     or to_regprocedure('public.abc_preparar_checkout_cuenta(text,text,text,uuid,uuid,bigint,uuid,uuid,date)') is not null then
    raise exception 'ABC_F4_B02_B03_PREFLIGHT_FALLO: objetos F4 B02/B03 ya existen';
  end if;
end $$;

create function private.abc_f4_lineas_cobrables_cuenta(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid
)
returns table(
  source_line_id uuid,
  pedido_id uuid,
  pedido_estado text,
  producto_id text,
  linea_estado text,
  entidad_fiscal_id uuid,
  currency_code text,
  cantidad numeric,
  precio_unitario numeric,
  descuento numeric,
  base numeric,
  impuesto numeric,
  total numeric,
  snapshot jsonb
)
language sql
stable
security definer
set search_path=''
as $$
  select
    l.id,
    l.pedido_id,
    p.estado,
    l.producto_id,
    l.estado,
    l.entidad_fiscal_id,
    l.currency_code,
    r.cantidad,
    l.precio_unitario,
    r.descuento,
    r.base,
    r.impuestos,
    r.total,
    coalesce(l.snapshot_calculo,'{}'::jsonb)
      || jsonb_build_object(
        'modo_f4','REPARTO_A08',
        'reparto_id',r.id,
        'reparto_version',r.version,
        'cuenta_reparto_id',r.cuenta_id,
        'comensal_ref',r.comensal_ref
      )
  from public.cuenta_linea_repartos r
  join public.pedido_lineas l
    on l.empresa_id=r.empresa_id
   and l.local_id=r.local_id
   and l.id=r.source_line_id
  join public.pedidos_tpv p
    on p.empresa_id=l.empresa_id
   and p.local_id=l.local_id
   and p.id=l.pedido_id
  where r.empresa_id=$1
    and r.local_id=$2
    and r.cuenta_id=$3
    and r.estado='ACTIVO'
    and l.estado<>'CANCELADA'
    and p.estado<>'CANCELADO'

  union all

  select
    l.id,
    l.pedido_id,
    p.estado,
    l.producto_id,
    l.estado,
    l.entidad_fiscal_id,
    l.currency_code,
    l.cantidad,
    l.precio_unitario,
    l.descuento_total,
    l.base,
    l.impuestos,
    l.total,
    coalesce(l.snapshot_calculo,'{}'::jsonb)
      || jsonb_build_object(
        'modo_f4','LINEA_ORIGINAL',
        'cuenta_reparto_id',p.cuenta_id
      )
  from public.pedido_lineas l
  join public.pedidos_tpv p
    on p.empresa_id=l.empresa_id
   and p.local_id=l.local_id
   and p.id=l.pedido_id
  where p.empresa_id=$1
    and p.local_id=$2
    and p.cuenta_id=$3
    and p.estado<>'CANCELADO'
    and l.estado<>'CANCELADA'
    and not exists(
      select 1
      from public.cuenta_linea_repartos r
      where r.empresa_id=l.empresa_id
        and r.local_id=l.local_id
        and r.source_line_id=l.id
        and r.estado='ACTIVO'
    )
$$;

create function public.abc_preparar_checkout_cuenta(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_checkout_id uuid,
  p_cuenta_id uuid,
  p_expected_cuenta_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
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
  v_cuenta public.cuentas_comerciales%rowtype;
  v_checkout_id uuid;
  v_active integer;
  v_line_count integer;
  v_invalid integer;
  v_current_fp jsonb;
  v_existing_fp jsonb;
  v_venta_ids uuid[];
  v_venta_id uuid;
  v_total numeric(24,8);
  v_open jsonb;
  v_result jsonb;
  r record;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR') then
    raise exception 'abc_cobro_no_autorizado';
  end if;
  if p_operation_id is null or nullif(btrim(p_operation_id),'') is null
     or p_checkout_id is null or p_cuenta_id is null
     or p_expected_cuenta_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'checkout_preparar_parametros_requeridos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  v_request:=jsonb_build_object(
    'checkout_id',p_checkout_id,
    'cuenta_id',p_cuenta_id,
    'expected_cuenta_version',p_expected_cuenta_version,
    'terminal_id',p_terminal_id,
    'session_id',p_session_id,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_PREPARAR_CHECKOUT_CUENTA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select *
    into v_cuenta
    from public.cuentas_comerciales c
   where c.empresa_id=p_empresa_id
     and c.local_id=p_local_id
     and c.id=p_cuenta_id
   for update;
  if not found then raise exception 'cuenta_no_encontrada'; end if;
  if v_cuenta.estado<>'ABIERTA' then raise exception 'cuenta_no_abierta_o_no_encontrada'; end if;
  if v_cuenta.version<>p_expected_cuenta_version then raise exception 'cuenta_version_conflict'; end if;
  if v_cuenta.opened_operating_day<>p_operating_day then raise exception 'operating_day_cuenta_inconsistente'; end if;

  if exists(
    select 1
    from public.cuenta_cuotas_importe q
    where q.empresa_id=p_empresa_id
      and q.local_id=p_local_id
      and q.estado='ACTIVA'
      and (q.cuenta_origen_id=p_cuenta_id or q.cuenta_destino_id=p_cuenta_id)
  ) then
    raise exception 'checkout_cuotas_importe_pendiente_b05';
  end if;

  select count(*),
         count(*) filter (
           where x.pedido_estado not in ('ENVIADO','SERVIDO','CERRADO')
              or x.linea_estado not in ('CONFIRMADA','ENVIADA','EN_PREPARACION','PREPARADA','SERVIDA')
              or x.entidad_fiscal_id is null
              or x.currency_code is null
              or x.precio_unitario is null
              or x.descuento is null
              or x.base is null
              or x.impuesto is null
              or x.total is null
              or x.cantidad is null
              or x.cantidad<=0
              or x.descuento<0
              or x.base<0
              or x.impuesto<0
              or x.total<0
         )
    into v_line_count,v_invalid
    from private.abc_f4_lineas_cobrables_cuenta(p_empresa_id,p_local_id,p_cuenta_id) x;

  if v_line_count=0 then raise exception 'cuenta_sin_lineas_cobrables'; end if;
  if v_invalid>0 then raise exception 'pedido_lineas_no_cobrables'; end if;

  if exists(
    select 1
    from private.abc_f4_lineas_cobrables_cuenta(p_empresa_id,p_local_id,p_cuenta_id) x
    where x.currency_code<>v_cuenta.currency_code
  ) then
    raise exception 'checkout_moneda_inconsistente';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'source_line_id',x.source_line_id,
      'entidad_fiscal_id',x.entidad_fiscal_id,
      'currency_code',x.currency_code,
      'cantidad',x.cantidad,
      'precio_unitario',x.precio_unitario,
      'descuento',x.descuento,
      'base',x.base,
      'impuesto',x.impuesto,
      'total',x.total
    )
    order by x.source_line_id
  )
    into v_current_fp
    from private.abc_f4_lineas_cobrables_cuenta(p_empresa_id,p_local_id,p_cuenta_id) x;

  select count(*),(array_agg(c.id))[1]
    into v_active,v_checkout_id
    from public.checkouts c
   where c.empresa_id=p_empresa_id
     and c.local_id=p_local_id
     and c.cuenta_id=p_cuenta_id
     and c.estado in ('ABIERTO','EN_COBRO');

  if v_active>1 then raise exception 'checkout_cuenta_ambigua'; end if;

  if v_active=1 then
    select jsonb_agg(
      jsonb_build_object(
        'source_line_id',fl.source_line_id,
        'entidad_fiscal_id',fl.entidad_fiscal_id,
        'currency_code',fl.currency_code,
        'cantidad',fl.cantidad,
        'precio_unitario',fl.precio_unitario,
        'descuento',fl.descuento,
        'base',fl.base,
        'impuesto',fl.impuesto,
        'total',fl.total
      )
      order by fl.source_line_id
    )
      into v_existing_fp
      from public.checkout_ventas cv
      join public.venta_fiscal_lineas fl
        on fl.empresa_id=cv.empresa_id
       and fl.local_id=cv.local_id
       and fl.venta_fiscal_id=cv.venta_fiscal_id
     where cv.empresa_id=p_empresa_id
       and cv.local_id=p_local_id
       and cv.checkout_id=v_checkout_id;

    if v_existing_fp is distinct from v_current_fp then
      raise exception 'checkout_cuenta_modificada';
    end if;

    select array_agg(cv.venta_fiscal_id order by cv.venta_fiscal_id),
           coalesce(sum(cv.importe_objetivo),0)::numeric(24,8)
      into v_venta_ids,v_total
      from public.checkout_ventas cv
     where cv.empresa_id=p_empresa_id
       and cv.local_id=p_local_id
       and cv.checkout_id=v_checkout_id;

    v_result:=jsonb_build_object(
      'ok',true,
      'reused',true,
      'checkout_id',v_checkout_id,
      'venta_ids',to_jsonb(v_venta_ids),
      'currency_code',v_cuenta.currency_code,
      'estado','ABIERTO',
      'total',v_total
    );
    perform private.abc_operacion_completar(p_operation_id,v_result);
    return v_result;
  end if;

  if exists(
    select 1
    from public.ventas_fiscales v
    where v.empresa_id=p_empresa_id
      and v.local_id=p_local_id
      and v.cuenta_id=p_cuenta_id
      and v.estado<>'CANCELADA'
  ) then
    raise exception 'cuenta_ya_fiscalizada_sin_checkout';
  end if;

  v_venta_ids:=array[]::uuid[];
  for r in
    select
      x.entidad_fiscal_id,
      x.currency_code,
      sum(x.base+x.descuento)::numeric(24,8) subtotal,
      sum(x.descuento)::numeric(24,8) descuento,
      sum(x.impuesto)::numeric(24,8) impuestos,
      sum(x.total)::numeric(24,8) total
    from private.abc_f4_lineas_cobrables_cuenta(p_empresa_id,p_local_id,p_cuenta_id) x
    group by x.entidad_fiscal_id,x.currency_code
    order by x.entidad_fiscal_id
  loop
    v_venta_id:=gen_random_uuid();
    insert into public.ventas_fiscales(
      id,empresa_id,local_id,cuenta_id,entidad_fiscal_id,currency_code,
      estado,version,subtotal,descuento_total,impuestos_total,total,
      snapshot_calculo,created_by,created_operating_day
    ) values (
      v_venta_id,p_empresa_id,p_local_id,p_cuenta_id,r.entidad_fiscal_id,r.currency_code,
      'ABIERTA',1,r.subtotal,r.descuento,r.impuestos,r.total,
      jsonb_build_object(
        'modo','F4_B02_B03_CHECKOUT_SNAPSHOT',
        'operation_id',p_operation_id,
        'sin_documento_fiscal',true
      ),
      auth.uid(),p_operating_day
    );

    insert into public.venta_fiscal_lineas(
      id,empresa_id,local_id,venta_fiscal_id,source_line_id,entidad_fiscal_id,currency_code,
      cantidad,precio_unitario,descuento,base,impuesto,total,snapshot
    )
    select
      gen_random_uuid(),p_empresa_id,p_local_id,v_venta_id,x.source_line_id,
      x.entidad_fiscal_id,x.currency_code,x.cantidad,x.precio_unitario,
      x.descuento,x.base,x.impuesto,x.total,
      x.snapshot || jsonb_build_object('f4_checkout_operation_id',p_operation_id)
    from private.abc_f4_lineas_cobrables_cuenta(p_empresa_id,p_local_id,p_cuenta_id) x
    where x.entidad_fiscal_id=r.entidad_fiscal_id
      and x.currency_code=r.currency_code;

    v_venta_ids:=array_append(v_venta_ids,v_venta_id);
  end loop;

  select coalesce(sum(x.total),0)::numeric(24,8)
    into v_total
    from private.abc_f4_lineas_cobrables_cuenta(p_empresa_id,p_local_id,p_cuenta_id) x;
  if v_total<=0 then raise exception 'cuenta_sin_saldo_cobrable'; end if;

  v_open:=public.abc_abrir_checkout(
    p_operation_id||':open',
    p_empresa_id,p_local_id,p_checkout_id,p_cuenta_id,v_venta_ids,p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,
    'reused',false,
    'checkout_id',p_checkout_id,
    'venta_ids',to_jsonb(v_venta_ids),
    'currency_code',v_cuenta.currency_code,
    'estado',coalesce(v_open->>'estado','ABIERTO'),
    'total',v_total
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

revoke all on function private.abc_f4_lineas_cobrables_cuenta(text,text,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_preparar_checkout_cuenta(
  text,text,text,uuid,uuid,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;
grant execute on function public.abc_preparar_checkout_cuenta(
  text,text,text,uuid,uuid,bigint,uuid,uuid,date
) to authenticated;
