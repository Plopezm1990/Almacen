-- ABC F5 C09. Impresion y reimpresion sin duplicar la venta.
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
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_fallar'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F5_C09_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
  if to_regclass('public.abc_c09_impresiones_documentales') is not null then
    raise exception 'ABC_F5_C09_PREFLIGHT_FALLO:objetos_C09_ya_existen';
  end if;
end $$;

create table public.abc_c09_impresiones_documentales (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  documento_id uuid not null references public.abc_c05_documentos_emitidos(id) on delete restrict,
  version_id uuid not null references public.abc_c08_documento_versiones(id) on delete restrict,
  numero_copia integer not null,
  tipo_impresion text not null,
  canal text not null,
  motivo text not null,
  metadata jsonb not null default '{}'::jsonb,
  operation_id text not null,
  created_at timestamptz not null default now(),
  constraint abc_c09_impresion_scope_fk
    foreign key (empresa_id,local_id) references public.locales(empresa_id,id) on delete restrict,
  constraint abc_c09_impresion_version_uq unique (documento_id,version_id,numero_copia),
  constraint abc_c09_impresion_operation_fk
    foreign key (empresa_id,local_id,operation_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id) on delete restrict,
  constraint abc_c09_impresion_operation_uq unique (empresa_id,local_id,operation_id),
  constraint abc_c09_impresion_numero check (numero_copia>=1),
  constraint abc_c09_impresion_tipo check (tipo_impresion in ('ORIGINAL','REIMPRESION')),
  constraint abc_c09_impresion_canal check (canal in ('PAPEL','PDF','DIGITAL')),
  constraint abc_c09_impresion_motivo check (nullif(btrim(motivo),'') is not null),
  constraint abc_c09_impresion_metadata check (jsonb_typeof(metadata)='object')
);

create index abc_c09_impresion_scope_created_idx
  on public.abc_c09_impresiones_documentales(empresa_id,local_id,created_at desc);

create function private.abc_c09_guard_print()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op='DELETE' then raise exception 'impresion_documental_inmutable'; end if;
  raise exception 'impresion_documental_inmutable';
end $$;

create trigger abc_f5_c09_guard_print
before update or delete on public.abc_c09_impresiones_documentales
for each row execute function private.abc_c09_guard_print();

create function public.abc_registrar_impresion_documental(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_documento_id uuid,
  p_version_id uuid,
  p_tipo_impresion text,
  p_canal text,
  p_motivo text,
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
  v_tipo text:=upper(btrim(coalesce(p_tipo_impresion,'')));
  v_canal_impresion text:=upper(btrim(coalesce(p_canal,'')));
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')), '');
  v_metadata jsonb:=coalesce(p_metadata,'{}'::jsonb);
  v_numero integer;
  v_print_id uuid;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_EMISOR_CAMBIAR') then
    raise exception 'impresion_documental_no_autorizada';
  end if;
  if p_operation_id is null or p_documento_id is null or p_version_id is null
     or v_tipo not in ('ORIGINAL','REIMPRESION')
     or v_canal_impresion not in ('PAPEL','PDF','DIGITAL')
     or v_motivo is null or jsonb_typeof(v_metadata)<>'object' then
    raise exception 'impresion_documental_parametros_invalidos';
  end if;
  if v_tipo='REIMPRESION' and v_motivo='EMISION' then
    raise exception 'motivo_reimpresion_invalido';
  end if;
  v_request:=jsonb_build_object(
    'documento_id',p_documento_id,
    'version_id',p_version_id,
    'tipo_impresion',v_tipo,
    'canal',v_canal_impresion,
    'motivo',v_motivo,
    'metadata',v_metadata
  );
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_REGISTRAR_IMPRESION_DOCUMENTAL',v_request,null);
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

  if v_tipo='ORIGINAL' and exists (
    select 1 from public.abc_c09_impresiones_documentales i
     where i.empresa_id=p_empresa_id and i.local_id=p_local_id
       and i.documento_id=p_documento_id and i.version_id=p_version_id
       and i.tipo_impresion='ORIGINAL'
  ) then
    raise exception 'impresion_original_ya_registrada';
  end if;
  if v_tipo='REIMPRESION' and v_motivo='EMISION' then
    raise exception 'motivo_reimpresion_invalido';
  end if;
  select coalesce(max(i.numero_copia),0)+1 into v_numero
    from public.abc_c09_impresiones_documentales i
   where i.empresa_id=p_empresa_id and i.local_id=p_local_id
     and i.documento_id=p_documento_id and i.version_id=p_version_id;
  insert into public.abc_c09_impresiones_documentales(
    empresa_id,local_id,documento_id,version_id,numero_copia,tipo_impresion,canal,motivo,metadata,operation_id
  ) values (
    p_empresa_id,p_local_id,p_documento_id,p_version_id,v_numero,v_tipo,v_canal_impresion,v_motivo,v_metadata,p_operation_id
  ) returning id into v_print_id;
  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'DOCUMENTO',p_documento_id::text,'DOCUMENTO_IMPRESO',
    jsonb_build_object('impresion_id',v_print_id,'version_id',p_version_id,'numero_copia',v_numero,'tipo_impresion',v_tipo,'canal',v_canal_impresion,'motivo',v_motivo),
    auth.uid(),null,now(),current_date
  );
  v_result:=jsonb_build_object(
    'ok',true,'impresion_id',v_print_id,'documento_id',p_documento_id,'version_id',p_version_id,
    'numero_copia',v_numero,'tipo_impresion',v_tipo,'canal',v_canal_impresion
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

revoke all on table public.abc_c09_impresiones_documentales from public,anon,authenticated,service_role;
alter table public.abc_c09_impresiones_documentales enable row level security;
revoke all on function private.abc_c09_guard_print() from public,anon,authenticated,service_role;
revoke all on function public.abc_registrar_impresion_documental(text,text,text,uuid,uuid,text,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.abc_registrar_impresion_documental(text,text,text,uuid,uuid,text,text,text,jsonb) to authenticated;
