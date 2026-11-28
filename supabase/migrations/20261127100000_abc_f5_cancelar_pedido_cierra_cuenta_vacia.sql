-- Hallazgos H-21 y H-42 de la auditoría del TPV (26/11/2026), decisión del usuario el 27/11/2026:
-- «Cancelar pedido» dejaba el pedido y sus líneas CANCELADOS pero la cuenta comercial ABIERTA y sin
-- líneas activas. Esas cuentas se acumulaban en «Cuentas abiertas» (94 en QA), no se podían retomar
-- de forma útil y bloqueaban iniciar otra venta rápida en el terminal.
--
-- Corrección: al cancelar el ÚLTIMO pedido vivo de una cuenta que no tiene nada más, la propia
-- cancelación cierra la cuenta (CERRADA, closed_at, versión +1) y deja el evento
-- CUENTA_CERRADA_SIN_PEDIDOS. Solo se cierra si la cuenta:
--   * está ABIERTA,
--   * no conserva ningún otro pedido distinto de CANCELADO,
--   * no tiene venta fiscal distinta de CANCELADA ni checkout alguno (puede haber pagos),
--   * no tiene repartos ni cuotas por importe vivos, ni como origen ni como destino, ni líneas
--     suyas repartidas a otra cuenta.
-- Cualquier otro caso se deja como estaba: cerrar de más sería peor que no cerrar.
--
-- Cómo se aplica: se parchea la definición VIVA de public.abc_cancelar_pedido (sin arrastrar deriva
-- entre el repositorio y lo desplegado), es idempotente y falla en voz alta si la forma esperada no
-- está. El resultado de la función suma `cuenta_cerrada` y `cuenta_id`.
--
-- Contrato: tests/rediseno/h21-cancelar-pedido-cierra-cuenta-pglite-contract.mjs

do $migracion$
declare
  v_oid oid;
  v_def text;
  v_nuevo text;
  v_n integer;

  v_patron_decl constant text := 'v_canceladas\s+integer\s*;';
  v_reemplazo_decl constant text :=
    'v_canceladas integer;' || chr(10)
    || '  v_cuenta_cerrada boolean:=false;' || chr(10)
    || '  v_cuenta_version bigint;';

  v_patron_cancel constant text := 'returning\s+version\s+into\s+v_new_version\s*;';
  v_reemplazo_cancel constant text :=
    'returning version into v_new_version;' || chr(10)
    || chr(10)
    || '  -- H-21 / H-42: la cuenta sin pedidos vivos ni cobros se cierra con la cancelacion.' || chr(10)
    || '  if exists(' || chr(10)
    || '       select 1 from public.cuentas_comerciales c' || chr(10)
    || '        where c.empresa_id=p_empresa_id and c.local_id=p_local_id' || chr(10)
    || '          and c.id=v_pedido.cuenta_id and c.estado=''ABIERTA'')' || chr(10)
    || '     and not exists(' || chr(10)
    || '       select 1 from public.pedidos_tpv o' || chr(10)
    || '        where o.empresa_id=p_empresa_id and o.local_id=p_local_id' || chr(10)
    || '          and o.cuenta_id=v_pedido.cuenta_id and o.estado<>''CANCELADO'')' || chr(10)
    || '     and not exists(' || chr(10)
    || '       select 1 from public.ventas_fiscales v' || chr(10)
    || '        where v.empresa_id=p_empresa_id and v.local_id=p_local_id' || chr(10)
    || '          and v.cuenta_id=v_pedido.cuenta_id and v.estado<>''CANCELADA'')' || chr(10)
    || '     and not exists(' || chr(10)
    || '       select 1 from public.checkouts k' || chr(10)
    || '        where k.empresa_id=p_empresa_id and k.local_id=p_local_id' || chr(10)
    || '          and k.cuenta_id=v_pedido.cuenta_id)' || chr(10)
    || '     and not exists(' || chr(10)
    || '       select 1 from public.cuenta_linea_repartos r' || chr(10)
    || '        where r.empresa_id=p_empresa_id and r.local_id=p_local_id' || chr(10)
    || '          and r.estado not in (''CERRADO'',''CANCELADO'',''CANCELADA'')' || chr(10)
    || '          and (r.cuenta_id=v_pedido.cuenta_id' || chr(10)
    || '               or r.source_line_id in (' || chr(10)
    || '                 select l.id from public.pedido_lineas l' || chr(10)
    || '                  where l.empresa_id=p_empresa_id and l.local_id=p_local_id' || chr(10)
    || '                    and l.pedido_id=p_pedido_id)))' || chr(10)
    || '     and not exists(' || chr(10)
    || '       select 1 from public.cuenta_cuotas_importe q' || chr(10)
    || '        where q.empresa_id=p_empresa_id and q.local_id=p_local_id' || chr(10)
    || '          and q.estado not in (''CERRADO'',''CANCELADO'',''CANCELADA'')' || chr(10)
    || '          and (q.cuenta_origen_id=v_pedido.cuenta_id' || chr(10)
    || '               or q.cuenta_destino_id=v_pedido.cuenta_id)) then' || chr(10)
    || '    update public.cuentas_comerciales' || chr(10)
    || '       set estado=''CERRADA'',closed_at=now(),version=version+1' || chr(10)
    || '     where empresa_id=p_empresa_id and local_id=p_local_id' || chr(10)
    || '       and id=v_pedido.cuenta_id and estado=''ABIERTA''' || chr(10)
    || '    returning version into v_cuenta_version;' || chr(10)
    || '    v_cuenta_cerrada:=found;' || chr(10)
    || '    if v_cuenta_cerrada then' || chr(10)
    || '      insert into public.abc_eventos(' || chr(10)
    || '        empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,' || chr(10)
    || '        payload,actor_user_id,terminal_id,occurred_at,operating_day' || chr(10)
    || '      ) values (' || chr(10)
    || '        p_empresa_id,p_local_id,p_operation_id,''CUENTA'',v_pedido.cuenta_id::text,' || chr(10)
    || '        ''CUENTA_CERRADA_SIN_PEDIDOS'',' || chr(10)
    || '        jsonb_build_object(''pedido_id'',p_pedido_id,''motivo'',v_motivo,' || chr(10)
    || '          ''cuenta_version'',v_cuenta_version,''session_id'',p_session_id),' || chr(10)
    || '        auth.uid(),p_terminal_id,now(),p_operating_day' || chr(10)
    || '      );' || chr(10)
    || '    end if;' || chr(10)
    || '  end if;';

  v_patron_result constant text :=
    '''lineas_canceladas'',v_canceladas\s*\)\s*;\s*perform\s+private\.abc_operacion_completar';
  v_reemplazo_result constant text :=
    '''lineas_canceladas'',v_canceladas,' || chr(10)
    || '    ''cuenta_cerrada'',v_cuenta_cerrada,''cuenta_id'',v_pedido.cuenta_id' || chr(10)
    || '  );' || chr(10)
    || '  perform private.abc_operacion_completar';
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'abc_cancelar_pedido' and p.prokind = 'f';
  if v_oid is null then
    raise exception 'FUNCION_OBLIGATORIA_NO_ENCONTRADA: public.abc_cancelar_pedido';
  end if;
  v_def := pg_get_functiondef(v_oid);

  -- Ya aplicada: no se vuelve a tocar.
  if position('CUENTA_CERRADA_SIN_PEDIDOS' in v_def) > 0 then
    raise notice 'cancelar pedido cierra cuenta vacia: ya aplicada';
    return;
  end if;

  foreach v_nuevo in array array[v_patron_decl, v_patron_cancel, v_patron_result] loop
    select count(*) into v_n from regexp_matches(v_def, v_nuevo, 'g');
    if v_n <> 1 then
      raise exception 'ESTRUCTURA_NO_ENCONTRADA: % no tiene exactamente una coincidencia de «%»', v_oid::regprocedure, v_nuevo;
    end if;
  end loop;

  v_nuevo := regexp_replace(v_def, v_patron_decl, v_reemplazo_decl, 'g');
  v_nuevo := regexp_replace(v_nuevo, v_patron_cancel, v_reemplazo_cancel, 'g');
  v_nuevo := regexp_replace(v_nuevo, v_patron_result, v_reemplazo_result, 'g');
  execute v_nuevo;
  raise notice 'cancelar pedido cierra cuenta vacia: aplicada';
end
$migracion$;
