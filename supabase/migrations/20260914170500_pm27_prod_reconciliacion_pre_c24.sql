-- PM27 / Producción — reconciliación mínima PRE-C24.
--
-- Objetivo:
--   llevar el backend productivo desde el baseline especial PM12-P08 al contrato
--   estructural mínimo que el paquete C24 ya certificó en PostgreSQL 17.
--
-- Reglas:
--   * fail-closed ante cualquier drift inesperado;
--   * no marca manualmente supabase_migrations.schema_migrations;
--   * no crea caja_operaciones ni pagos_factura legacy;
--   * reutiliza private.g1_operation_ids_global como ledger transversal;
--   * los RPC que C18/C19/C21 reemplazarán nacen bloqueados hasta completar C24;
--   * pagos/encargos/clientes sí quedan con contrato seguro y RLS explícito.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_stock_rows bigint;
  v_c24_versions bigint;
begin
  if to_regclass('public.perfiles') is null
     or to_regclass('public.membresias_usuario') is null
     or to_regclass('public.almacen_kv') is null
     or to_regclass('public.stock_ubicacion') is null
     or to_regclass('public.stock_operaciones') is null
     or to_regclass('public.movimientos_stock') is null
     or to_regclass('private.g1_operation_ids_global') is null then
    raise exception 'PM27_PROD_RECON_PREFLIGHT_FALLO: falta baseline estructural PM12';
  end if;

  if to_regprocedure('private.la_usuario_activo()') is null
     or to_regprocedure('private.la_tiene_empresa(text)') is null
     or to_regprocedure('private.la_tiene_local(text,text)') is null
     or to_regprocedure('private.la_rol()') is null
     or to_regprocedure('private.pm07_puede_gestionar_stock()') is null
     or to_regprocedure('private.pm08_validar_operation_id(text)') is null
     or to_regprocedure('private.pm08_bloquear_operation_id(text)') is null
     or to_regprocedure('private.pm09_bloquear_operation_id_stock(text)') is null
     or to_regprocedure('private.g1_claim_operation_id()') is null
     or to_regprocedure('private.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb)') is null
     or to_regprocedure('private.pm12_cancelar_conteo_stock(text,text,jsonb,jsonb)') is null
     or to_regprocedure('public.obtener_contexto_operativo()') is null then
    raise exception 'PM27_PROD_RECON_PREFLIGHT_FALLO: faltan helpers/RPC base esperados';
  end if;

  if to_regclass('public.clientes_empresa') is not null
     or to_regclass('public.encargos_empresa') is not null
     or to_regclass('public.pagos_encargo') is not null then
    raise exception 'PM27_PROD_RECON_PREFLIGHT_FALLO: tablas PM14 ya presentes/parciales';
  end if;

  if to_regprocedure('private.pm06_puede_gestionar_finanzas()') is not null
     or to_regprocedure('private.pm07_puede_vender()') is not null
     or to_regprocedure('private.pm07_validar_cantidad(numeric,boolean,smallint)') is not null
     or to_regprocedure('private.pm08_local_operable(text,text)') is not null
     or to_regprocedure('private.pm08_puede_operar_caja()') is not null
     or to_regprocedure('private.pm08_validar_dinero(numeric,boolean,boolean)') is not null
     or to_regprocedure('private.pm14_total_encargo(text,text,text)') is not null then
    raise exception 'PM27_PROD_RECON_PREFLIGHT_FALLO: helpers objetivo ya presentes/parciales';
  end if;

  if to_regprocedure('public.registrar_venta_stock(text,text,text,text,numeric,jsonb)') is not null
     or to_regprocedure('public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)') is not null
     or to_regprocedure('public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb)') is not null
     or to_regprocedure('public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb)') is not null
     or to_regprocedure('public.registrar_encargo(text,text,text,text,numeric,text,jsonb)') is not null
     or to_regprocedure('public.registrar_pago_encargo(text,text,text,text,text,text,numeric,date,text,jsonb)') is not null
     or to_regprocedure('public.revertir_pago_encargo(text,text,text,text)') is not null then
    raise exception 'PM27_PROD_RECON_PREFLIGHT_FALLO: RPC objetivo ya presentes/parciales';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='stock_ubicacion' and column_name='unidad'
  ) or exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='almacen_kv' and column_name in ('empresa_id','local_id')
  ) then
    raise exception 'PM27_PROD_RECON_PREFLIGHT_FALLO: columnas objetivo ya presentes/parciales';
  end if;

  select count(*) into v_stock_rows from public.stock_ubicacion;
  if v_stock_rows <> 0 then
    raise exception 'PM27_PROD_RECON_PREFLIGHT_FALLO: stock_ubicacion dejó de estar vacío (% filas)', v_stock_rows;
  end if;

  if strpos(pg_get_functiondef('public.obtener_contexto_operativo()'::regprocedure), 'contexto_roles_inconsistentes') > 0
     or strpos(pg_get_functiondef('private.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb)'::regprocedure), $$op.payload ? 'bases'$$) > 0 then
    raise exception 'PM27_PROD_RECON_PREFLIGHT_FALLO: marcadores C24 parciales';
  end if;

  if to_regprocedure('public.descontar_stock_carrito(jsonb,text)') is null
     or to_regprocedure('public.anular_venta_tpv(text,text)') is null then
    raise exception 'PM27_PROD_RECON_PREFLIGHT_FALLO: faltan RPC legacy que C13 debe retirar';
  end if;

  select count(*) into v_c24_versions
    from supabase_migrations.schema_migrations
   where version in (
     '20260913190500','20260913193500','20260914064500','20260914071000',
     '20260914080000','20260914090000','20260914103000','20260914121000'
   );
  if v_c24_versions <> 0 then
    raise exception 'PM27_PROD_RECON_PREFLIGHT_FALLO: historial C24 ya presente/parcial';
  end if;

  raise notice 'PM27_PROD_RECON_PREFLIGHT=PASS';
end
$preflight$;

create table private.pm27_prod_recovery_20260914 (
  signature text primary key,
  definition text not null,
  proacl text,
  proconfig text[]
);

insert into private.pm27_prod_recovery_20260914(signature,definition,proacl,proconfig)
select p.oid::regprocedure::text,
       pg_get_functiondef(p.oid),
       p.proacl::text,
       p.proconfig
  from pg_proc p
 where p.oid in (
   'public.obtener_contexto_operativo()'::regprocedure,
   'private.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb)'::regprocedure,
   'private.pm12_cancelar_conteo_stock(text,text,jsonb,jsonb)'::regprocedure,
   'private.es_propietario_activo()'::regprocedure
 );

revoke all on table private.pm27_prod_recovery_20260914 from public, anon, authenticated;

alter table public.almacen_kv add column empresa_id text;
alter table public.almacen_kv add column local_id text;

alter table public.stock_ubicacion
  add column unidad text not null default 'ud';

create or replace function private.pm07_validar_cantidad(
  p_cantidad numeric,
  p_fraccionable boolean,
  p_precision smallint
) returns numeric
language plpgsql
immutable
set search_path='pg_catalog','pg_temp'
as $function$
declare v numeric;
begin
  if coalesce(p_cantidad,0) <= 0 then raise exception 'cantidad_invalida'; end if;
  if not coalesce(p_fraccionable,false) and p_cantidad <> trunc(p_cantidad) then
    raise exception 'unidad_indivisible';
  end if;
  v := round(p_cantidad, greatest(0, least(6, coalesce(p_precision,0))));
  if p_cantidad <> v then raise exception 'precision_cantidad_excedida'; end if;
  return v;
end
$function$;

create or replace function private.pm07_puede_vender()
returns boolean
language sql
stable security definer
set search_path='public','auth','private','pg_temp'
as $function$
  select private.la_usuario_activo()
     and coalesce(private.la_rol(),'') in
       ('Propietario','Encargado','Cajero/a','Camarero/a','Churrero/a');
$function$;

create or replace function private.pm08_puede_operar_caja()
returns boolean
language sql
stable security definer
set search_path='public','auth','private','pg_temp'
as $function$
  select private.la_usuario_activo()
     and coalesce(private.la_rol(),'') in ('Propietario','Encargado','Cajero/a');
$function$;

create or replace function private.pm08_local_operable(
  p_empresa_id text,
  p_local_id text
) returns boolean
language sql
stable security definer
set search_path='public','auth','private','pg_temp'
as $function$
  select not exists (
           select 1
             from public.stock_ubicacion s
            where s.empresa_id = p_empresa_id
              and s.local_id = p_local_id
              and s.local_operable = false
         )
     and not exists (
           select 1
             from public.almacen_kv k
            where k.empresa_id = p_empresa_id
              and k.local_id = p_local_id
              and jsonb_typeof(k.value) = 'object'
              and k.value->>'id' = p_local_id
              and lower(coalesce(k.value->>'activo','true')) in ('false','0','no')
         );
$function$;

create or replace function private.pm08_validar_dinero(
  p_importe numeric,
  p_permite_cero boolean default false,
  p_permite_negativo boolean default false
) returns numeric
language plpgsql
immutable
set search_path='pg_catalog','pg_temp'
as $function$
declare v numeric;
begin
  if p_importe is null or p_importe::text in ('NaN','Infinity','-Infinity') then
    raise exception 'importe_invalido';
  end if;
  if abs(p_importe) > 999999999999.99 then raise exception 'importe_fuera_rango'; end if;
  if not p_permite_negativo and p_importe < 0 then raise exception 'importe_negativo'; end if;
  if not p_permite_cero and p_importe = 0 then raise exception 'importe_cero'; end if;
  v := round(p_importe,2);
  if v <> p_importe then raise exception 'importe_precision_invalida'; end if;
  return v;
end
$function$;

create or replace function private.pm06_puede_gestionar_finanzas()
returns boolean
language sql
stable security definer
set search_path='public','auth','private','pg_temp'
as $function$
  select private.la_usuario_activo()
     and coalesce(private.la_rol() in ('Propietario','Encargado'), false);
$function$;

revoke all on function private.pm07_validar_cantidad(numeric,boolean,smallint) from public, anon, authenticated;
revoke all on function private.pm07_puede_vender() from public, anon, authenticated;
revoke all on function private.pm08_puede_operar_caja() from public, anon, authenticated;
revoke all on function private.pm08_local_operable(text,text) from public, anon, authenticated;
revoke all on function private.pm08_validar_dinero(numeric,boolean,boolean) from public, anon, authenticated;
revoke all on function private.pm06_puede_gestionar_finanzas() from public, anon, authenticated;

create table public.clientes_empresa (
  id text primary key,
  empresa_id text not null,
  datos jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clientes_empresa_datos_empresa check (
    (datos->>'empresaId') is null or (datos->>'empresaId') = empresa_id
  )
);
create index clientes_empresa_empresa_idx on public.clientes_empresa(empresa_id);
alter table public.clientes_empresa enable row level security;

create policy clientes_empresa_select on public.clientes_empresa
  for select to authenticated
  using (private.la_tiene_empresa(empresa_id));
create policy clientes_empresa_insert on public.clientes_empresa
  for insert to authenticated
  with check (
    private.la_tiene_empresa(empresa_id)
    and (datos->>'empresaId') = empresa_id
  );
create policy clientes_empresa_update on public.clientes_empresa
  for update to authenticated
  using (private.la_tiene_empresa(empresa_id))
  with check (
    private.la_tiene_empresa(empresa_id)
    and (datos->>'empresaId') = empresa_id
  );
create policy clientes_empresa_delete on public.clientes_empresa
  for delete to authenticated
  using (private.la_tiene_empresa(empresa_id));

revoke all on table public.clientes_empresa from anon;
grant select, insert, update, delete on table public.clientes_empresa to authenticated;
do $grant_service_role_clientes$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname='service_role') then
    execute 'grant all on table public.clientes_empresa to service_role';
  end if;
end
$grant_service_role_clientes$;

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
  for select to authenticated
  using (
    private.la_tiene_empresa(empresa_id)
    and private.la_tiene_local(empresa_id,local_id)
  );
revoke all on table public.encargos_empresa from anon;
revoke all on table public.encargos_empresa from authenticated;
grant select on table public.encargos_empresa to authenticated;
do $grant_service_role_encargos$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname='service_role') then
    execute 'grant all on table public.encargos_empresa to service_role';
  end if;
end
$grant_service_role_encargos$;

create table public.pagos_encargo (
  id text primary key,
  operation_id text not null unique,
  encargo_id text not null,
  empresa_id text not null,
  local_id text not null,
  concepto text not null check (concepto = any (array['SEÑAL','RESTO_ENTREGA','OTRO']::text[])),
  importe numeric not null check (importe > 0),
  fecha date not null default current_date,
  estado text not null check (estado = any (array['CONFIRMADO','REVERSO']::text[])),
  revierte_pago_id text references public.pagos_encargo(id),
  medio_pago text check (
    medio_pago is null
    or medio_pago = any (array['Efectivo','Tarjeta','Transferencia','Otro']::text[])
  ),
  datos jsonb not null default '{}'::jsonb,
  actor_user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index pagos_encargo_por_encargo
  on public.pagos_encargo(encargo_id,empresa_id,local_id);
create index idx_pagos_encargo_revierte_pago_id
  on public.pagos_encargo(revierte_pago_id);

alter table public.pagos_encargo enable row level security;
create policy pm14_pagos_encargo_select on public.pagos_encargo
  for select to authenticated
  using (
    private.la_tiene_empresa(empresa_id)
    and private.la_tiene_local(empresa_id,local_id)
  );

revoke all on table public.pagos_encargo from anon;
revoke all on table public.pagos_encargo from authenticated;
grant select on table public.pagos_encargo to authenticated;
do $grant_service_role_pagos$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname='service_role') then
    execute 'grant all on table public.pagos_encargo to service_role';
  end if;
end
$grant_service_role_pagos$;

create trigger g1_operation_id_global
before insert on public.pagos_encargo
for each row execute function private.g1_claim_operation_id();

create or replace function private.pm14_total_encargo(
  p_empresa text,
  p_local text,
  p_encargo_id text
) returns numeric
language plpgsql
stable security definer
set search_path='public','auth','private','pg_temp'
as $function$
declare
  d jsonb;
  total numeric;
begin
  select datos into d
    from public.encargos_empresa
   where id=p_encargo_id
     and empresa_id=p_empresa
     and local_id=p_local;

  if d is null
     or coalesce(d->>'estado','Pendiente') in ('Cancelado','Devuelto') then
    return null;
  end if;

  total := coalesce(nullif(d->>'total','')::numeric,0);
  return round(total,2);
end
$function$;
revoke all on function private.pm14_total_encargo(text,text,text) from public, anon, authenticated;

create or replace function public.registrar_venta_stock(
  p_operation_id text, p_empresa_id text, p_local_id text, p_producto_id text,
  p_cantidad numeric, p_datos jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path='public','auth','private','pg_temp'
as $function$
begin
  raise exception 'pm27_reconciliacion_pendiente_c24';
end
$function$;

create or replace function public.registrar_venta_stock_carrito(
  p_operation_id text, p_empresa_id text, p_local_id text,
  p_lineas jsonb, p_datos jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path='public','auth','private','pg_temp'
as $function$
begin
  raise exception 'pm27_reconciliacion_pendiente_c24';
end
$function$;

create or replace function public.trasladar_stock_interno(
  p_operation_id text, p_empresa_id text, p_local_id text, p_producto_id text,
  p_origen text, p_destino text, p_cantidad numeric, p_datos jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path='public','auth','private','pg_temp'
as $function$
begin
  raise exception 'pm27_reconciliacion_pendiente_c24';
end
$function$;

create or replace function public.trasladar_stock_entre_locales(
  p_operation_id text, p_empresa_id text, p_origen_local_id text, p_destino_local_id text,
  p_producto_origen_id text, p_producto_destino_id text, p_cantidad numeric,
  p_datos jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path='public','auth','private','pg_temp'
as $function$
begin
  raise exception 'pm27_reconciliacion_pendiente_c24';
end
$function$;

create or replace function public.registrar_encargo(
  p_id text, p_empresa_id text, p_local_id text, p_cliente_id text,
  p_total numeric, p_estado text default 'Pendiente', p_datos jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path='public','auth','private','pg_temp'
as $function$
begin
  raise exception 'pm27_reconciliacion_pendiente_c24';
end
$function$;

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
) returns jsonb
language plpgsql
security definer
set search_path='public','auth','private','pg_temp'
as $function$
declare
  v_operation_id text;
  v_concepto text;
  v_importe numeric;
  v_datos jsonb;
  v_total numeric;
  v_pagado numeric;
  v_pendiente numeric;
  v_ledger text;
  existente public.pagos_encargo%rowtype;
  nuevo public.pagos_encargo%rowtype;
begin
  if auth.uid() is null or not private.pm08_puede_operar_caja() then
    raise exception 'pago_encargo_no_autorizado';
  end if;
  if not private.la_tiene_empresa(p_empresa_id)
     or not private.la_tiene_local(p_empresa_id,p_local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if p_id is null or btrim(p_id)='' then raise exception 'id_requerido'; end if;
  if p_encargo_id is null or btrim(p_encargo_id)='' then raise exception 'encargo_id_requerido'; end if;
  if not private.pm08_local_operable(p_empresa_id,p_local_id) then raise exception 'local_inactivo'; end if;
  if p_fecha is null then raise exception 'fecha_requerida'; end if;

  v_operation_id := private.pm08_validar_operation_id(p_operation_id);
  v_concepto := upper(btrim(coalesce(p_concepto,'')));
  if v_concepto not in ('SEÑAL','RESTO_ENTREGA','OTRO') then
    raise exception 'concepto_pago_invalido';
  end if;
  v_importe := private.pm08_validar_dinero(p_importe,false,false);
  v_datos := coalesce(p_datos,'{}'::jsonb);

  perform private.pm08_bloquear_operation_id(v_operation_id);

  select * into existente
    from public.pagos_encargo
   where operation_id=v_operation_id;

  if found then
    if existente.id=p_id
       and existente.encargo_id=p_encargo_id
       and existente.empresa_id=p_empresa_id
       and existente.local_id=p_local_id
       and existente.concepto=v_concepto
       and existente.importe=v_importe
       and existente.fecha=p_fecha
       and existente.medio_pago is not distinct from p_medio_pago
       and existente.datos=v_datos
       and existente.estado='CONFIRMADO' then
      return jsonb_build_object('ok',true,'replayed',true,'pago',to_jsonb(existente));
    end if;
    raise exception 'operation_id_conflict';
  end if;

  select g.ledger into v_ledger
    from private.g1_operation_ids_global g
   where g.operation_id=v_operation_id;
  if found then
    raise exception 'operation_id_conflict';
  end if;

  perform 1
    from public.encargos_empresa
   where id=p_encargo_id
     and empresa_id=p_empresa_id
     and local_id=p_local_id
   for update;
  if not found then
    raise exception 'encargo_no_encontrado_o_no_autorizado';
  end if;

  v_total := private.pm14_total_encargo(p_empresa_id,p_local_id,p_encargo_id);
  if v_total is null then raise exception 'encargo_no_encontrado_o_no_autorizado'; end if;

  select round(coalesce(sum(
    case when estado='CONFIRMADO' then importe else -importe end
  ),0),2)
    into v_pagado
    from public.pagos_encargo
   where encargo_id=p_encargo_id
     and empresa_id=p_empresa_id
     and local_id=p_local_id;

  v_pendiente := round(v_total-v_pagado,2);
  if v_pendiente <= 0 then raise exception 'encargo_ya_liquidado'; end if;
  if v_importe > v_pendiente then raise exception 'pago_supera_saldo'; end if;

  insert into public.pagos_encargo(
    id,operation_id,encargo_id,empresa_id,local_id,concepto,importe,fecha,
    estado,medio_pago,datos,actor_user_id
  ) values (
    p_id,v_operation_id,p_encargo_id,p_empresa_id,p_local_id,v_concepto,v_importe,p_fecha,
    'CONFIRMADO',p_medio_pago,v_datos,auth.uid()
  )
  returning * into nuevo;

  return jsonb_build_object(
    'ok',true,'replayed',false,'pago',to_jsonb(nuevo),
    'total',v_total,'pagado',round(v_pagado+nuevo.importe,2),
    'pendiente',round(v_total-v_pagado-nuevo.importe,2)
  );
end
$function$;

create or replace function public.revertir_pago_encargo(
  p_id text,
  p_operation_id text,
  p_pago_id text,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path='public','auth','private','pg_temp'
as $function$
declare
  v_operation_id text;
  v_motivo text;
  v_ledger text;
  existente public.pagos_encargo%rowtype;
  original public.pagos_encargo%rowtype;
  previo public.pagos_encargo%rowtype;
  nuevo public.pagos_encargo%rowtype;
begin
  if auth.uid() is null or not private.pm06_puede_gestionar_finanzas() then
    raise exception 'reverso_pago_encargo_no_autorizado';
  end if;
  if p_id is null or btrim(p_id)='' then raise exception 'id_requerido'; end if;
  v_operation_id := private.pm08_validar_operation_id(p_operation_id);
  v_motivo := btrim(coalesce(p_motivo,''));
  if v_motivo='' then raise exception 'motivo_requerido'; end if;

  perform private.pm08_bloquear_operation_id(v_operation_id);

  select * into existente
    from public.pagos_encargo
   where operation_id=v_operation_id;
  if found then
    if existente.id=p_id
       and existente.estado='REVERSO'
       and existente.revierte_pago_id=p_pago_id
       and coalesce(existente.datos->>'motivo','')=v_motivo then
      return jsonb_build_object('ok',true,'replayed',true,'pago',to_jsonb(existente));
    end if;
    raise exception 'operation_id_conflict';
  end if;

  select g.ledger into v_ledger
    from private.g1_operation_ids_global g
   where g.operation_id=v_operation_id;
  if found then
    raise exception 'operation_id_conflict';
  end if;

  select * into original
    from public.pagos_encargo
   where id=p_pago_id and estado='CONFIRMADO'
   for update;
  if not found then raise exception 'pago_original_no_encontrado'; end if;

  if not private.la_tiene_empresa(original.empresa_id)
     or not private.la_tiene_local(original.empresa_id,original.local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if not private.pm08_local_operable(original.empresa_id,original.local_id) then
    raise exception 'local_inactivo';
  end if;

  select * into previo
    from public.pagos_encargo
   where revierte_pago_id=p_pago_id
     and estado='REVERSO'
   limit 1;
  if found then raise exception 'pago_ya_revertido'; end if;

  insert into public.pagos_encargo(
    id,operation_id,encargo_id,empresa_id,local_id,concepto,importe,fecha,
    estado,revierte_pago_id,medio_pago,datos,actor_user_id
  ) values (
    p_id,v_operation_id,original.encargo_id,original.empresa_id,original.local_id,
    original.concepto,original.importe,current_date,
    'REVERSO',original.id,original.medio_pago,jsonb_build_object('motivo',v_motivo),auth.uid()
  )
  returning * into nuevo;

  return jsonb_build_object('ok',true,'replayed',false,'pago',to_jsonb(nuevo));
end
$function$;

revoke all on function public.registrar_venta_stock(text,text,text,text,numeric,jsonb) from public, anon, authenticated;
revoke all on function public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb) from public, anon, authenticated;
revoke all on function public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb) from public, anon, authenticated;
revoke all on function public.registrar_encargo(text,text,text,text,numeric,text,jsonb) from public, anon, authenticated;
revoke all on function public.registrar_pago_encargo(text,text,text,text,text,text,numeric,date,text,jsonb) from public, anon, authenticated;
revoke all on function public.revertir_pago_encargo(text,text,text,text) from public, anon, authenticated;

grant execute on function public.registrar_venta_stock(text,text,text,text,numeric,jsonb) to authenticated;
grant execute on function public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb) to authenticated;
grant execute on function public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb) to authenticated;
grant execute on function public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb) to authenticated;
grant execute on function public.registrar_encargo(text,text,text,text,numeric,text,jsonb) to authenticated;
grant execute on function public.registrar_pago_encargo(text,text,text,text,text,text,numeric,date,text,jsonb) to authenticated;
grant execute on function public.revertir_pago_encargo(text,text,text,text) to authenticated;

do $postflight$
declare
  n_global integer;
begin
  if to_regclass('public.clientes_empresa') is null
     or to_regclass('public.encargos_empresa') is null
     or to_regclass('public.pagos_encargo') is null then
    raise exception 'PM27_PROD_RECON_POSTFLIGHT_FALLO: tablas objetivo ausentes';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='stock_ubicacion'
       and column_name='unidad' and is_nullable='NO'
  ) then
    raise exception 'PM27_PROD_RECON_POSTFLIGHT_FALLO: unidad stock ausente';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='almacen_kv' and column_name='empresa_id'
  ) or not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='almacen_kv' and column_name='local_id'
  ) then
    raise exception 'PM27_PROD_RECON_POSTFLIGHT_FALLO: scope almacen_kv incompleto';
  end if;

  if not (
    (select relrowsecurity from pg_class where oid='public.clientes_empresa'::regclass)
    and (select relrowsecurity from pg_class where oid='public.encargos_empresa'::regclass)
    and (select relrowsecurity from pg_class where oid='public.pagos_encargo'::regclass)
  ) then
    raise exception 'PM27_PROD_RECON_POSTFLIGHT_FALLO: RLS no habilitado';
  end if;

  select count(*) into n_global
    from pg_trigger t
    join pg_proc p on p.oid=t.tgfoid
    join pg_namespace n on n.oid=p.pronamespace
   where t.tgrelid='public.pagos_encargo'::regclass
     and not t.tgisinternal
     and t.tgname='g1_operation_id_global'
     and n.nspname='private'
     and p.proname='g1_claim_operation_id';
  if n_global <> 1 then
    raise exception 'PM27_PROD_RECON_POSTFLIGHT_FALLO: trigger global pagos_encargo';
  end if;

  if not has_function_privilege('authenticated','public.registrar_pago_encargo(text,text,text,text,text,text,numeric,date,text,jsonb)','EXECUTE')
     or not has_function_privilege('authenticated','public.revertir_pago_encargo(text,text,text,text)','EXECUTE') then
    raise exception 'PM27_PROD_RECON_POSTFLIGHT_FALLO: RPC pagos sin EXECUTE';
  end if;

  if has_function_privilege('anon','public.registrar_pago_encargo(text,text,text,text,text,text,numeric,date,text,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.revertir_pago_encargo(text,text,text,text)','EXECUTE') then
    raise exception 'PM27_PROD_RECON_POSTFLIGHT_FALLO: anon ejecuta RPC pagos';
  end if;

  if strpos(pg_get_functiondef('public.registrar_venta_stock(text,text,text,text,numeric,jsonb)'::regprocedure),'pm27_reconciliacion_pendiente_c24') = 0
     or strpos(pg_get_functiondef('public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)'::regprocedure),'pm27_reconciliacion_pendiente_c24') = 0
     or strpos(pg_get_functiondef('public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb)'::regprocedure),'pm27_reconciliacion_pendiente_c24') = 0
     or strpos(pg_get_functiondef('public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb)'::regprocedure),'pm27_reconciliacion_pendiente_c24') = 0
     or strpos(pg_get_functiondef('public.registrar_encargo(text,text,text,text,numeric,text,jsonb)'::regprocedure),'pm27_reconciliacion_pendiente_c24') = 0 then
    raise exception 'PM27_PROD_RECON_POSTFLIGHT_FALLO: puente no fail-closed';
  end if;

  raise notice 'PM27_PROD_RECON_POSTFLIGHT=PASS';
end
$postflight$;

commit;
