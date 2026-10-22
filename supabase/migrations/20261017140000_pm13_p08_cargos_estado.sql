-- PM13-P08 — estado de cargos y protección de asignaciones.
-- Solo prepara el contrato servidor para QA; no se aplica automáticamente.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.abc_cargos') is null then v_missing := array_append(v_missing, 'abc_cargos'); end if;
  if to_regclass('public.abc_cargo_asignaciones') is null then v_missing := array_append(v_missing, 'abc_cargo_asignaciones'); end if;
  if to_regprocedure('private.abc_config_puede_configurar_empresa(text,text)') is null then v_missing := array_append(v_missing, 'abc_config_puede_configurar_empresa'); end if;
  if to_regprocedure('private.pm13_cargo_auditar(text,text,text,jsonb)') is null then v_missing := array_append(v_missing, 'pm13_cargo_auditar'); end if;
  if cardinality(v_missing) > 0 then
    raise exception 'PM13_P08_ESTADO_PREFLIGHT_FALLO:%', array_to_string(v_missing, ',');
  end if;
end $preflight$;

create or replace function public.abc_desactivar_cargo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cargo_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cargo public.abc_cargos%rowtype;
  v_asignados bigint;
begin
  if auth.uid() is null or not coalesce(private.abc_config_puede_configurar_empresa(p_empresa_id, p_local_id), false) then
    raise exception 'cargo_empresa_no_autorizada';
  end if;
  select * into v_cargo from public.abc_cargos where id = p_cargo_id and empresa_id = p_empresa_id for update;
  if not found then raise exception 'cargo_no_encontrado'; end if;
  if not v_cargo.activo then return jsonb_build_object('ok', true, 'ya_inactivo', true, 'cargo', to_jsonb(v_cargo)); end if;
  select count(*) into v_asignados
    from public.abc_cargo_asignaciones a
   where a.empresa_id = p_empresa_id and a.cargo_id = p_cargo_id and a.activo = true;
  if v_asignados > 0 then raise exception 'cargo_tiene_asignaciones:%', v_asignados; end if;
  update public.abc_cargos
     set activo = false, updated_by = auth.uid(), updated_at = now()
   where id = p_cargo_id
  returning * into v_cargo;
  perform private.pm13_cargo_auditar('CARGO_DESACTIVADO', p_empresa_id, p_local_id, jsonb_build_object('cargoId', p_cargo_id, 'operationId', p_operation_id));
  return jsonb_build_object('ok', true, 'cargo', to_jsonb(v_cargo));
end
$$;

create or replace function public.abc_reactivar_cargo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cargo_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cargo public.abc_cargos%rowtype;
begin
  if auth.uid() is null or not coalesce(private.abc_config_puede_configurar_empresa(p_empresa_id, p_local_id), false) then
    raise exception 'cargo_empresa_no_autorizada';
  end if;
  select * into v_cargo from public.abc_cargos where id = p_cargo_id and empresa_id = p_empresa_id for update;
  if not found then raise exception 'cargo_no_encontrado'; end if;
  update public.abc_cargos
     set activo = true, updated_by = auth.uid(), updated_at = now()
   where id = p_cargo_id
  returning * into v_cargo;
  perform private.pm13_cargo_auditar('CARGO_REACTIVADO', p_empresa_id, p_local_id, jsonb_build_object('cargoId', p_cargo_id, 'operationId', p_operation_id));
  return jsonb_build_object('ok', true, 'cargo', to_jsonb(v_cargo));
end
$$;

revoke all on function public.abc_desactivar_cargo(text, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.abc_reactivar_cargo(text, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.abc_desactivar_cargo(text, text, text, uuid) to authenticated;
grant execute on function public.abc_reactivar_cargo(text, text, text, uuid) to authenticated;

comment on function public.abc_desactivar_cargo(text, text, text, uuid) is 'Desactiva un cargo solo si no tiene asignaciones activas en la empresa; nunca borra historial.';

commit;
