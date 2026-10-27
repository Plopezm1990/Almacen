-- C07-C complemento: lectura controlada de los metadatos de representación.
-- No devuelve documentos ni secretos y no habilita emisión.
begin;

create function public.abc_fiscal_leer_representacion(p_empresa_id text, p_local_id text, p_entidad_fiscal_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r private.abc_fiscal_representaciones%rowtype;
begin
  if not private.abc_fiscal_delegacion_puede(p_empresa_id,p_local_id,p_entidad_fiscal_id,'CONSULTAR') then
    raise exception 'FISCAL_DELEGACION_NO_AUTORIZADO' using errcode='42501';
  end if;
  select * into r from private.abc_fiscal_representaciones
    where empresa_id=p_empresa_id and entidad_fiscal_id=p_entidad_fiscal_id;
  return jsonb_build_object(
    'empresa_id',p_empresa_id,'entidad_fiscal_id',p_entidad_fiscal_id,
    'tipo',coalesce(r.tipo,'PENDIENTE'),'estado',coalesce(r.estado,'PENDIENTE'),
    'referencia_opaca',r.referencia_opaca,'evidencia_sha256',r.evidencia_sha256,
    'vigente_desde',r.vigente_desde,'vigente_hasta',r.vigente_hasta,
    'emision_habilitada',false
  );
end $$;

revoke all on function public.abc_fiscal_leer_representacion(text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.abc_fiscal_leer_representacion(text,text,uuid) to authenticated;

commit;
