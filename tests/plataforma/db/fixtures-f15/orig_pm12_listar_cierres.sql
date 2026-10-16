CREATE OR REPLACE FUNCTION public.pm12_listar_cierres(p_empresa_id text, p_local_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
begin
 if auth.uid() is null or not coalesce(private.la_usuario_activo(),false) or not coalesce(private.la_tiene_empresa(p_empresa_id),false) or not coalesce(private.la_tiene_local(p_empresa_id,p_local_id),false) then raise exception 'contexto_no_autorizado'; end if;
 return coalesce((select jsonb_agg(conteo order by cerrado_en desc) from public.pm12_conteo_cierres where empresa_id=p_empresa_id and local_id=p_local_id),'[]'::jsonb);
end;$function$;
