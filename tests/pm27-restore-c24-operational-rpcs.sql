\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema private;

create function auth.uid() returns uuid
language sql stable
as $$ select '11111111-1111-1111-1111-111111111111'::uuid $$;

create table public.stock_ubicacion (
  empresa_id text not null,
  local_id text not null,
  producto_id text not null,
  almacen numeric not null default 0,
  piso numeric not null default 0,
  fraccionable boolean not null default true,
  precision_cantidad smallint not null default 2,
  local_operable boolean not null default true,
  unidad text not null default 'ud',
  updated_at timestamptz not null default now(),
  primary key (empresa_id,local_id,producto_id)
);

create table public.stock_operaciones (
  operation_id text primary key,
  tipo text not null,
  empresa_id text not null,
  local_id text not null,
  producto_id text not null,
  payload jsonb not null,
  actor_user_id uuid
);

create table public.movimientos_stock (
  id bigserial primary key,
  operation_id text not null,
  tipo text not null,
  empresa_id text not null,
  local_id text not null,
  producto_id text not null,
  delta_almacen numeric not null,
  delta_piso numeric not null,
  delta_total numeric not null,
  cantidad numeric not null,
  datos jsonb not null default '{}'::jsonb,
  actor_user_id uuid
);

create table public.clientes_empresa (
  id text primary key,
  empresa_id text not null,
  datos jsonb not null default '{}'::jsonb
);

create table public.encargos_empresa (
  id text primary key,
  empresa_id text not null,
  local_id text not null,
  cliente_id text,
  datos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pagos_encargo (
  id text primary key,
  encargo_id text not null,
  empresa_id text not null,
  local_id text not null,
  estado text not null,
  importe numeric not null
);

grant select on public.encargos_empresa to authenticated;

create function private.pm09_bloquear_operation_id_stock(p text) returns text
language plpgsql as $$ begin if p is null or btrim(p)='' then raise exception 'operation_id_requerido'; end if; return btrim(p); end $$;
create function private.pm07_puede_vender() returns boolean language sql stable as $$ select true $$;
create function private.pm07_validar_cantidad(p numeric,f boolean,prec smallint) returns numeric language sql immutable as $$ select p $$;
create function private.pm07_puede_gestionar_stock() returns boolean language sql stable as $$ select true $$;
create function private.la_tiene_empresa(p text) returns boolean language sql stable as $$ select true $$;
create function private.la_tiene_local(e text,l text) returns boolean language sql stable as $$ select true $$;
create function private.pm08_puede_operar_caja() returns boolean language sql stable as $$ select true $$;
create function private.pm08_local_operable(e text,l text) returns boolean language sql stable as $$ select true $$;
create function private.pm08_validar_dinero(p numeric,c boolean,n boolean) returns numeric language sql immutable as $$ select round(p,2) $$;

create function public.registrar_venta_stock(text,text,text,text,numeric,jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='public','auth','private','pg_temp'
as $$ begin raise exception 'pm27_reconciliacion_pendiente_c24'; end $$;
create function public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='public','auth','private','pg_temp'
as $$ begin raise exception 'pm27_reconciliacion_pendiente_c24'; end $$;
create function public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='public','auth','private','pg_temp'
as $$ begin raise exception 'pm27_reconciliacion_pendiente_c24'; end $$;
create function public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='public','auth','private','pg_temp'
as $$ begin raise exception 'pm27_reconciliacion_pendiente_c24'; end $$;
create function public.registrar_encargo(text,text,text,text,numeric,text default 'Pendiente',jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='public','auth','private','pg_temp'
as $$ begin raise exception 'pm27_reconciliacion_pendiente_c24'; end $$;

revoke all on function public.registrar_venta_stock(text,text,text,text,numeric,jsonb) from public,anon,authenticated;
revoke all on function public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb) from public,anon,authenticated;
revoke all on function public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb) from public,anon,authenticated;
revoke all on function public.registrar_encargo(text,text,text,text,numeric,text,jsonb) from public,anon,authenticated;
grant execute on function public.registrar_venta_stock(text,text,text,text,numeric,jsonb) to authenticated;
grant execute on function public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb) to authenticated;
grant execute on function public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb) to authenticated;
grant execute on function public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb) to authenticated;
grant execute on function public.registrar_encargo(text,text,text,text,numeric,text,jsonb) to authenticated;

\i supabase/migrations/20260915152000_pm27_restore_c24_operational_rpcs.sql

-- Datos efimeros para smoke transaccional de las cinco RPC restauradas.
insert into public.stock_ubicacion(empresa_id,local_id,producto_id,almacen,piso,fraccionable,precision_cantidad,local_operable,unidad)
values
  ('e1','l1','p1',10,2,true,2,true,'ud'),
  ('e1','l1','p2',8,1,true,2,true,'ud'),
  ('e1','l2','p3',4,0,true,2,true,'ud');
insert into public.clientes_empresa(id,empresa_id,datos) values ('c1','e1','{}');

do $behavior$
declare
  j jsonb;
  a numeric;
  p numeric;
  n bigint;
begin
  j := public.registrar_venta_stock('op-sale','e1','l1','p1',3,'{"ticket":"A"}'::jsonb);
  if coalesce((j->>'ok')::boolean,false) is not true or coalesce((j->>'replayed')::boolean,true) is not false then
    raise exception 'SMOKE_FALLO: venta inicial';
  end if;
  select almacen,piso into a,p from public.stock_ubicacion where empresa_id='e1' and local_id='l1' and producto_id='p1';
  if a <> 9 or p <> 0 then raise exception 'SMOKE_FALLO: saldo venta %, %',a,p; end if;

  j := public.registrar_venta_stock('op-sale','e1','l1','p1',3,'{"ticket":"A"}'::jsonb);
  if coalesce((j->>'replayed')::boolean,false) is not true then raise exception 'SMOKE_FALLO: replay venta'; end if;
  select count(*) into n from public.movimientos_stock where operation_id='op-sale';
  if n <> 1 then raise exception 'SMOKE_FALLO: replay duplico venta'; end if;

  j := public.registrar_venta_stock_carrito(
    'op-cart','e1','l1',
    '[{"productoId":"p1","cantidad":1,"precio":2},{"productoId":"p2","cantidad":2,"precio":3}]'::jsonb,
    '{"ticket":"B"}'::jsonb
  );
  if coalesce((j->>'ok')::boolean,false) is not true then raise exception 'SMOKE_FALLO: carrito inicial'; end if;
  j := public.registrar_venta_stock_carrito(
    'op-cart','e1','l1',
    '[{"productoId":"p1","cantidad":1,"precio":2},{"productoId":"p2","cantidad":2,"precio":3}]'::jsonb,
    '{"ticket":"B"}'::jsonb
  );
  if coalesce((j->>'replayed')::boolean,false) is not true then raise exception 'SMOKE_FALLO: replay carrito'; end if;

  begin
    perform public.registrar_venta_stock_carrito(
      'op-cart','e1','l1',
      '[{"productoId":"p1","cantidad":1,"precio":999},{"productoId":"p2","cantidad":2,"precio":3}]'::jsonb,
      '{"ticket":"B"}'::jsonb
    );
    raise exception 'SMOKE_FALLO: carrito divergente aceptado';
  exception when others then
    if sqlerrm = 'SMOKE_FALLO: carrito divergente aceptado' then raise; end if;
    if position('operation_id_conflict' in sqlerrm)=0 then raise; end if;
  end;

  j := public.trasladar_stock_interno('op-internal','e1','l1','p2','almacen','piso',1,'{}'::jsonb);
  if coalesce((j->>'ok')::boolean,false) is not true then raise exception 'SMOKE_FALLO: traslado interno'; end if;
  j := public.trasladar_stock_interno('op-internal','e1','l1','p2','almacen','piso',1,'{}'::jsonb);
  if coalesce((j->>'replayed')::boolean,false) is not true then raise exception 'SMOKE_FALLO: replay traslado interno'; end if;

  -- Destino interlocal usa la misma unidad y un producto distinto permitido por contrato.
  j := public.trasladar_stock_entre_locales('op-inter','e1','l1','l2','p2','p3',1,'{}'::jsonb);
  if coalesce((j->>'ok')::boolean,false) is not true then raise exception 'SMOKE_FALLO: traslado interlocal'; end if;
  select count(*) into n from public.movimientos_stock where operation_id='op-inter';
  if n <> 2 then raise exception 'SMOKE_FALLO: traslado interlocal no atomico'; end if;

  j := public.registrar_encargo('enc1','e1','l1','c1',25,'Pendiente','{"nota":"x"}'::jsonb);
  if coalesce((j->>'ok')::boolean,false) is not true then raise exception 'SMOKE_FALLO: registrar encargo'; end if;
  select count(*) into n from public.encargos_empresa where id='enc1' and empresa_id='e1' and local_id='l1' and cliente_id='c1';
  if n <> 1 then raise exception 'SMOKE_FALLO: encargo no persistido'; end if;

  begin
    perform public.registrar_encargo('enc1','e1','l1','c1',25,'Devuelto','{}'::jsonb);
    raise exception 'SMOKE_FALLO: transicion invalida aceptada';
  exception when others then
    if sqlerrm = 'SMOKE_FALLO: transicion invalida aceptada' then raise; end if;
    if position('transicion_encargo_invalida' in sqlerrm)=0 then raise; end if;
  end;

  raise notice 'PM27_RPC_RESTORE_BEHAVIOR=PASS';
end
$behavior$;

-- Comprobar aislamiento de la superficie publica.
do $acl$
declare
  r regprocedure;
begin
  foreach r in array array[
    'public.registrar_venta_stock(text,text,text,text,numeric,jsonb)'::regprocedure,
    'public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)'::regprocedure,
    'public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb)'::regprocedure,
    'public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb)'::regprocedure,
    'public.registrar_encargo(text,text,text,text,numeric,text,jsonb)'::regprocedure
  ] loop
    if not has_function_privilege('authenticated',r,'EXECUTE') or has_function_privilege('anon',r,'EXECUTE') then
      raise exception 'ACL_FALLO: %',r;
    end if;
  end loop;
  raise notice 'PM27_RPC_RESTORE_ACL=PASS';
end
$acl$;
