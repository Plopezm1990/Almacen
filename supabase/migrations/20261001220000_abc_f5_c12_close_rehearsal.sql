-- ABC F5 C12. Ensayo explicable del cierre sin mutar la sesion real.
-- Candidato aislado: no aplicado en QA/PROD.

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.caja_sesiones') is null then v_missing:=array_append(v_missing,'caja_sesiones'); end if;
  if to_regclass('public.caja_cierres') is null then v_missing:=array_append(v_missing,'caja_cierres'); end if;
  if to_regclass('public.caja_conteos') is null then v_missing:=array_append(v_missing,'caja_conteos'); end if;
  if to_regclass('public.caja_operaciones') is null then v_missing:=array_append(v_missing,'caja_operaciones'); end if;
  if to_regclass('public.caja_sesion_terminales') is null then v_missing:=array_append(v_missing,'caja_sesion_terminales'); end if;
  if to_regclass('public.efectos_pendientes') is null then v_missing:=array_append(v_missing,'efectos_pendientes'); end if;
  if to_regclass('public.pagos') is null then v_missing:=array_append(v_missing,'pagos'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regclass('public.abc_c11_conciliaciones_documentales') is null then v_missing:=array_append(v_missing,'abc_c11_conciliaciones_documentales'); end if;
  if to_regprocedure('private.abc_c04_bloqueos_cierre(text,text,uuid)') is null then v_missing:=array_append(v_missing,'abc_c04_bloqueos_cierre'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_request_hash(jsonb)') is null then v_missing:=array_append(v_missing,'abc_request_hash'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_fallar'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F5_C12_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
  if to_regclass('public.abc_c12_ensayos_cierre') is not null then
    raise exception 'ABC_F5_C12_PREFLIGHT_FALLO:objetos_C12_ya_existen';
  end if;
end $$;

create table public.abc_c12_ensayos_cierre (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  session_id uuid not null references public.caja_sesiones(id) on delete restrict,
  terminal_id uuid not null,
  operating_day date not null,
  resultado text not null,
  informe jsonb not null,
  informe_hash text not null,
  operation_id text not null,
  created_at timestamptz not null default now(),
  constraint abc_c12_ensayo_scope_fk
    foreign key (empresa_id,local_id) references public.locales(empresa_id,id) on delete restrict,
  constraint abc_c12_ensayo_operation_fk
    foreign key (empresa_id,local_id,operation_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id) on delete restrict,
  constraint abc_c12_ensayo_operation_uq unique (empresa_id,local_id,operation_id),
  constraint abc_c12_ensayo_resultado check (resultado in ('APTO_CIERRE','PENDIENTE','BLOQUEADO')),
  constraint abc_c12_ensayo_informe check (jsonb_typeof(informe)='object'),
  constraint abc_c12_ensayo_hash check (informe_hash ~ '^[0-9a-f]{64}$')
);

create index abc_c12_ensayo_scope_created_idx
  on public.abc_c12_ensayos_cierre(empresa_id,local_id,created_at desc);

create function private.abc_c12_guard_rehearsal()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception 'ensayo_cierre_inmutable';
end $$;

create trigger abc_f5_c12_guard_rehearsal
before update or delete on public.abc_c12_ensayos_cierre
for each row execute function private.abc_c12_guard_rehearsal();

create function public.abc_ensayar_cierre_sesion_caja(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid,
  p_terminal_id uuid,
  p_operating_day date
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
  v_session public.caja_sesiones%rowtype;
  v_currency text:='EUR';
  v_expected numeric(24,8);
  v_counted numeric(24,8);
  v_difference numeric(24,8);
  v_c04_blockers jsonb;
  v_blockers jsonb:='[]'::jsonb;
  v_documentos_conciliados integer:=0;
  v_documentos_pendientes integer:=0;
  v_conciliaciones_registradas integer:=0;
  v_resultado text;
  v_explicacion text;
  v_ensayo_id uuid;
  v_informe_hash text;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then
    raise exception 'ensayo_cierre_no_autorizado';
  end if;
  if p_operation_id is null or p_session_id is null or p_terminal_id is null or p_operating_day is null then
    raise exception 'ensayo_cierre_parametros_invalidos';
  end if;

  v_request:=jsonb_build_object(
    'session_id',p_session_id,
    'terminal_id',p_terminal_id,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_ENSAYAR_CIERRE_SESION_CAJA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select * into v_session
    from public.caja_sesiones s
   where s.empresa_id=p_empresa_id
     and s.local_id=p_local_id
     and s.id=p_session_id;
  if not found then raise exception 'sesion_caja_no_encontrada'; end if;
  if not exists (
    select 1 from public.caja_sesion_terminales st
     where st.empresa_id=p_empresa_id
       and st.local_id=p_local_id
       and st.session_id=p_session_id
       and st.terminal_id=p_terminal_id
       and st.hasta is null
  ) then
    raise exception 'terminal_no_vinculado_sesion';
  end if;

  if v_session.estado not in ('ABIERTA','EN_CIERRE','CIERRE_PROVISIONAL') then
    v_blockers:=v_blockers||jsonb_build_array('SESION_NO_REVISABLE');
  end if;

  v_c04_blockers:=private.abc_c04_bloqueos_cierre(p_empresa_id,p_local_id,p_session_id);
  v_blockers:=v_blockers||v_c04_blockers;

  select round(coalesce(sum(coalesce(co.efecto_efectivo,0)),0),8)::numeric(24,8)
    into v_expected
    from public.caja_operaciones co
   where co.empresa_id=p_empresa_id
     and co.local_id=p_local_id
     and co.session_id=p_session_id
     and upper(coalesce(co.currency_code,v_currency))=v_currency;

  select cc.counted_amount
    into v_counted
    from public.caja_conteos cc
    join public.caja_cierres c on c.id=cc.cierre_id
   where cc.empresa_id=p_empresa_id
     and cc.local_id=p_local_id
     and c.session_id=p_session_id
     and cc.currency_code=v_currency
   order by cc.created_at desc,cc.numero desc
   limit 1;
  if v_counted is null then
    v_blockers:=v_blockers||jsonb_build_array('CONTEO_FALTANTE');
    v_difference:=null;
  else
    v_difference:=(v_counted-v_expected)::numeric(24,8);
    if v_difference<>0 then v_blockers:=v_blockers||jsonb_build_array('DIFERENCIA_EFECTIVO'); end if;
  end if;

  select count(*)::integer,
         count(*) filter (where latest.resultado='CONCILIADO')::integer,
         count(*) filter (where latest.resultado in ('PENDIENTE_ENTREGA','INCONSISTENTE'))::integer
    into v_conciliaciones_registradas,v_documentos_conciliados,v_documentos_pendientes
    from (
      select distinct on (r.documento_id) r.documento_id,r.resultado
        from public.abc_c11_conciliaciones_documentales r
       where r.empresa_id=p_empresa_id and r.local_id=p_local_id
       order by r.documento_id,r.created_at desc,r.id desc
    ) latest;
  if v_documentos_pendientes>0 then
    v_blockers:=v_blockers||jsonb_build_array('CONCILIACIONES_DOCUMENTALES_PENDIENTES');
  end if;

  v_resultado:=case
    when v_blockers ? 'PAGOS_PENDIENTES'
      or v_blockers ? 'EFECTOS_PENDIENTES'
      or v_blockers ? 'SESION_NO_REVISABLE' then 'BLOQUEADO'
    when jsonb_array_length(v_blockers)=0 then 'APTO_CIERRE'
    else 'PENDIENTE'
  end;
  v_explicacion:=case v_resultado
    when 'APTO_CIERRE' then 'La sesion tiene conteo, efectivo conciliado y cadena documental sin bloqueos; el ensayo no cierra la sesion.'
    when 'BLOQUEADO' then 'La sesion no puede avanzar al cierre porque existe un bloqueo operativo que debe resolverse.'
    else 'El cierre puede revisarse, pero quedan comprobaciones pendientes antes de considerarlo apto.'
  end;
  v_informe:=jsonb_build_object(
    'tipo','ENSAYO_CIERRE',
    'sin_cambios',true,
    'mutaciones',jsonb_build_object('caja_sesiones',false,'caja_cierres',false,'caja_conteos',false,'pagos',false,'efectos_pendientes',false,'documentos',false),
    'sesion',jsonb_build_object('id',p_session_id,'estado',v_session.estado,'version',v_session.version,'operating_day',p_operating_day,'terminal_id',p_terminal_id),
    'caja',jsonb_build_object('currency_code',v_currency,'expected_amount',v_expected,'counted_amount',v_counted,'difference',v_difference),
    'documentos',jsonb_build_object('conciliaciones_registradas',v_conciliaciones_registradas,'documentos_conciliados',v_documentos_conciliados,'documentos_pendientes',v_documentos_pendientes),
    'bloqueos',v_blockers,
    'resultado',v_resultado,
    'explicacion',v_explicacion
  );
  v_informe_hash:=private.abc_request_hash(v_informe);
  insert into public.abc_c12_ensayos_cierre(
    empresa_id,local_id,session_id,terminal_id,operating_day,resultado,informe,informe_hash,operation_id
  ) values (
    p_empresa_id,p_local_id,p_session_id,p_terminal_id,p_operating_day,v_resultado,v_informe,v_informe_hash,p_operation_id
  ) returning id into v_ensayo_id;
  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CAJA_SESION',p_session_id::text,'CIERRE_ENSAYADO',
    jsonb_build_object('ensayo_id',v_ensayo_id,'resultado',v_resultado,'informe_hash',v_informe_hash,'bloqueos',v_blockers),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );
  v_result:=jsonb_build_object('ok',true,'ensayo_id',v_ensayo_id,'session_id',p_session_id,'resultado',v_resultado,'informe_hash',v_informe_hash,'informe',v_informe);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

revoke all on table public.abc_c12_ensayos_cierre from public,anon,authenticated,service_role;
alter table public.abc_c12_ensayos_cierre enable row level security;
revoke all on function private.abc_c12_guard_rehearsal() from public,anon,authenticated,service_role;
revoke all on function public.abc_ensayar_cierre_sesion_caja(text,text,text,uuid,uuid,date) from public,anon,authenticated,service_role;
grant execute on function public.abc_ensayar_cierre_sesion_caja(text,text,text,uuid,uuid,date) to authenticated;
