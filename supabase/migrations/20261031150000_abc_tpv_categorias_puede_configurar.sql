-- ABC · TPV: la lectura de categorías dice además si quien pregunta puede
-- configurarlas, para que la pantalla pueda esconder el botón en vez de
-- dejar que el usuario llegue hasta el error.
--
-- Lo decide el servidor con private.abc_tiene_capacidad, no la pantalla: la
-- capacidad ABC_SALA_CONFIGURAR es ajustable por empresa y local desde el
-- catálogo de capacidades por rol, así que una lista de roles escrita en el
-- navegador se quedaría desfasada en cuanto alguien la ajustara.
--
-- Esto no relaja nada: la escritura sigue comprobando la capacidad por su
-- cuenta. Esconder el botón es comodidad, no seguridad.

do $$
begin
  if to_regprocedure('public.abc_listar_categorias_tpv(text,text)') is null then
    raise exception 'abc_tpv_categorias_dependencia_ausente: abc_listar_categorias_tpv';
  end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then
    raise exception 'abc_tpv_categorias_dependencia_ausente: abc_tiene_capacidad';
  end if;
end $$;

create or replace function public.abc_listar_categorias_tpv(
  p_empresa_id text,
  p_local_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_fila public.tpv_categorias_presentacion%rowtype;
  v_puede_configurar boolean;
begin
  if auth.uid() is null or not private.la_tiene_local(p_empresa_id, p_local_id) then
    raise exception 'abc_tpv_categorias_no_autorizada';
  end if;

  v_puede_configurar := private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_SALA_CONFIGURAR');

  select * into v_fila
    from public.tpv_categorias_presentacion
   where empresa_id = p_empresa_id and local_id = p_local_id;

  if not found then
    -- Sin configurar todavía: el TPV se queda con su orden y color por defecto.
    return jsonb_build_object(
      'ok', true,
      'version', 0,
      'categorias', '[]'::jsonb,
      'puede_configurar', v_puede_configurar
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'version', v_fila.version,
    'categorias', v_fila.categorias,
    'puede_configurar', v_puede_configurar,
    'actualizado_en', v_fila.actualizado_en,
    'actualizado_por', v_fila.actualizado_por
  );
end $$;

revoke all on function public.abc_listar_categorias_tpv(text,text) from public, anon, authenticated, service_role;
grant execute on function public.abc_listar_categorias_tpv(text,text) to authenticated;
