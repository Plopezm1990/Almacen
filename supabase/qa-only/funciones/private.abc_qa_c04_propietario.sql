CREATE OR REPLACE FUNCTION private.abc_qa_c04_propietario(p_empresa_id text, p_local_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select auth.uid() is not null
     and p_empresa_id='QA-EMP-A'
     and p_local_id='QA-A1'
     and exists (
       select 1
         from public.locales l
        where l.empresa_id=p_empresa_id
          and l.id=p_local_id
          and l.activo=true
     )
     and exists (
       select 1
         from public.membresias_usuario m
        where m.user_id=auth.uid()
          and m.empresa_id=p_empresa_id
          and m.activo=true
          and m.rol='Propietario'
          and ((m.todos_locales=true and m.local_id is null) or (m.todos_locales=false and m.local_id=p_local_id))
     );
$function$;
