-- P2-R02 — hardening de SECURITY DEFINER legacy en PROD
-- Objetivo: retirar la superficie RPC autenticada de dos funciones legacy
-- sin borrar funciones ni modificar su lógica.
--
-- IMPORTANTE: esta migración se prepara como candidato. No prueba por sí sola
-- que se haya aplicado en ningún proyecto Supabase.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- PRE-FLIGHT estricto: rechaza drift y también una reaplicación silenciosa.
DO $p2_r02_preflight$
DECLARE
  v_oid oid;
BEGIN
  v_oid := to_regprocedure('public.descontar_stock_carrito(jsonb,text)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'P2-R02 PREFLIGHT_FALLO: falta public.descontar_stock_carrito(jsonb,text)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = v_oid
      AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'P2-R02 PREFLIGHT_FALLO: descontar_stock_carrito ya no es SECURITY DEFINER';
  END IF;

  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'P2-R02 PREFLIGHT_FALLO: authenticated ya no tiene EXECUTE sobre descontar_stock_carrito';
  END IF;

  IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'P2-R02 PREFLIGHT_FALLO: anon tiene EXECUTE inesperado sobre descontar_stock_carrito';
  END IF;

  v_oid := to_regprocedure('public.anular_venta_tpv(text,text)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'P2-R02 PREFLIGHT_FALLO: falta public.anular_venta_tpv(text,text)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = v_oid
      AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'P2-R02 PREFLIGHT_FALLO: anular_venta_tpv ya no es SECURITY DEFINER';
  END IF;

  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'P2-R02 PREFLIGHT_FALLO: authenticated ya no tiene EXECUTE sobre anular_venta_tpv';
  END IF;

  IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'P2-R02 PREFLIGHT_FALLO: anon tiene EXECUTE inesperado sobre anular_venta_tpv';
  END IF;
END
$p2_r02_preflight$;

-- Cambio mínimo: solo ACL de ejecución del rol authenticated.
REVOKE EXECUTE ON FUNCTION public.descontar_stock_carrito(jsonb, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.anular_venta_tpv(text, text) FROM authenticated;

-- POST-FLIGHT: las funciones deben seguir existiendo y seguir siendo
-- SECURITY DEFINER, pero ya no deben ser invocables por anon/authenticated.
DO $p2_r02_postflight$
DECLARE
  v_oid oid;
BEGIN
  v_oid := to_regprocedure('public.descontar_stock_carrito(jsonb,text)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'P2-R02 POSTFLIGHT_FALLO: desapareció descontar_stock_carrito';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = v_oid AND p.prosecdef) THEN
    RAISE EXCEPTION 'P2-R02 POSTFLIGHT_FALLO: cambió SECURITY DEFINER en descontar_stock_carrito';
  END IF;

  IF has_function_privilege('authenticated', v_oid, 'EXECUTE')
     OR has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'P2-R02 POSTFLIGHT_FALLO: persiste EXECUTE cliente en descontar_stock_carrito';
  END IF;

  v_oid := to_regprocedure('public.anular_venta_tpv(text,text)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'P2-R02 POSTFLIGHT_FALLO: desapareció anular_venta_tpv';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = v_oid AND p.prosecdef) THEN
    RAISE EXCEPTION 'P2-R02 POSTFLIGHT_FALLO: cambió SECURITY DEFINER en anular_venta_tpv';
  END IF;

  IF has_function_privilege('authenticated', v_oid, 'EXECUTE')
     OR has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'P2-R02 POSTFLIGHT_FALLO: persiste EXECUTE cliente en anular_venta_tpv';
  END IF;
END
$p2_r02_postflight$;

COMMIT;
