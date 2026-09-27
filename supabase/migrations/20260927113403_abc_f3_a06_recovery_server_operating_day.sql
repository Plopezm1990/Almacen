-- A06.1 / A11: recuperación de la misma cuenta con autoridad de día operativo del servidor.
-- p_operating_day se conserva por compatibilidad de firma, nunca como autoridad.

CREATE OR REPLACE FUNCTION public.abc_recuperar_cuenta(p_empresa_id text, p_local_id text, p_cuenta_id uuid, p_terminal_id uuid, p_session_id uuid, p_operating_day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cuenta public.cuentas_comerciales%rowtype;
  v_pedidos jsonb;
  v_cobro jsonb;
  v_last_activity timestamptz;
  v_revision text;
  v_requires_day boolean;
  v_current_operating_ctx jsonb;
  v_current_operating_day date;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'cuenta_recuperar_no_autorizada';
  end if;
  if p_cuenta_id is null or p_terminal_id is null
     or p_session_id is null or p_operating_day is null then
    raise exception 'cuenta_recuperar_parametros_requeridos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  select *
    into v_cuenta
    from public.cuentas_comerciales
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_cuenta_id;

  if not found then raise exception 'cuenta_no_encontrada'; end if;

  v_last_activity:=private.abc_ultima_actividad_cuenta(
    p_empresa_id,p_local_id,p_cuenta_id
  );
  v_revision:=private.abc_revision_cuenta(
    p_empresa_id,p_local_id,p_cuenta_id
  );

  -- A11 es la autoridad del día operativo actual. p_operating_day se conserva
  -- únicamente como aserción/compatibilidad del cliente y nunca decide si
  -- una cuenta puede reanudarse.
  v_current_operating_ctx:=private.abc_resolver_operating_day_contexto(
    p_empresa_id,p_local_id,now()
  );
  v_current_operating_day:=(v_current_operating_ctx->>'operating_day')::date;

  v_requires_day:=
    v_cuenta.estado='ABIERTA'
    and v_cuenta.opened_operating_day<>v_current_operating_day;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',p.id,
        'estado',p.estado,
        'version',p.version,
        'currency_code',p.currency_code,
        'created_by',p.created_by,
        'created_at',p.created_at,
        'created_operating_day',p.created_operating_day,
        'closed_at',p.closed_at,
        'lineas',coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id',l.id,
              'producto_id',l.producto_id,
              'cantidad',l.cantidad,
              'unidad',l.unidad,
              'estado',l.estado,
              'version',l.version,
              'entidad_fiscal_id',l.entidad_fiscal_id,
              'currency_code',l.currency_code,
              'precio_unitario',l.precio_unitario,
              'descuento_total',l.descuento_total,
              'base',l.base,
              'impuestos',l.impuestos,
              'total',l.total,
              'snapshot_comercial',l.snapshot_comercial,
              'snapshot_calculo',l.snapshot_calculo,
              'created_by',l.created_by,
              'created_at',l.created_at,
              'created_operating_day',l.created_operating_day,
              'opciones',coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id',o.id,
                    'grupo_id',o.grupo_id,
                    'opcion_id',o.opcion_id,
                    'tipo_grupo',o.tipo_grupo,
                    'tipo_opcion',o.tipo_opcion,
                    'nombre_grupo',o.nombre_grupo,
                    'nombre_opcion',o.nombre_opcion,
                    'cantidad',o.cantidad,
                    'delta_precio_unitario',o.delta_precio_unitario,
                    'impuesto_pct',o.impuesto_pct,
                    'base',o.base,
                    'impuestos',o.impuestos,
                    'total',o.total,
                    'catalog_group_version',o.catalog_group_version,
                    'catalog_product_group_version',o.catalog_product_group_version,
                    'catalog_option_version',o.catalog_option_version,
                    'snapshot',o.snapshot,
                    'created_by',o.created_by,
                    'created_at',o.created_at,
                    'created_operating_day',o.created_operating_day
                  )
                  order by o.created_at,o.id
                )
                from public.pedido_linea_opciones o
                where o.empresa_id=l.empresa_id
                  and o.local_id=l.local_id
                  and o.linea_id=l.id
              ),'[]'::jsonb),
              'transiciones',coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id',t.id,
                    'operation_id',t.operation_id,
                    'estado_anterior',t.estado_anterior,
                    'estado_nuevo',t.estado_nuevo,
                    'motivo',t.motivo,
                    'actor_user_id',t.actor_user_id,
                    'terminal_id',t.terminal_id,
                    'session_id',t.session_id,
                    'occurred_at',t.occurred_at,
                    'operating_day',t.operating_day,
                    'metadata',t.metadata
                  )
                  order by t.occurred_at,t.id
                )
                from public.pedido_linea_transiciones t
                where t.empresa_id=l.empresa_id
                  and t.local_id=l.local_id
                  and t.linea_id=l.id
              ),'[]'::jsonb)
            )
            order by l.created_at,l.id
          )
          from public.pedido_lineas l
          where l.empresa_id=p.empresa_id
            and l.local_id=p.local_id
            and l.pedido_id=p.id
        ),'[]'::jsonb),
        'transiciones',coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id',t.id,
              'operation_id',t.operation_id,
              'estado_anterior',t.estado_anterior,
              'estado_nuevo',t.estado_nuevo,
              'motivo',t.motivo,
              'actor_user_id',t.actor_user_id,
              'terminal_id',t.terminal_id,
              'session_id',t.session_id,
              'occurred_at',t.occurred_at,
              'operating_day',t.operating_day,
              'metadata',t.metadata
            )
            order by t.occurred_at,t.id
          )
          from public.pedido_transiciones t
          where t.empresa_id=p.empresa_id
            and t.local_id=p.local_id
            and t.pedido_id=p.id
        ),'[]'::jsonb)
      )
      order by p.created_at,p.id
    ),
    '[]'::jsonb
  )
  into v_pedidos
  from public.pedidos_tpv p
  where p.empresa_id=p_empresa_id
    and p.local_id=p_local_id
    and p.cuenta_id=p_cuenta_id;

  v_cobro:=public.abc_estado_cobro_cuenta(
    p_empresa_id,p_local_id,p_cuenta_id
  );

  return jsonb_build_object(
    'ok',true,
    'recuperado_at',now(),
    'terminal_id',p_terminal_id,
    'session_id',p_session_id,
    'requested_operating_day',p_operating_day,
    'revision',v_revision,
    'reanudable',
      v_cuenta.estado='ABIERTA' and not v_requires_day,
    'requires_operating_day_resolution',v_requires_day,
    'cuenta',jsonb_build_object(
      'id',v_cuenta.id,
      'empresa_id',v_cuenta.empresa_id,
      'local_id',v_cuenta.local_id,
      'currency_code',v_cuenta.currency_code,
      'modalidad',v_cuenta.modalidad,
      'estado',v_cuenta.estado,
      'version',v_cuenta.version,
      'responsable_actual',v_cuenta.responsable_actual,
      'created_by',v_cuenta.created_by,
      'opened_at',v_cuenta.opened_at,
      'opened_operating_day',v_cuenta.opened_operating_day,
      'closed_at',v_cuenta.closed_at,
      'created_at',v_cuenta.created_at,
      'last_activity_at',v_last_activity
    ),
    'ubicacion',private.abc_ubicacion_cuenta(p_empresa_id,p_local_id,p_cuenta_id),
    'reparto',private.abc_reparto_cuenta_snapshot(p_empresa_id,p_local_id,p_cuenta_id),
    'pedidos',v_pedidos,
    'estado_cobro',v_cobro
  );
end $function$
