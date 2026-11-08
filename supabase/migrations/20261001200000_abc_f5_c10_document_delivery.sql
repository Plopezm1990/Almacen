-- ABC F5 C10. Entrega y copias de documentos conservados.
-- Candidato aislado: no aplicado en QA/PROD. No constituye cumplimiento fiscal.

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.locales') is null then v_missing:=array_append(v_missing,'locales'); end if;
  if to_regclass('public.abc_operaciones') is null then v_missing:=array_append(v_missing,'abc_operaciones'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regclass('public.abc_c05_documentos_emitidos') is null then v_missing:=array_append(v_missing,'abc_c05_documentos_emitidos'); end if;
  if to_regclass('public.abc_c08_documento_versiones') is null then v_missing:=array_append(v_missing,'abc_c08_documento_versiones'); end if;
  if to_regclass('public.abc_c09_impresiones_documentales') is null then v_missing:=array_append(v_missing,'abc_c09_impresiones_documentales'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_fallar'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F5_C10_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
  if to_regclass('public.abc_c10_entregas_documentales') is not null then
    raise exception 'ABC_F5_C10_PREFLIGHT_FALLO:objetos_C10_ya_existen';
  end if;
end $$;

create table public.abc_c10_entregas_documentales (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  documento_id uuid not null references public.abc_c05_documentos_emitidos(id) on delete restrict,
  version_id uuid not null references public.abc_c08_documento_versiones(id) on delete restrict,
  impresion_id uuid references public.abc_c09_impresiones_documentales(id) on delete restrict,
  tipo_entrega text not null,
  canal text not null,
  destinatario jsonb not null,
  estado text not null default 'REGISTRADA',
  motivo text not null,
  referencia_externa text,
  metadata jsonb not null default '{}'::jsonb,
  operation_id text not null,
  created_at timestamptz not null default now(),
  constraint abc_c10_entrega_scope_fk
    foreign key (empresa_id,local_id) references public.locales(empresa_id,id) on delete restrict,
  constraint abc_c10_entrega_operation_fk
    foreign key (empresa_id,local_id,operation_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id) on delete restrict,
  constraint abc_c10_entrega_operation_uq unique (empresa_id,local_id,operation_id),
  constraint abc_c10_entrega_tipo check (tipo_entrega in ('ORIGINAL','COPIA')),
  constraint abc_c10_entrega_canal check (canal in ('PAPEL','EMAIL','DESCARGA','API')),
  constraint abc_c10_entrega_destinatario check (jsonb_typeof(destinatario)='object'),
  constraint abc_c10_entrega_estado check (estado in ('REGISTRADA','CONFIRMADA','FALLIDA')),
  constraint abc_c10_entrega_motivo check (nullif(btrim(motivo),'') is not null),
  constraint abc_c10_entrega_metadata check (jsonb_typeof(metadata)='object')
);

create index abc_c10_entrega_scope_created_idx
  on public.abc_c10_entregas_documentales(empresa_id,local_id,created_at desc);

create function private.abc_c10_guard_delivery()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception 'entrega_documental_inmutable';
end $$;

create trigger abc_f5_c10_guard_delivery
before update or delete on public.abc_c10_entregas_documentales
for each row execute function private.abc_c10_guard_delivery();

create function public.abc_registrar_entrega_documental(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_documento_id uuid,
  p_version_id uuid,
  p_impresion_id uuid,
  p_tipo_entrega text,
  p_canal text,
  p_destinatario jsonb,
  p_motivo text,
  p_referencia_externa text,
  p_metadata jsonb
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
  v_version public.abc_c08_documento_versiones%rowtype;
  v_impresion public.abc_c09_impresiones_documentales%rowtype;
  v_tipo text:=upper(btrim(coalesce(p_tipo_entrega,'')));
  v_canal_entrega text:=upper(btrim(coalesce(p_canal,'')));
  v_destinatario jsonb:=coalesce(p_destinatario,'{}'::jsonb);
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')), '');
  v_metadata jsonb:=coalesce(p_metadata,'{}'::jsonb);
  v_entrega_id uuid;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_EMISOR_CAMBIAR') then
    raise exception 'entrega_documental_no_autorizada';
  end if;
  if p_operation_id is null or p_documento_id is null or p_version_id is null
     or v_tipo not in ('ORIGINAL','COPIA')
     or v_canal_entrega not in ('PAPEL','EMAIL','DESCARGA','API')
     or v_motivo is null or jsonb_typeof(v_destinatario)<>'object'
     or jsonb_typeof(v_metadata)<>'object' then
    raise exception 'entrega_documental_parametros_invalidos';
  end if;
  if v_canal_entrega='PAPEL' and p_impresion_id is null then
    raise exception 'entrega_papel_sin_impresion';
  end if;
  v_request:=jsonb_build_object(
    'documento_id',p_documento_id,
    'version_id',p_version_id,
    'impresion_id',p_impresion_id,
    'tipo_entrega',v_tipo,
    'canal',v_canal_entrega,
    'destinatario',v_destinatario,
    'motivo',v_motivo,
    'referencia_externa',p_referencia_externa,
    'metadata',v_metadata
  );
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_REGISTRAR_ENTREGA_DOCUMENTAL',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_documento
    from public.abc_c05_documentos_emitidos d
   where d.empresa_id=p_empresa_id and d.local_id=p_local_id and d.id=p_documento_id
   for update;
  if not found then raise exception 'documento_no_encontrado'; end if;
  if v_documento.estado<>'EMITIDO' then raise exception 'documento_no_emitido'; end if;
  select * into v_version
    from public.abc_c08_documento_versiones v
   where v.empresa_id=p_empresa_id and v.local_id=p_local_id
     and v.id=p_version_id and v.documento_id=p_documento_id;
  if not found then raise exception 'version_documental_no_encontrada'; end if;
  if p_impresion_id is not null then
    select * into v_impresion
      from public.abc_c09_impresiones_documentales i
     where i.empresa_id=p_empresa_id and i.local_id=p_local_id
       and i.id=p_impresion_id and i.documento_id=p_documento_id and i.version_id=p_version_id;
    if not found then raise exception 'impresion_no_corresponde_documento'; end if;
  end if;
  insert into public.abc_c10_entregas_documentales(
    empresa_id,local_id,documento_id,version_id,impresion_id,tipo_entrega,canal,destinatario,motivo,referencia_externa,metadata,operation_id
  ) values (
    p_empresa_id,p_local_id,p_documento_id,p_version_id,p_impresion_id,v_tipo,v_canal_entrega,v_destinatario,v_motivo,p_referencia_externa,v_metadata,p_operation_id
  ) returning id into v_entrega_id;
  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'DOCUMENTO',p_documento_id::text,'DOCUMENTO_ENTREGADO',
    jsonb_build_object('entrega_id',v_entrega_id,'version_id',p_version_id,'impresion_id',p_impresion_id,'tipo_entrega',v_tipo,'canal',v_canal_entrega,'destinatario',v_destinatario,'estado','REGISTRADA'),
    auth.uid(),null,now(),current_date
  );
  v_result:=jsonb_build_object(
    'ok',true,'entrega_id',v_entrega_id,'documento_id',p_documento_id,'version_id',p_version_id,
    'impresion_id',p_impresion_id,'tipo_entrega',v_tipo,'canal',v_canal_entrega,'estado','REGISTRADA'
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

revoke all on table public.abc_c10_entregas_documentales from public,anon,authenticated,service_role;
alter table public.abc_c10_entregas_documentales enable row level security;
revoke all on function private.abc_c10_guard_delivery() from public,anon,authenticated,service_role;
revoke all on function public.abc_registrar_entrega_documental(text,text,text,uuid,uuid,uuid,text,text,jsonb,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.abc_registrar_entrega_documental(text,text,text,uuid,uuid,uuid,text,text,jsonb,text,text,jsonb) to authenticated;
