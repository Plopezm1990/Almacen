-- PM13-P01 — hardening del ciclo de vida de Personal sobre el motor PM11 existente.
-- Alcance: QA / candidato de migración. No crea una segunda entidad de personal.
-- Mantiene las firmas PM11 para que frontend y backend compartan una única lógica.

DO $$
BEGIN
  IF to_regclass('public.empleados') IS NULL THEN
    RAISE EXCEPTION 'pm13_p01_requiere_pm11_empleados';
  END IF;
  IF to_regprocedure('private.pm11_puede_mutar_personal(text,text)') IS NULL
     OR to_regprocedure('private.pm11_validar_datos_laborales(jsonb)') IS NULL
     OR to_regprocedure('private.pm11_auditar_empleado(text,text,text,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'pm13_p01_requiere_motor_pm11_personal';
  END IF;
END
$$;

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
SET search_path TO 'public', 'auth', 'private', 'pg_temp'
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

  SELECT * INTO v_empleado
    FROM public.empleados e
   WHERE e.id = p_empleado_id
   FOR UPDATE;

  IF FOUND THEN
    IF v_operation_id IS NOT NULL
       AND v_empleado.empresa_id = p_empresa_id
       AND v_empleado.local_id = p_local_id
       AND v_empleado.datos->>'pm13AltaOperationId' = v_operation_id THEN
      RETURN jsonb_build_object(
        'ok', true,
        'yaCreado', true,
        'empleado', to_jsonb(v_empleado)
      );
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

CREATE OR REPLACE FUNCTION public.pm11_editar_empleado(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text,
  p_cambios jsonb DEFAULT '{}'::jsonb,
  p_nombre text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
DECLARE
  v_empleado public.empleados%rowtype;
  v_nombre text;
  v_datos jsonb;
  v_campos jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) THEN
    RAISE EXCEPTION 'personal_contexto_no_autorizado';
  END IF;
  IF p_cambios IS NULL OR jsonb_typeof(p_cambios) <> 'object' THEN
    RAISE EXCEPTION 'empleado_cambios_invalidos';
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

  v_nombre := CASE WHEN p_nombre IS NULL THEN v_empleado.nombre ELSE btrim(p_nombre) END;
  IF nullif(v_nombre, '') IS NULL THEN
    RAISE EXCEPTION 'empleado_nombre_requerido';
  END IF;

  v_datos := v_empleado.datos || p_cambios
    || jsonb_build_object(
      'id', v_empleado.id,
      'empresaId', v_empleado.empresa_id,
      'localId', v_empleado.local_id,
      'nombre', v_nombre,
      'activo', true,
      'estado', 'activo'
    );

  PERFORM private.pm11_validar_datos_laborales(v_datos);

  IF v_nombre IS NOT DISTINCT FROM v_empleado.nombre
     AND v_datos IS NOT DISTINCT FROM v_empleado.datos THEN
    RETURN jsonb_build_object('ok', true, 'yaSinCambios', true, 'empleado', to_jsonb(v_empleado));
  END IF;

  UPDATE public.empleados
     SET nombre = v_nombre,
         datos = v_datos
   WHERE id = v_empleado.id
  RETURNING * INTO v_empleado;

  SELECT coalesce(jsonb_agg(k ORDER BY k), '[]'::jsonb)
    INTO v_campos
    FROM jsonb_object_keys(p_cambios) k;

  PERFORM private.pm11_auditar_empleado(
    'Personal · editar empleado', v_empleado.id, v_empleado.empresa_id, v_empleado.local_id,
    jsonb_build_object('campos', v_campos, 'nombreModificado', p_nombre IS NOT NULL)
  );

  RETURN jsonb_build_object('ok', true, 'yaSinCambios', false, 'empleado', to_jsonb(v_empleado));
END;
$function$;

CREATE OR REPLACE FUNCTION public.pm11_baja_empleado(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text,
  p_motivo text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
DECLARE
  v_empleado public.empleados%rowtype;
  v_datos jsonb;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) THEN
    RAISE EXCEPTION 'personal_contexto_no_autorizado';
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

  IF v_empleado.estado = 'inactivo' THEN
    RETURN jsonb_build_object('ok', true, 'yaBaja', true, 'empleado', to_jsonb(v_empleado));
  END IF;
  IF v_empleado.estado <> 'activo' THEN
    RAISE EXCEPTION 'empleado_baja_estado_invalido';
  END IF;

  v_datos := v_empleado.datos
    || jsonb_build_object(
      'activo', false,
      'estado', 'inactivo',
      'fechaBaja', current_date::text
    );
  IF v_motivo IS NOT NULL THEN
    v_datos := v_datos || jsonb_build_object('motivoBaja', v_motivo);
  END IF;

  UPDATE public.empleados
     SET estado = 'inactivo',
         baja_at = now(),
         datos = v_datos
   WHERE id = v_empleado.id
  RETURNING * INTO v_empleado;

  PERFORM private.pm11_auditar_empleado(
    'Personal · baja empleado', v_empleado.id, v_empleado.empresa_id, v_empleado.local_id,
    jsonb_build_object(
      'estadoAnterior', 'activo',
      'estadoNuevo', 'inactivo',
      'motivoInformado', v_motivo IS NOT NULL
    )
  );

  RETURN jsonb_build_object('ok', true, 'yaBaja', false, 'empleado', to_jsonb(v_empleado));
END;
$function$;

CREATE OR REPLACE FUNCTION public.pm11_reactivar_empleado(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
DECLARE
  v_empleado public.empleados%rowtype;
BEGIN
  IF auth.uid() IS NULL OR NOT private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) THEN
    RAISE EXCEPTION 'personal_contexto_no_autorizado';
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

  IF v_empleado.estado = 'activo' THEN
    RETURN jsonb_build_object('ok', true, 'yaActivo', true, 'empleado', to_jsonb(v_empleado));
  END IF;
  IF v_empleado.estado <> 'inactivo' THEN
    RAISE EXCEPTION 'empleado_reactivacion_estado_invalido';
  END IF;

  UPDATE public.empleados
     SET estado = 'activo',
         reactivado_at = now(),
         datos = (datos - 'fechaBaja' - 'motivoBaja')
           || jsonb_build_object('activo', true, 'estado', 'activo')
   WHERE id = v_empleado.id
  RETURNING * INTO v_empleado;

  PERFORM private.pm11_auditar_empleado(
    'Personal · reactivar empleado', v_empleado.id, v_empleado.empresa_id, v_empleado.local_id,
    jsonb_build_object('estadoAnterior', 'inactivo', 'estadoNuevo', 'activo')
  );

  RETURN jsonb_build_object('ok', true, 'yaActivo', false, 'empleado', to_jsonb(v_empleado));
END;
$function$;

REVOKE ALL ON FUNCTION public.pm11_alta_empleado(text,text,text,text,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pm11_editar_empleado(text,text,text,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pm11_baja_empleado(text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pm11_reactivar_empleado(text,text,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.pm11_alta_empleado(text,text,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm11_editar_empleado(text,text,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm11_baja_empleado(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm11_reactivar_empleado(text,text,text) TO authenticated;
