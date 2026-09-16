-- P2-R02-C — alinear ACL de helpers SECURITY DEFINER privados en QA
-- Estado vivo objetivo: paridad de EXECUTE con PROD sin cambiar cuerpos, RLS ni schemas.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $p2_r02_qa_preflight$
DECLARE
  r regprocedure;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'private.pm06_proteger_identidad_y_total()'::regprocedure,
    'private.pm06_proyectar_gasto_factura()'::regprocedure,
    'private.pm06_puede_gestionar_finanzas()'::regprocedure,
    'private.pm06_total_factura(text,text,text,text)'::regprocedure,
    'private.pm06_validar_proveedor_compatible()'::regprocedure,
    'private.pm07_puede_gestionar_stock()'::regprocedure,
    'private.pm07_puede_vender()'::regprocedure,
    'private.pm14_total_encargo(text,text,text)'::regprocedure
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid=r::oid AND p.prosecdef) THEN
      RAISE EXCEPTION 'P2-R02 QA PREFLIGHT_FALLO: % no es SECURITY DEFINER', r;
    END IF;
    IF NOT has_function_privilege('authenticated', r, 'EXECUTE') THEN
      RAISE EXCEPTION 'P2-R02 QA PREFLIGHT_FALLO: authenticated ya no tiene EXECUTE sobre %', r;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE (coalesce(p.qual,'') || ' ' || coalesce(p.with_check,'')) ~
      '(pm06_proteger_identidad_y_total|pm06_proyectar_gasto_factura|pm06_total_factura|pm06_validar_proveedor_compatible|pm07_puede_gestionar_stock|pm07_puede_vender|pm14_total_encargo)'
  ) THEN
    RAISE EXCEPTION 'P2-R02 QA PREFLIGHT_FALLO: una helper a cerrar aparece directamente en una policy';
  END IF;
END
$p2_r02_qa_preflight$;

REVOKE EXECUTE ON FUNCTION private.pm06_proteger_identidad_y_total() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.pm06_proyectar_gasto_factura() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.pm06_total_factura(text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.pm06_validar_proveedor_compatible() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.pm07_puede_gestionar_stock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.pm07_puede_vender() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.pm14_total_encargo(text,text,text) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION private.pm06_puede_gestionar_finanzas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.pm06_puede_gestionar_finanzas() TO authenticated;

DO $p2_r02_qa_postflight$
DECLARE
  r regprocedure;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'private.pm06_proteger_identidad_y_total()'::regprocedure,
    'private.pm06_proyectar_gasto_factura()'::regprocedure,
    'private.pm06_total_factura(text,text,text,text)'::regprocedure,
    'private.pm06_validar_proveedor_compatible()'::regprocedure,
    'private.pm07_puede_gestionar_stock()'::regprocedure,
    'private.pm07_puede_vender()'::regprocedure,
    'private.pm14_total_encargo(text,text,text)'::regprocedure
  ] LOOP
    IF has_function_privilege('authenticated', r, 'EXECUTE')
       OR has_function_privilege('anon', r, 'EXECUTE') THEN
      RAISE EXCEPTION 'P2-R02 QA POSTFLIGHT_FALLO: persiste EXECUTE cliente sobre %', r;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid=r::oid AND p.prosecdef) THEN
      RAISE EXCEPTION 'P2-R02 QA POSTFLIGHT_FALLO: % dejó de ser SECURITY DEFINER', r;
    END IF;
  END LOOP;

  r := 'private.pm06_puede_gestionar_finanzas()'::regprocedure;
  IF NOT has_function_privilege('authenticated', r, 'EXECUTE') THEN
    RAISE EXCEPTION 'P2-R02 QA POSTFLIGHT_FALLO: helper financiera perdió EXECUTE authenticated';
  END IF;
  IF has_function_privilege('anon', r, 'EXECUTE') THEN
    RAISE EXCEPTION 'P2-R02 QA POSTFLIGHT_FALLO: helper financiera conserva EXECUTE anon';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid=r::oid AND p.prosecdef) THEN
    RAISE EXCEPTION 'P2-R02 QA POSTFLIGHT_FALLO: helper financiera dejó de ser SECURITY DEFINER';
  END IF;
END
$p2_r02_qa_postflight$;

COMMIT;
