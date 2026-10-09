-- Copia literal (pg_get_functiondef) de public.abc_productos_guardar_lista de QA
-- (proyecto qjqorixtkilwsndqayyx, paquete P3c, 2026-10-09). Solo sirve de ejemplo real para la
-- prueba de la fase 4 de plataforma: el paquete P3c no tiene fuente en este repositorio.
CREATE OR REPLACE FUNCTION public.abc_productos_guardar_lista(p_operation_id text, p_base jsonb, p_nuevo jsonb, p_venta jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_base jsonb:=coalesce(p_base,'[]'::jsonb);
  v_actual jsonb;
  v_fusion jsonb;
  v_lista_empresa text;
  v_item jsonb;
  v_previo jsonb;
  v_remoto jsonb;
  v_final jsonb;
  v_id text;
  v_empresa text;
  v_local text;
  v_campo text;
  v_antes jsonb;
  v_despues jsonb;
  v_en_nube jsonb;
  v_pos bigint;
  v_cambios integer:=0;
  v_venta jsonb:=coalesce(p_venta,'[]'::jsonb);
  v_venta_autorizada boolean;
  v_solicitado jsonb;
  v_grupo record;
  v_grupo_n integer:=0;
  v_rpc jsonb;
begin
  if v_actor is null then raise exception 'abc_productos_no_autorizado' using errcode='42501'; end if;
  if p_operation_id is null or length(p_operation_id)<8 or length(p_operation_id)>150 then
    raise exception 'abc_productos_operation_id_invalido';
  end if;
  if jsonb_typeof(v_base)<>'array' or jsonb_typeof(p_nuevo)<>'array'
     or jsonb_typeof(v_venta)<>'array'
     or jsonb_array_length(v_base)>2000 or jsonb_array_length(p_nuevo)>2000
     or jsonb_array_length(v_venta)>200 then
    raise exception 'abc_productos_lista_invalida';
  end if;
  if exists (select 1 from jsonb_array_elements(v_base) e
              where jsonb_typeof(e)<>'object'
                 or nullif(btrim(coalesce(e->>'id','')),'') is null)
     or exists (select 1 from jsonb_array_elements(p_nuevo) e
                  where jsonb_typeof(e)<>'object'
                     or nullif(btrim(coalesce(e->>'id','')),'') is null)
     or (select count(*) from jsonb_array_elements(v_base))
         <> (select count(distinct e->>'id') from jsonb_array_elements(v_base) e)
     or (select count(*) from jsonb_array_elements(p_nuevo))
         <> (select count(distinct e->>'id') from jsonb_array_elements(p_nuevo) e)
     or exists (select 1 from jsonb_array_elements(v_venta) e
                  where jsonb_typeof(e)<>'object'
                     or nullif(btrim(coalesce(e->>'id','')),'') is null
                     or not exists (select 1 from jsonb_array_elements(p_nuevo) n
                                      where n->>'id'=e->>'id'))
     or (select count(*) from jsonb_array_elements(v_venta))
         <> (select count(distinct e->>'id') from jsonb_array_elements(v_venta) e) then
    raise exception 'abc_productos_ids_invalidos';
  end if;

  select k.value,k.empresa_id into v_actual,v_lista_empresa
    from public.almacen_kv k where k.key='productos' for update;
  if not found or jsonb_typeof(v_actual)<>'array' then
    raise exception 'abc_productos_lista_nube_ausente';
  end if;
  if exists (select 1 from jsonb_array_elements(v_actual) e
              where jsonb_typeof(e)<>'object'
                 or nullif(btrim(coalesce(e->>'id','')),'') is null)
     or (select count(*) from jsonb_array_elements(v_actual))
         <> (select count(distinct e->>'id') from jsonb_array_elements(v_actual) e) then
    raise exception 'abc_productos_lista_nube_invalida';
  end if;
  -- Esta RPC es SECURITY DEFINER: incluso una llamada sin cambios podría
  -- obtener la lista completa. Exigir pertenencia a la empresa de la fila y
  -- rechazar cualquier lista que mezcle empresas antes de devolverla.
  if v_lista_empresa is null
     or not exists (
       select 1 from public.membresias_usuario m
        where m.user_id=v_actor and m.empresa_id=v_lista_empresa and m.activo=true
     )
     or exists (
       select 1 from jsonb_array_elements(v_actual) e
        where coalesce(e->>'empresaId',v_lista_empresa)<>v_lista_empresa
     ) then
    raise exception 'abc_productos_no_autorizado' using errcode='42501';
  end if;
  v_fusion:=v_actual;

  -- La aplicación borra lógicamente (activo=false). Una ausencia física en el
  -- payload no borra productos de otro dispositivo ni del catálogo.
  if exists (
    select 1 from jsonb_array_elements(v_base) b
    where not exists (select 1 from jsonb_array_elements(p_nuevo) n
                       where n->>'id'=b->>'id')
  ) then
    raise exception 'abc_productos_borrado_fisico_no_admitido';
  end if;

  for v_item in select e from jsonb_array_elements(p_nuevo) e order by e->>'id' loop
    v_id:=v_item->>'id';
    select e into v_previo from jsonb_array_elements(v_base) e where e->>'id'=v_id;
    select e,ord into v_remoto,v_pos
      from jsonb_array_elements(v_fusion) with ordinality as t(e,ord)
     where e->>'id'=v_id;
    select e into v_solicitado from jsonb_array_elements(v_venta) e where e->>'id'=v_id;
    v_venta_autorizada:=v_solicitado is not null;
    if v_venta_autorizada and exists (
      select 1 from unnest(array[
        'nombre','unidad','fraccionable','precisionCantidad',
        'precioVenta','ivaVenta','activo','tipo','localId'
      ]) as x(campo) where v_solicitado->x.campo is distinct from v_item->x.campo
    ) then
      raise exception 'abc_productos_venta_no_coincide:%',v_id;
    end if;

    if v_previo is null then
      if v_remoto is not null then
        if v_remoto is distinct from v_item then
          raise exception 'abc_productos_conflicto_alta:%',v_id;
        end if;
        continue;
      end if;
      v_final:=v_item;
    elsif v_remoto is null then
      raise exception 'abc_productos_conflicto_ausente:%',v_id;
    else
      v_final:=v_remoto;
      for v_campo in
        select x.campo from jsonb_object_keys(v_previo||v_item) as x(campo) order by x.campo
      loop
        if v_campo='id' then continue; end if;
        v_antes:=v_previo->v_campo;
        v_despues:=v_item->v_campo;
        if v_antes is not distinct from v_despues then continue; end if;
        -- Un guardado reactivo, carga o cambio masivo no decide precios.
        -- Solo la interacción que envió este producto en p_venta puede hacerlo.
        if not v_venta_autorizada and v_campo=any(array[
          'nombre','unidad','fraccionable','precisionCantidad',
          'precioVenta','ivaVenta','activo','tipo','localId'
        ]) then continue; end if;
        v_en_nube:=v_remoto->v_campo;
        if v_en_nube is distinct from v_antes
           and v_en_nube is distinct from v_despues then
          raise exception 'abc_productos_conflicto_campo:%:%',v_id,v_campo;
        end if;
        if v_item ? v_campo then
          v_final:=jsonb_set(v_final,array[v_campo],v_despues,true);
        else
          v_final:=v_final-v_campo;
        end if;
      end loop;
      if v_final is not distinct from v_remoto then continue; end if;
      if coalesce(v_remoto->>'empresaId','')<>coalesce(v_final->>'empresaId','')
         or coalesce(v_remoto->>'localId','')<>coalesce(v_final->>'localId','') then
        raise exception 'abc_productos_cambio_contexto_no_admitido:%',v_id;
      end if;
    end if;

    -- Los artículos heredados de QA no llevan empresaId dentro del JSON;
    -- la fila sí tiene empresa_id y se usa como contexto verificable.
    v_empresa:=nullif(btrim(coalesce(v_final->>'empresaId',v_lista_empresa,'')),'');
    v_local:=nullif(btrim(coalesce(v_final->>'localId','')),'');
    if v_empresa is null or v_local is null
       or (v_lista_empresa is not null and v_lista_empresa<>v_empresa)
       or not private.la_tiene_local(v_empresa,v_local) then
      raise exception 'abc_productos_no_autorizado' using errcode='42501';
    end if;
    if v_venta_autorizada and not private.abc_catalogo_puede_gestionar(v_empresa,v_local) then
      raise exception 'abc_catalogo_no_autorizado' using errcode='42501';
    end if;

    if v_remoto is null then
      v_fusion:=v_fusion||jsonb_build_array(v_final);
    else
      v_fusion:=jsonb_set(v_fusion,array[(v_pos-1)::text],v_final,false);
    end if;
    v_cambios:=v_cambios+1;
  end loop;

  if v_fusion is distinct from v_actual then
    update public.almacen_kv set value=v_fusion,updated_at=now() where key='productos';
  end if;

  -- El bloqueo de la fila sigue vigente. P3 actualiza el catálogo y P3b
  -- refleja sobre esta misma fila antes de que la transacción confirme.
  if jsonb_array_length(v_venta)>0 then
    for v_grupo in
      -- Usar el producto fusionado: un dispositivo con precio antiguo puede
      -- editar el nombre sin devolver el precio al valor anterior en el TPV.
      select coalesce(e->>'empresaId',v_lista_empresa) as empresa_id,
             e->>'localId' as local_id,
             jsonb_agg(e order by e->>'id') as productos
        from jsonb_array_elements(v_fusion) e
       where exists (select 1 from jsonb_array_elements(v_venta) v
                      where v->>'id'=e->>'id')
       group by coalesce(e->>'empresaId',v_lista_empresa),e->>'localId'
       order by coalesce(e->>'empresaId',v_lista_empresa),e->>'localId'
    loop
      v_grupo_n:=v_grupo_n+1;
      if v_lista_empresa is not null and v_lista_empresa<>v_grupo.empresa_id then
        raise exception 'abc_productos_empresa_lista_distinta' using errcode='42501';
      end if;
      if not private.abc_catalogo_puede_gestionar(v_grupo.empresa_id,v_grupo.local_id) then
        raise exception 'abc_catalogo_no_autorizado' using errcode='42501';
      end if;
      v_rpc:=public.abc_catalogo_guardar_productos(
        p_operation_id||'.'||v_grupo_n,v_grupo.empresa_id,
        v_grupo.local_id,'EUR',v_grupo.productos
      );
      if coalesce((v_rpc->>'ok')::boolean,false) is not true then
        raise exception 'abc_productos_catalogo_no_confirmado';
      end if;
      if v_rpc->>'lista_nube'='sin_fila' or exists (
        select 1 from jsonb_array_elements(coalesce(v_rpc->'productos','[]'::jsonb)) e
         where e->>'resultado'='OMITIDO'
           and coalesce(e->>'motivo','') not in ('inactivo','no_vendible')
      ) then
        raise exception 'abc_productos_catalogo_omitido';
      end if;
    end loop;
  end if;
  -- P3b puede reflejar el precio sobre la misma fila durante la llamada al
  -- catálogo. Devolver la fila final, aún bajo el bloqueo de esta transacción.
  select k.value into v_fusion from public.almacen_kv k where k.key='productos';
  return jsonb_build_object(
    'ok',true,'productos_cambiados',v_cambios,
    'venta_cambiada',jsonb_array_length(v_venta),
    'catalogo_ya_sincronizado',true,
    'lista_confirmada',v_fusion
  );
end $function$;
