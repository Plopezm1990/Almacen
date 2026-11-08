-- Etapa 1 · verificación de la siembra. Pensada para ejecutarse DENTRO de una
-- transacción que termina en ROLLBACK (begin; 01_siembra [solo en el ensayo en
-- seco]; 02_verificacion; select registro; rollback;). Suplanta usuarios ya
-- existentes de QA a nivel de base de datos (set local role + claims JWT); no hay
-- inicio de sesión real, ni PostgREST, ni navegador. Todo lo que escribe (sesión
-- de caja, cuenta, pedido, líneas) se revierte.

select set_config('la.log', '[]', true);

create function pg_temp.log(p_paso text, p_res text, p_det jsonb default null) returns void language plpgsql as $f$
begin
  perform set_config('la.log', (coalesce(nullif(current_setting('la.log', true), ''), '[]')::jsonb
    || jsonb_build_array(jsonb_build_object('paso', p_paso, 'res', p_res, 'det', p_det)))::text, true);
end $f$;

create function pg_temp.as_user(p_uid text, p_rol text default 'authenticated') returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_rol)::text, true);
  perform set_config('request.jwt.claim.sub', p_uid, true);
  execute 'set local role ' || quote_ident(p_rol);
end $f$;

create function pg_temp.paso(p_nombre text, p_uid text, p_sql text, p_espera text default null) returns jsonb language plpgsql as $f$
declare v_res jsonb; v_msg text; v_state text;
begin
  begin
    perform pg_temp.as_user(p_uid);
    execute p_sql into v_res;
    execute 'reset role';
    perform pg_temp.log(p_nombre, case when p_espera is null then 'OK' else 'NEGATIVA_NO_RECHAZADA' end, to_jsonb(left(coalesce(v_res::text, 'null'), 900)));
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

do $v$
declare
  k_e    constant text := 'QA-EMP-A';
  k_l    constant text := 'QA-A1';
  k_tag  constant text := 'QA_ETAPA1_2026-10-02';
  k_u    constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';  -- Propietario A+B
  k_ucaj constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';  -- Cajero/a A1
  k_ucam constant text := '58056afa-6ad6-4ff1-919c-2b3a37540e98';  -- Camarero/a A1
  k_uenc constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';  -- Encargado A2
  k_ub   constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';  -- Propietario solo de la empresa B
  k_t    constant text := '5e100000-0000-4000-8000-0000000000a1';
  k_c    constant text := '5e200000-0000-4000-8000-0000000000a1';
  k_ses  constant text := '5e300000-0000-4000-8000-000000000001';
  k_cue  constant text := '5e300000-0000-4000-8000-000000000002';
  k_ped  constant text := '5e300000-0000-4000-8000-000000000003';
  k_l1   constant text := '5e300000-0000-4000-8000-000000000004';
  k_l2   constant text := '5e300000-0000-4000-8000-000000000005';
  k_l3   constant text := '5e300000-0000-4000-8000-000000000006';
  k_l4   constant text := '5e300000-0000-4000-8000-000000000007';
  v_day date := ((now() at time zone 'Europe/Madrid') - interval '4 hours')::date;
  v_cv bigint; v_pv bigint; v_sel jsonb; v_sel_sin jsonb; v_sel_peq jsonb;
  q_lect constant text := $q$select jsonb_build_object(
      'cat_a1',(select count(*) from public.catalogo_tpv_productos where empresa_id='QA-EMP-A' and local_id='QA-A1'),
      'cat_a2',(select count(*) from public.catalogo_tpv_productos where empresa_id='QA-EMP-A' and local_id='QA-A2'),
      'grupos_a1',(select count(*) from public.catalogo_tpv_grupos_opciones where empresa_id='QA-EMP-A' and local_id='QA-A1'),
      'opciones_a1',(select count(*) from public.catalogo_tpv_opciones where empresa_id='QA-EMP-A' and local_id='QA-A1'),
      'prodgrupos_a1',(select count(*) from public.catalogo_tpv_producto_grupos where empresa_id='QA-EMP-A' and local_id='QA-A1'),
      'stock_qa_cat_a1',(select count(*) from public.stock_ubicacion where empresa_id='QA-EMP-A' and local_id='QA-A1' and producto_id like 'QA-CAT-%'),
      'kv_productos',(select jsonb_array_length(value) from public.almacen_kv where key='productos'))$q$;
begin
  -- Lecturas con RLS real (por rol).
  perform pg_temp.paso('L1 Propietario A+B lee catálogo, opciones, stock y productos (KV)', k_u, q_lect);
  perform pg_temp.paso('L2 Cajero A1: ve A1 y no A2', k_ucaj, q_lect);
  perform pg_temp.paso('L3 Encargado A2: ve A2 y no A1', k_uenc, q_lect);
  perform pg_temp.paso('L4 Propietario solo de la empresa B: no ve nada de A', k_ub, q_lect);

  -- Circuito ABC con el catálogo sembrado (Local A1, Propietario).
  perform pg_temp.paso('S1 abrir sesión de caja A1 (fondo 100) con la terminal y caja sembradas', k_u,
    format('select to_jsonb(public.abc_abrir_sesion_caja(%L,%L,%L,%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L,%s,%L::date))',
           'QA-E1-S1', k_e, k_l, k_ses, k_c, k_u, k_t, 'EUR', 100, v_day));
  perform pg_temp.paso('S2 abrir cuenta BARRA', k_u,
    format('select to_jsonb(public.abc_abrir_cuenta(%L,%L,%L,%L::uuid,%L,%L,%L::uuid,%L::uuid,%L::uuid,%L::date))',
           'QA-E1-S2', k_e, k_l, k_cue, 'BARRA', 'EUR', k_u, k_t, k_ses, v_day));
  select version into v_cv from public.cuentas_comerciales where id = k_cue::uuid;
  perform pg_temp.paso('S3 crear pedido', k_u,
    format('select to_jsonb(public.abc_crear_pedido(%L,%L,%L,%L::uuid,%L::uuid,%s,%L::uuid,%L::uuid,%L::date))',
           'QA-E1-S3', k_e, k_l, k_ped, k_cue, coalesce(v_cv, 0), k_t, k_ses, v_day));

  -- Línea simple: 2 x Café solo (precio base 1,00; impuesto 10 %): esperado base 2,00, impuestos 0,20, total 2,20.
  select version into v_pv from public.pedidos_tpv where id = k_ped::uuid;
  perform pg_temp.paso('S4 agregar 3 x Agua (artículo sin grupos, vía simple)', k_u,
    format('select to_jsonb(public.abc_agregar_linea_pedido(%L,%L,%L,%L::uuid,%L::uuid,%L,%s,%s,%L::uuid,%L::uuid,%L::date))',
           'QA-E1-S4', k_e, k_l, k_l1, k_ped, 'QA-CAT-A1-AGUA', 3, coalesce(v_pv, 0), k_t, k_ses, v_day));
  select version into v_pv from public.pedidos_tpv where id = k_ped::uuid;
  perform pg_temp.paso('N5 café solo por la vía simple (exige elegir tamaño: debe pedir la vía configurada)', k_u,
    format('select to_jsonb(public.abc_agregar_linea_pedido(%L,%L,%L,%L::uuid,%L::uuid,%L,%s,%s,%L::uuid,%L::uuid,%L::date))',
           'QA-E1-N5', k_e, k_l, '5e300000-0000-4000-8000-0000000000f4', k_ped, 'QA-CAT-A1-CAFE-SOLO', 2, coalesce(v_pv, 0), k_t, k_ses, v_day), 'configuracion_requerida');

  -- Cantidad fraccionable: 0,250 kg de queso (18,00 por kg): esperado base 4,50, impuestos 0,45, total 4,95.
  select version into v_pv from public.pedidos_tpv where id = k_ped::uuid;
  perform pg_temp.paso('S5 agregar 0,250 kg de queso al corte (fraccionable)', k_u,
    format('select to_jsonb(public.abc_agregar_linea_pedido(%L,%L,%L,%L::uuid,%L::uuid,%L,%s,%s,%L::uuid,%L::uuid,%L::date))',
           'QA-E1-S5', k_e, k_l, k_l2, k_ped, 'QA-CAT-A1-QUESO-KG', 0.250, coalesce(v_pv, 0), k_t, k_ses, v_day));
  select version into v_pv from public.pedidos_tpv where id = k_ped::uuid;
  perform pg_temp.paso('N1 cantidad con más decimales que la precisión (0,2505 kg)', k_u,
    format('select to_jsonb(public.abc_agregar_linea_pedido(%L,%L,%L,%L::uuid,%L::uuid,%L,%s,%s,%L::uuid,%L::uuid,%L::date))',
           'QA-E1-N1', k_e, k_l, '5e300000-0000-4000-8000-0000000000f1', k_ped, 'QA-CAT-A1-QUESO-KG', 0.2505, coalesce(v_pv, 0), k_t, k_ses, v_day), '');
  perform pg_temp.paso('N2 cantidad fraccionada en un artículo por unidades (1,5 cafés)', k_u,
    format('select to_jsonb(public.abc_agregar_linea_pedido(%L,%L,%L,%L::uuid,%L::uuid,%L,%s,%s,%L::uuid,%L::uuid,%L::date))',
           'QA-E1-N2', k_e, k_l, '5e300000-0000-4000-8000-0000000000f2', k_ped, 'QA-CAT-A1-CAFE-SOLO', 1.5, coalesce(v_pv, 0), k_t, k_ses, v_day), '');
  perform pg_temp.paso('N3 artículo que no está en el catálogo', k_u,
    format('select to_jsonb(public.abc_agregar_linea_pedido(%L,%L,%L,%L::uuid,%L::uuid,%L,%s,%s,%L::uuid,%L::uuid,%L::date))',
           'QA-E1-N3', k_e, k_l, '5e300000-0000-4000-8000-0000000000f3', k_ped, 'QA-CAT-A1-NO-EXISTE', 1, coalesce(v_pv, 0), k_t, k_ses, v_day), '');

  -- Variantes: capuchino (1,50) + tamaño Mediano (+0,30) + extra Leche de avena (+0,20): base esperada 2,00.
  v_sel := jsonb_build_array(
    jsonb_build_object('grupo_id', md5(k_tag || k_l || 'TAM')::uuid, 'opcion_id', md5(k_tag || k_l || 'TAM' || 'MED')::uuid, 'cantidad', 1,
                       'expected_group_version', 1, 'expected_product_group_version', 1, 'expected_option_version', 1),
    jsonb_build_object('grupo_id', md5(k_tag || k_l || 'EXT')::uuid, 'opcion_id', md5(k_tag || k_l || 'EXT' || 'AVENA')::uuid, 'cantidad', 1,
                       'expected_group_version', 1, 'expected_product_group_version', 1, 'expected_option_version', 1));
  v_sel_sin := jsonb_build_array(
    jsonb_build_object('grupo_id', md5(k_tag || k_l || 'EXT')::uuid, 'opcion_id', md5(k_tag || k_l || 'EXT' || 'AVENA')::uuid, 'cantidad', 1,
                       'expected_group_version', 1, 'expected_product_group_version', 1, 'expected_option_version', 1));
  v_sel_peq := jsonb_build_array(
    jsonb_build_object('grupo_id', md5(k_tag || k_l || 'TAM')::uuid, 'opcion_id', md5(k_tag || k_l || 'TAM' || 'PEQ')::uuid, 'cantidad', 1,
                       'expected_group_version', 1, 'expected_product_group_version', 1, 'expected_option_version', 1));
  select version into v_pv from public.pedidos_tpv where id = k_ped::uuid;
  perform pg_temp.paso('S6 agregar capuchino con tamaño Mediano y leche de avena', k_u,
    format('select to_jsonb(public.abc_agregar_linea_pedido_configurada(%L,%L,%L,%L::uuid,%L::uuid,%L,%s,%s,%L::jsonb,%s,%L::uuid,%L::uuid,%L::date))',
           'QA-E1-S6', k_e, k_l, k_l3, k_ped, 'QA-CAT-A1-CAPUCHINO', 1, 1, v_sel, coalesce(v_pv, 0), k_t, k_ses, v_day));
  select version into v_pv from public.pedidos_tpv where id = k_ped::uuid;
  perform pg_temp.paso('N4 capuchino sin elegir el tamaño obligatorio', k_u,
    format('select to_jsonb(public.abc_agregar_linea_pedido_configurada(%L,%L,%L,%L::uuid,%L::uuid,%L,%s,%s,%L::jsonb,%s,%L::uuid,%L::uuid,%L::date))',
           'QA-E1-N4', k_e, k_l, k_l4, k_ped, 'QA-CAT-A1-CAPUCHINO', 1, 1, v_sel_sin, coalesce(v_pv, 0), k_t, k_ses, v_day), 'grupo_min_selecciones_incumplido');

  select version into v_pv from public.pedidos_tpv where id = k_ped::uuid;
  perform pg_temp.paso('S7 agregar 2 x Café solo, tamaño Pequeño (vía configurada)', k_u,
    format('select to_jsonb(public.abc_agregar_linea_pedido_configurada(%L,%L,%L,%L::uuid,%L::uuid,%L,%s,%s,%L::jsonb,%s,%L::uuid,%L::uuid,%L::date))',
           'QA-E1-S7', k_e, k_l, '5e300000-0000-4000-8000-000000000008', k_ped, 'QA-CAT-A1-CAFE-SOLO', 2, 1, v_sel_peq, coalesce(v_pv, 0), k_t, k_ses, v_day));

  -- Valores calculados por el servidor.
  perform pg_temp.log('INFO líneas del pedido (valores del servidor)', 'INFO',
    (select jsonb_agg(jsonb_build_object('linea', substr(pl.id::text, 33), 'producto', pl.producto_id, 'cantidad', pl.cantidad,
        'precio_unitario', pl.precio_unitario, 'base', pl.base, 'impuestos', pl.impuestos, 'total', pl.total, 'estado', pl.estado) order by pl.id)
     from public.pedido_lineas pl where pl.pedido_id = k_ped::uuid));
end
$v$;
