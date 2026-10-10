CREATE OR REPLACE FUNCTION public.completar_local_movimiento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_local_id text;
  v_empresa text;
begin
  if coalesce(new.datos->>'localId','') <> '' then
    return new;
  end if;

  -- F4e: solo se consulta la lista de productos de la empresa del movimiento.
  v_empresa := coalesce(
    nullif(btrim(coalesce(new.empresa_id,'')),''),
    nullif(btrim(coalesce(new.datos->>'empresaId','')),''),
    case when auth.uid() is null then null else private.plataforma_empresa_del_llamante() end
  );
  if v_empresa is null then
    return new;
  end if;

  select elem->>'localId'
    into v_local_id
  from public.almacen_kv k,
       lateral jsonb_array_elements(coalesce(k.value,'[]'::jsonb)) elem
  where k.key='productos'
    and k.empresa_id = v_empresa
    and elem->>'id' = new.datos->>'productoId'
    and coalesce(elem->>'localId','') <> ''
  limit 1;

  if v_local_id is not null then
    new.datos := jsonb_set(new.datos, '{localId}', to_jsonb(v_local_id), true);
  end if;
  return new;
end;
$function$
