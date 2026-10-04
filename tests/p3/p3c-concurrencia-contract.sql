-- ABC P3c · ejecutar en QA dentro de BEGIN; [migración P3c]; este archivo; ROLLBACK.
-- Simula dos dispositivos con la misma lista inicial. No deja cambios persistentes.

create function pg_temp.p3c_actor(p_uid text) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims',json_build_object('sub',p_uid,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',p_uid,true);
  execute 'set local role authenticated';
end $f$;

-- Solo vive hasta el ROLLBACK. Reproduce en QA el permiso de escritura directa
-- de producción para comprobar que el trigger P3c lo impide.
grant select,update on public.almacen_kv to authenticated;
create policy p3c_qa_lectura_temporal on public.almacen_kv
  for select to authenticated using (key='productos');
create policy p3c_qa_escritura_temporal on public.almacen_kv
  for update to authenticated using (key='productos') with check (key='productos');

do $test$
declare
  k_owner constant text:='16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_other constant text:='73967f0c-3474-443d-ad83-9f20b94204c3';
  k_id constant text:='QA-CAT-A1-AGUA';
  v_base jsonb;
  v_p jsonb;
  v_a jsonb;
  v_b jsonb;
  v_precio_nuevo numeric;
  v_costo_nuevo numeric;
  v_nombre_nuevo text;
  v_nuevo jsonb;
  v_alta jsonb;
  v_res jsonb;
  v_msg text;
  v_count integer;
begin
  select value into v_base from public.almacen_kv
   where key='productos' and empresa_id='QA-EMP-A';
  if jsonb_typeof(v_base)<>'array' or jsonb_array_length(v_base)<>30 then
    raise exception 'P3C_TEST_PRECONDICION: lista QA de 30 ausente';
  end if;
  select e into v_p from jsonb_array_elements(v_base) e where e->>'id'=k_id;
  if v_p is null then raise exception 'P3C_TEST_PRECONDICION: Agua ausente'; end if;
  v_precio_nuevo:=coalesce((v_p->>'precioVenta')::numeric,1)+0.55;
  v_costo_nuevo:=coalesce((v_p->>'costo')::numeric,0)+0.37;

  -- Dispositivo A cambia el precio y la RPC refleja lista + catálogo.
  v_a:=(select jsonb_agg(
    case when e->>'id'=k_id then e||jsonb_build_object('precioVenta',v_precio_nuevo)
         else e end order by ord)
    from jsonb_array_elements(v_base) with ordinality t(e,ord));
  perform pg_temp.p3c_actor(k_owner);
  select public.abc_productos_guardar_lista(
    'p3c.qa.precio.0001',v_base,v_a,
    jsonb_build_array(v_p||jsonb_build_object('precioVenta',v_precio_nuevo))
  ) into v_res;
  execute 'reset role';
  if v_res->>'ok'<>'true' or (v_res->>'venta_cambiada')::integer<>1 then
    raise exception 'P3C_TEST_FALLO: precio no confirmado %',v_res;
  end if;
  if (select precio_con_impuesto from public.catalogo_tpv_productos
       where empresa_id='QA-EMP-A' and local_id='QA-A1' and producto_id=k_id)<>v_precio_nuevo then
    raise exception 'P3C_TEST_FALLO: precio TPV no actualizado';
  end if;

  -- Dispositivo B conserva la base antigua y solo cambia coste. La fusión
  -- mantiene el precio recién reflejado por A.
  v_b:=(select jsonb_agg(
    case when e->>'id'=k_id then e||jsonb_build_object('costo',v_costo_nuevo)
         else e end order by ord)
    from jsonb_array_elements(v_base) with ordinality t(e,ord));
  perform pg_temp.p3c_actor(k_owner);
  select public.abc_productos_guardar_lista(
    'p3c.qa.costo.0002',v_base,v_b,'[]'::jsonb
  ) into v_res;
  execute 'reset role';
  select e into v_p from public.almacen_kv k,jsonb_array_elements(k.value) e
   where k.key='productos' and e->>'id'=k_id;
  if (v_p->>'precioVenta')::numeric<>v_precio_nuevo
     or (v_p->>'costo')::numeric<>v_costo_nuevo then
    raise exception 'P3C_TEST_FALLO: precio/coste se pisaron %',v_p;
  end if;

  -- B edita el nombre con una copia que todavía tiene el precio antiguo.
  -- P3 debe recibir el producto fusionado, no el payload comercial obsoleto.
  v_nombre_nuevo:=coalesce(v_p->>'nombre','Agua')||' P3c';
  v_b:=(select jsonb_agg(
    case when e->>'id'=k_id then e||jsonb_build_object('nombre',v_nombre_nuevo)
         else e end order by ord)
    from jsonb_array_elements(v_base) with ordinality t(e,ord));
  perform pg_temp.p3c_actor(k_owner);
  select public.abc_productos_guardar_lista(
    'p3c.qa.nombre.0006',v_base,v_b,
    jsonb_build_array((select e from jsonb_array_elements(v_b) e where e->>'id'=k_id))
  ) into v_res;
  execute 'reset role';
  select e into v_p from public.almacen_kv k,jsonb_array_elements(k.value) e
   where k.key='productos' and e->>'id'=k_id;
  if v_p->>'nombre'<>v_nombre_nuevo
     or (v_p->>'precioVenta')::numeric<>v_precio_nuevo
     or (select precio_con_impuesto from public.catalogo_tpv_productos
          where empresa_id='QA-EMP-A' and local_id='QA-A1' and producto_id=k_id)<>v_precio_nuevo then
    raise exception 'P3C_TEST_FALLO: nombre obsoleto pisó precio %',v_p;
  end if;

  -- Con la misma base antigua, cambiar otra vez el precio sí es un conflicto.
  v_b:=(select jsonb_agg(
    case when e->>'id'=k_id then e||jsonb_build_object('precioVenta',v_precio_nuevo+1)
         else e end order by ord)
    from jsonb_array_elements(v_base) with ordinality t(e,ord));
  begin
    perform pg_temp.p3c_actor(k_owner);
    perform public.abc_productos_guardar_lista(
      'p3c.qa.conflicto.0003',v_base,v_b,
      jsonb_build_array((select e from jsonb_array_elements(v_b) e where e->>'id'=k_id))
    );
    execute 'reset role';
    raise exception 'P3C_TEST_FALLO: conflicto no rechazado';
  exception when others then
    get stacked diagnostics v_msg=message_text;
    execute 'reset role';
    if v_msg not like 'abc_productos_conflicto_campo:%:precioVenta' then
      raise exception 'P3C_TEST_FALLO: rechazo inesperado %',v_msg;
    end if;
  end;

  -- Una alta por A no se pierde cuando B vuelve a guardar con su base antigua.
  v_alta:=jsonb_build_object(
    'id','QA-P3C-ALTA-UNO','empresaId','QA-EMP-A','localId','QA-A1',
    'nombre','Alta P3c de prueba','tipo','materia_prima','unidad','ud',
    'precioVenta',2.20,'ivaVenta',10,'activo',true,'stock',0
  );
  v_nuevo:=v_a||jsonb_build_array(v_alta);
  perform pg_temp.p3c_actor(k_owner);
  select public.abc_productos_guardar_lista(
    'p3c.qa.alta.0004',v_a,v_nuevo,jsonb_build_array(v_alta)
  ) into v_res;
  execute 'reset role';
  if v_res->>'ok'<>'true' then raise exception 'P3C_TEST_FALLO: alta no confirmada %',v_res; end if;
  select count(*) into v_count from public.almacen_kv k,jsonb_array_elements(k.value) e
   where k.key='productos' and e->>'id'='QA-P3C-ALTA-UNO';
  if v_count<>1 then raise exception 'P3C_TEST_FALLO: alta perdida'; end if;
  if not exists (select 1 from public.catalogo_tpv_productos
                  where empresa_id='QA-EMP-A' and local_id='QA-A1'
                    and producto_id='QA-P3C-ALTA-UNO') then
    raise exception 'P3C_TEST_FALLO: alta no llegó al TPV';
  end if;

  -- Un usuario de otra empresa no puede modificar el producto de A.
  v_b:=(select jsonb_agg(
    case when e->>'id'=k_id then e||jsonb_build_object('categoria','P3C-PRUEBA')
         else e end order by ord)
    from jsonb_array_elements(v_base) with ordinality t(e,ord));
  begin
    perform pg_temp.p3c_actor(k_other);
    perform public.abc_productos_guardar_lista(
      'p3c.qa.ajeno.0005',v_base,v_b,'[]'::jsonb
    );
    execute 'reset role';
    raise exception 'P3C_TEST_FALLO: otra empresa admitida';
  exception when others then
    get stacked diagnostics v_msg=message_text;
    execute 'reset role';
    if v_msg <> 'abc_productos_no_autorizado' then
      raise exception 'P3C_TEST_FALLO: rechazo ajeno inesperado %',v_msg;
    end if;
  end;

  -- Simula temporalmente la política permisiva de producción; la escritura
  -- directa de una pestaña antigua debe seguir siendo rechazada por el trigger.
  begin
    perform pg_temp.p3c_actor(k_owner);
    update public.almacen_kv set value=v_base where key='productos';
    execute 'reset role';
    raise exception 'P3C_TEST_FALLO: upsert antiguo no bloqueado';
  exception when others then
    get stacked diagnostics v_msg=message_text;
    execute 'reset role';
    if v_msg not like '%abc_productos_escritura_directa_bloqueada%' then
      raise exception 'P3C_TEST_FALLO: bloqueo antiguo inesperado %',v_msg;
    end if;
  end;

  raise notice 'P3C_QA_OK: precio, coste, conflicto, alta, aislamiento y escritura directa';
end $test$;

select 'P3C_QA_OK' as resultado;
