-- PM13-P01 — serializa altas concurrentes con la misma identidad antes del INSERT.

CREATE OR REPLACE FUNCTION public.pm11_alta_empleado(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text,
  p_nombre text,
  p_datos jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_empleado public.empleados%rowtype;
  v_datos jsonb;
  v_operation_id text := nullif(btrim(coalesce(p_datos->>'pm13AltaOperationId', '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) THEN
    RAISE EXCEPTION 'personal_contexto_no_autorizado';
  END IF;
  IF nullif(btrim(p_empleado_id), '') IS NULL THEN
    RAISE EXCEPTION 'empleado_id_requerido';
  END IF;
  IF upper(btrim(p_local_id)) IN ('TODOS', 'TODOS LOS LOCALES') THEN
    RAISE EXCEPTION 'personal_local_concreto_requerido';
  END IF;
  IF nullif(btrim(p_nombre), '') IS NULL THEN
    RAISE EXCEPTION 'empleado_nombre_requerido';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pm13:empleado:alta:' || p_empresa_id || ':' || p_local_id || ':' || p_empleado_id, 0)
  );

  SELECT * INTO v_empleado
    FROM public.empleados e
   WHERE e.id = p_empleado_id
   FOR UPDATE;

  IF FOUND THEN
    IF v_operation_id IS NOT NULL
       AND v_empleado.empresa_id = p_empresa_id
       AND v_empleado.local_id = p_local_id
       AND v_empleado.datos->>'pm13AltaOperationId' = v_operation_id THEN
      RETURN jsonb_build_object('ok', true, 'yaCreado', true, 'empleado', to_jsonb(v_empleado));
    END IF;
    RAISE EXCEPTION 'empleado_id_ya_existe';
  END IF;

  PERFORM private.pm11_validar_datos_laborales(coalesce(p_datos, '{}'::jsonb));
  v_datos := coalesce(p_datos, '{}'::jsonb)
    || jsonb_build_object(
      'id', p_empleado_id,
      'empresaId', p_empresa_id,
      'localId', p_local_id,
      'nombre', btrim(p_nombre),
      'activo', true,
      'estado', 'activo'
    );

  INSERT INTO public.empleados(id, empresa_id, local_id, estado, nombre, datos)
  VALUES (p_empleado_id, p_empresa_id, p_local_id, 'activo', btrim(p_nombre), v_datos)
  RETURNING * INTO v_empleado;

  PERFORM private.pm11_auditar_empleado(
    'Personal · alta empleado', p_empleado_id, p_empresa_id, p_local_id,
    jsonb_build_object('estadoNuevo', 'activo', 'operationIdInformado', v_operation_id IS NOT NULL)
  );

  RETURN jsonb_build_object('ok', true, 'yaCreado', false, 'empleado', to_jsonb(v_empleado));
END;
$function$;

REVOKE ALL ON FUNCTION public.pm11_alta_empleado(text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pm11_alta_empleado(text,text,text,text,jsonb) TO authenticated;
