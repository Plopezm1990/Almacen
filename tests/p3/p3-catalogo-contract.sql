-- ABC P3 · contrato vivo del catálogo autoritativo y del precio con impuesto incluido (D31).
--
-- Se ejecuta DESPUÉS de la migración 20261002150000_abc_p3_catalogo_autoritativo.sql, dentro de
-- una transacción que termina en ROLLBACK:
--
--   begin; <este archivo>; select jsonb_pretty(current_setting('la.log')::jsonb); rollback;
--
-- Requiere el catálogo ficticio de la etapa 1 (docs/plan-abc/etapa1_siembra_qa/01_siembra.sql):
-- 15 artículos QA-CAT-A1-* con precio base sin impuesto (10 %), la colección `productos` de
-- almacen_kv con precioVenta CON impuesto, y los usuarios de QA. Los actores se suplantan a nivel
-- de base de datos (set local role + claims JWT); no hay inicio de sesión real, ni PostgREST, ni
-- navegador. Todo lo que escribe se revierte con el ROLLBACK.

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
    perform pg_temp.log(p_nombre, case when p_espera is null then 'OK' else 'NEGATIVA_NO_RECHAZADA' end, to_jsonb(left(coalesce(v_res::text, 'null'), 500)));
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

create temp table _antes(producto text, cant numeric, base numeric, imp numeric, total numeric) on commit drop;

-- ======================================================================================================
-- 0-2. Estado inicial, permisos y sincronización de la colección heredada.
-- ======================================================================================================
do $t$
declare
  k_e    constant text := 'QA-EMP-A';
  k_l    constant text := 'QA-A1';
  k_u    constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';  -- Propietario A+B
  k_ucaj constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';  -- Cajero/a A1
  k_uenc constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';  -- Encargado A2
  k_ub   constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';  -- Propietario solo empresa B
  r record; v jsonb; v_payload jsonb; v_cnt integer; v_fail integer; x jsonb;
begin
  select count(*) into v_cnt from public.catalogo_tpv_productos
   where empresa_id = k_e and local_id = k_l and precio_con_impuesto is null;
  perform pg_temp.ok('0.1 catálogo sembrado de A1: 15 filas con precio base (semántica anterior)', v_cnt = 15, to_jsonb(v_cnt));

  for r in select c.producto_id, c.fraccionable from public.catalogo_tpv_productos c
            where c.empresa_id = k_e and c.local_id = k_l loop
    for v_cnt in 1..3 loop
      x := private.abc_calcular_linea_tpv(k_e, k_l, r.producto_id, 'EUR', case when r.fraccionable then 0.250 * v_cnt else v_cnt end);
      insert into _antes values (r.producto_id, (x->>'cantidad')::numeric, (x->>'base')::numeric, (x->>'impuestos')::numeric, (x->>'total')::numeric);
    end loop;
  end loop;
  select count(*) into v_cnt from _antes;
  perform pg_temp.ok('0.2 importes de referencia (15 artículos x 3 cantidades) calculados antes de sincronizar', v_cnt = 45, to_jsonb(v_cnt));

  v_payload := (select jsonb_agg(e) from public.almacen_kv k, jsonb_array_elements(k.value) e
                 where k.key = 'productos' and e->>'localId' = k_l);
  perform pg_temp.ok('1.0 la colección heredada de A1 trae 15 productos', jsonb_array_length(v_payload) = 15, to_jsonb(jsonb_array_length(v_payload)));

  perform pg_temp.paso('1.1 Cajero/a de A1 no puede guardar catálogo', k_ucaj,
    format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', 'p3-perm-cajero-1', k_e, k_l, 'EUR', v_payload), 'abc_catalogo_no_autorizado');
  perform pg_temp.paso('1.2 Encargado de A2 no puede guardar catálogo de A1', k_uenc,
    format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', 'p3-perm-enc-a2-1', k_e, k_l, 'EUR', v_payload), 'abc_catalogo_no_autorizado');
  perform pg_temp.paso('1.3 Propietario solo de la empresa B no puede guardar catálogo de A1', k_ub,
    format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', 'p3-perm-prop-b-1', k_e, k_l, 'EUR', v_payload), 'abc_catalogo_no_autorizado');
  perform pg_temp.paso('1.4 anon no puede ejecutar la RPC', null,
    format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', 'p3-perm-anon-1', k_e, k_l, 'EUR', v_payload), 'permission denied', 'anon');
  perform pg_temp.paso('1.5 service_role no puede ejecutar la RPC', null,
    format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', 'p3-perm-svc-1', k_e, k_l, 'EUR', v_payload), 'permission denied', 'service_role');

  v := pg_temp.paso('2.1 Propietario sincroniza los 15 productos de A1', k_u,
    format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', 'p3-sync-a1-0001', k_e, k_l, 'EUR', v_payload));
  perform pg_temp.ok('2.2 resultado: 15 actualizados, 0 creados, 0 omitidos, stock inicial 0 (ya existía)',
    (v->'resumen'->>'actualizados')::int = 15 and (v->'resumen'->>'creados')::int = 0
    and (v->'resumen'->>'omitidos')::int = 0 and (v->'resumen'->>'stock_inicial_creado')::int = 0, v->'resumen');
  select count(*) into v_cnt from public.catalogo_tpv_productos
   where empresa_id = k_e and local_id = k_l and precio_con_impuesto is not null and version = 2;
  perform pg_temp.ok('2.3 las 15 filas pasan a precio con impuesto incluido y suben a versión 2', v_cnt = 15, to_jsonb(v_cnt));

  select count(*) into v_fail from _antes a
   cross join lateral (select private.abc_calcular_linea_tpv(k_e, k_l, a.producto, 'EUR', a.cant) s) z
   where (z.s->>'base')::numeric <> a.base or (z.s->>'impuestos')::numeric <> a.imp or (z.s->>'total')::numeric <> a.total;
  perform pg_temp.ok('2.4 base, impuestos y total idénticos a los de antes (45 combinaciones)', v_fail = 0, to_jsonb(v_fail));

  -- Idempotencia y conflicto.
  v := pg_temp.paso('2.5 mismo operation_id y mismo contenido: replay', k_u,
    format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', 'p3-sync-a1-0001', k_e, k_l, 'EUR', v_payload));
  perform pg_temp.ok('2.6 el replay devuelve el resultado original', (v->'resumen'->>'actualizados')::int = 15, v->'resumen');
  perform pg_temp.paso('2.7 mismo operation_id con otro contenido: conflicto', k_u,
    format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', 'p3-sync-a1-0001', k_e, k_l, 'EUR', (v_payload - 0)), 'operation_id_conflict');
  v := pg_temp.paso('2.8 otro operation_id con el mismo catálogo: todo sin cambios', k_u,
    format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', 'p3-sync-a1-0002', k_e, k_l, 'EUR', v_payload));
  perform pg_temp.ok('2.9 15 sin cambios, 0 actualizados', (v->'resumen'->>'sin_cambios')::int = 15 and (v->'resumen'->>'actualizados')::int = 0, v->'resumen');
  select count(*) into v_cnt from public.catalogo_tpv_productos where empresa_id = k_e and local_id = k_l and version = 2;
  perform pg_temp.ok('2.10 las versiones no suben sin cambios reales', v_cnt = 15, to_jsonb(v_cnt));
end
$t$;

-- ======================================================================================================
-- 3. Alta de productos nuevos, redondeo exacto con impuesto incluido y venta por el circuito ABC.
-- ======================================================================================================
do $t$
declare
  k_e    constant text := 'QA-EMP-A';
  k_l    constant text := 'QA-A1';
  k_u    constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_t    constant text := '5e100000-0000-4000-8000-0000000000a1';
  k_c    constant text := '5e200000-0000-4000-8000-0000000000a1';
  k_ses  constant text := '5e300000-0000-4000-8000-0000000000b1';
  k_cue  constant text := '5e300000-0000-4000-8000-0000000000b2';
  k_ped  constant text := '5e300000-0000-4000-8000-0000000000b3';
  k_lin1 constant text := '5e300000-0000-4000-8000-0000000000b4';
  k_lin2 constant text := '5e300000-0000-4000-8000-0000000000b5';
  v_day date := ((now() at time zone 'Europe/Madrid') - interval '4 hours')::date;
  v jsonb; x jsonb; v_cnt integer; v_cv bigint; v_pv bigint; r record;
  v_nuevos jsonb := jsonb_build_array(
    jsonb_build_object('id','QA-P3-N-3-30','localId','QA-A1','empresaId','QA-EMP-A','nombre','P3 Tostada 3,30','unidad','unidad','precioVenta',3.30,'ivaVenta',10,'stock',10,'stockPisoVenta',4,'stockMinimo',1,'tipo','materia_prima'),
    jsonb_build_object('id','QA-P3-N-1-99','localId','QA-A1','nombre','P3 Pieza 1,99','precioVenta','1.99','ivaVenta','21','stock','5','stockPisoVenta','5'),
    jsonb_build_object('id','QA-P3-N-4-45','localId','QA-A1','nombre','P3 Pieza 4,45','precioVenta',4.45,'ivaVenta',21),
    jsonb_build_object('id','QA-P3-N-ELAB','localId','QA-A1','nombre','P3 Elaborado sin precio','tipo','elaborado','precioVenta',0,'ivaVenta',10),
    jsonb_build_object('id','QA-P3-N-KG','localId','QA-A1','nombre','P3 Granel','unidad','kg','fraccionable',true,'precisionCantidad',3,'precioVenta',19.80,'ivaVenta',10,'stock',20,'stockPisoVenta',5)
  );
begin
  v := pg_temp.paso('3.1 alta de 5 productos nuevos (3,30 / 1,99 / 4,45 / elaborado a 0 / granel)', k_u,
    format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', 'p3-alta-a1-0001', k_e, k_l, 'EUR', v_nuevos));
  perform pg_temp.ok('3.2 5 creados y stock inicial de los 5', (v->'resumen'->>'creados')::int = 5 and (v->'resumen'->>'stock_inicial_creado')::int = 5, v->'resumen');

  select count(*) into v_cnt from public.stock_ubicacion s
   where s.empresa_id = k_e and s.local_id = k_l and s.producto_id = 'QA-P3-N-3-30' and s.piso = 4 and s.almacen = 6 and s.minimo = 1;
  perform pg_temp.ok('3.3 stock inicial: total 10, piso 4, almacén 6, mínimo 1', v_cnt = 1, to_jsonb(v_cnt));

  select precio_unitario, precio_con_impuesto, impuesto_pct, version into r
    from public.catalogo_tpv_productos where empresa_id = k_e and local_id = k_l and producto_id = 'QA-P3-N-3-30';
  perform pg_temp.ok('3.4 3,30 con 10 %: base 3,00000000, precio con impuesto 3,30000000, versión 1',
    r.precio_unitario = 3.00000000 and r.precio_con_impuesto = 3.30000000 and r.impuesto_pct = 10 and r.version = 1, to_jsonb(r));

  x := private.abc_calcular_linea_tpv(k_e, k_l, 'QA-P3-N-3-30', 'EUR', 3);
  perform pg_temp.ok('3.5 3 x 3,30 = total 9,90 (base 9,00 + impuesto 0,90)',
    (x->>'total')::numeric = 9.9 and (x->>'base')::numeric = 9 and (x->>'impuestos')::numeric = 0.9, x - 'snapshot_comercial' - 'snapshot_calculo');
  x := private.abc_calcular_linea_tpv(k_e, k_l, 'QA-P3-N-1-99', 'EUR', 7);
  perform pg_temp.ok('3.6 7 x 1,99 con 21 % = total 13,93 exacto y base + impuesto = total',
    (x->>'total')::numeric = 13.93 and (x->>'base')::numeric + (x->>'impuestos')::numeric = (x->>'total')::numeric, x - 'snapshot_comercial' - 'snapshot_calculo');
  x := private.abc_calcular_linea_tpv(k_e, k_l, 'QA-P3-N-4-45', 'EUR', 3);
  perform pg_temp.ok('3.7 3 x 4,45 con 21 % = total 13,35 exacto',
    (x->>'total')::numeric = 13.35 and (x->>'base')::numeric + (x->>'impuestos')::numeric = (x->>'total')::numeric, x - 'snapshot_comercial' - 'snapshot_calculo');
  x := private.abc_calcular_linea_tpv(k_e, k_l, 'QA-P3-N-KG', 'EUR', 0.333);
  perform pg_temp.ok('3.8 0,333 kg a 19,80 = total 6,5934 exacto',
    (x->>'total')::numeric = 6.5934 and (x->>'base')::numeric + (x->>'impuestos')::numeric = (x->>'total')::numeric, x - 'snapshot_comercial' - 'snapshot_calculo');
  perform pg_temp.ok('3.9 la instantánea del cálculo conserva el precio con impuesto',
    (private.abc_calcular_linea_tpv(k_e, k_l, 'QA-P3-N-3-30', 'EUR', 1)->'snapshot_calculo'->>'precio_con_impuesto')::numeric = 3.3, null);

  -- Venta de un producto sembrado por P3 por el circuito ABC completo (sesión, cuenta, pedido, línea).
  perform pg_temp.paso('3.10 abrir sesión de caja A1', k_u,
    format('select to_jsonb(public.abc_abrir_sesion_caja(%L,%L,%L,%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L,%s,%L::date))', 'p3-venta-s1', k_e, k_l, k_ses, k_c, k_u, k_t, 'EUR', 100, v_day));
  perform pg_temp.paso('3.11 abrir cuenta BARRA', k_u,
    format('select to_jsonb(public.abc_abrir_cuenta(%L,%L,%L,%L::uuid,%L,%L,%L::uuid,%L::uuid,%L::uuid,%L::date))', 'p3-venta-s2', k_e, k_l, k_cue, 'BARRA', 'EUR', k_u, k_t, k_ses, v_day));
  select version into v_cv from public.cuentas_comerciales where id = k_cue::uuid;
  perform pg_temp.paso('3.12 crear pedido', k_u,
    format('select to_jsonb(public.abc_crear_pedido(%L,%L,%L,%L::uuid,%L::uuid,%s,%L::uuid,%L::uuid,%L::date))', 'p3-venta-s3', k_e, k_l, k_ped, k_cue, coalesce(v_cv, 0), k_t, k_ses, v_day));
  select version into v_pv from public.pedidos_tpv where id = k_ped::uuid;
  v := pg_temp.paso('3.13 vender 3 x P3 Pieza 1,99 (21 %)', k_u,
    format('select to_jsonb(public.abc_agregar_linea_pedido(%L,%L,%L,%L::uuid,%L::uuid,%L,%s,%s,%L::uuid,%L::uuid,%L::date))', 'p3-venta-s4', k_e, k_l, k_lin1, k_ped, 'QA-P3-N-1-99', 3, coalesce(v_pv, 0), k_t, k_ses, v_day));
  perform pg_temp.ok('3.14 la línea del pedido tiene total exacto 5,97', (v->>'total')::numeric = 5.97 and (v->>'base')::numeric + (v->>'impuestos')::numeric = 5.97, v - 'entidad_fiscal_id');
  select version into v_pv from public.pedidos_tpv where id = k_ped::uuid;
  v := pg_temp.paso('3.15 vender 0,333 kg de granel', k_u,
    format('select to_jsonb(public.abc_agregar_linea_pedido(%L,%L,%L,%L::uuid,%L::uuid,%L,%s,%s,%L::uuid,%L::uuid,%L::date))', 'p3-venta-s5', k_e, k_l, k_lin2, k_ped, 'QA-P3-N-KG', 0.333, coalesce(v_pv, 0), k_t, k_ses, v_day));
  perform pg_temp.ok('3.16 la línea del granel tiene total exacto 6,5934', (v->>'total')::numeric = 6.5934, v - 'entidad_fiscal_id');
end
$t$;

-- ======================================================================================================
-- 4. Variantes (A04) con producto a precio con impuesto incluido; opciones siguen con su base.
-- ======================================================================================================
do $t$
declare
  k_e   constant text := 'QA-EMP-A';
  k_l   constant text := 'QA-A1';
  k_tag constant text := 'QA_ETAPA1_2026-10-02';
  v_ver bigint; v_sel jsonb; x jsonb;
begin
  select version into v_ver from public.catalogo_tpv_productos where empresa_id = k_e and local_id = k_l and producto_id = 'QA-CAT-A1-CAPUCHINO';
  v_sel := jsonb_build_array(
    jsonb_build_object('grupo_id', md5(k_tag || k_l || 'TAM')::uuid, 'opcion_id', md5(k_tag || k_l || 'TAM' || 'MED')::uuid, 'cantidad', 1,
                       'expected_group_version', 1, 'expected_product_group_version', 1, 'expected_option_version', 1),
    jsonb_build_object('grupo_id', md5(k_tag || k_l || 'EXT')::uuid, 'opcion_id', md5(k_tag || k_l || 'EXT' || 'AVENA')::uuid, 'cantidad', 1,
                       'expected_group_version', 1, 'expected_product_group_version', 1, 'expected_option_version', 1));
  x := private.abc_calcular_linea_tpv_configurada(k_e, k_l, 'QA-CAT-A1-CAPUCHINO', 'EUR', 1, v_ver, v_sel);
  perform pg_temp.ok('4.1 capuchino Mediano + leche de avena: total 2,20 (igual que antes de sincronizar), base 2,00, impuesto 0,20',
    (x->>'total')::numeric = 2.2 and (x->>'base')::numeric = 2.0 and (x->>'impuestos')::numeric = 0.2, x - 'opciones' - 'snapshot_comercial' - 'snapshot_calculo');
  perform pg_temp.ok('4.2 la instantánea A04 conserva el precio con impuesto del producto',
    (x->'snapshot_calculo'->>'precio_con_impuesto')::numeric = 1.65, null);
  x := private.abc_calcular_linea_tpv_configurada(k_e, k_l, 'QA-CAT-A1-CAPUCHINO', 'EUR', 3, v_ver, v_sel);
  perform pg_temp.ok('4.3 3 capuchinos con las mismas opciones: total 6,60 y base + impuesto = total',
    (x->>'total')::numeric = 6.6 and (x->>'base')::numeric + (x->>'impuestos')::numeric = (x->>'total')::numeric, x - 'opciones' - 'snapshot_comercial' - 'snapshot_calculo');
end
$t$;

-- ======================================================================================================
-- 5. Cuadrícula de redondeo: total = cantidad x precio con impuesto, y base + impuesto = total.
-- ======================================================================================================
do $t$
declare
  k_e constant text := 'QA-EMP-A';
  k_l constant text := 'QA-A1';
  k_ef constant uuid := 'a0000000-0000-0000-0000-0000000000a2';
  r record; q numeric; x jsonb; v_calls integer := 0; v_fail integer := 0; v_ex jsonb;
begin
  create temp table _grid(id text primary key, gross numeric, pct numeric) on commit drop;
  insert into _grid
    select 'ZZ-P3-G-' || row_number() over (), g, p
    from (select g from unnest(array[0.01,0.05,0.10,0.33,0.99,1.00,1.10,1.19,1.99,2.35,3.30,4.45,9.99,12.50,19.99,99.99]::numeric[]) g
          union
          select ((n * 37) % 10000) / 100.0 from generate_series(1, 150) n) gg
    cross join unnest(array[0, 4, 10, 21]::numeric[]) p;

  insert into public.catalogo_tpv_productos(empresa_id, local_id, producto_id, currency_code, entidad_fiscal_id,
      nombre, unidad, fraccionable, precision_cantidad, precio_unitario, precio_con_impuesto, impuesto_pct, activo, version, snapshot_origen)
    select k_e, k_l, id, 'EUR', k_ef, 'grid ' || id, 'ud', true, 3,
           round(gross / (1 + pct / 100), 8), gross, pct, true, 1, '{}'::jsonb
    from _grid;

  for r in select * from _grid loop
    foreach q in array array[1, 2, 3, 7, 0.5, 0.333]::numeric[] loop
      x := private.abc_calcular_linea_tpv(k_e, k_l, r.id, 'EUR', q);
      v_calls := v_calls + 1;
      if (x->>'total')::numeric <> round(q * r.gross, 8)
         or (x->>'base')::numeric + (x->>'impuestos')::numeric <> (x->>'total')::numeric
         or (x->>'base')::numeric <> round(round(q * r.gross, 8) / (1 + r.pct / 100), 8) then
        v_fail := v_fail + 1;
        if v_ex is null then v_ex := jsonb_build_object('id', r.id, 'gross', r.gross, 'pct', r.pct, 'q', q, 'x', x - 'snapshot_comercial' - 'snapshot_calculo'); end if;
      end if;
    end loop;
  end loop;
  perform pg_temp.ok('5.1 cuadrícula de ' || v_calls || ' cálculos (precios x 0/4/10/21 % x 6 cantidades): 0 fallos', v_fail = 0 and v_calls > 3000, jsonb_build_object('calculos', v_calls, 'fallos', v_fail, 'primer_fallo', v_ex));

  begin
    insert into public.catalogo_tpv_productos(empresa_id, local_id, producto_id, currency_code, entidad_fiscal_id,
        nombre, unidad, fraccionable, precision_cantidad, precio_unitario, precio_con_impuesto, impuesto_pct, activo, version, snapshot_origen)
      values (k_e, k_l, 'ZZ-P3-BAD', 'EUR', k_ef, 'incoherente', 'ud', false, 0, 5.00, 3.30, 10, true, 1, '{}'::jsonb);
    perform pg_temp.ok('5.2 la restricción rechaza un precio base incoherente con el precio con impuesto', false, null);
  exception when check_violation then
    perform pg_temp.ok('5.2 la restricción rechaza un precio base incoherente con el precio con impuesto', true, to_jsonb(sqlerrm));
  end;
end
$t$;

-- ======================================================================================================
-- 6. Desactivación, omisiones con motivo y límites.
-- ======================================================================================================
do $t$
declare
  k_e constant text := 'QA-EMP-A';
  k_l constant text := 'QA-A1';
  k_u constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  v jsonb; x jsonb; v_cnt integer; v_msg text; v_big jsonb;
  v_lote jsonb := jsonb_build_array(
    jsonb_build_object('id','QA-P3-N-3-30','localId','QA-A1','nombre','P3 Tostada 3,30','precioVenta',0,'ivaVenta',10),
    jsonb_build_object('id','QA-P3-N-1-99','localId','QA-A1','nombre','P3 Pieza 1,99','precioVenta',1.99,'ivaVenta',21,'activo',false),
    jsonb_build_object('id','QA-P3-X-SINLOCAL','nombre','Sin local','precioVenta',1,'ivaVenta',10),
    jsonb_build_object('id','QA-P3-X-OTROLOCAL','localId','QA-A2','nombre','Otro local','precioVenta',1,'ivaVenta',10),
    jsonb_build_object('id','QA-P3-X-OTRAEMP','localId','QA-A1','empresaId','QA-EMP-B','nombre','Otra empresa','precioVenta',1,'ivaVenta',10),
    jsonb_build_object('id','QA-P3-X-SINNOMBRE','localId','QA-A1','precioVenta',1,'ivaVenta',10),
    jsonb_build_object('id','QA-P3-X-PRECIOMALO','localId','QA-A1','nombre','Precio malo','precioVenta','abc','ivaVenta',10),
    jsonb_build_object('id','QA-P3-X-IVAMALO','localId','QA-A1','nombre','IVA malo','precioVenta',1,'ivaVenta',150),
    jsonb_build_object('id','QA-P3-X-MP','localId','QA-A1','nombre','Materia prima','precioVenta',0,'ivaVenta',10),
    jsonb_build_object('id','QA-P3-X-DUP','localId','QA-A1','nombre','Duplicado','precioVenta',1,'ivaVenta',10),
    jsonb_build_object('id','QA-P3-X-DUP','localId','QA-A1','nombre','Duplicado 2','precioVenta',2,'ivaVenta',10),
    jsonb_build_object('nombre','Sin id','localId','QA-A1','precioVenta',1,'ivaVenta',10)
  );
begin
  v := pg_temp.paso('6.1 lote con desactivaciones y casos inválidos', k_u,
    format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', 'p3-lote-a1-0001', k_e, k_l, 'EUR', v_lote));
  perform pg_temp.ok('6.2 resumen: 2 desactivados, 1 creado (el duplicado válido), 9 omitidos',
    (v->'resumen'->>'desactivados')::int = 2 and (v->'resumen'->>'creados')::int = 1 and (v->'resumen'->>'omitidos')::int = 9, v->'resumen');
  perform pg_temp.ok('6.3 motivos de omisión correctos',
    (select jsonb_object_agg(coalesce(e->>'id', '(sin id)'), e->>'motivo') from jsonb_array_elements(v->'productos') e where e->>'resultado' = 'OMITIDO')
    @> '{"QA-P3-X-SINLOCAL":"sin_local","QA-P3-X-OTROLOCAL":"local_distinto","QA-P3-X-OTRAEMP":"empresa_distinta","QA-P3-X-SINNOMBRE":"nombre_requerido","QA-P3-X-PRECIOMALO":"precio_invalido","QA-P3-X-IVAMALO":"iva_invalido","QA-P3-X-MP":"no_vendible","(sin id)":"id_invalido"}'::jsonb,
    (select jsonb_agg(e) from jsonb_array_elements(v->'productos') e where e->>'resultado' = 'OMITIDO'));

  select count(*) into v_cnt from public.catalogo_tpv_productos
   where empresa_id = k_e and local_id = k_l and producto_id in ('QA-P3-N-3-30', 'QA-P3-N-1-99') and activo = false and version = 2;
  perform pg_temp.ok('6.4 los dos desactivados quedan inactivos con versión 2', v_cnt = 2, to_jsonb(v_cnt));
  begin
    perform private.abc_calcular_linea_tpv(k_e, k_l, 'QA-P3-N-3-30', 'EUR', 1);
    perform pg_temp.ok('6.5 un producto desactivado ya no se puede vender', false, null);
  exception when others then
    get stacked diagnostics v_msg = message_text;
    perform pg_temp.ok('6.5 un producto desactivado ya no se puede vender', v_msg = 'producto_tpv_no_disponible', to_jsonb(v_msg));
  end;
  select count(*) into v_cnt from public.catalogo_tpv_productos where empresa_id = k_e and local_id = k_l and producto_id in ('QA-P3-N-4-45', 'QA-P3-N-KG', 'QA-P3-N-ELAB') and activo;
  perform pg_temp.ok('6.6 lo que no venía en el lote sigue activo', v_cnt = 3, to_jsonb(v_cnt));

  perform pg_temp.paso('6.7 lista vacía', k_u, format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', 'p3-vacio-0001', k_e, k_l, 'EUR', '[]'), 'catalogo_productos_vacio');
  perform pg_temp.paso('6.8 no es una lista', k_u, format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', 'p3-objeto-0001', k_e, k_l, 'EUR', '{"id":"x"}'), 'catalogo_productos_formato_invalido');
  v_big := (select jsonb_agg(jsonb_build_object('id', 'QA-P3-B-' || n, 'localId', 'QA-A1', 'nombre', 'b', 'precioVenta', 1, 'ivaVenta', 10)) from generate_series(1, 201) n);
  perform pg_temp.paso('6.9 más de 200 productos', k_u, format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', 'p3-grande-0001', k_e, k_l, 'EUR', v_big), 'catalogo_productos_demasiados');
  perform pg_temp.paso('6.10 moneda inválida', k_u, format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', 'p3-moneda-0001', k_e, k_l, 'EU', v_lote), 'moneda_catalogo_invalida');
  perform pg_temp.paso('6.11 moneda sin contexto fiscal activo (USD)', k_u, format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', 'p3-usd-0001', k_e, k_l, 'USD', v_lote), 'catalogo_contexto_fiscal_ausente');

  -- Local sin contexto fiscal: el local B1 de la empresa B no tiene entidad fiscal vinculada.
  perform pg_temp.paso('6.12 local sin contexto fiscal (B1): no se puede guardar catálogo', k_u,
    format('select public.abc_catalogo_guardar_productos(%L,%L,%L,%L,%L::jsonb)', 'p3-sinfiscal-01', 'QA-EMP-B', 'QA-B1', 'EUR',
           '[{"id":"QA-P3-F-1","localId":"QA-B1","nombre":"x","precioVenta":1,"ivaVenta":10}]'), 'catalogo_contexto_fiscal_ausente');
end
$t$;

select jsonb_pretty(current_setting('la.log')::jsonb) as registro;
