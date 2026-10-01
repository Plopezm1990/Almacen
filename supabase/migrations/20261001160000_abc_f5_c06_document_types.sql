-- ABC F5 C06. Tipos documentales y vinculos sin afirmar cumplimiento fiscal.
-- Candidato aislado: no aplicado en QA/PROD.

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.locales') is null then v_missing:=array_append(v_missing,'locales'); end if;
  if to_regclass('public.abc_operaciones') is null then v_missing:=array_append(v_missing,'abc_operaciones'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regclass('public.abc_c05_documentos_emitidos') is null then v_missing:=array_append(v_missing,'abc_c05_documentos_emitidos'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_fallar'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F5_C06_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
  if to_regclass('public.abc_c06_documentos_clasificados') is not null then
    raise exception 'ABC_F5_C06_PREFLIGHT_FALLO:objetos_C06_ya_existen';
  end if;
end $$;

create table public.abc_c06_documentos_clasificados (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  documento_id uuid not null references public.abc_c05_documentos_emitidos(id) on delete restrict,
  tipo_documental text not null,
  documento_referencia_id uuid references public.abc_c05_documentos_emitidos(id) on delete restrict,
  datos_receptor jsonb not null default '{}'::jsonb,
  operation_id text not null,
  created_at timestamptz not null default now(),
  constraint abc_c06_clasificacion_scope_fk
    foreign key (empresa_id,local_id) references public.locales(empresa_id,id) on delete restrict,
  constraint abc_c06_clasificacion_tipo check (
    tipo_documental in ('PEDIDO','PRECUENTA','JUSTIFICANTE_PAGO','FACTURA_SIMPLIFICADA','FACTURA_COMPLETA','FACTURA_RECTIFICATIVA')
  ),
  constraint abc_c06_clasificacion_datos check (jsonb_typeof(datos_receptor)='object'),
  constraint abc_c06_clasificacion_referencia check (
    (tipo_documental='FACTURA_RECTIFICATIVA' and documento_referencia_id is not null)
    or (tipo_documental<>'FACTURA_RECTIFICATIVA' and documento_referencia_id is null)
  ),
  constraint abc_c06_clasificacion_operation_fk
    foreign key (empresa_id,local_id,operation_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id) on delete restrict,
  constraint abc_c06_clasificacion_documento_uq unique (empresa_id,local_id,documento_id),
  constraint abc_c06_clasificacion_operation_uq unique (empresa_id,local_id,operation_id)
);

create index abc_c06_clasificacion_scope_created_idx
  on public.abc_c06_documentos_clasificados(empresa_id,local_id,created_at desc);

create function private.abc_c06_guard_clasificacion()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception 'clasificacion_documental_inmutable';
end $$;

create trigger abc_f5_c06_guard_clasificacion
before update on public.abc_c06_documentos_clasificados
for each row execute function private.abc_c06_guard_clasificacion();

create function public.abc_clasificar_documento(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_documento_id uuid,
  p_tipo_documental text,
  p_documento_referencia_id uuid,
  p_datos_receptor jsonb
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
  v_referencia public.abc_c05_documentos_emitidos%rowtype;
  v_tipo text:=upper(btrim(coalesce(p_tipo_documental,'')));
  v_datos jsonb:=coalesce(p_datos_receptor,'{}'::jsonb);
  v_ref_tipo text;
  v_clasificacion_id uuid;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_EMISOR_CAMBIAR') then
    raise exception 'abc_documento_no_autorizado';
  end if;
  if p_operation_id is null or p_documento_id is null then
    raise exception 'clasificacion_documental_parametros_invalidos';
  end if;
  if v_tipo not in ('PEDIDO','PRECUENTA','JUSTIFICANTE_PAGO','FACTURA_SIMPLIFICADA','FACTURA_COMPLETA','FACTURA_RECTIFICATIVA') then
    raise exception 'tipo_documental_invalido';
  end if;
  if jsonb_typeof(v_datos)<>'object' then raise exception 'datos_receptor_invalidos'; end if;
  v_request:=jsonb_build_object(
    'documento_id',p_documento_id,
    'tipo_documental',v_tipo,
    'documento_referencia_id',p_documento_referencia_id,
    'datos_receptor',v_datos
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CLASIFICAR_DOCUMENTO',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_documento
    from public.abc_c05_documentos_emitidos d
   where d.empresa_id=p_empresa_id and d.local_id=p_local_id and d.id=p_documento_id
   for update;
  if not found then raise exception 'documento_no_encontrado'; end if;
  if exists (
    select 1 from public.abc_c06_documentos_clasificados c
     where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.documento_id=p_documento_id
  ) then
    raise exception 'documento_tipo_ya_definido';
  end if;
  if v_tipo in ('PEDIDO','PRECUENTA','JUSTIFICANTE_PAGO') and v_documento.tipo_documento<>v_tipo then
    raise exception 'tipo_documental_no_coincide_con_serie';
  end if;
  if v_tipo like 'FACTURA_%' and v_documento.tipo_documento<>'FACTURA' then
    raise exception 'tipo_documental_no_coincide_con_serie';
  end if;
  if v_tipo='FACTURA_COMPLETA' then
    if nullif(btrim(coalesce(v_datos->>'nombre','')),'') is null
       or nullif(btrim(coalesce(v_datos->>'identificador_fiscal','')),'') is null then
      raise exception 'factura_completa_datos_receptor_requeridos';
    end if;
  end if;
  if v_tipo='FACTURA_RECTIFICATIVA' then
    if p_documento_referencia_id=p_documento_id then raise exception 'rectificativa_no_puede_referirse_a_si_misma'; end if;
    select * into v_referencia
      from public.abc_c05_documentos_emitidos d
     where d.empresa_id=p_empresa_id and d.local_id=p_local_id and d.id=p_documento_referencia_id
     for update;
    if not found then raise exception 'documento_referencia_no_encontrado'; end if;
    if v_referencia.estado<>'EMITIDO' then raise exception 'documento_referencia_no_emitido'; end if;
    select c.tipo_documental into v_ref_tipo
      from public.abc_c06_documentos_clasificados c
     where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.documento_id=p_documento_referencia_id;
    if v_ref_tipo is null or v_ref_tipo not in ('FACTURA_SIMPLIFICADA','FACTURA_COMPLETA') then
      raise exception 'documento_referencia_no_factura';
    end if;
  elsif p_documento_referencia_id is not null then
    raise exception 'referencia_solo_valida_para_rectificativa';
  end if;
  insert into public.abc_c06_documentos_clasificados(
    empresa_id,local_id,documento_id,tipo_documental,documento_referencia_id,datos_receptor,operation_id
  ) values (
    p_empresa_id,p_local_id,p_documento_id,v_tipo,p_documento_referencia_id,v_datos,p_operation_id
  ) returning id into v_clasificacion_id;
  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'DOCUMENTO',p_documento_id::text,
    'DOCUMENTO_CLASIFICADO',jsonb_build_object('clasificacion_id',v_clasificacion_id,'tipo_documental',v_tipo,'documento_referencia_id',p_documento_referencia_id),
    auth.uid(),null,now(),current_date
  );
  v_result:=jsonb_build_object(
    'ok',true,'clasificacion_id',v_clasificacion_id,
    'documento_id',p_documento_id,'tipo_documental',v_tipo,'documento_referencia_id',p_documento_referencia_id
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

revoke all on table public.abc_c06_documentos_clasificados from public,anon,authenticated,service_role;
alter table public.abc_c06_documentos_clasificados enable row level security;
revoke all on function private.abc_c06_guard_clasificacion() from public,anon,authenticated,service_role;
revoke all on function public.abc_clasificar_documento(text,text,text,uuid,text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.abc_clasificar_documento(text,text,text,uuid,text,uuid,jsonb) to authenticated;
