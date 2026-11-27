-- Hallazgo H-48 (verificación en el navegador de QA, 27/11/2026).
-- «Cerrar cuenta pagada» (public.abc_cerrar_cuenta_pagada) se negaba a cerrar una cuenta totalmente
-- cobrada si el checkout conservaba algún pago que no fuera CONFIRMADO o REEMBOLSADO. Un intento de
-- tarjeta RECHAZADO (o un pago CANCELADO) que el cajero repitió con otro cobro dejaba esa fila en el
-- checkout para siempre y la cuenta no se podía cerrar: error `cuenta_pago_no_resuelto`
-- («El servidor todavía tiene un pago o reserva sin resolver»). Además la cuenta abierta bloquea iniciar
-- otra venta rápida en el terminal, y su venta cobrada queda sin documento.
--
-- Un pago RECHAZADO o CANCELADO no movió dinero: no es un pago «sin resolver». Corrección: esos dos
-- estados dejan de contar. Siguen contando PENDIENTE, AUTORIZADO, DESCONOCIDO y cualquier otro estado
-- vivo (y la comprobación del saldo, de las reservas y de las incidencias abiertas no cambia).
--
-- Cómo se aplica: se parchea la definición VIVA de public.abc_cerrar_cuenta_pagada (sin arrastrar
-- deriva entre el repositorio y lo desplegado), es idempotente y falla en voz alta si la forma
-- esperada no está. No se toca private.abc_actualizar_pago_reembolso_estado: ese predicado es de
-- reembolsos y su significado es otro.
--
-- Contrato: tests/rediseno/h48-cerrar-cuenta-ignora-pagos-rechazados-pglite-contract.mjs

do $migracion$
declare
  v_oid oid;
  v_def text;
  v_nuevo text;
  v_n integer;

  v_patron_viejo constant text :=
    'p\.estado\s+not\s+in\s*\(\s*''CONFIRMADO''\s*,\s*''REEMBOLSADO''\s*\)';
  v_reemplazo constant text :=
    'p.estado not in (''CONFIRMADO'',''REEMBOLSADO'',''RECHAZADO'',''CANCELADO'')';
  v_patron_nuevo constant text :=
    'p\.estado\s+not\s+in\s*\(\s*''CONFIRMADO''\s*,\s*''REEMBOLSADO''\s*,\s*''RECHAZADO''\s*,\s*''CANCELADO''\s*\)';
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'abc_cerrar_cuenta_pagada' and p.prokind = 'f';
  if v_oid is null then
    raise exception 'FUNCION_OBLIGATORIA_NO_ENCONTRADA: public.abc_cerrar_cuenta_pagada';
  end if;
  v_def := pg_get_functiondef(v_oid);

  -- Ya aplicada: no se vuelve a tocar.
  select count(*) into v_n from regexp_matches(v_def, v_patron_nuevo, 'g');
  if v_n = 1 then
    raise notice 'cerrar cuenta ignora pagos rechazados: ya aplicada';
    return;
  end if;

  select count(*) into v_n from regexp_matches(v_def, v_patron_viejo, 'g');
  if v_n <> 1 then
    raise exception 'ESTRUCTURA_NO_ENCONTRADA: % no tiene exactamente una coincidencia de «%»', v_oid::regprocedure, v_patron_viejo;
  end if;

  v_nuevo := regexp_replace(v_def, v_patron_viejo, v_reemplazo, 'g');
  execute v_nuevo;
  raise notice 'cerrar cuenta ignora pagos rechazados: aplicada';
end
$migracion$;
