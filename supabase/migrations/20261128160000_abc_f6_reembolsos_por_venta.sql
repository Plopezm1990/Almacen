-- H-35 (auditoría del TPV): el historial de ventas no reflejaba los reembolsos económicos (B08).
--
-- La pantalla necesita saber, por venta fiscal, cuánto dinero se ha devuelto de verdad. Las aplicaciones de reembolso (`reembolso_aplicaciones`) no son legibles
-- directamente por el navegador (la migración de paridad de permisos le quitó el acceso, como a `pago_intentos`), así que se expone una función de servidor
-- de solo lectura, como el resto del estado del cobro.
--
-- Función: public.abc_reembolsos_por_venta(p_empresa_id, p_local_id) → { ok: true, ventas: { "<venta_fiscal_id>": <importe devuelto> } }
--   * suma `importe_venta` de las aplicaciones de reembolsos CONFIRMADOS (no cuenta cancelados ni solicitados, ni aplicaciones sin venta o con importe 0);
--   * solo para quien pertenece al local (private.la_tiene_local); SECURITY DEFINER con search_path vacío; solo `authenticated`.
--
-- No modifica datos. Contrato: tests/rediseno/h35-reembolsos-por-venta-pglite-contract.mjs

create or replace function public.abc_reembolsos_por_venta(
  p_empresa_id text,
  p_local_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.la_tiene_local(p_empresa_id, p_local_id) then
    raise exception 'reembolsos_lectura_no_autorizada';
  end if;

  return jsonb_build_object(
    'ok', true,
    'ventas', coalesce((
      select jsonb_object_agg(x.venta_fiscal_id::text, x.importe)
        from (
          select ra.venta_fiscal_id, round(sum(ra.importe_venta), 2) as importe
            from public.reembolso_aplicaciones ra
            join public.reembolsos r
              on r.empresa_id = ra.empresa_id and r.local_id = ra.local_id and r.id = ra.reembolso_id
           where ra.empresa_id = p_empresa_id and ra.local_id = p_local_id
             and r.estado = 'CONFIRMADO'
             and ra.venta_fiscal_id is not null
             and ra.importe_venta > 0
           group by ra.venta_fiscal_id
        ) x
    ), '{}'::jsonb)
  );
end $$;

revoke all on function public.abc_reembolsos_por_venta(text, text) from public, anon, authenticated;
grant execute on function public.abc_reembolsos_por_venta(text, text) to authenticated;
