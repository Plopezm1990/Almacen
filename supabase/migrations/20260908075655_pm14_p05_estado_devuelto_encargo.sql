-- PM14 P05: un encargo entregado puede devolverse. "Devuelto" pasa a ser un estado
-- valido del espejo autoritativo, y -- igual que "Cancelado" -- deja de admitir nuevos
-- cobros contra el (private.pm14_total_encargo ya devolvia null para Cancelado; ahora
-- tambien para Devuelto). No se crea ninguna tabla ni RPC nueva: se reutiliza
-- integramente pagos_encargo/registrar_pago_encargo/revertir_pago_encargo (P02) para
-- reembolsar lo ya cobrado.

create or replace function private.pm14_total_encargo(p_empresa text, p_local text, p_encargo_id text)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public', 'auth', 'private', 'pg_temp'
as $function$
declare
  d jsonb;
  total numeric;
begin
  select datos into d from public.encargos_empresa
   where id = p_encargo_id and empresa_id = p_empresa and local_id = p_local;
  if d is null or coalesce(d->>'estado','Pendiente') in ('Cancelado', 'Devuelto') then return null; end if;
  total := coalesce(nullif(d->>'total','')::numeric, 0);
  return round(total, 2);
end;
$function$;

create or replace function public.registrar_encargo(
  p_id text,
  p_empresa_id text,
  p_local_id text,
  p_cliente_id text,
  p_total numeric,
  p_estado text default 'Pendiente',
  p_datos jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'private', 'pg_temp'
as $function$
declare
  v_total numeric;
  v_estado text;
  v_datos jsonb;
  v_nuevo public.encargos_empresa%rowtype;
begin
  if auth.uid() is null or not private.pm08_puede_operar_caja() then
    raise exception 'encargo_no_autorizado';
  end if;
  if p_id is null or btrim(p_id) = '' then raise exception 'encargo_id_requerido'; end if;
  if not private.la_tiene_empresa(p_empresa_id) or not private.la_tiene_local(p_empresa_id, p_local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if not private.pm08_local_operable(p_empresa_id, p_local_id) then raise exception 'local_inactivo'; end if;

  v_total := private.pm08_validar_dinero(p_total, true, false);
  v_estado := coalesce(nullif(btrim(p_estado), ''), 'Pendiente');
  if v_estado not in ('Pendiente', 'Entregado', 'Cancelado', 'Devuelto') then raise exception 'estado_encargo_invalido'; end if;
  v_datos := coalesce(p_datos, '{}'::jsonb) || jsonb_build_object('total', v_total, 'estado', v_estado, 'clienteId', p_cliente_id);

  insert into public.encargos_empresa (id, empresa_id, local_id, cliente_id, datos, updated_at)
  values (p_id, p_empresa_id, p_local_id, p_cliente_id, v_datos, now())
  on conflict (id) do update
    set datos = excluded.datos,
        cliente_id = excluded.cliente_id,
        updated_at = now()
    where public.encargos_empresa.empresa_id = excluded.empresa_id
      and public.encargos_empresa.local_id = excluded.local_id
  returning * into v_nuevo;

  if v_nuevo.id is null then raise exception 'encargo_referencia_otro_contexto'; end if;
  return jsonb_build_object('ok', true, 'encargo', to_jsonb(v_nuevo));
end;
$function$;
