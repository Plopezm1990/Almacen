-- ABC D10 — la devolución legacy no repone comida ya preparada o servida.

create or replace function private.abc_stock_guardar_devolucion_abc()
returns trigger
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_linea_id uuid;
  v_stock public.abc_stock_lineas%rowtype;
  v_linea public.pedido_lineas%rowtype;
begin
  if new.tipo<>'DEVOLUCION_CLIENTE'
     or new.ref_operation_id is null
     or new.ref_operation_id not like 'abc.stock.consume.%' then
    return new;
  end if;

  select nullif((payload->'datos'->>'linea_id'),'')::uuid
    into v_linea_id
    from public.stock_operaciones
   where operation_id=new.ref_operation_id;
  if v_linea_id is null then
    return new;
  end if;

  select * into v_stock
    from public.abc_stock_lineas
   where empresa_id=new.empresa_id and local_id=new.local_id and linea_id=v_linea_id
   for update;
  if not found then
    return new;
  end if;

  select * into v_linea
    from public.pedido_lineas
   where empresa_id=new.empresa_id and local_id=new.local_id and id=v_linea_id;
  if not found then
    return new;
  end if;

  if v_stock.estado in ('MERMA','REVERTIDA','CANCELADA') then
    raise exception 'devolucion_abc_no_recuperable';
  end if;
  if v_stock.estado='CONSUMIDA' and v_linea.estado<>'CONFIRMADA' then
    raise exception 'devolucion_abc_no_recuperable';
  end if;
  return new;
end $$;

create trigger abc_stock_guard_legacy_refund
before insert on public.stock_operaciones
for each row execute function private.abc_stock_guardar_devolucion_abc();

create or replace function private.abc_stock_marcar_devolucion_abc()
returns trigger
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_linea_id uuid;
begin
  if new.tipo<>'DEVOLUCION_CLIENTE'
     or new.ref_operation_id is null
     or new.ref_operation_id not like 'abc.stock.consume.%' then
    return new;
  end if;

  select nullif((payload->'datos'->>'linea_id'),'')::uuid
    into v_linea_id
    from public.stock_operaciones
   where operation_id=new.ref_operation_id;
  if v_linea_id is null then
    return new;
  end if;

  update public.abc_stock_lineas
     set estado='REVERTIDA',
         revert_operation_id=new.operation_id,
         motivo='DEVOLUCION_CLIENTE_RECUPERABLE',
         version=version+1,
         updated_at=now()
   where empresa_id=new.empresa_id
     and local_id=new.local_id
     and linea_id=v_linea_id
     and estado='CONSUMIDA';
  return new;
end $$;

create trigger abc_stock_mark_legacy_refund
after insert on public.stock_operaciones
for each row execute function private.abc_stock_marcar_devolucion_abc();
