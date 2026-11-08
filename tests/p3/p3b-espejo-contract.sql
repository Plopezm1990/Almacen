-- ABC P3b · contrato vivo del espejo de la lista heredada `productos` (almacen_kv).
--
-- Se ejecuta DESPUÉS de la migración 20261002170000_abc_p3b_espejo_lista_nube.sql (o junto con ella en
-- un ensayo en seco), dentro de una transacción que termina en ROLLBACK:
--
--   begin; [migración P3b]; <este archivo>; select <resumen del registro la.log>; rollback;
--
-- Requiere QA con P3 aplicada y la siembra de la etapa 1 (30 artículos QA-CAT-*, fila `productos` de
-- almacen_kv de QA-EMP-A con 30 elementos). Los actores se suplantan a nivel de base de datos (set
-- local role + claims JWT); no hay navegador ni PostgREST. Todo se revierte con el ROLLBACK.

select set_config('la.log', '[]', true);

create function pg_temp.log(p_paso text, p_res text, p_det jsonb default null) returns void language plpgsql as $f$
begin
  perform set_config('la.log', (coalesce(nullif(current_setting('la.log', true), ''), '[]')::jsonb
    || jsonb_build_array(jsonb_build_object('paso', p_paso, 'res', p_res, 'det', p_det)))::text, true);
end $f$;

create function pg_temp.ok(p_nombre text, p_cond boolean, p_det jsonb default null) returns void language plpgsql as $f$
begin
  perform pg_temp.log(p_nombre, case when coalesce(p_cond, false) then 'OK' else 'FALLA' end, p_det);
end $f$;

create function pg_temp.as_user(p_uid text, p_rol text default 'authenticated') returns void language plpgsql as $f$
begin
  if p_uid is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_rol)::text, true);
    perform set_config('request.jwt.claim.sub', p_uid, true);
  else
    perform set_config('request.jwt.claims', json_build_object('role', p_rol)::text, true);
    perform set_config('request.jwt.claim.sub', '', true);
  end if;
  execute 'set local role ' || quote_ident(p_rol);
end $f$;

-- Ejecuta un SQL como un usuario/rol. p_espera NULL: debe funcionar; texto: el error debe contenerlo.
create function pg_temp.paso(p_nombre text, p_uid text, p_sql text, p_espera text default null, p_rol text default 'authenticated') returns jsonb language plpgsql as $f$
declare v_res jsonb; v_msg text; v_state text;
begin
  begin
    perform pg_temp.as_user(p_uid, p_rol);
    execute p_sql into v_res;
    execute 'reset role';
    perform pg_temp.log(p_nombre, case when p_espera is null then 'OK' else 'NEGATIVA_NO_RECHAZADA' end, to_jsonb(left(coalesce(v_res::text, 'null'), 400)));
    return v_res;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_state = returned_sqlstate;
    execute 'reset role';
    perform pg_temp.log(p_nombre,
      case when p_espera is null then 'ERROR' when v_msg like '%' || p_espera || '%' then 'NEGATIVA_OK' else 'NEGATIVA_OTRO_ERROR' end,
      to_jsonb(v_state || ' ' || v_msg));
    return null;
  end;
end $f$;

-- Llama a la RPC como un usuario (empresa QA-EMP-A, moneda EUR).
create function pg_temp.sync(p_nombre text, p_uid text, p_op text, p_local text, p_items jsonb, p_espera text default null, p_rol text default 'authenticated') returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', p_op, 'QA-EMP-A', p_local, 'EUR', p_items), p_espera, p_rol);
end $f$;

-- Elemento de la lista heredada de la nube (por id) y la lista completa de la empresa.
create function pg_temp.kv_el(p_id text) returns jsonb language sql as $f$
  select e from public.almacen_kv k, jsonb_array_elements(k.value) e
   where k.key = 'productos' and k.empresa_id = 'QA-EMP-A' and e->>'id' = p_id limit 1
$f$;

create function pg_temp.kv_sin(p_excluir text) returns text language sql as $f$
  select md5(coalesce(jsonb_agg(e order by ord)::text, ''))
    from public.almacen_kv k, jsonb_array_elements(k.value) with ordinality t(e, ord)
   where k.key = 'productos' and k.empresa_id = 'QA-EMP-A' and e->>'id' <> p_excluir
$f$;

create function pg_temp.kv_ids() returns jsonb language sql as $f$
  select jsonb_agg(e->>'id' order by ord)
    from public.almacen_kv k, jsonb_array_elements(k.value) with ordinality t(e, ord)
   where k.key = 'productos' and k.empresa_id = 'QA-EMP-A'
$f$;

create function pg_temp.stock_md5(p_excluir text default null) returns text language sql as $f$
  select md5(coalesce(string_agg(local_id || ':' || producto_id || ':' || almacen || ':' || piso, ',' order by local_id, producto_id), ''))
    from public.stock_ubicacion where empresa_id = 'QA-EMP-A' and producto_id <> coalesce(p_excluir, '')
$f$;

do $t$
declare
  k_e     constant text := 'QA-EMP-A';
  k_l     constant text := 'QA-A1';
  k_l2    constant text := 'QA-A2';
  k_u     constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';  -- Propietario A+B
  k_ucaj  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';  -- Cajero/a A1
  k_uenc  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';  -- Encargado A2
  k_ub    constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';  -- Propietario solo empresa B
  k_agua  constant text := 'QA-CAT-A1-AGUA';
  k_agua2 constant text := 'QA-CAT-A2-AGUA';
  k_queso constant text := 'QA-CAT-A1-QUESO-KG';
  v jsonb; v_el jsonb; v_antes jsonb; v_cnt integer; v_n numeric; v_txt text;
  v_otros text; v_ids jsonb; v_stock text; v_t0 timestamptz; v_t1 timestamptz; v_ver bigint; v_len integer;
begin
  -- ====================================================================================================
  -- 0. Estado reproducible: el desfase real visto en QA. Catálogo del servidor con el Agua de A1 a
  --    1,00 (versión 3) y la lista de la nube con 0,99.
  -- ====================================================================================================
  select jsonb_array_length(value) into v_len from public.almacen_kv where key = 'productos' and empresa_id = k_e;
  perform pg_temp.ok('0.1 existe la fila productos de la empresa con 30 elementos', v_len = 30, to_jsonb(v_len));

  update public.catalogo_tpv_productos
     set precio_con_impuesto = 1.00000000, precio_unitario = round(1.00000000 / 1.1, 8), impuesto_pct = 10, version = 3, activo = true
   where empresa_id = k_e and local_id = k_l and producto_id = k_agua;
  update public.almacen_kv
     set value = (select jsonb_agg(case when e->>'id' = k_agua then e || '{"precioVenta":0.99}'::jsonb else e end order by ord)
                    from jsonb_array_elements(value) with ordinality t(e, ord))
   where key = 'productos' and empresa_id = k_e;
  perform pg_temp.ok('0.2 desfase reproducido: lista de la nube 0,99 frente a catálogo 1,00',
    (pg_temp.kv_el(k_agua)->>'precioVenta')::numeric = 0.99
    and (select precio_con_impuesto from public.catalogo_tpv_productos where empresa_id = k_e and local_id = k_l and producto_id = k_agua) = 1,
    pg_temp.kv_el(k_agua));

  v_antes := pg_temp.kv_el(k_agua);
  v_otros := pg_temp.kv_sin(k_agua);
  v_ids   := pg_temp.kv_ids();
  v_stock := pg_temp.stock_md5();
  select updated_at into v_t0 from public.almacen_kv where key = 'productos';

  -- ====================================================================================================
  -- 1. Permisos intactos tras el create or replace.
  -- ====================================================================================================
  v_el := jsonb_build_array(v_antes || '{"precioVenta":1.00}'::jsonb);
  perform pg_temp.sync('1.1 Cajero/a de A1 no puede', k_ucaj, 'p3b-perm-cajero-1', k_l, v_el, 'abc_catalogo_no_autorizado');
  perform pg_temp.sync('1.2 Encargado de A2 no puede sobre A1', k_uenc, 'p3b-perm-enc-1', k_l, v_el, 'abc_catalogo_no_autorizado');
  perform pg_temp.sync('1.3 Propietario solo de la empresa B no puede', k_ub, 'p3b-perm-prop-b-1', k_l, v_el, 'abc_catalogo_no_autorizado');
  perform pg_temp.sync('1.4 anon no puede ejecutar la RPC', null, 'p3b-perm-anon-1', k_l, v_el, 'permission denied', 'anon');
  perform pg_temp.sync('1.5 service_role no puede ejecutar la RPC', null, 'p3b-perm-svc-1', k_l, v_el, 'permission denied', 'service_role');
  perform pg_temp.ok('1.6 las denegaciones no cambiaron la lista de la nube',
    pg_temp.kv_el(k_agua) = v_antes and pg_temp.kv_sin(k_agua) = v_otros, null);

  -- ====================================================================================================
  -- 2. El caso real: el catálogo ya tiene 1,00 (SIN_CAMBIOS) pero la lista de la nube tiene 0,99.
  -- ====================================================================================================
  v := pg_temp.sync('2.1 Propietario guarda el Agua de A1 a 1,00', k_u, 'p3b-espejo-0001', k_l, v_el);
  perform pg_temp.ok('2.2 catálogo sin cambios y lista de la nube actualizada',
    v->'productos'->0->>'resultado' = 'SIN_CAMBIOS' and v->>'lista_nube' = 'actualizada', v);
  perform pg_temp.ok('2.3 la lista de la nube muestra 1,00 como número',
    (pg_temp.kv_el(k_agua)->>'precioVenta')::numeric = 1 and jsonb_typeof(pg_temp.kv_el(k_agua)->'precioVenta') = 'number', pg_temp.kv_el(k_agua)->'precioVenta');
  perform pg_temp.ok('2.4 los otros 29 elementos quedan idénticos (incluido el Agua de A2 a 0,99)',
    pg_temp.kv_sin(k_agua) = v_otros and (pg_temp.kv_el(k_agua2)->>'precioVenta')::numeric = 0.99, null);
  perform pg_temp.ok('2.5 mismo orden y mismos ids (no se crean ni borran elementos)', pg_temp.kv_ids() = v_ids, null);
  perform pg_temp.ok('2.6 el resto de campos del Agua de A1 no cambia (stock, coste, código…)',
    (pg_temp.kv_el(k_agua) - 'precioVenta') = (v_antes - 'precioVenta'), pg_temp.kv_el(k_agua));
  perform pg_temp.ok('2.7 el stock de la base de datos no cambia', pg_temp.stock_md5() = v_stock, null);
  select updated_at into v_t1 from public.almacen_kv where key = 'productos';
  perform pg_temp.ok('2.8 la fecha de la fila avanza al actualizar', v_t1 > v_t0, to_jsonb(v_t1::text));
  select version into v_ver from public.catalogo_tpv_productos where empresa_id = k_e and local_id = k_l and producto_id = k_agua;
  perform pg_temp.ok('2.9 la versión del catálogo no sube (no hubo cambio de venta)', v_ver = 3, to_jsonb(v_ver));

  v := pg_temp.sync('2.10 otro operation_id con el mismo contenido', k_u, 'p3b-espejo-0002', k_l, v_el);
  perform pg_temp.ok('2.11 lista de la nube sin cambios', v->>'lista_nube' = 'sin_cambios', v);
  perform pg_temp.ok('2.12 la fecha de la fila no se mueve sin cambios', (select updated_at from public.almacen_kv where key = 'productos') = v_t1, null);
  v := pg_temp.sync('2.13 replay del primer operation_id', k_u, 'p3b-espejo-0001', k_l, v_el);
  perform pg_temp.ok('2.14 el replay devuelve el resultado original (lista_nube guardada)', v->>'lista_nube' = 'actualizada', v);
  perform pg_temp.sync('2.15 mismo operation_id con otro contenido: conflicto', k_u, 'p3b-espejo-0001', k_l,
    jsonb_build_array(v_antes || '{"precioVenta":7}'::jsonb), 'operation_id_conflict');

  -- ====================================================================================================
  -- 3. Cambios de venta: precio, texto, baja, reactivación, no vendible, alta, omitidos, mezcla.
  -- ====================================================================================================
  v := pg_temp.sync('3.1 Agua de A1 a 1,50', k_u, 'p3b-espejo-0003', k_l, jsonb_build_array(pg_temp.kv_el(k_agua) || '{"precioVenta":1.5}'::jsonb));
  perform pg_temp.ok('3.2 catálogo ACTUALIZADO (versión 4) y lista de la nube a 1,5',
    v->'productos'->0->>'resultado' = 'ACTUALIZADO' and (v->'productos'->0->>'version')::int = 4 and (pg_temp.kv_el(k_agua)->>'precioVenta')::numeric = 1.5, v);
  v_n := (private.abc_calcular_linea_tpv(k_e, k_l, k_agua, 'EUR', 3)->>'total')::numeric;
  perform pg_temp.ok('3.3 el servidor cobra 3 x 1,50 = 4,50, igual que lo que muestra la lista', v_n = 4.5, to_jsonb(v_n));

  v := pg_temp.sync('3.4 precio escrito como texto «1.25»', k_u, 'p3b-espejo-0004', k_l, jsonb_build_array(pg_temp.kv_el(k_agua) || '{"precioVenta":"1.25"}'::jsonb));
  perform pg_temp.ok('3.5 en la lista queda un número 1,25 (no un texto)',
    jsonb_typeof(pg_temp.kv_el(k_agua)->'precioVenta') = 'number' and (pg_temp.kv_el(k_agua)->>'precioVenta')::numeric = 1.25, pg_temp.kv_el(k_agua)->'precioVenta');

  v := pg_temp.sync('3.6 nombre, unidad e IVA 21 %', k_u, 'p3b-espejo-0005', k_l,
    jsonb_build_array(pg_temp.kv_el(k_agua) || '{"nombre":"Agua 33 cl (QA)","unidad":"botella","ivaVenta":21}'::jsonb));
  perform pg_temp.ok('3.7 nombre, unidad e IVA reflejados',
    pg_temp.kv_el(k_agua)->>'nombre' = 'Agua 33 cl (QA)' and pg_temp.kv_el(k_agua)->>'unidad' = 'botella' and (pg_temp.kv_el(k_agua)->>'ivaVenta')::numeric = 21, pg_temp.kv_el(k_agua));
  v_n := (private.abc_calcular_linea_tpv(k_e, k_l, k_agua, 'EUR', 4)->>'total')::numeric;
  perform pg_temp.ok('3.8 4 x 1,25 con IVA 21 % = 5,00 exacto en el servidor', v_n = 5, to_jsonb(v_n));

  v := pg_temp.sync('3.9 baja explícita (activo=false)', k_u, 'p3b-espejo-0006', k_l, jsonb_build_array(pg_temp.kv_el(k_agua) || '{"activo":false}'::jsonb));
  perform pg_temp.ok('3.10 catálogo DESACTIVADO y lista con activo=false sin tocar el precio',
    v->'productos'->0->>'resultado' = 'DESACTIVADO' and (pg_temp.kv_el(k_agua)->>'activo')::boolean is false
    and (pg_temp.kv_el(k_agua)->>'precioVenta')::numeric = 1.25, v);

  v := pg_temp.sync('3.11 reactivación con precio 2,00', k_u, 'p3b-espejo-0007', k_l, jsonb_build_array(pg_temp.kv_el(k_agua) || '{"activo":true,"precioVenta":2}'::jsonb));
  perform pg_temp.ok('3.12 catálogo ACTUALIZADO y lista activa a 2,00',
    v->'productos'->0->>'resultado' = 'ACTUALIZADO' and (pg_temp.kv_el(k_agua)->>'activo')::boolean is true and (pg_temp.kv_el(k_agua)->>'precioVenta')::numeric = 2, v);

  v := pg_temp.sync('3.13 precio 0 (no vendible)', k_u, 'p3b-espejo-0008', k_l, jsonb_build_array(pg_temp.kv_el(k_agua) || '{"precioVenta":0}'::jsonb));
  perform pg_temp.ok('3.14 catálogo DESACTIVADO por no vendible y lista con precio 0',
    v->'productos'->0->>'resultado' = 'DESACTIVADO' and (pg_temp.kv_el(k_agua)->>'precioVenta')::numeric = 0, v);

  -- Artículo al peso: la precisión (decimales) se conserva y se refleja.
  v_el := pg_temp.kv_el(k_queso);
  v := pg_temp.sync('3.15 artículo al peso: precio 20,00', k_u, 'p3b-espejo-0009', k_l, jsonb_build_array(v_el || '{"precioVenta":20}'::jsonb));
  perform pg_temp.ok('3.16 el queso refleja precio y conserva fraccionable y precisión 3',
    (pg_temp.kv_el(k_queso)->>'precioVenta')::numeric = 20 and (pg_temp.kv_el(k_queso)->>'fraccionable')::boolean is true
    and (pg_temp.kv_el(k_queso)->>'precisionCantidad')::numeric = 3, pg_temp.kv_el(k_queso));

  -- Alta nueva: va al catálogo, pero no se crean elementos en la lista de la nube.
  v := pg_temp.sync('3.17 alta de un producto nuevo', k_u, 'p3b-espejo-0010', k_l,
    jsonb_build_array(jsonb_build_object('id', 'P3B-NUEVO-1', 'localId', k_l, 'nombre', 'Nuevo P3b', 'unidad', 'unidad',
      'fraccionable', false, 'precioVenta', 3.3, 'ivaVenta', 10, 'activo', true, 'tipo', 'materia_prima', 'stock', 0)));
  select jsonb_array_length(value) into v_len from public.almacen_kv where key = 'productos' and empresa_id = k_e;
  perform pg_temp.ok('3.18 catálogo CREADO; la lista de la nube sigue con 30 elementos y sin el nuevo',
    v->'productos'->0->>'resultado' = 'CREADO' and v_len = 30 and pg_temp.kv_el('P3B-NUEVO-1') is null and v->>'lista_nube' = 'sin_cambios', v);

  -- Omitidos: no se reflejan.
  v := pg_temp.sync('3.19 producto de otro local (A2) enviado a A1', k_u, 'p3b-espejo-0011', k_l,
    jsonb_build_array(pg_temp.kv_el(k_agua2) || '{"precioVenta":9.99}'::jsonb));
  perform pg_temp.ok('3.20 OMITIDO local_distinto, nada se refleja',
    v->'productos'->0->>'resultado' = 'OMITIDO' and v->>'lista_nube' = 'sin_productos' and (pg_temp.kv_el(k_agua2)->>'precioVenta')::numeric = 0.99, v);
  v := pg_temp.sync('3.21 producto de otra empresa', k_u, 'p3b-espejo-0012', k_l,
    jsonb_build_array(pg_temp.kv_el(k_agua) || '{"empresaId":"QA-EMP-B","precioVenta":8}'::jsonb));
  perform pg_temp.ok('3.22 OMITIDO empresa_distinta, nada se refleja',
    v->'productos'->0->>'motivo' = 'empresa_distinta' and (pg_temp.kv_el(k_agua)->>'precioVenta')::numeric = 0, v);

  -- Mezcla: el válido se refleja y el omitido no.
  v := pg_temp.sync('3.23 mezcla: Agua A1 a 1,10 + Agua A2 (omitida)', k_u, 'p3b-espejo-0013', k_l,
    jsonb_build_array(pg_temp.kv_el(k_agua) || '{"precioVenta":1.1}'::jsonb, pg_temp.kv_el(k_agua2) || '{"precioVenta":5}'::jsonb));
  perform pg_temp.ok('3.24 A1 a 1,10 reflejado; A2 intacto a 0,99',
    (pg_temp.kv_el(k_agua)->>'precioVenta')::numeric = 1.1 and (pg_temp.kv_el(k_agua2)->>'precioVenta')::numeric = 0.99, v);
  perform pg_temp.ok('3.25 sigue sin crearse ni borrarse ningún elemento', pg_temp.kv_ids() = v_ids, null);
  -- Lo que verá la persona al recargar: lectura con rol real (RLS) del Propietario.
  v := pg_temp.paso('3.25b el Propietario lee el precio del Agua de A1 desde la lista de la nube', k_u,
    format('select to_jsonb((select e->>%L from public.almacen_kv k, jsonb_array_elements(k.value) e where k.key = %L and e->>%L = %L))',
           'precioVenta', 'productos', 'id', k_agua));
  perform pg_temp.ok('3.25c la lectura con RLS devuelve 1,1', (v #>> '{}')::numeric = 1.1, v);
  -- El alta de 3.17 crea, por diseño de P3, la fila de stock inicial del producto nuevo; el resto no cambia.
  perform pg_temp.ok('3.26 el stock existente de la base de datos no cambió en todo el contrato', pg_temp.stock_md5('P3B-NUEVO-1') = v_stock, null);
  select count(*) into v_cnt from public.stock_ubicacion where empresa_id = k_e and local_id = k_l and producto_id = 'P3B-NUEVO-1' and almacen = 0 and piso = 0;
  perform pg_temp.ok('3.27 el producto nuevo tiene su fila de stock inicial a 0 (comportamiento P3)', v_cnt = 1, to_jsonb(v_cnt));

  -- ====================================================================================================
  -- 4. Aislamiento y filas atípicas.
  -- ====================================================================================================
  update public.almacen_kv set empresa_id = 'QA-EMP-B' where key = 'productos';
  v := pg_temp.sync('4.1 la fila `productos` es de otra empresa', k_u, 'p3b-espejo-0014', k_l,
    jsonb_build_array(jsonb_build_object('id', k_agua, 'localId', k_l, 'nombre', 'Agua', 'unidad', 'unidad', 'fraccionable', false, 'precioVenta', 4, 'ivaVenta', 10, 'activo', true)));
  perform pg_temp.ok('4.2 lista_nube = sin_fila (no se toca la fila ajena); el catálogo sí se actualiza',
    v->>'lista_nube' = 'sin_fila' and v->'productos'->0->>'resultado' = 'ACTUALIZADO'
    and ((select e->>'precioVenta' from public.almacen_kv k, jsonb_array_elements(k.value) e where k.key = 'productos' and e->>'id' = k_agua)::numeric = 1.1), v);
  update public.almacen_kv set empresa_id = k_e, value = '{"no":"es una lista"}'::jsonb where key = 'productos';
  v := pg_temp.sync('4.3 la fila `productos` no es una lista', k_u, 'p3b-espejo-0015', k_l,
    jsonb_build_array(jsonb_build_object('id', k_agua, 'localId', k_l, 'nombre', 'Agua', 'unidad', 'unidad', 'fraccionable', false, 'precioVenta', 5, 'ivaVenta', 10, 'activo', true)));
  perform pg_temp.ok('4.4 lista_nube = sin_fila y la fila queda como estaba',
    v->>'lista_nube' = 'sin_fila' and (select value from public.almacen_kv where key = 'productos') = '{"no":"es una lista"}'::jsonb, v);

end
$t$;
