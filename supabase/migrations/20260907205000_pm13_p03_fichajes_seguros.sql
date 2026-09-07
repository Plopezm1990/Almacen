-- PM13-P03 — Fichajes seguros, trazables e idempotentes.
-- Reutiliza public.fichajes_registro existente. No borra registros históricos.

DO $$
BEGIN
  IF to_regclass('public.fichajes_registro') IS NULL THEN
    RAISE EXCEPTION 'pm13_p03_requiere_fichajes_registro';
  END IF;
  IF to_regclass('public.empleados') IS NULL OR to_regclass('public.perfiles') IS NULL THEN
    RAISE EXCEPTION 'pm13_p03_requiere_personal_pm11';
  END IF;
  IF to_regprocedure('private.pm11_puede_mutar_personal(text,text)') IS NULL
     OR to_regprocedure('private.pm11_puede_ver_personal(text,text)') IS NULL
     OR to_regprocedure('private.la_usuario_activo()') IS NULL
     OR to_regprocedure('private.pm11_auditar_empleado(text,text,text,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'pm13_p03_requiere_helpers_pm11';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION private.pm13_fichaje_actor_es_empleado(p_empleado_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT private.la_usuario_activo()
     AND EXISTS (
       SELECT 1
         FROM public.perfiles p
        WHERE p.user_id = auth.uid()
          AND p.activo = true
          AND p.empleado_id = p_empleado_id
     );
$function$;

CREATE OR REPLACE FUNCTION private.pm13_fichaje_secuencia_valida(
  p_empleado_id text,
  p_local_id text,
  p_ignorar_id text DEFAULT NULL,
  p_candidato jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH eventos AS (
    SELECT f.id,
           f.fecha::text AS fecha,
           f.datos->>'hora' AS hora,
           f.datos->>'tipo' AS tipo
      FROM public.fichajes_registro f
     WHERE f.datos->>'empleadoId' = p_empleado_id
       AND f.datos->>'localId' = p_local_id
       AND (p_ignorar_id IS NULL OR f.id <> p_ignorar_id)
       AND coalesce(lower(f.datos->>'anulado'), 'false') <> 'true'
    UNION ALL
    SELECT '__pm13_candidato__',
           p_candidato->>'fecha',
           p_candidato->>'hora',
           p_candidato->>'tipo'
     WHERE p_candidato IS NOT NULL
  ),
  ordenados AS (
    SELECT e.*,
           row_number() OVER (ORDER BY e.fecha, e.hora, e.id) AS rn,
           lag(e.tipo) OVER (ORDER BY e.fecha, e.hora, e.id) AS tipo_anterior,
           count(*) OVER (PARTITION BY e.fecha, e.hora) AS mismos_minuto
      FROM eventos e
  )
  SELECT NOT EXISTS (
    SELECT 1
      FROM ordenados o
     WHERE o.fecha IS NULL
        OR o.fecha !~ '^\d{4}-\d{2}-\d{2}$'
        OR o.hora IS NULL
        OR o.hora !~ '^([01]\d|2[0-3]):[0-5]\d$'
        OR o.tipo NOT IN ('entrada', 'salida')
        OR o.mismos_minuto > 1
        OR (o.rn = 1 AND o.tipo <> 'entrada')
        OR (o.rn > 1 AND o.tipo = o.tipo_anterior)
  );
$function$;

CREATE OR REPLACE FUNCTION public.pm13_fichar(
  p_empleado_id text,
  p_local_id text,
  p_tipo text,
  p_operation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_emp public.empleados%rowtype;
  v_existente public.fichajes_registro%rowtype;
  v_id text;
  v_ahora timestamptz := clock_timestamp();
  v_fecha date := current_date;
  v_hora text := to_char(clock_timestamp(), 'HH24:MI');
  v_datos jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.la_usuario_activo() THEN
    RAISE EXCEPTION 'fichaje_sesion_no_autorizada';
  END IF;
  IF nullif(btrim(coalesce(p_operation_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'fichaje_operation_id_requerido';
  END IF;
  IF p_tipo NOT IN ('entrada', 'salida') THEN
    RAISE EXCEPTION 'fichaje_tipo_invalido';
  END IF;
  IF nullif(btrim(coalesce(p_local_id, '')), '') IS NULL
     OR upper(btrim(p_local_id)) IN ('TODOS', 'TODOS LOS LOCALES') THEN
    RAISE EXCEPTION 'fichaje_local_concreto_requerido';
  END IF;

  SELECT * INTO v_emp
    FROM public.empleados e
   WHERE e.id = p_empleado_id
   FOR SHARE;

  IF NOT FOUND OR v_emp.local_id <> p_local_id OR v_emp.estado <> 'activo' THEN
    RAISE EXCEPTION 'fichaje_empleado_no_activo_o_fuera_de_local';
  END IF;

  IF NOT private.pm13_fichaje_actor_es_empleado(v_emp.id)
     AND NOT private.pm11_puede_mutar_personal(v_emp.empresa_id, v_emp.local_id) THEN
    RAISE EXCEPTION 'fichaje_actor_no_autorizado';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('pm13:fichaje:' || v_emp.id, 0));

  SELECT * INTO v_existente
    FROM public.fichajes_registro f
   WHERE f.datos->>'operationId' = p_operation_id
   ORDER BY f.creado_en DESC
   LIMIT 1;

  IF FOUND THEN
    IF v_existente.datos->>'empleadoId' = v_emp.id
       AND v_existente.datos->>'localId' = v_emp.local_id
       AND v_existente.datos->>'tipo' = p_tipo THEN
      RETURN jsonb_build_object('ok', true, 'replay', true, 'fichaje', v_existente.datos);
    END IF;
    RAISE EXCEPTION 'fichaje_operation_id_conflicto';
  END IF;

  v_datos := jsonb_build_object(
    'id', 'fichaje-' || gen_random_uuid()::text,
    'empleadoId', v_emp.id,
    'localId', v_emp.local_id,
    'fecha', v_fecha::text,
    'hora', v_hora,
    'tipo', p_tipo,
    'timestamp', v_ahora,
    'operationId', p_operation_id,
    'manual', false,
    'anulado', false
  );

  IF NOT private.pm13_fichaje_secuencia_valida(v_emp.id, v_emp.local_id, NULL, v_datos) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', CASE WHEN p_tipo='entrada' THEN 'FICHAJE_YA_ABIERTO' ELSE 'FICHAJE_SIN_ENTRADA_ABIERTA' END);
  END IF;

  v_id := v_datos->>'id';
  INSERT INTO public.fichajes_registro(id, fecha, datos)
  VALUES (v_id, v_fecha, v_datos);

  PERFORM private.pm11_auditar_empleado(
    'Personal · fichaje ' || p_tipo,
    v_emp.id,
    v_emp.empresa_id,
    v_emp.local_id,
    jsonb_build_object('fichajeId', v_id, 'operationIdInformado', true)
  );

  RETURN jsonb_build_object('ok', true, 'replay', false, 'fichaje', v_datos);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pm13_fichaje_manual(
  p_empleado_id text,
  p_local_id text,
  p_fecha date,
  p_hora text,
  p_tipo text,
  p_operation_id text,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_emp public.empleados%rowtype;
  v_existente public.fichajes_registro%rowtype;
  v_id text;
  v_datos jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.la_usuario_activo() THEN
    RAISE EXCEPTION 'fichaje_sesion_no_autorizada';
  END IF;
  IF nullif(btrim(coalesce(p_operation_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'fichaje_operation_id_requerido';
  END IF;
  IF p_tipo NOT IN ('entrada', 'salida') OR p_hora !~ '^([01]\d|2[0-3]):[0-5]\d$' THEN
    RAISE EXCEPTION 'fichaje_manual_datos_invalidos';
  END IF;
  IF p_fecha IS NULL OR p_fecha > current_date THEN
    RAISE EXCEPTION 'fichaje_manual_fecha_invalida';
  END IF;

  SELECT * INTO v_emp
    FROM public.empleados e
   WHERE e.id = p_empleado_id
   FOR SHARE;

  IF NOT FOUND OR v_emp.local_id <> p_local_id OR v_emp.estado <> 'activo' THEN
    RAISE EXCEPTION 'fichaje_empleado_no_activo_o_fuera_de_local';
  END IF;
  IF NOT private.pm11_puede_mutar_personal(v_emp.empresa_id, v_emp.local_id) THEN
    RAISE EXCEPTION 'fichaje_manual_no_autorizado';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('pm13:fichaje:' || v_emp.id, 0));

  SELECT * INTO v_existente
    FROM public.fichajes_registro f
   WHERE f.datos->>'operationId' = p_operation_id
   ORDER BY f.creado_en DESC
   LIMIT 1;

  IF FOUND THEN
    IF v_existente.datos->>'empleadoId' = v_emp.id
       AND v_existente.datos->>'localId' = v_emp.local_id
       AND v_existente.datos->>'tipo' = p_tipo
       AND v_existente.fecha = p_fecha
       AND v_existente.datos->>'hora' = p_hora THEN
      RETURN jsonb_build_object('ok', true, 'replay', true, 'fichaje', v_existente.datos);
    END IF;
    RAISE EXCEPTION 'fichaje_operation_id_conflicto';
  END IF;

  v_id := 'fichaje-' || gen_random_uuid()::text;
  v_datos := jsonb_build_object(
    'id', v_id,
    'empleadoId', v_emp.id,
    'localId', v_emp.local_id,
    'fecha', p_fecha::text,
    'hora', p_hora,
    'tipo', p_tipo,
    'timestamp', p_fecha::text || 'T' || p_hora || ':00',
    'operationId', p_operation_id,
    'manual', true,
    'motivoManual', nullif(btrim(coalesce(p_motivo, '')), ''),
    'anulado', false
  );

  IF NOT private.pm13_fichaje_secuencia_valida(v_emp.id, v_emp.local_id, NULL, v_datos) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'FICHAJE_SECUENCIA_INVALIDA');
  END IF;

  INSERT INTO public.fichajes_registro(id, fecha, datos)
  VALUES (v_id, p_fecha, v_datos);

  PERFORM private.pm11_auditar_empleado(
    'Personal · fichaje manual',
    v_emp.id,
    v_emp.empresa_id,
    v_emp.local_id,
    jsonb_build_object('fichajeId', v_id, 'tipo', p_tipo, 'fecha', p_fecha, 'hora', p_hora)
  );

  RETURN jsonb_build_object('ok', true, 'replay', false, 'fichaje', v_datos);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pm13_corregir_fichaje(
  p_fichaje_id text,
  p_fecha date,
  p_hora text,
  p_tipo text,
  p_operation_id text,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_reg public.fichajes_registro%rowtype;
  v_emp public.empleados%rowtype;
  v_datos jsonb;
  v_original jsonb;
  v_historial jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.la_usuario_activo() THEN
    RAISE EXCEPTION 'fichaje_sesion_no_autorizada';
  END IF;
  IF nullif(btrim(coalesce(p_operation_id, '')), '') IS NULL
     OR nullif(btrim(coalesce(p_motivo, '')), '') IS NULL THEN
    RAISE EXCEPTION 'fichaje_correccion_operacion_y_motivo_requeridos';
  END IF;
  IF p_tipo NOT IN ('entrada', 'salida') OR p_hora !~ '^([01]\d|2[0-3]):[0-5]\d$' OR p_fecha IS NULL THEN
    RAISE EXCEPTION 'fichaje_correccion_datos_invalidos';
  END IF;

  SELECT * INTO v_reg
    FROM public.fichajes_registro f
   WHERE f.id = p_fichaje_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fichaje_no_encontrado';
  END IF;
  IF coalesce(lower(v_reg.datos->>'anulado'), 'false') = 'true' THEN
    RAISE EXCEPTION 'fichaje_anulado_no_editable';
  END IF;
  IF v_reg.datos->>'ultimaCorreccionOperationId' = p_operation_id THEN
    RETURN jsonb_build_object('ok', true, 'replay', true, 'fichaje', v_reg.datos);
  END IF;

  SELECT * INTO v_emp
    FROM public.empleados e
   WHERE e.id = v_reg.datos->>'empleadoId'
   FOR SHARE;
  IF NOT FOUND OR v_emp.local_id <> v_reg.datos->>'localId' THEN
    RAISE EXCEPTION 'fichaje_contexto_invalido';
  END IF;
  IF NOT private.pm11_puede_mutar_personal(v_emp.empresa_id, v_emp.local_id) THEN
    RAISE EXCEPTION 'fichaje_correccion_no_autorizada';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('pm13:fichaje:' || v_emp.id, 0));

  v_datos := v_reg.datos
    || jsonb_build_object(
      'fecha', p_fecha::text,
      'hora', p_hora,
      'tipo', p_tipo,
      'timestamp', p_fecha::text || 'T' || p_hora || ':00',
      'corregido', true,
      'corregidoAt', clock_timestamp(),
      'motivoCorreccion', btrim(p_motivo),
      'ultimaCorreccionOperationId', p_operation_id
    );

  IF NOT private.pm13_fichaje_secuencia_valida(v_emp.id, v_emp.local_id, v_reg.id, v_datos) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'FICHAJE_SECUENCIA_INVALIDA');
  END IF;

  v_original := coalesce(v_reg.datos->'original', jsonb_build_object(
    'fecha', v_reg.datos->>'fecha',
    'hora', v_reg.datos->>'hora',
    'tipo', v_reg.datos->>'tipo',
    'timestamp', v_reg.datos->>'timestamp'
  ));
  v_historial := coalesce(v_reg.datos->'historialCorrecciones', '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
      'fecha', v_reg.datos->>'fecha',
      'hora', v_reg.datos->>'hora',
      'tipo', v_reg.datos->>'tipo',
      'motivo', btrim(p_motivo),
      'corregidoAt', clock_timestamp()
    ));
  v_datos := v_datos || jsonb_build_object('original', v_original, 'historialCorrecciones', v_historial);

  UPDATE public.fichajes_registro
     SET fecha = p_fecha,
         datos = v_datos
   WHERE id = v_reg.id;

  PERFORM private.pm11_auditar_empleado(
    'Personal · corregir fichaje',
    v_emp.id,
    v_emp.empresa_id,
    v_emp.local_id,
    jsonb_build_object('fichajeId', v_reg.id, 'motivoInformado', true)
  );

  RETURN jsonb_build_object('ok', true, 'replay', false, 'fichaje', v_datos);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pm13_anular_fichaje(
  p_fichaje_id text,
  p_operation_id text,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_reg public.fichajes_registro%rowtype;
  v_emp public.empleados%rowtype;
  v_datos jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.la_usuario_activo() THEN
    RAISE EXCEPTION 'fichaje_sesion_no_autorizada';
  END IF;
  IF nullif(btrim(coalesce(p_operation_id, '')), '') IS NULL
     OR nullif(btrim(coalesce(p_motivo, '')), '') IS NULL THEN
    RAISE EXCEPTION 'fichaje_anulacion_operacion_y_motivo_requeridos';
  END IF;

  SELECT * INTO v_reg
    FROM public.fichajes_registro f
   WHERE f.id = p_fichaje_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fichaje_no_encontrado';
  END IF;

  SELECT * INTO v_emp
    FROM public.empleados e
   WHERE e.id = v_reg.datos->>'empleadoId'
   FOR SHARE;
  IF NOT FOUND OR v_emp.local_id <> v_reg.datos->>'localId' THEN
    RAISE EXCEPTION 'fichaje_contexto_invalido';
  END IF;
  IF NOT private.pm11_puede_mutar_personal(v_emp.empresa_id, v_emp.local_id) THEN
    RAISE EXCEPTION 'fichaje_anulacion_no_autorizada';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('pm13:fichaje:' || v_emp.id, 0));

  IF coalesce(lower(v_reg.datos->>'anulado'), 'false') = 'true' THEN
    RETURN jsonb_build_object('ok', true, 'replay', true, 'fichaje', v_reg.datos);
  END IF;

  IF NOT private.pm13_fichaje_secuencia_valida(v_emp.id, v_emp.local_id, v_reg.id, NULL) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'FICHAJE_ANULACION_ROMPE_SECUENCIA');
  END IF;

  v_datos := v_reg.datos || jsonb_build_object(
    'anulado', true,
    'anuladoAt', clock_timestamp(),
    'motivoAnulacion', btrim(p_motivo),
    'anulacionOperationId', p_operation_id
  );

  UPDATE public.fichajes_registro SET datos = v_datos WHERE id = v_reg.id;

  PERFORM private.pm11_auditar_empleado(
    'Personal · anular fichaje',
    v_emp.id,
    v_emp.empresa_id,
    v_emp.local_id,
    jsonb_build_object('fichajeId', v_reg.id, 'motivoInformado', true)
  );

  RETURN jsonb_build_object('ok', true, 'replay', false, 'fichaje', v_datos);
END;
$function$;

-- Un operationId no puede representar dos escrituras distintas del mismo empleado.
CREATE UNIQUE INDEX IF NOT EXISTS pm13_fichajes_operation_id_empleado_uq
  ON public.fichajes_registro ((datos->>'empleadoId'), (datos->>'operationId'))
  WHERE nullif(btrim(datos->>'operationId'), '') IS NOT NULL;

ALTER TABLE public.fichajes_registro ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qa_authenticated_fichajes ON public.fichajes_registro;
DROP POLICY IF EXISTS pm13_fichajes_select_scope ON public.fichajes_registro;

CREATE POLICY pm13_fichajes_select_scope
ON public.fichajes_registro
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
      FROM public.empleados e
     WHERE e.id = fichajes_registro.datos->>'empleadoId'
       AND e.local_id = fichajes_registro.datos->>'localId'
       AND (
         private.pm11_puede_ver_personal(e.empresa_id, e.local_id)
         OR private.pm13_fichaje_actor_es_empleado(e.id)
       )
  )
);

REVOKE ALL ON TABLE public.fichajes_registro FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.fichajes_registro FROM authenticated;
GRANT SELECT ON TABLE public.fichajes_registro TO authenticated;

REVOKE ALL ON FUNCTION private.pm13_fichaje_actor_es_empleado(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.pm13_fichaje_secuencia_valida(text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pm13_fichar(text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pm13_fichaje_manual(text,text,date,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pm13_corregir_fichaje(text,date,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pm13_anular_fichaje(text,text,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.pm13_fichar(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm13_fichaje_manual(text,text,date,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm13_corregir_fichaje(text,date,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm13_anular_fichaje(text,text,text) TO authenticated;
