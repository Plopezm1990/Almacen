-- ABC F5 C05. Series y numeracion documental segura y recuperable.
-- Candidato aislado: no aplicado en QA/PROD. No constituye emision fiscal.

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.locales') is null then v_missing:=array_append(v_missing,'locales'); end if;
  if to_regclass('public.abc_operaciones') is null then v_missing:=array_append(v_missing,'abc_operaciones'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_fallar'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F5_C05_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
  if to_regclass('public.abc_c05_series_documentales') is not null
     or to_regclass('public.abc_c05_documentos_emitidos') is not null then
    raise exception 'ABC_F5_C05_PREFLIGHT_FALLO:objetos_C05_ya_existen';
  end if;
end $$;

create table public.abc_c05_series_documentales (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  tipo_documento text not null,
  codigo_serie text not null,
  nombre text,
  autoridad text not null default 'INTERNA',
  siguiente_numero bigint not null default 1,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint abc_c05_serie_scope_fk
    foreign key (empresa_id,local_id) references public.locales(empresa_id,id) on delete restrict,
  constraint abc_c05_serie_tipo check (tipo_documento ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  constraint abc_c05_serie_codigo check (codigo_serie ~ '^[A-Z0-9][A-Z0-9._/-]{0,19}$'),
  constraint abc_c05_serie_autoridad check (autoridad in ('INTERNA','PROVEEDOR_FISCAL')),
  constraint abc_c05_serie_siguiente check (siguiente_numero between 1 and 9223372036854775807),
  constraint abc_c05_serie_nombre check (nombre is null or nullif(btrim(nombre),'') is not null),
  constraint abc_c05_serie_scope_key unique (empresa_id,local_id,tipo_documento,codigo_serie)
);

create table public.abc_c05_documentos_emitidos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  serie_id uuid not null references public.abc_c05_series_documentales(id) on delete restrict,
  tipo_documento text not null,
  codigo_serie text not null,
  numero bigint not null,
  estado text not null default 'RESERVADO',
  operation_id text not null,
  documento_origen_id text,
  resultado jsonb not null default '{}'::jsonb,
  emitido_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint abc_c05_documento_scope_fk
    foreign key (empresa_id,local_id) references public.locales(empresa_id,id) on delete restrict,
  constraint abc_c05_documento_operacion_fk
    foreign key (empresa_id,local_id,operation_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id) on delete restrict,
  constraint abc_c05_documento_tipo check (tipo_documento ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  constraint abc_c05_documento_codigo check (codigo_serie ~ '^[A-Z0-9][A-Z0-9._/-]{0,19}$'),
  constraint abc_c05_documento_numero check (numero between 1 and 9223372036854775807),
  constraint abc_c05_documento_estado check (estado in ('RESERVADO','EMITIDO','PENDIENTE','ERROR','ANULADO')),
  constraint abc_c05_documento_emision_consistente check (
    (estado='EMITIDO' and emitido_at is not null)
    or (estado<>'EMITIDO' and emitido_at is null)
  ),
  constraint abc_c05_documento_operation_uq unique (empresa_id,local_id,operation_id),
  constraint abc_c05_documento_numero_uq unique (empresa_id,local_id,tipo_documento,codigo_serie,numero)
);

create index abc_c05_documento_scope_created_idx
  on public.abc_c05_documentos_emitidos(empresa_id,local_id,created_at desc);

create function private.abc_c05_guard_documento()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.empresa_id<>new.empresa_id
     or old.local_id<>new.local_id
     or old.serie_id<>new.serie_id
     or old.tipo_documento<>new.tipo_documento
     or old.codigo_serie<>new.codigo_serie
     or old.numero<>new.numero
     or old.operation_id<>new.operation_id then
    raise exception 'documento_identidad_inmutable';
  end if;
  if old.estado='EMITIDO' and (new.estado<>old.estado or new.resultado<>old.resultado) then
    raise exception 'documento_emitido_inmutable';
  end if;
  return new;
end $$;

create trigger abc_f5_c05_guard_documento
before update on public.abc_c05_documentos_emitidos
for each row execute function private.abc_c05_guard_documento();

create function public.abc_reservar_numero_documental(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_tipo_documento text,
  p_codigo_serie text,
  p_documento_origen_id text,
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
  v_serie public.abc_c05_series_documentales%rowtype;
  v_documento public.abc_c05_documentos_emitidos%rowtype;
  v_tipo text:=upper(btrim(coalesce(p_tipo_documento,'')));
  v_codigo text:=upper(btrim(coalesce(p_codigo_serie,'')));
  v_numero bigint;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_EMISOR_CAMBIAR') then
    raise exception 'abc_documento_no_autorizado';
  end if;
  if p_operation_id is null or p_empresa_id is null or p_local_id is null
     or v_tipo !~ '^[A-Z][A-Z0-9_]{1,39}$'
     or v_codigo !~ '^[A-Z0-9][A-Z0-9._/-]{0,19}$' then
    raise exception 'reserva_documental_parametros_invalidos';
  end if;
  v_request:=jsonb_build_object(
    'tipo_documento',v_tipo,
    'codigo_serie',v_codigo,
    'documento_origen_id',p_documento_origen_id,
    'metadata',coalesce(p_metadata,'{}'::jsonb)
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_RESERVAR_NUMERO_DOCUMENTAL',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_serie
    from public.abc_c05_series_documentales s
   where s.empresa_id=p_empresa_id and s.local_id=p_local_id
     and s.tipo_documento=v_tipo and s.codigo_serie=v_codigo and s.activa=true
   for update;
  if not found then raise exception 'serie_documental_no_activa'; end if;
  if v_serie.siguiente_numero=9223372036854775807 then raise exception 'serie_documental_agotada'; end if;
  v_numero:=v_serie.siguiente_numero;
  update public.abc_c05_series_documentales
     set siguiente_numero=v_numero+1,updated_at=now()
   where id=v_serie.id;
  insert into public.abc_c05_documentos_emitidos(
    empresa_id,local_id,serie_id,tipo_documento,codigo_serie,numero,estado,
    operation_id,documento_origen_id,resultado
  ) values (
    p_empresa_id,p_local_id,v_serie.id,v_tipo,v_codigo,v_numero,'RESERVADO',
    p_operation_id,p_documento_origen_id,v_request
  ) returning * into v_documento;
  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'DOCUMENTO',v_documento.id::text,
    'DOCUMENTO_NUMERO_RESERVADO',jsonb_build_object(
      'tipo_documento',v_tipo,'codigo_serie',v_codigo,'numero',v_numero,
      'documento_origen_id',p_documento_origen_id
    ),auth.uid(),null,now(),current_date
  );
  v_result:=jsonb_build_object(
    'ok',true,'documento_id',v_documento.id,'estado','RESERVADO',
    'tipo_documento',v_tipo,'codigo_serie',v_codigo,'numero',v_numero,
    'autoridad',v_serie.autoridad
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

create function public.abc_resolver_emision_documental(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_documento_id uuid,
  p_estado text,
  p_resultado jsonb
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
  v_estado text:=upper(btrim(coalesce(p_estado,'')));
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_EMISOR_CAMBIAR') then
    raise exception 'abc_documento_no_autorizado';
  end if;
  if p_operation_id is null or p_documento_id is null or v_estado not in ('EMITIDO','PENDIENTE','ERROR') then
    raise exception 'resolucion_documental_parametros_invalidos';
  end if;
  v_request:=jsonb_build_object('documento_id',p_documento_id,'estado',v_estado,'resultado',coalesce(p_resultado,'{}'::jsonb));
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_RESOLVER_EMISION_DOCUMENTAL',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_documento
    from public.abc_c05_documentos_emitidos d
   where d.empresa_id=p_empresa_id and d.local_id=p_local_id and d.id=p_documento_id
   for update;
  if not found then raise exception 'documento_no_encontrado'; end if;
  if v_documento.estado='EMITIDO' then
    if v_estado='EMITIDO' then
      v_result:=jsonb_build_object('ok',true,'recovered',true,'documento_id',v_documento.id,'estado',v_documento.estado,'tipo_documento',v_documento.tipo_documento,'codigo_serie',v_documento.codigo_serie,'numero',v_documento.numero,'resultado',v_documento.resultado);
      perform private.abc_operacion_completar(p_operation_id,v_result);
      return v_result;
    end if;
    raise exception 'documento_emitido_inmutable';
  end if;
  if v_documento.estado='ANULADO' then raise exception 'documento_anulado'; end if;
  update public.abc_c05_documentos_emitidos
     set estado=v_estado,
         resultado=coalesce(p_resultado,'{}'::jsonb),
         emitido_at=case when v_estado='EMITIDO' then now() else null end,
         updated_at=now()
   where id=v_documento.id;
  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'DOCUMENTO',v_documento.id::text,
    'DOCUMENTO_EMISION_'||v_estado,
    jsonb_build_object('tipo_documento',v_documento.tipo_documento,'codigo_serie',v_documento.codigo_serie,'numero',v_documento.numero,'resultado',coalesce(p_resultado,'{}'::jsonb)),
    auth.uid(),null,now(),current_date
  );
  v_result:=jsonb_build_object(
    'ok',true,'documento_id',v_documento.id,'estado',v_estado,
    'tipo_documento',v_documento.tipo_documento,'codigo_serie',v_documento.codigo_serie,
    'numero',v_documento.numero,'resultado',coalesce(p_resultado,'{}'::jsonb)
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

revoke all on table public.abc_c05_series_documentales,public.abc_c05_documentos_emitidos from public,anon,authenticated,service_role;
alter table public.abc_c05_series_documentales enable row level security;
alter table public.abc_c05_documentos_emitidos enable row level security;
revoke all on function private.abc_c05_guard_documento() from public,anon,authenticated,service_role;
revoke all on function public.abc_reservar_numero_documental(text,text,text,text,text,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.abc_resolver_emision_documental(text,text,text,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.abc_reservar_numero_documental(text,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.abc_resolver_emision_documental(text,text,text,uuid,text,jsonb) to authenticated;
