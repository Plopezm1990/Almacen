-- ABC F5 C08. Conservacion inmutable y correcciones vinculadas.
-- Candidato aislado: no aplicado en QA/PROD. No constituye cumplimiento fiscal.

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.locales') is null then v_missing:=array_append(v_missing,'locales'); end if;
  if to_regclass('public.abc_operaciones') is null then v_missing:=array_append(v_missing,'abc_operaciones'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regclass('public.abc_c05_documentos_emitidos') is null then v_missing:=array_append(v_missing,'abc_c05_documentos_emitidos'); end if;
  if to_regclass('public.abc_c06_documentos_clasificados') is null then v_missing:=array_append(v_missing,'abc_c06_documentos_clasificados'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_request_hash(jsonb)') is null then v_missing:=array_append(v_missing,'abc_request_hash'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_fallar'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F5_C08_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
  if to_regclass('public.abc_c08_documento_versiones') is not null
     or to_regclass('public.abc_c08_correcciones_documentales') is not null then
    raise exception 'ABC_F5_C08_PREFLIGHT_FALLO:objetos_C08_ya_existen';
  end if;
end $$;

create table public.abc_c08_documento_versiones (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  documento_id uuid not null references public.abc_c05_documentos_emitidos(id) on delete restrict,
  numero_version integer not null default 1,
  snapshot jsonb not null,
  emisor jsonb not null default '{}'::jsonb,
  receptor jsonb not null default '{}'::jsonb,
  respuesta_fiscal jsonb not null default '{}'::jsonb,
  snapshot_hash text not null,
  operation_id text not null,
  created_at timestamptz not null default now(),
  constraint abc_c08_version_scope_fk
    foreign key (empresa_id,local_id) references public.locales(empresa_id,id) on delete restrict,
  constraint abc_c08_version_numero check (numero_version>=1),
  constraint abc_c08_version_snapshot check (jsonb_typeof(snapshot)='object'),
  constraint abc_c08_version_emisor check (jsonb_typeof(emisor)='object'),
  constraint abc_c08_version_receptor check (jsonb_typeof(receptor)='object'),
  constraint abc_c08_version_respuesta check (jsonb_typeof(respuesta_fiscal)='object'),
  constraint abc_c08_version_hash check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  constraint abc_c08_version_operation_fk
    foreign key (empresa_id,local_id,operation_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id) on delete restrict,
  constraint abc_c08_version_doc_uq unique (documento_id,numero_version),
  constraint abc_c08_version_operation_uq unique (empresa_id,local_id,operation_id)
);

create table public.abc_c08_correcciones_documentales (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  documento_original_id uuid not null references public.abc_c05_documentos_emitidos(id) on delete restrict,
  documento_correccion_id uuid references public.abc_c05_documentos_emitidos(id) on delete restrict,
  tipo_correccion text not null,
  motivo text not null,
  detalle jsonb not null default '{}'::jsonb,
  estado text not null default 'REGISTRADA',
  operation_id text not null,
  created_at timestamptz not null default now(),
  constraint abc_c08_correccion_scope_fk
    foreign key (empresa_id,local_id) references public.locales(empresa_id,id) on delete restrict,
  constraint abc_c08_correccion_tipo check (tipo_correccion in ('RECTIFICACION','CANCELACION_OPERATIVA','REEMBOLSO')),
  constraint abc_c08_correccion_motivo check (nullif(btrim(motivo),'') is not null),
  constraint abc_c08_correccion_detalle check (jsonb_typeof(detalle)='object'),
  constraint abc_c08_correccion_estado check (estado in ('REGISTRADA','PENDIENTE_CONCILIACION')),
  constraint abc_c08_correccion_operation_fk
    foreign key (empresa_id,local_id,operation_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id) on delete restrict,
  constraint abc_c08_correccion_operation_uq unique (empresa_id,local_id,operation_id)
);

create index abc_c08_version_scope_created_idx
  on public.abc_c08_documento_versiones(empresa_id,local_id,created_at desc);
create index abc_c08_correccion_scope_created_idx
  on public.abc_c08_correcciones_documentales(empresa_id,local_id,created_at desc);

create function private.abc_c08_guard_version()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception 'documento_version_inmutable';
end $$;

create trigger abc_f5_c08_guard_version
before update on public.abc_c08_documento_versiones
for each row execute function private.abc_c08_guard_version();

create function private.abc_c08_guard_correction()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception 'correccion_documental_inmutable';
end $$;

create trigger abc_f5_c08_guard_correction
before update on public.abc_c08_correcciones_documentales
for each row execute function private.abc_c08_guard_correction();

create function public.abc_conservar_documento_emitido(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_documento_id uuid,
  p_snapshot jsonb,
  p_emisor jsonb,
  p_receptor jsonb,
  p_respuesta_fiscal jsonb
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
  v_request jsonb;
  v_documento public.abc_c05_documentos_emitidos%rowtype;
  v_version_id uuid;
  v_snapshot jsonb:=coalesce(p_snapshot,'{}'::jsonb);
  v_emisor jsonb:=coalesce(p_emisor,'{}'::jsonb);
  v_receptor jsonb:=coalesce(p_receptor,'{}'::jsonb);
  v_fiscal jsonb:=coalesce(p_respuesta_fiscal,'{}'::jsonb);
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_EMISOR_CAMBIAR') then
    raise exception 'abc_documento_no_autorizado';
  end if;
  if p_operation_id is null or p_documento_id is null or jsonb_typeof(v_snapshot)<>'object'
     or jsonb_typeof(v_emisor)<>'object' or jsonb_typeof(v_receptor)<>'object' or jsonb_typeof(v_fiscal)<>'object' then
    raise exception 'conservacion_documental_parametros_invalidos';
  end if;
  v_request:=jsonb_build_object('documento_id',p_documento_id,'snapshot',v_snapshot,'emisor',v_emisor,'receptor',v_receptor,'respuesta_fiscal',v_fiscal);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_CONSERVAR_DOCUMENTO_EMITIDO',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;
  select * into v_documento from public.abc_c05_documentos_emitidos d
   where d.empresa_id=p_empresa_id and d.local_id=p_local_id and d.id=p_documento_id for update;
  if not found then raise exception 'documento_no_encontrado'; end if;
  if v_documento.estado<>'EMITIDO' then raise exception 'documento_no_emitido'; end if;
  if not exists (select 1 from public.abc_c06_documentos_clasificados c where c.documento_id=p_documento_id and c.empresa_id=p_empresa_id and c.local_id=p_local_id) then
    raise exception 'documento_sin_clasificar';
  end if;
  if exists (select 1 from public.abc_c08_documento_versiones v where v.documento_id=p_documento_id) then
    raise exception 'documento_version_ya_conservada';
  end if;
  insert into public.abc_c08_documento_versiones(
    empresa_id,local_id,documento_id,numero_version,snapshot,emisor,receptor,respuesta_fiscal,snapshot_hash,operation_id
  ) values (
    p_empresa_id,p_local_id,p_documento_id,1,v_snapshot,v_emisor,v_receptor,v_fiscal,private.abc_request_hash(v_snapshot),p_operation_id
  ) returning id into v_version_id;
  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
    values(p_empresa_id,p_local_id,p_operation_id,'DOCUMENTO',p_documento_id::text,'DOCUMENTO_CONSERVADO',jsonb_build_object('version_id',v_version_id,'numero_version',1,'snapshot_hash',private.abc_request_hash(v_snapshot)),auth.uid(),null,now(),current_date);
  v_result:=jsonb_build_object('ok',true,'version_id',v_version_id,'documento_id',p_documento_id,'numero_version',1,'snapshot_hash',private.abc_request_hash(v_snapshot));
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

create function public.abc_registrar_correccion_documental(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_documento_original_id uuid,
  p_tipo_correccion text,
  p_documento_correccion_id uuid,
  p_motivo text,
  p_detalle jsonb
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
  v_request jsonb;
  v_original public.abc_c05_documentos_emitidos%rowtype;
  v_correccion public.abc_c05_documentos_emitidos%rowtype;
  v_clasificacion public.abc_c06_documentos_clasificados%rowtype;
  v_tipo text:=upper(btrim(coalesce(p_tipo_correccion,'')));
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_detalle jsonb:=coalesce(p_detalle,'{}'::jsonb);
  v_id uuid;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_EMISOR_CAMBIAR') then
    raise exception 'abc_documento_no_autorizado';
  end if;
  if p_operation_id is null or p_documento_original_id is null or v_motivo is null
     or v_tipo not in ('RECTIFICACION','CANCELACION_OPERATIVA','REEMBOLSO')
     or jsonb_typeof(v_detalle)<>'object' then
    raise exception 'correccion_documental_parametros_invalidos';
  end if;
  if v_tipo='RECTIFICACION' and p_documento_correccion_id is null then raise exception 'rectificacion_documento_requerido'; end if;
  if v_tipo<>'RECTIFICACION' and p_documento_correccion_id is not null then raise exception 'correccion_no_rectificativa_sin_documento'; end if;
  v_request:=jsonb_build_object('documento_original_id',p_documento_original_id,'tipo_correccion',v_tipo,'documento_correccion_id',p_documento_correccion_id,'motivo',v_motivo,'detalle',v_detalle);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_REGISTRAR_CORRECCION_DOCUMENTAL',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;
  select * into v_original from public.abc_c05_documentos_emitidos d where d.empresa_id=p_empresa_id and d.local_id=p_local_id and d.id=p_documento_original_id for update;
  if not found then raise exception 'documento_original_no_encontrado'; end if;
  if v_original.estado<>'EMITIDO' then raise exception 'documento_original_no_emitido'; end if;
  if not exists (select 1 from public.abc_c08_documento_versiones v where v.documento_id=p_documento_original_id) then raise exception 'documento_original_no_conservado'; end if;
  if v_tipo='RECTIFICACION' then
    if p_documento_correccion_id=p_documento_original_id then raise exception 'correccion_no_puede_ser_original'; end if;
    select * into v_correccion from public.abc_c05_documentos_emitidos d where d.empresa_id=p_empresa_id and d.local_id=p_local_id and d.id=p_documento_correccion_id for update;
    if not found then raise exception 'documento_correccion_no_encontrado'; end if;
    if v_correccion.estado<>'EMITIDO' then raise exception 'documento_correccion_no_emitido'; end if;
    select * into v_clasificacion from public.abc_c06_documentos_clasificados c where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.documento_id=p_documento_correccion_id;
    if not found or v_clasificacion.tipo_documental<>'FACTURA_RECTIFICATIVA' or v_clasificacion.documento_referencia_id<>p_documento_original_id then
      raise exception 'documento_correccion_no_rectificativa_vinculada';
    end if;
  end if;
  insert into public.abc_c08_correcciones_documentales(empresa_id,local_id,documento_original_id,documento_correccion_id,tipo_correccion,motivo,detalle,operation_id)
    values(p_empresa_id,p_local_id,p_documento_original_id,p_documento_correccion_id,v_tipo,v_motivo,v_detalle,p_operation_id) returning id into v_id;
  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
    values(p_empresa_id,p_local_id,p_operation_id,'DOCUMENTO',p_documento_original_id::text,'DOCUMENTO_CORREGIDO',jsonb_build_object('correccion_id',v_id,'tipo_correccion',v_tipo,'documento_correccion_id',p_documento_correccion_id,'motivo',v_motivo),auth.uid(),null,now(),current_date);
  v_result:=jsonb_build_object('ok',true,'correccion_id',v_id,'documento_original_id',p_documento_original_id,'tipo_correccion',v_tipo,'documento_correccion_id',p_documento_correccion_id,'estado','REGISTRADA');
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

revoke all on table public.abc_c08_documento_versiones,public.abc_c08_correcciones_documentales from public,anon,authenticated,service_role;
alter table public.abc_c08_documento_versiones enable row level security;
alter table public.abc_c08_correcciones_documentales enable row level security;
revoke all on function private.abc_c08_guard_version() from public,anon,authenticated,service_role;
revoke all on function private.abc_c08_guard_correction() from public,anon,authenticated,service_role;
revoke all on function public.abc_conservar_documento_emitido(text,text,text,uuid,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.abc_registrar_correccion_documental(text,text,text,uuid,text,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.abc_conservar_documento_emitido(text,text,text,uuid,jsonb,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.abc_registrar_correccion_documental(text,text,text,uuid,text,uuid,text,jsonb) to authenticated;
