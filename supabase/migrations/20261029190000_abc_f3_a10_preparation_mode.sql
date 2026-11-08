-- ABC F3 A10 · modo de preparación por producto (QA)
-- Un producto vendible puede requerir cocina/preparación o ser venta directa.
-- Compatibilidad conservadora: los productos existentes y los payloads antiguos
-- quedan con requiere_preparacion=true.

alter table public.catalogo_tpv_productos
  add column if not exists requiere_preparacion boolean not null default true;

create index if not exists abc_catalogo_preparacion_idx
  on public.catalogo_tpv_productos(empresa_id,local_id,requiere_preparacion,activo,producto_id);

create or replace function private.abc_a10_requiere_preparacion(
  p_empresa_id text,
  p_local_id text,
  p_producto_id text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select coalesce((
    select c.requiere_preparacion
      from public.catalogo_tpv_productos c
     where c.empresa_id=$1
       and c.local_id=$2
       and c.producto_id=$3
       and c.currency_code='EUR'
       and c.activo=true
     limit 1
  ),true)
$$;

create or replace function public.abc_catalogo_guardar_productos(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_currency_code text,
  p_productos jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_currency text:=upper(btrim(coalesce(p_currency_code,'')));
  v_n integer;
  v_ef_count integer;
  v_ef uuid;
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
  v_item jsonb;
  v_out jsonb:='[]'::jsonb;
  v_seen text[]:=array[]::text[];
  v_id text;
  v_loc text;
  v_emp text;
  v_nombre text;
  v_unidad text;
  v_tipo text;
  v_activo boolean;
  v_vendible boolean;
  v_requiere_preparacion boolean;
  v_frac boolean;
  v_prec integer;
  v_precio numeric;
  v_iva numeric;
  v_base numeric(24,8);
  v_stock numeric;
  v_piso numeric;
  v_minimo numeric;
  v_row public.catalogo_tpv_productos%rowtype;
  v_found boolean;
  v_rc integer;
  v_snapshot jsonb;
  v_estado text;
  v_motivo text;
  v_version bigint;
  c_creados integer:=0;
  c_actualizados integer:=0;
  c_sin_cambios integer:=0;
  c_desactivados integer:=0;
  c_omitidos integer:=0;
  c_stock integer:=0;
  v_espejo jsonb:='{}'::jsonb;
  v_patch jsonb;
  v_kv jsonb;
  v_kv_nuevo jsonb;
  v_lista text;
begin
  if auth.uid() is null
     or not private.abc_catalogo_puede_gestionar(p_empresa_id,p_local_id) then
    raise exception 'abc_catalogo_no_autorizado';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'moneda_catalogo_invalida'; end if;
  if p_productos is null or jsonb_typeof(p_productos)<>'array' then
    raise exception 'catalogo_productos_formato_invalido';
  end if;
  v_n:=jsonb_array_length(p_productos);
  if v_n=0 then raise exception 'catalogo_productos_vacio'; end if;
  if v_n>200 then raise exception 'catalogo_productos_demasiados'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_productos) e where jsonb_typeof(e)<>'object'
  ) then
    raise exception 'catalogo_producto_formato_invalido';
  end if;

  -- Contexto fiscal ya vinculado al local: exactamente uno activo con la moneda activa.
  select count(*), min(efl.entidad_fiscal_id::text)::uuid
    into v_ef_count, v_ef
    from public.entidad_fiscal_locales efl
    join public.entidades_fiscales ef
      on ef.empresa_id=efl.empresa_id and ef.id=efl.entidad_fiscal_id and ef.activa=true
    join public.entidad_fiscal_local_monedas elm
      on elm.empresa_id=efl.empresa_id and elm.local_id=efl.local_id
     and elm.entidad_fiscal_id=efl.entidad_fiscal_id
     and elm.currency_code=v_currency and elm.activa=true
   where efl.empresa_id=p_empresa_id
     and efl.local_id=p_local_id
     and efl.activa=true;
  if v_ef_count=0 then raise exception 'catalogo_contexto_fiscal_ausente'; end if;
  if v_ef_count>1 then raise exception 'catalogo_contexto_fiscal_ambiguo'; end if;

  v_request:=jsonb_build_object('currency_code',v_currency,'productos',p_productos);
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CATALOGO_GUARDAR_PRODUCTOS',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  -- Orden estable por id para que dos sincronizaciones simultaneas no se bloqueen entre si.
  for v_item in
    select e from jsonb_array_elements(p_productos) e order by e->>'id'
  loop
    v_estado:=null; v_motivo:=null; v_version:=null;
    v_id:=nullif(btrim(coalesce(v_item->>'id','')),'');
    v_loc:=nullif(btrim(coalesce(v_item->>'localId','')),'');
    v_emp:=nullif(btrim(coalesce(v_item->>'empresaId','')),'');

    if v_id is null or length(v_id)>200 then
      v_estado:='OMITIDO'; v_motivo:='id_invalido';
    elsif v_id=any(v_seen) then
      v_estado:='OMITIDO'; v_motivo:='id_duplicado';
    elsif v_emp is not null and v_emp<>p_empresa_id then
      v_estado:='OMITIDO'; v_motivo:='empresa_distinta';
    elsif v_loc is null then
      v_estado:='OMITIDO'; v_motivo:='sin_local';
    elsif v_loc<>p_local_id then
      v_estado:='OMITIDO'; v_motivo:='local_distinto';
    end if;
    if v_id is not null and not (v_id=any(v_seen)) then v_seen:=array_append(v_seen,v_id); end if;

    if v_estado is null then
      v_nombre:=nullif(btrim(coalesce(v_item->>'nombre','')),'');
      v_unidad:=coalesce(nullif(btrim(coalesce(v_item->>'unidad','')),''),'ud');
      v_tipo:=lower(btrim(coalesce(v_item->>'tipo','')));
      v_activo:=lower(btrim(coalesce(v_item->>'activo','true'))) not in ('false','f','0');
      v_frac:=lower(btrim(coalesce(v_item->>'fraccionable','false'))) in ('true','t','1');
      v_prec:=case
        when v_frac then least(6,greatest(0,coalesce(round(private.abc_catalogo_numero(v_item->>'precisionCantidad'))::integer,0)))
        else 0 end;
      v_vendible:=false;
      if v_activo then
        v_precio:=case
          when btrim(coalesce(v_item->>'precioVenta','')) = '' then 0
          else private.abc_catalogo_numero(v_item->>'precioVenta') end;
        v_iva:=round(private.abc_catalogo_numero(v_item->>'ivaVenta'),4);
        v_vendible:=(v_tipo='elaborado' or coalesce(v_precio,0)>0);
        v_requiere_preparacion:=lower(btrim(coalesce(
          nullif(v_item->>'requierePreparacion',''),
          nullif(v_item->>'requiere_preparacion',''),
          'true'
        ))) not in ('false','f','0');
        if v_precio is null then
          v_estado:='OMITIDO'; v_motivo:='precio_invalido';
        elsif v_vendible and (v_iva is null or v_iva>100) then
          v_estado:='OMITIDO'; v_motivo:='iva_invalido';
        end if;
      end if;
    end if;

    if v_estado is null then
      select * into v_row
        from public.catalogo_tpv_productos c
       where c.empresa_id=p_empresa_id and c.local_id=p_local_id
         and c.producto_id=v_id and c.currency_code=v_currency
       for update;
      v_found:=found;

      if not v_activo or not v_vendible then
        if v_found and v_row.activo then
          update public.catalogo_tpv_productos
             set activo=false, version=version+1, updated_at=now()
           where empresa_id=p_empresa_id and local_id=p_local_id
             and producto_id=v_id and currency_code=v_currency
          returning version into v_version;
          v_estado:='DESACTIVADO'; c_desactivados:=c_desactivados+1;
        elsif v_found then
          v_estado:='SIN_CAMBIOS'; v_version:=v_row.version; c_sin_cambios:=c_sin_cambios+1;
        else
          v_estado:='OMITIDO';
          v_motivo:=case when not v_activo then 'inactivo' else 'no_vendible' end;
        end if;
      elsif v_nombre is null then
        v_estado:='OMITIDO'; v_motivo:='nombre_requerido';
      else
        v_base:=round(v_precio/(1+v_iva/100),8);
        v_snapshot:=jsonb_build_object(
          'origen','ABC_P3_GUARDAR_PRODUCTOS',
          'operation_id',p_operation_id,
          'codigo',nullif(btrim(coalesce(v_item->>'codigo','')),''),
          'categoria',nullif(btrim(coalesce(v_item->>'categoria','')),''),
          'requiere_preparacion',v_requiere_preparacion
        );
        if not v_found then
          insert into public.catalogo_tpv_productos(
            empresa_id,local_id,producto_id,currency_code,entidad_fiscal_id,
            nombre,unidad,fraccionable,precision_cantidad,
            precio_unitario,precio_con_impuesto,impuesto_pct,requiere_preparacion,activo,version,snapshot_origen
          ) values (
            p_empresa_id,p_local_id,v_id,v_currency,v_ef,
            v_nombre,v_unidad,v_frac,v_prec,
            v_base,round(v_precio,8),v_iva,v_requiere_preparacion,true,1,v_snapshot
          );
          v_estado:='CREADO'; v_version:=1; c_creados:=c_creados+1;
        elsif v_row.nombre is distinct from v_nombre
           or v_row.unidad is distinct from v_unidad
           or v_row.fraccionable is distinct from v_frac
           or v_row.precision_cantidad::integer is distinct from v_prec
           or v_row.precio_con_impuesto is distinct from round(v_precio,8)
           or v_row.precio_unitario is distinct from v_base
           or v_row.impuesto_pct is distinct from v_iva
           or v_row.requiere_preparacion is distinct from v_requiere_preparacion
           or v_row.activo is distinct from true then
          update public.catalogo_tpv_productos
             set nombre=v_nombre, unidad=v_unidad, fraccionable=v_frac,
                 precision_cantidad=v_prec, precio_unitario=v_base,
                 precio_con_impuesto=round(v_precio,8), impuesto_pct=v_iva,
                 requiere_preparacion=v_requiere_preparacion,
                 activo=true, version=version+1, snapshot_origen=v_snapshot,
                 updated_at=now()
           where empresa_id=p_empresa_id and local_id=p_local_id
             and producto_id=v_id and currency_code=v_currency
          returning version into v_version;
          v_estado:='ACTUALIZADO'; c_actualizados:=c_actualizados+1;
        else
          v_estado:='SIN_CAMBIOS'; v_version:=v_row.version; c_sin_cambios:=c_sin_cambios+1;
        end if;

        -- Stock inicial solo si no existe fila: el stock vivo es del motor PM07.
        v_stock:=coalesce(private.abc_catalogo_numero(v_item->>'stock'),0);
        v_piso:=least(v_stock,coalesce(private.abc_catalogo_numero(v_item->>'stockPisoVenta'),0));
        v_minimo:=coalesce(private.abc_catalogo_numero(v_item->>'stockMinimo'),0);
        insert into public.stock_ubicacion(
          empresa_id,local_id,producto_id,almacen,piso,minimo,
          fraccionable,precision_cantidad,local_operable,unidad
        ) values (
          p_empresa_id,p_local_id,v_id,v_stock-v_piso,v_piso,v_minimo,
          v_frac,v_prec,true,v_unidad
        ) on conflict (empresa_id,local_id,producto_id) do nothing;
        get diagnostics v_rc = row_count;
        if v_rc>0 then c_stock:=c_stock+1; end if;
      end if;
    end if;

    -- Espejo (P3b): lo que el servidor acepta de cada producto recibido se refleja, solo en los
    -- campos de venta, en la copia de la lista heredada (bloque posterior al bucle).
    if v_estado is not null and v_estado<>'OMITIDO' then
      if v_activo then
        v_patch:=jsonb_strip_nulls(jsonb_build_object(
          'nombre',v_nombre,'unidad',v_unidad,'fraccionable',v_frac,
          'precioVenta',trim_scale(round(v_precio,8)),'ivaVenta',trim_scale(v_iva),
          'requierePreparacion',v_requiere_preparacion
        ));
        if v_frac then
          v_patch:=v_patch||jsonb_build_object('precisionCantidad',v_prec);
        end if;
        if v_item ? 'activo' then v_patch:=v_patch||jsonb_build_object('activo',true); end if;
      else
        v_patch:=jsonb_build_object('activo',false);
      end if;
      v_espejo:=v_espejo||jsonb_build_object(v_id,v_patch);
    end if;

    if v_estado='OMITIDO' then c_omitidos:=c_omitidos+1; end if;
    v_out:=v_out||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'id',v_id,'resultado',v_estado,'motivo',v_motivo,'version',v_version
    )));
  end loop;

  -- Espejo (P3b): la pantalla recarga la lista heredada de almacen_kv, y en QA la propia pantalla
  -- no puede escribirla (PM05). Sin este paso, tras recargar volvería el precio antiguo mientras el
  -- servidor cobra el nuevo. Solo se tocan, dentro de la fila `productos` de la empresa, los
  -- elementos recibidos de este local y solo sus campos de venta; no se crean ni se borran
  -- elementos, y el stock, el coste y el resto de campos no se modifican.
  v_lista:='sin_productos';
  if v_espejo<>'{}'::jsonb then
    v_lista:='sin_fila';
    select k.value into v_kv
      from public.almacen_kv k
     where k.key='productos' and k.empresa_id=p_empresa_id and jsonb_typeof(k.value)='array'
       for update;
    if found then
      select coalesce(jsonb_agg(
               case when v_espejo ? (t.e->>'id')
                     and coalesce(nullif(btrim(coalesce(t.e->>'localId','')),''),p_local_id)=p_local_id
                    then t.e||(v_espejo->(t.e->>'id'))
                    else t.e end
               order by t.ord),'[]'::jsonb)
        into v_kv_nuevo
        from jsonb_array_elements(v_kv) with ordinality as t(e,ord);
      if v_kv_nuevo is distinct from v_kv then
        update public.almacen_kv set value=v_kv_nuevo, updated_at=now() where key='productos';
        v_lista:='actualizada';
      else
        v_lista:='sin_cambios';
      end if;
    end if;
  end if;

  v_result:=jsonb_build_object(
    'ok',true,
    'currency_code',v_currency,
    'resumen',jsonb_build_object(
      'creados',c_creados,'actualizados',c_actualizados,'sin_cambios',c_sin_cambios,
      'desactivados',c_desactivados,'omitidos',c_omitidos,'stock_inicial_creado',c_stock
    ),
    'productos',v_out,
    'lista_nube',v_lista
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;


create or replace function private.abc_a10_procesar_transiciones_linea()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  g record;
  v_comanda_id uuid;
begin
  for g in
    with routed as (
      select n.empresa_id,n.local_id,n.operation_id,n.pedido_id,n.linea_id,
             n.estado_anterior,n.estado_nuevo,n.actor_user_id,
             l.producto_id,l.cantidad,l.version,
             private.abc_a10_estacion_producto(n.empresa_id,n.local_id,l.producto_id) estacion_id,
             private.abc_a10_snapshot_linea(n.empresa_id,n.local_id,n.linea_id) snapshot
        from a10_new_transitions n
        join public.pedido_lineas l
          on l.empresa_id=n.empresa_id and l.local_id=n.local_id and l.id=n.linea_id
       where n.estado_nuevo in ('ENVIADA','CANCELADA')
         and private.abc_a10_requiere_preparacion(n.empresa_id,n.local_id,l.producto_id)
    )
    select empresa_id,local_id,operation_id,pedido_id,actor_user_id,estacion_id,
           case when estado_nuevo='ENVIADA' then 'NUEVA' else 'CANCELACION' end tipo,
           coalesce(estacion_id::text,'SIN_RUTA') route_key
      from routed
     group by empresa_id,local_id,operation_id,pedido_id,actor_user_id,estacion_id,
              case when estado_nuevo='ENVIADA' then 'NUEVA' else 'CANCELACION' end
  loop
    insert into public.comandas_preparacion(
      empresa_id,local_id,pedido_id,estacion_id,operation_id,tipo,route_key,
      estado,version,created_by
    ) values (
      g.empresa_id,g.local_id,g.pedido_id,g.estacion_id,g.operation_id,g.tipo,g.route_key,
      case when g.estacion_id is null then 'BLOQUEADA' else 'PENDIENTE' end,
      1,g.actor_user_id
    )
    on conflict (empresa_id,operation_id,route_key,tipo) do nothing
    returning id into v_comanda_id;

    if v_comanda_id is null then
      select id into v_comanda_id
        from public.comandas_preparacion
       where empresa_id=g.empresa_id
         and operation_id=g.operation_id
         and route_key=g.route_key
         and tipo=g.tipo;
    end if;

    insert into public.comanda_lineas(
      empresa_id,local_id,comanda_id,pedido_id,linea_id,accion,
      estado_anterior,estado_objetivo,linea_version,producto_id,cantidad,
      nota,decision_merma,snapshot
    )
    select r.empresa_id,r.local_id,v_comanda_id,r.pedido_id,r.linea_id,
           case when r.estado_nuevo='ENVIADA' then 'ALTA' else 'CANCELACION' end,
           r.estado_anterior,r.estado_nuevo,r.version,r.producto_id,r.cantidad,
           null,
           case when r.estado_nuevo='CANCELADA' and r.estado_anterior='PREPARADA'
                then 'PENDIENTE' else 'NO_APLICA' end,
           r.snapshot
      from (
        select n.empresa_id,n.local_id,n.operation_id,n.pedido_id,n.linea_id,
               n.estado_anterior,n.estado_nuevo,
               l.producto_id,l.cantidad,l.version,
               private.abc_a10_estacion_producto(n.empresa_id,n.local_id,l.producto_id) estacion_id,
               private.abc_a10_snapshot_linea(n.empresa_id,n.local_id,n.linea_id) snapshot
          from a10_new_transitions n
          join public.pedido_lineas l
            on l.empresa_id=n.empresa_id and l.local_id=n.local_id and l.id=n.linea_id
         where n.estado_nuevo in ('ENVIADA','CANCELADA')
           and private.abc_a10_requiere_preparacion(n.empresa_id,n.local_id,l.producto_id)
      ) r
     where r.empresa_id=g.empresa_id and r.local_id=g.local_id
       and r.operation_id=g.operation_id and r.pedido_id=g.pedido_id
       and r.estacion_id is not distinct from g.estacion_id
       and (case when r.estado_nuevo='ENVIADA' then 'NUEVA' else 'CANCELACION' end)=g.tipo
    on conflict (comanda_id,linea_id,accion) do nothing;

    perform private.abc_a10_encolar_comanda(v_comanda_id);
  end loop;

  return null;
end $$;


