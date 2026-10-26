-- ABC P3c: guardar la lista de productos con contexto empresa/local explícito.
--
-- La RPC histórica abc_productos_guardar_lista(text,jsonb,jsonb,jsonb) deduce
-- la empresa desde la única fila `productos` que ve el llamante. Eso es
-- deliberadamente fail-closed para una cuenta con dos empresas activas, pero
-- impide guardar el producto del contexto seleccionado en una sesión A/B.
--
-- Esta migración conserva la RPC de cuatro parámetros para instalaciones
-- antiguas y añade una sobrecarga de seis parámetros. La sobrecarga valida el
-- contexto y deja un GUC transaccional para que el cuerpo P3c existente pueda
-- reutilizarse sin duplicar su lógica de fusión, conflictos y catálogo.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb)') is null then
    raise exception 'ABC_P3C_CONTEXTO_PREFLIGHT:falta_rpc_lista_legacy';
  end if;
  if to_regprocedure('private.plataforma_kv_empresa_llamante(text)') is null then
    raise exception 'ABC_P3C_CONTEXTO_PREFLIGHT:falta_resolutor_empresa';
  end if;
  if to_regprocedure('private.plataforma_kv_permitido(text,text,text,text)') is null then
    raise exception 'ABC_P3C_CONTEXTO_PREFLIGHT:falta_autorizador_kv';
  end if;
end
$preflight$;

-- El contexto solo puede ser fijado por la sobrecarga pública validada más
-- abajo. La RPC legacy sigue resolviendo por membresía y continúa fallando
-- cerrado cuando no hay un contexto explícito y hay varias empresas activas.
create or replace function private.plataforma_kv_empresa_llamante(p_key text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_n integer;
  v_empresa text;
  v_contexto text := nullif(btrim(current_setting('la.productos_empresa_contexto', true)), '');
begin
  if p_key = 'productos' and v_contexto is not null then
    if not private.la_tiene_empresa(v_contexto)
       or not exists (
         select 1 from public.almacen_kv k
          where k.key = p_key and k.empresa_id = v_contexto
       ) then
      raise exception 'almacen_kv_empresa_contexto_no_autorizado' using errcode = '42501';
    end if;
    return v_contexto;
  end if;

  select count(*), min(k.empresa_id)
    into v_n, v_empresa
    from public.almacen_kv k
   where k.key = p_key
     and exists (
       select 1 from public.membresias_usuario m
        where m.user_id = auth.uid()
          and m.empresa_id = k.empresa_id
          and m.activo = true
     );
  if v_n = 0 then return null; end if;
  if v_n > 1 then
    raise exception 'almacen_kv_empresa_ambigua' using errcode = '42501';
  end if;
  return v_empresa;
end
$function$;

-- Ruta contextual para la sesión A/B. El cuerpo P3c legacy hace la fusión y
-- las comprobaciones de producto; esta envoltura solo fija el contexto
-- autorizado durante esta transacción.
create or replace function public.abc_productos_guardar_lista(
  p_operation_id text,
  p_base jsonb,
  p_nuevo jsonb,
  p_venta jsonb,
  p_empresa_id text,
  p_local_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_empresa text := nullif(btrim(p_empresa_id), '');
  v_local text := nullif(btrim(p_local_id), '');
begin
  if auth.uid() is null then
    raise exception 'abc_productos_no_autorizado' using errcode = '42501';
  end if;
  if v_empresa is null or v_local is null then
    raise exception 'abc_productos_contexto_requerido' using errcode = '42501';
  end if;
  if not private.plataforma_kv_permitido(v_empresa, v_local, 'productos', 'escribir') then
    raise exception 'abc_productos_no_autorizado' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.almacen_kv k
     where k.key = 'productos' and k.empresa_id = v_empresa
  ) then
    raise exception 'abc_productos_lista_nube_ausente';
  end if;

  perform set_config('la.productos_empresa_contexto', v_empresa, true);
  return public.abc_productos_guardar_lista(p_operation_id, p_base, p_nuevo, p_venta);
end
$function$;

revoke all on function public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb,text,text)
  from public, anon, authenticated;
grant execute on function public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb,text,text)
  to authenticated;

do $postflight$
begin
  if to_regprocedure('public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb,text,text)') is null then
    raise exception 'ABC_P3C_CONTEXTO_POSTFLIGHT:falta_rpc_contextual';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb,text,text)',
    'EXECUTE'
  ) then
    raise exception 'ABC_P3C_CONTEXTO_POSTFLIGHT:sin_execute_authenticated';
  end if;
  if position('la.productos_empresa_contexto' in pg_get_functiondef(
    'private.plataforma_kv_empresa_llamante(text)'::regprocedure
  )) = 0 then
    raise exception 'ABC_P3C_CONTEXTO_POSTFLIGHT:resolutor_sin_contexto';
  end if;
end
$postflight$;

commit;
