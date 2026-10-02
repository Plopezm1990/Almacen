-- ABC F5 C04. Flujo provisional, cierre definitivo bloqueado y reapertura trazable.
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
  if to_regclass('public.caja_sesion_responsables') is null then v_missing:=array_append(v_missing,'caja_sesion_responsables'); end if;
  if to_regclass('public.pagos') is null then v_missing:=array_append(v_missing,'pagos'); end if;
  if to_regclass('public.efectos_pendientes') is null then v_missing:=array_append(v_missing,'efectos_pendientes'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_fallar'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F5_C04_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
end $$;

create or replace function private.abc_c04_bloqueos_cierre(
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(jsonb_agg(x.motivo order by x.motivo),'[]'::jsonb)
    from (
      select 'PAGOS_PENDIENTES'::text motivo
        where exists (
          select 1 from public.pagos p
           where p.empresa_id=p_empresa_id
             and p.local_id=p_local_id
             and p.estado in ('PENDIENTE','AUTORIZADO','DESCONOCIDO')
        )
      union all
      select 'EFECTOS_PENDIENTES'::text
        where exists (
          select 1 from public.efectos_pendientes e
           where e.empresa_id=p_empresa_id
             and e.local_id=p_local_id
             and e.estado in ('PENDIENTE','EN_PROCESO','ERROR')
        )
    ) x;
$$;

create or replace function private.abc_c04_guard_final_session()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_blockers jsonb;
begin
  if new.estado='CERRADA_FINAL' then
    if old.estado<>'CIERRE_PROVISIONAL' then
      raise exception 'cierre_definitivo_requiere_provisional';
    end if;
    v_blockers:=private.abc_c04_bloqueos_cierre(new.empresa_id,new.local_id,new.id);
    if jsonb_array_length(v_blockers)>0 then
      raise exception 'cierre_definitivo_bloqueado:%',v_blockers::text;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists abc_f5_c04_guard_final_session on public.caja_sesiones;
create trigger abc_f5_c04_guard_final_session
before update of estado on public.caja_sesiones
for each row execute function private.abc_c04_guard_final_session();

create function public.abc_iniciar_cierre_sesion_caja(
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
  v_cierre_id uuid:=gen_random_uuid();
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then
    raise exception 'abc_caja_no_autorizado';
  end if;
  if p_session_id is null or p_terminal_id is null or p_operating_day is null then
    raise exception 'inicio_cierre_parametros_requeridos';
  end if;
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_INICIAR_CIERRE_SESION',
    jsonb_build_object('session_id',p_session_id,'terminal_id',p_terminal_id,'operating_day',p_operating_day),p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  perform 1 from public.caja_sesiones s
   where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.id=p_session_id
     and s.estado='ABIERTA' for update;
  if not found then raise exception 'sesion_caja_no_abierta'; end if;
  if not exists (
    select 1 from public.caja_sesion_terminales st
     where st.empresa_id=p_empresa_id and st.local_id=p_local_id
       and st.session_id=p_session_id and st.terminal_id=p_terminal_id and st.hasta is null
  ) then raise exception 'terminal_no_vinculado_sesion'; end if;

  insert into public.caja_cierres(
    id,empresa_id,local_id,session_id,estado,version,expected_snapshot,iniciado_por
  ) values (
    v_cierre_id,p_empresa_id,p_local_id,p_session_id,'INICIADO',1,
    jsonb_build_object('operating_day',p_operating_day),auth.uid()
  );
  update public.caja_sesiones
     set estado='EN_CIERRE',version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_session_id;
  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CAJA_SESION',p_session_id::text,
    'CAJA_SESION_EN_CIERRE',jsonb_build_object('cierre_id',v_cierre_id),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );
  v_result:=jsonb_build_object('ok',true,'session_id',p_session_id,'cierre_id',v_cierre_id,'estado','EN_CIERRE');
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

create function public.abc_confirmar_cierre_provisional(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid,
  p_terminal_id uuid,
  p_currency_code text,
  p_counted_amount numeric,
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
  v_cierre public.caja_cierres%rowtype;
  v_currency text:=upper(btrim(coalesce(p_currency_code,'')));
  v_counted numeric(24,8);
  v_expected numeric(24,8);
  v_difference numeric(24,8);
  v_blockers jsonb;
  v_numero integer;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then
    raise exception 'abc_caja_no_autorizado';
  end if;
  if p_session_id is null or p_terminal_id is null or p_operating_day is null then
    raise exception 'cierre_provisional_parametros_requeridos';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'moneda_caja_invalida'; end if;
  if p_counted_amount is null or p_counted_amount<0 or p_counted_amount<>round(p_counted_amount,8) then
    raise exception 'efectivo_contado_invalido';
  end if;
  v_counted:=p_counted_amount::numeric(24,8);
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIRMAR_CIERRE_PROVISIONAL',
    jsonb_build_object('session_id',p_session_id,'terminal_id',p_terminal_id,'currency_code',v_currency,'counted_amount',v_counted,'operating_day',p_operating_day),p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_cierre from public.caja_cierres c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.session_id=p_session_id
     and c.estado='INICIADO' for update;
  if not found then raise exception 'cierre_sesion_no_iniciado'; end if;
  perform 1 from public.caja_sesiones s
   where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.id=p_session_id
     and s.estado='EN_CIERRE' for update;
  if not found then raise exception 'sesion_no_en_cierre'; end if;
  if not exists (
    select 1 from public.caja_sesion_terminales st
     where st.empresa_id=p_empresa_id and st.local_id=p_local_id
       and st.session_id=p_session_id and st.terminal_id=p_terminal_id and st.hasta is null
  ) then raise exception 'terminal_no_vinculado_sesion'; end if;

  v_expected:=round(coalesce((select sum(coalesce(co.efecto_efectivo,0)) from public.caja_operaciones co
    where co.empresa_id=p_empresa_id and co.local_id=p_local_id and co.session_id=p_session_id
      and upper(coalesce(co.currency_code,v_currency))=v_currency),0),8)::numeric(24,8);
  v_difference:=(v_counted-v_expected)::numeric(24,8);
  select coalesce(max(cc.numero),0)+1 into v_numero from public.caja_conteos cc where cc.cierre_id=v_cierre.id and cc.currency_code=v_currency;
  insert into public.caja_conteos(empresa_id,local_id,cierre_id,currency_code,numero,counted_amount,denominaciones,actor_user_id)
  values(p_empresa_id,p_local_id,v_cierre.id,v_currency,v_numero,v_counted,jsonb_build_object('operating_day',p_operating_day),auth.uid());
  v_blockers:=private.abc_c04_bloqueos_cierre(p_empresa_id,p_local_id,p_session_id);
  update public.caja_cierres set estado='PROVISIONAL',version=version+1,
    expected_snapshot=jsonb_build_object('currency_code',v_currency,'expected_amount',v_expected,'counted_amount',v_counted,'difference',v_difference,'blockers',v_blockers,'operating_day',p_operating_day)
   where id=v_cierre.id;
  update public.caja_sesiones set estado='CIERRE_PROVISIONAL',version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_session_id;
  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
  values(p_empresa_id,p_local_id,p_operation_id,'CAJA_SESION',p_session_id::text,'CAJA_SESION_CIERRE_PROVISIONAL',jsonb_build_object('cierre_id',v_cierre.id,'blockers',v_blockers,'expected_amount',v_expected,'counted_amount',v_counted,'difference',v_difference),auth.uid(),p_terminal_id,now(),p_operating_day);
  v_result:=jsonb_build_object('ok',true,'session_id',p_session_id,'cierre_id',v_cierre.id,'estado','CIERRE_PROVISIONAL','blockers',v_blockers,'expected_amount',v_expected,'counted_amount',v_counted,'difference',v_difference);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

create function public.abc_finalizar_cierre_sesion_caja(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid,
  p_terminal_id uuid,
  p_currency_code text,
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
  v_cierre public.caja_cierres%rowtype;
  v_counted numeric(24,8);
  v_expected numeric(24,8);
  v_difference numeric(24,8);
  v_blockers jsonb;
  v_currency text:=upper(btrim(coalesce(p_currency_code,'')));
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then raise exception 'abc_caja_no_autorizado'; end if;
  if v_currency !~ '^[A-Z]{3}$' or p_session_id is null or p_terminal_id is null or p_operating_day is null then raise exception 'cierre_final_parametros_invalidos'; end if;
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_FINALIZAR_CIERRE_SESION',jsonb_build_object('session_id',p_session_id,'terminal_id',p_terminal_id,'currency_code',v_currency,'operating_day',p_operating_day),p_terminal_id);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;
  select * into v_cierre from public.caja_cierres c where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.session_id=p_session_id and c.estado='PROVISIONAL' for update;
  if not found then raise exception 'cierre_provisional_no_encontrado'; end if;
  perform 1 from public.caja_sesiones s where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.id=p_session_id and s.estado='CIERRE_PROVISIONAL' for update;
  if not found then raise exception 'sesion_no_provisional'; end if;
  v_blockers:=private.abc_c04_bloqueos_cierre(p_empresa_id,p_local_id,p_session_id);
  if jsonb_array_length(v_blockers)>0 then raise exception 'cierre_definitivo_bloqueado:%',v_blockers::text; end if;
  select cc.counted_amount into v_counted from public.caja_conteos cc where cc.cierre_id=v_cierre.id and cc.currency_code=v_currency order by cc.numero desc limit 1;
  if v_counted is null then raise exception 'conteo_cierre_faltante'; end if;
  v_expected:=round(coalesce((select sum(coalesce(co.efecto_efectivo,0)) from public.caja_operaciones co where co.empresa_id=p_empresa_id and co.local_id=p_local_id and co.session_id=p_session_id and upper(coalesce(co.currency_code,v_currency))=v_currency),0),8)::numeric(24,8);
  v_difference:=(v_counted-v_expected)::numeric(24,8);
  update public.caja_cierres set estado='FINAL',version=version+1,finalizado_por=auth.uid(),completed_at=now(),expected_snapshot=expected_snapshot||jsonb_build_object('expected_amount',v_expected,'counted_amount',v_counted,'difference',v_difference,'finalized_at',now()) where id=v_cierre.id;
  update public.caja_sesiones set estado='CERRADA_FINAL',cerrada_at=now(),version=version+1 where empresa_id=p_empresa_id and local_id=p_local_id and id=p_session_id;
  update public.caja_sesion_terminales set hasta=now() where empresa_id=p_empresa_id and local_id=p_local_id and session_id=p_session_id and terminal_id=p_terminal_id and hasta is null;
  update public.caja_sesion_responsables set hasta=now() where empresa_id=p_empresa_id and local_id=p_local_id and session_id=p_session_id and hasta is null;
  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
  values(p_empresa_id,p_local_id,p_operation_id,'CAJA_SESION',p_session_id::text,'CAJA_SESION_CERRADA',jsonb_build_object('cierre_id',v_cierre.id,'expected_amount',v_expected,'counted_amount',v_counted,'difference',v_difference),auth.uid(),p_terminal_id,now(),p_operating_day);
  v_result:=jsonb_build_object('ok',true,'session_id',p_session_id,'cierre_id',v_cierre.id,'estado','CERRADA_FINAL','expected_amount',v_expected,'counted_amount',v_counted,'difference',v_difference);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

create function public.abc_reabrir_cierre_provisional(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid,
  p_terminal_id uuid,
  p_motivo text,
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
  v_cierre public.caja_cierres%rowtype;
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then raise exception 'abc_caja_no_autorizado'; end if;
  if v_motivo is null or p_session_id is null or p_terminal_id is null or p_operating_day is null then raise exception 'reapertura_motivo_requerido'; end if;
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_REABRIR_CIERRE_PROVISIONAL',jsonb_build_object('session_id',p_session_id,'terminal_id',p_terminal_id,'motivo',v_motivo,'operating_day',p_operating_day),p_terminal_id);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;
  select * into v_cierre from public.caja_cierres c where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.session_id=p_session_id and c.estado='PROVISIONAL' for update;
  if not found then raise exception 'cierre_provisional_no_encontrado'; end if;
  perform 1 from public.caja_sesiones s where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.id=p_session_id and s.estado='CIERRE_PROVISIONAL' for update;
  if not found then raise exception 'sesion_no_provisional'; end if;
  update public.caja_cierres set estado='CANCELADO',version=version+1,finalizado_por=auth.uid(),completed_at=now(),expected_snapshot=expected_snapshot||jsonb_build_object('reopened',true,'reopen_reason',v_motivo,'reopened_at',now()) where id=v_cierre.id;
  update public.caja_sesiones set estado='ABIERTA',version=version+1 where empresa_id=p_empresa_id and local_id=p_local_id and id=p_session_id;
  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
  values(p_empresa_id,p_local_id,p_operation_id,'CAJA_SESION',p_session_id::text,'CAJA_SESION_REABIERTA',jsonb_build_object('cierre_id',v_cierre.id,'motivo',v_motivo),auth.uid(),p_terminal_id,now(),p_operating_day);
  v_result:=jsonb_build_object('ok',true,'session_id',p_session_id,'cierre_id',v_cierre.id,'estado','ABIERTA','motivo',v_motivo);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

revoke all on function private.abc_c04_bloqueos_cierre(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.abc_c04_guard_final_session() from public,anon,authenticated,service_role;
revoke all on function public.abc_iniciar_cierre_sesion_caja(text,text,text,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_confirmar_cierre_provisional(text,text,text,uuid,uuid,text,numeric,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_finalizar_cierre_sesion_caja(text,text,text,uuid,uuid,text,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_reabrir_cierre_provisional(text,text,text,uuid,uuid,text,date) from public,anon,authenticated,service_role;
grant execute on function public.abc_iniciar_cierre_sesion_caja(text,text,text,uuid,uuid,date) to authenticated;
grant execute on function public.abc_confirmar_cierre_provisional(text,text,text,uuid,uuid,text,numeric,date) to authenticated;
grant execute on function public.abc_finalizar_cierre_sesion_caja(text,text,text,uuid,uuid,text,date) to authenticated;
grant execute on function public.abc_reabrir_cierre_provisional(text,text,text,uuid,uuid,text,date) to authenticated;
