-- Etapa 1 · reversión de la siembra ficticia (SOLO QA). Deshace exactamente lo que
-- creó 01_siembra.sql, por marca y por identificadores fijos. Atómico: si algo
-- depende de la siembra (líneas de pedido, movimientos de stock o sesiones de caja
-- sobre la terminal/caja sembradas) las claves foráneas o las guardas lo impiden y
-- no se borra nada. No toca ninguna otra fila.
--
-- Línea base antes de la siembra (QA, 2/10/2026): catalogo_tpv_productos 0,
-- stock_ubicacion 53, almacen_kv 24 (sin clave `productos`), abc_operating_day_reglas 0,
-- entidad_fiscal_locales 1, terminales_tpv 1, cajas_fisicas 1.

do $rev$
declare
  k_e   constant text := 'QA-EMP-A';
  k_ef  constant uuid := 'a0000000-0000-0000-0000-0000000000a2';
  k_tag constant text := 'QA_ETAPA1_2026-10-02';
begin
  if (select count(*) from supabase_migrations.schema_migrations where name = 'abc_f5_pm09_security_hardening') <> 1 then
    raise exception 'REVERSION_ABORTADA: el proyecto no parece QA';
  end if;
  if exists (select 1 from public.pedido_lineas where producto_id like 'QA-CAT-%')
     or exists (select 1 from public.movimientos_stock where producto_id like 'QA-CAT-%') then
    raise exception 'REVERSION_ABORTADA: hay actividad sobre los artículos sembrados';
  end if;

  delete from public.catalogo_tpv_producto_grupos where empresa_id = k_e and producto_id like 'QA-CAT-%';
  delete from public.catalogo_tpv_opciones        where empresa_id = k_e and snapshot_origen->>'siembra' = k_tag;
  delete from public.catalogo_tpv_grupos_opciones
    where empresa_id = k_e
      and id in (select md5(k_tag || l || c)::uuid
                 from unnest(array['QA-A1', 'QA-A2']) l, unnest(array['TAM', 'EXT', 'BOC']) c);
  delete from public.catalogo_tpv_productos       where empresa_id = k_e and snapshot_origen->>'siembra' = k_tag;
  delete from public.stock_ubicacion              where empresa_id = k_e and producto_id like 'QA-CAT-%';
  delete from public.almacen_kv                   where key = 'productos' and empresa_id = k_e and (value->0->>'id') like 'QA-CAT-%';
  delete from private.abc_operating_day_reglas    where empresa_id = k_e and motivo = 'QA_SIEMBRA_ETAPA1_2026-10-02';

  delete from public.cajas_fisicas                where id = '5e200000-0000-4000-8000-0000000000a1' and empresa_id = k_e and local_id = 'QA-A1';
  delete from public.terminales_tpv               where id = '5e100000-0000-4000-8000-0000000000a1' and empresa_id = k_e and local_id = 'QA-A1';
  delete from public.entidad_fiscal_local_monedas where empresa_id = k_e and local_id = 'QA-A1' and entidad_fiscal_id = k_ef and currency_code = 'EUR';
  delete from public.entidad_fiscal_locales       where empresa_id = k_e and local_id = 'QA-A1' and entidad_fiscal_id = k_ef;
end
$rev$;
