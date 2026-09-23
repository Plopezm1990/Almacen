-- ABC F2 M03A — primitivas de autoridad transaccional.
-- Aditiva. No activa cobros, no expone RPC publicas y no modifica datos.
-- Depende de M01/M01b + M02A + M02B.

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.abc_operaciones') is null then v_missing:=array_append(v_missing,'abc_operaciones'); end if;
  if to_regclass('public.ventas_fiscales') is null then v_missing:=array_append(v_missing,'ventas_fiscales'); end if;
  if to_regclass('public.pago_aplicaciones') is null then v_missing:=array_append(v_missing,'pago_aplicaciones'); end if;
  if to_regclass('public.reservas_saldo') is null then v_missing:=array_append(v_missing,'reservas_saldo'); end if;
  if to_regclass('public.reembolsos') is null then v_missing:=array_append(v_missing,'reembolsos'); end if;
  if to_regclass('public.reembolso_aplicaciones') is null then v_missing:=array_append(v_missing,'reembolso_aplicaciones'); end if;
  if to_regclass('public.membresias_usuario') is null then v_missing:=array_append(v_missing,'membresias_usuario'); end if;
  if to_regprocedure('auth.uid()') is null then v_missing:=array_append(v_missing,'auth.uid'); end if;
  if to_regprocedure('private.la_tiene_local(text,text)') is null then v_missing:=array_append(v_missing,'la_tiene_local'); end if;
  if to_regprocedure('extensions.digest(text,text)') is null then v_missing:=array_append(v_missing,'extensions.digest'); end if;

  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is not null
     or to_regprocedure('private.abc_request_hash(jsonb)') is not null
     or to_regprocedure('private.abc_lock_operation_id(text)') is not null
     or to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is not null
     or to_regprocedure('private.abc_operacion_completar(text,jsonb)') is not null
     or to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is not null
     or to_regprocedure('private.abc_saldo_cobrable(text,text,uuid)') is not null
     or to_regprocedure('private.abc_saldo_disponible(text,text,uuid)') is not null
     or to_regprocedure('private.abc_max_reembolsable_pago(text,text,uuid)') is not null
     or to_regprocedure('private.abc_max_reembolsable_venta(text,text,uuid)') is not null
     or to_regprocedure('private.abc_bloquear_ventas(text,text,uuid[])') is not null
     or to_regprocedure('private.abc_bloquear_aplicaciones(text,text,uuid[])') is not null then
    raise exception 'ABC_F2_M03A_PREFLIGHT_FALLO: objetos M03A ya existen';
  end if;

  if cardinality(v_missing)>0 then
    raise exception 'ABC_F2_M03A_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
end $$;

-- F2-D05: adaptador transitorio de capacidad por membresia local.
-- Las RPC futuras dependen de capacidades estables, no de nombres de rol.
-- Una membresia especifica del local prevalece sobre todos_locales.
create function private.abc_tiene_capacidad(
  p_empresa_id text,
  p_local_id text,
  p_capacidad text
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_rol text;
  v_capacidad text := upper(btrim(coalesce(p_capacidad,'')));
begin
  if auth.uid() is null then return false; end if;
  if nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or v_capacidad='' then
    return false;
  end if;
  if not private.la_tiene_local(p_empresa_id,p_local_id) then
    return false;
  end if;

  select m.rol
    into v_rol
    from public.membresias_usuario m
   where m.user_id=auth.uid()
     and m.empresa_id=p_empresa_id
     and m.activo=true
     and (
       (m.todos_locales=false and m.local_id=p_local_id)
       or (m.todos_locales=true and m.local_id is null)
     )
   order by
     case when m.todos_locales=false and m.local_id=p_local_id then 0 else 1 end,
     m.id desc
   limit 1;

  if v_rol is null then return false; end if;

  return case v_capacidad
    when 'ABC_CUENTA_OPERAR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a','Churrero/a')
    when 'ABC_COBRO_INICIAR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_COBRO_EFECTIVO' then
      v_rol in ('Propietario','Encargado','Cajero/a')
    when 'ABC_REEMBOLSO_SOLICITAR' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_REEMBOLSO_CONFIRMAR' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_CAJA_OPERAR' then
      v_rol in ('Propietario','Encargado','Cajero/a')
    when 'ABC_EMISOR_CAMBIAR' then
      v_rol in ('Propietario','Encargado')
    else false
  end;
end $$;

create function private.abc_request_hash(p_request jsonb)
returns text
language sql
immutable
security invoker
set search_path=''
as $$
  select pg_catalog.encode(
    extensions.digest(coalesce(p_request,'{}'::jsonb)::text,'sha256'),
    'hex'
  )
$$;

create function private.abc_lock_operation_id(p_operation_id text)
returns void
language plpgsql
volatile
security definer
set search_path=''
as $$
begin
  if p_operation_id is null
     or p_operation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$' then
    raise exception 'operation_id_invalido';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_operation_id,0)
  );
end $$;

create function private.abc_operacion_iniciar(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_command_type text,
  p_request jsonb,
  p_terminal_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_request jsonb := coalesce(p_request,'{}'::jsonb);
  v_hash text;
  v_command text := upper(btrim(coalesce(p_command_type,'')));
  v_existente public.abc_operaciones%rowtype;
begin
  if auth.uid() is null then raise exception 'abc_no_autenticado'; end if;
  if not private.la_tiene_local(p_empresa_id,p_local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if v_command='' then raise exception 'command_type_requerido'; end if;

  perform private.abc_lock_operation_id(p_operation_id);
  v_hash:=private.abc_request_hash(v_request);

  select *
    into v_existente
    from public.abc_operaciones
   where operation_id=p_operation_id
   for update;

  if found then
    if v_existente.empresa_id is distinct from p_empresa_id
       or v_existente.local_id is distinct from p_local_id then
      raise exception 'contexto_no_autorizado';
    end if;
    if v_existente.command_type is distinct from v_command
       or v_existente.request_hash is distinct from v_hash then
      raise exception 'operation_id_conflict';
    end if;

    return jsonb_build_object(
      'ok',true,
      'replayed',true,
      'operation_id',v_existente.operation_id,
      'status',v_existente.status,
      'resultado',v_existente.resultado,
      'error',v_existente.error
    );
  end if;

  insert into public.abc_operaciones(
    operation_id,empresa_id,local_id,command_type,request_hash,status,
    actor_user_id,terminal_id,request
  ) values (
    p_operation_id,p_empresa_id,p_local_id,v_command,v_hash,'PROCESANDO',
    auth.uid(),p_terminal_id,v_request
  );

  return jsonb_build_object(
    'ok',true,
    'replayed',false,
    'operation_id',p_operation_id,
    'status','PROCESANDO'
  );
end $$;

create function private.abc_operacion_completar(
  p_operation_id text,
  p_resultado jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_row public.abc_operaciones%rowtype;
begin
  perform private.abc_lock_operation_id(p_operation_id);

  update public.abc_operaciones
     set status='COMPLETADA',
         resultado=coalesce(p_resultado,'{}'::jsonb),
         error=null,
         completed_at=now()
   where operation_id=p_operation_id
     and status='PROCESANDO'
  returning * into v_row;

  if not found then
    raise exception 'abc_operacion_no_procesando';
  end if;
  return to_jsonb(v_row);
end $$;

create function private.abc_operacion_fallar(
  p_operation_id text,
  p_error jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_row public.abc_operaciones%rowtype;
begin
  perform private.abc_lock_operation_id(p_operation_id);

  update public.abc_operaciones
     set status='FALLIDA',
         resultado=null,
         error=coalesce(p_error,'{}'::jsonb),
         completed_at=now()
   where operation_id=p_operation_id
     and status='PROCESANDO'
  returning * into v_row;

  if not found then
    raise exception 'abc_operacion_no_procesando';
  end if;
  return to_jsonb(v_row);
end $$;

create function private.abc_saldo_cobrable(
  p_empresa_id text,
  p_local_id text,
  p_venta_fiscal_id uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_total numeric(24,8);
  v_aplicado numeric(24,8);
begin
  select v.total
    into v_total
    from public.ventas_fiscales v
   where v.empresa_id=p_empresa_id
     and v.local_id=p_local_id
     and v.id=p_venta_fiscal_id;

  if not found then raise exception 'venta_fiscal_no_encontrada'; end if;

  select coalesce(sum(a.sale_amount),0)::numeric(24,8)
    into v_aplicado
    from public.pago_aplicaciones a
    join public.pago_intentos i
      on i.empresa_id=a.empresa_id
     and i.local_id=a.local_id
     and i.id=a.intento_id
   where a.empresa_id=p_empresa_id
     and a.local_id=p_local_id
     and a.venta_fiscal_id=p_venta_fiscal_id
     and i.estado='CONFIRMADO';

  if v_aplicado > v_total then
    raise exception 'saldo_cobrable_inconsistente';
  end if;

  return (v_total-v_aplicado)::numeric(24,8);
end $$;

create function private.abc_saldo_disponible(
  p_empresa_id text,
  p_local_id text,
  p_venta_fiscal_id uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_cobrable numeric(24,8);
  v_reservado numeric(24,8);
begin
  v_cobrable:=private.abc_saldo_cobrable(
    p_empresa_id,p_local_id,p_venta_fiscal_id
  );

  select coalesce(sum(r.importe_reservado),0)::numeric(24,8)
    into v_reservado
    from public.reservas_saldo r
   where r.empresa_id=p_empresa_id
     and r.local_id=p_local_id
     and r.venta_fiscal_id=p_venta_fiscal_id
     and r.estado='ACTIVA';

  if v_reservado > v_cobrable then
    raise exception 'saldo_reservado_excede_cobrable';
  end if;

  return (v_cobrable-v_reservado)::numeric(24,8);
end $$;

create function private.abc_max_reembolsable_pago(
  p_empresa_id text,
  p_local_id text,
  p_pago_aplicacion_id uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_original numeric(24,8);
  v_comprometido numeric(24,8);
begin
  select a.payment_amount
    into v_original
    from public.pago_aplicaciones a
   where a.empresa_id=p_empresa_id
     and a.local_id=p_local_id
     and a.id=p_pago_aplicacion_id;

  if not found then raise exception 'pago_aplicacion_no_encontrada'; end if;

  select coalesce(sum(ra.importe_pago),0)::numeric(24,8)
    into v_comprometido
    from public.reembolso_aplicaciones ra
    join public.reembolsos r
      on r.empresa_id=ra.empresa_id
     and r.local_id=ra.local_id
     and r.id=ra.reembolso_id
   where ra.empresa_id=p_empresa_id
     and ra.local_id=p_local_id
     and ra.pago_aplicacion_id=p_pago_aplicacion_id
     and r.estado in ('PENDIENTE','DESCONOCIDO','CONFIRMADO');

  if v_comprometido > v_original then
    raise exception 'reembolso_excede_aplicacion';
  end if;

  return (v_original-v_comprometido)::numeric(24,8);
end $$;

create function private.abc_max_reembolsable_venta(
  p_empresa_id text,
  p_local_id text,
  p_pago_aplicacion_id uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_original numeric(24,8);
  v_comprometido numeric(24,8);
begin
  select a.sale_amount
    into v_original
    from public.pago_aplicaciones a
   where a.empresa_id=p_empresa_id
     and a.local_id=p_local_id
     and a.id=p_pago_aplicacion_id;

  if not found then raise exception 'pago_aplicacion_no_encontrada'; end if;

  select coalesce(sum(ra.importe_venta),0)::numeric(24,8)
    into v_comprometido
    from public.reembolso_aplicaciones ra
    join public.reembolsos r
      on r.empresa_id=ra.empresa_id
     and r.local_id=ra.local_id
     and r.id=ra.reembolso_id
   where ra.empresa_id=p_empresa_id
     and ra.local_id=p_local_id
     and ra.pago_aplicacion_id=p_pago_aplicacion_id
     and r.estado in ('PENDIENTE','DESCONOCIDO','CONFIRMADO');

  if v_comprometido > v_original then
    raise exception 'reembolso_excede_aplicacion';
  end if;

  return (v_original-v_comprometido)::numeric(24,8);
end $$;

create function private.abc_bloquear_ventas(
  p_empresa_id text,
  p_local_id text,
  p_venta_ids uuid[]
)
returns void
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_id uuid;
begin
  if p_venta_ids is null or cardinality(p_venta_ids)=0
     or array_position(p_venta_ids,null) is not null then
    raise exception 'venta_ids_invalidos';
  end if;

  for v_id in
    select distinct x
      from unnest(p_venta_ids) as u(x)
     order by x
  loop
    perform 1
      from public.ventas_fiscales v
     where v.empresa_id=p_empresa_id
       and v.local_id=p_local_id
       and v.id=v_id
     for update;
    if not found then raise exception 'venta_fiscal_no_encontrada'; end if;
  end loop;
end $$;

create function private.abc_bloquear_aplicaciones(
  p_empresa_id text,
  p_local_id text,
  p_aplicacion_ids uuid[]
)
returns void
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_id uuid;
begin
  if p_aplicacion_ids is null or cardinality(p_aplicacion_ids)=0
     or array_position(p_aplicacion_ids,null) is not null then
    raise exception 'aplicacion_ids_invalidos';
  end if;

  for v_id in
    select distinct x
      from unnest(p_aplicacion_ids) as u(x)
     order by x
  loop
    perform 1
      from public.pago_aplicaciones a
     where a.empresa_id=p_empresa_id
       and a.local_id=p_local_id
       and a.id=v_id
     for update;
    if not found then raise exception 'pago_aplicacion_no_encontrada'; end if;
  end loop;
end $$;

revoke all on function private.abc_tiene_capacidad(text,text,text) from public,anon,authenticated;
revoke all on function private.abc_request_hash(jsonb) from public,anon,authenticated;
revoke all on function private.abc_lock_operation_id(text) from public,anon,authenticated;
revoke all on function private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function private.abc_operacion_completar(text,jsonb) from public,anon,authenticated;
revoke all on function private.abc_operacion_fallar(text,jsonb) from public,anon,authenticated;
revoke all on function private.abc_saldo_cobrable(text,text,uuid) from public,anon,authenticated;
revoke all on function private.abc_saldo_disponible(text,text,uuid) from public,anon,authenticated;
revoke all on function private.abc_max_reembolsable_pago(text,text,uuid) from public,anon,authenticated;
revoke all on function private.abc_max_reembolsable_venta(text,text,uuid) from public,anon,authenticated;
revoke all on function private.abc_bloquear_ventas(text,text,uuid[]) from public,anon,authenticated;
revoke all on function private.abc_bloquear_aplicaciones(text,text,uuid[]) from public,anon,authenticated;
