-- PM-08 · Caja y devolución indivisibles
-- Base: PM-07 cerrado (4b3a023422fb0879d9acbf1c6317cf98299e031d).
-- Destino autorizado: Supabase QA. No aplicar a producción sin autorización expresa.

-- ---------------------------------------------------------------------------
-- 1. Modelo inmutable y trazable
-- ---------------------------------------------------------------------------

create table if not exists public.caja_operaciones (
  operation_id text primary key,
  tipo text not null check (tipo in (
    'ENTRADA', 'RETIRADA', 'REEMBOLSO',
    'REVERSO_ENTRADA', 'REVERSO_RETIRADA'
  )),
  empresa_id text not null,
  local_id text not null,
  fecha date not null,
  importe numeric(14,2) not null check (importe > 0),
  efecto_efectivo numeric(14,2) not null,
  medio_pago text not null check (medio_pago in ('EFECTIVO','TARJETA','TRANSFERENCIA','OTRO')),
  concepto text not null,
  origen_tipo text not null,
  origen_id text,
  ref_operation_id text references public.caja_operaciones(operation_id) on delete restrict,
  payload jsonb not null,
  actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint pm08_caja_operation_id_formato
    check (operation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'),
  constraint pm08_caja_concepto_requerido check (btrim(concepto) <> ''),
  constraint pm08_caja_efecto_consistente check (
    (tipo = 'ENTRADA' and efecto_efectivo = importe and medio_pago = 'EFECTIVO') or
    (tipo = 'RETIRADA' and efecto_efectivo = -importe and medio_pago = 'EFECTIVO') or
    (tipo = 'REEMBOLSO' and efecto_efectivo = case when medio_pago = 'EFECTIVO' then -importe else 0 end) or
    (tipo = 'REVERSO_ENTRADA' and efecto_efectivo = -importe and medio_pago = 'EFECTIVO' and ref_operation_id is not null) or
    (tipo = 'REVERSO_RETIRADA' and efecto_efectivo = importe and medio_pago = 'EFECTIVO' and ref_operation_id is not null)
  )
);

create index if not exists pm08_caja_scope_fecha
  on public.caja_operaciones (empresa_id, local_id, fecha, created_at);
create index if not exists pm08_caja_ref_operation
  on public.caja_operaciones (ref_operation_id)
  where ref_operation_id is not null;
create unique index if not exists pm08_caja_un_reverso_por_movimiento
  on public.caja_operaciones (ref_operation_id)
  where tipo in ('REVERSO_ENTRADA','REVERSO_RETIRADA');

create table if not exists public.arqueos_caja (
  operation_id text primary key,
  empresa_id text not null,
  local_id text not null,
  fecha date not null,
  alcance text not null default 'DIA' check (alcance = 'DIA'),
  efectivo_base numeric(14,2) not null check (efectivo_base >= 0),
  efectivo_esperado numeric(14,2) not null,
  efectivo_contado numeric(14,2) not null check (efectivo_contado >= 0),
  diferencia numeric(14,2) not null,
  notas text not null default '',
  snapshot jsonb not null default '{}'::jsonb,
  payload jsonb not null,
  estado text not null default 'ACTIVO' check (estado in ('ACTIVO','ANULADO')),
  anulado_por_operation_id text unique,
  anulado_motivo text,
  anulado_actor_user_id uuid,
  anulado_at timestamptz,
  actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint pm08_arqueo_operation_id_formato
    check (operation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'),
  constraint pm08_arqueo_diferencia_consistente
    check (diferencia = efectivo_contado - efectivo_esperado),
  constraint pm08_arqueo_anulacion_consistente check (
    (estado = 'ACTIVO' and anulado_por_operation_id is null and anulado_motivo is null and anulado_actor_user_id is null and anulado_at is null) or
    (estado = 'ANULADO' and anulado_por_operation_id is not null and anulado_motivo is not null and anulado_actor_user_id is not null and anulado_at is not null)
  )
);

create unique index if not exists pm08_un_arqueo_activo_dia_local
  on public.arqueos_caja (empresa_id, local_id, fecha)
  where estado = 'ACTIVO';
create index if not exists pm08_arqueos_scope_fecha
  on public.arqueos_caja (empresa_id, local_id, fecha, created_at);

create table if not exists public.arqueos_caja_anulaciones (
  operation_id text primary key,
  arqueo_operation_id text not null unique references public.arqueos_caja(operation_id) on delete restrict,
  empresa_id text not null,
  local_id text not null,
  motivo text not null,
  payload jsonb not null,
  actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint pm08_arqueo_anulacion_operation_id_formato
    check (operation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'),
  constraint pm08_arqueo_anulacion_motivo_requerido check (btrim(motivo) <> '')
);

create index if not exists pm08_arqueos_anulaciones_scope
  on public.arqueos_caja_anulaciones (empresa_id, local_id, created_at);

-- PM-08 añade devoluciones al ledger físico ya cerrado en PM-07.
alter table public.stock_operaciones
  drop constraint if exists stock_operaciones_tipo_check;
alter table public.stock_operaciones
  add constraint stock_operaciones_tipo_check check (tipo in (
    'VENTA','REVERSO','TRASLADO_INTERNO','TRASLADO_ENTRE_LOCALES',
    'DEVOLUCION_CLIENTE','DEVOLUCION_PROVEEDOR'
  ));

create index if not exists pm08_stock_operaciones_ref_reverso
  on public.stock_operaciones (ref_operation_id)
  where tipo = 'REVERSO' and ref_operation_id is not null;

alter table public.movimientos_stock
  drop constraint if exists movimientos_stock_tipo_check;
alter table public.movimientos_stock
  add constraint movimientos_stock_tipo_check check (tipo in (
    'VENTA','REVERSO','TRASLADO_INTERNO','TRASLADO_ENTRE_LOCALES',
    'DEVOLUCION_CLIENTE','DEVOLUCION_PROVEEDOR'
  ));

create table if not exists public.devoluciones_venta (
  operation_id text primary key references public.stock_operaciones(operation_id) on delete restrict,
  venta_operation_id text not null references public.stock_operaciones(operation_id) on delete restrict,
  empresa_id text not null,
  local_id text not null,
  producto_id text not null,
  cantidad numeric(18,6) not null check (cantidad > 0),
  reembolso numeric(14,2) not null check (reembolso >= 0),
  medio_reembolso text not null check (medio_reembolso in ('SIN_REEMBOLSO','EFECTIVO','TARJETA','TRANSFERENCIA','OTRO')),
  motivo text not null,
  fecha date not null,
  movimiento_stock_id bigint not null unique references public.movimientos_stock(id) on delete restrict,
  caja_operation_id text unique references public.caja_operaciones(operation_id) on delete restrict,
  payload jsonb not null,
  actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint pm08_devolucion_reembolso_consistente check (
    (reembolso = 0 and medio_reembolso = 'SIN_REEMBOLSO' and caja_operation_id is null) or
    (reembolso > 0 and medio_reembolso <> 'SIN_REEMBOLSO' and caja_operation_id is not null)
  ),
  constraint pm08_devolucion_venta_motivo_requerido check (btrim(motivo) <> '')
);

create index if not exists pm08_devoluciones_venta_pendiente
  on public.devoluciones_venta (venta_operation_id, producto_id, created_at);
create index if not exists pm08_devoluciones_venta_scope
  on public.devoluciones_venta (empresa_id, local_id, fecha, created_at);

create table if not exists public.devoluciones_proveedor (
  operation_id text primary key references public.stock_operaciones(operation_id) on delete restrict,
  empresa_id text not null,
  local_id text not null,
  producto_id text not null,
  cantidad numeric(18,6) not null check (cantidad > 0),
  proveedor_id text,
  proveedor_nombre text not null default '',
  motivo text not null,
  fecha date not null,
  movimiento_stock_id bigint not null unique references public.movimientos_stock(id) on delete restrict,
  payload jsonb not null,
  actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint pm08_devolucion_proveedor_motivo_requerido check (btrim(motivo) <> '')
);

create index if not exists pm08_devoluciones_proveedor_scope
  on public.devoluciones_proveedor (empresa_id, local_id, fecha, created_at);

-- ---------------------------------------------------------------------------
-- 2. RLS y mínimo privilegio
-- ---------------------------------------------------------------------------

alter table public.caja_operaciones enable row level security;
alter table public.arqueos_caja enable row level security;
alter table public.arqueos_caja_anulaciones enable row level security;
alter table public.devoluciones_venta enable row level security;
alter table public.devoluciones_proveedor enable row level security;

drop policy if exists pm08_caja_select on public.caja_operaciones;
create policy pm08_caja_select on public.caja_operaciones
  for select to authenticated
  using (private.la_tiene_local(empresa_id, local_id));

drop policy if exists pm08_arqueos_select on public.arqueos_caja;
create policy pm08_arqueos_select on public.arqueos_caja
  for select to authenticated
  using (private.la_tiene_local(empresa_id, local_id));

drop policy if exists pm08_arqueos_anulaciones_select on public.arqueos_caja_anulaciones;
create policy pm08_arqueos_anulaciones_select on public.arqueos_caja_anulaciones
  for select to authenticated
  using (private.la_tiene_local(empresa_id, local_id));

drop policy if exists pm08_devoluciones_venta_select on public.devoluciones_venta;
create policy pm08_devoluciones_venta_select on public.devoluciones_venta
  for select to authenticated
  using (private.la_tiene_local(empresa_id, local_id));

drop policy if exists pm08_devoluciones_proveedor_select on public.devoluciones_proveedor;
create policy pm08_devoluciones_proveedor_select on public.devoluciones_proveedor
  for select to authenticated
  using (private.la_tiene_local(empresa_id, local_id));

revoke all on public.caja_operaciones from anon;
revoke all on public.arqueos_caja from anon;
revoke all on public.arqueos_caja_anulaciones from anon;
revoke all on public.devoluciones_venta from anon;
revoke all on public.devoluciones_proveedor from anon;

revoke insert, update, delete on public.caja_operaciones from authenticated;
revoke insert, update, delete on public.arqueos_caja from authenticated;
revoke insert, update, delete on public.arqueos_caja_anulaciones from authenticated;
revoke insert, update, delete on public.devoluciones_venta from authenticated;
revoke insert, update, delete on public.devoluciones_proveedor from authenticated;

grant select on public.caja_operaciones to authenticated;
grant select on public.arqueos_caja to authenticated;
grant select on public.arqueos_caja_anulaciones to authenticated;
grant select on public.devoluciones_venta to authenticated;
grant select on public.devoluciones_proveedor to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Helpers internos
-- ---------------------------------------------------------------------------

create or replace function private.pm08_puede_operar_caja()
returns boolean
language sql
stable security definer
set search_path = 'public','auth','private','pg_temp'
as $$
  select private.la_usuario_activo()
     and coalesce(private.la_rol(),'') in ('Propietario','Encargado','Cajero/a');
$$;

create or replace function private.pm08_puede_corregir_caja()
returns boolean
language sql
stable security definer
set search_path = 'public','auth','private','pg_temp'
as $$
  select private.la_usuario_activo()
     and coalesce(private.la_rol(),'') in ('Propietario','Encargado');
$$;

create or replace function private.pm08_local_operable(p_empresa_id text, p_local_id text)
returns boolean
language sql
stable security definer
set search_path = 'public','auth','private','pg_temp'
as $$
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
$$;

create or replace function private.pm08_validar_json_objeto(
  p_valor jsonb,
  p_max_bytes integer default 16384
) returns jsonb
language plpgsql
immutable
set search_path = 'pg_catalog','pg_temp'
as $$
declare v jsonb := coalesce(p_valor,'{}'::jsonb);
begin
  if p_max_bytes is null or p_max_bytes < 2 or p_max_bytes > 1048576 then
    raise exception 'limite_json_invalido';
  end if;
  if jsonb_typeof(v) <> 'object' then
    raise exception 'json_debe_ser_objeto';
  end if;
  if pg_column_size(v) > p_max_bytes then
    raise exception 'json_demasiado_grande';
  end if;
  return v;
end;
$$;

create or replace function private.pm08_validar_operation_id(p_operation_id text)
returns text
language plpgsql
immutable
set search_path = 'pg_catalog','pg_temp'
as $$
declare v text := btrim(coalesce(p_operation_id,''));
begin
  if v !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$' then
    raise exception 'operation_id_invalido';
  end if;
  return v;
end;
$$;

create or replace function private.pm08_validar_dinero(
  p_importe numeric,
  p_permite_cero boolean default false,
  p_permite_negativo boolean default false
) returns numeric
language plpgsql
immutable
set search_path = 'pg_catalog','pg_temp'
as $$
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
end;
$$;

create or replace function private.pm08_bloquear_operation_id(p_operation_id text)
returns void
language plpgsql
volatile
set search_path = 'pg_catalog','pg_temp'
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('la-suite-pm08:' || p_operation_id, 0));
end;
$$;

revoke all on function private.pm08_puede_operar_caja() from public, anon, authenticated;
revoke all on function private.pm08_puede_corregir_caja() from public, anon, authenticated;
revoke all on function private.pm08_local_operable(text,text) from public, anon, authenticated;
revoke all on function private.pm08_validar_json_objeto(jsonb,integer) from public, anon, authenticated;
revoke all on function private.pm08_validar_operation_id(text) from public, anon, authenticated;
revoke all on function private.pm08_validar_dinero(numeric,boolean,boolean) from public, anon, authenticated;
revoke all on function private.pm08_bloquear_operation_id(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Entrada / retirada de caja y reverso trazable
-- ---------------------------------------------------------------------------

create or replace function public.registrar_movimiento_caja(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_fecha date,
  p_tipo text,
  p_importe numeric,
  p_concepto text default null,
  p_datos jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = 'public','auth','private','pg_temp'
as $$
declare
  v_operation_id text;
  v_tipo text;
  v_importe numeric;
  v_concepto text;
  v_datos jsonb;
  v_payload jsonb;
  v_existente public.caja_operaciones%rowtype;
  v_nuevo public.caja_operaciones%rowtype;
begin
  if auth.uid() is null or not private.pm08_puede_operar_caja() then
    raise exception 'caja_no_autorizada';
  end if;
  if p_empresa_id is null or p_local_id is null
     or not private.la_tiene_empresa(p_empresa_id)
     or not private.la_tiene_local(p_empresa_id,p_local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if p_fecha is null then raise exception 'fecha_requerida'; end if;

  v_operation_id := private.pm08_validar_operation_id(p_operation_id);
  v_tipo := upper(btrim(coalesce(p_tipo,'')));
  if v_tipo = 'SALIDA' then v_tipo := 'RETIRADA'; end if;
  if v_tipo not in ('ENTRADA','RETIRADA') then raise exception 'tipo_caja_invalido'; end if;
  v_importe := private.pm08_validar_dinero(p_importe,false,false);
  v_concepto := left(coalesce(nullif(btrim(p_concepto),''),case when v_tipo='ENTRADA' then 'Entrada manual' else 'Retirada manual' end),500);
  v_datos := private.pm08_validar_json_objeto(p_datos,16384);
  v_payload := jsonb_build_object(
    'empresaId',p_empresa_id,'localId',p_local_id,'fecha',p_fecha,
    'tipo',v_tipo,'importe',v_importe,'concepto',v_concepto,
    'datos',v_datos
  );

  perform private.pm08_bloquear_operation_id(v_operation_id);
  select * into v_existente from public.caja_operaciones where operation_id=v_operation_id;
  if found then
    if v_existente.tipo=v_tipo and v_existente.payload=v_payload then
      return jsonb_build_object('ok',true,'replayed',true,'movimiento',to_jsonb(v_existente));
    end if;
    raise exception 'operation_id_conflict';
  end if;
  if exists(select 1 from public.stock_operaciones where operation_id=v_operation_id)
     or exists(select 1 from public.arqueos_caja where operation_id=v_operation_id)
     or exists(select 1 from public.arqueos_caja_anulaciones where operation_id=v_operation_id) then
    raise exception 'operation_id_conflict';
  end if;
  if not private.pm08_local_operable(p_empresa_id,p_local_id) then raise exception 'local_inactivo'; end if;
  if exists(
    select 1 from public.arqueos_caja
     where empresa_id=p_empresa_id and local_id=p_local_id and fecha=p_fecha and estado='ACTIVO'
  ) then raise exception 'periodo_caja_cerrado'; end if;

  insert into public.caja_operaciones(
    operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
    medio_pago,concepto,origen_tipo,origen_id,payload,actor_user_id
  ) values (
    v_operation_id,v_tipo,p_empresa_id,p_local_id,p_fecha,v_importe,
    case when v_tipo='ENTRADA' then v_importe else -v_importe end,
    'EFECTIVO',v_concepto,'MANUAL',null,v_payload,auth.uid()
  ) returning * into v_nuevo;

  return jsonb_build_object('ok',true,'replayed',false,'movimiento',to_jsonb(v_nuevo));
end;
$$;

create or replace function public.revertir_movimiento_caja(
  p_operation_id text,
  p_movimiento_operation_id text,
  p_motivo text,
  p_fecha date default current_date
) returns jsonb
language plpgsql
security definer
set search_path = 'public','auth','private','pg_temp'
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
  v_operation_id := private.pm08_validar_operation_id(p_operation_id);
  v_motivo := left(btrim(coalesce(p_motivo,'')),500);
  if v_motivo='' then raise exception 'motivo_requerido'; end if;
  v_fecha := coalesce(p_fecha,current_date);
  v_payload := jsonb_build_object('movimientoOperationId',p_movimiento_operation_id,'motivo',v_motivo,'fecha',v_fecha);

  perform private.pm08_bloquear_operation_id(v_operation_id);
  select * into v_existente from public.caja_operaciones where operation_id=v_operation_id;
  if found then
    if v_existente.tipo in ('REVERSO_ENTRADA','REVERSO_RETIRADA') and v_existente.payload=v_payload then
      return jsonb_build_object('ok',true,'replayed',true,'movimiento',to_jsonb(v_existente));
    end if;
    raise exception 'operation_id_conflict';
  end if;
  if exists(select 1 from public.stock_operaciones where operation_id=v_operation_id)
     or exists(select 1 from public.arqueos_caja where operation_id=v_operation_id)
     or exists(select 1 from public.arqueos_caja_anulaciones where operation_id=v_operation_id) then
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
     where empresa_id=v_original.empresa_id and local_id=v_original.local_id
       and fecha=v_fecha and estado='ACTIVO'
  ) then raise exception 'periodo_caja_cerrado'; end if;
  if exists(
    select 1 from public.caja_operaciones
     where ref_operation_id=v_original.operation_id
       and tipo in ('REVERSO_ENTRADA','REVERSO_RETIRADA')
  ) then raise exception 'movimiento_caja_ya_revertido'; end if;

  insert into public.caja_operaciones(
    operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
    medio_pago,concepto,origen_tipo,origen_id,ref_operation_id,payload,actor_user_id
  ) values (
    v_operation_id,
    case when v_original.tipo='ENTRADA' then 'REVERSO_ENTRADA' else 'REVERSO_RETIRADA' end,
    v_original.empresa_id,v_original.local_id,v_fecha,v_original.importe,
    -v_original.efecto_efectivo,'EFECTIVO',
    left('Reverso: ' || v_motivo,500),'REVERSO_CAJA',v_original.operation_id,
    v_original.operation_id,v_payload,auth.uid()
  ) returning * into v_nuevo;

  return jsonb_build_object('ok',true,'replayed',false,'movimiento',to_jsonb(v_nuevo));
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Arqueo diario por local
-- ---------------------------------------------------------------------------

create or replace function public.registrar_arqueo_caja(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_fecha date,
  p_efectivo_base numeric,
  p_efectivo_contado numeric,
  p_notas text default null,
  p_snapshot jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = 'public','auth','private','pg_temp'
as $$
declare
  v_operation_id text;
  v_base numeric;
  v_contado numeric;
  v_efectos numeric;
  v_esperado numeric;
  v_notas text;
  v_snapshot jsonb;
  v_payload jsonb;
  v_existente public.arqueos_caja%rowtype;
  v_nuevo public.arqueos_caja%rowtype;
begin
  if auth.uid() is null or not private.pm08_puede_operar_caja() then
    raise exception 'arqueo_no_autorizado';
  end if;
  if p_empresa_id is null or p_local_id is null
     or not private.la_tiene_empresa(p_empresa_id)
     or not private.la_tiene_local(p_empresa_id,p_local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if p_fecha is null then raise exception 'fecha_requerida'; end if;

  v_operation_id := private.pm08_validar_operation_id(p_operation_id);
  v_base := private.pm08_validar_dinero(p_efectivo_base,true,false);
  v_contado := private.pm08_validar_dinero(p_efectivo_contado,true,false);
  v_notas := left(btrim(coalesce(p_notas,'')),1000);
  v_snapshot := private.pm08_validar_json_objeto(p_snapshot,32768);
  v_payload := jsonb_build_object(
    'empresaId',p_empresa_id,'localId',p_local_id,'fecha',p_fecha,'alcance','DIA',
    'efectivoBase',v_base,'efectivoContado',v_contado,'notas',v_notas,
    'snapshot',v_snapshot
  );

  perform private.pm08_bloquear_operation_id(v_operation_id);
  select * into v_existente from public.arqueos_caja where operation_id=v_operation_id;
  if found then
    if v_existente.payload=v_payload then
      return jsonb_build_object('ok',true,'replayed',true,'arqueo',to_jsonb(v_existente));
    end if;
    raise exception 'operation_id_conflict';
  end if;
  if exists(select 1 from public.caja_operaciones where operation_id=v_operation_id)
     or exists(select 1 from public.stock_operaciones where operation_id=v_operation_id)
     or exists(select 1 from public.arqueos_caja_anulaciones where operation_id=v_operation_id) then
    raise exception 'operation_id_conflict';
  end if;
  if not private.pm08_local_operable(p_empresa_id,p_local_id) then raise exception 'local_inactivo'; end if;
  if exists(
    select 1 from public.arqueos_caja
     where empresa_id=p_empresa_id and local_id=p_local_id and fecha=p_fecha and estado='ACTIVO'
  ) then raise exception 'arqueo_ya_existe'; end if;

  select round(coalesce(sum(efecto_efectivo),0),2)
    into v_efectos
    from public.caja_operaciones
   where empresa_id=p_empresa_id and local_id=p_local_id and fecha=p_fecha;
  v_esperado := private.pm08_validar_dinero(v_base+v_efectos,true,true);

  begin
    insert into public.arqueos_caja(
      operation_id,empresa_id,local_id,fecha,alcance,efectivo_base,
      efectivo_esperado,efectivo_contado,diferencia,notas,snapshot,payload,
      estado,actor_user_id
    ) values (
      v_operation_id,p_empresa_id,p_local_id,p_fecha,'DIA',v_base,
      v_esperado,v_contado,v_contado-v_esperado,v_notas,
      v_snapshot,v_payload,'ACTIVO',auth.uid()
    ) returning * into v_nuevo;
  exception when unique_violation then
    raise exception 'arqueo_ya_existe';
  end;

  return jsonb_build_object('ok',true,'replayed',false,'arqueo',to_jsonb(v_nuevo),'efectosCaja',v_efectos);
end;
$$;

create or replace function public.anular_arqueo_caja(
  p_operation_id text,
  p_arqueo_operation_id text,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = 'public','auth','private','pg_temp'
as $$
declare
  v_operation_id text;
  v_motivo text;
  v_payload jsonb;
  v_original public.arqueos_caja%rowtype;
  v_existente public.arqueos_caja_anulaciones%rowtype;
  v_anulacion public.arqueos_caja_anulaciones%rowtype;
begin
  if auth.uid() is null or not private.pm08_puede_corregir_caja() then
    raise exception 'anulacion_arqueo_no_autorizada';
  end if;
  v_operation_id := private.pm08_validar_operation_id(p_operation_id);
  v_motivo := left(btrim(coalesce(p_motivo,'')),500);
  if v_motivo='' then raise exception 'motivo_requerido'; end if;
  v_payload := jsonb_build_object('arqueoOperationId',p_arqueo_operation_id,'motivo',v_motivo);

  perform private.pm08_bloquear_operation_id(v_operation_id);
  select * into v_existente from public.arqueos_caja_anulaciones where operation_id=v_operation_id;
  if found then
    if v_existente.payload=v_payload then
      select * into v_original from public.arqueos_caja where operation_id=v_existente.arqueo_operation_id;
      return jsonb_build_object('ok',true,'replayed',true,'arqueo',to_jsonb(v_original),'anulacion',to_jsonb(v_existente));
    end if;
    raise exception 'operation_id_conflict';
  end if;
  if exists(select 1 from public.caja_operaciones where operation_id=v_operation_id)
     or exists(select 1 from public.stock_operaciones where operation_id=v_operation_id)
     or exists(select 1 from public.arqueos_caja where operation_id=v_operation_id) then
    raise exception 'operation_id_conflict';
  end if;

  select * into v_original from public.arqueos_caja
   where operation_id=p_arqueo_operation_id for update;
  if not found then raise exception 'arqueo_no_encontrado'; end if;
  if not private.la_tiene_local(v_original.empresa_id,v_original.local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if v_original.estado <> 'ACTIVO' then raise exception 'arqueo_ya_anulado'; end if;

  insert into public.arqueos_caja_anulaciones(
    operation_id,arqueo_operation_id,empresa_id,local_id,motivo,payload,actor_user_id
  ) values (
    v_operation_id,v_original.operation_id,v_original.empresa_id,v_original.local_id,
    v_motivo,v_payload,auth.uid()
  ) returning * into v_anulacion;

  update public.arqueos_caja
     set estado='ANULADO',anulado_por_operation_id=v_operation_id,
         anulado_motivo=v_motivo,anulado_actor_user_id=auth.uid(),anulado_at=now()
   where operation_id=v_original.operation_id
   returning * into v_original;

  return jsonb_build_object('ok',true,'replayed',false,'arqueo',to_jsonb(v_original),'anulacion',to_jsonb(v_anulacion));
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Devolución de cliente: stock + reembolso en una sola transacción
-- ---------------------------------------------------------------------------

create or replace function public.registrar_devolucion_venta(
  p_operation_id text,
  p_venta_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_producto_id text,
  p_cantidad numeric,
  p_reembolso numeric,
  p_medio_reembolso text,
  p_motivo text,
  p_fecha date,
  p_datos jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = 'public','auth','private','pg_temp'
as $$
declare
  v_operation_id text;
  v_cantidad numeric;
  v_reembolso numeric;
  v_medio text;
  v_motivo text;
  v_datos jsonb;
  v_payload jsonb;
  v_operacion_existente public.stock_operaciones%rowtype;
  v_venta public.stock_operaciones%rowtype;
  v_linea public.movimientos_stock%rowtype;
  v_stock public.stock_ubicacion%rowtype;
  v_movimiento public.movimientos_stock%rowtype;
  v_devolucion public.devoluciones_venta%rowtype;
  v_caja public.caja_operaciones%rowtype;
  v_cantidad_devuelta numeric;
  v_reembolsado numeric;
  v_ingreso_unitario numeric := 0;
  v_iva numeric := 0;
  v_bruto_unitario numeric := 0;
  v_tope_reembolso numeric := 0;
begin
  if auth.uid() is null or not private.pm08_puede_operar_caja() then
    raise exception 'devolucion_no_autorizada';
  end if;
  if p_empresa_id is null or p_local_id is null
     or not private.la_tiene_empresa(p_empresa_id)
     or not private.la_tiene_local(p_empresa_id,p_local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if p_fecha is null then raise exception 'fecha_requerida'; end if;
  if p_producto_id is null or btrim(p_producto_id)='' then raise exception 'producto_requerido'; end if;
  if p_cantidad is null or p_cantidad::text in ('NaN','Infinity','-Infinity') or p_cantidad<=0 or p_cantidad>999999999999 then
    raise exception 'cantidad_invalida';
  end if;

  v_operation_id := private.pm08_validar_operation_id(p_operation_id);
  v_reembolso := private.pm08_validar_dinero(p_reembolso,true,false);
  v_medio := upper(btrim(coalesce(p_medio_reembolso,'')));
  v_motivo := left(btrim(coalesce(p_motivo,'')),500);
  if v_motivo='' then raise exception 'motivo_requerido'; end if;
  if v_reembolso=0 and v_medio<>'SIN_REEMBOLSO' then raise exception 'medio_reembolso_invalido'; end if;
  if v_reembolso>0 and v_medio not in ('EFECTIVO','TARJETA','TRANSFERENCIA','OTRO') then raise exception 'medio_reembolso_invalido'; end if;
  v_datos := private.pm08_validar_json_objeto(p_datos,16384);

  -- La cantidad no se redondea: la precisión del producto se valida tras bloquear stock.
  v_payload := jsonb_build_object(
    'ventaOperationId',p_venta_operation_id,'empresaId',p_empresa_id,
    'localId',p_local_id,'productoId',p_producto_id,'cantidad',p_cantidad,
    'reembolso',v_reembolso,'medioReembolso',v_medio,'motivo',v_motivo,
    'fecha',p_fecha,'datos',v_datos
  );

  perform private.pm08_bloquear_operation_id(v_operation_id);
  select * into v_operacion_existente from public.stock_operaciones where operation_id=v_operation_id;
  if found then
    if v_operacion_existente.tipo='DEVOLUCION_CLIENTE' and v_operacion_existente.payload=v_payload then
      select * into v_devolucion from public.devoluciones_venta where operation_id=v_operation_id;
      select * into v_caja from public.caja_operaciones where operation_id=v_operation_id;
      return jsonb_build_object('ok',true,'replayed',true,'devolucion',to_jsonb(v_devolucion),'movimientoCaja',case when v_caja.operation_id is null then null else to_jsonb(v_caja) end);
    end if;
    raise exception 'operation_id_conflict';
  end if;
  if exists(select 1 from public.caja_operaciones where operation_id=v_operation_id)
     or exists(select 1 from public.arqueos_caja where operation_id=v_operation_id)
     or exists(select 1 from public.arqueos_caja_anulaciones where operation_id=v_operation_id) then
    raise exception 'operation_id_conflict';
  end if;

  -- Todas las devoluciones/anulaciones de una venta se serializan sobre esta fila.
  select * into v_venta from public.stock_operaciones
   where operation_id=p_venta_operation_id and tipo='VENTA' for update;
  if not found then raise exception 'venta_no_encontrada'; end if;
  if v_venta.empresa_id<>p_empresa_id or v_venta.local_id<>p_local_id then
    raise exception 'venta_fuera_de_contexto';
  end if;
  if exists(
    select 1 from public.stock_operaciones
     where tipo='REVERSO' and ref_operation_id=v_venta.operation_id
  ) then raise exception 'venta_ya_anulada'; end if;
  if not private.pm08_local_operable(p_empresa_id,p_local_id) then raise exception 'local_inactivo'; end if;

  select * into v_linea from public.movimientos_stock
   where operation_id=v_venta.operation_id and tipo='VENTA' and producto_id=p_producto_id
   for update;
  if not found then raise exception 'producto_no_pertenece_a_venta'; end if;

  select * into v_stock from public.stock_ubicacion
   where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=p_producto_id
   for update;
  if not found then raise exception 'stock_no_configurado'; end if;
  if not v_stock.local_operable then raise exception 'local_inactivo'; end if;
  v_cantidad := private.pm07_validar_cantidad(p_cantidad,v_stock.fraccionable,v_stock.precision_cantidad);

  select coalesce(sum(cantidad),0),coalesce(sum(reembolso),0)
    into v_cantidad_devuelta,v_reembolsado
    from public.devoluciones_venta
   where venta_operation_id=v_venta.operation_id and producto_id=p_producto_id;
  if v_cantidad_devuelta+v_cantidad > v_linea.cantidad then
    raise exception 'devolucion_supera_cantidad_pendiente';
  end if;

  if coalesce(v_linea.datos->>'ingresoUnitario','') ~ '^-?[0-9]+([.][0-9]+)?$' then
    v_ingreso_unitario := abs((v_linea.datos->>'ingresoUnitario')::numeric);
  end if;
  if coalesce(v_linea.datos->>'ivaVentaAplicado','') ~ '^-?[0-9]+([.][0-9]+)?$' then
    v_iva := (v_linea.datos->>'ivaVentaAplicado')::numeric;
  end if;
  v_bruto_unitario := v_ingreso_unitario * (1 + v_iva/100);
  if v_reembolso>0 and v_bruto_unitario<=0 then raise exception 'importe_venta_no_disponible'; end if;
  v_tope_reembolso := round((v_cantidad_devuelta+v_cantidad)*v_bruto_unitario,2);
  if v_reembolsado+v_reembolso > v_tope_reembolso then
    raise exception 'reembolso_supera_importe_pendiente';
  end if;

  -- Un reembolso en efectivo no puede reescribir un día ya arqueado.
  if v_reembolso>0 and v_medio='EFECTIVO' and exists(
    select 1 from public.arqueos_caja
     where empresa_id=p_empresa_id and local_id=p_local_id and fecha=p_fecha and estado='ACTIVO'
  ) then raise exception 'periodo_caja_cerrado'; end if;

  -- Desde aquí, cualquier excepción revierte stock, devolución y caja conjuntamente.
  insert into public.stock_operaciones(
    operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id,ref_operation_id
  ) values (
    v_operation_id,'DEVOLUCION_CLIENTE',p_empresa_id,p_local_id,p_producto_id,
    v_payload,auth.uid(),v_venta.operation_id
  );

  update public.stock_ubicacion
     set piso=piso+v_cantidad,updated_at=now()
   where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=p_producto_id;

  insert into public.movimientos_stock(
    operation_id,tipo,empresa_id,local_id,producto_id,
    delta_almacen,delta_piso,delta_total,cantidad,movimiento_original_id,datos,actor_user_id
  ) values (
    v_operation_id,'DEVOLUCION_CLIENTE',p_empresa_id,p_local_id,p_producto_id,
    0,v_cantidad,v_cantidad,v_cantidad,v_linea.id,
    v_datos || jsonb_build_object(
      'motivo',v_motivo,'ventaId',v_venta.operation_id,
      'reembolso',v_reembolso,'medioReembolso',v_medio,
      'ingresoUnitario',-v_ingreso_unitario,'ivaVentaAplicado',v_iva,
      'referencia','PM-08'
    ),auth.uid()
  ) returning * into v_movimiento;

  if v_reembolso>0 then
    insert into public.caja_operaciones(
      operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
      medio_pago,concepto,origen_tipo,origen_id,payload,actor_user_id
    ) values (
      v_operation_id,'REEMBOLSO',p_empresa_id,p_local_id,p_fecha,v_reembolso,
      case when v_medio='EFECTIVO' then -v_reembolso else 0 end,
      v_medio,left('Reembolso devolución · ' || p_producto_id,500),
      'DEVOLUCION_CLIENTE',v_operation_id,v_payload,auth.uid()
    ) returning * into v_caja;
  end if;

  insert into public.devoluciones_venta(
    operation_id,venta_operation_id,empresa_id,local_id,producto_id,cantidad,
    reembolso,medio_reembolso,motivo,fecha,movimiento_stock_id,caja_operation_id,
    payload,actor_user_id
  ) values (
    v_operation_id,v_venta.operation_id,p_empresa_id,p_local_id,p_producto_id,
    v_cantidad,v_reembolso,v_medio,v_motivo,p_fecha,v_movimiento.id,
    case when v_reembolso>0 then v_operation_id else null end,v_payload,auth.uid()
  ) returning * into v_devolucion;

  return jsonb_build_object(
    'ok',true,'replayed',false,'devolucion',to_jsonb(v_devolucion),
    'movimientoStock',to_jsonb(v_movimiento),
    'movimientoCaja',case when v_caja.operation_id is null then null else to_jsonb(v_caja) end,
    'cantidadPendiente',v_linea.cantidad-v_cantidad_devuelta-v_cantidad,
    'importePendiente',greatest(0,round(v_linea.cantidad*v_bruto_unitario-v_reembolsado-v_reembolso,2))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Devolución a proveedor: salida de stock sin déficit
-- ---------------------------------------------------------------------------

create or replace function public.registrar_devolucion_proveedor(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_producto_id text,
  p_cantidad numeric,
  p_proveedor_id text,
  p_proveedor_nombre text,
  p_motivo text,
  p_fecha date,
  p_datos jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = 'public','auth','private','pg_temp'
as $$
declare
  v_operation_id text;
  v_cantidad numeric;
  v_motivo text;
  v_datos jsonb;
  v_proveedor_id text;
  v_proveedor_nombre text;
  v_payload jsonb;
  v_existente public.stock_operaciones%rowtype;
  v_stock public.stock_ubicacion%rowtype;
  v_tomar_almacen numeric;
  v_tomar_piso numeric;
  v_movimiento public.movimientos_stock%rowtype;
  v_devolucion public.devoluciones_proveedor%rowtype;
begin
  if auth.uid() is null or not private.pm07_puede_gestionar_stock() then
    raise exception 'devolucion_proveedor_no_autorizada';
  end if;
  if p_empresa_id is null or p_local_id is null
     or not private.la_tiene_empresa(p_empresa_id)
     or not private.la_tiene_local(p_empresa_id,p_local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if p_fecha is null then raise exception 'fecha_requerida'; end if;
  if p_producto_id is null or btrim(p_producto_id)='' then raise exception 'producto_requerido'; end if;
  v_operation_id := private.pm08_validar_operation_id(p_operation_id);
  v_motivo := left(btrim(coalesce(p_motivo,'')),500);
  if v_motivo='' then raise exception 'motivo_requerido'; end if;
  v_datos := private.pm08_validar_json_objeto(p_datos,16384);
  v_proveedor_id := left(nullif(btrim(coalesce(p_proveedor_id,'')),''),200);
  v_proveedor_nombre := left(btrim(coalesce(p_proveedor_nombre,'')),300);

  if p_cantidad is null or p_cantidad::text in ('NaN','Infinity','-Infinity') or p_cantidad<=0 or p_cantidad>999999999999 then
    raise exception 'cantidad_invalida';
  end if;
  v_payload := jsonb_build_object(
    'empresaId',p_empresa_id,'localId',p_local_id,'productoId',p_producto_id,
    'cantidad',p_cantidad,'proveedorId',v_proveedor_id,
    'proveedorNombre',v_proveedor_nombre,
    'motivo',v_motivo,'fecha',p_fecha,'datos',v_datos
  );

  perform private.pm08_bloquear_operation_id(v_operation_id);
  select * into v_existente from public.stock_operaciones where operation_id=v_operation_id;
  if found then
    if v_existente.tipo='DEVOLUCION_PROVEEDOR' and v_existente.payload=v_payload then
      select * into v_devolucion from public.devoluciones_proveedor where operation_id=v_operation_id;
      return jsonb_build_object('ok',true,'replayed',true,'devolucion',to_jsonb(v_devolucion));
    end if;
    raise exception 'operation_id_conflict';
  end if;
  if exists(select 1 from public.caja_operaciones where operation_id=v_operation_id)
     or exists(select 1 from public.arqueos_caja where operation_id=v_operation_id)
     or exists(select 1 from public.arqueos_caja_anulaciones where operation_id=v_operation_id) then
    raise exception 'operation_id_conflict';
  end if;
  if not private.pm08_local_operable(p_empresa_id,p_local_id) then raise exception 'local_inactivo'; end if;

  select * into v_stock from public.stock_ubicacion
   where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=p_producto_id
   for update;
  if not found then raise exception 'stock_no_configurado'; end if;
  if not v_stock.local_operable then raise exception 'local_inactivo'; end if;
  v_cantidad := private.pm07_validar_cantidad(p_cantidad,v_stock.fraccionable,v_stock.precision_cantidad);
  if v_stock.almacen+v_stock.piso < v_cantidad then raise exception 'stock_insuficiente'; end if;
  v_tomar_almacen := least(v_stock.almacen,v_cantidad);
  v_tomar_piso := v_cantidad-v_tomar_almacen;

  insert into public.stock_operaciones(
    operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id
  ) values (
    v_operation_id,'DEVOLUCION_PROVEEDOR',p_empresa_id,p_local_id,p_producto_id,
    v_payload,auth.uid()
  );

  update public.stock_ubicacion
     set almacen=almacen-v_tomar_almacen,piso=piso-v_tomar_piso,updated_at=now()
   where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=p_producto_id;

  insert into public.movimientos_stock(
    operation_id,tipo,empresa_id,local_id,producto_id,
    delta_almacen,delta_piso,delta_total,cantidad,datos,actor_user_id
  ) values (
    v_operation_id,'DEVOLUCION_PROVEEDOR',p_empresa_id,p_local_id,p_producto_id,
    -v_tomar_almacen,-v_tomar_piso,-v_cantidad,v_cantidad,
    v_datos || jsonb_build_object(
      'motivo',v_motivo,'proveedorId',v_proveedor_id,
      'proveedorNombre',v_proveedor_nombre,
      'referencia','PM-08'
    ),auth.uid()
  ) returning * into v_movimiento;

  insert into public.devoluciones_proveedor(
    operation_id,empresa_id,local_id,producto_id,cantidad,proveedor_id,
    proveedor_nombre,motivo,fecha,movimiento_stock_id,payload,actor_user_id
  ) values (
    v_operation_id,p_empresa_id,p_local_id,p_producto_id,v_cantidad,
    v_proveedor_id,v_proveedor_nombre,
    v_motivo,p_fecha,v_movimiento.id,v_payload,auth.uid()
  ) returning * into v_devolucion;

  return jsonb_build_object('ok',true,'replayed',false,'devolucion',to_jsonb(v_devolucion),'movimientoStock',to_jsonb(v_movimiento));
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Evitar anular por completo una venta con devoluciones parciales
--    y serializar anulación/devolución sobre la operación de venta.
-- ---------------------------------------------------------------------------

create or replace function public.revertir_venta_stock_carrito(
  p_operation_id text,
  p_venta_operation_id text,
  p_motivo text default null
) returns jsonb
language plpgsql
security definer
set search_path='public','auth','private','pg_temp'
as $$
declare
  original_op public.stock_operaciones%rowtype;
  op public.stock_operaciones%rowtype;
  rec record;
  payload_norm jsonb;
  movimientos_json jsonb;
  datos_reverso jsonb;
begin
  if auth.uid() is null or not private.pm07_puede_gestionar_stock() then raise exception 'reverso_no_autorizado'; end if;
  p_operation_id := private.pm08_validar_operation_id(p_operation_id);
  perform private.pm08_bloquear_operation_id(p_operation_id);
  select * into original_op from public.stock_operaciones
   where operation_id=p_venta_operation_id and tipo='VENTA' for update;
  if not found then raise exception 'venta_stock_no_encontrada'; end if;
  if not private.la_tiene_local(original_op.empresa_id,original_op.local_id) then raise exception 'contexto_no_autorizado'; end if;
  payload_norm:=jsonb_build_object('ventaOperationId',p_venta_operation_id,'motivo',coalesce(p_motivo,''),'modo','CARRITO');
  select * into op from public.stock_operaciones where operation_id=p_operation_id;
  if found then
    if op.tipo='REVERSO' and op.payload=payload_norm then
      select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) into movimientos_json from public.movimientos_stock m where m.operation_id=p_operation_id;
      return jsonb_build_object('ok',true,'replayed',true,'movimientos',movimientos_json,'lineasAnuladas',jsonb_array_length(movimientos_json));
    end if;
    raise exception 'operation_id_conflict';
  end if;
  if exists(select 1 from public.caja_operaciones where operation_id=p_operation_id)
     or exists(select 1 from public.arqueos_caja where operation_id=p_operation_id)
     or exists(select 1 from public.arqueos_caja_anulaciones where operation_id=p_operation_id) then
    raise exception 'operation_id_conflict';
  end if;
  if exists(select 1 from public.stock_operaciones where tipo='REVERSO' and ref_operation_id=p_venta_operation_id) then raise exception 'venta_stock_ya_revertida'; end if;
  if exists(select 1 from public.devoluciones_venta where venta_operation_id=p_venta_operation_id) then raise exception 'venta_con_devoluciones'; end if;

  for rec in
    select distinct m.producto_id from public.movimientos_stock m
    where m.operation_id=p_venta_operation_id and m.tipo='VENTA'
    order by m.producto_id
  loop
    perform 1 from public.stock_ubicacion s
      where s.empresa_id=original_op.empresa_id and s.local_id=original_op.local_id and s.producto_id=rec.producto_id
      for update;
    if not found then raise exception 'stock_no_configurado:%',rec.producto_id; end if;
  end loop;

  insert into public.stock_operaciones(operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id,ref_operation_id)
  values(p_operation_id,'REVERSO',original_op.empresa_id,original_op.local_id,'__CARRITO__',payload_norm,auth.uid(),p_venta_operation_id);
  for rec in
    select m.* from public.movimientos_stock m
    where m.operation_id=p_venta_operation_id and m.tipo='VENTA'
    order by m.id
  loop
    if exists(select 1 from public.movimientos_stock where tipo='REVERSO' and movimiento_original_id=rec.id) then raise exception 'venta_stock_ya_revertida'; end if;
    update public.stock_ubicacion
       set almacen=almacen-rec.delta_almacen,piso=piso-rec.delta_piso,updated_at=now()
     where empresa_id=rec.empresa_id and local_id=rec.local_id and producto_id=rec.producto_id;
    datos_reverso:=coalesce(rec.datos,'{}'::jsonb)
      || jsonb_build_object('motivo',coalesce(p_motivo,''),'anulaVentaId',p_venta_operation_id,'ventaId',p_venta_operation_id);
    if rec.datos ? 'ingresoUnitario' and nullif(rec.datos->>'ingresoUnitario','') is not null then
      datos_reverso:=datos_reverso || jsonb_build_object('ingresoUnitario',-abs((rec.datos->>'ingresoUnitario')::numeric));
    end if;
    insert into public.movimientos_stock(operation_id,tipo,empresa_id,local_id,producto_id,delta_almacen,delta_piso,delta_total,cantidad,movimiento_original_id,datos,actor_user_id)
    values(p_operation_id,'REVERSO',rec.empresa_id,rec.local_id,rec.producto_id,-rec.delta_almacen,-rec.delta_piso,-rec.delta_total,rec.cantidad,rec.id,datos_reverso,auth.uid());
  end loop;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) into movimientos_json from public.movimientos_stock m where m.operation_id=p_operation_id;
  return jsonb_build_object('ok',true,'replayed',false,'movimientos',movimientos_json,'lineasAnuladas',jsonb_array_length(movimientos_json),'localId',original_op.local_id);
end;
$$;

-- La variante heredada de una sola línea también se serializa sobre la venta.
-- Aunque el frontend canónico usa la versión carrito, mantener esta RPC segura
-- evita que un cliente antiguo anule una venta mientras se registra una devolución.
create or replace function public.revertir_venta_stock(
  p_operation_id text,
  p_venta_operation_id text,
  p_motivo text default null
) returns jsonb
language plpgsql
security definer
set search_path='public','auth','private','pg_temp'
as $$
declare
  original_op public.stock_operaciones%rowtype;
  original public.movimientos_stock%rowtype;
  op public.stock_operaciones%rowtype;
  mov public.movimientos_stock%rowtype;
  payload_norm jsonb;
  datos_reverso jsonb;
  v_lineas integer;
begin
  if auth.uid() is null or not private.pm07_puede_gestionar_stock() then raise exception 'reverso_no_autorizado'; end if;
  p_operation_id := private.pm08_validar_operation_id(p_operation_id);
  perform private.pm08_bloquear_operation_id(p_operation_id);

  select * into original_op from public.stock_operaciones
   where operation_id=p_venta_operation_id and tipo='VENTA' for update;
  if not found then raise exception 'venta_stock_no_encontrada'; end if;
  if not private.la_tiene_local(original_op.empresa_id,original_op.local_id) then raise exception 'contexto_no_autorizado'; end if;

  payload_norm := jsonb_build_object('ventaOperationId',p_venta_operation_id,'motivo',coalesce(p_motivo,''));
  select * into op from public.stock_operaciones where operation_id=p_operation_id;
  if found then
    if op.tipo='REVERSO' and op.payload=payload_norm then
      select * into mov from public.movimientos_stock where operation_id=p_operation_id limit 1;
      return jsonb_build_object('ok',true,'replayed',true,'movimiento',to_jsonb(mov));
    end if;
    raise exception 'operation_id_conflict';
  end if;
  if exists(select 1 from public.caja_operaciones where operation_id=p_operation_id)
     or exists(select 1 from public.arqueos_caja where operation_id=p_operation_id)
     or exists(select 1 from public.arqueos_caja_anulaciones where operation_id=p_operation_id) then
    raise exception 'operation_id_conflict';
  end if;
  if exists(select 1 from public.stock_operaciones where tipo='REVERSO' and ref_operation_id=p_venta_operation_id) then raise exception 'venta_stock_ya_revertida'; end if;
  if exists(select 1 from public.devoluciones_venta where venta_operation_id=p_venta_operation_id) then raise exception 'venta_con_devoluciones'; end if;

  select count(*)::integer into v_lineas from public.movimientos_stock
   where operation_id=p_venta_operation_id and tipo='VENTA';
  if v_lineas<>1 then raise exception 'usar_reverso_carrito'; end if;
  select * into original from public.movimientos_stock
   where operation_id=p_venta_operation_id and tipo='VENTA' for update;
  if not found then raise exception 'venta_stock_no_encontrada'; end if;
  if exists(select 1 from public.movimientos_stock where tipo='REVERSO' and movimiento_original_id=original.id) then raise exception 'venta_stock_ya_revertida'; end if;

  perform 1 from public.stock_ubicacion
   where empresa_id=original.empresa_id and local_id=original.local_id and producto_id=original.producto_id
   for update;
  if not found then raise exception 'stock_no_configurado'; end if;

  update public.stock_ubicacion
     set almacen=almacen-original.delta_almacen,
         piso=piso-original.delta_piso,
         updated_at=now()
   where empresa_id=original.empresa_id and local_id=original.local_id and producto_id=original.producto_id;

  insert into public.stock_operaciones(operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id,ref_operation_id)
  values(p_operation_id,'REVERSO',original.empresa_id,original.local_id,original.producto_id,payload_norm,auth.uid(),p_venta_operation_id);

  datos_reverso:=coalesce(original.datos,'{}'::jsonb)
    || jsonb_build_object('motivo',coalesce(p_motivo,''),'anulaVentaId',p_venta_operation_id,'ventaId',p_venta_operation_id);
  if original.datos ? 'ingresoUnitario' and nullif(original.datos->>'ingresoUnitario','') is not null then
    datos_reverso:=datos_reverso || jsonb_build_object('ingresoUnitario',-abs((original.datos->>'ingresoUnitario')::numeric));
  end if;
  insert into public.movimientos_stock(
    operation_id,tipo,empresa_id,local_id,producto_id,delta_almacen,delta_piso,
    delta_total,cantidad,movimiento_original_id,datos,actor_user_id
  ) values (
    p_operation_id,'REVERSO',original.empresa_id,original.local_id,original.producto_id,
    -original.delta_almacen,-original.delta_piso,-original.delta_total,original.cantidad,
    original.id,datos_reverso,auth.uid()
  ) returning * into mov;

  return jsonb_build_object('ok',true,'replayed',false,'movimiento',to_jsonb(mov));
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Permisos RPC explícitos
-- ---------------------------------------------------------------------------

revoke all on function public.registrar_movimiento_caja(text,text,text,date,text,numeric,text,jsonb) from public, anon;
revoke all on function public.revertir_movimiento_caja(text,text,text,date) from public, anon;
revoke all on function public.registrar_arqueo_caja(text,text,text,date,numeric,numeric,text,jsonb) from public, anon;
revoke all on function public.anular_arqueo_caja(text,text,text) from public, anon;
revoke all on function public.registrar_devolucion_venta(text,text,text,text,text,numeric,numeric,text,text,date,jsonb) from public, anon;
revoke all on function public.registrar_devolucion_proveedor(text,text,text,text,numeric,text,text,text,date,jsonb) from public, anon;

grant execute on function public.registrar_movimiento_caja(text,text,text,date,text,numeric,text,jsonb) to authenticated;
grant execute on function public.revertir_movimiento_caja(text,text,text,date) to authenticated;
grant execute on function public.registrar_arqueo_caja(text,text,text,date,numeric,numeric,text,jsonb) to authenticated;
grant execute on function public.anular_arqueo_caja(text,text,text) to authenticated;
grant execute on function public.registrar_devolucion_venta(text,text,text,text,text,numeric,numeric,text,text,date,jsonb) to authenticated;
grant execute on function public.registrar_devolucion_proveedor(text,text,text,text,numeric,text,text,text,date,jsonb) to authenticated;

-- La función heredada sigue autorizada como en PM-07, con el nuevo bloqueo cruzado.
revoke all on function public.revertir_venta_stock_carrito(text,text,text) from public, anon;
revoke all on function public.revertir_venta_stock(text,text,text) from public, anon;
grant execute on function public.revertir_venta_stock_carrito(text,text,text) to authenticated;
grant execute on function public.revertir_venta_stock(text,text,text) to authenticated;
