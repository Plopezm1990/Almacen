-- ABC F3 A10 — completa la recuperación cuando ya existe una comanda del envío
-- para la estación destino: fusiona líneas, actualiza el outbox y evita duplicados.

create or replace function private.abc_a10_reencolar_bloqueadas(
  p_empresa_id text,
  p_local_id text,
  p_producto_id text,
  p_estacion_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_comanda_id uuid;
  v_destino_id uuid;
  v_destino_estado text;
  v_ids uuid[]:=array[]::uuid[];
begin
  if nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or nullif(btrim(coalesce(p_producto_id,'')),'') is null
     or p_estacion_id is null then
    return jsonb_build_object('count',0,'ids','[]'::jsonb);
  end if;

  for v_comanda_id in
    select c.id
      from public.comandas_preparacion c
      join public.comanda_lineas cl on cl.comanda_id=c.id
     where c.empresa_id=p_empresa_id
       and c.local_id=p_local_id
       and c.estacion_id is null
       and c.estado='BLOQUEADA'
       and c.route_key='SIN_RUTA'
       and cl.empresa_id=p_empresa_id
       and cl.local_id=p_local_id
       and cl.producto_id=p_producto_id
     group by c.id
    having count(*) filter (
      where cl.producto_id is distinct from p_producto_id
    )=0
     order by min(c.created_at),c.id
  loop
    /* The send operation may already have another route-specific command. */
    select c.id,c.estado
      into v_destino_id,v_destino_estado
      from public.comandas_preparacion c
     where c.empresa_id=p_empresa_id
       and c.local_id=p_local_id
       and c.operation_id=(
         select source.operation_id
           from public.comandas_preparacion source
          where source.id=v_comanda_id
       )
       and c.route_key=p_estacion_id::text
       and c.tipo=(
         select source.tipo
           from public.comandas_preparacion source
          where source.id=v_comanda_id
       )
     for update;

    if v_destino_id is null then
      update public.comandas_preparacion
         set estacion_id=p_estacion_id,
             route_key=p_estacion_id::text,
             estado='PENDIENTE',
             version=version+1
       where id=v_comanda_id
         and empresa_id=p_empresa_id
         and local_id=p_local_id
         and estacion_id is null
         and estado='BLOQUEADA';

      if found then
        perform private.abc_a10_encolar_comanda(v_comanda_id);
        v_ids:=array_append(v_ids,v_comanda_id);
      end if;
    elsif v_destino_estado='PENDIENTE' then
      /*
       * Keep the existing route-specific command and move only the line rows.
       * This preserves one kitchen command per send operation and route.
       */
      update public.comanda_lineas
         set comanda_id=v_destino_id
       where comanda_id=v_comanda_id;

      update public.comandas_preparacion
         set version=version+1
       where id=v_destino_id;

      delete from public.comandas_preparacion
       where id=v_comanda_id;

      /* Refresh the already-created outbox payload, then let the normal
       * idempotent enqueue helper retain or create the single effect. */
      update public.efectos_pendientes ep
         set payload=payload.data,
             next_attempt_at=case when ep.estado='ERROR' then now() else ep.next_attempt_at end,
             last_error=case when ep.estado='ERROR' then null else ep.last_error end
        from (
          select c.id,
                 jsonb_build_object(
                   'comanda_id',c.id,
                   'pedido_id',c.pedido_id,
                   'estacion_id',c.estacion_id,
                   'tipo',c.tipo,
                   'lineas',coalesce(jsonb_agg(
                     jsonb_build_object(
                       'linea_id',cl.linea_id,
                       'accion',cl.accion,
                       'estado_anterior',cl.estado_anterior,
                       'estado_objetivo',cl.estado_objetivo,
                       'linea_version',cl.linea_version,
                       'producto_id',cl.producto_id,
                       'cantidad',cl.cantidad,
                       'nota',cl.nota,
                       'decision_merma',cl.decision_merma,
                       'snapshot',cl.snapshot
                     ) order by cl.id
                   ),'[]'::jsonb)
                 ) as data
            from public.comandas_preparacion c
            left join public.comanda_lineas cl on cl.comanda_id=c.id
           where c.id=v_destino_id
           group by c.id,c.pedido_id,c.estacion_id,c.tipo
        ) payload
       where ep.empresa_id=p_empresa_id
         and ep.dedupe_key='comanda:'||v_destino_id::text
         and ep.estado in ('PENDIENTE','ERROR');

      perform private.abc_a10_encolar_comanda(v_destino_id);
      if not v_destino_id=any(v_ids) then
        v_ids:=array_append(v_ids,v_destino_id);
      end if;
    end if;

    v_destino_id:=null;
    v_destino_estado:=null;
  end loop;

  return jsonb_build_object(
    'count',cardinality(v_ids),
    'ids',to_jsonb(v_ids)
  );
end $$;

revoke all on function private.abc_a10_reencolar_bloqueadas(text,text,text,uuid)
  from public,anon,authenticated,service_role;
