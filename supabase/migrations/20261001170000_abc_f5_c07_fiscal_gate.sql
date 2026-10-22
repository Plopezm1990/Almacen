-- ABC F5 C07. Puerta fiscal configurable y modo simulador sin proveedor.
-- Candidato aislado: no aplicado en QA/PROD. No constituye cumplimiento fiscal.

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.locales') is null then v_missing:=array_append(v_missing,'locales'); end if;
  if to_regclass('public.abc_operaciones') is null then v_missing:=array_append(v_missing,'abc_operaciones'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regclass('public.abc_c06_documentos_clasificados') is null then v_missing:=array_append(v_missing,'abc_c06_documentos_clasificados'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_fallar'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F5_C07_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
  if to_regclass('public.abc_c07_modalidades_fiscales') is not null then
    raise exception 'ABC_F5_C07_PREFLIGHT_FALLO:objetos_C07_ya_existen';
  end if;
end $$;

create table public.abc_c07_modalidades_fiscales (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  territorio text not null,
  emisor_tipo text not null,
  modalidad text not null,
  proveedor_codigo text,
  estado text not null default 'PENDIENTE_ASESORIA',
  version integer not null default 1,
  declaracion_responsable boolean not null default false,
  configuracion jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint abc_c07_modalidad_scope_fk
    foreign key (empresa_id,local_id) references public.locales(empresa_id,id) on delete restrict,
  constraint abc_c07_territorio check (territorio ~ '^[A-Z]{2,3}$'),
  constraint abc_c07_emisor_tipo check (emisor_tipo in ('INTERNO','PROVEEDOR_FISCAL')),
  constraint abc_c07_modalidad check (modalidad in ('NO_FISCAL','SIF_SIMULADOR','SIF_PRODUCCION','B2B_SIMULADOR','B2B_PRODUCCION')),
  constraint abc_c07_estado check (estado in ('PENDIENTE_ASESORIA','SIMULADOR','ACTIVO','BLOQUEADO')),
  constraint abc_c07_proveedor check (proveedor_codigo is null or nullif(btrim(proveedor_codigo),'') is not null),
  constraint abc_c07_configuracion check (jsonb_typeof(configuracion)='object'),
  constraint abc_c07_version check (version>=1),
  constraint abc_c07_scope_uq unique (empresa_id,local_id)
);

create table public.abc_c07_evaluaciones_fiscales (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  documento_id uuid not null references public.abc_c06_documentos_clasificados(documento_id) on delete restrict,
  modalidad_id uuid references public.abc_c07_modalidades_fiscales(id) on delete restrict,
  modo text not null,
  resultado text not null,
  bloqueos jsonb not null default '[]'::jsonb,
  detalle jsonb not null default '{}'::jsonb,
  operation_id text not null,
  created_at timestamptz not null default now(),
  constraint abc_c07_eval_scope_fk
    foreign key (empresa_id,local_id) references public.locales(empresa_id,id) on delete restrict,
  constraint abc_c07_eval_modo check (modo in ('SIMULADOR','PRODUCTIVO')),
  constraint abc_c07_eval_resultado check (resultado in ('PREPARADO_SIMULADOR','BLOQUEADO')),
  constraint abc_c07_eval_bloqueos check (jsonb_typeof(bloqueos)='array'),
  constraint abc_c07_eval_detalle check (jsonb_typeof(detalle)='object'),
  constraint abc_c07_eval_operation_fk
    foreign key (empresa_id,local_id,operation_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id) on delete restrict,
  constraint abc_c07_eval_operation_uq unique (empresa_id,local_id,operation_id)
);

create index abc_c07_eval_scope_created_idx
  on public.abc_c07_evaluaciones_fiscales(empresa_id,local_id,created_at desc);

create function private.abc_c07_guard_config()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.empresa_id<>new.empresa_id or old.local_id<>new.local_id then
    raise exception 'modalidad_fiscal_scope_inmutable';
  end if;
  return new;
end $$;

create trigger abc_f5_c07_guard_config
before update on public.abc_c07_modalidades_fiscales
for each row execute function private.abc_c07_guard_config();

create function private.abc_c07_guard_evaluacion()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception 'evaluacion_fiscal_inmutable';
end $$;

create trigger abc_f5_c07_guard_evaluacion
before update on public.abc_c07_evaluaciones_fiscales
for each row execute function private.abc_c07_guard_evaluacion();

create function public.abc_configurar_modalidad_fiscal(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_territorio text,
  p_emisor_tipo text,
  p_modalidad text,
  p_proveedor_codigo text,
  p_estado text,
  p_declaracion_responsable boolean,
  p_configuracion jsonb
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
  v_config public.abc_c07_modalidades_fiscales%rowtype;
  v_territorio text:=upper(btrim(coalesce(p_territorio,'')));
  v_emisor text:=upper(btrim(coalesce(p_emisor_tipo,'')));
  v_modalidad text:=upper(btrim(coalesce(p_modalidad,'')));
  v_estado text:=upper(btrim(coalesce(p_estado,'')));
  v_proveedor text:=nullif(btrim(coalesce(p_proveedor_codigo,'')),'');
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_EMISOR_CAMBIAR') then
    raise exception 'abc_fiscal_no_autorizado';
  end if;
  if p_operation_id is null or v_territorio !~ '^[A-Z]{2,3}$'
     or v_emisor not in ('INTERNO','PROVEEDOR_FISCAL')
     or v_modalidad not in ('NO_FISCAL','SIF_SIMULADOR','SIF_PRODUCCION','B2B_SIMULADOR','B2B_PRODUCCION')
     or v_estado not in ('PENDIENTE_ASESORIA','SIMULADOR','ACTIVO','BLOQUEADO') then
    raise exception 'modalidad_fiscal_parametros_invalidos';
  end if;
  if v_emisor='PROVEEDOR_FISCAL' and v_proveedor is null then
    raise exception 'proveedor_fiscal_requerido';
  end if;
  if v_estado='ACTIVO' then raise exception 'c07_activacion_requiere_validacion_asesoria'; end if;
  if v_estado='SIMULADOR' and v_modalidad not in ('SIF_SIMULADOR','B2B_SIMULADOR') then
    raise exception 'estado_simulador_incompatible';
  end if;
  if v_estado='SIMULADOR' and v_emisor='PROVEEDOR_FISCAL' and v_proveedor is null then
    raise exception 'proveedor_fiscal_requerido';
  end if;
  v_request:=jsonb_build_object(
    'territorio',v_territorio,'emisor_tipo',v_emisor,'modalidad',v_modalidad,
    'proveedor_codigo',v_proveedor,'estado',v_estado,
    'declaracion_responsable',coalesce(p_declaracion_responsable,false),
    'configuracion',coalesce(p_configuracion,'{}'::jsonb)
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIGURAR_MODALIDAD_FISCAL',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;
  select * into v_config from public.abc_c07_modalidades_fiscales f
   where f.empresa_id=p_empresa_id and f.local_id=p_local_id for update;
  if found then
    update public.abc_c07_modalidades_fiscales set territorio=v_territorio,emisor_tipo=v_emisor,modalidad=v_modalidad,
      proveedor_codigo=v_proveedor,estado=v_estado,version=v_config.version+1,
      declaracion_responsable=coalesce(p_declaracion_responsable,false),configuracion=coalesce(p_configuracion,'{}'::jsonb),updated_at=now()
      where id=v_config.id returning * into v_config;
  else
    insert into public.abc_c07_modalidades_fiscales(empresa_id,local_id,territorio,emisor_tipo,modalidad,proveedor_codigo,estado,declaracion_responsable,configuracion)
      values(p_empresa_id,p_local_id,v_territorio,v_emisor,v_modalidad,v_proveedor,v_estado,coalesce(p_declaracion_responsable,false),coalesce(p_configuracion,'{}'::jsonb))
      returning * into v_config;
  end if;
  v_result:=jsonb_build_object('ok',true,'modalidad_id',v_config.id,'estado',v_config.estado,'version',v_config.version,'modo_simulador',v_config.estado='SIMULADOR');
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

create function public.abc_evaluar_documento_fiscal(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_documento_id uuid,
  p_simular boolean
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
  v_config public.abc_c07_modalidades_fiscales%rowtype;
  v_clasificacion public.abc_c06_documentos_clasificados%rowtype;
  v_bloqueos jsonb:='[]'::jsonb;
  v_resultado text:='BLOQUEADO';
  v_modo text:=case when coalesce(p_simular,false) then 'SIMULADOR' else 'PRODUCTIVO' end;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_EMISOR_CAMBIAR') then
    raise exception 'abc_fiscal_no_autorizado';
  end if;
  if p_operation_id is null or p_documento_id is null then raise exception 'evaluacion_fiscal_parametros_invalidos'; end if;
  v_request:=jsonb_build_object('documento_id',p_documento_id,'simular',coalesce(p_simular,false));
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_EVALUAR_DOCUMENTO_FISCAL',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;
  select * into v_clasificacion from public.abc_c06_documentos_clasificados c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.documento_id=p_documento_id;
  if not found then v_bloqueos:=v_bloqueos||jsonb_build_array('DOCUMENTO_SIN_CLASIFICAR'); end if;
  select * into v_config from public.abc_c07_modalidades_fiscales f
   where f.empresa_id=p_empresa_id and f.local_id=p_local_id;
  if not found then
    v_bloqueos:=v_bloqueos||jsonb_build_array('CONFIG_FISCAL_AUSENTE');
  elsif v_config.estado='PENDIENTE_ASESORIA' then
    v_bloqueos:=v_bloqueos||jsonb_build_array('ASESORIA_PENDIENTE');
  elsif v_config.estado='BLOQUEADO' then
    v_bloqueos:=v_bloqueos||jsonb_build_array('MODALIDAD_BLOQUEADA');
  elsif v_config.estado='SIMULADOR' and not coalesce(p_simular,false) then
    v_bloqueos:=v_bloqueos||jsonb_build_array('MODALIDAD_NO_ACTIVA');
  elsif v_config.estado='SIMULADOR' and coalesce(p_simular,false) then
    v_resultado:='PREPARADO_SIMULADOR';
  else
    v_bloqueos:=v_bloqueos||jsonb_build_array('ACTIVACION_FISCAL_NO_IMPLEMENTADA');
  end if;
  if jsonb_array_length(v_bloqueos)=0 then v_resultado:='PREPARADO_SIMULADOR'; end if;
  insert into public.abc_c07_evaluaciones_fiscales(empresa_id,local_id,documento_id,modalidad_id,modo,resultado,bloqueos,detalle,operation_id)
    values(p_empresa_id,p_local_id,p_documento_id,v_config.id,v_modo,v_resultado,v_bloqueos,jsonb_build_object('clasificacion',v_clasificacion.tipo_documental,'simulacion',coalesce(p_simular,false)),p_operation_id);
  v_result:=jsonb_build_object('ok',v_resultado='PREPARADO_SIMULADOR','resultado',v_resultado,'modo',v_modo,'bloqueos',v_bloqueos,'modalidad_id',v_config.id);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

revoke all on table public.abc_c07_modalidades_fiscales,public.abc_c07_evaluaciones_fiscales from public,anon,authenticated,service_role;
alter table public.abc_c07_modalidades_fiscales enable row level security;
alter table public.abc_c07_evaluaciones_fiscales enable row level security;
revoke all on function private.abc_c07_guard_config() from public,anon,authenticated,service_role;
revoke all on function private.abc_c07_guard_evaluacion() from public,anon,authenticated,service_role;
revoke all on function public.abc_configurar_modalidad_fiscal(text,text,text,text,text,text,text,text,boolean,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.abc_evaluar_documento_fiscal(text,text,text,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.abc_configurar_modalidad_fiscal(text,text,text,text,text,text,text,text,boolean,jsonb) to authenticated;
grant execute on function public.abc_evaluar_documento_fiscal(text,text,text,uuid,boolean) to authenticated;
