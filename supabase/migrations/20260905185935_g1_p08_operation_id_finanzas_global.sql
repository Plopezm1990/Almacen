-- G1 / Punto 8 · LA-004 e idempotencia financiera global.
-- Aplicada y validada únicamente en Supabase QA qjqorixtkilwsndqayyx.
-- No aplicar a producción sin autorización expresa.

create table if not exists private.g1_operation_ids_global (
  operation_id text primary key,
  ledger text not null,
  created_at timestamptz not null default now()
);

revoke all on table private.g1_operation_ids_global from public, anon, authenticated;

insert into private.g1_operation_ids_global(operation_id,ledger)
select operation_id, ledger
from (
  select operation_id,'pagos_factura'::text ledger from public.pagos_factura
  union all select operation_id,'caja_operaciones' from public.caja_operaciones
  union all select operation_id,'stock_operaciones' from public.stock_operaciones
  union all select operation_id,'arqueos_caja' from public.arqueos_caja
  union all select operation_id,'arqueos_caja_anulaciones' from public.arqueos_caja_anulaciones
) x
on conflict (operation_id) do nothing;

create or replace function private.g1_claim_operation_id()
returns trigger
language plpgsql
security definer
set search_path = public, auth, private, pg_temp
as $$
declare
  v_ledger text;
begin
  if new.operation_id is null or btrim(new.operation_id)='' then
    raise exception 'operation_id_requerido';
  end if;
  insert into private.g1_operation_ids_global(operation_id,ledger)
  values(new.operation_id,tg_table_name)
  on conflict (operation_id) do nothing;

  select ledger into v_ledger
  from private.g1_operation_ids_global
  where operation_id=new.operation_id;

  if v_ledger is distinct from tg_table_name then
    raise exception 'operation_id_conflict';
  end if;
  return new;
end;
$$;

revoke all on function private.g1_claim_operation_id() from public, anon, authenticated;

drop trigger if exists g1_operation_id_global on public.pagos_factura;
create trigger g1_operation_id_global before insert on public.pagos_factura
for each row execute function private.g1_claim_operation_id();

drop trigger if exists g1_operation_id_global on public.caja_operaciones;
create trigger g1_operation_id_global before insert on public.caja_operaciones
for each row execute function private.g1_claim_operation_id();

drop trigger if exists g1_operation_id_global on public.stock_operaciones;
create trigger g1_operation_id_global before insert on public.stock_operaciones
for each row execute function private.g1_claim_operation_id();

drop trigger if exists g1_operation_id_global on public.arqueos_caja;
create trigger g1_operation_id_global before insert on public.arqueos_caja
for each row execute function private.g1_claim_operation_id();

drop trigger if exists g1_operation_id_global on public.arqueos_caja_anulaciones;
create trigger g1_operation_id_global before insert on public.arqueos_caja_anulaciones
for each row execute function private.g1_claim_operation_id();

create or replace function public.registrar_pago_factura(
  p_id text,
  p_operation_id text,
  p_factura_id text,
  p_origen_factura text,
  p_empresa_id text,
  p_local_id text,
  p_importe numeric,
  p_fecha date,
  p_medio_pago text default null,
  p_datos jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, auth, private, pg_temp
as $$
declare
  existente public.pagos_factura%rowtype;
  total_doc numeric;
  pagado numeric;
  pendiente numeric;
  nuevo public.pagos_factura%rowtype;
  v_importe numeric;
  v_fecha date;
  v_datos jsonb;
begin
  if auth.uid() is null or not private.pm06_puede_gestionar_finanzas() then raise exception 'pago_no_autorizado'; end if;
  if not private.la_tiene_empresa(p_empresa_id) or not private.la_tiene_local(p_empresa_id,p_local_id) then raise exception 'contexto_no_autorizado'; end if;
  if p_operation_id is null or btrim(p_operation_id)='' or p_id is null or btrim(p_id)='' then raise exception 'operation_id_requerido'; end if;
  if p_origen_factura not in ('directa','albaran') then raise exception 'origen_factura_invalido'; end if;

  v_importe := round(coalesce(p_importe,0),2);
  v_fecha := coalesce(p_fecha,current_date);
  v_datos := coalesce(p_datos,'{}'::jsonb);
  if v_importe <= 0 then raise exception 'importe_pago_invalido'; end if;

  perform private.pm08_bloquear_operation_id(p_operation_id);

  select * into existente from public.pagos_factura where operation_id=p_operation_id;
  if found then
    if existente.id=p_id
       and existente.factura_id=p_factura_id
       and existente.origen_factura=p_origen_factura
       and existente.empresa_id=p_empresa_id
       and existente.local_id=p_local_id
       and existente.importe=v_importe
       and existente.fecha=v_fecha
       and existente.medio_pago is not distinct from p_medio_pago
       and existente.datos=v_datos
       and existente.estado='CONFIRMADO' then
      return jsonb_build_object('ok',true,'replayed',true,'pago',to_jsonb(existente));
    end if;
    raise exception 'operation_id_conflict';
  end if;

  if p_origen_factura='directa' then
    perform 1 from public.facturas_directas_empresa where id=p_factura_id and empresa_id=p_empresa_id and local_id=p_local_id for update;
  else
    perform 1 from public.albaranes_empresa where id=p_factura_id and empresa_id=p_empresa_id and local_id=p_local_id for update;
  end if;

  total_doc := private.pm06_total_factura(p_origen_factura,p_factura_id,p_empresa_id,p_local_id);
  if total_doc is null or total_doc <= 0 then raise exception 'factura_no_valida_o_no_autorizada'; end if;

  select coalesce(sum(case when estado='CONFIRMADO' then importe else -importe end),0)
    into pagado from public.pagos_factura
    where factura_id=p_factura_id and origen_factura=p_origen_factura and empresa_id=p_empresa_id and local_id=p_local_id;
  pendiente := round(total_doc - pagado,2);
  if pendiente <= 0 then raise exception 'factura_ya_pagada'; end if;
  if v_importe > pendiente then raise exception 'pago_supera_saldo'; end if;

  insert into public.pagos_factura(id,operation_id,factura_id,origen_factura,empresa_id,local_id,importe,fecha,estado,medio_pago,datos,actor_user_id)
  values(p_id,p_operation_id,p_factura_id,p_origen_factura,p_empresa_id,p_local_id,v_importe,v_fecha,'CONFIRMADO',p_medio_pago,v_datos,auth.uid())
  returning * into nuevo;

  return jsonb_build_object('ok',true,'replayed',false,'pago',to_jsonb(nuevo),'total',total_doc,'pagado',round(pagado+nuevo.importe,2),'pendiente',round(total_doc-pagado-nuevo.importe,2));
end;
$$;

create or replace function public.revertir_pago_factura(
  p_id text,
  p_operation_id text,
  p_pago_id text,
  p_motivo text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, auth, private, pg_temp
as $$
declare
  existente public.pagos_factura%rowtype;
  original public.pagos_factura%rowtype;
  previo public.pagos_factura%rowtype;
  nuevo public.pagos_factura%rowtype;
  v_motivo text;
begin
  if auth.uid() is null or not private.pm06_puede_gestionar_finanzas() then raise exception 'reverso_no_autorizado'; end if;
  if p_operation_id is null or btrim(p_operation_id)='' or p_id is null or btrim(p_id)='' then raise exception 'operation_id_requerido'; end if;
  v_motivo := coalesce(p_motivo,'');

  perform private.pm08_bloquear_operation_id(p_operation_id);

  select * into existente from public.pagos_factura where operation_id=p_operation_id;
  if found then
    if existente.id=p_id
       and existente.estado='REVERSO'
       and existente.revierte_pago_id=p_pago_id
       and coalesce(existente.datos->>'motivo','')=v_motivo then
      return jsonb_build_object('ok',true,'replayed',true,'pago',to_jsonb(existente));
    end if;
    raise exception 'operation_id_conflict';
  end if;

  select * into original from public.pagos_factura where id=p_pago_id and estado='CONFIRMADO' for update;
  if not found then raise exception 'pago_original_no_encontrado'; end if;
  if not private.la_tiene_empresa(original.empresa_id) or not private.la_tiene_local(original.empresa_id,original.local_id) then raise exception 'contexto_no_autorizado'; end if;

  select * into previo from public.pagos_factura where revierte_pago_id=p_pago_id and estado='REVERSO' limit 1;
  if found then raise exception 'pago_ya_revertido'; end if;

  insert into public.pagos_factura(id,operation_id,factura_id,origen_factura,empresa_id,local_id,importe,fecha,estado,revierte_pago_id,medio_pago,datos,actor_user_id)
  values(p_id,p_operation_id,original.factura_id,original.origen_factura,original.empresa_id,original.local_id,original.importe,current_date,'REVERSO',original.id,original.medio_pago,jsonb_build_object('motivo',v_motivo),auth.uid())
  returning * into nuevo;

  return jsonb_build_object('ok',true,'replayed',false,'pago',to_jsonb(nuevo));
end;
$$;
