-- PM14 P02: espejo autoritativo del encargo (total/estado) y ledger de anticipos/cobros.
-- Mismo patron ya probado en PM06 (albaranes_empresa / pagos_factura), sin crear un
-- segundo motor de idempotencia: reutiliza private.la_tiene_empresa/la_tiene_local,
-- private.pm08_bloquear_operation_id, private.pm08_validar_operation_id,
-- private.pm08_validar_dinero y private.pm08_local_operable ya existentes.

create table public.encargos_empresa (
  id text primary key,
  empresa_id text not null,
  local_id text not null,
  cliente_id text,
  datos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.encargos_empresa enable row level security;

create policy pm14_encargos_select on public.encargos_empresa
  for select using (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id));
create policy pm14_encargos_insert on public.encargos_empresa
  for insert with check (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id));
create policy pm14_encargos_update on public.encargos_empresa
  for update using (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id))
  with check (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id));
-- Sin política de DELETE: el borrado físico de un encargo queda bloqueado a nivel de base
-- (coherente con DEC-04: las operaciones económicas confirmadas no se borran silenciosamente).

create table public.pagos_encargo (
  id text primary key,
  operation_id text not null unique,
  encargo_id text not null,
  empresa_id text not null,
  local_id text not null,
  concepto text not null check (concepto = any (array['SEÑAL','RESTO_ENTREGA','OTRO'])),
  importe numeric not null check (importe > 0),
  fecha date not null default current_date,
  estado text not null check (estado = any (array['CONFIRMADO','REVERSO'])),
  revierte_pago_id text references public.pagos_encargo(id),
  medio_pago text check (medio_pago is null or medio_pago = any (array['Efectivo','Tarjeta','Transferencia','Otro'])),
  datos jsonb not null default '{}'::jsonb,
  actor_user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.pagos_encargo enable row level security;

create policy pm14_pagos_encargo_select on public.pagos_encargo
  for select using (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id));
-- Sin políticas de insert/update/delete: toda escritura pasa por las RPC SECURITY DEFINER
-- de abajo, igual que pagos_factura.

create index pagos_encargo_por_encargo on public.pagos_encargo(encargo_id, empresa_id, local_id);

-- Total autoritativo del encargo (mismo patrón que private.pm06_total_factura).
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
  if d is null or coalesce(d->>'estado','Pendiente') = 'Cancelado' then return null; end if;
  total := coalesce(nullif(d->>'total','')::numeric, 0);
  return round(total, 2);
end;
$function$;

-- Sincroniza el espejo autoritativo del encargo (id/empresa/local/cliente/total/estado)
-- desde el frontend. No sustituye el documento completo del encargo (que sigue viviendo
-- en almacen_kv hasta que PM14-P06 decida su migración completa); solo lo necesario para
-- que registrar_pago_encargo pueda validar el saldo sin fiarse ciegamente del cliente.
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
  if v_estado not in ('Pendiente', 'Entregado', 'Cancelado') then raise exception 'estado_encargo_invalido'; end if;
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

-- Registrar un cobro (señal o resto en la entrega) trazable, idempotente y sin sobrecobro.
create or replace function public.registrar_pago_encargo(
  p_id text,
  p_operation_id text,
  p_encargo_id text,
  p_empresa_id text,
  p_local_id text,
  p_concepto text,
  p_importe numeric,
  p_fecha date,
  p_medio_pago text default null,
  p_datos jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'private', 'pg_temp'
as $function$
declare
  v_operation_id text;
  v_concepto text;
  v_importe numeric;
  v_fecha date;
  v_datos jsonb;
  v_total numeric;
  v_pagado numeric;
  v_pendiente numeric;
  existente public.pagos_encargo%rowtype;
  nuevo public.pagos_encargo%rowtype;
begin
  if auth.uid() is null or not private.pm08_puede_operar_caja() then
    raise exception 'pago_encargo_no_autorizado';
  end if;
  if not private.la_tiene_empresa(p_empresa_id) or not private.la_tiene_local(p_empresa_id, p_local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if p_id is null or btrim(p_id) = '' then raise exception 'id_requerido'; end if;
  if p_encargo_id is null or btrim(p_encargo_id) = '' then raise exception 'encargo_id_requerido'; end if;
  if not private.pm08_local_operable(p_empresa_id, p_local_id) then raise exception 'local_inactivo'; end if;
  if p_fecha is null then raise exception 'fecha_requerida'; end if;

  v_operation_id := private.pm08_validar_operation_id(p_operation_id);
  v_concepto := upper(btrim(coalesce(p_concepto, '')));
  if v_concepto not in ('SEÑAL', 'RESTO_ENTREGA', 'OTRO') then raise exception 'concepto_pago_invalido'; end if;
  v_importe := private.pm08_validar_dinero(p_importe, false, false);
  v_fecha := p_fecha;
  v_datos := coalesce(p_datos, '{}'::jsonb);

  perform private.pm08_bloquear_operation_id(v_operation_id);

  select * into existente from public.pagos_encargo where operation_id = v_operation_id;
  if found then
    if existente.id = p_id
       and existente.encargo_id = p_encargo_id
       and existente.empresa_id = p_empresa_id
       and existente.local_id = p_local_id
       and existente.concepto = v_concepto
       and existente.importe = v_importe
       and existente.fecha = v_fecha
       and existente.medio_pago is not distinct from p_medio_pago
       and existente.datos = v_datos
       and existente.estado = 'CONFIRMADO' then
      return jsonb_build_object('ok', true, 'replayed', true, 'pago', to_jsonb(existente));
    end if;
    raise exception 'operation_id_conflict';
  end if;
  if exists(select 1 from public.stock_operaciones where operation_id = v_operation_id)
     or exists(select 1 from public.caja_operaciones where operation_id = v_operation_id)
     or exists(select 1 from public.pagos_factura where operation_id = v_operation_id) then
    raise exception 'operation_id_conflict';
  end if;

  perform 1 from public.encargos_empresa
    where id = p_encargo_id and empresa_id = p_empresa_id and local_id = p_local_id
    for update;

  v_total := private.pm14_total_encargo(p_empresa_id, p_local_id, p_encargo_id);
  if v_total is null then raise exception 'encargo_no_encontrado_o_no_autorizado'; end if;

  select coalesce(sum(case when estado = 'CONFIRMADO' then importe else -importe end), 0)
    into v_pagado
    from public.pagos_encargo
   where encargo_id = p_encargo_id and empresa_id = p_empresa_id and local_id = p_local_id;

  v_pendiente := round(v_total - v_pagado, 2);
  if v_pendiente <= 0 then raise exception 'encargo_ya_liquidado'; end if;
  if v_importe > v_pendiente then raise exception 'pago_supera_saldo'; end if;

  insert into public.pagos_encargo(
    id, operation_id, encargo_id, empresa_id, local_id, concepto, importe, fecha,
    estado, medio_pago, datos, actor_user_id
  ) values (
    p_id, v_operation_id, p_encargo_id, p_empresa_id, p_local_id, v_concepto, v_importe, v_fecha,
    'CONFIRMADO', p_medio_pago, v_datos, auth.uid()
  ) returning * into nuevo;

  return jsonb_build_object(
    'ok', true, 'replayed', false, 'pago', to_jsonb(nuevo),
    'total', v_total, 'pagado', round(v_pagado + nuevo.importe, 2),
    'pendiente', round(v_total - v_pagado - nuevo.importe, 2)
  );
end;
$function$;

-- Reverso trazable de un cobro (nunca se borra la fila original).
create or replace function public.revertir_pago_encargo(
  p_id text,
  p_operation_id text,
  p_pago_id text,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'private', 'pg_temp'
as $function$
declare
  v_operation_id text;
  v_motivo text;
  existente public.pagos_encargo%rowtype;
  original public.pagos_encargo%rowtype;
  previo public.pagos_encargo%rowtype;
  nuevo public.pagos_encargo%rowtype;
begin
  if auth.uid() is null or not private.pm06_puede_gestionar_finanzas() then
    raise exception 'reverso_pago_encargo_no_autorizado';
  end if;
  if p_id is null or btrim(p_id) = '' then raise exception 'id_requerido'; end if;
  v_operation_id := private.pm08_validar_operation_id(p_operation_id);
  v_motivo := btrim(coalesce(p_motivo, ''));
  if v_motivo = '' then raise exception 'motivo_requerido'; end if;

  perform private.pm08_bloquear_operation_id(v_operation_id);

  select * into existente from public.pagos_encargo where operation_id = v_operation_id;
  if found then
    if existente.id = p_id
       and existente.estado = 'REVERSO'
       and existente.revierte_pago_id = p_pago_id
       and coalesce(existente.datos->>'motivo', '') = v_motivo then
      return jsonb_build_object('ok', true, 'replayed', true, 'pago', to_jsonb(existente));
    end if;
    raise exception 'operation_id_conflict';
  end if;

  select * into original from public.pagos_encargo where id = p_pago_id and estado = 'CONFIRMADO' for update;
  if not found then raise exception 'pago_original_no_encontrado'; end if;
  if not private.la_tiene_empresa(original.empresa_id) or not private.la_tiene_local(original.empresa_id, original.local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if not private.pm08_local_operable(original.empresa_id, original.local_id) then raise exception 'local_inactivo'; end if;

  select * into previo from public.pagos_encargo where revierte_pago_id = p_pago_id and estado = 'REVERSO' limit 1;
  if found then raise exception 'pago_ya_revertido'; end if;

  insert into public.pagos_encargo(
    id, operation_id, encargo_id, empresa_id, local_id, concepto, importe, fecha,
    estado, revierte_pago_id, medio_pago, datos, actor_user_id
  ) values (
    p_id, v_operation_id, original.encargo_id, original.empresa_id, original.local_id,
    original.concepto, original.importe, current_date,
    'REVERSO', original.id, original.medio_pago, jsonb_build_object('motivo', v_motivo), auth.uid()
  ) returning * into nuevo;

  return jsonb_build_object('ok', true, 'replayed', false, 'pago', to_jsonb(nuevo));
end;
$function$;
