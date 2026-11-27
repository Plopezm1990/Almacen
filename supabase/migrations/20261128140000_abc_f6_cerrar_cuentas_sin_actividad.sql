-- Hallazgos H-28 y H-29 de la auditoría del TPV (25-26/11/2026), decisión recomendada y aprobada por delegación el 27/11/2026.
--
--   H-28 · «85 cuentas abiertas en el local, 83 de días ya cerrados»: «desde aquí no se retoman y tampoco se cierran solas».
--   H-29 · una recarga a mitad de «Guardar pedido» deja una cuenta ABIERTA sin pedido ni línea.
--
-- Sin esto las cuentas se acumulan (en QA hay 90 abiertas) y estorban en «Cuentas abiertas». Las de H-21 y H-49 ya se cierran solas AL CANCELAR su
-- último pedido; esta función cubre las que quedaron huérfanas y las anteriores a esas correcciones.
--
-- Función: public.abc_cerrar_cuentas_sin_actividad(p_operation_id, p_empresa_id, p_local_id, p_sin_pedido_minutos = 60). Solo Propietario y Encargado
-- (private.pm06_puede_gestionar_finanzas) de ese local. Cierra (CERRADA, closed_at, versión +1, evento CUENTA_CERRADA_SIN_ACTIVIDAD) una cuenta ABIERTA
-- únicamente si se cumplen TODAS estas condiciones; si no, la deja como estaba y la cuenta como «omitida»:
--   * no tiene ningún pedido vivo (distinto de CANCELADO): un pedido enviado y sin cobrar es dinero pendiente y lo resuelve una persona, no esta función;
--   * no tiene dinero en juego: ningún checkout COMPLETADO, ningún pago que no sea RECHAZADO o CANCELADO, ninguna incidencia de cobro ABIERTA;
--   * su venta fiscal, si la hay, es solo la foto del cobro (ABIERTA, sin bloquear y enlazada a un checkout) o está CANCELADA;
--   * no tiene repartos ni cuotas por importe vivos, ni como origen ni como destino;
--   * y está sin actividad: o es de un DÍA OPERATIVO YA CERRADO (anterior al actual, que lo decide el servidor), o no tiene ningún pedido ni cobro y lleva más de
--     p_sin_pedido_minutos desde que se creó (mínimo 15; es el caso de H-29).
-- Al cerrarla cancela sus checkouts ABIERTO o EN_COBRO y la foto fiscal (como H-49). Cada llamada lleva su identificador de operación: repetirla devuelve el
-- mismo resultado sin volver a tocar nada. Devuelve {cerradas, omitidas, cuentas, dia_operativo}.
--
-- Qué NO hace, a propósito: no cierra cuentas con un pedido vivo aunque sean de días anteriores (en QA son 81 de las 90): resolverlas (cobrarlas o anular
-- el pedido) es una decisión de quien conoce el caso. Tampoco repara ni borra nada más.
--
-- Contrato: tests/rediseno/h28-h29-cerrar-cuentas-sin-actividad-pglite-contract.mjs

create or replace function public.abc_cerrar_cuentas_sin_actividad(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_sin_pedido_minutos integer default 60
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_minutos integer := greatest(coalesce(p_sin_pedido_minutos, 60), 15);
  v_dia date;
  v_cmd jsonb;
  v_cuenta record;
  v_cerradas uuid[] := array[]::uuid[];
  v_omitidas integer := 0;
  v_version bigint;
  v_motivo text;
  v_resultado jsonb;
begin
  if auth.uid() is null then raise exception 'abc_no_autenticado'; end if;
  if nullif(btrim(coalesce(p_operation_id, '')), '') is null
     or nullif(btrim(coalesce(p_empresa_id, '')), '') is null
     or nullif(btrim(coalesce(p_local_id, '')), '') is null then
    raise exception 'cuentas_limpieza_parametros_invalidos';
  end if;
  if not private.la_tiene_local(p_empresa_id, p_local_id)
     or not private.pm06_puede_gestionar_finanzas() then
    raise exception 'cuentas_limpieza_no_autorizada';
  end if;

  v_dia := private.abc_config_dia_evento(p_empresa_id, p_local_id);
  v_cmd := private.abc_operacion_iniciar(
    p_operation_id, p_empresa_id, p_local_id, 'ABC_CERRAR_CUENTAS_SIN_ACTIVIDAD',
    jsonb_build_object('sin_pedido_minutos', v_minutos), null
  );
  if coalesce((v_cmd->>'replayed')::boolean, false) then
    return coalesce(v_cmd->'resultado', v_cmd);
  end if;

  for v_cuenta in
    select c.id, c.opened_operating_day, c.created_at
      from public.cuentas_comerciales c
     where c.empresa_id = p_empresa_id and c.local_id = p_local_id and c.estado = 'ABIERTA'
     order by c.created_at, c.id
       for update skip locked
  loop
    -- Un pedido vivo (enviado y sin cobrar, por ejemplo) es dinero pendiente: lo resuelve una persona.
    if exists (
      select 1 from public.pedidos_tpv o
       where o.empresa_id = p_empresa_id and o.local_id = p_local_id
         and o.cuenta_id = v_cuenta.id and o.estado <> 'CANCELADO'
    ) then v_omitidas := v_omitidas + 1; continue; end if;

    -- Dinero en juego (mismo criterio que H-49).
    if exists (
      select 1 from public.checkouts k
       where k.empresa_id = p_empresa_id and k.local_id = p_local_id and k.cuenta_id = v_cuenta.id
         and (k.estado = 'COMPLETADO'
              or exists (
                select 1 from public.pagos g
                 where g.empresa_id = k.empresa_id and g.local_id = k.local_id
                   and g.checkout_id = k.id and g.estado not in ('RECHAZADO', 'CANCELADO'))
              or exists (
                select 1 from public.pagos g
                  join public.pago_intentos pi on pi.empresa_id = g.empresa_id
                   and pi.local_id = g.local_id and pi.pago_id = g.id
                  join public.abc_cobro_incidencias i on i.empresa_id = pi.empresa_id
                   and i.local_id = pi.local_id and i.intento_id = pi.id
                 where g.empresa_id = k.empresa_id and g.local_id = k.local_id
                   and g.checkout_id = k.id and i.estado = 'ABIERTA'))
    ) then v_omitidas := v_omitidas + 1; continue; end if;

    -- Venta fiscal distinta de la foto del cobro.
    if exists (
      select 1 from public.ventas_fiscales v
       where v.empresa_id = p_empresa_id and v.local_id = p_local_id
         and v.cuenta_id = v_cuenta.id and v.estado <> 'CANCELADA'
         and not (v.estado = 'ABIERTA' and v.locked_at is null
                  and exists (
                    select 1 from public.checkout_ventas cv
                     where cv.empresa_id = v.empresa_id and cv.local_id = v.local_id
                       and cv.venta_fiscal_id = v.id))
    ) then v_omitidas := v_omitidas + 1; continue; end if;

    -- Repartos y cuotas por importe vivos, como origen o como destino.
    if exists (
      select 1 from public.cuenta_linea_repartos r
       where r.empresa_id = p_empresa_id and r.local_id = p_local_id
         and r.estado not in ('CERRADO', 'CANCELADO', 'CANCELADA')
         and (r.cuenta_id = v_cuenta.id
              or r.source_line_id in (
                select l.id from public.pedido_lineas l
                  join public.pedidos_tpv o on o.empresa_id = l.empresa_id
                   and o.local_id = l.local_id and o.id = l.pedido_id
                 where l.empresa_id = p_empresa_id and l.local_id = p_local_id
                   and o.cuenta_id = v_cuenta.id))
    ) or exists (
      select 1 from public.cuenta_cuotas_importe q
       where q.empresa_id = p_empresa_id and q.local_id = p_local_id
         and q.estado not in ('CERRADO', 'CANCELADO', 'CANCELADA')
         and (q.cuenta_origen_id = v_cuenta.id or q.cuenta_destino_id = v_cuenta.id)
    ) then v_omitidas := v_omitidas + 1; continue; end if;

    -- Sin actividad: de un día operativo ya cerrado, o sin ningún pedido ni cobro y con más de N minutos.
    if v_cuenta.opened_operating_day < v_dia then
      v_motivo := 'DIA_OPERATIVO_CERRADO';
    elsif not exists (
            select 1 from public.pedidos_tpv o
             where o.empresa_id = p_empresa_id and o.local_id = p_local_id and o.cuenta_id = v_cuenta.id)
          and not exists (
            select 1 from public.checkouts k
             where k.empresa_id = p_empresa_id and k.local_id = p_local_id and k.cuenta_id = v_cuenta.id)
          and v_cuenta.created_at < now() - make_interval(mins => v_minutos) then
      v_motivo := 'SIN_PEDIDO';
    else
      v_omitidas := v_omitidas + 1; continue;
    end if;

    update public.checkouts
       set estado = 'CANCELADO', cancelled_at = now(), version = version + 1
     where empresa_id = p_empresa_id and local_id = p_local_id
       and cuenta_id = v_cuenta.id and estado in ('ABIERTO', 'EN_COBRO');
    update public.ventas_fiscales
       set estado = 'CANCELADA', version = version + 1
     where empresa_id = p_empresa_id and local_id = p_local_id
       and cuenta_id = v_cuenta.id and estado = 'ABIERTA' and locked_at is null;
    update public.cuentas_comerciales
       set estado = 'CERRADA', closed_at = now(), version = version + 1
     where empresa_id = p_empresa_id and local_id = p_local_id
       and id = v_cuenta.id and estado = 'ABIERTA'
    returning version into v_version;

    insert into public.abc_eventos(
      empresa_id, local_id, operation_id, aggregate_type, aggregate_id, event_type,
      payload, actor_user_id, terminal_id, occurred_at, operating_day
    ) values (
      p_empresa_id, p_local_id, p_operation_id, 'CUENTA', v_cuenta.id::text, 'CUENTA_CERRADA_SIN_ACTIVIDAD',
      jsonb_build_object('motivo', v_motivo, 'cuenta_version', v_version, 'opened_operating_day', v_cuenta.opened_operating_day),
      auth.uid(), null, now(), v_dia
    );
    v_cerradas := array_append(v_cerradas, v_cuenta.id);
  end loop;

  v_resultado := jsonb_build_object(
    'ok', true, 'replayed', false, 'dia_operativo', v_dia,
    'cerradas', cardinality(v_cerradas), 'omitidas', v_omitidas, 'cuentas', to_jsonb(v_cerradas)
  );
  perform private.abc_operacion_completar(p_operation_id, v_resultado);
  return v_resultado;
end
$function$;

revoke all on function public.abc_cerrar_cuentas_sin_actividad(text, text, text, integer) from public, anon;
grant execute on function public.abc_cerrar_cuentas_sin_actividad(text, text, text, integer) to authenticated;
