\set ON_ERROR_STOP on
\ir ../m04a/fixture-m04a.sql

-- Compatibilidad mínima PM08 necesaria para probar el endurecimiento legacy M04B.
create table public.arqueos_caja (
  operation_id text primary key,
  empresa_id text not null,
  local_id text not null,
  fecha date not null,
  estado text not null default 'ACTIVO'
);

create or replace function private.pm08_puede_corregir_caja()
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
      from public.membresias_usuario m
     where m.user_id=auth.uid()
       and m.activo=true
       and m.rol in ('Propietario','Encargado')
  )
$$;

create or replace function private.pm08_validar_operation_id(p_operation_id text)
returns text
language plpgsql
immutable
set search_path=''
as $$
declare
  v text:=btrim(coalesce(p_operation_id,''));
begin
  if v !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$' then
    raise exception 'operation_id_invalido';
  end if;
  return v;
end $$;

create or replace function private.pm08_bloquear_operation_id(p_operation_id text)
returns void
language plpgsql
volatile
set search_path=''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('la-suite-pm08:'||p_operation_id,0)
  );
end $$;

create or replace function private.pm08_local_operable(
  p_empresa_id text,
  p_local_id text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select true
$$;

create or replace function public.revertir_movimiento_caja(
  p_operation_id text,
  p_movimiento_operation_id text,
  p_motivo text,
  p_fecha date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_operation_id text;
  v_motivo text;
  v_fecha date;
  v_payload jsonb;
  v_existente public.caja_operaciones%rowtype;
  v_original public.caja_operaciones%rowtype;
  v_nuevo public.caja_operaciones%rowtype;
begin
  if auth.uid() is null or not private.pm08_puede_corregir_caja() then
    raise exception 'reverso_caja_no_autorizado';
  end if;

  v_operation_id:=private.pm08_validar_operation_id(p_operation_id);
  v_motivo:=left(btrim(coalesce(p_motivo,'')),500);
  if v_motivo='' then raise exception 'motivo_requerido'; end if;
  v_fecha:=coalesce(p_fecha,current_date);
  v_payload:=jsonb_build_object(
    'movimientoOperationId',p_movimiento_operation_id,
    'motivo',v_motivo,
    'fecha',v_fecha
  );

  perform private.pm08_bloquear_operation_id(v_operation_id);

  select * into v_existente
    from public.caja_operaciones
   where operation_id=v_operation_id;
  if found then
    if not private.la_tiene_local(v_existente.empresa_id,v_existente.local_id) then
      raise exception 'contexto_no_autorizado';
    end if;
    if v_existente.tipo in ('REVERSO_ENTRADA','REVERSO_RETIRADA')
       and v_existente.payload=v_payload then
      return jsonb_build_object('ok',true,'replayed',true,'movimiento',to_jsonb(v_existente));
    end if;
    raise exception 'operation_id_conflict';
  end if;

  select * into v_original
    from public.caja_operaciones
   where operation_id=p_movimiento_operation_id
     and tipo in ('ENTRADA','RETIRADA')
   for update;
  if not found then raise exception 'movimiento_caja_no_encontrado'; end if;

  if not private.la_tiene_local(v_original.empresa_id,v_original.local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if not private.pm08_local_operable(v_original.empresa_id,v_original.local_id) then
    raise exception 'local_inactivo';
  end if;
  if exists(
    select 1 from public.arqueos_caja
     where empresa_id=v_original.empresa_id
       and local_id=v_original.local_id
       and fecha=v_fecha
       and estado='ACTIVO'
  ) then
    raise exception 'periodo_caja_cerrado';
  end if;
  if exists(
    select 1 from public.caja_operaciones
     where ref_operation_id=v_original.operation_id
       and tipo in ('REVERSO_ENTRADA','REVERSO_RETIRADA')
  ) then
    raise exception 'movimiento_caja_ya_revertido';
  end if;

  insert into public.caja_operaciones(
    operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
    medio_pago,concepto,origen_tipo,origen_id,ref_operation_id,payload,
    actor_user_id
  ) values (
    v_operation_id,
    case when v_original.tipo='ENTRADA' then 'REVERSO_ENTRADA' else 'REVERSO_RETIRADA' end,
    v_original.empresa_id,v_original.local_id,v_fecha,v_original.importe,
    -v_original.efecto_efectivo,'EFECTIVO',
    left('Reverso: '||v_motivo,500),'REVERSO_CAJA',
    v_original.operation_id,v_original.operation_id,v_payload,auth.uid()
  ) returning * into v_nuevo;

  return jsonb_build_object(
    'ok',true,'replayed',false,'movimiento',to_jsonb(v_nuevo)
  );
end $$;

revoke all on function private.pm08_puede_corregir_caja()
  from public,anon,authenticated,service_role;
revoke all on function private.pm08_validar_operation_id(text)
  from public,anon,authenticated,service_role;
revoke all on function private.pm08_bloquear_operation_id(text)
  from public,anon,authenticated,service_role;
revoke all on function private.pm08_local_operable(text,text)
  from public,anon,authenticated,service_role;

revoke execute on function public.revertir_movimiento_caja(text,text,text,date)
  from public,anon;
grant execute on function public.revertir_movimiento_caja(text,text,text,date)
  to authenticated,service_role;
