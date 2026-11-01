-- ABC F3 A10 — la RPC de asignación no recupera comandas históricas.
--
-- QA tenía una versión posterior de abc_asignar_producto_estacion que llamaba
-- a private.abc_a10_reencolar_bloqueadas desde la propia RPC. Retirar el
-- trigger no era suficiente: la asignación seguía moviendo comandas antiguas
-- a PENDIENTE y las volvía a encolar.
--
-- Esta definición conserva la autoridad de servidor, la idempotencia y la
-- auditoría de la asignación, pero limita su efecto a la ruta de producto.

create or replace function public.abc_asignar_producto_estacion(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_producto_id text,
  p_estacion_id uuid,
  p_prioridad smallint,
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
  v_producto text:=btrim(coalesce(p_producto_id,''));
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
begin
  if not private.abc_a10_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COMANDA_CONFIGURAR') then
    raise exception 'comanda_configurar_no_autorizado';
  end if;
  if v_producto='' or p_estacion_id is null or p_prioridad is null or p_prioridad<1 or p_prioridad>100
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'producto_estacion_parametros_invalidos';
  end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id,p_local_id,p_terminal_id,p_session_id) then
    raise exception 'terminal_sesion_no_operativa';
  end if;
  if not exists(
    select 1 from public.catalogo_tpv_productos c
     where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.producto_id=v_producto and c.activo=true
  ) then raise exception 'producto_tpv_no_disponible'; end if;
  if not exists(
    select 1 from public.tpv_estaciones_preparacion e
     where e.empresa_id=p_empresa_id and e.local_id=p_local_id and e.id=p_estacion_id and e.activo=true
  ) then raise exception 'estacion_no_operativa'; end if;

  v_request:=jsonb_build_object('producto_id',v_producto,'estacion_id',p_estacion_id,'prioridad',p_prioridad);
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_ASIGNAR_PRODUCTO_ESTACION',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  update public.tpv_producto_estaciones
     set activo=false,version=version+1,updated_at=now()
   where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=v_producto
     and activo=true and estacion_id<>p_estacion_id;

  insert into public.tpv_producto_estaciones(
    empresa_id,local_id,producto_id,estacion_id,prioridad,activo,version,created_by
  ) values (
    p_empresa_id,p_local_id,v_producto,p_estacion_id,p_prioridad,true,1,auth.uid()
  )
  on conflict (empresa_id,local_id,producto_id,estacion_id)
  do update set prioridad=excluded.prioridad,activo=true,
                version=public.tpv_producto_estaciones.version+1,updated_at=now();

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'RUTA_PREPARACION',v_producto,
    'PRODUCTO_ESTACION_ASIGNADA',
    jsonb_build_object('producto_id',v_producto,'estacion_id',p_estacion_id,'prioridad',p_prioridad,'session_id',p_session_id),
    auth.uid(),p_terminal_id,clock_timestamp(),p_operating_day
  );

  v_result:=jsonb_build_object('ok',true,'producto_id',v_producto,'estacion_id',p_estacion_id);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

drop function if exists private.abc_a10_reencolar_bloqueadas(
  text,text,text,uuid
);
