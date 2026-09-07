-- PM13-P04 — ausencias trazables sobre la entidad existente public.empleados.
-- No crea una segunda entidad de Personal: persiste en empleados.datos->ausencias.

DO $$
BEGIN
  IF to_regclass('public.empleados') IS NULL THEN
    RAISE EXCEPTION 'pm13_p04_requiere_pm11_empleados';
  END IF;
  IF to_regprocedure('private.pm11_puede_mutar_personal(text,text)') IS NULL
     OR to_regprocedure('private.pm11_auditar_empleado(text,text,text,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'pm13_p04_requiere_motor_pm11_personal';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.pm13_registrar_ausencia(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text,
  p_ausencia_id text,
  p_tipo text,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_operation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_empleado public.empleados%rowtype;
  v_ausencias jsonb;
  v_existente jsonb;
  v_nueva jsonb;
  v_tipo text;
  v_operation_id text := nullif(btrim(coalesce(p_operation_id, '')), '');
  v_ausencia_id text := nullif(btrim(coalesce(p_ausencia_id, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) THEN
    RAISE EXCEPTION 'personal_contexto_no_autorizado';
  END IF;
  IF nullif(btrim(coalesce(p_empresa_id, '')), '') IS NULL
     OR nullif(btrim(coalesce(p_local_id, '')), '') IS NULL
     OR upper(btrim(p_local_id)) IN ('TODOS', 'TODOS LOS LOCALES') THEN
    RAISE EXCEPTION 'personal_local_concreto_requerido';
  END IF;
  IF nullif(btrim(coalesce(p_empleado_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'empleado_id_requerido';
  END IF;
  IF v_ausencia_id IS NULL OR v_operation_id IS NULL THEN
    RAISE EXCEPTION 'ausencia_identidad_operacion_requerida';
  END IF;
  IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL OR p_fecha_fin < p_fecha_inicio THEN
    RAISE EXCEPTION 'ausencia_rango_fechas_invalido';
  END IF;

  v_tipo := CASE lower(btrim(coalesce(p_tipo, '')))
    WHEN 'vacaciones' THEN 'Vacaciones'
    WHEN 'baja médica' THEN 'Baja médica'
    WHEN 'baja medica' THEN 'Baja médica'
    WHEN 'otro' THEN 'Otro'
    ELSE NULL
  END;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'ausencia_tipo_invalido';
  END IF;

  SELECT * INTO v_empleado
    FROM public.empleados e
   WHERE e.id = p_empleado_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'empleado_no_encontrado';
  END IF;
  IF v_empleado.empresa_id <> p_empresa_id OR v_empleado.local_id <> p_local_id THEN
    RAISE EXCEPTION 'empleado_contexto_no_coincide';
  END IF;
  IF v_empleado.estado <> 'activo' THEN
    RAISE EXCEPTION 'empleado_no_activo';
  END IF;

  v_ausencias := coalesce(v_empleado.datos->'ausencias', '[]'::jsonb);
  IF jsonb_typeof(v_ausencias) <> 'array' THEN
    RAISE EXCEPTION 'ausencias_legacy_formato_invalido';
  END IF;

  SELECT a INTO v_existente
    FROM jsonb_array_elements(v_ausencias) a
   WHERE a->>'operationId' = v_operation_id
   LIMIT 1;

  IF v_existente IS NOT NULL THEN
    IF v_existente->>'id' = v_ausencia_id
       AND v_existente->>'tipo' = v_tipo
       AND v_existente->>'fechaInicio' = p_fecha_inicio::text
       AND v_existente->>'fechaFin' = p_fecha_fin::text THEN
      RETURN jsonb_build_object('ok', true, 'replay', true, 'ausencia', v_existente);
    END IF;
    RAISE EXCEPTION 'ausencia_operation_id_conflicto';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_ausencias) a
     WHERE a->>'id' = v_ausencia_id
  ) THEN
    RAISE EXCEPTION 'ausencia_id_ya_existe';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_ausencias) a
     WHERE coalesce(upper(a->>'estado'), 'ACTIVA') <> 'ANULADA'
       AND nullif(a->>'anuladaAt', '') IS NULL
       AND coalesce(a->>'fechaInicio', '') ~ '^\d{4}-\d{2}-\d{2}$'
       AND coalesce(a->>'fechaFin', '') ~ '^\d{4}-\d{2}-\d{2}$'
       AND a->>'fechaInicio' <= p_fecha_fin::text
       AND a->>'fechaFin' >= p_fecha_inicio::text
  ) THEN
    RAISE EXCEPTION 'ausencia_solapada';
  END IF;

  v_nueva := jsonb_build_object(
    'id', v_ausencia_id,
    'tipo', v_tipo,
    'fechaInicio', p_fecha_inicio::text,
    'fechaFin', p_fecha_fin::text,
    'dias', (p_fecha_fin - p_fecha_inicio) + 1,
    'estado', 'ACTIVA',
    'operationId', v_operation_id,
    'creadaAt', now(),
    'creadaPor', auth.uid()::text
  );

  UPDATE public.empleados
     SET datos = jsonb_set(v_empleado.datos, '{ausencias}', v_ausencias || jsonb_build_array(v_nueva), true)
   WHERE id = v_empleado.id
  RETURNING * INTO v_empleado;

  PERFORM private.pm11_auditar_empleado(
    'Personal · registrar ausencia', v_empleado.id, v_empleado.empresa_id, v_empleado.local_id,
    jsonb_build_object(
      'ausenciaId', v_ausencia_id,
      'tipo', v_tipo,
      'fechaInicio', p_fecha_inicio,
      'fechaFin', p_fecha_fin,
      'dias', (p_fecha_fin - p_fecha_inicio) + 1,
      'operationId', v_operation_id
    )
  );

  RETURN jsonb_build_object('ok', true, 'replay', false, 'ausencia', v_nueva);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pm13_anular_ausencia(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text,
  p_ausencia_id text,
  p_operation_id text,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_empleado public.empleados%rowtype;
  v_ausencias jsonb;
  v_existente jsonb;
  v_actualizada jsonb;
  v_objetivo jsonb;
  v_operation_id text := nullif(btrim(coalesce(p_operation_id, '')), '');
  v_ausencia_id text := nullif(btrim(coalesce(p_ausencia_id, '')), '');
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) THEN
    RAISE EXCEPTION 'personal_contexto_no_autorizado';
  END IF;
  IF nullif(btrim(coalesce(p_empresa_id, '')), '') IS NULL
     OR nullif(btrim(coalesce(p_local_id, '')), '') IS NULL
     OR upper(btrim(p_local_id)) IN ('TODOS', 'TODOS LOS LOCALES') THEN
    RAISE EXCEPTION 'personal_local_concreto_requerido';
  END IF;
  IF nullif(btrim(coalesce(p_empleado_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'empleado_id_requerido';
  END IF;
  IF v_ausencia_id IS NULL OR v_operation_id IS NULL THEN
    RAISE EXCEPTION 'ausencia_identidad_operacion_requerida';
  END IF;
  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'ausencia_motivo_anulacion_requerido';
  END IF;

  SELECT * INTO v_empleado
    FROM public.empleados e
   WHERE e.id = p_empleado_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'empleado_no_encontrado';
  END IF;
  IF v_empleado.empresa_id <> p_empresa_id OR v_empleado.local_id <> p_local_id THEN
    RAISE EXCEPTION 'empleado_contexto_no_coincide';
  END IF;

  v_ausencias := coalesce(v_empleado.datos->'ausencias', '[]'::jsonb);
  IF jsonb_typeof(v_ausencias) <> 'array' THEN
    RAISE EXCEPTION 'ausencias_legacy_formato_invalido';
  END IF;

  SELECT a INTO v_existente
    FROM jsonb_array_elements(v_ausencias) a
   WHERE a->>'anulacionOperationId' = v_operation_id
   LIMIT 1;

  IF v_existente IS NOT NULL THEN
    IF v_existente->>'id' = v_ausencia_id THEN
      RETURN jsonb_build_object('ok', true, 'replay', true, 'ausencia', v_existente);
    END IF;
    RAISE EXCEPTION 'ausencia_operation_id_conflicto';
  END IF;

  SELECT a INTO v_objetivo
    FROM jsonb_array_elements(v_ausencias) a
   WHERE a->>'id' = v_ausencia_id
   LIMIT 1;

  IF v_objetivo IS NULL THEN
    RAISE EXCEPTION 'ausencia_no_encontrada';
  END IF;
  IF coalesce(upper(v_objetivo->>'estado'), 'ACTIVA') = 'ANULADA'
     OR nullif(v_objetivo->>'anuladaAt', '') IS NOT NULL THEN
    RAISE EXCEPTION 'ausencia_ya_anulada';
  END IF;

  SELECT coalesce(jsonb_agg(
    CASE WHEN a.elem->>'id' = v_ausencia_id THEN
      a.elem || jsonb_build_object(
        'estado', 'ANULADA',
        'anuladaAt', now(),
        'anuladaPor', auth.uid()::text,
        'motivoAnulacion', v_motivo,
        'anulacionOperationId', v_operation_id
      )
    ELSE a.elem END
    ORDER BY a.ord
  ), '[]'::jsonb)
    INTO v_actualizada
    FROM jsonb_array_elements(v_ausencias) WITH ORDINALITY AS a(elem, ord);

  UPDATE public.empleados
     SET datos = jsonb_set(v_empleado.datos, '{ausencias}', v_actualizada, true)
   WHERE id = v_empleado.id
  RETURNING * INTO v_empleado;

  SELECT a INTO v_objetivo
    FROM jsonb_array_elements(v_actualizada) a
   WHERE a->>'id' = v_ausencia_id
   LIMIT 1;

  PERFORM private.pm11_auditar_empleado(
    'Personal · anular ausencia', v_empleado.id, v_empleado.empresa_id, v_empleado.local_id,
    jsonb_build_object('ausenciaId', v_ausencia_id, 'motivo', v_motivo, 'operationId', v_operation_id)
  );

  RETURN jsonb_build_object('ok', true, 'replay', false, 'ausencia', v_objetivo);
END;
$function$;

REVOKE ALL ON FUNCTION public.pm13_registrar_ausencia(text,text,text,text,text,date,date,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pm13_anular_ausencia(text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pm13_registrar_ausencia(text,text,text,text,text,date,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm13_anular_ausencia(text,text,text,text,text,text) TO authenticated;
