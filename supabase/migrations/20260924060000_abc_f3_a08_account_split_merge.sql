-- ABC F3 A08 — dividir, unir y mover reparto comercial.
-- Aditiva. No mueve pedido_lineas entre pedidos/cuentas; conserva cocina A04/A05.
-- La fiscalización ya existente inmoviliza la cantidad correspondiente.
-- Split por importe se modela como cuota comercial; F4 consumirá esa cuota al cobrar.

do $$
declare
  v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.cuentas_comerciales') is null then v_missing:=array_append(v_missing,'cuentas_comerciales'); end if;
  if to_regclass('public.pedidos_tpv') is null then v_missing:=array_append(v_missing,'pedidos_tpv'); end if;
  if to_regclass('public.pedido_lineas') is null then v_missing:=array_append(v_missing,'pedido_lineas'); end if;
  if to_regclass('public.venta_fiscal_lineas') is null then v_missing:=array_append(v_missing,'venta_fiscal_lineas'); end if;
  if to_regclass('public.ventas_fiscales') is null then v_missing:=array_append(v_missing,'ventas_fiscales'); end if;
  if to_regclass('public.cuenta_mesa_asignaciones') is null then v_missing:=array_append(v_missing,'cuenta_mesa_asignaciones'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_terminal_sesion_operativa(text,text,uuid,uuid)') is null then v_missing:=array_append(v_missing,'abc_terminal_sesion_operativa'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('public.abc_recuperar_cuenta(text,text,uuid,uuid,uuid,date)') is null then v_missing:=array_append(v_missing,'abc_recuperar_cuenta'); end if;

  if cardinality(v_missing)>0 then
    raise exception 'ABC_F3_A08_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if to_regclass('public.cuenta_linea_repartos') is not null
     or to_regclass('public.cuenta_relaciones') is not null
     or to_regclass('public.cuenta_cuotas_importe') is not null then
    raise exception 'ABC_F3_A08_PREFLIGHT_FALLO: tablas A08 ya existen';
  end if;
end $$;

create table public.cuenta_linea_repartos(
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  source_line_id uuid not null,
  cuenta_id uuid not null,
  cantidad numeric(24,8) not null,
  descuento numeric(24,8) not null default 0,
  base numeric(24,8) not null default 0,
  impuestos numeric(24,8) not null default 0,
  total numeric(24,8) not null default 0,
  comensal_ref text,
  estado text not null default 'ACTIVO',
  version bigint not null default 1,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint a08_reparto_local_fk foreign key(empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint a08_reparto_linea_fk foreign key(source_line_id)
    references public.pedido_lineas(id) on delete restrict,
  constraint a08_reparto_cuenta_fk foreign key(cuenta_id)
    references public.cuentas_comerciales(id) on delete restrict,
  constraint a08_reparto_created_by_fk foreign key(created_by)
    references auth.users(id) on delete restrict,
  constraint a08_reparto_cantidad check(cantidad>0),
  constraint a08_reparto_importes check(
    descuento>=0 and base>=0 and impuestos>=0 and total>=0
  ),
  constraint a08_reparto_estado check(estado in ('ACTIVO','CERRADO')),
  constraint a08_reparto_cierre check(
    (estado='ACTIVO' and closed_at is null)
    or (estado='CERRADO' and closed_at is not null)
  ),
  constraint a08_reparto_version check(version>=1)
);

create unique index a08_reparto_linea_cuenta_activo_uq
  on public.cuenta_linea_repartos(empresa_id,local_id,source_line_id,cuenta_id)
  where estado='ACTIVO';

create index a08_reparto_cuenta_activo_idx
  on public.cuenta_linea_repartos(empresa_id,local_id,cuenta_id,source_line_id)
  where estado='ACTIVO';

create index a08_reparto_linea_hist_idx
  on public.cuenta_linea_repartos(empresa_id,local_id,source_line_id,created_at,id);

create table public.cuenta_relaciones(
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  cuenta_origen_id uuid not null,
  cuenta_destino_id uuid not null,
  tipo text not null,
  motivo text,
  operation_id text not null,
  actor_user_id uuid not null,
  terminal_id uuid not null,
  session_id uuid not null,
  operating_day date not null,
  created_at timestamptz not null default now(),
  constraint a08_rel_local_fk foreign key(empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint a08_rel_origen_fk foreign key(cuenta_origen_id)
    references public.cuentas_comerciales(id) on delete restrict,
  constraint a08_rel_destino_fk foreign key(cuenta_destino_id)
    references public.cuentas_comerciales(id) on delete restrict,
  constraint a08_rel_actor_fk foreign key(actor_user_id)
    references auth.users(id) on delete restrict,
  constraint a08_rel_terminal_fk foreign key(terminal_id)
    references public.terminales_tpv(id) on delete restrict,
  constraint a08_rel_session_fk foreign key(session_id)
    references public.caja_sesiones(id) on delete restrict,
  constraint a08_rel_tipo check(tipo in ('DIVISION','FUSION')),
  constraint a08_rel_distintas check(cuenta_origen_id<>cuenta_destino_id),
  constraint a08_rel_operation check(nullif(btrim(operation_id),'') is not null),
  constraint a08_rel_unica unique(
    empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,tipo
  )
);

create unique index a08_fusion_origen_unica_uq
  on public.cuenta_relaciones(empresa_id,local_id,cuenta_origen_id)
  where tipo='FUSION';

create index a08_rel_destino_idx
  on public.cuenta_relaciones(empresa_id,local_id,cuenta_destino_id,created_at,id);

create table public.cuenta_cuotas_importe(
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  cuenta_origen_id uuid not null,
  cuenta_destino_id uuid not null,
  currency_code text not null,
  importe numeric(24,8) not null,
  etiqueta text,
  estado text not null default 'ACTIVA',
  version bigint not null default 1,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint a08_cuota_local_fk foreign key(empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint a08_cuota_origen_fk foreign key(cuenta_origen_id)
    references public.cuentas_comerciales(id) on delete restrict,
  constraint a08_cuota_destino_fk foreign key(cuenta_destino_id)
    references public.cuentas_comerciales(id) on delete restrict,
  constraint a08_cuota_created_by_fk foreign key(created_by)
    references auth.users(id) on delete restrict,
  constraint a08_cuota_distintas check(cuenta_origen_id<>cuenta_destino_id),
  constraint a08_cuota_moneda check(currency_code ~ '^[A-Z]{3}$'),
  constraint a08_cuota_importe check(importe>0),
  constraint a08_cuota_estado check(estado in ('ACTIVA','CERRADA')),
  constraint a08_cuota_cierre check(
    (estado='ACTIVA' and closed_at is null)
    or (estado='CERRADA' and closed_at is not null)
  ),
  constraint a08_cuota_version check(version>=1)
);

create index a08_cuota_origen_activa_idx
  on public.cuenta_cuotas_importe(empresa_id,local_id,cuenta_origen_id,created_at,id)
  where estado='ACTIVA';

create index a08_cuota_destino_activa_idx
  on public.cuenta_cuotas_importe(empresa_id,local_id,cuenta_destino_id,created_at,id)
  where estado='ACTIVA';

alter table public.cuenta_linea_repartos enable row level security;
alter table public.cuenta_relaciones enable row level security;
alter table public.cuenta_cuotas_importe enable row level security;

create policy a08_repartos_select
on public.cuenta_linea_repartos for select to authenticated
using (private.la_tiene_local(empresa_id,local_id));

create policy a08_relaciones_select
on public.cuenta_relaciones for select to authenticated
using (private.la_tiene_local(empresa_id,local_id));

create policy a08_cuotas_select
on public.cuenta_cuotas_importe for select to authenticated
using (private.la_tiene_local(empresa_id,local_id));

revoke all on table public.cuenta_linea_repartos from public,anon,authenticated,service_role;
revoke all on table public.cuenta_relaciones from public,anon,authenticated,service_role;
revoke all on table public.cuenta_cuotas_importe from public,anon,authenticated,service_role;

grant select on table public.cuenta_linea_repartos to authenticated;
grant select on table public.cuenta_relaciones to authenticated;
grant select on table public.cuenta_cuotas_importe to authenticated;

create function private.abc_materializar_reparto_linea(
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_linea public.pedido_lineas%rowtype;
  v_cuenta_id uuid;
begin
  if exists(
    select 1
    from public.cuenta_linea_repartos r
    where r.empresa_id=p_empresa_id
      and r.local_id=p_local_id
      and r.source_line_id=p_linea_id
      and r.estado='ACTIVO'
  ) then
    return;
  end if;

  select l.*,p.cuenta_id
    into v_linea,v_cuenta_id
    from public.pedido_lineas l
    join public.pedidos_tpv p
      on p.empresa_id=l.empresa_id
     and p.local_id=l.local_id
     and p.id=l.pedido_id
   where l.empresa_id=p_empresa_id
     and l.local_id=p_local_id
     and l.id=p_linea_id
   for update of l;

  if not found then raise exception 'reparto_linea_no_encontrada'; end if;
  if v_linea.estado in ('BORRADOR','CANCELADA') then
    raise exception 'reparto_linea_no_repartible';
  end if;
  if v_linea.descuento_total is null or v_linea.base is null
     or v_linea.impuestos is null or v_linea.total is null then
    raise exception 'reparto_linea_sin_importes';
  end if;

  insert into public.cuenta_linea_repartos(
    empresa_id,local_id,source_line_id,cuenta_id,cantidad,
    descuento,base,impuestos,total,created_by
  ) values(
    p_empresa_id,p_local_id,p_linea_id,v_cuenta_id,v_linea.cantidad,
    v_linea.descuento_total,v_linea.base,v_linea.impuestos,v_linea.total,
    auth.uid()
  );
end $$;

create function private.abc_cantidad_fiscalizada_linea_cuenta(
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
  p_cuenta_id uuid
)
returns numeric
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(sum(vl.cantidad),0)::numeric
  from public.venta_fiscal_lineas vl
  join public.ventas_fiscales v
    on v.empresa_id=vl.empresa_id
   and v.local_id=vl.local_id
   and v.id=vl.venta_fiscal_id
  where vl.empresa_id=$1
    and vl.local_id=$2
    and vl.source_line_id=$3
    and v.cuenta_id=$4
    and v.estado<>'CANCELADA'
$$;

create function private.abc_total_comercial_cuenta(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid
)
returns numeric
language sql
stable
security definer
set search_path=''
as $$
  with lineas as (
    select r.total
    from public.cuenta_linea_repartos r
    join public.pedido_lineas l
      on l.id=r.source_line_id
     and l.empresa_id=r.empresa_id
     and l.local_id=r.local_id
    where r.empresa_id=$1
      and r.local_id=$2
      and r.cuenta_id=$3
      and r.estado='ACTIVO'
      and l.estado<>'CANCELADA'
    union all
    select l.total
    from public.pedido_lineas l
    join public.pedidos_tpv p
      on p.empresa_id=l.empresa_id
     and p.local_id=l.local_id
     and p.id=l.pedido_id
    where p.empresa_id=$1
      and p.local_id=$2
      and p.cuenta_id=$3
      and l.estado<>'CANCELADA'
      and not exists(
        select 1
        from public.cuenta_linea_repartos r
        where r.empresa_id=l.empresa_id
          and r.local_id=l.local_id
          and r.source_line_id=l.id
          and r.estado='ACTIVO'
      )
  ),
  qin as (
    select coalesce(sum(q.importe),0) importe
    from public.cuenta_cuotas_importe q
    where q.empresa_id=$1 and q.local_id=$2
      and q.cuenta_destino_id=$3 and q.estado='ACTIVA'
  ),
  qout as (
    select coalesce(sum(q.importe),0) importe
    from public.cuenta_cuotas_importe q
    where q.empresa_id=$1 and q.local_id=$2
      and q.cuenta_origen_id=$3 and q.estado='ACTIVA'
  )
  select (
    coalesce((select sum(total) from lineas),0)
    + (select importe from qin)
    - (select importe from qout)
  )::numeric
$$;

create function private.abc_reparto_cuenta_snapshot(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'total_comercial',private.abc_total_comercial_cuenta($1,$2,$3),
    'lineas',coalesce((
      select jsonb_agg(x.obj order by x.pedido_id,x.linea_id)
      from (
        select
          l.pedido_id,
          l.id linea_id,
          jsonb_build_object(
            'source_line_id',l.id,
            'pedido_id',l.pedido_id,
            'producto_id',l.producto_id,
            'estado_linea',l.estado,
            'linea_version',l.version,
            'cuenta_origen_pedido',p.cuenta_id,
            'cuenta_reparto_id',r.cuenta_id,
            'cantidad',r.cantidad,
            'descuento',r.descuento,
            'base',r.base,
            'impuestos',r.impuestos,
            'total',r.total,
            'comensal_ref',r.comensal_ref,
            'reparto_version',r.version,
            'materializado',true,
            'cantidad_fiscalizada',
              private.abc_cantidad_fiscalizada_linea_cuenta(
                r.empresa_id,r.local_id,r.source_line_id,r.cuenta_id
              )
          ) obj
        from public.cuenta_linea_repartos r
        join public.pedido_lineas l
          on l.empresa_id=r.empresa_id
         and l.local_id=r.local_id
         and l.id=r.source_line_id
        join public.pedidos_tpv p
          on p.empresa_id=l.empresa_id
         and p.local_id=l.local_id
         and p.id=l.pedido_id
        where r.empresa_id=$1 and r.local_id=$2
          and r.cuenta_id=$3 and r.estado='ACTIVO'
          and l.estado<>'CANCELADA'
        union all
        select
          l.pedido_id,
          l.id,
          jsonb_build_object(
            'source_line_id',l.id,
            'pedido_id',l.pedido_id,
            'producto_id',l.producto_id,
            'estado_linea',l.estado,
            'linea_version',l.version,
            'cuenta_origen_pedido',p.cuenta_id,
            'cuenta_reparto_id',p.cuenta_id,
            'cantidad',l.cantidad,
            'descuento',l.descuento_total,
            'base',l.base,
            'impuestos',l.impuestos,
            'total',l.total,
            'comensal_ref',null,
            'reparto_version',null,
            'materializado',false,
            'cantidad_fiscalizada',
              private.abc_cantidad_fiscalizada_linea_cuenta(
                l.empresa_id,l.local_id,l.id,p.cuenta_id
              )
          )
        from public.pedido_lineas l
        join public.pedidos_tpv p
          on p.empresa_id=l.empresa_id
         and p.local_id=l.local_id
         and p.id=l.pedido_id
        where p.empresa_id=$1 and p.local_id=$2
          and p.cuenta_id=$3 and l.estado<>'CANCELADA'
          and not exists(
            select 1
            from public.cuenta_linea_repartos r
            where r.empresa_id=l.empresa_id
              and r.local_id=l.local_id
              and r.source_line_id=l.id
              and r.estado='ACTIVO'
          )
      ) x
    ),'[]'::jsonb),
    'cuotas_entrantes',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',q.id,'cuenta_origen_id',q.cuenta_origen_id,
          'importe',q.importe,'currency_code',q.currency_code,
          'etiqueta',q.etiqueta,'version',q.version,'created_at',q.created_at
        ) order by q.created_at,q.id
      )
      from public.cuenta_cuotas_importe q
      where q.empresa_id=$1 and q.local_id=$2
        and q.cuenta_destino_id=$3 and q.estado='ACTIVA'
    ),'[]'::jsonb),
    'cuotas_salientes',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',q.id,'cuenta_destino_id',q.cuenta_destino_id,
          'importe',q.importe,'currency_code',q.currency_code,
          'etiqueta',q.etiqueta,'version',q.version,'created_at',q.created_at
        ) order by q.created_at,q.id
      )
      from public.cuenta_cuotas_importe q
      where q.empresa_id=$1 and q.local_id=$2
        and q.cuenta_origen_id=$3 and q.estado='ACTIVA'
    ),'[]'::jsonb),
    'relaciones',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',r.id,'tipo',r.tipo,
          'cuenta_origen_id',r.cuenta_origen_id,
          'cuenta_destino_id',r.cuenta_destino_id,
          'motivo',r.motivo,'operation_id',r.operation_id,
          'created_at',r.created_at
        ) order by r.created_at,r.id
      )
      from public.cuenta_relaciones r
      where r.empresa_id=$1 and r.local_id=$2
        and (r.cuenta_origen_id=$3 or r.cuenta_destino_id=$3)
    ),'[]'::jsonb)
  )
$$;

create function private.abc_guard_cancelacion_reparto()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_cuenta_origen uuid;
begin
  if new.estado='CANCELADA' and old.estado<>'CANCELADA' then
    select p.cuenta_id
      into v_cuenta_origen
      from public.pedidos_tpv p
     where p.empresa_id=new.empresa_id
       and p.local_id=new.local_id
       and p.id=new.pedido_id;

    if exists(
      select 1
      from public.cuenta_linea_repartos r
      where r.empresa_id=new.empresa_id
        and r.local_id=new.local_id
        and r.source_line_id=new.id
        and r.estado='ACTIVO'
        and r.cuenta_id<>v_cuenta_origen
    ) then
      raise exception 'reparto_activo_impide_cancelacion';
    end if;

    if exists(
      select 1
      from public.cuenta_cuotas_importe q
      where q.empresa_id=new.empresa_id
        and q.local_id=new.local_id
        and q.estado='ACTIVA'
        and (
          q.cuenta_origen_id=v_cuenta_origen
          or q.cuenta_destino_id=v_cuenta_origen
        )
    ) then
      raise exception 'cuota_activa_impide_cancelacion';
    end if;
  end if;
  return new;
end $$;

create trigger a08_guard_cancelacion_reparto
before update of estado on public.pedido_lineas
for each row execute function private.abc_guard_cancelacion_reparto();

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
    when 'ABC_CUENTA_REASIGNAR' then
      v_rol in ('Propietario','Encargado')
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
    when 'ABC_PEDIDO_ENVIAR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_PREPARACION_INICIAR' then
      v_rol in ('Propietario','Encargado','Camarero/a','Churrero/a')
    when 'ABC_PREPARACION_COMPLETAR' then
      v_rol in ('Propietario','Encargado','Camarero/a','Churrero/a')
    when 'ABC_PEDIDO_SERVIR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_LINEA_CANCELAR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_CANCELACION_SENSIBLE' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_PEDIDO_CANCELAR' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_PEDIDO_CERRAR' then
      v_rol in ('Propietario','Encargado','Cajero/a')
    when 'ABC_SALA_VER' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_SALA_CONFIGURAR' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_MESA_ASIGNAR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_MESA_RESERVAR' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_MESA_BLOQUEAR' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_CUENTA_REPARTIR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_CUENTA_UNIR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_REPARTO_REVERTIR' then
      v_rol in ('Propietario','Encargado')
    else false
  end;
end $$;





create function public.abc_mover_cantidad_linea_cuenta(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
  p_cuenta_origen_id uuid,
  p_cuenta_destino_id uuid,
  p_cantidad numeric,
  p_comensal_ref text,
  p_expected_origen_version bigint,
  p_expected_destino_version bigint,
  p_expected_linea_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_origen public.cuentas_comerciales%rowtype;
  v_destino public.cuentas_comerciales%rowtype;
  v_linea public.pedido_lineas%rowtype;
  v_src public.cuenta_linea_repartos%rowtype;
  v_dst public.cuenta_linea_repartos%rowtype;
  v_request jsonb; v_cmd jsonb; v_result jsonb;
  v_fiscalizada numeric;
  v_ratio numeric(32,16);
  v_desc numeric(24,8); v_base numeric(24,8); v_tax numeric(24,8); v_total numeric(24,8);
  v_src_new_version bigint; v_dst_new_version bigint;
  v_origen_new_version bigint; v_destino_new_version bigint;
  v_fraccionable boolean;
  v_precision integer;
  v_comensal text:=nullif(btrim(coalesce(p_comensal_ref,'')),'');
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_REPARTIR') then
    raise exception 'reparto_cuenta_no_autorizado';
  end if;
  if p_linea_id is null or p_cuenta_origen_id is null or p_cuenta_destino_id is null
     or p_cuenta_origen_id=p_cuenta_destino_id
     or p_cantidad is null or p_cantidad<=0
     or p_expected_origen_version is null or p_expected_destino_version is null
     or p_expected_linea_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'reparto_parametros_invalidos';
  end if;
  if p_cantidad<>round(p_cantidad,8) then raise exception 'reparto_cantidad_precision_maxima'; end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then raise exception 'terminal_sesion_no_operativa'; end if;

  v_request:=jsonb_build_object(
    'linea_id',p_linea_id,'cuenta_origen_id',p_cuenta_origen_id,
    'cuenta_destino_id',p_cuenta_destino_id,'cantidad',p_cantidad,
    'comensal_ref',v_comensal,
    'expected_origen_version',p_expected_origen_version,
    'expected_destino_version',p_expected_destino_version,
    'expected_linea_version',p_expected_linea_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_MOVER_CANTIDAD_LINEA_CUENTA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  perform 1
  from public.cuentas_comerciales c
  where c.empresa_id=p_empresa_id and c.local_id=p_local_id
    and c.id in (p_cuenta_origen_id,p_cuenta_destino_id)
  order by c.id
  for update;

  select * into v_origen
  from public.cuentas_comerciales
  where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_origen_id;
  select * into v_destino
  from public.cuentas_comerciales
  where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_destino_id;

  if v_origen.id is null or v_destino.id is null then raise exception 'reparto_cuenta_no_encontrada'; end if;
  if v_origen.estado<>'ABIERTA' or v_destino.estado<>'ABIERTA' then raise exception 'reparto_cuenta_no_abierta'; end if;
  if v_origen.version<>p_expected_origen_version then raise exception 'cuenta_origen_version_conflict'; end if;
  if v_destino.version<>p_expected_destino_version then raise exception 'cuenta_destino_version_conflict'; end if;
  if v_origen.currency_code<>v_destino.currency_code then raise exception 'reparto_moneda_incompatible'; end if;
  if v_origen.opened_operating_day<>p_operating_day
     or v_destino.opened_operating_day<>p_operating_day then
    raise exception 'reparto_operating_day_incompatible';
  end if;

  if exists(
    select 1 from public.cuenta_cuotas_importe q
    where q.empresa_id=p_empresa_id and q.local_id=p_local_id
      and q.estado='ACTIVA'
      and (
        q.cuenta_origen_id in (p_cuenta_origen_id,p_cuenta_destino_id)
        or q.cuenta_destino_id in (p_cuenta_origen_id,p_cuenta_destino_id)
      )
  ) then raise exception 'cuota_activa_incompatible_con_reparto_linea'; end if;

  select * into v_linea
  from public.pedido_lineas
  where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id
  for update;
  if not found then raise exception 'reparto_linea_no_encontrada'; end if;
  if v_linea.version<>p_expected_linea_version then raise exception 'linea_version_conflict'; end if;
  if v_linea.estado in ('BORRADOR','CANCELADA') then raise exception 'reparto_linea_no_repartible'; end if;

  v_fraccionable:=coalesce((v_linea.snapshot_comercial->>'fraccionable')::boolean,false);
  v_precision:=coalesce((v_linea.snapshot_comercial->>'precision_cantidad')::integer,0);
  if not v_fraccionable and p_cantidad<>trunc(p_cantidad) then
    raise exception 'reparto_cantidad_no_fraccionable';
  end if;
  if round(p_cantidad,v_precision)<>p_cantidad then
    raise exception 'reparto_cantidad_precision_invalida';
  end if;

  perform private.abc_materializar_reparto_linea(p_empresa_id,p_local_id,p_linea_id);

  select * into v_src
  from public.cuenta_linea_repartos
  where empresa_id=p_empresa_id and local_id=p_local_id
    and source_line_id=p_linea_id
    and cuenta_id=p_cuenta_origen_id
    and estado='ACTIVO'
  for update;
  if not found then raise exception 'cuenta_origen_sin_reparto_linea'; end if;
  if p_cantidad>v_src.cantidad then raise exception 'reparto_cantidad_excede_disponible'; end if;

  v_fiscalizada:=private.abc_cantidad_fiscalizada_linea_cuenta(
    p_empresa_id,p_local_id,p_linea_id,p_cuenta_origen_id
  );
  if v_src.cantidad-p_cantidad<v_fiscalizada then
    raise exception 'reparto_parte_fiscalizada_inmovil';
  end if;

  select * into v_dst
  from public.cuenta_linea_repartos
  where empresa_id=p_empresa_id and local_id=p_local_id
    and source_line_id=p_linea_id
    and cuenta_id=p_cuenta_destino_id
    and estado='ACTIVO'
  for update;

  if found and v_dst.comensal_ref is distinct from v_comensal
     and v_dst.comensal_ref is not null and v_comensal is not null then
    raise exception 'reparto_comensal_conflict';
  end if;

  if p_cantidad=v_src.cantidad then
    v_desc:=v_src.descuento; v_base:=v_src.base;
    v_tax:=v_src.impuestos; v_total:=v_src.total;
  else
    v_ratio:=p_cantidad/v_src.cantidad;
    v_desc:=round(v_src.descuento*v_ratio,8);
    v_base:=round(v_src.base*v_ratio,8);
    v_total:=round(v_src.total*v_ratio,8);
    v_tax:=(v_total-v_base)::numeric(24,8);
  end if;

  if p_cantidad=v_src.cantidad then
    update public.cuenta_linea_repartos
       set estado='CERRADO',closed_at=now(),version=version+1
     where id=v_src.id
    returning version into v_src_new_version;
  else
    update public.cuenta_linea_repartos
       set cantidad=cantidad-p_cantidad,
           descuento=descuento-v_desc,
           base=base-v_base,
           impuestos=impuestos-v_tax,
           total=total-v_total,
           version=version+1
     where id=v_src.id
    returning version into v_src_new_version;
  end if;

  if v_dst.id is null then
    insert into public.cuenta_linea_repartos(
      empresa_id,local_id,source_line_id,cuenta_id,cantidad,
      descuento,base,impuestos,total,comensal_ref,created_by
    ) values(
      p_empresa_id,p_local_id,p_linea_id,p_cuenta_destino_id,p_cantidad,
      v_desc,v_base,v_tax,v_total,v_comensal,auth.uid()
    )
    returning version into v_dst_new_version;
  else
    update public.cuenta_linea_repartos
       set cantidad=cantidad+p_cantidad,
           descuento=descuento+v_desc,
           base=base+v_base,
           impuestos=impuestos+v_tax,
           total=total+v_total,
           comensal_ref=coalesce(comensal_ref,v_comensal),
           version=version+1
     where id=v_dst.id
    returning version into v_dst_new_version;
  end if;

  insert into public.cuenta_relaciones(
    empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,tipo,motivo,
    operation_id,actor_user_id,terminal_id,session_id,operating_day
  ) values(
    p_empresa_id,p_local_id,p_cuenta_origen_id,p_cuenta_destino_id,'DIVISION',
    'REPARTO_LINEA',p_operation_id,auth.uid(),p_terminal_id,p_session_id,p_operating_day
  )
  on conflict(empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,tipo) do nothing;

  update public.cuentas_comerciales
     set version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_origen_id
  returning version into v_origen_new_version;

  update public.cuentas_comerciales
     set version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_destino_id
  returning version into v_destino_new_version;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values(
    p_empresa_id,p_local_id,p_operation_id,'PEDIDO_LINEA',p_linea_id::text,
    'CUENTA_REPARTO_LINEA_MOVIDO',
    jsonb_build_object(
      'cuenta_origen_id',p_cuenta_origen_id,
      'cuenta_destino_id',p_cuenta_destino_id,
      'cantidad',p_cantidad,
      'descuento',v_desc,'base',v_base,'impuestos',v_tax,'total',v_total,
      'comensal_ref',v_comensal,
      'cuenta_origen_version',v_origen_new_version,
      'cuenta_destino_version',v_destino_new_version,
      'linea_version',v_linea.version,
      'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'linea_id',p_linea_id,
    'cuenta_origen_id',p_cuenta_origen_id,
    'cuenta_destino_id',p_cuenta_destino_id,
    'cantidad',p_cantidad,'total',v_total,
    'comensal_ref',v_comensal,
    'cuenta_origen_version',v_origen_new_version,
    'cuenta_destino_version',v_destino_new_version,
    'linea_version',v_linea.version
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_asignar_cuota_importe(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cuenta_origen_id uuid,
  p_cuenta_destino_id uuid,
  p_importe numeric,
  p_etiqueta text,
  p_expected_origen_version bigint,
  p_expected_destino_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_origen public.cuentas_comerciales%rowtype;
  v_destino public.cuentas_comerciales%rowtype;
  v_request jsonb; v_cmd jsonb; v_result jsonb;
  v_cuota_id uuid:=gen_random_uuid();
  v_origen_new bigint; v_destino_new bigint;
  v_disponible numeric;
  v_etiqueta text:=nullif(btrim(coalesce(p_etiqueta,'')),'');
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_REPARTIR') then
    raise exception 'cuota_importe_no_autorizada';
  end if;
  if p_cuenta_origen_id is null or p_cuenta_destino_id is null
     or p_cuenta_origen_id=p_cuenta_destino_id
     or p_importe is null or p_importe<=0 or p_importe<>round(p_importe,8)
     or p_expected_origen_version is null or p_expected_destino_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'cuota_importe_parametros_invalidos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then raise exception 'terminal_sesion_no_operativa'; end if;

  v_request:=jsonb_build_object(
    'cuenta_origen_id',p_cuenta_origen_id,'cuenta_destino_id',p_cuenta_destino_id,
    'importe',p_importe,'etiqueta',v_etiqueta,
    'expected_origen_version',p_expected_origen_version,
    'expected_destino_version',p_expected_destino_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_ASIGNAR_CUOTA_IMPORTE',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  perform 1
  from public.cuentas_comerciales c
  where c.empresa_id=p_empresa_id and c.local_id=p_local_id
    and c.id in(p_cuenta_origen_id,p_cuenta_destino_id)
  order by c.id for update;

  select * into v_origen from public.cuentas_comerciales
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_origen_id;
  select * into v_destino from public.cuentas_comerciales
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_destino_id;

  if v_origen.id is null or v_destino.id is null then raise exception 'cuota_cuenta_no_encontrada'; end if;
  if v_origen.estado<>'ABIERTA' or v_destino.estado<>'ABIERTA' then raise exception 'cuota_cuenta_no_abierta'; end if;
  if v_origen.version<>p_expected_origen_version then raise exception 'cuenta_origen_version_conflict'; end if;
  if v_destino.version<>p_expected_destino_version then raise exception 'cuenta_destino_version_conflict'; end if;
  if v_origen.currency_code<>v_destino.currency_code then raise exception 'cuota_moneda_incompatible'; end if;
  if v_origen.opened_operating_day<>p_operating_day
     or v_destino.opened_operating_day<>p_operating_day then raise exception 'cuota_operating_day_incompatible'; end if;

  if exists(
    select 1 from public.ventas_fiscales v
    where v.empresa_id=p_empresa_id and v.local_id=p_local_id
      and v.cuenta_id in(p_cuenta_origen_id,p_cuenta_destino_id)
  ) then raise exception 'cuota_cuenta_con_fiscalizacion'; end if;

  if exists(
    select 1
    from public.cuenta_linea_repartos r
    join public.pedido_lineas l
      on l.empresa_id=r.empresa_id and l.local_id=r.local_id and l.id=r.source_line_id
    join public.pedidos_tpv p
      on p.empresa_id=l.empresa_id and p.local_id=l.local_id and p.id=l.pedido_id
    where r.empresa_id=p_empresa_id and r.local_id=p_local_id
      and r.estado='ACTIVO'
      and (
        r.cuenta_id in(p_cuenta_origen_id,p_cuenta_destino_id)
        or p.cuenta_id in(p_cuenta_origen_id,p_cuenta_destino_id)
      )
      and r.cuenta_id<>p.cuenta_id
  ) then raise exception 'reparto_linea_activo_incompatible_con_cuota'; end if;

  v_disponible:=private.abc_total_comercial_cuenta(
    p_empresa_id,p_local_id,p_cuenta_origen_id
  );
  if p_importe>v_disponible then raise exception 'cuota_importe_excede_disponible'; end if;

  insert into public.cuenta_cuotas_importe(
    id,empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,
    currency_code,importe,etiqueta,created_by
  ) values(
    v_cuota_id,p_empresa_id,p_local_id,p_cuenta_origen_id,p_cuenta_destino_id,
    v_origen.currency_code,p_importe,v_etiqueta,auth.uid()
  );

  insert into public.cuenta_relaciones(
    empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,tipo,motivo,
    operation_id,actor_user_id,terminal_id,session_id,operating_day
  ) values(
    p_empresa_id,p_local_id,p_cuenta_origen_id,p_cuenta_destino_id,'DIVISION',
    'CUOTA_IMPORTE',p_operation_id,auth.uid(),p_terminal_id,p_session_id,p_operating_day
  )
  on conflict(empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,tipo) do nothing;

  update public.cuentas_comerciales set version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_origen_id
  returning version into v_origen_new;
  update public.cuentas_comerciales set version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_destino_id
  returning version into v_destino_new;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values(
    p_empresa_id,p_local_id,p_operation_id,'CUENTA',p_cuenta_origen_id::text,
    'CUENTA_CUOTA_IMPORTE_ASIGNADA',
    jsonb_build_object(
      'cuota_id',v_cuota_id,'cuenta_destino_id',p_cuenta_destino_id,
      'importe',p_importe,'etiqueta',v_etiqueta,
      'cuenta_origen_version',v_origen_new,
      'cuenta_destino_version',v_destino_new,
      'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'cuota_id',v_cuota_id,
    'cuenta_origen_id',p_cuenta_origen_id,'cuenta_destino_id',p_cuenta_destino_id,
    'importe',p_importe,'currency_code',v_origen.currency_code,
    'cuenta_origen_version',v_origen_new,'cuenta_destino_version',v_destino_new
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_revertir_cuota_importe(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cuota_id uuid,
  p_expected_cuota_version bigint,
  p_expected_origen_version bigint,
  p_expected_destino_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_q public.cuenta_cuotas_importe%rowtype;
  v_origen public.cuentas_comerciales%rowtype;
  v_destino public.cuentas_comerciales%rowtype;
  v_request jsonb; v_cmd jsonb; v_result jsonb;
  v_q_new bigint; v_o_new bigint; v_d_new bigint;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_REPARTO_REVERTIR') then
    raise exception 'cuota_revertir_no_autorizada';
  end if;
  if p_cuota_id is null or p_expected_cuota_version is null
     or p_expected_origen_version is null or p_expected_destino_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'cuota_revertir_parametros_invalidos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then raise exception 'terminal_sesion_no_operativa'; end if;

  v_request:=jsonb_build_object(
    'cuota_id',p_cuota_id,'expected_cuota_version',p_expected_cuota_version,
    'expected_origen_version',p_expected_origen_version,
    'expected_destino_version',p_expected_destino_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_REVERTIR_CUOTA_IMPORTE',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_q
  from public.cuenta_cuotas_importe
  where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuota_id
  for update;
  if not found then raise exception 'cuota_no_encontrada'; end if;
  if v_q.estado<>'ACTIVA' then raise exception 'cuota_no_activa'; end if;
  if v_q.version<>p_expected_cuota_version then raise exception 'cuota_version_conflict'; end if;

  perform 1
  from public.cuentas_comerciales c
  where c.empresa_id=p_empresa_id and c.local_id=p_local_id
    and c.id in(v_q.cuenta_origen_id,v_q.cuenta_destino_id)
  order by c.id for update;

  select * into v_origen from public.cuentas_comerciales where id=v_q.cuenta_origen_id;
  select * into v_destino from public.cuentas_comerciales where id=v_q.cuenta_destino_id;
  if v_origen.version<>p_expected_origen_version then raise exception 'cuenta_origen_version_conflict'; end if;
  if v_destino.version<>p_expected_destino_version then raise exception 'cuenta_destino_version_conflict'; end if;
  if v_origen.opened_operating_day<>p_operating_day or v_destino.opened_operating_day<>p_operating_day then
    raise exception 'cuota_operating_day_incompatible';
  end if;

  if exists(
    select 1 from public.ventas_fiscales v
    where v.empresa_id=p_empresa_id and v.local_id=p_local_id
      and v.cuenta_id in(v_q.cuenta_origen_id,v_q.cuenta_destino_id)
  ) then raise exception 'cuota_cuenta_con_fiscalizacion'; end if;

  update public.cuenta_cuotas_importe
     set estado='CERRADA',closed_at=now(),version=version+1
   where id=v_q.id
  returning version into v_q_new;

  update public.cuentas_comerciales set version=version+1
   where id=v_q.cuenta_origen_id returning version into v_o_new;
  update public.cuentas_comerciales set version=version+1
   where id=v_q.cuenta_destino_id returning version into v_d_new;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values(
    p_empresa_id,p_local_id,p_operation_id,'CUENTA',v_q.cuenta_origen_id::text,
    'CUENTA_CUOTA_IMPORTE_REVERTIDA',
    jsonb_build_object(
      'cuota_id',v_q.id,'cuenta_destino_id',v_q.cuenta_destino_id,
      'importe',v_q.importe,'cuota_version',v_q_new,
      'cuenta_origen_version',v_o_new,'cuenta_destino_version',v_d_new,
      'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'cuota_id',v_q.id,'estado','CERRADA',
    'cuota_version',v_q_new,'cuenta_origen_version',v_o_new,
    'cuenta_destino_version',v_d_new
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_unir_cuentas(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cuenta_origen_id uuid,
  p_cuenta_destino_id uuid,
  p_motivo text,
  p_expected_origen_version bigint,
  p_expected_destino_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_origen public.cuentas_comerciales%rowtype;
  v_destino public.cuentas_comerciales%rowtype;
  v_src_asig public.cuenta_mesa_asignaciones%rowtype;
  v_dst_asig public.cuenta_mesa_asignaciones%rowtype;
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_request jsonb; v_cmd jsonb; v_result jsonb;
  v_o_new bigint; v_d_new bigint; v_mesa_new bigint;
  v_r record; v_dst_r public.cuenta_linea_repartos%rowtype;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_UNIR') then
    raise exception 'cuentas_unir_no_autorizado';
  end if;
  if p_cuenta_origen_id is null or p_cuenta_destino_id is null
     or p_cuenta_origen_id=p_cuenta_destino_id or v_motivo is null
     or p_expected_origen_version is null or p_expected_destino_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'cuentas_unir_parametros_invalidos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then raise exception 'terminal_sesion_no_operativa'; end if;

  v_request:=jsonb_build_object(
    'cuenta_origen_id',p_cuenta_origen_id,'cuenta_destino_id',p_cuenta_destino_id,
    'motivo',v_motivo,'expected_origen_version',p_expected_origen_version,
    'expected_destino_version',p_expected_destino_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_UNIR_CUENTAS',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  perform 1
  from public.cuentas_comerciales c
  where c.empresa_id=p_empresa_id and c.local_id=p_local_id
    and c.id in(p_cuenta_origen_id,p_cuenta_destino_id)
  order by c.id for update;

  select * into v_origen from public.cuentas_comerciales
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_origen_id;
  select * into v_destino from public.cuentas_comerciales
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_destino_id;

  if v_origen.id is null or v_destino.id is null then raise exception 'cuentas_unir_no_encontradas'; end if;
  if v_origen.estado<>'ABIERTA' or v_destino.estado<>'ABIERTA' then raise exception 'cuentas_unir_no_abiertas'; end if;
  if v_origen.version<>p_expected_origen_version then raise exception 'cuenta_origen_version_conflict'; end if;
  if v_destino.version<>p_expected_destino_version then raise exception 'cuenta_destino_version_conflict'; end if;
  if v_origen.currency_code<>v_destino.currency_code then raise exception 'cuentas_unir_moneda_incompatible'; end if;
  if v_origen.opened_operating_day<>p_operating_day or v_destino.opened_operating_day<>p_operating_day then
    raise exception 'cuentas_unir_operating_day_incompatible';
  end if;

  if exists(
    select 1 from public.ventas_fiscales v
    where v.empresa_id=p_empresa_id and v.local_id=p_local_id
      and v.cuenta_id in(p_cuenta_origen_id,p_cuenta_destino_id)
  ) then raise exception 'cuentas_unir_con_fiscalizacion'; end if;

  if exists(
    select 1 from public.cuenta_cuotas_importe q
    where q.empresa_id=p_empresa_id and q.local_id=p_local_id and q.estado='ACTIVA'
      and (
        q.cuenta_origen_id in(p_cuenta_origen_id,p_cuenta_destino_id)
        or q.cuenta_destino_id in(p_cuenta_origen_id,p_cuenta_destino_id)
      )
  ) then raise exception 'cuentas_unir_con_cuotas_activas'; end if;

  if exists(
    select 1 from public.pedidos_tpv p
    where p.empresa_id=p_empresa_id and p.local_id=p_local_id
      and p.cuenta_id=p_cuenta_origen_id
      and p.estado in('BORRADOR','ABIERTO')
  ) then raise exception 'cuenta_origen_con_pedido_editable'; end if;

  if exists(
    select 1
    from public.pedido_lineas l
    join public.pedidos_tpv p
      on p.empresa_id=l.empresa_id and p.local_id=l.local_id and p.id=l.pedido_id
    where p.empresa_id=p_empresa_id and p.local_id=p_local_id
      and p.cuenta_id=p_cuenta_origen_id
      and l.estado not in('SERVIDA','CANCELADA')
  ) then raise exception 'cuenta_origen_con_lineas_no_terminales'; end if;

  select * into v_src_asig
  from public.cuenta_mesa_asignaciones
  where empresa_id=p_empresa_id and local_id=p_local_id
    and cuenta_id=p_cuenta_origen_id and hasta is null
  for update;

  select * into v_dst_asig
  from public.cuenta_mesa_asignaciones
  where empresa_id=p_empresa_id and local_id=p_local_id
    and cuenta_id=p_cuenta_destino_id and hasta is null
  for update;

  if v_src_asig.id is not null and v_dst_asig.id is not null
     and v_src_asig.mesa_id<>v_dst_asig.mesa_id then
    raise exception 'cuentas_unir_mesas_distintas';
  end if;

  if v_src_asig.id is not null then
    perform 1 from public.tpv_mesas m
     where m.empresa_id=p_empresa_id and m.local_id=p_local_id
       and m.id=v_src_asig.mesa_id
     for update;
  end if;

  for v_r in
    select l.id
    from public.pedido_lineas l
    join public.pedidos_tpv p
      on p.empresa_id=l.empresa_id and p.local_id=l.local_id and p.id=l.pedido_id
    where p.empresa_id=p_empresa_id and p.local_id=p_local_id
      and p.cuenta_id=p_cuenta_origen_id
      and l.estado<>'CANCELADA'
    order by l.id
  loop
    perform private.abc_materializar_reparto_linea(p_empresa_id,p_local_id,v_r.id);
  end loop;

  for v_r in
    select *
    from public.cuenta_linea_repartos r
    where r.empresa_id=p_empresa_id and r.local_id=p_local_id
      and r.cuenta_id=p_cuenta_origen_id and r.estado='ACTIVO'
    order by r.source_line_id,r.id
    for update
  loop
    select * into v_dst_r
    from public.cuenta_linea_repartos
    where empresa_id=p_empresa_id and local_id=p_local_id
      and source_line_id=v_r.source_line_id
      and cuenta_id=p_cuenta_destino_id
      and estado='ACTIVO'
    for update;

    if found then
      update public.cuenta_linea_repartos
         set cantidad=cantidad+v_r.cantidad,
             descuento=descuento+v_r.descuento,
             base=base+v_r.base,
             impuestos=impuestos+v_r.impuestos,
             total=total+v_r.total,
             version=version+1
       where id=v_dst_r.id;
      update public.cuenta_linea_repartos
         set estado='CERRADO',closed_at=now(),version=version+1
       where id=v_r.id;
    else
      update public.cuenta_linea_repartos
         set cuenta_id=p_cuenta_destino_id,version=version+1
       where id=v_r.id;
    end if;
  end loop;

  insert into public.cuenta_relaciones(
    empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,tipo,motivo,
    operation_id,actor_user_id,terminal_id,session_id,operating_day
  ) values(
    p_empresa_id,p_local_id,p_cuenta_origen_id,p_cuenta_destino_id,'FUSION',
    v_motivo,p_operation_id,auth.uid(),p_terminal_id,p_session_id,p_operating_day
  );

  update public.cuentas_comerciales
     set estado='CERRADA',closed_at=now(),version=version+1
   where id=p_cuenta_origen_id
  returning version into v_o_new;

  update public.cuentas_comerciales
     set version=version+1
   where id=p_cuenta_destino_id
  returning version into v_d_new;

  if v_src_asig.id is not null then
    update public.cuenta_mesa_asignaciones
       set hasta=now(),motivo_fin='FUSION_CUENTA'
     where id=v_src_asig.id;

    update public.tpv_mesas
       set version=version+1,updated_at=now()
     where id=v_src_asig.mesa_id
    returning version into v_mesa_new;

    if v_dst_asig.id is null then
      insert into public.cuenta_mesa_asignaciones(
        empresa_id,local_id,cuenta_id,mesa_id,comensales,
        actor_user_id,terminal_id,session_id,operating_day,
        cuenta_version_resultante,mesa_version_resultante,snapshot
      ) values(
        p_empresa_id,p_local_id,p_cuenta_destino_id,v_src_asig.mesa_id,
        v_src_asig.comensales,auth.uid(),p_terminal_id,p_session_id,p_operating_day,
        v_d_new,v_mesa_new,
        jsonb_build_object('origen','A08_FUSION','cuenta_origen_id',p_cuenta_origen_id)
      );
    else
      update public.cuenta_mesa_asignaciones
         set comensales=comensales+v_src_asig.comensales,
             cuenta_version_resultante=v_d_new,
             mesa_version_resultante=v_mesa_new
       where id=v_dst_asig.id;
    end if;
  end if;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values(
    p_empresa_id,p_local_id,p_operation_id,'CUENTA',p_cuenta_destino_id::text,
    'CUENTAS_UNIDAS',
    jsonb_build_object(
      'cuenta_origen_id',p_cuenta_origen_id,'cuenta_destino_id',p_cuenta_destino_id,
      'motivo',v_motivo,'cuenta_origen_version',v_o_new,
      'cuenta_destino_version',v_d_new,'mesa_version',v_mesa_new,
      'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'cuenta_origen_id',p_cuenta_origen_id,
    'cuenta_destino_id',p_cuenta_destino_id,
    'cuenta_origen_estado','CERRADA',
    'cuenta_origen_version',v_o_new,
    'cuenta_destino_version',v_d_new,
    'mesa_version',v_mesa_new
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_consultar_reparto_cuenta(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_cuenta public.cuentas_comerciales%rowtype;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_REPARTIR') then
    raise exception 'reparto_consultar_no_autorizado';
  end if;
  if p_cuenta_id is null or p_terminal_id is null
     or p_session_id is null or p_operating_day is null then
    raise exception 'reparto_consultar_parametros_invalidos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then raise exception 'terminal_sesion_no_operativa'; end if;

  select * into v_cuenta
  from public.cuentas_comerciales
  where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_id;
  if not found then raise exception 'cuenta_no_encontrada'; end if;

  return jsonb_build_object(
    'ok',true,'cuenta_id',v_cuenta.id,'estado',v_cuenta.estado,
    'version',v_cuenta.version,'currency_code',v_cuenta.currency_code,
    'operating_day',v_cuenta.opened_operating_day,
    'reparto',private.abc_reparto_cuenta_snapshot(p_empresa_id,p_local_id,p_cuenta_id)
  );
end $$;

create or replace function public.abc_recuperar_cuenta(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_cuenta public.cuentas_comerciales%rowtype;
  v_pedidos jsonb;
  v_cobro jsonb;
  v_last_activity timestamptz;
  v_revision text;
  v_requires_day boolean;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'cuenta_recuperar_no_autorizada';
  end if;
  if p_cuenta_id is null or p_terminal_id is null
     or p_session_id is null or p_operating_day is null then
    raise exception 'cuenta_recuperar_parametros_requeridos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  select *
    into v_cuenta
    from public.cuentas_comerciales
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_cuenta_id;

  if not found then raise exception 'cuenta_no_encontrada'; end if;

  v_last_activity:=private.abc_ultima_actividad_cuenta(
    p_empresa_id,p_local_id,p_cuenta_id
  );
  v_revision:=private.abc_revision_cuenta(
    p_empresa_id,p_local_id,p_cuenta_id
  );
  v_requires_day:=
    v_cuenta.estado='ABIERTA'
    and v_cuenta.opened_operating_day<>p_operating_day;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',p.id,
        'estado',p.estado,
        'version',p.version,
        'currency_code',p.currency_code,
        'created_by',p.created_by,
        'created_at',p.created_at,
        'created_operating_day',p.created_operating_day,
        'closed_at',p.closed_at,
        'lineas',coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id',l.id,
              'producto_id',l.producto_id,
              'cantidad',l.cantidad,
              'unidad',l.unidad,
              'estado',l.estado,
              'version',l.version,
              'entidad_fiscal_id',l.entidad_fiscal_id,
              'currency_code',l.currency_code,
              'precio_unitario',l.precio_unitario,
              'descuento_total',l.descuento_total,
              'base',l.base,
              'impuestos',l.impuestos,
              'total',l.total,
              'snapshot_comercial',l.snapshot_comercial,
              'snapshot_calculo',l.snapshot_calculo,
              'created_by',l.created_by,
              'created_at',l.created_at,
              'created_operating_day',l.created_operating_day,
              'opciones',coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id',o.id,
                    'grupo_id',o.grupo_id,
                    'opcion_id',o.opcion_id,
                    'tipo_grupo',o.tipo_grupo,
                    'tipo_opcion',o.tipo_opcion,
                    'nombre_grupo',o.nombre_grupo,
                    'nombre_opcion',o.nombre_opcion,
                    'cantidad',o.cantidad,
                    'delta_precio_unitario',o.delta_precio_unitario,
                    'impuesto_pct',o.impuesto_pct,
                    'base',o.base,
                    'impuestos',o.impuestos,
                    'total',o.total,
                    'catalog_group_version',o.catalog_group_version,
                    'catalog_product_group_version',o.catalog_product_group_version,
                    'catalog_option_version',o.catalog_option_version,
                    'snapshot',o.snapshot,
                    'created_by',o.created_by,
                    'created_at',o.created_at,
                    'created_operating_day',o.created_operating_day
                  )
                  order by o.created_at,o.id
                )
                from public.pedido_linea_opciones o
                where o.empresa_id=l.empresa_id
                  and o.local_id=l.local_id
                  and o.linea_id=l.id
              ),'[]'::jsonb),
              'transiciones',coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id',t.id,
                    'operation_id',t.operation_id,
                    'estado_anterior',t.estado_anterior,
                    'estado_nuevo',t.estado_nuevo,
                    'motivo',t.motivo,
                    'actor_user_id',t.actor_user_id,
                    'terminal_id',t.terminal_id,
                    'session_id',t.session_id,
                    'occurred_at',t.occurred_at,
                    'operating_day',t.operating_day,
                    'metadata',t.metadata
                  )
                  order by t.occurred_at,t.id
                )
                from public.pedido_linea_transiciones t
                where t.empresa_id=l.empresa_id
                  and t.local_id=l.local_id
                  and t.linea_id=l.id
              ),'[]'::jsonb)
            )
            order by l.created_at,l.id
          )
          from public.pedido_lineas l
          where l.empresa_id=p.empresa_id
            and l.local_id=p.local_id
            and l.pedido_id=p.id
        ),'[]'::jsonb),
        'transiciones',coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id',t.id,
              'operation_id',t.operation_id,
              'estado_anterior',t.estado_anterior,
              'estado_nuevo',t.estado_nuevo,
              'motivo',t.motivo,
              'actor_user_id',t.actor_user_id,
              'terminal_id',t.terminal_id,
              'session_id',t.session_id,
              'occurred_at',t.occurred_at,
              'operating_day',t.operating_day,
              'metadata',t.metadata
            )
            order by t.occurred_at,t.id
          )
          from public.pedido_transiciones t
          where t.empresa_id=p.empresa_id
            and t.local_id=p.local_id
            and t.pedido_id=p.id
        ),'[]'::jsonb)
      )
      order by p.created_at,p.id
    ),
    '[]'::jsonb
  )
  into v_pedidos
  from public.pedidos_tpv p
  where p.empresa_id=p_empresa_id
    and p.local_id=p_local_id
    and p.cuenta_id=p_cuenta_id;

  v_cobro:=public.abc_estado_cobro_cuenta(
    p_empresa_id,p_local_id,p_cuenta_id
  );

  return jsonb_build_object(
    'ok',true,
    'recuperado_at',now(),
    'terminal_id',p_terminal_id,
    'session_id',p_session_id,
    'requested_operating_day',p_operating_day,
    'revision',v_revision,
    'reanudable',
      v_cuenta.estado='ABIERTA' and not v_requires_day,
    'requires_operating_day_resolution',v_requires_day,
    'cuenta',jsonb_build_object(
      'id',v_cuenta.id,
      'empresa_id',v_cuenta.empresa_id,
      'local_id',v_cuenta.local_id,
      'currency_code',v_cuenta.currency_code,
      'modalidad',v_cuenta.modalidad,
      'estado',v_cuenta.estado,
      'version',v_cuenta.version,
      'responsable_actual',v_cuenta.responsable_actual,
      'created_by',v_cuenta.created_by,
      'opened_at',v_cuenta.opened_at,
      'opened_operating_day',v_cuenta.opened_operating_day,
      'closed_at',v_cuenta.closed_at,
      'created_at',v_cuenta.created_at,
      'last_activity_at',v_last_activity
    ),
    'ubicacion',private.abc_ubicacion_cuenta(p_empresa_id,p_local_id,p_cuenta_id),
    'reparto',private.abc_reparto_cuenta_snapshot(p_empresa_id,p_local_id,p_cuenta_id),
    'pedidos',v_pedidos,
    'estado_cobro',v_cobro
  );
end $$;




create or replace function public.abc_listar_cuentas_recuperables(
  p_empresa_id text,
  p_local_id text,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date,
  p_abandono_minutos integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'cuentas_recuperables_no_autorizadas';
  end if;
  if p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'cuentas_recuperables_parametros_requeridos';
  end if;
  if p_abandono_minutos is null or p_abandono_minutos<0 or p_abandono_minutos>10080 then
    raise exception 'abandono_minutos_invalido';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'cuenta_id',x.id,
        'estado',x.estado,
        'version',x.version,
        'currency_code',x.currency_code,
        'modalidad',x.modalidad,
        'responsable_actual',x.responsable_actual,
        'opened_at',x.opened_at,
        'opened_operating_day',x.opened_operating_day,
        'last_activity_at',x.last_activity_at,
        'pedidos_count',x.pedidos_count,
        'lineas_activas_count',x.lineas_activas_count,
        'revision',x.revision,
        'ubicacion',private.abc_ubicacion_cuenta(p_empresa_id,p_local_id,x.id),
        'total_comercial',private.abc_total_comercial_cuenta(p_empresa_id,p_local_id,x.id),
        'reparto',private.abc_reparto_cuenta_snapshot(p_empresa_id,p_local_id,x.id),
        'reanudable_mismo_dia',x.opened_operating_day=p_operating_day,
        'requires_operating_day_resolution',x.opened_operating_day<>p_operating_day,
        'posible_abandono',
          x.last_activity_at <= now()-make_interval(mins=>p_abandono_minutos)
      )
      order by x.last_activity_at desc,x.id
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      c.id,
      c.estado,
      c.version,
      c.currency_code,
      c.modalidad,
      c.responsable_actual,
      c.opened_at,
      c.opened_operating_day,
      private.abc_ultima_actividad_cuenta(
        c.empresa_id,c.local_id,c.id
      ) last_activity_at,
      private.abc_revision_cuenta(
        c.empresa_id,c.local_id,c.id
      ) revision,
      (
        select count(*)
        from public.pedidos_tpv p
        where p.empresa_id=c.empresa_id
          and p.local_id=c.local_id
          and p.cuenta_id=c.id
          and p.estado not in ('CERRADO','CANCELADO')
      ) pedidos_count,
      (
        select count(*)
        from public.pedido_lineas l
        join public.pedidos_tpv p
          on p.empresa_id=l.empresa_id
         and p.local_id=l.local_id
         and p.id=l.pedido_id
        where p.empresa_id=c.empresa_id
          and p.local_id=c.local_id
          and p.cuenta_id=c.id
          and l.estado<>'CANCELADA'
      ) lineas_activas_count
    from public.cuentas_comerciales c
    where c.empresa_id=p_empresa_id
      and c.local_id=p_local_id
      and c.estado='ABIERTA'
  ) x;

  return jsonb_build_object(
    'ok',true,
    'terminal_id',p_terminal_id,
    'session_id',p_session_id,
    'operating_day',p_operating_day,
    'abandono_minutos',p_abandono_minutos,
    'cuentas',v_result
  );
end $$;





revoke all on function private.abc_materializar_reparto_linea(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.abc_cantidad_fiscalizada_linea_cuenta(text,text,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.abc_total_comercial_cuenta(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.abc_reparto_cuenta_snapshot(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.abc_guard_cancelacion_reparto() from public,anon,authenticated,service_role;

revoke all on function public.abc_mover_cantidad_linea_cuenta(text,text,text,uuid,uuid,uuid,numeric,text,bigint,bigint,bigint,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_asignar_cuota_importe(text,text,text,uuid,uuid,numeric,text,bigint,bigint,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_revertir_cuota_importe(text,text,text,uuid,bigint,bigint,bigint,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_unir_cuentas(text,text,text,uuid,uuid,text,bigint,bigint,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_consultar_reparto_cuenta(text,text,uuid,uuid,uuid,date) from public,anon,authenticated,service_role;

grant execute on function public.abc_mover_cantidad_linea_cuenta(text,text,text,uuid,uuid,uuid,numeric,text,bigint,bigint,bigint,uuid,uuid,date) to authenticated;
grant execute on function public.abc_asignar_cuota_importe(text,text,text,uuid,uuid,numeric,text,bigint,bigint,uuid,uuid,date) to authenticated;
grant execute on function public.abc_revertir_cuota_importe(text,text,text,uuid,bigint,bigint,bigint,uuid,uuid,date) to authenticated;
grant execute on function public.abc_unir_cuentas(text,text,text,uuid,uuid,text,bigint,bigint,uuid,uuid,date) to authenticated;
grant execute on function public.abc_consultar_reparto_cuenta(text,text,uuid,uuid,uuid,date) to authenticated;

revoke all on function public.abc_recuperar_cuenta(text,text,uuid,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_listar_cuentas_recuperables(text,text,uuid,uuid,date,integer) from public,anon,authenticated,service_role;
grant execute on function public.abc_recuperar_cuenta(text,text,uuid,uuid,uuid,date) to authenticated;
grant execute on function public.abc_listar_cuentas_recuperables(text,text,uuid,uuid,date,integer) to authenticated;
