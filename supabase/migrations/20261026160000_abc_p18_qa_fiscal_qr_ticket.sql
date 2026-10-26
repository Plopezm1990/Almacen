-- P18 / Etapa 02. Ticket fiscal QR en QA, modo simulador.
--
-- Esta migración no activa emisión fiscal real ni toca PRODUCCIÓN. Encadena
-- C05 (numeración), C06 (clasificación) y C07 (puerta fiscal) para una venta
-- cobrada en QA y conserva el contrato QR oficial de VERI*FACTU en entorno de
-- pruebas externas. El QR queda marcado PREPARADO_SIMULADOR: no es una
-- presentación ni una validación real ante la AEAT.

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.abc_c05_series_documentales') is null then v_missing:=array_append(v_missing,'abc_c05_series_documentales'); end if;
  if to_regclass('public.abc_c05_documentos_emitidos') is null then v_missing:=array_append(v_missing,'abc_c05_documentos_emitidos'); end if;
  if to_regclass('public.abc_c06_documentos_clasificados') is null then v_missing:=array_append(v_missing,'abc_c06_documentos_clasificados'); end if;
  if to_regclass('public.abc_c07_modalidades_fiscales') is null then v_missing:=array_append(v_missing,'abc_c07_modalidades_fiscales'); end if;
  if to_regclass('public.abc_c07_evaluaciones_fiscales') is null then v_missing:=array_append(v_missing,'abc_c07_evaluaciones_fiscales'); end if;
  if to_regclass('public.ventas_fiscales') is null then v_missing:=array_append(v_missing,'ventas_fiscales'); end if;
  if to_regclass('public.checkouts') is null then v_missing:=array_append(v_missing,'checkouts'); end if;
  if to_regclass('public.checkout_ventas') is null then v_missing:=array_append(v_missing,'checkout_ventas'); end if;
  if to_regclass('public.pagos') is null then v_missing:=array_append(v_missing,'pagos'); end if;
  if to_regclass('public.entidades_fiscales') is null then v_missing:=array_append(v_missing,'entidades_fiscales'); end if;
  if to_regclass('public.abc_operaciones') is null then v_missing:=array_append(v_missing,'abc_operaciones'); end if;
  if to_regprocedure('private.la_tiene_local(text,text)') is null then v_missing:=array_append(v_missing,'la_tiene_local'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_fallar'); end if;
  if to_regprocedure('public.abc_reservar_numero_documental(text,text,text,text,text,text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_reservar_numero_documental'); end if;
  if to_regprocedure('public.abc_clasificar_documento(text,text,text,uuid,text,uuid,jsonb)') is null then v_missing:=array_append(v_missing,'abc_clasificar_documento'); end if;
  if to_regprocedure('public.abc_evaluar_documento_fiscal(text,text,text,uuid,boolean)') is null then v_missing:=array_append(v_missing,'abc_evaluar_documento_fiscal'); end if;
  if to_regprocedure('public.abc_resolver_emision_documental(text,text,text,uuid,text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_resolver_emision_documental'); end if;
  if to_regprocedure('extensions.digest(bytea,text)') is null then v_missing:=array_append(v_missing,'extensions.digest'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_P18_QA_QR_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
end $$;

create table public.abc_fiscal_qr_documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  venta_fiscal_id uuid not null,
  checkout_id uuid not null,
  documento_id uuid not null references public.abc_c05_documentos_emitidos(id) on delete restrict,
  operation_id text not null,
  modo text not null default 'SIMULADOR',
  estado text not null default 'PREPARADO_SIMULADOR',
  nif_emisor text not null,
  codigo_serie text not null,
  numero bigint not null,
  fecha_expedicion date not null,
  importe_total numeric(24,8) not null,
  qr_url text not null,
  qr_payload jsonb not null default '{}'::jsonb,
  registro_hash text not null,
  created_at timestamptz not null default now(),
  constraint abc_p18_qr_scope_fk
    foreign key (empresa_id,local_id) references public.locales(empresa_id,id) on delete restrict,
  constraint abc_p18_qr_operation_uq unique (empresa_id,local_id,operation_id),
  constraint abc_p18_qr_sale_uq unique (empresa_id,local_id,venta_fiscal_id),
  constraint abc_p18_qr_document_uq unique (empresa_id,local_id,documento_id),
  constraint abc_p18_qr_modo check (modo='SIMULADOR'),
  constraint abc_p18_qr_estado check (estado in ('PREPARADO_SIMULADOR','ANULADO')),
  constraint abc_p18_qr_nif check (nullif(btrim(nif_emisor),'') is not null),
  constraint abc_p18_qr_serie check (codigo_serie ~ '^[A-Z0-9][A-Z0-9._/-]{0,19}$'),
  constraint abc_p18_qr_numero check (numero between 1 and 9223372036854775807),
  constraint abc_p18_qr_importe check (importe_total >= 0),
  constraint abc_p18_qr_payload check (jsonb_typeof(qr_payload)='object'),
  constraint abc_p18_qr_hash check (registro_hash ~ '^[0-9a-f]{64}$')
);

create index abc_p18_qr_scope_created_idx
  on public.abc_fiscal_qr_documentos(empresa_id,local_id,created_at desc);

alter table public.abc_fiscal_qr_documentos enable row level security;
revoke all on table public.abc_fiscal_qr_documentos from public,anon,authenticated,service_role;
grant select on table public.abc_fiscal_qr_documentos to authenticated;
create policy abc_p18_qr_select on public.abc_fiscal_qr_documentos
  for select using (private.la_tiene_local(empresa_id,local_id));

-- Serie TPV solo para el tenant de QA. La numeración nunca se reinicia si ya
-- existe: el conflicto solo reactiva/renombra la serie y conserva el contador.
insert into public.abc_c05_series_documentales(
  empresa_id,local_id,tipo_documento,codigo_serie,nombre,autoridad,activa
)
select
  'QA-EMP-A','QA-A1','FACTURA','TPV','Tickets fiscales TPV (simulador QA)','INTERNA',true
where exists (
  select 1 from public.locales l where l.empresa_id='QA-EMP-A' and l.id='QA-A1'
)
on conflict (empresa_id,local_id,tipo_documento,codigo_serie) do update
  set nombre=excluded.nombre, activa=true, updated_at=now();

create function public.abc_preparar_ticket_fiscal_qa(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_venta_fiscal_id uuid,
  p_checkout_id uuid,
  p_fecha_expedicion date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_cmd jsonb;
  v_result jsonb;
  v_reserva jsonb;
  v_clasificacion jsonb;
  v_evaluacion jsonb;
  v_emision jsonb;
  v_venta public.ventas_fiscales%rowtype;
  v_checkout public.checkouts%rowtype;
  v_entidad public.entidades_fiscales%rowtype;
  v_serie public.abc_c05_series_documentales%rowtype;
  v_documento public.abc_c05_documentos_emitidos%rowtype;
  v_existente public.abc_fiscal_qr_documentos%rowtype;
  v_objetivo numeric;
  v_confirmado numeric;
  v_documento_id uuid;
  v_nif text;
  v_numserie text;
  v_fecha text;
  v_importe text;
  v_qr_url text;
  v_payload jsonb;
  v_hash text;
begin
  -- Barrera explícita: esta RPC no puede operar en otro tenant ni en otro local.
  if p_empresa_id<>'QA-EMP-A' or p_local_id<>'QA-A1' then
    raise exception 'qr_fiscal_qa_only';
  end if;
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_EMISOR_CAMBIAR') then
    raise exception 'qr_fiscal_no_autorizado';
  end if;
  if p_operation_id is null
     or p_operation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$'
     or p_venta_fiscal_id is null
     or p_checkout_id is null
     or p_fecha_expedicion is null
     or p_fecha_expedicion>current_date then
    raise exception 'qr_fiscal_parametros_invalidos';
  end if;

  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_PREPARAR_TICKET_FISCAL_QA',
    jsonb_build_object(
      'venta_fiscal_id',p_venta_fiscal_id,
      'checkout_id',p_checkout_id,
      'fecha_expedicion',p_fecha_expedicion,
      'modo','SIMULADOR'
    ),null
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_existente
    from public.abc_fiscal_qr_documentos q
   where q.empresa_id=p_empresa_id and q.local_id=p_local_id
     and q.venta_fiscal_id=p_venta_fiscal_id;
  if found then
    v_result:=jsonb_build_object(
      'ok',true,'replayed',true,'modo',v_existente.modo,'estado',v_existente.estado,
      'qr_id',v_existente.id,'venta_fiscal_id',v_existente.venta_fiscal_id,
      'checkout_id',v_existente.checkout_id,'documento_id',v_existente.documento_id,
      'codigo_serie',v_existente.codigo_serie,'numero',v_existente.numero,
      'fecha_expedicion',v_existente.fecha_expedicion,'importe_total',v_existente.importe_total,
      'qr_url',v_existente.qr_url,'qr_payload',v_existente.qr_payload,
      'registro_hash',v_existente.registro_hash
    );
    perform private.abc_operacion_completar(p_operation_id,v_result);
    return v_result;
  end if;

  select * into v_venta
    from public.ventas_fiscales v
   where v.empresa_id=p_empresa_id and v.local_id=p_local_id and v.id=p_venta_fiscal_id
   for update;
  if not found then raise exception 'venta_fiscal_no_encontrada'; end if;
  if v_venta.estado='CANCELADA' then raise exception 'venta_fiscal_cancelada'; end if;
  if v_venta.total<0 then raise exception 'venta_fiscal_importe_invalido'; end if;

  select * into v_checkout
    from public.checkouts c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=p_checkout_id
   for update;
  if not found or v_checkout.estado<>'COMPLETADO' then
    raise exception 'checkout_no_completado';
  end if;
  if v_checkout.cuenta_id<>v_venta.cuenta_id or v_checkout.currency_code<>v_venta.currency_code then
    raise exception 'checkout_venta_scope_invalido';
  end if;
  select cv.importe_objetivo into v_objetivo
    from public.checkout_ventas cv
   where cv.empresa_id=p_empresa_id and cv.local_id=p_local_id
     and cv.checkout_id=p_checkout_id and cv.venta_fiscal_id=p_venta_fiscal_id;
  if not found or abs(v_objetivo-v_venta.total)>0.005 then
    raise exception 'checkout_venta_importe_invalido';
  end if;
  select coalesce(sum(p.importe_objetivo),0) into v_confirmado
    from public.pagos p
   where p.empresa_id=p_empresa_id and p.local_id=p_local_id
     and p.checkout_id=p_checkout_id and p.estado='CONFIRMADO';
  if v_confirmado+0.005<v_venta.total then
    raise exception 'venta_no_cobrada';
  end if;

  select * into v_entidad
    from public.entidades_fiscales e
   where e.empresa_id=p_empresa_id and e.id=v_venta.entidad_fiscal_id and e.activa=true;
  if not found or not v_entidad.simulada or nullif(btrim(coalesce(v_entidad.identificador_fiscal,'')),'') is null then
    raise exception 'entidad_fiscal_qa_invalida';
  end if;
  if v_entidad.country_code<>'ES' then raise exception 'qr_fiscal_territorio_no_soportado'; end if;

  select * into v_serie
    from public.abc_c05_series_documentales s
   where s.empresa_id=p_empresa_id and s.local_id=p_local_id
     and s.tipo_documento='FACTURA' and s.codigo_serie='TPV' and s.activa=true;
  if not found then raise exception 'serie_ticket_fiscal_qa_no_activa'; end if;

  -- Recupera una reserva previa si una ejecución anterior falló después de
  -- numerar. Así un reintento no quema un segundo número para la misma venta.
  select * into v_documento
    from public.abc_c05_documentos_emitidos d
   where d.empresa_id=p_empresa_id and d.local_id=p_local_id
     and d.tipo_documento='FACTURA' and d.codigo_serie='TPV'
     and d.documento_origen_id=p_venta_fiscal_id::text
   order by d.created_at desc
   limit 1
   for update;
  if found then
    v_documento_id:=v_documento.id;
    v_reserva:=jsonb_build_object(
      'ok',true,'recovered',true,'documento_id',v_documento.id,
      'estado',v_documento.estado,'tipo_documento',v_documento.tipo_documento,
      'codigo_serie',v_documento.codigo_serie,'numero',v_documento.numero
    );
  else
    v_reserva:=public.abc_reservar_numero_documental(
      p_operation_id||':numero',p_empresa_id,p_local_id,'FACTURA','TPV',
      p_venta_fiscal_id::text,
      jsonb_build_object('origen','TPV','venta_fiscal_id',p_venta_fiscal_id,'checkout_id',p_checkout_id,'modo','SIMULADOR')
    );
    v_documento_id:=(v_reserva->>'documento_id')::uuid;
  end if;

  if not exists (
    select 1 from public.abc_c06_documentos_clasificados c
     where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.documento_id=v_documento_id
  ) then
    v_clasificacion:=public.abc_clasificar_documento(
      p_operation_id||':clasifica',p_empresa_id,p_local_id,v_documento_id,
      'FACTURA_SIMPLIFICADA',null,
      jsonb_build_object('tipo','CONSUMIDOR_FINAL','modo','SIMULADOR_QA')
    );
  end if;
  select * into v_documento
    from public.abc_c05_documentos_emitidos d
   where d.empresa_id=p_empresa_id and d.local_id=p_local_id and d.id=v_documento_id;
  v_evaluacion:=public.abc_evaluar_documento_fiscal(
    p_operation_id||':evalua',p_empresa_id,p_local_id,v_documento_id,true
  );
  if coalesce((v_evaluacion->>'ok')::boolean,false) is not true
     or v_evaluacion->>'resultado'<>'PREPARADO_SIMULADOR' then
    raise exception 'qr_fiscal_bloqueado_por_puerta:%',coalesce(v_evaluacion->>'bloqueos','[]');
  end if;

  v_emision:=public.abc_resolver_emision_documental(
    p_operation_id||':emite',p_empresa_id,p_local_id,v_documento_id,'EMITIDO',
    jsonb_build_object('modo','SIMULADOR','venta_fiscal_id',p_venta_fiscal_id,'checkout_id',p_checkout_id,'evaluacion',v_evaluacion)
  );
  v_nif:=btrim(v_entidad.identificador_fiscal);
  v_numserie:=v_documento.codigo_serie||'-'||lpad(v_documento.numero::text,6,'0');
  v_fecha:=to_char(p_fecha_expedicion,'DD-MM-YYYY');
  v_importe:=to_char(round(v_venta.total,2),'FM999999999999990.00');
  -- Los valores que llegan aquí son los de la serie fija TPV, la entidad QA
  -- simulada y los formatos controlados por las restricciones anteriores.
  v_qr_url:='https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif='
    ||replace(replace(replace(v_nif,'%','%25'),'&','%26'),' ','%20')
    ||'&numserie='||replace(replace(replace(v_numserie,'%','%25'),'&','%26'),' ','%20')
    ||'&fecha='||v_fecha
    ||'&importe='||v_importe;
  v_payload:=jsonb_build_object(
    'nif',v_nif,'numserie',v_numserie,'fecha',v_fecha,'importe',v_importe,
    'url',v_qr_url,'entorno','PRUEBAS_EXTERNAS','simulador',true
  );
  v_hash:=encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
  insert into public.abc_fiscal_qr_documentos(
    empresa_id,local_id,venta_fiscal_id,checkout_id,documento_id,operation_id,
    modo,estado,nif_emisor,codigo_serie,numero,fecha_expedicion,importe_total,
    qr_url,qr_payload,registro_hash
  ) values (
    p_empresa_id,p_local_id,p_venta_fiscal_id,p_checkout_id,v_documento_id,p_operation_id,
    'SIMULADOR','PREPARADO_SIMULADOR',v_nif,'TPV',(v_reserva->>'numero')::bigint,
    p_fecha_expedicion,v_venta.total,v_qr_url,v_payload,v_hash
  ) returning * into v_existente;
  v_result:=jsonb_build_object(
    'ok',true,'replayed',false,'modo','SIMULADOR','estado','PREPARADO_SIMULADOR',
    'qr_id',v_existente.id,'venta_fiscal_id',p_venta_fiscal_id,'checkout_id',p_checkout_id,
    'documento_id',v_documento_id,'codigo_serie',v_existente.codigo_serie,
    'numero',v_existente.numero,'fecha_expedicion',v_existente.fecha_expedicion,
    'importe_total',v_existente.importe_total,'qr_url',v_qr_url,'qr_payload',v_payload,
    'registro_hash',v_hash,'aeat_presentacion',false
  );
  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'VENTA',p_venta_fiscal_id::text,
    'TICKET_FISCAL_QR_PREPARADO_QA',v_result,auth.uid(),null,now(),current_date
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

revoke all on function public.abc_preparar_ticket_fiscal_qa(text,text,text,uuid,uuid,date)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_preparar_ticket_fiscal_qa(text,text,text,uuid,uuid,date)
  to authenticated;

comment on table public.abc_fiscal_qr_documentos is
  'P18 Etapa 02: contrato QR de ticket fiscal en QA, solo SIMULADOR y sin presentación AEAT.';
comment on function public.abc_preparar_ticket_fiscal_qa(text,text,text,uuid,uuid,date) is
  'P18 Etapa 02: prepara ticket fiscal simplificado QR para QA-EMP-A/QA-A1, idempotente y no productivo.';
