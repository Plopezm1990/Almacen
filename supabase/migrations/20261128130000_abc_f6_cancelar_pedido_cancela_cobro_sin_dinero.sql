-- Hallazgo H-49 (verificación en el navegador de QA, 27/11/2026), decisión recomendada y aprobada por delegación el 27/11/2026:
-- cancelar el pedido DESPUÉS de iniciar el cobro dejaba la cuenta ABIERTA para siempre. La corrección de H-21 / H-42
-- (20261127100000) cierra la cuenta al cancelar su último pedido solo si no tiene NINGÚN checkout ni venta fiscal distinta de
-- CANCELADA, y el flujo no tiene ninguna función para cancelar un checkout (solo abrir, iniciar cobro, preparar y cerrar una cuenta
-- PAGADA). Un cliente que empieza a pagar con tarjeta, falla y se va dejaba una cuenta que nadie podía cerrar, y que bloqueaba iniciar
-- otra venta rápida en el terminal. (Preparar el cobro crea, además del checkout, una «venta fiscal» ABIERTA que es solo la foto del
-- importe: sin bloquear, sin documento. En QA hay 63 de esas fotos abiertas.)
--
-- Corrección: un cobro deja de impedir el cierre cuando NO movió dinero ni lo tiene en juego. Ya no bloquea si
--   * el checkout no está COMPLETADO,
--   * todos sus pagos están RECHAZADO o CANCELADO (o no tiene pagos),
--   * ninguno de sus intentos tiene una incidencia de cobro ABIERTA, y
--   * su venta fiscal sigue ABIERTA y sin bloquear (locked_at nulo) y enlazada a un checkout de la cuenta: es solo la foto.
-- En ese caso la cancelación del pedido, además de cerrar la cuenta, CANCELA los checkouts que seguían ABIERTO o EN_COBRO
-- (CANCELADO, cancelled_at, versión +1) y la foto (venta fiscal CANCELADA, versión +1). Si algún pago está PENDIENTE, AUTORIZADO,
-- CONFIRMADO, DESCONOCIDO o REEMBOLSADO, hay una incidencia abierta, o la venta fiscal está BLOQUEADA, CERRADA o sin enlazar a un
-- checkout, la cuenta se deja como estaba: cerrar de más sería peor que no cerrar.
--
-- No repara las cuentas que ya quedaron atascadas: esa limpieza de datos es de cada entorno (acta de QA, §11), no de una migración
-- que también se aplicaría en producción.
--
-- Cómo se aplica: se parchea la definición VIVA de public.abc_cancelar_pedido ya parcheada por H-21 (sin arrastrar deriva), es
-- idempotente y falla en voz alta si la forma esperada no está.
--
-- Contrato: tests/rediseno/h49-cancelar-pedido-cancela-cobro-sin-dinero-pglite-contract.mjs

do $migracion$
declare
  v_oid oid;
  v_def text;
  v_nuevo text;
  v_n integer;

  v_marca constant text := 'H-49: el cobro que no movio dinero';

  -- El bloque «sin checkout alguno» que dejó H-21.
  v_patron_checkout constant text :=
    'and\s+not\s+exists\(\s*select\s+1\s+from\s+public\.checkouts\s+k\s+where\s+k\.empresa_id=p_empresa_id\s+and\s+k\.local_id=p_local_id\s+and\s+k\.cuenta_id=v_pedido\.cuenta_id\s*\)';
  v_reemplazo_checkout constant text :=
    'and not exists(' || chr(10)
    || '       -- ' || v_marca || ' (sin pagos o solo RECHAZADO/CANCELADO, sin incidencia abierta) no impide cerrar la cuenta.' || chr(10)
    || '       select 1 from public.checkouts k' || chr(10)
    || '        where k.empresa_id=p_empresa_id and k.local_id=p_local_id' || chr(10)
    || '          and k.cuenta_id=v_pedido.cuenta_id' || chr(10)
    || '          and (k.estado=''COMPLETADO''' || chr(10)
    || '               or exists(' || chr(10)
    || '                 select 1 from public.pagos g' || chr(10)
    || '                  where g.empresa_id=k.empresa_id and g.local_id=k.local_id' || chr(10)
    || '                    and g.checkout_id=k.id and g.estado not in (''RECHAZADO'',''CANCELADO''))' || chr(10)
    || '               or exists(' || chr(10)
    || '                 select 1 from public.pagos g' || chr(10)
    || '                   join public.pago_intentos pi on pi.empresa_id=g.empresa_id' || chr(10)
    || '                    and pi.local_id=g.local_id and pi.pago_id=g.id' || chr(10)
    || '                   join public.abc_cobro_incidencias i on i.empresa_id=pi.empresa_id' || chr(10)
    || '                    and i.local_id=pi.local_id and i.intento_id=pi.id' || chr(10)
    || '                  where g.empresa_id=k.empresa_id and g.local_id=k.local_id' || chr(10)
    || '                    and g.checkout_id=k.id and i.estado=''ABIERTA'')))';

  -- El bloque «sin venta fiscal distinta de CANCELADA» que dejó H-21.
  v_patron_venta constant text :=
    'and\s+not\s+exists\(\s*select\s+1\s+from\s+public\.ventas_fiscales\s+v\s+where\s+v\.empresa_id=p_empresa_id\s+and\s+v\.local_id=p_local_id\s+and\s+v\.cuenta_id=v_pedido\.cuenta_id\s+and\s+v\.estado<>''CANCELADA''\s*\)';
  v_reemplazo_venta constant text :=
    'and not exists(' || chr(10)
    || '       select 1 from public.ventas_fiscales v' || chr(10)
    || '        where v.empresa_id=p_empresa_id and v.local_id=p_local_id' || chr(10)
    || '          and v.cuenta_id=v_pedido.cuenta_id and v.estado<>''CANCELADA''' || chr(10)
    || '          -- ' || v_marca || ': su venta ABIERTA y sin bloquear, enlazada a un checkout, es solo la foto del cobro.' || chr(10)
    || '          and not (v.estado=''ABIERTA'' and v.locked_at is null' || chr(10)
    || '                   and exists(' || chr(10)
    || '                     select 1 from public.checkout_ventas cv' || chr(10)
    || '                      where cv.empresa_id=v.empresa_id and cv.local_id=v.local_id' || chr(10)
    || '                        and cv.venta_fiscal_id=v.id)))';

  -- Justo después de cerrar la cuenta (variable creada por H-21).
  v_patron_cierre constant text := 'v_cuenta_cerrada:=found;';
  v_reemplazo_cierre constant text :=
    'v_cuenta_cerrada:=found;' || chr(10)
    || '    if v_cuenta_cerrada then' || chr(10)
    || '      -- ' || v_marca || ' se cancela junto con la cuenta (y la foto fiscal sin documento).' || chr(10)
    || '      update public.checkouts' || chr(10)
    || '         set estado=''CANCELADO'',cancelled_at=now(),version=version+1' || chr(10)
    || '       where empresa_id=p_empresa_id and local_id=p_local_id' || chr(10)
    || '         and cuenta_id=v_pedido.cuenta_id and estado in (''ABIERTO'',''EN_COBRO'');' || chr(10)
    || '      update public.ventas_fiscales' || chr(10)
    || '         set estado=''CANCELADA'',version=version+1' || chr(10)
    || '       where empresa_id=p_empresa_id and local_id=p_local_id' || chr(10)
    || '         and cuenta_id=v_pedido.cuenta_id and estado=''ABIERTA'' and locked_at is null;' || chr(10)
    || '    end if;';
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'abc_cancelar_pedido' and p.prokind = 'f';
  if v_oid is null then
    raise exception 'FUNCION_OBLIGATORIA_NO_ENCONTRADA: public.abc_cancelar_pedido';
  end if;
  v_def := pg_get_functiondef(v_oid);

  -- Ya aplicada: no se vuelve a tocar.
  if position(v_marca in v_def) > 0 then
    raise notice 'cancelar pedido cancela cobro sin dinero: ya aplicada';
    return;
  end if;

  -- Depende de H-21 (cierre de la cuenta sin pedidos).
  if position('CUENTA_CERRADA_SIN_PEDIDOS' in v_def) = 0 then
    raise exception 'DEPENDENCIA_OBLIGATORIA_NO_ENCONTRADA: % no tiene el cierre de cuenta de H-21 (20261127100000)', v_oid::regprocedure;
  end if;

  foreach v_nuevo in array array[v_patron_checkout, v_patron_venta, v_patron_cierre] loop
    select count(*) into v_n from regexp_matches(v_def, v_nuevo, 'g');
    if v_n <> 1 then
      raise exception 'ESTRUCTURA_NO_ENCONTRADA: % no tiene exactamente una coincidencia de «%»', v_oid::regprocedure, v_nuevo;
    end if;
  end loop;

  v_nuevo := regexp_replace(v_def, v_patron_checkout, v_reemplazo_checkout, 'g');
  v_nuevo := regexp_replace(v_nuevo, v_patron_venta, v_reemplazo_venta, 'g');
  v_nuevo := regexp_replace(v_nuevo, v_patron_cierre, v_reemplazo_cierre, 'g');
  execute v_nuevo;

  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'abc_cancelar_pedido' and p.prokind = 'f';
  if (length(pg_get_functiondef(v_oid)) - length(replace(pg_get_functiondef(v_oid), v_marca, ''))) / length(v_marca) <> 3 then
    raise exception 'POSTCONDICION_FALLIDA: abc_cancelar_pedido no quedó con el parche de H-49';
  end if;
  raise notice 'cancelar pedido cancela cobro sin dinero: aplicada';
end
$migracion$;
