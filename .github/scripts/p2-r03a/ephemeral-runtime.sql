\set ON_ERROR_STOP on

-- P2-R03A: entorno PostgreSQL 16 efímero. No usa Supabase QA/PROD.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema private;

grant usage on schema public, auth, private to authenticated;
grant usage on schema public, auth, private to anon;

create table private.test_memberships (
  user_id uuid not null,
  empresa_id text not null,
  local_id text not null,
  rol text not null,
  activo boolean not null default true,
  primary key(user_id,empresa_id,local_id)
);

create or replace function auth.uid() returns uuid
language sql stable set search_path=''
as $$ select nullif(current_setting('app.current_uid',true),'')::uuid $$;
grant execute on function auth.uid() to authenticated, anon;

create or replace function private.la_usuario_activo() returns boolean
language sql stable security definer set search_path=''
as $$ select exists(select 1 from private.test_memberships m where m.user_id=auth.uid() and m.activo) $$;
create or replace function private.la_rol() returns text
language sql stable security definer set search_path=''
as $$ select m.rol from private.test_memberships m where m.user_id=auth.uid() and m.activo order by m.empresa_id,m.local_id limit 1 $$;
create or replace function private.la_tiene_empresa(p_empresa text) returns boolean
language sql stable security definer set search_path=''
as $$ select exists(select 1 from private.test_memberships m where m.user_id=auth.uid() and m.empresa_id=p_empresa and m.activo) $$;
create or replace function private.la_tiene_local(p_empresa text,p_local text) returns boolean
language sql stable security definer set search_path=''
as $$ select exists(select 1 from private.test_memberships m where m.user_id=auth.uid() and m.empresa_id=p_empresa and m.local_id=p_local and m.activo) $$;

grant execute on function private.la_tiene_empresa(text) to authenticated;
grant execute on function private.la_tiene_local(text,text) to authenticated;
grant execute on function private.la_usuario_activo() to authenticated;
grant execute on function private.la_rol() to authenticated;

create table public.stock_ubicacion (
  empresa_id text not null,
  local_id text not null,
  producto_id text not null,
  almacen numeric(18,6) not null default 0,
  piso numeric(18,6) not null default 0,
  local_operable boolean not null default true,
  fraccionable boolean not null default false,
  precision_cantidad smallint not null default 0,
  updated_at timestamptz not null default now(),
  primary key(empresa_id,local_id,producto_id)
);

create table public.stock_operaciones (
  operation_id text primary key,
  tipo text not null,
  empresa_id text not null,
  local_id text not null,
  producto_id text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_user_id uuid not null,
  ref_operation_id text,
  created_at timestamptz not null default now()
);

create table public.movimientos_stock (
  id bigserial primary key,
  operation_id text not null,
  tipo text not null,
  empresa_id text not null,
  local_id text not null,
  producto_id text not null,
  delta_almacen numeric(18,6) not null default 0,
  delta_piso numeric(18,6) not null default 0,
  delta_total numeric(18,6) not null default 0,
  cantidad numeric(18,6) not null,
  movimiento_original_id bigint,
  datos jsonb not null default '{}'::jsonb,
  actor_user_id uuid not null,
  created_at timestamptz not null default now()
);

create table private.g1_operation_ids_global (
  operation_id text primary key,
  ledger text not null,
  created_at timestamptz not null default now()
);

create or replace function private.g1_claim_operation_id() returns trigger
language plpgsql security definer set search_path=''
as $$
declare v_ledger text;
begin
  if new.operation_id is null or btrim(new.operation_id)='' then raise exception 'operation_id_requerido'; end if;
  insert into private.g1_operation_ids_global(operation_id,ledger)
  values(new.operation_id,tg_table_name) on conflict(operation_id) do nothing;
  select g.ledger into v_ledger from private.g1_operation_ids_global g where g.operation_id=new.operation_id;
  if v_ledger is distinct from tg_table_name then raise exception 'operation_id_conflict'; end if;
  return new;
end;
$$;
create trigger g1_operation_id_global before insert on public.stock_operaciones
for each row execute function private.g1_claim_operation_id();

create or replace function private.pm08_validar_operation_id(p_operation_id text) returns text
language plpgsql immutable set search_path=''
as $$ declare v text:=btrim(coalesce(p_operation_id,'')); begin
  if v !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$' then raise exception 'operation_id_invalido'; end if;
  return v;
end $$;
create or replace function private.pm08_bloquear_operation_id(p_operation_id text) returns void
language plpgsql volatile set search_path=''
as $$ begin perform pg_advisory_xact_lock(hashtextextended('la-suite-pm08:'||p_operation_id,0)); end $$;
create or replace function private.pm08_validar_dinero(p_importe numeric,p_permite_cero boolean default false,p_permite_negativo boolean default false) returns numeric
language plpgsql immutable set search_path=''
as $$ declare v numeric; begin
  if p_importe is null or p_importe::text in ('NaN','Infinity','-Infinity') then raise exception 'importe_invalido'; end if;
  if abs(p_importe)>999999999999.99 then raise exception 'importe_fuera_rango'; end if;
  if not p_permite_negativo and p_importe<0 then raise exception 'importe_negativo'; end if;
  if not p_permite_cero and p_importe=0 then raise exception 'importe_cero'; end if;
  v:=round(p_importe,2); if v<>p_importe then raise exception 'importe_precision_invalida'; end if; return v;
end $$;
create or replace function private.pm07_validar_cantidad(p_cantidad numeric,p_fraccionable boolean,p_precision smallint) returns numeric
language plpgsql immutable set search_path=''
as $$ declare v numeric; begin
  if p_cantidad is null or p_cantidad<=0 then raise exception 'cantidad_invalida'; end if;
  v:=round(p_cantidad,coalesce(p_precision,0));
  if v<>p_cantidad then raise exception 'cantidad_precision_invalida'; end if;
  if not coalesce(p_fraccionable,false) and v<>trunc(v) then raise exception 'cantidad_indivisible'; end if;
  return v;
end $$;
create or replace function private.pm07_puede_gestionar_stock() returns boolean
language sql stable security definer set search_path=''
as $$ select private.la_usuario_activo() and coalesce(private.la_rol(),'') in ('Propietario','Encargado') $$;
create or replace function private.pm08_puede_operar_caja() returns boolean
language sql stable security definer set search_path=''
as $$ select private.la_usuario_activo() and coalesce(private.la_rol(),'') in ('Propietario','Encargado','Cajero/a') $$;
create or replace function private.pm08_local_operable(p_empresa_id text,p_local_id text) returns boolean
language sql stable security definer set search_path=''
as $$ select private.la_tiene_local(p_empresa_id,p_local_id) and not exists(
  select 1 from public.stock_ubicacion s where s.empresa_id=p_empresa_id and s.local_id=p_local_id and not s.local_operable
) $$;
create or replace function private.pm09_bloquear_operation_id_stock(p_operation_id text) returns text
language plpgsql security definer set search_path=''
as $$ declare v text; v_ledger text; begin
  v:=private.pm08_validar_operation_id(p_operation_id);
  perform private.pm08_bloquear_operation_id(v);
  select g.ledger into v_ledger from private.g1_operation_ids_global g where g.operation_id=v;
  if found and v_ledger<>'stock_operaciones' then raise exception 'operation_id_conflict'; end if;
  return v;
end $$;

-- Motor C24 mínimo fiel a las invariantes que P2-R03A consume.
create or replace function public.registrar_venta_stock_carrito(
  p_operation_id text,p_empresa_id text,p_local_id text,p_lineas jsonb,p_datos jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_op text; rec record; s public.stock_ubicacion%rowtype; cant numeric; movs jsonb;
begin
  if auth.uid() is null or not private.pm07_puede_gestionar_stock() then raise exception 'stock_no_autorizado'; end if;
  if not private.la_tiene_empresa(p_empresa_id) or not private.la_tiene_local(p_empresa_id,p_local_id) then raise exception 'contexto_no_autorizado'; end if;
  v_op:=private.pm09_bloquear_operation_id_stock(p_operation_id);
  if exists(select 1 from public.stock_operaciones where operation_id=v_op) then
    if exists(select 1 from public.stock_operaciones where operation_id=v_op and tipo='VENTA') then
      select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) into movs from public.movimientos_stock m where m.operation_id=v_op;
      return jsonb_build_object('ok',true,'replayed',true,'movimientos',movs);
    end if;
    raise exception 'operation_id_conflict';
  end if;
  if p_lineas is null or jsonb_typeof(p_lineas)<>'array' or jsonb_array_length(p_lineas)=0 then raise exception 'carrito_vacio'; end if;
  for rec in select elem from jsonb_array_elements(p_lineas) elem loop
    select * into s from public.stock_ubicacion where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=coalesce(rec.elem->>'productoId',rec.elem->>'producto_id') for update;
    if not found then raise exception 'stock_no_configurado'; end if;
    cant:=private.pm07_validar_cantidad((rec.elem->>'cantidad')::numeric,s.fraccionable,s.precision_cantidad);
    if s.almacen+s.piso<cant then raise exception 'stock_insuficiente'; end if;
  end loop;
  insert into public.stock_operaciones(operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id)
  values(v_op,'VENTA',p_empresa_id,p_local_id,'__CARRITO__',jsonb_build_object('lineas',p_lineas,'datos',p_datos),auth.uid());
  for rec in select elem from jsonb_array_elements(p_lineas) elem loop
    select * into s from public.stock_ubicacion where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=coalesce(rec.elem->>'productoId',rec.elem->>'producto_id') for update;
    cant:=private.pm07_validar_cantidad((rec.elem->>'cantidad')::numeric,s.fraccionable,s.precision_cantidad);
    update public.stock_ubicacion set piso=piso-cant,updated_at=now() where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=s.producto_id;
    insert into public.movimientos_stock(operation_id,tipo,empresa_id,local_id,producto_id,delta_almacen,delta_piso,delta_total,cantidad,datos,actor_user_id)
    values(v_op,'VENTA',p_empresa_id,p_local_id,s.producto_id,0,-cant,-cant,cant,rec.elem,auth.uid());
  end loop;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) into movs from public.movimientos_stock m where m.operation_id=v_op;
  return jsonb_build_object('ok',true,'replayed',false,'movimientos',movs);
end $$;

-- Simula que las RPC legacy existían y estaban abiertas antes de P2-R02.
create function public.anular_venta_tpv(text,text) returns void language sql as $$ select $$;
create function public.descontar_stock(text,numeric,text,jsonb) returns void language sql as $$ select $$;
create function public.descontar_stock_carrito(jsonb,text) returns void language sql as $$ select $$;
grant execute on function public.anular_venta_tpv(text,text) to anon,authenticated;
grant execute on function public.descontar_stock(text,numeric,text,jsonb) to anon,authenticated;
grant execute on function public.descontar_stock_carrito(jsonb,text) to anon,authenticated;

-- Aplica el candidato real en PostgreSQL efímero.
\ir ../../supabase/migrations/20260916195500_p2_r03a_restore_pm08_pm09_post_reset.sql

create or replace function private.test_assert(p_ok boolean,p_msg text) returns void
language plpgsql as $$ begin if not coalesce(p_ok,false) then raise exception 'TEST_FAIL:%',p_msg; end if; end $$;

insert into private.test_memberships(user_id,empresa_id,local_id,rol) values
('11111111-1111-1111-1111-111111111111','e1','l1','Propietario'),
('22222222-2222-2222-2222-222222222222','e2','l2','Propietario');
insert into public.stock_ubicacion(empresa_id,local_id,producto_id,almacen,piso,local_operable,fraccionable,precision_cantidad) values
('e1','l1','p1',0,100,true,false,0),('e2','l2','p1',0,100,true,false,0);
select set_config('app.current_uid','11111111-1111-1111-1111-111111111111',false);

-- Venta + replay.
do $$ declare r1 jsonb; r2 jsonb; v numeric; begin
  r1:=public.registrar_venta_stock_carrito_pm09('sale.replay.001','e1','l1','[{"productoId":"p1","cantidad":2,"ingresoUnitario":10,"ivaVentaAplicado":0,"medioPago":"EFECTIVO"}]'::jsonb,date '2026-09-16','{}');
  r2:=public.registrar_venta_stock_carrito_pm09('sale.replay.001','e1','l1','[{"productoId":"p1","cantidad":2,"ingresoUnitario":10,"ivaVentaAplicado":0,"medioPago":"EFECTIVO"}]'::jsonb,date '2026-09-16','{}');
  select piso into v from public.stock_ubicacion where empresa_id='e1' and local_id='l1' and producto_id='p1';
  perform private.test_assert(coalesce((r1->>'replayed')::boolean,false)=false,'venta inicial no marcada nueva');
  perform private.test_assert(coalesce((r2->>'replayed')::boolean,false)=true,'replay venta no detectado');
  perform private.test_assert(v=98,'replay duplicó descuento de stock');
end $$;

-- Anulación completa + replay.
do $$ declare before_v numeric; after_v numeric; r2 jsonb; begin
  select piso into before_v from public.stock_ubicacion where empresa_id='e1' and local_id='l1' and producto_id='p1';
  perform public.registrar_venta_stock_carrito_pm09('sale.cancel.001','e1','l1','[{"productoId":"p1","cantidad":3,"ingresoUnitario":7,"ivaVentaAplicado":0,"medioPago":"EFECTIVO"}]'::jsonb,date '2026-09-16','{}');
  perform public.revertir_venta_stock_carrito_pm09('cancel.sale.001','sale.cancel.001',date '2026-09-16','prueba');
  r2:=public.revertir_venta_stock_carrito_pm09('cancel.sale.001','sale.cancel.001',date '2026-09-16','prueba');
  select piso into after_v from public.stock_ubicacion where empresa_id='e1' and local_id='l1' and producto_id='p1';
  perform private.test_assert(after_v=before_v,'anulación no restauró stock');
  perform private.test_assert(coalesce((r2->>'replayed')::boolean,false)=true,'replay anulación no detectado');
end $$;

-- Devolución sin reembolso + replay.
do $$ declare b numeric; a numeric; r2 jsonb; begin
  perform public.registrar_venta_stock_carrito_pm09('sale.norefund.001','e1','l1','[{"productoId":"p1","cantidad":2,"ingresoUnitario":10,"ivaVentaAplicado":0,"medioPago":"EFECTIVO"}]'::jsonb,date '2026-09-16','{}');
  select piso into b from public.stock_ubicacion where empresa_id='e1' and local_id='l1' and producto_id='p1';
  perform public.registrar_devolucion_venta_pm09('return.norefund.001','sale.norefund.001','e1','l1','p1',1,0,'SIN_REEMBOLSO','prueba',date '2026-09-16','{}');
  r2:=public.registrar_devolucion_venta_pm09('return.norefund.001','sale.norefund.001','e1','l1','p1',1,0,'SIN_REEMBOLSO','prueba',date '2026-09-16','{}');
  select piso into a from public.stock_ubicacion where empresa_id='e1' and local_id='l1' and producto_id='p1';
  perform private.test_assert(a=b+1,'devolución sin reembolso no repuso una unidad');
  perform private.test_assert((select caja_operation_id is null from public.devoluciones_venta where operation_id='return.norefund.001'),'devolución sin reembolso creó caja');
  perform private.test_assert(coalesce((r2->>'replayed')::boolean,false)=true,'replay devolución sin reembolso no detectado');
end $$;

-- Reembolso efectivo: ID de caja separado, efecto efectivo e idempotencia.
do $$ declare cid text; r2 jsonb; begin
  perform public.registrar_venta_stock_carrito_pm09('sale.cash.001','e1','l1','[{"productoId":"p1","cantidad":1,"ingresoUnitario":10,"ivaVentaAplicado":0,"medioPago":"EFECTIVO"}]'::jsonb,date '2026-09-16','{}');
  perform public.registrar_devolucion_venta_pm09('return.cash.001','sale.cash.001','e1','l1','p1',1,10,'EFECTIVO','prueba',date '2026-09-16','{}');
  r2:=public.registrar_devolucion_venta_pm09('return.cash.001','sale.cash.001','e1','l1','p1',1,10,'EFECTIVO','prueba',date '2026-09-16','{}');
  select caja_operation_id into cid from public.devoluciones_venta where operation_id='return.cash.001';
  perform private.test_assert(cid='refund:'||md5('return.cash.001'),'ID caja reembolso no determinista');
  perform private.test_assert(cid<>'return.cash.001','ID caja colisiona con ledger stock');
  perform private.test_assert((select efecto_efectivo=-10 from public.caja_operaciones where operation_id=cid),'reembolso efectivo no resta caja');
  perform private.test_assert((select count(*)=2 from private.g1_operation_ids_global where operation_id in ('return.cash.001',cid)),'ledger global no separa stock/caja');
  perform private.test_assert(coalesce((r2->>'replayed')::boolean,false)=true,'replay reembolso efectivo no detectado');
end $$;

-- Reembolso tarjeta: caja trazable sin alterar efectivo.
do $$ declare cid text; begin
  perform public.registrar_venta_stock_carrito_pm09('sale.card.001','e1','l1','[{"productoId":"p1","cantidad":1,"ingresoUnitario":12,"ivaVentaAplicado":0,"medioPago":"TARJETA"}]'::jsonb,date '2026-09-16','{}');
  perform public.registrar_devolucion_venta_pm09('return.card.001','sale.card.001','e1','l1','p1',1,12,'TARJETA','prueba',date '2026-09-16','{}');
  select caja_operation_id into cid from public.devoluciones_venta where operation_id='return.card.001';
  perform private.test_assert((select efecto_efectivo=0 and medio_pago='TARJETA' from public.caja_operaciones where operation_id=cid),'reembolso tarjeta alteró efectivo');
end $$;

-- Colisión global: un ID ya reclamado por Caja no puede usarse en Stock.
select public.registrar_movimiento_caja('collision.001','e1','l1',date '2026-09-18','ENTRADA',5,'colisión','{}');
do $$ begin
  begin
    perform public.registrar_venta_stock_carrito_pm09('collision.001','e1','l1','[{"productoId":"p1","cantidad":1,"ingresoUnitario":1,"ivaVentaAplicado":0,"medioPago":"EFECTIVO"}]'::jsonb,date '2026-09-18','{}');
    raise exception 'TEST_FAIL: colisión global aceptada';
  exception when others then
    if position('operation_id_conflict' in sqlerrm)=0 then raise; end if;
  end;
end $$;

-- Aislamiento RPC multiempresa.
do $$ begin
  begin
    perform public.registrar_movimiento_caja('tenant.fail.001','e2','l2',date '2026-09-18','ENTRADA',5,'fuera tenant','{}');
    raise exception 'TEST_FAIL: RPC cruzó tenant';
  exception when others then
    if position('contexto_no_autorizado' in sqlerrm)=0 then raise; end if;
  end;
end $$;

-- Crear dato del tenant 2 y verificar RLS real como authenticated del tenant 1.
select set_config('app.current_uid','22222222-2222-2222-2222-222222222222',false);
select public.registrar_movimiento_caja('tenant.two.001','e2','l2',date '2026-09-18','ENTRADA',7,'tenant2','{}');
set role authenticated;
select set_config('app.current_uid','11111111-1111-1111-1111-111111111111',false);
select case when not exists(select 1 from public.caja_operaciones where empresa_id='e2') then 1 else 1/0 end as rls_tenant_ok;
reset role;
select set_config('app.current_uid','11111111-1111-1111-1111-111111111111',false);

-- Caja + arqueo + cierre de periodo + anulación.
select public.registrar_movimiento_caja('cash.entry.001','e1','l1',date '2026-09-19','ENTRADA',20,'entrada','{}');
select public.registrar_movimiento_caja('cash.entry.001','e1','l1',date '2026-09-19','ENTRADA',20,'entrada','{}');
select public.registrar_arqueo_caja('arqueo.day.001','e1','l1',date '2026-09-19',0,20,'cierre','{}');
do $$ begin
  begin
    perform public.registrar_movimiento_caja('cash.afterclose.001','e1','l1',date '2026-09-19','ENTRADA',1,'debe fallar','{}');
    raise exception 'TEST_FAIL: caja permitió movimiento tras arqueo';
  exception when others then if position('periodo_caja_cerrado' in sqlerrm)=0 then raise; end if; end;
end $$;
select public.anular_arqueo_caja('arqueo.undo.001','arqueo.day.001','corrección');
select public.anular_arqueo_caja('arqueo.undo.001','arqueo.day.001','corrección');

-- Atomicidad: fallo forzado en pata de Caja debe revertir stock, movimiento, devolución y ledger global.
select public.registrar_venta_stock_carrito_pm09('sale.rollback.001','e1','l1','[{"productoId":"p1","cantidad":1,"ingresoUnitario":9,"ivaVentaAplicado":0,"medioPago":"EFECTIVO"}]'::jsonb,date '2026-09-20','{}');
create or replace function private.test_fail_refund() returns trigger language plpgsql as $$ begin if new.tipo='REEMBOLSO' then raise exception 'TEST_CAJA_FALLO'; end if; return new; end $$;
create trigger test_fail_refund before insert on public.caja_operaciones for each row execute function private.test_fail_refund();
do $$ declare before_v numeric; after_v numeric; begin
  select piso into before_v from public.stock_ubicacion where empresa_id='e1' and local_id='l1' and producto_id='p1';
  begin
    perform public.registrar_devolucion_venta_pm09('return.rollback.001','sale.rollback.001','e1','l1','p1',1,9,'EFECTIVO','fallo caja',date '2026-09-20','{}');
    raise exception 'TEST_FAIL: devolución debía fallar';
  exception when others then if position('TEST_CAJA_FALLO' in sqlerrm)=0 then raise; end if; end;
  select piso into after_v from public.stock_ubicacion where empresa_id='e1' and local_id='l1' and producto_id='p1';
  perform private.test_assert(after_v=before_v,'rollback no restauró stock');
  perform private.test_assert(not exists(select 1 from public.stock_operaciones where operation_id='return.rollback.001'),'rollback dejó stock_operaciones');
  perform private.test_assert(not exists(select 1 from public.movimientos_stock where operation_id='return.rollback.001'),'rollback dejó movimiento_stock');
  perform private.test_assert(not exists(select 1 from public.devoluciones_venta where operation_id='return.rollback.001'),'rollback dejó devolución');
  perform private.test_assert(not exists(select 1 from private.g1_operation_ids_global where operation_id in ('return.rollback.001','refund:'||md5('return.rollback.001'))),'rollback dejó operation_id global');
end $$;
drop trigger test_fail_refund on public.caja_operaciones;
drop function private.test_fail_refund();

-- Privilegios: nuevas RPC sólo authenticated; legacy continúa cerrado incluso partiendo abierto.
do $$ begin
  perform private.test_assert(has_function_privilege('authenticated','public.registrar_movimiento_caja(text,text,text,date,text,numeric,text,jsonb)','EXECUTE'),'authenticated sin RPC caja');
  perform private.test_assert(not has_function_privilege('anon','public.registrar_movimiento_caja(text,text,text,date,text,numeric,text,jsonb)','EXECUTE'),'anon conserva RPC caja');
  perform private.test_assert(not has_function_privilege('authenticated','public.anular_venta_tpv(text,text)','EXECUTE'),'legacy anular_venta_tpv reabierta');
  perform private.test_assert(not has_function_privilege('authenticated','public.descontar_stock(text,numeric,text,jsonb)','EXECUTE'),'legacy descontar_stock reabierta');
  perform private.test_assert(not has_function_privilege('authenticated','public.descontar_stock_carrito(jsonb,text)','EXECUTE'),'legacy descontar_stock_carrito reabierta');
end $$;

select 'P2-R03A ephemeral runtime: OK' as resultado;
