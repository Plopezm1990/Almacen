-- ABC F5 C11. Conciliacion documental explicable e inmutable.
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
  if to_regclass('public.abc_c08_documento_versiones') is null then v_missing:=array_append(v_missing,'abc_c08_documento_versiones'); end if;
  if to_regclass('public.abc_c09_impresiones_documentales') is null then v_missing:=array_append(v_missing,'abc_c09_impresiones_documentales'); end if;
  if to_regclass('public.abc_c10_entregas_documentales') is null then v_missing:=array_append(v_missing,'abc_c10_entregas_documentales'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_request_hash(jsonb)') is null then v_missing:=array_append(v_missing,'abc_request_hash'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_fallar'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F5_C11_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
  if to_regclass('public.abc_c11_conciliaciones_documentales') is not null then
    raise exception 'ABC_F5_C11_PREFLIGHT_FALLO:objetos_C11_ya_existen';
  end if;
end $$;

create table public.abc_c11_conciliaciones_documentales (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  documento_id uuid not null references public.abc_c05_documentos_emitidos(id) on delete restrict,
  version_id uuid not null references public.abc_c08_documento_versiones(id) on delete restrict,
  resultado text not null,
  informe jsonb not null,
  informe_hash text not null,
  operation_id text not null,
  created_at timestamptz not null default now(),
  constraint abc_c11_conciliacion_scope_fk
    foreign key (empresa_id,local_id) references public.locales(empresa_id,id) on delete restrict,
  constraint abc_c11_conciliacion_version_uq unique (documento_id,version_id,id),
  constraint abc_c11_conciliacion_operation_fk
    foreign key (empresa_id,local_id,operation_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id) on delete restrict,
  constraint abc_c11_conciliacion_operation_uq unique (empresa_id,local_id,operation_id),
  constraint abc_c11_conciliacion_resultado check (resultado in ('CONCILIADO','PENDIENTE_ENTREGA','INCONSISTENTE')),
  constraint abc_c11_conciliacion_informe check (jsonb_typeof(informe)='object'),
  constraint abc_c11_conciliacion_hash check (informe_hash ~ '^[0-9a-f]{64}$')
);

create index abc_c11_conciliacion_scope_created_idx
  on public.abc_c11_conciliaciones_documentales(empresa_id,local_id,created_at desc);

create function private.abc_c11_guard_reconciliation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception 'conciliacion_documental_inmutable';
end $$;

create trigger abc_f5_c11_guard_reconciliation
before update or delete on public.abc_c11_conciliaciones_documentales
for each row execute function private.abc_c11_guard_reconciliation();

create function public.abc_generar_conciliacion_documental(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_documento_id uuid,
  p_version_id uuid
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
  v_informe jsonb;
  v_documento public.abc_c05_documentos_emitidos%rowtype;
  v_version public.abc_c08_documento_versiones%rowtype;
  v_clasificacion public.abc_c06_documentos_clasificados%rowtype;
  v_impresiones integer;
  v_entregas integer;
  v_bloqueos jsonb:='[]'::jsonb;
  v_resultado text;
  v_conciliacion_id uuid;
  v_informe_hash text;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_EMISOR_CAMBIAR') then
    raise exception 'conciliacion_documental_no_autorizada';
  end if;
  if p_operation_id is null or p_documento_id is null or p_version_id is null then
    raise exception 'conciliacion_documental_parametros_invalidos';
  end if;
  v_request:=jsonb_build_object('documento_id',p_documento_id,'version_id',p_version_id);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_GENERAR_CONCILIACION_DOCUMENTAL',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_documento
    from public.abc_c05_documentos_emitidos d
   where d.empresa_id=p_empresa_id and d.local_id=p_local_id and d.id=p_documento_id
   for update;
  if not found then raise exception 'documento_no_encontrado'; end if;
  select * into v_version
    from public.abc_c08_documento_versiones v
   where v.empresa_id=p_empresa_id and v.local_id=p_local_id
     and v.id=p_version_id and v.documento_id=p_documento_id;
  if not found then raise exception 'version_documental_no_encontrada'; end if;
  select * into v_clasificacion
    from public.abc_c06_documentos_clasificados c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.documento_id=p_documento_id;
  if not found then raise exception 'documento_sin_clasificar'; end if;
  if v_documento.estado<>'EMITIDO' then v_bloqueos:=v_bloqueos||jsonb_build_array('DOCUMENTO_NO_EMITIDO'); end if;
  select count(*)::integer into v_impresiones
    from public.abc_c09_impresiones_documentales i
   where i.empresa_id=p_empresa_id and i.local_id=p_local_id
     and i.documento_id=p_documento_id and i.version_id=p_version_id;
  select count(*)::integer into v_entregas
    from public.abc_c10_entregas_documentales e
   where e.empresa_id=p_empresa_id and e.local_id=p_local_id
     and e.documento_id=p_documento_id and e.version_id=p_version_id;
  if v_entregas=0 then v_bloqueos:=v_bloqueos||jsonb_build_array('ENTREGA_FALTANTE'); end if;
  v_resultado:=case when jsonb_array_length(v_bloqueos)=0 then 'CONCILIADO' when v_bloqueos ? 'DOCUMENTO_NO_EMITIDO' then 'INCONSISTENTE' else 'PENDIENTE_ENTREGA' end;
  v_informe:=jsonb_build_object(
    'documento',jsonb_build_object('id',p_documento_id,'estado',v_documento.estado,'tipo',v_documento.tipo_documento,'serie',v_documento.codigo_serie,'numero',v_documento.numero),
    'clasificacion',jsonb_build_object('tipo',v_clasificacion.tipo_documental,'referencia_id',v_clasificacion.documento_referencia_id),
    'conservacion',jsonb_build_object('version_id',v_version.id,'numero_version',v_version.numero_version,'snapshot_hash',v_version.snapshot_hash),
    'impresion',jsonb_build_object('cantidad',v_impresiones),
    'entrega',jsonb_build_object('cantidad',v_entregas),
    'resultado',v_resultado,
    'bloqueos',v_bloqueos,
    'explicacion',case when v_resultado='CONCILIADO' then 'Documento emitido, clasificado, conservado y con al menos una entrega registrada.' when v_resultado='PENDIENTE_ENTREGA' then 'La identidad y conservación son coherentes; falta registrar una entrega.' else 'La cadena documental contiene un estado incompatible con la conciliación.' end
  );
  v_informe_hash:=private.abc_request_hash(v_informe);
  insert into public.abc_c11_conciliaciones_documentales(
    empresa_id,local_id,documento_id,version_id,resultado,informe,informe_hash,operation_id
  ) values (
    p_empresa_id,p_local_id,p_documento_id,p_version_id,v_resultado,v_informe,v_informe_hash,p_operation_id
  ) returning id into v_conciliacion_id;
  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'DOCUMENTO',p_documento_id::text,'DOCUMENTO_CONCILIADO',
    jsonb_build_object('conciliacion_id',v_conciliacion_id,'version_id',p_version_id,'resultado',v_resultado,'informe_hash',v_informe_hash,'bloqueos',v_bloqueos),
    auth.uid(),null,now(),current_date
  );
  v_result:=jsonb_build_object('ok',true,'conciliacion_id',v_conciliacion_id,'documento_id',p_documento_id,'version_id',p_version_id,'resultado',v_resultado,'informe_hash',v_informe_hash,'informe',v_informe);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

revoke all on table public.abc_c11_conciliaciones_documentales from public,anon,authenticated,service_role;
alter table public.abc_c11_conciliaciones_documentales enable row level security;
revoke all on function private.abc_c11_guard_reconciliation() from public,anon,authenticated,service_role;
revoke all on function public.abc_generar_conciliacion_documental(text,text,text,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.abc_generar_conciliacion_documental(text,text,text,uuid,uuid) to authenticated;
