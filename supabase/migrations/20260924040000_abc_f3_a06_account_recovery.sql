-- ABC F3 A06 — cuentas persistidas y recuperables.
-- Aditiva: snapshot servidor, listado de cuentas abiertas, consulta controlada
-- de operación propia y reasignación de responsable.
-- No reabre cuentas cerradas, no crea frontend, no cobra y no mueve stock.

do $$
declare
  v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.cuentas_comerciales') is null then v_missing:=array_append(v_missing,'cuentas_comerciales'); end if;
  if to_regclass('public.pedidos_tpv') is null then v_missing:=array_append(v_missing,'pedidos_tpv'); end if;
  if to_regclass('public.pedido_lineas') is null then v_missing:=array_append(v_missing,'pedido_lineas'); end if;
  if to_regclass('public.pedido_linea_opciones') is null then v_missing:=array_append(v_missing,'pedido_linea_opciones'); end if;
  if to_regclass('public.pedido_transiciones') is null then v_missing:=array_append(v_missing,'pedido_transiciones'); end if;
  if to_regclass('public.pedido_linea_transiciones') is null then v_missing:=array_append(v_missing,'pedido_linea_transiciones'); end if;
  if to_regclass('public.abc_operaciones') is null then v_missing:=array_append(v_missing,'abc_operaciones'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_terminal_sesion_operativa(text,text,uuid,uuid)') is null then v_missing:=array_append(v_missing,'abc_terminal_sesion_operativa'); end if;
  if to_regprocedure('private.abc_usuario_activo_local(text,text,uuid)') is null then v_missing:=array_append(v_missing,'abc_usuario_activo_local'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('public.abc_estado_cobro_cuenta(text,text,uuid)') is null then v_missing:=array_append(v_missing,'abc_estado_cobro_cuenta'); end if;

  if cardinality(v_missing)>0 then
    raise exception 'ABC_F3_A06_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if to_regprocedure('private.abc_ultima_actividad_cuenta(text,text,uuid)') is not null
     or to_regprocedure('private.abc_revision_cuenta(text,text,uuid)') is not null
     or to_regprocedure('public.abc_recuperar_cuenta(text,text,uuid,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_listar_cuentas_recuperables(text,text,uuid,uuid,date,integer)') is not null
     or to_regprocedure('public.abc_consultar_operacion(text,text,text)') is not null
     or to_regprocedure('public.abc_cambiar_responsable_cuenta(text,text,text,uuid,uuid,text,bigint,uuid,uuid,date)') is not null then
    raise exception 'ABC_F3_A06_PREFLIGHT_FALLO: objetos A06 ya existen';
  end if;
end $$;

create function private.abc_ultima_actividad_cuenta(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid
)
returns timestamptz
language sql
stable
security definer
set search_path=''
as $$
  select max(x.ts)
  from (
    select c.opened_at as ts
      from public.cuentas_comerciales c
     where c.empresa_id=$1 and c.local_id=$2 and c.id=$3

    union all

    select e.occurred_at
      from public.abc_eventos e
     where e.empresa_id=$1
       and e.local_id=$2
       and (
         (e.aggregate_type='CUENTA' and e.aggregate_id=$3::text)
         or
         (e.aggregate_type='PEDIDO' and exists(
           select 1 from public.pedidos_tpv p
            where p.empresa_id=$1 and p.local_id=$2 and p.cuenta_id=$3
              and p.id::text=e.aggregate_id
         ))
         or
         (e.aggregate_type='PEDIDO_LINEA' and exists(
           select 1
             from public.pedido_lineas l
             join public.pedidos_tpv p
               on p.empresa_id=l.empresa_id
              and p.local_id=l.local_id
              and p.id=l.pedido_id
            where p.empresa_id=$1 and p.local_id=$2 and p.cuenta_id=$3
              and l.id::text=e.aggregate_id
         ))
       )

    union all

    select t.occurred_at
      from public.pedido_transiciones t
      join public.pedidos_tpv p
        on p.empresa_id=t.empresa_id
       and p.local_id=t.local_id
       and p.id=t.pedido_id
     where p.empresa_id=$1 and p.local_id=$2 and p.cuenta_id=$3

    union all

    select t.occurred_at
      from public.pedido_linea_transiciones t
      join public.pedidos_tpv p
        on p.empresa_id=t.empresa_id
       and p.local_id=t.local_id
       and p.id=t.pedido_id
     where p.empresa_id=$1 and p.local_id=$2 and p.cuenta_id=$3
  ) x
$$;

create function private.abc_revision_cuenta(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid
)
returns text
language sql
stable
security definer
set search_path=''
as $$
  select md5(
    c.id::text||'|'||
    c.version::text||'|'||
    c.estado||'|'||
    coalesce(c.responsable_actual::text,'')||'|'||
    coalesce((
      select string_agg(
        p.id::text||':'||p.version::text||':'||p.estado,
        ',' order by p.id
      )
      from public.pedidos_tpv p
      where p.empresa_id=c.empresa_id
        and p.local_id=c.local_id
        and p.cuenta_id=c.id
    ),'')||'|'||
    coalesce((
      select string_agg(
        l.id::text||':'||l.version::text||':'||l.estado,
        ',' order by l.id
      )
      from public.pedido_lineas l
      join public.pedidos_tpv p
        on p.empresa_id=l.empresa_id
       and p.local_id=l.local_id
       and p.id=l.pedido_id
      where p.empresa_id=c.empresa_id
        and p.local_id=c.local_id
        and p.cuenta_id=c.id
    ),'')
  )
  from public.cuentas_comerciales c
  where c.empresa_id=$1 and c.local_id=$2 and c.id=$3
$$;

create or replace function private.abc_tiene_capacidad(
  p_empresa_id text,
  p_local_id text,
  p_capacidad text
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_rol text;
  v_capacidad text := upper(btrim(coalesce(p_capacidad,'')));
begin
  if auth.uid() is null then return false; end if;
  if nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or v_capacidad='' then
    return false;
  end if;
  if not private.la_tiene_local(p_empresa_id,p_local_id) then
    return false;
  end if;

  select m.rol
    into v_rol
    from public.membresias_usuario m
   where m.user_id=auth.uid()
     and m.empresa_id=p_empresa_id
     and m.activo=true
     and (
       (m.todos_locales=false and m.local_id=p_local_id)
       or (m.todos_locales=true and m.local_id is null)
     )
   order by
     case when m.todos_locales=false and m.local_id=p_local_id then 0 else 1 end,
     m.id desc
   limit 1;

  if v_rol is null then return false; end if;

  return case v_capacidad
    when 'ABC_CUENTA_OPERAR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a','Churrero/a')
    when 'ABC_CUENTA_REASIGNAR' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_COBRO_INICIAR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_COBRO_EFECTIVO' then
      v_rol in ('Propietario','Encargado','Cajero/a')
    when 'ABC_REEMBOLSO_SOLICITAR' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_REEMBOLSO_CONFIRMAR' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_CAJA_OPERAR' then
      v_rol in ('Propietario','Encargado','Cajero/a')
    when 'ABC_EMISOR_CAMBIAR' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_PEDIDO_ENVIAR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_PREPARACION_INICIAR' then
      v_rol in ('Propietario','Encargado','Camarero/a','Churrero/a')
    when 'ABC_PREPARACION_COMPLETAR' then
      v_rol in ('Propietario','Encargado','Camarero/a','Churrero/a')
    when 'ABC_PEDIDO_SERVIR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_LINEA_CANCELAR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_CANCELACION_SENSIBLE' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_PEDIDO_CANCELAR' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_PEDIDO_CERRAR' then
      v_rol in ('Propietario','Encargado','Cajero/a')
    else false
  end;
end $$;

create function public.abc_recuperar_cuenta(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_cuenta public.cuentas_comerciales%rowtype;
  v_pedidos jsonb;
  v_cobro jsonb;
  v_last_activity timestamptz;
  v_revision text;
  v_requires_day boolean;
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
  v_requires_day:=
    v_cuenta.estado='ABIERTA'
    and v_cuenta.opened_operating_day<>p_operating_day;

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
    'pedidos',v_pedidos,
    'estado_cobro',v_cobro
  );
end $$;

create function public.abc_listar_cuentas_recuperables(
  p_empresa_id text,
  p_local_id text,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date,
  p_abandono_minutos integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'cuentas_recuperables_no_autorizadas';
  end if;
  if p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'cuentas_recuperables_parametros_requeridos';
  end if;
  if p_abandono_minutos is null or p_abandono_minutos<0 or p_abandono_minutos>10080 then
    raise exception 'abandono_minutos_invalido';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'cuenta_id',x.id,
        'estado',x.estado,
        'version',x.version,
        'currency_code',x.currency_code,
        'modalidad',x.modalidad,
        'responsable_actual',x.responsable_actual,
        'opened_at',x.opened_at,
        'opened_operating_day',x.opened_operating_day,
        'last_activity_at',x.last_activity_at,
        'pedidos_count',x.pedidos_count,
        'lineas_activas_count',x.lineas_activas_count,
        'revision',x.revision,
        'reanudable_mismo_dia',x.opened_operating_day=p_operating_day,
        'requires_operating_day_resolution',x.opened_operating_day<>p_operating_day,
        'posible_abandono',
          x.last_activity_at <= now()-make_interval(mins=>p_abandono_minutos)
      )
      order by x.last_activity_at desc,x.id
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      c.id,
      c.estado,
      c.version,
      c.currency_code,
      c.modalidad,
      c.responsable_actual,
      c.opened_at,
      c.opened_operating_day,
      private.abc_ultima_actividad_cuenta(
        c.empresa_id,c.local_id,c.id
      ) last_activity_at,
      private.abc_revision_cuenta(
        c.empresa_id,c.local_id,c.id
      ) revision,
      (
        select count(*)
        from public.pedidos_tpv p
        where p.empresa_id=c.empresa_id
          and p.local_id=c.local_id
          and p.cuenta_id=c.id
          and p.estado not in ('CERRADO','CANCELADO')
      ) pedidos_count,
      (
        select count(*)
        from public.pedido_lineas l
        join public.pedidos_tpv p
          on p.empresa_id=l.empresa_id
         and p.local_id=l.local_id
         and p.id=l.pedido_id
        where p.empresa_id=c.empresa_id
          and p.local_id=c.local_id
          and p.cuenta_id=c.id
          and l.estado<>'CANCELADA'
      ) lineas_activas_count
    from public.cuentas_comerciales c
    where c.empresa_id=p_empresa_id
      and c.local_id=p_local_id
      and c.estado='ABIERTA'
  ) x;

  return jsonb_build_object(
    'ok',true,
    'terminal_id',p_terminal_id,
    'session_id',p_session_id,
    'operating_day',p_operating_day,
    'abandono_minutos',p_abandono_minutos,
    'cuentas',v_result
  );
end $$;

create function public.abc_consultar_operacion(
  p_empresa_id text,
  p_local_id text,
  p_operation_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_row public.abc_operaciones%rowtype;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'operacion_consulta_no_autorizada';
  end if;
  if nullif(btrim(coalesce(p_operation_id,'')),'') is null then
    raise exception 'operation_id_requerido';
  end if;

  select *
    into v_row
    from public.abc_operaciones
   where operation_id=p_operation_id
     and empresa_id=p_empresa_id
     and local_id=p_local_id
     and executor_kind='USER'
     and actor_user_id=auth.uid();

  if not found then
    raise exception 'operacion_no_encontrada_o_no_autorizada';
  end if;

  return jsonb_build_object(
    'ok',true,
    'operation_id',v_row.operation_id,
    'command_type',v_row.command_type,
    'request_hash',v_row.request_hash,
    'status',v_row.status,
    'resultado',v_row.resultado,
    'error',v_row.error,
    'terminal_id',v_row.terminal_id,
    'created_at',v_row.created_at,
    'completed_at',v_row.completed_at
  );
end $$;

create function public.abc_cambiar_responsable_cuenta(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid,
  p_nuevo_responsable uuid,
  p_motivo text,
  p_expected_cuenta_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_cuenta public.cuentas_comerciales%rowtype;
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
  v_new_version bigint;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(
       p_empresa_id,p_local_id,'ABC_CUENTA_REASIGNAR'
     ) then
    raise exception 'cuenta_reasignar_no_autorizada';
  end if;
  if p_cuenta_id is null or p_nuevo_responsable is null
     or p_expected_cuenta_version is null
     or p_terminal_id is null or p_session_id is null
     or p_operating_day is null then
    raise exception 'cuenta_reasignar_parametros_requeridos';
  end if;
  if v_motivo is null then raise exception 'motivo_reasignacion_requerido'; end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;
  if not private.abc_usuario_activo_local(
    p_empresa_id,p_local_id,p_nuevo_responsable
  ) then
    raise exception 'nuevo_responsable_no_pertenece_local';
  end if;

  v_request:=jsonb_build_object(
    'cuenta_id',p_cuenta_id,
    'nuevo_responsable',p_nuevo_responsable,
    'motivo',v_motivo,
    'expected_cuenta_version',p_expected_cuenta_version,
    'terminal_id',p_terminal_id,
    'session_id',p_session_id,
    'operating_day',p_operating_day
  );

  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_CAMBIAR_RESPONSABLE_CUENTA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select *
    into v_cuenta
    from public.cuentas_comerciales
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_cuenta_id
   for update;

  if not found then raise exception 'cuenta_no_encontrada'; end if;
  if v_cuenta.estado<>'ABIERTA' then raise exception 'cuenta_no_abierta'; end if;
  if v_cuenta.version<>p_expected_cuenta_version then
    raise exception 'cuenta_version_conflict';
  end if;
  if v_cuenta.opened_operating_day<>p_operating_day then
    raise exception 'operating_day_cuenta_inconsistente';
  end if;
  if v_cuenta.responsable_actual=p_nuevo_responsable then
    raise exception 'responsable_sin_cambio';
  end if;

  update public.cuentas_comerciales
     set responsable_actual=p_nuevo_responsable,
         version=version+1
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_cuenta_id
  returning version into v_new_version;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,
    'CUENTA',p_cuenta_id::text,'CUENTA_RESPONSABLE_CAMBIADO',
    jsonb_build_object(
      'responsable_anterior',v_cuenta.responsable_actual,
      'responsable_nuevo',p_nuevo_responsable,
      'motivo',v_motivo,
      'cuenta_version',v_new_version,
      'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,
    'cuenta_id',p_cuenta_id,
    'responsable_anterior',v_cuenta.responsable_actual,
    'responsable_actual',p_nuevo_responsable,
    'motivo',v_motivo,
    'version',v_new_version
  );

  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

revoke all on function private.abc_ultima_actividad_cuenta(text,text,uuid)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_revision_cuenta(text,text,uuid)
  from public,anon,authenticated,service_role;

revoke all on function public.abc_recuperar_cuenta(
  text,text,uuid,uuid,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_listar_cuentas_recuperables(
  text,text,uuid,uuid,date,integer
) from public,anon,authenticated,service_role;
revoke all on function public.abc_consultar_operacion(
  text,text,text
) from public,anon,authenticated,service_role;
revoke all on function public.abc_cambiar_responsable_cuenta(
  text,text,text,uuid,uuid,text,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;

grant execute on function public.abc_recuperar_cuenta(
  text,text,uuid,uuid,uuid,date
) to authenticated;
grant execute on function public.abc_listar_cuentas_recuperables(
  text,text,uuid,uuid,date,integer
) to authenticated;
grant execute on function public.abc_consultar_operacion(
  text,text,text
) to authenticated;
grant execute on function public.abc_cambiar_responsable_cuenta(
  text,text,text,uuid,uuid,text,bigint,uuid,uuid,date
) to authenticated;
