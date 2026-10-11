-- ABC F4 B04 — resolución controlada de cobros con resultado desconocido.
-- Aditiva. Mantiene el bloqueo del saldo y permite resolver por referencia o
-- mediante una incidencia verificada por una persona responsable.

do $$
declare
  v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.pago_intentos') is null then
    v_missing:=array_append(v_missing,'pago_intentos');
  end if;
  if to_regprocedure('public.abc_resolver_intento(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb)') is null then
    v_missing:=array_append(v_missing,'abc_resolver_intento');
  end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then
    v_missing:=array_append(v_missing,'abc_operacion_iniciar');
  end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then
    v_missing:=array_append(v_missing,'abc_operacion_completar');
  end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then
    v_missing:=array_append(v_missing,'abc_tiene_capacidad');
  end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F4_B04_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
  if to_regclass('public.abc_cobro_incidencias') is not null
     or to_regprocedure('public.abc_abrir_incidencia_cobro(text,text,text,uuid,text,text,text,jsonb)') is not null
     or to_regprocedure('public.abc_resolver_incidencia_cobro(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb)') is not null then
    raise exception 'ABC_F4_B04_PREFLIGHT_FALLO: objetos B04 ya existen';
  end if;
end $$;

create table public.abc_cobro_incidencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  intento_id uuid not null,
  operation_id text not null,
  estado text not null default 'ABIERTA'
    check (estado in ('ABIERTA','RESUELTA','CANCELADA')),
  motivo text not null
    check (char_length(btrim(motivo)) between 1 and 500),
  provider_code text,
  provider_reference text,
  evidencia jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evidencia)='object'),
  resultado_estado text
    check (resultado_estado is null or resultado_estado in ('CONFIRMADO','RECHAZADO','CANCELADO')),
  resultado jsonb
    check (resultado is null or jsonb_typeof(resultado)='object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolution_operation_id text,
  version bigint not null default 1 check (version>=1),
  check (provider_code is null or char_length(btrim(provider_code)) between 1 and 120),
  check (provider_reference is null or char_length(btrim(provider_reference)) between 1 and 240),
  check (
    (estado='ABIERTA' and resultado_estado is null and resolved_at is null and resolved_by is null)
    or (estado in ('RESUELTA','CANCELADA') and resultado_estado is not null and resolved_at is not null and resolved_by is not null)
  )
);

create index abc_cobro_incidencias_scope_idx
  on public.abc_cobro_incidencias(empresa_id,local_id,estado,created_at desc);
create index abc_cobro_incidencias_intento_idx
  on public.abc_cobro_incidencias(empresa_id,local_id,intento_id,created_at desc);
create unique index abc_cobro_incidencias_abierta_uq
  on public.abc_cobro_incidencias(empresa_id,local_id,intento_id)
  where estado='ABIERTA';
create unique index abc_cobro_incidencias_operation_uq
  on public.abc_cobro_incidencias(empresa_id,operation_id);

alter table public.abc_cobro_incidencias enable row level security;
revoke all on table public.abc_cobro_incidencias from public,anon,authenticated,service_role;

-- Añade una capacidad separada para la resolución responsable de un cobro incierto.
create or replace function private.abc_tiene_capacidad(
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
  if not private.la_tiene_local(p_empresa_id,p_local_id) then return false; end if;

  select m.rol into v_rol
    from public.membresias_usuario m
   where m.user_id=auth.uid()
     and m.empresa_id=p_empresa_id
     and m.activo=true
     and ((m.todos_locales=false and m.local_id=p_local_id)
       or (m.todos_locales=true and m.local_id is null))
   order by case when m.todos_locales=false and m.local_id=p_local_id then 0 else 1 end,m.id desc
   limit 1;

  if v_rol is null then return false; end if;

  return case v_capacidad
    when 'ABC_CUENTA_OPERAR' then v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a','Churrero/a')
    when 'ABC_CUENTA_REASIGNAR' then v_rol in ('Propietario','Encargado')
    when 'ABC_COBRO_INICIAR' then v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_COBRO_EFECTIVO' then v_rol in ('Propietario','Encargado','Cajero/a')
    when 'ABC_COBRO_RESOLVER_INCIERTO' then v_rol in ('Propietario','Encargado')
    when 'ABC_REEMBOLSO_SOLICITAR' then v_rol in ('Propietario','Encargado')
    when 'ABC_REEMBOLSO_CONFIRMAR' then v_rol in ('Propietario','Encargado')
    when 'ABC_CAJA_OPERAR' then v_rol in ('Propietario','Encargado','Cajero/a')
    when 'ABC_EMISOR_CAMBIAR' then v_rol in ('Propietario','Encargado')
    when 'ABC_PEDIDO_ENVIAR' then v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_PREPARACION_INICIAR' then v_rol in ('Propietario','Encargado','Camarero/a','Churrero/a')
    when 'ABC_PREPARACION_COMPLETAR' then v_rol in ('Propietario','Encargado','Camarero/a','Churrero/a')
    when 'ABC_PEDIDO_SERVIR' then v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_LINEA_CANCELAR' then v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_CANCELACION_SENSIBLE' then v_rol in ('Propietario','Encargado')
    when 'ABC_PEDIDO_CANCELAR' then v_rol in ('Propietario','Encargado')
    when 'ABC_PEDIDO_CERRAR' then v_rol in ('Propietario','Encargado','Cajero/a')
    when 'ABC_SALA_VER' then v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_SALA_CONFIGURAR' then v_rol in ('Propietario','Encargado')
    when 'ABC_MESA_ASIGNAR' then v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_MESA_RESERVAR' then v_rol in ('Propietario','Encargado')
    when 'ABC_MESA_BLOQUEAR' then v_rol in ('Propietario','Encargado')
    when 'ABC_CUENTA_REPARTIR' then v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_CUENTA_UNIR' then v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_REPARTO_REVERTIR' then v_rol in ('Propietario','Encargado')
    else false
  end;
end $$;

create function public.abc_abrir_incidencia_cobro(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_intento_id uuid,
  p_motivo text,
  p_provider_code text default null,
  p_provider_reference text default null,
  p_evidencia jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_operation text:=btrim(coalesce(p_operation_id,''));
  v_motivo text:=btrim(coalesce(p_motivo,''));
  v_provider text:=nullif(btrim(coalesce(p_provider_code,'')),'');
  v_reference text:=nullif(btrim(coalesce(p_provider_reference,'')),'');
  v_evidence jsonb:=coalesce(p_evidencia,'{}'::jsonb);
  v_request jsonb; v_cmd jsonb; v_result jsonb;
  v_estado text; v_provider_db text; v_reference_db text; v_p603 uuid;
  v_medio text; v_pago_estado text; v_checkout_id uuid; v_cuenta_id uuid;
  v_importe numeric; v_operating_day date; v_terminal uuid;
  v_incident public.abc_cobro_incidencias%rowtype;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR') then
    raise exception 'abc_cobro_no_autorizado';
  end if;
  if v_operation='' then raise exception 'operation_id_requerido'; end if;
  if p_intento_id is null then raise exception 'intento_id_requerido'; end if;
  if v_motivo='' then raise exception 'motivo_requerido'; end if;
  if jsonb_typeof(v_evidence)<>'object' then raise exception 'evidencia_invalida'; end if;
  if v_evidence ?| array['pan','PAN','cvv','CVV','card_number','numero_tarjeta'] then
    raise exception 'evidencia_datos_tarjeta_prohibidos';
  end if;

  select i.estado,i.provider_code,i.provider_reference,i.pago_id,
         p.medio,p.estado,p.checkout_id,p.importe_objetivo,
         c.cuenta_id,c.operating_day
    into v_estado,v_provider_db,v_reference_db,v_p603,
         v_medio,v_pago_estado,v_checkout_id,v_importe,
         v_cuenta_id,v_operating_day
    from public.pago_intentos i
    join public.pagos p on p.empresa_id=i.empresa_id and p.local_id=i.local_id and p.id=i.pago_id
    join public.checkouts c on c.empresa_id=p.empresa_id and c.local_id=p.local_id and c.id=p.checkout_id
   where i.empresa_id=p_empresa_id and i.local_id=p_local_id and i.id=p_intento_id
   for update;
  if not found then raise exception 'intento_no_encontrado'; end if;
  if v_medio='EFECTIVO' then raise exception 'efectivo_usa_confirmacion_local'; end if;
  if v_estado not in ('PENDIENTE','AUTORIZADO','DESCONOCIDO')
     or v_pago_estado not in ('PENDIENTE','AUTORIZADO','DESCONOCIDO') then
    raise exception 'cobro_no_incierto';
  end if;
  if v_provider_db is not null and v_provider is not null and v_provider_db<>v_provider then
    raise exception 'provider_reference_conflict';
  end if;
  if v_reference_db is not null and v_reference is not null and v_reference_db<>v_reference then
    raise exception 'provider_reference_conflict';
  end if;
  v_provider:=coalesce(v_provider,v_provider_db);
  v_reference:=coalesce(v_reference,v_reference_db);

  select terminal_id into v_terminal from public.abc_operaciones where operation_id=(select abc_command_id from public.pago_intentos where id=p_intento_id);
  v_request:=jsonb_build_object('intento_id',p_intento_id,'motivo',v_motivo,
    'provider_code',v_provider,'provider_reference',v_reference,'evidencia',v_evidence);
  v_cmd:=private.abc_operacion_iniciar(v_operation,p_empresa_id,p_local_id,'ABC_ABRIR_INCIDENCIA_COBRO',v_request,v_terminal);
  if coalesce((v_cmd->>'replayed')::boolean,false) then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_incident
    from public.abc_cobro_incidencias
   where empresa_id=p_empresa_id and local_id=p_local_id and intento_id=p_intento_id and estado='ABIERTA'
   for update;
  if found then raise exception 'cobro_incidencia_ya_abierta'; end if;

  insert into public.abc_cobro_incidencias(
    empresa_id,local_id,intento_id,operation_id,motivo,provider_code,provider_reference,evidencia,created_by
  ) values (
    p_empresa_id,p_local_id,p_intento_id,v_operation,v_motivo,v_provider,v_reference,v_evidence,auth.uid()
  ) returning * into v_incident;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,
    actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,v_operation,'PAGO',v_p603::text,'COBRO_INCIDENCIA_ABIERTA',
    jsonb_build_object('incidencia_id',v_incident.id,'intento_id',p_intento_id,
      'motivo',v_motivo,'provider_code',v_provider,'provider_reference',v_reference),
    auth.uid(),v_terminal,now(),v_operating_day
  );

  v_result:=jsonb_build_object('ok',true,'incidencia_id',v_incident.id,'intento_id',p_intento_id,
    'pago_id',v_p603,'cuenta_id',v_cuenta_id,'estado','ABIERTA','importe',v_importe,
    'provider_code',v_provider,'provider_reference',v_reference);
  perform private.abc_operacion_completar(v_operation,v_result);
  return v_result;
end $$;

create function public.abc_resolver_incidencia_cobro(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_incidencia_id uuid,
  p_estado text,
  p_provider_code text,
  p_provider_reference text,
  p_authorized_amount numeric,
  p_captured_amount numeric,
  p_settled_amount numeric,
  p_evidencia jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_estado text:=upper(btrim(coalesce(p_estado,'')));
  v_provider text:=nullif(btrim(coalesce(p_provider_code,'')),'');
  v_reference text:=nullif(btrim(coalesce(p_provider_reference,'')),'');
  v_evidence jsonb:=coalesce(p_evidencia,'{}'::jsonb);
  v_incident public.abc_cobro_incidencias%rowtype;
  v_result jsonb; v_request jsonb;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_RESOLVER_INCIERTO') then
    raise exception 'abc_cobro_resolver_no_autorizado';
  end if;
  if v_estado not in ('CONFIRMADO','RECHAZADO','CANCELADO') then raise exception 'estado_resolucion_invalido'; end if;
  if v_provider is null or v_reference is null then raise exception 'provider_requerido'; end if;
  if jsonb_typeof(v_evidence)<>'object' then raise exception 'evidencia_invalida'; end if;
  if v_evidence ?| array['pan','PAN','cvv','CVV','card_number','numero_tarjeta'] then
    raise exception 'evidencia_datos_tarjeta_prohibidos';
  end if;
  if nullif(btrim(coalesce(p_operation_id,'')),'') is null then raise exception 'operation_id_requerido'; end if;

  select * into v_incident
    from public.abc_cobro_incidencias
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_incidencia_id
   for update;
  if not found then raise exception 'cobro_incidencia_no_encontrada'; end if;
  if v_incident.estado='RESUELTA' and v_incident.resolution_operation_id=p_operation_id then
    return coalesce(v_incident.resultado,'{}'::jsonb)||jsonb_build_object('ok',true,'replayed',true,'incidencia_id',v_incident.id,'estado_incidencia','RESUELTA');
  end if;
  if v_incident.estado<>'ABIERTA' then raise exception 'cobro_incidencia_no_abierta'; end if;

  v_request:=jsonb_build_object('incidencia_id',p_incidencia_id,'intento_id',v_incident.intento_id,
    'estado',v_estado,'provider_code',v_provider,'provider_reference',v_reference,'evidencia',v_evidence);
  v_result:=public.abc_resolver_intento(
    p_operation_id,p_empresa_id,p_local_id,v_incident.intento_id,v_estado,
    v_provider,v_reference,p_authorized_amount,p_captured_amount,p_settled_amount,
    v_evidence
  );

  update public.abc_cobro_incidencias
     set estado='RESUELTA',resultado_estado=v_estado,provider_code=v_provider,
         provider_reference=v_reference,evidencia=evidencia||jsonb_build_object('resolucion',v_evidence),
         resultado=v_result,resolved_by=auth.uid(),resolved_at=now(),
         resolution_operation_id=p_operation_id,version=version+1
   where id=v_incident.id and estado='ABIERTA';
  if not found then raise exception 'cobro_incidencia_actualizacion_fallida'; end if;

  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object(
    'ok',true,'incidencia_id',v_incident.id,'estado_incidencia','RESUELTA','resultado_estado',v_estado
  );
end $$;

create function public.abc_listar_incidencias_cobro(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid default null
)
returns table(
  id uuid,
  intento_id uuid,
  pago_id uuid,
  checkout_id uuid,
  cuenta_id uuid,
  estado text,
  motivo text,
  provider_code text,
  provider_reference text,
  evidencia jsonb,
  resultado_estado text,
  resultado jsonb,
  created_at timestamptz,
  resolved_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR') then
    raise exception 'abc_cobro_no_autorizado';
  end if;
  return query
  select i.id,i.intento_id,p.id,p.checkout_id,c.cuenta_id,i.estado,i.motivo,
         i.provider_code,i.provider_reference,i.evidencia,i.resultado_estado,i.resultado,
         i.created_at,i.resolved_at
    from public.abc_cobro_incidencias i
    join public.pago_intentos pi on pi.empresa_id=i.empresa_id and pi.local_id=i.local_id and pi.id=i.intento_id
    join public.pagos p on p.empresa_id=pi.empresa_id and p.local_id=pi.local_id and p.id=pi.pago_id
    join public.checkouts c on c.empresa_id=p.empresa_id and c.local_id=p.local_id and c.id=p.checkout_id
   where i.empresa_id=p_empresa_id and i.local_id=p_local_id
     and (p_cuenta_id is null or c.cuenta_id=p_cuenta_id)
   order by i.created_at desc,i.id;
end $$;

revoke all on function private.abc_tiene_capacidad(text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.abc_abrir_incidencia_cobro(text,text,text,uuid,text,text,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.abc_resolver_incidencia_cobro(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.abc_listar_incidencias_cobro(text,text,uuid) from public,anon,authenticated,service_role;

grant execute on function public.abc_abrir_incidencia_cobro(text,text,text,uuid,text,text,text,jsonb) to authenticated;
grant execute on function public.abc_resolver_incidencia_cobro(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb) to authenticated;
grant execute on function public.abc_listar_incidencias_cobro(text,text,uuid) to authenticated;
