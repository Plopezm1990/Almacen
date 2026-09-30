-- ABC F4 B09 / subpunto 2 — importación y resolución autorizada.
--
-- La conciliación entra por RPC servidor-servidor. Las funciones son
-- idempotentes por operation_id, no escriben ventas/pagos/caja/stock y solo
-- permiten vincular una línea con el pago y el intento ya existentes.

begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $$
begin
  if to_regclass('public.abc_b09_liquidaciones') is null
     or to_regclass('public.abc_b09_liquidacion_lineas') is null
     or to_regclass('public.abc_b09_disputas') is null
     or to_regclass('public.pagos') is null
     or to_regclass('public.pago_intentos') is null
     or to_regprocedure('private.abc_request_hash(jsonb)') is null
     or to_regprocedure('private.abc_lock_operation_id(text)') is null then
    raise exception 'ABC_F4_B09_2_PREFLIGHT_FALLO: dependencias ausentes';
  end if;
  if to_regclass('public.abc_b09_operaciones') is not null
     or to_regprocedure('public.abc_b09_importar_liquidacion(text,text,text,text,text,text,text,date,date,numeric,numeric,numeric,numeric,numeric,text,jsonb,text,jsonb,jsonb)') is not null
     or to_regprocedure('public.abc_b09_vincular_linea(text,text,text,uuid,uuid,uuid)') is not null
     or to_regprocedure('public.abc_b09_resolver_disputa(text,text,text,uuid,text,uuid,text,jsonb,timestamptz)') is not null then
    raise exception 'ABC_F4_B09_2_PREFLIGHT_FALLO: objetos B09.2 ya existen';
  end if;
end $$;

alter table public.abc_b09_liquidaciones
  add column import_request_hash text;

alter table public.abc_b09_liquidaciones
  add constraint abc_b09_liq_import_hash_ck check (
    import_request_hash is null or import_request_hash ~ '^[0-9a-f]{64}$'
  );

create unique index abc_b09_liq_source_operation_uq
  on public.abc_b09_liquidaciones(empresa_id,local_id,source_operation_id)
  where source_operation_id is not null;

create table public.abc_b09_operaciones (
  operation_id text primary key,
  empresa_id text not null,
  local_id text not null,
  command_type text not null,
  request_hash text not null,
  status text not null default 'PROCESANDO',
  resultado jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint abc_b09_op_id_ck check (
    operation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'
  ),
  constraint abc_b09_op_hash_ck check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint abc_b09_op_status_ck check (status in ('PROCESANDO','COMPLETADA')),
  constraint abc_b09_op_state_ck check (
    (status='PROCESANDO' and completed_at is null and resultado is null)
    or (status='COMPLETADA' and completed_at is not null and resultado is not null)
  ),
  constraint abc_b09_op_scope_fk
    foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict
);

alter table public.abc_b09_operaciones enable row level security;
revoke all on table public.abc_b09_operaciones from public,anon,authenticated,service_role;
grant all on table public.abc_b09_operaciones to service_role;

create index abc_b09_op_scope_created_idx
  on public.abc_b09_operaciones(empresa_id,local_id,created_at desc);

create function private.abc_b09_requerir_service_role()
returns void
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'abc_b09_no_autorizado';
  end if;
end;
$$;

create function private.abc_b09_iniciar_operacion(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_command_type text,
  p_request jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_request jsonb := coalesce(p_request,'{}'::jsonb);
  v_hash text := private.abc_request_hash(v_request);
  v_existing public.abc_b09_operaciones%rowtype;
begin
  perform private.abc_b09_requerir_service_role();
  perform private.abc_lock_operation_id(p_operation_id);
  select * into v_existing
    from public.abc_b09_operaciones
   where operation_id=p_operation_id
   for update;
  if found then
    if v_existing.empresa_id is distinct from p_empresa_id
       or v_existing.local_id is distinct from p_local_id
       or v_existing.command_type is distinct from upper(btrim(p_command_type))
       or v_existing.request_hash is distinct from v_hash then
      raise exception 'operation_id_conflict';
    end if;
    return jsonb_build_object(
      'replayed',true,
      'status',v_existing.status,
      'resultado',v_existing.resultado
    );
  end if;

  insert into public.abc_b09_operaciones(
    operation_id,empresa_id,local_id,command_type,request_hash
  ) values (
    p_operation_id,p_empresa_id,p_local_id,upper(btrim(p_command_type)),v_hash
  );
  return jsonb_build_object('replayed',false,'status','PROCESANDO');
end;
$$;

create function private.abc_b09_completar_operacion(
  p_operation_id text,
  p_resultado jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_row public.abc_b09_operaciones%rowtype;
begin
  update public.abc_b09_operaciones
     set status='COMPLETADA',resultado=coalesce(p_resultado,'{}'::jsonb),completed_at=now()
   where operation_id=p_operation_id and status='PROCESANDO'
  returning * into v_row;
  if not found then raise exception 'abc_b09_operacion_no_procesando'; end if;
  return coalesce(p_resultado,'{}'::jsonb) || jsonb_build_object('operation_id',p_operation_id);
end;
$$;

create function public.abc_b09_importar_liquidacion(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_provider_code text,
  p_provider_account_id text,
  p_settlement_reference text,
  p_currency_code text,
  p_periodo_desde date,
  p_periodo_hasta date,
  p_importe_vendido numeric,
  p_importe_cobrado numeric,
  p_importe_devuelto numeric,
  p_importe_comision numeric,
  p_importe_liquidado numeric,
  p_origen text,
  p_provider_snapshot jsonb,
  p_source_operation_id text,
  p_lineas jsonb,
  p_disputas jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_claim jsonb;
  v_request jsonb;
  v_hash text;
  v_liquidacion public.abc_b09_liquidaciones%rowtype;
  v_linea jsonb;
  v_disputa jsonb;
  v_linea_id uuid;
  v_linked_linea public.abc_b09_liquidacion_lineas%rowtype;
  v_pago_id uuid;
  v_intento_id uuid;
  v_currency text;
  v_line_ref text;
  v_dispute_ref text;
  v_dispute_currency text;
  v_lineas_count integer := 0;
  v_disputas_count integer := 0;
  v_estado text;
begin
  perform private.abc_b09_requerir_service_role();
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array'
     or p_disputas is null or jsonb_typeof(p_disputas) <> 'array' then
    raise exception 'abc_b09_detalle_invalido';
  end if;
  if not exists (
    select 1 from public.locales l
     where l.empresa_id=p_empresa_id and l.id=p_local_id
  ) then
    raise exception 'abc_b09_contexto_no_encontrado';
  end if;

  v_request := jsonb_build_object(
    'empresa_id',p_empresa_id,'local_id',p_local_id,
    'provider_code',upper(btrim(coalesce(p_provider_code,''))),
    'provider_account_id',btrim(coalesce(p_provider_account_id,'')),
    'settlement_reference',btrim(coalesce(p_settlement_reference,'')),
    'currency_code',upper(btrim(coalesce(p_currency_code,''))),
    'periodo_desde',p_periodo_desde,'periodo_hasta',p_periodo_hasta,
    'importe_vendido',p_importe_vendido,'importe_cobrado',p_importe_cobrado,
    'importe_devuelto',p_importe_devuelto,'importe_comision',p_importe_comision,
    'importe_liquidado',p_importe_liquidado,'origen',p_origen,
    'provider_snapshot',coalesce(p_provider_snapshot,'{}'::jsonb),
    'source_operation_id',p_source_operation_id,
    'lineas',p_lineas,'disputas',p_disputas
  );
  v_hash := private.abc_request_hash(v_request);
  v_claim := private.abc_b09_iniciar_operacion(
    p_operation_id,p_empresa_id,p_local_id,'B09_IMPORTAR_LIQUIDACION',v_request
  );
  if (v_claim->>'replayed')::boolean then
    return coalesce(v_claim->'resultado','{}'::jsonb) || jsonb_build_object('replayed',true);
  end if;

  if p_source_operation_id is null or btrim(p_source_operation_id)='' then
    raise exception 'abc_b09_source_operation_requerido';
  end if;
  if exists (
    select 1 from public.abc_b09_liquidaciones
     where empresa_id=p_empresa_id and local_id=p_local_id
       and provider_code=upper(btrim(p_provider_code))
       and provider_account_id=btrim(p_provider_account_id)
       and settlement_reference=btrim(p_settlement_reference)
       and currency_code=upper(btrim(p_currency_code))
  ) then
    raise exception 'abc_b09_liquidacion_duplicada';
  end if;

  insert into public.abc_b09_liquidaciones(
    empresa_id,local_id,provider_code,provider_account_id,settlement_reference,
    currency_code,periodo_desde,periodo_hasta,importe_vendido,importe_cobrado,
    importe_devuelto,importe_comision,importe_liquidado,estado,origen,
    provider_snapshot,source_operation_id,import_request_hash
  ) values (
    p_empresa_id,p_local_id,upper(btrim(p_provider_code)),btrim(p_provider_account_id),
    btrim(p_settlement_reference),upper(btrim(p_currency_code)),p_periodo_desde,
    p_periodo_hasta,p_importe_vendido,p_importe_cobrado,p_importe_devuelto,
    p_importe_comision,p_importe_liquidado,'RECIBIDA',upper(btrim(p_origen)),
    coalesce(p_provider_snapshot,'{}'::jsonb),btrim(p_source_operation_id),v_hash
  ) returning * into v_liquidacion;

  for v_linea in select value from jsonb_array_elements(p_lineas) loop
    v_line_ref := nullif(btrim(v_linea->>'provider_line_reference'),'');
    if v_line_ref is null then raise exception 'abc_b09_linea_referencia_requerida'; end if;
    v_currency := upper(btrim(coalesce(nullif(v_linea->>'payment_currency_code',''),p_currency_code)));
    v_pago_id := nullif(v_linea->>'pago_id','')::uuid;
    v_intento_id := nullif(v_linea->>'intento_id','')::uuid;
    if (v_pago_id is null) <> (v_intento_id is null) then
      raise exception 'abc_b09_vinculo_incompleto';
    end if;
    if v_pago_id is not null then
      if not exists (
        select 1 from public.pagos p
         where p.empresa_id=p_empresa_id and p.local_id=p_local_id
           and p.id=v_pago_id and p.payment_currency_code=v_currency
      ) then raise exception 'abc_b09_pago_no_encontrado'; end if;
      if not exists (
        select 1 from public.pago_intentos i
         where i.empresa_id=p_empresa_id and i.local_id=p_local_id
           and i.id=v_intento_id and i.pago_id=v_pago_id
           and i.payment_currency_code=v_currency
      ) then raise exception 'abc_b09_intento_no_encontrado'; end if;
    end if;
    if jsonb_typeof(coalesce(v_linea->'provider_snapshot','{}'::jsonb)) <> 'object' then
      raise exception 'abc_b09_snapshot_linea_invalido';
    end if;
    insert into public.abc_b09_liquidacion_lineas(
      empresa_id,local_id,liquidacion_id,provider_line_reference,commercial_reference,
      pago_id,intento_id,payment_currency_code,importe_vendido,importe_cobrado,
      importe_devuelto,importe_comision,importe_liquidado,estado,provider_snapshot
    ) values (
      p_empresa_id,p_local_id,v_liquidacion.id,v_line_ref,
      nullif(btrim(v_linea->>'commercial_reference'),''),v_pago_id,v_intento_id,v_currency,
      coalesce(nullif(v_linea->>'importe_vendido',''),'0')::numeric,
      coalesce(nullif(v_linea->>'importe_cobrado',''),'0')::numeric,
      coalesce(nullif(v_linea->>'importe_devuelto',''),'0')::numeric,
      coalesce(nullif(v_linea->>'importe_comision',''),'0')::numeric,
      coalesce(nullif(v_linea->>'importe_liquidado',''),'0')::numeric,
      case when v_pago_id is null then 'NO_VINCULADA' else 'VINCULADA' end,
      coalesce(v_linea->'provider_snapshot','{}'::jsonb)
    ) returning id into v_linea_id;
    v_lineas_count := v_lineas_count + 1;
  end loop;

  for v_disputa in select value from jsonb_array_elements(p_disputas) loop
    v_dispute_ref := nullif(btrim(v_disputa->>'provider_dispute_reference'),'');
    if v_dispute_ref is null then raise exception 'abc_b09_disputa_referencia_requerida'; end if;
    v_dispute_currency := upper(btrim(coalesce(nullif(v_disputa->>'payment_currency_code',''),p_currency_code)));
    if jsonb_typeof(coalesce(v_disputa->'documentacion','{}'::jsonb)) <> 'object'
       or jsonb_typeof(coalesce(v_disputa->'provider_snapshot','{}'::jsonb)) <> 'object' then
      raise exception 'abc_b09_documentacion_invalida';
    end if;
    v_linked_linea := null;
    if nullif(btrim(v_disputa->>'provider_line_reference'),'') is not null then
      select * into v_linked_linea
        from public.abc_b09_liquidacion_lineas
       where liquidacion_id=v_liquidacion.id
         and provider_line_reference=btrim(v_disputa->>'provider_line_reference');
      if not found then raise exception 'abc_b09_linea_disputa_no_encontrada'; end if;
    end if;
    v_pago_id := nullif(v_disputa->>'pago_id','')::uuid;
    v_intento_id := nullif(v_disputa->>'intento_id','')::uuid;
    v_pago_id := coalesce(v_pago_id,v_linked_linea.pago_id);
    v_intento_id := coalesce(v_intento_id,v_linked_linea.intento_id);
    if (v_pago_id is null) <> (v_intento_id is null) then
      raise exception 'abc_b09_vinculo_disputa_incompleto';
    end if;
    if v_pago_id is not null and not exists (
      select 1 from public.pago_intentos i
       where i.empresa_id=p_empresa_id and i.local_id=p_local_id
         and i.id=v_intento_id and i.pago_id=v_pago_id
         and i.payment_currency_code=v_dispute_currency
    ) then raise exception 'abc_b09_intento_disputa_no_encontrado'; end if;
    v_estado := upper(coalesce(nullif(btrim(v_disputa->>'estado'),''),'ABIERTA'));
    insert into public.abc_b09_disputas(
      empresa_id,local_id,provider_code,provider_account_id,provider_dispute_reference,
      provider_reason_code,provider_line_reference,liquidacion_linea_id,pago_id,intento_id,
      payment_currency_code,importe_disputado,estado,responsable_user_id,documentacion,
      provider_snapshot,resolution_note,resolved_at
    ) values (
      p_empresa_id,p_local_id,upper(btrim(p_provider_code)),btrim(p_provider_account_id),
      nullif(btrim(v_disputa->>'provider_reason_code'),''),
      nullif(btrim(v_disputa->>'provider_line_reference'),''),
      nullif(v_linked_linea.id::text,'')::uuid,v_pago_id,v_intento_id,v_dispute_currency,
      coalesce(nullif(v_disputa->>'importe_disputado',''),'0')::numeric,v_estado,
      nullif(v_disputa->>'responsable_user_id','')::uuid,
      coalesce(v_disputa->'documentacion','{}'::jsonb),
      coalesce(v_disputa->'provider_snapshot','{}'::jsonb),
      nullif(v_disputa->>'resolution_note',''),
      nullif(v_disputa->>'resolved_at','')::timestamptz
    );
    v_disputas_count := v_disputas_count + 1;
  end loop;

  return private.abc_b09_completar_operacion(
    p_operation_id,
    jsonb_build_object(
      'ok',true,'replayed',false,'liquidacion',to_jsonb(v_liquidacion),
      'lineas_importadas',v_lineas_count,'disputas_importadas',v_disputas_count
    )
  );
end;
$$;

create function public.abc_b09_vincular_linea(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
  p_pago_id uuid,
  p_intento_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_claim jsonb;
  v_linea public.abc_b09_liquidacion_lineas%rowtype;
begin
  perform private.abc_b09_requerir_service_role();
  if p_pago_id is null or p_intento_id is null then raise exception 'abc_b09_vinculo_requerido'; end if;
  v_claim := private.abc_b09_iniciar_operacion(
    p_operation_id,p_empresa_id,p_local_id,'B09_VINCULAR_LINEA',
    jsonb_build_object('linea_id',p_linea_id,'pago_id',p_pago_id,'intento_id',p_intento_id)
  );
  if (v_claim->>'replayed')::boolean then
    return coalesce(v_claim->'resultado','{}'::jsonb) || jsonb_build_object('replayed',true);
  end if;
  select * into v_linea
    from public.abc_b09_liquidacion_lineas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id
   for update;
  if not found then raise exception 'abc_b09_linea_no_encontrada'; end if;
  if v_linea.estado='EXCLUIDA' then raise exception 'abc_b09_linea_excluida'; end if;
  if v_linea.pago_id is not null and (v_linea.pago_id<>p_pago_id or v_linea.intento_id<>p_intento_id) then
    raise exception 'abc_b09_linea_ya_vinculada';
  end if;
  if not exists (
    select 1 from public.pagos p
     where p.empresa_id=p_empresa_id and p.local_id=p_local_id
       and p.id=p_pago_id and p.payment_currency_code=v_linea.payment_currency_code
  ) then raise exception 'abc_b09_pago_no_encontrado'; end if;
  if not exists (
    select 1 from public.pago_intentos i
     where i.empresa_id=p_empresa_id and i.local_id=p_local_id
       and i.id=p_intento_id and i.pago_id=p_pago_id
       and i.payment_currency_code=v_linea.payment_currency_code
  ) then raise exception 'abc_b09_intento_no_encontrado'; end if;
  update public.abc_b09_liquidacion_lineas
     set pago_id=p_pago_id,intento_id=p_intento_id,estado='VINCULADA'
   where id=p_linea_id;
  update public.abc_b09_liquidaciones
     set estado='EN_CONCILIACION',updated_at=now()
   where id=v_linea.liquidacion_id;
  return private.abc_b09_completar_operacion(
    p_operation_id,jsonb_build_object('ok',true,'replayed',false,'linea_id',p_linea_id,'estado','VINCULADA')
  );
end;
$$;

create function public.abc_b09_resolver_disputa(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_disputa_id uuid,
  p_estado text,
  p_responsable_user_id uuid,
  p_resolution_note text,
  p_documentacion jsonb,
  p_resolved_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_claim jsonb;
  v_disputa public.abc_b09_disputas%rowtype;
  v_estado text := upper(btrim(coalesce(p_estado,'')));
begin
  perform private.abc_b09_requerir_service_role();
  if v_estado not in ('ABIERTA','EN_INVESTIGACION','ACEPTADA','RECHAZADA','REPRESENTADA','CERRADA','CANCELADA') then
    raise exception 'abc_b09_estado_disputa_invalido';
  end if;
  if p_documentacion is null or jsonb_typeof(p_documentacion) <> 'object' then
    raise exception 'abc_b09_documentacion_invalida';
  end if;
  if v_estado in ('CERRADA','CANCELADA','ACEPTADA','RECHAZADA') and p_resolved_at is null then
    raise exception 'abc_b09_resolved_at_requerido';
  end if;
  if v_estado in ('ABIERTA','EN_INVESTIGACION','REPRESENTADA') and p_resolved_at is not null then
    raise exception 'abc_b09_resolved_at_no_permitido';
  end if;
  if p_responsable_user_id is null then raise exception 'abc_b09_responsable_requerido'; end if;
  v_claim := private.abc_b09_iniciar_operacion(
    p_operation_id,p_empresa_id,p_local_id,'B09_RESOLVER_DISPUTA',
    jsonb_build_object(
      'disputa_id',p_disputa_id,'estado',v_estado,'responsable_user_id',p_responsable_user_id,
      'resolution_note',p_resolution_note,'documentacion',p_documentacion,'resolved_at',p_resolved_at
    )
  );
  if (v_claim->>'replayed')::boolean then
    return coalesce(v_claim->'resultado','{}'::jsonb) || jsonb_build_object('replayed',true);
  end if;
  select * into v_disputa
    from public.abc_b09_disputas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_disputa_id
   for update;
  if not found then raise exception 'abc_b09_disputa_no_encontrada'; end if;
  update public.abc_b09_disputas
     set estado=v_estado,responsable_user_id=p_responsable_user_id,
         resolution_note=nullif(btrim(coalesce(p_resolution_note,'')),''),
         documentacion=p_documentacion,resolved_at=p_resolved_at
   where id=p_disputa_id;
  update public.abc_b09_liquidaciones l
     set estado=case when exists (
       select 1 from public.abc_b09_disputas d
        where d.liquidacion_linea_id in (
          select id from public.abc_b09_liquidacion_lineas where liquidacion_id=l.id
        ) and d.estado in ('ABIERTA','EN_INVESTIGACION','REPRESENTADA')
     ) then 'CON_DISCREPANCIA' else 'EN_CONCILIACION' end,
         updated_at=now()
   where l.id in (
     select liquidacion_id from public.abc_b09_liquidacion_lineas
      where id=v_disputa.liquidacion_linea_id
   );
  return private.abc_b09_completar_operacion(
    p_operation_id,jsonb_build_object('ok',true,'replayed',false,'disputa_id',p_disputa_id,'estado',v_estado)
  );
end;
$$;

comment on table public.abc_b09_operaciones is
  'B09.2: idempotencia y auditoria técnica de importaciones y resoluciones autorizadas.';
comment on function public.abc_b09_importar_liquidacion(text,text,text,text,text,text,text,date,date,numeric,numeric,numeric,numeric,numeric,text,jsonb,text,jsonb,jsonb) is
  'B09.2: importa un resumen y su detalle sin crear ventas ni alterar pagos, caja o stock.';
comment on function public.abc_b09_vincular_linea(text,text,text,uuid,uuid,uuid) is
  'B09.2: vincula una línea de liquidación con un pago e intento existentes.';
comment on function public.abc_b09_resolver_disputa(text,text,text,uuid,text,uuid,text,jsonb,timestamptz) is
  'B09.2: cambia el estado de una disputa conservando responsable y documentación.';

revoke all on function private.abc_b09_requerir_service_role() from public,anon,authenticated,service_role;
revoke all on function private.abc_b09_iniciar_operacion(text,text,text,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.abc_b09_completar_operacion(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.abc_b09_importar_liquidacion(text,text,text,text,text,text,text,date,date,numeric,numeric,numeric,numeric,numeric,text,jsonb,text,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.abc_b09_vincular_linea(text,text,text,uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.abc_b09_resolver_disputa(text,text,text,uuid,text,uuid,text,jsonb,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.abc_b09_importar_liquidacion(text,text,text,text,text,text,text,date,date,numeric,numeric,numeric,numeric,numeric,text,jsonb,text,jsonb,jsonb) to service_role;
grant execute on function public.abc_b09_vincular_linea(text,text,text,uuid,uuid,uuid) to service_role;
grant execute on function public.abc_b09_resolver_disputa(text,text,text,uuid,text,uuid,text,jsonb,timestamptz) to service_role;

commit;
