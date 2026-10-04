-- Etapa 1 · siembra FICTICIA en QA (decisión D07 de la hoja de decisiones).
-- SOLO QA (qjqorixtkilwsndqayyx). Nunca se ejecuta en producción: se aborta si
-- el proyecto no tiene la huella de migraciones de QA o faltan los locales QA.
-- Atómico (un bloque DO) y no se mezcla con datos previos: si el alcance no está
-- vacío, se aborta sin escribir nada.
--
-- Qué siembra, para QA-EMP-A en Local A1 (QA-A1) y Local A2 (QA-A2):
--   · 15 artículos ficticios con precio BASE sin impuesto y un impuesto de ejemplo
--     del 10 % (el servidor suma el impuesto sobre el precio del catálogo).
--   · 3 grupos de opciones (tamaño/variante, extras de bebida y complementos de
--     bocadillo) con 9 opciones, enlazados a 9 artículos por local.
--   · Stock ficticio por artículo y local.
--   · La colección heredada `productos` en almacen_kv (con empresa_id explícito)
--     para que la pantalla de venta muestre los artículos: la pantalla los lista
--     desde esa colección y el servidor los valida contra el catálogo TPV.
--   · Regla de día operativo de PRUEBA (Europe/Madrid, corte 04:00) en A1 y A2.
--     No es la decisión D06 del local piloto.
--   · Solo en A1 (A2 ya los tiene de los datos de prueba A09): vínculo fiscal y
--     moneda EUR con la entidad fiscal simulada existente, una terminal TPV y una
--     caja física.
-- Marca de origen: QA_ETAPA1_2026-10-02. Reversión: 03_reversion.sql.

do $seed$
declare
  k_e   constant text := 'QA-EMP-A';
  k_ef  constant uuid := 'a0000000-0000-0000-0000-0000000000a2';
  k_tag constant text := 'QA_ETAPA1_2026-10-02';
  k_loc text;
  k_s   text;
  v_arr jsonb := '[]'::jsonb;
begin
  -- Guardas de identidad y de alcance.
  if (select count(*) from supabase_migrations.schema_migrations where name = 'abc_f5_pm09_security_hardening') <> 1
     or not exists (select 1 from public.locales where empresa_id = k_e and id = 'QA-A1')
     or not exists (select 1 from public.locales where empresa_id = k_e and id = 'QA-A2') then
    raise exception 'SIEMBRA_ABORTADA: el proyecto no parece QA';
  end if;
  if not exists (select 1 from public.entidades_fiscales where id = k_ef and empresa_id = k_e and activa)
     or not exists (select 1 from public.entidad_fiscal_monedas where empresa_id = k_e and entidad_fiscal_id = k_ef and currency_code = 'EUR' and activa) then
    raise exception 'SIEMBRA_ABORTADA: falta la entidad fiscal simulada de QA-EMP-A';
  end if;
  if exists (select 1 from public.catalogo_tpv_productos where empresa_id = k_e)
     or exists (select 1 from public.almacen_kv where key = 'productos')
     or exists (select 1 from private.abc_operating_day_reglas where empresa_id = k_e)
     or exists (select 1 from public.entidad_fiscal_locales where empresa_id = k_e and local_id = 'QA-A1')
     or exists (select 1 from public.terminales_tpv where empresa_id = k_e and local_id = 'QA-A1')
     or exists (select 1 from public.cajas_fisicas where empresa_id = k_e and local_id = 'QA-A1') then
    raise exception 'SIEMBRA_ABORTADA: ya hay datos en el alcance; no se mezcla';
  end if;

  -- Infraestructura de A1 (A2 ya la tiene).
  insert into public.entidad_fiscal_locales(empresa_id, local_id, entidad_fiscal_id, activa)
    values (k_e, 'QA-A1', k_ef, true);
  insert into public.entidad_fiscal_local_monedas(empresa_id, local_id, entidad_fiscal_id, currency_code, activa)
    values (k_e, 'QA-A1', k_ef, 'EUR', true);
  insert into public.terminales_tpv(id, empresa_id, local_id, nombre, device_key, activo, capacidades)
    values ('5e100000-0000-4000-8000-0000000000a1', k_e, 'QA-A1', 'QA terminal A1 (siembra etapa 1)', 'qa-etapa1-terminal-a1', true, jsonb_build_object('fixture', k_tag));
  insert into public.cajas_fisicas(id, empresa_id, local_id, nombre, activo)
    values ('5e200000-0000-4000-8000-0000000000a1', k_e, 'QA-A1', 'QA caja A1 (siembra etapa 1)', true);

  -- Definiciones (precios BASE sin impuesto; múltiplos de 0,10 para que el bruto
  -- con el 10 % tenga siempre 2 decimales exactos).
  create temp table _sp(code text, nombre text, categoria text, neto numeric, unidad text, fracc boolean, prec smallint) on commit drop;
  insert into _sp values
    ('CAFE-SOLO',    'Café solo (QA)',               'Cafés',      1.00, 'ud', false, 0),
    ('CAFE-LECHE',   'Café con leche (QA)',          'Cafés',      1.20, 'ud', false, 0),
    ('CAPUCHINO',    'Capuchino (QA)',               'Cafés',      1.50, 'ud', false, 0),
    ('AGUA',         'Agua 50 cl (QA)',              'Bebidas',    0.90, 'ud', false, 0),
    ('REFRESCO',     'Refresco en lata (QA)',        'Bebidas',    1.50, 'ud', false, 0),
    ('CANA',         'Caña de cerveza (QA)',         'Bebidas',    1.80, 'ud', false, 0),
    ('ZUMO',         'Zumo de naranja (QA)',         'Bebidas',    2.50, 'ud', false, 0),
    ('CROISSANT',    'Croissant (QA)',               'Bollería',   1.20, 'ud', false, 0),
    ('NAPOLITANA',   'Napolitana de chocolate (QA)', 'Bollería',   1.50, 'ud', false, 0),
    ('TOSTADA',      'Tostada con tomate (QA)',      'Desayunos',  2.00, 'ud', false, 0),
    ('BOC-JAMON',    'Bocadillo de jamón (QA)',      'Bocadillos', 4.50, 'ud', false, 0),
    ('BOC-TORTILLA', 'Bocadillo de tortilla (QA)',   'Bocadillos', 4.00, 'ud', false, 0),
    ('TARTA',        'Porción de tarta (QA)',        'Postres',    3.50, 'ud', false, 0),
    ('FLAN',         'Flan casero (QA)',             'Postres',    2.50, 'ud', false, 0),
    ('QUESO-KG',     'Queso al corte, por kg (QA)',  'Al peso',   18.00, 'kg', true,  3);

  create temp table _sg(code text, nombre text, tipo text, orden int) on commit drop;
  insert into _sg values
    ('TAM', 'QA Tamaño',                     'VARIANTE',    1),
    ('EXT', 'QA Extras de bebida',           'MODIFICADOR', 2),
    ('BOC', 'QA Complementos de bocadillo',  'MODIFICADOR', 3);

  create temp table _so(g text, code text, nombre text, tipo text, delta numeric, orden int) on commit drop;
  insert into _so values
    ('TAM', 'PEQ',    'Pequeño',          'VARIANTE',    0.00, 1),
    ('TAM', 'MED',    'Mediano',          'VARIANTE',    0.30, 2),
    ('TAM', 'GRA',    'Grande',           'VARIANTE',    0.60, 3),
    ('EXT', 'AVENA',  'Leche de avena',   'EXTRA',       0.20, 1),
    ('EXT', 'SHOT',   'Doble shot',       'EXTRA',       0.50, 2),
    ('EXT', 'SINLAC', 'Sin lactosa',      'SUSTITUCION', 0.00, 3),
    ('BOC', 'SINCEB', 'Sin cebolla',      'RETIRADA',    0.00, 1),
    ('BOC', 'QUESO',  'Extra de queso',   'EXTRA',       0.80, 2),
    ('BOC', 'INTEG',  'Pan integral',     'SUSTITUCION', 0.20, 3);

  create temp table _spg(p text, g text, mn smallint, mx smallint, orden int) on commit drop;
  insert into _spg values
    ('CAFE-SOLO',    'TAM', 1, 1, 1), ('CAFE-SOLO',  'EXT', 0, 2, 2),
    ('CAFE-LECHE',   'TAM', 1, 1, 1), ('CAFE-LECHE', 'EXT', 0, 2, 2),
    ('CAPUCHINO',    'TAM', 1, 1, 1), ('CAPUCHINO',  'EXT', 0, 2, 2),
    ('ZUMO',         'TAM', 1, 1, 1),
    ('BOC-JAMON',    'BOC', 0, 2, 1),
    ('BOC-TORTILLA', 'BOC', 0, 2, 1);

  foreach k_loc in array array['QA-A1', 'QA-A2'] loop
    k_s := right(k_loc, 2);

    insert into public.catalogo_tpv_productos(empresa_id, local_id, producto_id, currency_code, entidad_fiscal_id,
        nombre, unidad, fraccionable, precision_cantidad, precio_unitario, impuesto_pct, activo, version, snapshot_origen)
      select k_e, k_loc, 'QA-CAT-' || k_s || '-' || code, 'EUR', k_ef,
             nombre, unidad, fracc, prec, neto, 10, true, 1,
             jsonb_build_object('siembra', k_tag, 'precio_base_sin_impuesto', true)
      from _sp;

    insert into public.catalogo_tpv_grupos_opciones(id, empresa_id, local_id, nombre, tipo_grupo, orden)
      select md5(k_tag || k_loc || code)::uuid, k_e, k_loc, nombre, tipo, orden from _sg;

    insert into public.catalogo_tpv_opciones(id, empresa_id, local_id, grupo_id, currency_code, nombre, tipo_opcion,
        delta_precio, hereda_impuesto, impuesto_pct, max_cantidad, orden, snapshot_origen)
      select md5(k_tag || k_loc || g || code)::uuid, k_e, k_loc, md5(k_tag || k_loc || g)::uuid, 'EUR', nombre, tipo,
             delta, true, null, 1, orden, jsonb_build_object('siembra', k_tag)
      from _so;

    insert into public.catalogo_tpv_producto_grupos(empresa_id, local_id, producto_id, currency_code, grupo_id,
        min_selecciones, max_selecciones, orden)
      select k_e, k_loc, 'QA-CAT-' || k_s || '-' || p, 'EUR', md5(k_tag || k_loc || g)::uuid, mn, mx, orden
      from _spg;

    insert into public.stock_ubicacion(empresa_id, local_id, producto_id, almacen, piso, minimo,
        fraccionable, precision_cantidad, local_operable, unidad)
      select k_e, k_loc, 'QA-CAT-' || k_s || '-' || code,
             case when fracc then 20 else 100 end, case when fracc then 5 else 50 end, case when fracc then 1 else 5 end,
             fracc, prec, true, unidad
      from _sp;

    v_arr := v_arr || (
      select jsonb_agg(jsonb_build_object(
        'id', 'QA-CAT-' || k_s || '-' || code, 'localId', k_loc, 'codigo', code, 'nombre', nombre,
        'categoria', categoria, 'unidad', case when unidad = 'ud' then 'unidad' else unidad end,
        'tipo', 'materia_prima', 'costo', 0,
        'precioVenta', round(neto * 1.10, 2), 'ivaVenta', 10,
        'stock', case when fracc then 25 else 150 end,
        'stockPisoVenta', case when fracc then 5 else 50 end,
        'stockMinimo', case when fracc then 1 else 5 end,
        'activo', true, 'fraccionable', fracc, 'precisionCantidad', prec
      ) order by code) from _sp);
  end loop;

  -- Colección heredada que lista los artículos en la pantalla (precioVenta CON IVA).
  insert into public.almacen_kv(key, value, empresa_id) values ('productos', v_arr, k_e);

  -- Regla de día operativo de PRUEBA (no es la decisión D06 del local piloto).
  insert into private.abc_operating_day_reglas(empresa_id, local_id, version, timezone_name, cutoff_time, vigente_desde, motivo)
    select k_e, l, 1, 'Europe/Madrid', time '04:00', timestamptz '2026-09-01 00:00:00+00', 'QA_SIEMBRA_ETAPA1_2026-10-02'
    from unnest(array['QA-A1', 'QA-A2']) as l;
end
$seed$;
