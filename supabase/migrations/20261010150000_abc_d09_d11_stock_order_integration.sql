-- ABC D09-D11 — integración de pedidos, preparación, devoluciones y merma con stock.
-- QA primero. La integración es aditiva y conserva el libro PM07 como fuente del saldo.

do $$
begin
  if to_regclass('public.pedido_lineas') is null
     or to_regclass('public.stock_ubicacion') is null
     or to_regclass('public.stock_operaciones') is null
     or to_regclass('public.movimientos_stock') is null then
    raise exception 'ABC_D09_D11_PREFLIGHT_FALLO: faltan tablas base';
  end if;
end $$;

alter table public.stock_operaciones
  drop constraint if exists stock_operaciones_tipo_check;
alter table public.stock_operaciones
  add constraint stock_operaciones_tipo_check check (
    tipo in (
      'VENTA','REVERSO','TRASLADO_INTERNO','TRASLADO_ENTRE_LOCALES',
      'DEVOLUCION_CLIENTE','DEVOLUCION_PROVEEDOR','INVENTARIO_PM12',
      'MERMA_COMANDA'
    )
  );

alter table public.movimientos_stock
  drop constraint if exists movimientos_stock_tipo_check;
alter table public.movimientos_stock
  add constraint movimientos_stock_tipo_check check (
    tipo in (
      'VENTA','REVERSO','TRASLADO_INTERNO','TRASLADO_ENTRE_LOCALES',
      'DEVOLUCION_CLIENTE','DEVOLUCION_PROVEEDOR','INVENTARIO_PM12',
      'MERMA_COMANDA'
    )
  );

create table public.abc_stock_lineas (
  empresa_id text not null,
  local_id text not null,
  linea_id uuid not null,
  pedido_id uuid not null,
  producto_id text not null,
  modalidad text not null,
  cantidad numeric not null check (cantidad > 0),
  estado text not null,
  consume_operation_id text,
  revert_operation_id text,
  merma_operation_id text,
  motivo text,
  version bigint not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (empresa_id,local_id,linea_id),
  constraint abc_stock_linea_estado check (
    estado in ('RESERVADA','CONSUMIDA','REVERTIDA','MERMA','CANCELADA')
  ),
  constraint abc_stock_linea_linea_fk
    foreign key (empresa_id,local_id,linea_id)
    references public.pedido_lineas(empresa_id,local_id,id) on delete restrict,
  constraint abc_stock_linea_pedido_fk
    foreign key (empresa_id,local_id,pedido_id)
    references public.pedidos_tpv(empresa_id,local_id,id) on delete restrict
);

create index abc_stock_lineas_reservas_idx
  on public.abc_stock_lineas(empresa_id,local_id,producto_id,estado);

alter table public.abc_stock_lineas enable row level security;
revoke all on table public.abc_stock_lineas from public,anon,authenticated,service_role;
create policy abc_stock_lineas_select
  on public.abc_stock_lineas
  for select to authenticated
  using (private.la_tiene_local(empresa_id,local_id));
grant select on table public.abc_stock_lineas to authenticated;

create or replace function private.abc_stock_consumir_linea(
  p_linea public.pedido_lineas,
  p_modalidad text,
  p_motivo text
)
returns void
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_stock public.stock_ubicacion%rowtype;
  v_row public.abc_stock_lineas%rowtype;
  v_found boolean;
  v_op text := 'abc.stock.consume.'||p_linea.id::text;
begin
  select * into v_stock
    from public.stock_ubicacion
   where empresa_id=p_linea.empresa_id
     and local_id=p_linea.local_id
     and producto_id=p_linea.producto_id
   for update;
  if not found then
    return;
  end if;

  select * into v_row
    from public.abc_stock_lineas
   where empresa_id=p_linea.empresa_id
     and local_id=p_linea.local_id
     and linea_id=p_linea.id
   for update;
  v_found:=found;

  if v_found and v_row.estado in ('CONSUMIDA','MERMA','REVERTIDA','CANCELADA') then
    return;
  end if;

  perform public.registrar_venta_stock_pm09(
    v_op,
    p_linea.empresa_id,
    p_linea.local_id,
    p_linea.producto_id,
    p_linea.cantidad,
    p_linea.created_operating_day,
    jsonb_build_object(
      'origen','ABC_PEDIDO_LINEA',
      'linea_id',p_linea.id,
      'pedido_id',p_linea.pedido_id,
      'modalidad',upper(p_modalidad),
      'motivo',p_motivo
    )
  );

  if v_found then
    update public.abc_stock_lineas
       set estado='CONSUMIDA',
           consume_operation_id=v_op,
           motivo=p_motivo,
           version=version+1,
           updated_at=now()
     where empresa_id=p_linea.empresa_id
       and local_id=p_linea.local_id
       and linea_id=p_linea.id;
  else
    insert into public.abc_stock_lineas(
      empresa_id,local_id,linea_id,pedido_id,producto_id,modalidad,cantidad,
      estado,consume_operation_id,motivo
    ) values (
      p_linea.empresa_id,p_linea.local_id,p_linea.id,p_linea.pedido_id,
      p_linea.producto_id,upper(p_modalidad),p_linea.cantidad,
      'CONSUMIDA',v_op,p_motivo
    );
  end if;
end $$;

create or replace function private.abc_stock_reservar_linea(
  p_linea public.pedido_lineas,
  p_modalidad text
)
returns void
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_stock public.stock_ubicacion%rowtype;
  v_row public.abc_stock_lineas%rowtype;
  v_reservado numeric;
  v_found boolean;
begin
  select * into v_stock
    from public.stock_ubicacion
   where empresa_id=p_linea.empresa_id
     and local_id=p_linea.local_id
     and producto_id=p_linea.producto_id
   for update;
  if not found then
    return;
  end if;
  if not v_stock.local_operable then
    raise exception 'stock_local_no_operable';
  end if;

  select * into v_row
    from public.abc_stock_lineas
   where empresa_id=p_linea.empresa_id
     and local_id=p_linea.local_id
     and linea_id=p_linea.id
   for update;
  v_found:=found;
  if v_found and v_row.estado in ('RESERVADA','CONSUMIDA','MERMA','REVERTIDA','CANCELADA') then
    return;
  end if;

  select coalesce(sum(cantidad),0)
    into v_reservado
    from public.abc_stock_lineas
   where empresa_id=p_linea.empresa_id
     and local_id=p_linea.local_id
     and producto_id=p_linea.producto_id
     and estado='RESERVADA'
     and linea_id<>p_linea.id;

  if round(v_stock.almacen+v_stock.piso-v_reservado,6)<p_linea.cantidad then
    raise exception 'stock_reserva_insuficiente';
  end if;

  if v_found then
    update public.abc_stock_lineas
       set estado='RESERVADA',modalidad=upper(p_modalidad),cantidad=p_linea.cantidad,
           version=version+1,updated_at=now()
     where empresa_id=p_linea.empresa_id
       and local_id=p_linea.local_id
       and linea_id=p_linea.id;
  else
    insert into public.abc_stock_lineas(
      empresa_id,local_id,linea_id,pedido_id,producto_id,modalidad,cantidad,estado
    ) values (
      p_linea.empresa_id,p_linea.local_id,p_linea.id,p_linea.pedido_id,
      p_linea.producto_id,upper(p_modalidad),p_linea.cantidad,'RESERVADA'
    );
  end if;
end $$;

create or replace function private.abc_stock_revertir_linea(
  p_linea public.pedido_lineas,
  p_motivo text
)
returns void
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_row public.abc_stock_lineas%rowtype;
  v_original public.stock_operaciones%rowtype;
  v_stock public.stock_ubicacion%rowtype;
  v_reverse_op text := 'abc.stock.revert.'||p_linea.id::text;
  v_mov public.movimientos_stock%rowtype;
begin
  select * into v_row
    from public.abc_stock_lineas
   where empresa_id=p_linea.empresa_id and local_id=p_linea.local_id and linea_id=p_linea.id
   for update;
  if not found or v_row.estado<>'CONSUMIDA' or v_row.consume_operation_id is null then
    return;
  end if;

  select * into v_original
    from public.stock_operaciones
   where operation_id=v_row.consume_operation_id and tipo='VENTA'
   for update;
  if not found then raise exception 'stock_consumo_no_encontrado'; end if;

  if exists(
    select 1 from public.stock_operaciones
     where tipo='REVERSO' and ref_operation_id=v_row.consume_operation_id
  ) then
    update public.abc_stock_lineas
       set estado='REVERTIDA',revert_operation_id=v_reverse_op,
           motivo=p_motivo,version=version+1,updated_at=now()
     where empresa_id=p_linea.empresa_id and local_id=p_linea.local_id and linea_id=p_linea.id;
    return;
  end if;

  select * into v_stock
    from public.stock_ubicacion
   where empresa_id=p_linea.empresa_id and local_id=p_linea.local_id and producto_id=p_linea.producto_id
   for update;
  if not found then raise exception 'stock_no_configurado'; end if;

  insert into public.stock_operaciones(
    operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id,ref_operation_id
  ) values (
    v_reverse_op,'REVERSO',p_linea.empresa_id,p_linea.local_id,p_linea.producto_id,
    jsonb_build_object('origen','ABC_PEDIDO_LINEA','linea_id',p_linea.id,'motivo',p_motivo),
    auth.uid(),v_row.consume_operation_id
  );

  for v_mov in
    select * from public.movimientos_stock where operation_id=v_row.consume_operation_id order by id
  loop
    update public.stock_ubicacion
       set almacen=almacen-v_mov.delta_almacen,
           piso=piso-v_mov.delta_piso,
           updated_at=now()
     where empresa_id=p_linea.empresa_id and local_id=p_linea.local_id and producto_id=p_linea.producto_id;

    insert into public.movimientos_stock(
      operation_id,tipo,empresa_id,local_id,producto_id,
      delta_almacen,delta_piso,delta_total,cantidad,movimiento_original_id,datos,actor_user_id
    ) values (
      v_reverse_op,'REVERSO',p_linea.empresa_id,p_linea.local_id,p_linea.producto_id,
      -v_mov.delta_almacen,-v_mov.delta_piso,-v_mov.delta_total,v_mov.cantidad,
      v_mov.id,jsonb_build_object('origen','ABC_PEDIDO_LINEA','linea_id',p_linea.id,'motivo',p_motivo),auth.uid()
    );
  end loop;

  update public.abc_stock_lineas
     set estado='REVERTIDA',revert_operation_id=v_reverse_op,
         motivo=p_motivo,version=version+1,updated_at=now()
   where empresa_id=p_linea.empresa_id and local_id=p_linea.local_id and linea_id=p_linea.id;
end $$;

create or replace function private.abc_stock_registrar_merma_linea(
  p_linea public.pedido_lineas,
  p_motivo text
)
returns void
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_row public.abc_stock_lineas%rowtype;
  v_merma_op text := 'abc.stock.merma.'||p_linea.id::text;
begin
  select * into v_row
    from public.abc_stock_lineas
   where empresa_id=p_linea.empresa_id and local_id=p_linea.local_id and linea_id=p_linea.id
   for update;
  if not found or v_row.estado in ('MERMA','REVERTIDA','CANCELADA') then
    return;
  end if;
  if v_row.estado<>'CONSUMIDA' then
    update public.abc_stock_lineas
       set estado='CANCELADA',motivo=p_motivo,version=version+1,updated_at=now()
     where empresa_id=p_linea.empresa_id and local_id=p_linea.local_id and linea_id=p_linea.id;
    return;
  end if;

  insert into public.stock_operaciones(
    operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id,ref_operation_id
  ) values (
    v_merma_op,'MERMA_COMANDA',p_linea.empresa_id,p_linea.local_id,p_linea.producto_id,
    jsonb_build_object('origen','ABC_COMANDA','linea_id',p_linea.id,'motivo',p_motivo),
    auth.uid(),v_row.consume_operation_id
  ) on conflict (operation_id) do nothing;

  insert into public.movimientos_stock(
    operation_id,tipo,empresa_id,local_id,producto_id,
    delta_almacen,delta_piso,delta_total,cantidad,datos,actor_user_id
  ) values (
    v_merma_op,'MERMA_COMANDA',p_linea.empresa_id,p_linea.local_id,p_linea.producto_id,
    0,0,0,p_linea.cantidad,
    jsonb_build_object('origen','ABC_COMANDA','linea_id',p_linea.id,'motivo',p_motivo),auth.uid()
  ) on conflict do nothing;

  update public.abc_stock_lineas
     set estado='MERMA',merma_operation_id=v_merma_op,motivo=p_motivo,
         version=version+1,updated_at=now()
   where empresa_id=p_linea.empresa_id and local_id=p_linea.local_id and linea_id=p_linea.id;
end $$;

create or replace function private.abc_stock_sync_pedido_linea(
  p_linea public.pedido_lineas,
  p_old_estado text
)
returns void
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_modalidad text;
  v_row public.abc_stock_lineas%rowtype;
begin
  select upper(c.modalidad)
    into v_modalidad
    from public.pedidos_tpv p
    join public.cuentas_comerciales c
      on c.empresa_id=p.empresa_id and c.local_id=p.local_id and c.id=p.cuenta_id
   where p.empresa_id=p_linea.empresa_id and p.local_id=p_linea.local_id and p.id=p_linea.pedido_id;
  if v_modalidad is null then return; end if;

  if p_linea.estado='CONFIRMADA' and p_old_estado is distinct from p_linea.estado then
    if v_modalidad in ('BARRA','TAKEAWAY') then
      perform private.abc_stock_consumir_linea(p_linea,v_modalidad,'CONFIRMACION_VENTA');
    elsif v_modalidad in ('MESA','TERRAZA') then
      perform private.abc_stock_reservar_linea(p_linea,v_modalidad);
    end if;
    return;
  end if;

  if p_linea.estado in ('EN_PREPARACION','SERVIDA') and p_old_estado is distinct from p_linea.estado then
    perform private.abc_stock_consumir_linea(p_linea,v_modalidad,'INICIO_PREPARACION');
    return;
  end if;

  if p_linea.estado='CANCELADA' and p_old_estado is distinct from p_linea.estado then
    select * into v_row
      from public.abc_stock_lineas
     where empresa_id=p_linea.empresa_id and local_id=p_linea.local_id and linea_id=p_linea.id
     for update;
    if not found then return; end if;
    if v_row.estado='RESERVADA' then
      update public.abc_stock_lineas
         set estado='CANCELADA',motivo='CANCELACION_ANTES_DE_PREPARAR',version=version+1,updated_at=now()
       where empresa_id=p_linea.empresa_id and local_id=p_linea.local_id and linea_id=p_linea.id;
    elsif v_row.estado='CONSUMIDA' and p_old_estado='CONFIRMADA'
      and v_modalidad in ('BARRA','TAKEAWAY') then
      perform private.abc_stock_revertir_linea(p_linea,'CANCELACION_RECUPERABLE');
    elsif v_row.estado='CONSUMIDA' then
      perform private.abc_stock_registrar_merma_linea(p_linea,'CANCELACION_TRAS_PREPARACION');
    end if;
  end if;
end $$;

create or replace function private.abc_stock_pedido_linea_trigger()
returns trigger
language plpgsql
volatile
security definer
set search_path=''
as $$
begin
  if tg_op='INSERT' then
    perform private.abc_stock_sync_pedido_linea(new,null);
  elsif new.estado is distinct from old.estado then
    perform private.abc_stock_sync_pedido_linea(new,old.estado);
  end if;
  return new;
end $$;

create trigger abc_stock_pedido_linea_sync
after insert or update of estado on public.pedido_lineas
for each row execute function private.abc_stock_pedido_linea_trigger();

create or replace function private.abc_stock_comanda_merma_trigger()
returns trigger
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_linea public.pedido_lineas%rowtype;
begin
  if new.decision_merma='MERMA_CONFIRMADA'
     and (tg_op='INSERT' or old.decision_merma is distinct from new.decision_merma) then
    select * into v_linea
      from public.pedido_lineas
     where empresa_id=new.empresa_id and local_id=new.local_id and id=new.linea_id;
    if found then
      perform private.abc_stock_registrar_merma_linea(v_linea,'MERMA_COCINA_CONFIRMADA');
    end if;
  end if;
  return new;
end $$;

create trigger abc_stock_comanda_merma_sync
after insert or update of decision_merma on public.comanda_lineas
for each row execute function private.abc_stock_comanda_merma_trigger();

comment on table public.abc_stock_lineas is
  'Estado de reserva, consumo, reverso y merma por línea de pedido ABC (D09-D11).';
