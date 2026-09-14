-- PM27 C21: Encargos, anticipos y clientes.
-- Endurece la frontera autoritativa de encargos sin crear un segundo motor de pagos.
--
-- Hallazgos cerrados por este parche:
-- 1) authenticated podía mutar public.encargos_empresa directamente y saltarse
--    private.pm08_puede_operar_caja() y las validaciones de public.registrar_encargo.
-- 2) registrar_encargo no rechazaba un cliente ya conocido de otra empresa.
-- 3) registrar_encargo permitía reinterpretar estados terminales y cambiar total/cliente
--    de un documento ya cerrado, degradando trazabilidad y saldo.
--
-- No toca pagos_encargo, operation_id global ni concurrencia del blob almacen_kv:
-- esos ámbitos corresponden a C22/C23.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.encargos_empresa') is null then
    raise exception 'PREFLIGHT_FALLO: falta public.encargos_empresa';
  end if;
  if to_regclass('public.clientes_empresa') is null then
    raise exception 'PREFLIGHT_FALLO: falta public.clientes_empresa';
  end if;
  if to_regclass('public.pagos_encargo') is null then
    raise exception 'PREFLIGHT_FALLO: falta public.pagos_encargo';
  end if;
  if to_regprocedure('private.pm08_puede_operar_caja()') is null then
    raise exception 'PREFLIGHT_FALLO: falta private.pm08_puede_operar_caja()';
  end if;
  if to_regprocedure('private.pm08_local_operable(text,text)') is null then
    raise exception 'PREFLIGHT_FALLO: falta private.pm08_local_operable(text,text)';
  end if;
  if to_regprocedure('private.pm08_validar_dinero(numeric,boolean,boolean)') is null then
    raise exception 'PREFLIGHT_FALLO: falta private.pm08_validar_dinero(numeric,boolean,boolean)';
  end if;
  if to_regprocedure('private.la_tiene_empresa(text)') is null
     or to_regprocedure('private.la_tiene_local(text,text)') is null then
    raise exception 'PREFLIGHT_FALLO: faltan helpers tenant';
  end if;
end
$preflight$;

-- La tabla queda de lectura para authenticated. Toda mutación pasa por registrar_encargo,
-- que aplica rol, tenant, local operable, cliente y máquina de estados.
revoke all on table public.encargos_empresa from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.encargos_empresa from authenticated;
grant select on table public.encargos_empresa to authenticated;

create or replace function public.registrar_encargo(
  p_id text,
  p_empresa_id text,
  p_local_id text,
  p_cliente_id text,
  p_total numeric,
  p_estado text default 'Pendiente',
  p_datos jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'private', 'pg_temp'
as $function$
declare
  v_total numeric;
  v_total_anterior numeric;
  v_estado text;
  v_estado_anterior text;
  v_cliente_empresa text;
  v_pagado numeric := 0;
  v_datos jsonb;
  v_actual public.encargos_empresa%rowtype;
  v_nuevo public.encargos_empresa%rowtype;
begin
  if auth.uid() is null or not private.pm08_puede_operar_caja() then
    raise exception 'encargo_no_autorizado';
  end if;
  if p_id is null or btrim(p_id) = '' then
    raise exception 'encargo_id_requerido';
  end if;
  if p_cliente_id is null or btrim(p_cliente_id) = '' then
    raise exception 'cliente_id_requerido';
  end if;
  if not private.la_tiene_empresa(p_empresa_id)
     or not private.la_tiene_local(p_empresa_id, p_local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if not private.pm08_local_operable(p_empresa_id, p_local_id) then
    raise exception 'local_inactivo';
  end if;

  -- SECURITY DEFINER permite contrastar el id global del cliente contra su empresa real.
  -- Compatibilidad: un cliente legacy todavía no espejado en clientes_empresa se admite,
  -- pero un id ya conocido de otra empresa falla cerrado.
  select c.empresa_id
    into v_cliente_empresa
    from public.clientes_empresa c
   where c.id = p_cliente_id;
  if found and v_cliente_empresa is distinct from p_empresa_id then
    raise exception 'cliente_otro_contexto';
  end if;

  v_total := private.pm08_validar_dinero(p_total, true, false);
  v_estado := coalesce(nullif(btrim(p_estado), ''), 'Pendiente');
  if v_estado not in ('Pendiente', 'Entregado', 'Cancelado', 'Devuelto') then
    raise exception 'estado_encargo_invalido';
  end if;

  -- Serializa el documento antes de validar una transición o su saldo.
  select *
    into v_actual
    from public.encargos_empresa
   where id = p_id
   for update;

  if found then
    if v_actual.empresa_id is distinct from p_empresa_id
       or v_actual.local_id is distinct from p_local_id then
      raise exception 'encargo_referencia_otro_contexto';
    end if;

    v_estado_anterior := coalesce(nullif(v_actual.datos->>'estado', ''), 'Pendiente');
    v_total_anterior := round(coalesce(nullif(v_actual.datos->>'total', '')::numeric, 0), 2);

    if v_estado_anterior not in ('Pendiente', 'Entregado', 'Cancelado', 'Devuelto') then
      raise exception 'estado_encargo_historico_invalido';
    end if;

    -- Máquina de estados cerrada: no se revive un documento terminal.
    if (v_estado_anterior = 'Pendiente' and v_estado not in ('Pendiente', 'Entregado', 'Cancelado'))
       or (v_estado_anterior = 'Entregado' and v_estado not in ('Entregado', 'Devuelto'))
       or (v_estado_anterior = 'Cancelado' and v_estado <> 'Cancelado')
       or (v_estado_anterior = 'Devuelto' and v_estado <> 'Devuelto') then
      raise exception 'transicion_encargo_invalida';
    end if;

    select round(coalesce(sum(
      case
        when p.estado = 'CONFIRMADO' then p.importe
        when p.estado = 'REVERSO' then -p.importe
        else 0
      end
    ), 0), 2)
      into v_pagado
      from public.pagos_encargo p
     where p.encargo_id = p_id
       and p.empresa_id = p_empresa_id
       and p.local_id = p_local_id;

    v_pagado := greatest(coalesce(v_pagado, 0), 0);
    if v_total < v_pagado then
      raise exception 'total_inferior_a_pagado';
    end if;

    -- Un encargo con dinero comprometido no puede reasignarse a otro cliente.
    if v_pagado > 0 and v_actual.cliente_id is distinct from p_cliente_id then
      raise exception 'encargo_con_cobros_cliente_inmutable';
    end if;

    -- Cerrar o avanzar un documento conserva identidad económica y cliente.
    if v_estado is distinct from v_estado_anterior
       and (v_total is distinct from v_total_anterior
            or v_actual.cliente_id is distinct from p_cliente_id) then
      raise exception 'cierre_encargo_identidad_conflict';
    end if;

    -- Replay de un estado terminal: no reescribe metadatos ni updated_at.
    if v_estado_anterior in ('Entregado', 'Cancelado', 'Devuelto')
       and v_estado = v_estado_anterior then
      if v_total is distinct from v_total_anterior
         or v_actual.cliente_id is distinct from p_cliente_id then
        raise exception 'encargo_terminal_inmutable';
      end if;
      return jsonb_build_object('ok', true, 'replayed', true, 'encargo', to_jsonb(v_actual));
    end if;

    v_datos := coalesce(v_actual.datos, '{}'::jsonb)
      || coalesce(p_datos, '{}'::jsonb)
      || jsonb_build_object(
        'total', v_total,
        'estado', v_estado,
        'clienteId', p_cliente_id,
        'empresaId', p_empresa_id,
        'localId', p_local_id
      );

    update public.encargos_empresa
       set cliente_id = p_cliente_id,
           datos = v_datos,
           updated_at = now()
     where id = p_id
     returning * into v_nuevo;
  else
    v_datos := coalesce(p_datos, '{}'::jsonb)
      || jsonb_build_object(
        'total', v_total,
        'estado', v_estado,
        'clienteId', p_cliente_id,
        'empresaId', p_empresa_id,
        'localId', p_local_id
      );

    insert into public.encargos_empresa(
      id, empresa_id, local_id, cliente_id, datos, updated_at
    ) values (
      p_id, p_empresa_id, p_local_id, p_cliente_id, v_datos, now()
    )
    returning * into v_nuevo;
  end if;

  return jsonb_build_object('ok', true, 'replayed', false, 'encargo', to_jsonb(v_nuevo));
end;
$function$;

revoke all on function public.registrar_encargo(text,text,text,text,numeric,text,jsonb)
  from public, anon;
grant execute on function public.registrar_encargo(text,text,text,text,numeric,text,jsonb)
  to authenticated;

commit;
