CREATE OR REPLACE FUNCTION public.abc_consultar_vale_regalo(p_empresa_id text, p_local_id text, p_codigo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_vale public.abc_vales_regalo%rowtype;
  v_codigo text := upper(btrim(coalesce(p_codigo,'')));
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR') then
    raise exception 'abc_vale_regalo_no_autorizado';
  end if;
  if v_codigo = '' then raise exception 'vale_regalo_codigo_requerido'; end if;

  select * into v_vale from public.abc_vales_regalo v
   where v.empresa_id=p_empresa_id and v.local_id=p_local_id and v.codigo=v_codigo;
  if not found then raise exception 'vale_regalo_no_encontrado'; end if;

  return jsonb_build_object(
    'ok',true,'vale_id',v_vale.id,'codigo',v_vale.codigo,'estado',v_vale.estado,
    'saldo',v_vale.saldo_actual,'importe_inicial',v_vale.importe_inicial
  );
end $function$;
