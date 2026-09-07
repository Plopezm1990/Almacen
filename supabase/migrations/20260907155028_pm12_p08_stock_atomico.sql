-- PM12 P08 candidate. Local/isolated verification only; no remote deployment.
-- The existing stock_operaciones ledger owns identity and the committed result.
-- No extra operation table or alternate idempotency key is introduced.
grant usage on schema private to authenticated;
do $$
declare t text; expression text;
begin
  foreach t in array array['stock_operaciones','movimientos_stock'] loop
    select pg_get_expr(conbin, conrelid) into expression from pg_constraint
      where conrelid=('public.'||t)::regclass and conname=t||'_tipo_check';
    if expression is null then raise exception 'missing_stock_type_constraint:%',t; end if;
    execute format('alter table public.%I drop constraint %I',t,t||'_tipo_check');
    execute format('alter table public.%I add constraint %I check ((%s) or tipo = %L)',t,t||'_tipo_check',expression,'INVENTARIO_PM12');
  end loop;
end $$;

create unique index if not exists pm12_un_ajuste_por_conteo
  on public.stock_operaciones(empresa_id,local_id,(payload->'intencion'->>'id'))
  where tipo='INVENTARIO_PM12';

create or replace function private.pm12_confirmar_ajuste_stock(
  p_operation_id text, p_empresa_id text, p_local_id text,
  p_intencion jsonb, p_plan jsonb, p_bases jsonb
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  op public.stock_operaciones%rowtype;
  s public.stock_ubicacion%rowtype;
  b jsonb; m jsonb; result jsonb; records jsonb := '[]'::jsonb;
  new_total numeric; new_piso numeric; dt numeric; dp numeric;
  adjusted integer; identity text; intent jsonb; target numeric; ambito text; expected_dt numeric; expected_dp numeric;
begin
  if auth.uid() is null or not coalesce(private.pm07_puede_gestionar_stock(),false) then raise exception 'ajuste_no_autorizado'; end if;
  if p_empresa_id is null or p_local_id is null or lower(p_local_id)='todos'
     or not coalesce(private.la_tiene_empresa(p_empresa_id),false)
     or not coalesce(private.la_tiene_local(p_empresa_id,p_local_id),false) then raise exception 'contexto_no_autorizado'; end if;
  if jsonb_typeof(p_intencion) is distinct from 'object'
     or nullif(p_intencion->>'id','') is null or nullif(p_intencion->>'cerradoEn','') is null
     or p_intencion->>'empresaId' is distinct from p_empresa_id or p_intencion->>'localId' is distinct from p_local_id
     or coalesce(p_intencion->>'estado','') not in ('PARCIAL','COMPLETADO') then raise exception 'conteo_no_ajustable'; end if;
  identity := 'pm12-ajuste-conteo:'||(p_intencion->>'id')||':'||(p_intencion->>'cerradoEn');
  if p_operation_id is distinct from identity then raise exception 'operation_id_conflict'; end if;
  -- The same global lock used by the existing stock RPCs, including cross-ledger checks.
  perform private.pm08_bloquear_operation_id('pm12-conteo:'||p_empresa_id||':'||p_local_id||':'||(p_intencion->>'id'));
  perform private.pm09_bloquear_operation_id_stock(p_operation_id);
  intent := p_intencion - 'ajustesAplicados' - 'ajustesAplicadosEn' - 'ajustesOperationId';
  select * into op from public.stock_operaciones where operation_id=p_operation_id;
  if found then
    if op.tipo <> 'INVENTARIO_PM12' or op.empresa_id <> p_empresa_id or op.local_id <> p_local_id
       or op.payload->'intencion' is distinct from intent then raise exception 'operation_id_conflict'; end if;
    if op.payload->'resultado' is null then raise exception 'replay_parcial_inconsistente'; end if;
    if op.payload->'resultado'->'conteo'->>'estado'='CANCELADO' then raise exception 'conteo_cancelado'; end if;
    return op.payload->'resultado' || jsonb_build_object('replayed',true);
  end if;
  if exists(select 1 from public.stock_operaciones where tipo='INVENTARIO_PM12' and empresa_id=p_empresa_id and local_id=p_local_id and payload->'intencion'->>'id'=intent->>'id') then raise exception 'conteo_ya_procesado'; end if;
  if coalesce((p_intencion->>'ajustesPendientesRevision')::boolean,false) then raise exception 'conteo_legacy_requiere_revision'; end if;
  if jsonb_typeof(p_plan) is distinct from 'array' or jsonb_typeof(p_bases) is distinct from 'array'
     or jsonb_array_length(p_bases)=0 then raise exception 'plan_invalido'; end if;
  if jsonb_typeof(intent->'items') is distinct from 'array' or jsonb_array_length(intent->'items')=0 then raise exception 'conteo_vacio'; end if;
  ambito := coalesce(intent->>'ambito','total');
  if ambito not in ('total','almacen','piso_venta') then raise exception 'ambito_invalido'; end if;
  if exists(select 1 from jsonb_array_elements(p_bases) x where jsonb_typeof(x->'conteo') is distinct from 'number' or (x->>'conteo')::numeric<0
    or not exists(select 1 from jsonb_array_elements(intent->'items') i where i->>'productoId'=x->>'productoId' and i->'conteo'=x->'conteo')) then raise exception 'cantidad_contada_invalida'; end if;
  if (select count(*) from jsonb_array_elements(intent->'items') i where jsonb_typeof(i->'conteo')='number') <> jsonb_array_length(p_bases)
     or (select count(*)<>count(distinct i->>'productoId') from jsonb_array_elements(intent->'items') i) then raise exception 'cobertura_invalida'; end if;
  if exists(select 1 from jsonb_array_elements(intent->'items') i where jsonb_typeof(i->'conteo') not in ('number','null') and coalesce(btrim(i->>'conteo'),'')<>'') then raise exception 'cantidad_contada_invalida'; end if;
  if intent->>'estado'='COMPLETADO' and jsonb_array_length(p_bases)<>jsonb_array_length(intent->'items') then raise exception 'cobertura_invalida'; end if;
  if intent->>'estado'='PARCIAL' and nullif(btrim(intent->>'motivoParcial'),'') is null then raise exception 'motivo_parcial_obligatorio'; end if;
  if (select count(*) <> count(distinct x->>'productoId') from jsonb_array_elements(p_bases) x)
     or (select count(*) <> count(distinct x->>'movimientoId') from jsonb_array_elements(p_plan) x) then raise exception 'identidad_duplicada'; end if;
  if exists(select 1 from jsonb_array_elements(p_plan) x where not exists(select 1 from jsonb_array_elements(p_bases) y where y->>'productoId'=x->>'productoId')) then raise exception 'producto_sin_base'; end if;
  -- Lock all products in a stable order before validating or changing any stock.
  for b in select x from jsonb_array_elements(p_bases) x order by x->>'productoId' loop
    select * into s from public.stock_ubicacion where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=b->>'productoId' for update;
    if not found then raise exception 'stock_no_configurado'; end if;
    if not s.local_operable then raise exception 'local_inactivo'; end if;
    if (b->>'conteo')::numeric>0 then perform private.pm07_validar_cantidad((b->>'conteo')::numeric,s.fraccionable,s.precision_cantidad); end if;
    if (b->>'stock')::numeric is distinct from s.almacen+s.piso
       or (b->>'stockPisoVenta')::numeric is distinct from s.piso
       or coalesce((b->>'deficitPendiente')::numeric,0)<>0 then raise exception 'stock_base_obsoleto'; end if;
  end loop;
  for m in select x from jsonb_array_elements(p_plan) x loop
    if m->>'operationId' is distinct from p_operation_id or m->>'origen' is distinct from 'aplicarAjustes'
       or m->>'documentoOrigenId' is distinct from intent->>'id'
       or m->>'movimientoId' is distinct from p_operation_id||':producto:'||(m->>'productoId')||':'||(m->'camposExtra'->>'pm12PlanLeg')
       or coalesce(m->>'tipo','') not in ('INVENTARIO','TRASPASO_A_PISO')
       or nullif(m->>'cantidad','') is null or m->>'cantidad' in ('NaN','Infinity','-Infinity')
       or (m->>'cantidad')::numeric=0 then raise exception 'movimiento_invalido'; end if;
    if not ((ambito='total' and m->'camposExtra'->>'pm12PlanLeg' in ('inventario-total','total-limite-piso'))
       or (ambito='piso_venta' and m->'camposExtra'->>'pm12PlanLeg'='inventario-piso')
       or (ambito='almacen' and m->'camposExtra'->>'pm12PlanLeg' in ('almacen-falta-a-piso','inventario-almacen','almacen-sobra-a-piso'))) then raise exception 'plan_leg_invalido'; end if;
    select * into s from public.stock_ubicacion where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=m->>'productoId';
    perform private.pm07_validar_cantidad(abs((m->>'cantidad')::numeric),s.fraccionable,s.precision_cantidad);
  end loop;
  -- Register the existing identity within this transaction. Any subsequent error rolls it back too.
  insert into public.stock_operaciones(operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id)
    values(p_operation_id,'INVENTARIO_PM12',p_empresa_id,p_local_id,'__CONTEO__',jsonb_build_object('intencion',intent,'plan',p_plan),auth.uid());
  for b in select x from jsonb_array_elements(p_bases) x order by x->>'productoId' loop
    select * into s from public.stock_ubicacion where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=b->>'productoId';
    select coalesce(sum(case when coalesce((x->>'afectaStockTotal')::boolean,true) then (x->>'cantidad')::numeric else 0 end),0),
           coalesce(sum(case when coalesce((x->>'afectaStockPisoVenta')::boolean,false) then (x->>'cantidad')::numeric else 0 end),0)
      into dt,dp from jsonb_array_elements(p_plan) x where x->>'productoId'=s.producto_id;
    new_total := s.almacen+s.piso+dt; new_piso := s.piso+dp;
    target := (b->>'conteo')::numeric;
    if ambito='total' then expected_dt:=target-(s.almacen+s.piso);expected_dp:=least(0,target-s.piso);
    elsif ambito='piso_venta' then expected_dt:=target-s.piso;expected_dp:=expected_dt;
    else expected_dt:=greatest(0,target-s.almacen);expected_dp:=abs(target-s.almacen);end if;
    if dt<>expected_dt or dp<>expected_dp then raise exception 'plan_no_coincide_con_conteo'; end if;
    if new_total<0 or new_piso<0 or new_piso>new_total then raise exception 'saldo_invalido'; end if;
    update public.stock_ubicacion set almacen=new_total-new_piso,piso=new_piso,updated_at=now()
      where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=s.producto_id;
  end loop;
  for m in select x from jsonb_array_elements(p_plan) x loop
    dt := case when coalesce((m->>'afectaStockTotal')::boolean,true) then (m->>'cantidad')::numeric else 0 end;
    dp := case when coalesce((m->>'afectaStockPisoVenta')::boolean,false) then (m->>'cantidad')::numeric else 0 end;
    insert into public.movimientos_stock(operation_id,tipo,empresa_id,local_id,producto_id,delta_almacen,delta_piso,delta_total,cantidad,datos,actor_user_id)
      values(p_operation_id,'INVENTARIO_PM12',p_empresa_id,p_local_id,m->>'productoId',dt-dp,dp,dt,abs((m->>'cantidad')::numeric),m,auth.uid());
    records := records || jsonb_build_array(m || jsonb_build_object('id',m->>'movimientoId'));
  end loop;
  select count(distinct x->>'productoId') into adjusted from jsonb_array_elements(p_plan) x;
  result := jsonb_build_object('ok',true,'replayed',false,'operationId',p_operation_id,'ajustados',adjusted,'movimientos',records,
    'traspasados',coalesce(p_plan->0->'camposExtra'->'pm12Resultado'->'traspasados','[]'::jsonb),
    'conteo',intent||jsonb_build_object('ajustesAplicados',true,'ajustesAplicadosEn',now(),'ajustesOperationId',p_operation_id,'ajustesCantidad',adjusted,'ajustesActor',jsonb_build_object('id',auth.uid(),'rol',private.la_rol()),'ajustesEmpresaId',p_empresa_id,'ajustesLocalId',p_local_id));
  update public.stock_operaciones set payload=payload||jsonb_build_object('resultado',result) where operation_id=p_operation_id;
  return result;
end $$;

revoke all on function private.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb) from public,anon;
grant execute on function private.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb) to authenticated;

create or replace function public.pm12_confirmar_ajuste_stock(
  p_operation_id text,p_empresa_id text,p_local_id text,p_intencion jsonb,p_plan jsonb,p_bases jsonb
) returns jsonb language sql security invoker set search_path=''
as $$ select private.pm12_confirmar_ajuste_stock(p_operation_id,p_empresa_id,p_local_id,p_intencion,p_plan,p_bases); $$;
revoke all on function public.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb) to authenticated;

create or replace function private.pm12_cancelar_conteo_stock(p_empresa_id text,p_local_id text,p_conteo jsonb,p_cancelacion jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  original public.stock_operaciones%rowtype; previous public.stock_operaciones%rowtype;
  s public.stock_ubicacion%rowtype; rec record; m public.movimientos_stock%rowtype;
  original_id text; cancel_id text; corte text; reverse_id text; result jsonb; document jsonb;
  reversos jsonb := '[]'::jsonb; datos jsonb;
begin
  if auth.uid() is null or not coalesce(private.la_usuario_activo(),false) then raise exception 'cancelacion_no_autorizada'; end if;
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
end $$;
revoke all on function private.pm12_cancelar_conteo_stock(text,text,jsonb,jsonb) from public,anon;
grant execute on function private.pm12_cancelar_conteo_stock(text,text,jsonb,jsonb) to authenticated;
create or replace function public.pm12_cancelar_conteo_stock(p_empresa_id text,p_local_id text,p_conteo jsonb,p_cancelacion jsonb)
returns jsonb language sql security invoker set search_path='' as $$select private.pm12_cancelar_conteo_stock(p_empresa_id,p_local_id,p_conteo,p_cancelacion);$$;
revoke all on function public.pm12_cancelar_conteo_stock(text,text,jsonb,jsonb) from public,anon;
grant execute on function public.pm12_cancelar_conteo_stock(text,text,jsonb,jsonb) to authenticated;
