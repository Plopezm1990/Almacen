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
end $function$;
