-- ABC F3/A09: descuentos y cortesias en cuentas con reparto de un solo IVA.
-- Aditiva; no habilita dobles aprobaciones, descuentos tras fiscalizacion,
-- ni repartos A08 con tipos mixtos. Ningun cobro es iniciado por esta RPC.

do $$
begin
  if to_regclass('public.cuenta_linea_repartos') is null
     or to_regclass('public.pedido_lineas') is null
     or to_regclass('public.pedido_linea_opciones') is null
     or to_regprocedure('private.abc_materializar_reparto_linea(text,text,uuid)') is null
     or to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null
     or to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null
     or to_regprocedure('private.abc_terminal_sesion_operativa(text,text,uuid,uuid)') is null then
    raise exception 'ABC_F3_A09_PREFLIGHT_FALLO: dependencias ausentes';
  end if;
  if to_regclass('public.abc_descuento_politicas') is not null
     or to_regclass('public.abc_descuentos_aplicados') is not null
     or to_regprocedure('public.abc_aplicar_descuento_cuenta(text,text,text,uuid,text,numeric,text,bigint,uuid,uuid,date)') is not null then
    raise exception 'ABC_F3_A09_PREFLIGHT_FALLO: A09 ya existe';
  end if;
end $$;

create table public.abc_descuento_politicas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references public.empresas(id) on delete restrict,
  local_id text,
  rol text,
  user_id uuid references auth.users(id) on delete restrict,
  max_percent numeric(9,4) not null,
  permite_cortesia boolean not null default false,
  requiere_doble_aprobacion boolean not null default false,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint a09_politica_local_fk foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint a09_politica_sujeto check (
    (user_id is not null and rol is null)
    or (user_id is null and nullif(btrim(rol),'') is not null)
  ),
  constraint a09_politica_max check (max_percent>=0 and max_percent<=100),
  constraint a09_politica_cortesia check (not permite_cortesia or max_percent=100)
);
create unique index a09_politica_usuario_uq
  on public.abc_descuento_politicas(empresa_id,coalesce(local_id,''),user_id)
  where user_id is not null;
create unique index a09_politica_rol_uq
  on public.abc_descuento_politicas(empresa_id,coalesce(local_id,''),rol)
  where rol is not null;

create table public.abc_descuentos_aplicados (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  operation_id text not null,
  cuenta_id uuid not null references public.cuentas_comerciales(id) on delete restrict,
  reparto_id uuid not null references public.cuenta_linea_repartos(id) on delete restrict,
  source_line_id uuid not null references public.pedido_lineas(id) on delete restrict,
  tipo text not null check (tipo in ('PERCENT','AMOUNT','COURTESY')),
  importe numeric(24,8) not null check (importe>=0),
  base_antes numeric(24,8) not null check (base_antes>=0),
  base_despues numeric(24,8) not null check (base_despues>=0),
  iva_antes numeric(24,8) not null check (iva_antes>=0),
  iva_despues numeric(24,8) not null check (iva_despues>=0),
  motivo text not null check (char_length(btrim(motivo)) between 1 and 500),
  solicitante_id uuid not null references auth.users(id) on delete restrict,
  autorizador_id uuid not null references auth.users(id) on delete restrict,
  terminal_id uuid not null references public.terminales_tpv(id) on delete restrict,
  session_id uuid not null references public.caja_sesiones(id) on delete restrict,
  operating_day date not null,
  created_at timestamptz not null default now(),
  constraint a09_descuento_operacion_fk foreign key (empresa_id,local_id,operation_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id) on delete restrict,
  constraint a09_descuento_local_fk foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint a09_descuento_operacion_reparto_uq unique (operation_id,reparto_id)
);
create index a09_descuentos_linea_idx
  on public.abc_descuentos_aplicados(empresa_id,local_id,source_line_id,created_at,id);
create index a09_descuentos_cuenta_idx
  on public.abc_descuentos_aplicados(empresa_id,local_id,cuenta_id,created_at,id);

alter table public.abc_descuento_politicas enable row level security;
alter table public.abc_descuentos_aplicados enable row level security;
create policy a09_descuentos_select on public.abc_descuentos_aplicados
  for select to authenticated
  using (private.la_tiene_local(empresa_id,local_id));
revoke all on table public.abc_descuento_politicas
  from public,anon,authenticated,service_role;
revoke all on table public.abc_descuentos_aplicados
  from public,anon,authenticated,service_role;
grant select on table public.abc_descuentos_aplicados to authenticated;

create function private.abc_descuento_politica(
  p_empresa_id text,p_local_id text
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_rol text;
  v_p public.abc_descuento_politicas%rowtype;
  v_max numeric(9,4):=0;
  v_cortesia boolean:=false;
begin
  if auth.uid() is null or not private.la_tiene_local(p_empresa_id,p_local_id) then
    return jsonb_build_object('max_percent',0,'permite_cortesia',false,'requiere_doble_aprobacion',false);
  end if;
  select m.rol into v_rol
  from public.membresias_usuario m
  where m.user_id=auth.uid() and m.empresa_id=p_empresa_id and m.activo=true
    and ((m.todos_locales=false and m.local_id=p_local_id)
      or (m.todos_locales=true and m.local_id is null))
  order by case when m.local_id=p_local_id then 0 else 1 end,m.id desc
  limit 1;
  if v_rol is null then
    return jsonb_build_object('max_percent',0,'permite_cortesia',false,'requiere_doble_aprobacion',false);
  end if;
  if v_rol='Propietario' then v_max:=100; v_cortesia:=true;
  elsif v_rol='Encargado' then v_max:=20; end if;

  select p.* into v_p
  from public.abc_descuento_politicas p
  where p.empresa_id=p_empresa_id and p.activa=true
    and (p.local_id=p_local_id or p.local_id is null)
    and (p.user_id=auth.uid() or p.rol=v_rol)
  order by case
    when p.user_id=auth.uid() and p.local_id=p_local_id then 0
    when p.user_id=auth.uid() then 1
    when p.rol=v_rol and p.local_id=p_local_id then 2
    else 3 end
  limit 1;
  if found then
    v_max:=v_p.max_percent;
    v_cortesia:=v_p.permite_cortesia;
  end if;
  return jsonb_build_object(
    'rol',v_rol,'max_percent',v_max,'permite_cortesia',v_cortesia,
    'requiere_doble_aprobacion',case when v_p.id is null then false else v_p.requiere_doble_aprobacion end
  );
end $$;

create function public.abc_aplicar_descuento_cuenta(
  p_operation_id text,p_empresa_id text,p_local_id text,p_cuenta_id uuid,
  p_tipo text,p_valor numeric,p_motivo text,p_expected_cuenta_version bigint,
  p_terminal_id uuid,p_session_id uuid,p_operating_day date
) returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_policy jsonb;
  v_max numeric(9,4);
  v_kind text:=upper(btrim(coalesce(p_tipo,'')));
  v_reason text:=btrim(coalesce(p_motivo,''));
  v_request jsonb;
  v_cmd jsonb;
  v_cuenta public.cuentas_comerciales%rowtype;
  v_line public.pedido_lineas%rowtype;
  v_row public.cuenta_linea_repartos%rowtype;
  v_line_id uuid;
  v_rate numeric(9,4);
  v_source_ids uuid[]:=array[]::uuid[];
  v_changed_source_ids uuid[]:=array[]::uuid[];
  v_account_ids uuid[]:=array[]::uuid[];
  v_base numeric(24,8);
  v_amount numeric(24,8);
  v_delta numeric(24,8);
  v_tax numeric(24,8);
  v_new_base numeric(24,8);
  v_new_total numeric(24,8);
  v_agg record;
  v_alloc record;
  v_version bigint;
  v_result jsonb;
begin
  v_policy:=private.abc_descuento_politica(p_empresa_id,p_local_id);
  v_max:=(v_policy->>'max_percent')::numeric;
  if auth.uid() is null or v_max<=0 then raise exception 'descuento_no_autorizado'; end if;
  if v_kind='COURTESY' and not coalesce((v_policy->>'permite_cortesia')::boolean,false) then
    raise exception 'cortesia_no_autorizada';
  end if;
  if coalesce((v_policy->>'requiere_doble_aprobacion')::boolean,false) then
    raise exception 'descuento_requiere_doble_aprobacion';
  end if;
  if p_cuenta_id is null or p_expected_cuenta_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null
     or char_length(v_reason) not between 1 and 500
     or v_kind not in ('PERCENT','AMOUNT','COURTESY')
     or (v_kind='COURTESY' and p_valor is not null)
     or (v_kind<>'COURTESY' and (p_valor is null or p_valor<=0
       or p_valor<>round(p_valor,8)))
     or (v_kind='PERCENT' and p_valor>100) then
    raise exception 'descuento_parametros_invalidos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then raise exception 'terminal_sesion_no_operativa'; end if;

  v_request:=jsonb_build_object(
    'cuenta_id',p_cuenta_id,'tipo',v_kind,'valor',p_valor,'motivo',v_reason,
    'expected_cuenta_version',p_expected_cuenta_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,
    'operating_day',p_operating_day,'actor_user_id',auth.uid()
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_APLICAR_DESCUENTO_CUENTA',
    v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  -- Bloquear en orden todas las cuentas con participacion en las lineas
  -- visibles en la cuenta objetivo, como hace A08 en operaciones bilaterales.
  perform 1 from public.cuentas_comerciales c
  where c.empresa_id=p_empresa_id and c.local_id=p_local_id
    and (c.id=p_cuenta_id or c.id in (
      select r2.cuenta_id from public.cuenta_linea_repartos r2
      where r2.empresa_id=p_empresa_id and r2.local_id=p_local_id
        and r2.estado='ACTIVO' and r2.source_line_id in (
          select l.id from public.pedido_lineas l
          join public.pedidos_tpv p on p.empresa_id=l.empresa_id
            and p.local_id=l.local_id and p.id=l.pedido_id
          where l.empresa_id=p_empresa_id and l.local_id=p_local_id
            and (p.cuenta_id=p_cuenta_id or exists (
              select 1 from public.cuenta_linea_repartos rt
              where rt.empresa_id=l.empresa_id and rt.local_id=l.local_id
                and rt.source_line_id=l.id and rt.cuenta_id=p_cuenta_id
                and rt.estado='ACTIVO'
            ))
        )
    ))
  order by c.id for update;

  select * into v_cuenta from public.cuentas_comerciales c
  where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=p_cuenta_id
  for update;
  if not found then raise exception 'descuento_cuenta_no_encontrada'; end if;
  if v_cuenta.estado<>'ABIERTA' then raise exception 'descuento_cuenta_no_abierta'; end if;
  if v_cuenta.version<>p_expected_cuenta_version then raise exception 'cuenta_version_conflict'; end if;
  if v_cuenta.opened_operating_day<>p_operating_day then
    raise exception 'descuento_operating_day_incompatible';
  end if;

  -- El orden cuenta -> linea -> reparto sigue las RPC A08. La transaccion
  -- completa se revierte ante cualquier version/conflicto.
  for v_line_id in
    select distinct l.id
    from public.pedido_lineas l
    join public.pedidos_tpv p on p.empresa_id=l.empresa_id
      and p.local_id=l.local_id and p.id=l.pedido_id
    where l.empresa_id=p_empresa_id and l.local_id=p_local_id
      and l.estado<>'CANCELADA'
      and (p.cuenta_id=p_cuenta_id or exists (
        select 1 from public.cuenta_linea_repartos r
        where r.empresa_id=l.empresa_id and r.local_id=l.local_id
          and r.source_line_id=l.id and r.cuenta_id=p_cuenta_id and r.estado='ACTIVO'
      ))
    order by l.id
  loop
    select * into v_line from public.pedido_lineas l
    where l.empresa_id=p_empresa_id and l.local_id=p_local_id and l.id=v_line_id
    for update;
    -- Una linea originaria de esta cuenta puede haberse movido por completo.
    if exists (
      select 1 from public.cuenta_linea_repartos r
      where r.empresa_id=p_empresa_id and r.local_id=p_local_id
        and r.source_line_id=v_line_id and r.estado='ACTIVO'
    ) and not exists (
      select 1 from public.cuenta_linea_repartos r
      where r.empresa_id=p_empresa_id and r.local_id=p_local_id
        and r.source_line_id=v_line_id and r.cuenta_id=p_cuenta_id
        and r.estado='ACTIVO'
    ) then continue; end if;
    if v_line.estado in ('BORRADOR','CANCELADA') or v_line.base is null
       or v_line.descuento_total is null or v_line.impuestos is null
       or v_line.total is null then raise exception 'descuento_linea_no_apta'; end if;
    v_rate:=coalesce(
      nullif(v_line.snapshot_calculo->>'impuesto_base_pct','')::numeric,
      nullif(v_line.snapshot_calculo->>'impuesto_pct','')::numeric,
      nullif(v_line.snapshot_comercial->>'impuesto_pct','')::numeric,
      nullif(v_line.snapshot_comercial->>'impuesto_base_pct','')::numeric
    );
    if v_rate is null or v_rate<0 or v_rate>100 then
      raise exception 'descuento_tipo_iva_desconocido';
    end if;
    if exists (
      select 1 from public.pedido_linea_opciones o
      where o.empresa_id=p_empresa_id and o.local_id=p_local_id
        and o.linea_id=v_line_id and o.base<>0 and o.impuesto_pct<>v_rate
    ) then raise exception 'descuento_reparto_iva_mixto_no_soportado'; end if;
    if exists (
      select 1 from public.venta_fiscal_lineas vl
      join public.ventas_fiscales vf on vf.empresa_id=vl.empresa_id
        and vf.local_id=vl.local_id and vf.id=vl.venta_fiscal_id
      where vl.empresa_id=p_empresa_id and vl.local_id=p_local_id
        and vl.source_line_id=v_line_id and vf.estado<>'CANCELADA'
    ) then raise exception 'descuento_linea_fiscalizada'; end if;
    if not exists (
      select 1 from public.cuenta_linea_repartos r
      where r.empresa_id=p_empresa_id and r.local_id=p_local_id
        and r.source_line_id=v_line_id and r.estado='ACTIVO'
    ) then
      perform private.abc_materializar_reparto_linea(p_empresa_id,p_local_id,v_line_id);
    end if;
    v_source_ids:=array_append(v_source_ids,v_line_id);
  end loop;
  if cardinality(v_source_ids)=0 then raise exception 'descuento_cuenta_sin_lineas'; end if;

  perform 1 from public.cuenta_linea_repartos r
  where r.empresa_id=p_empresa_id and r.local_id=p_local_id
    and r.source_line_id=any(v_source_ids) and r.estado='ACTIVO'
  order by r.source_line_id,r.id for update;
  if exists (
    select 1 from public.cuenta_linea_repartos r
    where r.empresa_id=p_empresa_id and r.local_id=p_local_id
      and r.source_line_id=any(v_source_ids) and r.estado='ACTIVO'
      and r.total<>r.base+r.impuestos
  ) then raise exception 'descuento_reparto_importes_invalidos'; end if;

  select array_agg(distinct r.cuenta_id order by r.cuenta_id)
    into v_account_ids
  from public.cuenta_linea_repartos r
  where r.empresa_id=p_empresa_id and r.local_id=p_local_id
    and r.source_line_id=any(v_source_ids) and r.estado='ACTIVO';

  if exists (
    select 1 from public.cuentas_comerciales c
    where c.empresa_id=p_empresa_id and c.local_id=p_local_id
      and c.id=any(v_account_ids) and c.estado<>'ABIERTA'
  ) then raise exception 'descuento_reparto_cuenta_no_abierta'; end if;

  if exists (
    select 1 from public.cuenta_cuotas_importe q
    where q.empresa_id=p_empresa_id and q.local_id=p_local_id and q.estado='ACTIVA'
      and (q.cuenta_origen_id=any(v_account_ids)
        or q.cuenta_destino_id=any(v_account_ids))
  ) or exists (
    select 1 from public.checkouts c
    where c.empresa_id=p_empresa_id and c.local_id=p_local_id
      and c.cuenta_id=any(v_account_ids) and c.estado<>'CANCELADO'
  ) then raise exception 'descuento_compromiso_financiero'; end if;

  -- La fuente siempre debe conciliar con todos los repartos antes de tocarla.
  for v_line_id in select unnest(v_source_ids) loop
    select sum(r.descuento) descuento,sum(r.base) base,
           sum(r.impuestos) impuestos,sum(r.total) total
      into v_agg
    from public.cuenta_linea_repartos r
    where r.empresa_id=p_empresa_id and r.local_id=p_local_id
      and r.source_line_id=v_line_id and r.estado='ACTIVO';
    select * into v_line from public.pedido_lineas where id=v_line_id;
    if v_line.descuento_total<>v_agg.descuento or v_line.base<>v_agg.base
       or v_line.impuestos<>v_agg.impuestos or v_line.total<>v_agg.total then
      raise exception 'descuento_reparto_fuente_inconsistente';
    end if;
  end loop;

  select coalesce(sum(r.base),0)::numeric(24,8) into v_base
  from public.cuenta_linea_repartos r
  where r.empresa_id=p_empresa_id and r.local_id=p_local_id
    and r.cuenta_id=p_cuenta_id and r.estado='ACTIVO'
    and r.source_line_id=any(v_source_ids);
  if v_base<=0 then raise exception 'descuento_base_no_positiva'; end if;
  v_amount:=case v_kind
    when 'COURTESY' then v_base
    when 'PERCENT' then round(v_base*p_valor/100,8)
    else p_valor end;
  if v_amount<=0 or v_amount>v_base then raise exception 'descuento_importe_fuera_base'; end if;

  -- Unidades de 10^-8, restos mayores y empate por reparto.id.
  for v_alloc in
    with raw as (
      select r.id,
        floor(v_amount*r.base/v_base*100000000) units,
        v_amount*r.base/v_base*100000000
          - floor(v_amount*r.base/v_base*100000000) fraction
      from public.cuenta_linea_repartos r
      where r.empresa_id=p_empresa_id and r.local_id=p_local_id
        and r.cuenta_id=p_cuenta_id and r.estado='ACTIVO'
        and r.source_line_id=any(v_source_ids)
    ), ranked as (
      select raw.*,
        row_number() over(order by fraction desc,id) rank_remainder,
        sum(units) over() floor_total
      from raw
    )
    select id,
      (units+case when rank_remainder<=round(v_amount*100000000)-floor_total
        then 1 else 0 end)/100000000::numeric as amount
    from ranked order by id
  loop
    if v_alloc.amount=0 then continue; end if;
    select * into v_row from public.cuenta_linea_repartos where id=v_alloc.id for update;
    select coalesce(
      nullif(l.snapshot_calculo->>'impuesto_base_pct','')::numeric,
      nullif(l.snapshot_calculo->>'impuesto_pct','')::numeric,
      nullif(l.snapshot_comercial->>'impuesto_pct','')::numeric,
      nullif(l.snapshot_comercial->>'impuesto_base_pct','')::numeric
    ) into v_rate
    from public.pedido_lineas l where l.id=v_row.source_line_id;
    v_new_base:=v_row.base-v_alloc.amount;
    v_tax:=case when v_new_base=0 then 0
      else v_row.impuestos-round(v_alloc.amount*v_rate/100,8) end;
    if v_new_base<0 or v_tax<0 or v_row.total<>v_row.base+v_row.impuestos then
      raise exception 'descuento_reparto_importes_invalidos';
    end if;
    v_new_total:=v_new_base+v_tax;
    update public.cuenta_linea_repartos
      set descuento=descuento+v_alloc.amount,base=v_new_base,
          impuestos=v_tax,total=v_new_total,version=version+1
      where id=v_row.id;
    insert into public.abc_descuentos_aplicados(
      empresa_id,local_id,operation_id,cuenta_id,reparto_id,source_line_id,
      tipo,importe,base_antes,base_despues,iva_antes,iva_despues,motivo,
      solicitante_id,autorizador_id,terminal_id,session_id,operating_day
    ) values (
      p_empresa_id,p_local_id,p_operation_id,p_cuenta_id,v_row.id,v_row.source_line_id,
      v_kind,v_alloc.amount,v_row.base,v_new_base,v_row.impuestos,v_tax,v_reason,
      auth.uid(),auth.uid(),p_terminal_id,p_session_id,p_operating_day
    );
    if not v_row.source_line_id=any(v_changed_source_ids) then
      v_changed_source_ids:=array_append(v_changed_source_ids,v_row.source_line_id);
    end if;
  end loop;

  for v_line_id in select unnest(v_changed_source_ids) loop
    select sum(r.descuento) descuento,sum(r.base) base,
           sum(r.impuestos) impuestos,sum(r.total) total,
           sum(r.descuento+r.base) gross
      into v_agg
    from public.cuenta_linea_repartos r
    where r.empresa_id=p_empresa_id and r.local_id=p_local_id
      and r.source_line_id=v_line_id and r.estado='ACTIVO';
    if v_agg.gross<=0 or v_agg.descuento*100>v_agg.gross*v_max
       or v_agg.total<>v_agg.base+v_agg.impuestos then
      raise exception 'descuento_limite_acumulado_excedido';
    end if;
    update public.pedido_lineas
      set descuento_total=v_agg.descuento,base=v_agg.base,
          impuestos=v_agg.impuestos,total=v_agg.total,version=version+1,
          snapshot_calculo=snapshot_calculo || jsonb_build_object(
            'a09_ultimo_operation_id',p_operation_id
          )
      where empresa_id=p_empresa_id and local_id=p_local_id and id=v_line_id;
  end loop;

  update public.cuentas_comerciales set version=version+1
  where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_id
  returning version into v_version;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CUENTA',p_cuenta_id::text,
    'CUENTA_DESCUENTO_APLICADO',
    jsonb_build_object('tipo',v_kind,'valor',p_valor,'importe',v_amount,
      'motivo',v_reason,'solicitante_id',auth.uid(),'autorizador_id',auth.uid(),
      'cuenta_version',v_version,'session_id',p_session_id),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );
  v_result:=jsonb_build_object(
    'ok',true,'cuenta_id',p_cuenta_id,'tipo',v_kind,'descuento',v_amount,
    'cuenta_version',v_version,
    'total_comercial',private.abc_total_comercial_cuenta(
      p_empresa_id,p_local_id,p_cuenta_id
    )
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

revoke all on function private.abc_descuento_politica(text,text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_aplicar_descuento_cuenta(
  text,text,text,uuid,text,numeric,text,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;
grant execute on function public.abc_aplicar_descuento_cuenta(
  text,text,text,uuid,text,numeric,text,bigint,uuid,uuid,date
) to authenticated;
