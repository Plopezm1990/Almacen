-- Hallazgo H-38 de la auditoría del TPV (26/11/2026), parte b: lectura para el botón
-- «Emitir documento pendiente» de la pantalla de cierre.
--
-- La migración 20261126140000 hace que el cierre bloquee con VENTAS_SIN_DOCUMENTO, pero
-- el bloqueo solo dice que hay ventas cobradas sin documento: no dice cuáles. Esta función
-- de solo lectura devuelve exactamente las ventas que producen ese bloqueo (mismo local,
-- cobradas dentro de la ventana de la sesión, con importe y sin documento EMITIDO) con lo
-- que hace falta para emitir cada una: checkout, cuenta, venta fiscal e importe. La
-- emisión la hace el cliente por `abc_c07d_emitir_checkout`, que ya acepta a quien puede
-- iniciar cobros (20261126120000 y 20261126130000) y es idempotente por checkout.
--
-- Quién puede leerla: quien opera la caja (ABC_CAJA_OPERAR, es quien ve el cierre) o inicia
-- cobros (ABC_COBRO_INICIAR, es quien emite). No escribe nada.
--
-- Mantener el criterio igual que el bloqueo de private.abc_c04_bloqueos_cierre. El contrato
-- comprueba que ambos coinciden: tests/rediseno/c04-bloqueo-ventas-sin-documento-pglite-contract.mjs

create or replace function public.abc_c04_listar_ventas_sin_documento(
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null
     or not (private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_CAJA_OPERAR')
             or private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_COBRO_INICIAR')) then
    raise exception 'ventas_sin_documento_no_autorizado';
  end if;

  return coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'checkout_id', c.id,
               'cuenta_id', c.cuenta_id,
               'venta_fiscal_id', cv.venta_fiscal_id,
               'importe', cv.importe_objetivo,
               'completed_at', c.completed_at
             )
             order by c.completed_at, c.id
           )
      from public.caja_sesiones s
      join public.checkouts c
        on c.empresa_id = s.empresa_id and c.local_id = s.local_id
      join public.checkout_ventas cv on cv.checkout_id = c.id
     where s.empresa_id = p_empresa_id
       and s.local_id = p_local_id
       and s.id = p_session_id
       and c.estado = 'COMPLETADO'
       and cv.importe_objetivo > 0
       and c.completed_at >= s.abierta_at
       and (s.cerrada_at is null or c.completed_at <= s.cerrada_at)
       and not exists (
         select 1 from public.abc_c05_documentos_emitidos d
          where d.empresa_id = c.empresa_id
            and d.local_id = c.local_id
            and d.documento_origen_id = cv.venta_fiscal_id::text
            and d.estado = 'EMITIDO'
       )
  ), '[]'::jsonb);
end
$function$;

revoke all on function public.abc_c04_listar_ventas_sin_documento(text, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.abc_c04_listar_ventas_sin_documento(text, text, uuid) to authenticated;
