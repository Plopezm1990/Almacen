-- PM10. Cierre definitivo de la sesion de caja usada por Cocina A10.
-- Mantiene la autoridad en Postgres, registra el conteo y deja trazabilidad ABC.

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.caja_sesiones') is null then v_missing:=array_append(v_missing,'caja_sesiones'); end if;
  if to_regclass('public.caja_sesion_terminales') is null then v_missing:=array_append(v_missing,'caja_sesion_terminales'); end if;
  if to_regclass('public.caja_sesion_responsables') is null then v_missing:=array_append(v_missing,'caja_sesion_responsables'); end if;
  if to_regclass('public.caja_cierres') is null then v_missing:=array_append(v_missing,'caja_cierres'); end if;
  if to_regclass('public.caja_conteos') is null then v_missing:=array_append(v_missing,'caja_conteos'); end if;
  if to_regclass('public.caja_operaciones') is null then v_missing:=array_append(v_missing,'caja_operaciones'); end if;
  if to_regclass('public.abc_operaciones') is null then v_missing:=array_append(v_missing,'abc_operaciones'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_fallar'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'PM10_CIERRE_SESION_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
  if to_regprocedure('public.abc_cerrar_sesion_caja(text,text,text,uuid,uuid,text,numeric,date)') is not null then
    raise exception 'PM10_CIERRE_SESION_PREFLIGHT_FALLO: RPC ya existe';
  end if;
end $$;

create function public.abc_cerrar_sesion_caja(
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
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
  v_currency text:=upper(btrim(coalesce(p_currency_code,'')));
  v_counted numeric(24,8);
  v_expected numeric(24,8);
  v_difference numeric(24,8);
  v_caja_id uuid;
  v_cierre_id uuid:=gen_random_uuid();
  v_now timestamptz:=now();
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then
    raise exception 'abc_caja_no_autorizado';
  end if;

  if p_session_id is null or p_terminal_id is null or p_operating_day is null then
    raise exception 'cierre_caja_parametros_requeridos';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'moneda_caja_invalida'; end if;
  if p_counted_amount is null or p_counted_amount<0 then raise exception 'efectivo_contado_invalido'; end if;
  if p_counted_amount<>round(p_counted_amount,8) then raise exception 'efectivo_contado_precision_invalida'; end if;

  v_counted:=p_counted_amount::numeric(24,8);
  v_request:=jsonb_build_object(
    'session_id',p_session_id,
    'terminal_id',p_terminal_id,
    'currency_code',v_currency,
    'counted_amount',v_counted,
    'operating_day',p_operating_day
  );

  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_CERRAR_SESION_CAJA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select s.caja_id
    into v_caja_id
    from public.caja_sesiones s
   where s.empresa_id=p_empresa_id
     and s.local_id=p_local_id
     and s.id=p_session_id
     and s.estado='ABIERTA'
   for update;
  if not found then raise exception 'sesion_caja_no_abierta'; end if;

  if not exists(
    select 1
      from public.caja_sesion_terminales st
     where st.empresa_id=p_empresa_id
       and st.local_id=p_local_id
       and st.session_id=p_session_id
       and st.terminal_id=p_terminal_id
       and st.hasta is null
  ) then
    raise exception 'terminal_no_vinculado_sesion';
  end if;

  v_expected:=round(coalesce((
    select sum(coalesce(co.efecto_efectivo,0))
      from public.caja_operaciones co
     where co.empresa_id=p_empresa_id
       and co.local_id=p_local_id
       and co.session_id=p_session_id
       and upper(coalesce(co.currency_code,v_currency))=v_currency
  ),0),8)::numeric(24,8);
  v_difference:=(v_counted-v_expected)::numeric(24,8);

  insert into public.caja_cierres(
    id,empresa_id,local_id,session_id,estado,version,expected_snapshot,
    iniciado_por,finalizado_por,started_at,completed_at
  ) values (
    v_cierre_id,p_empresa_id,p_local_id,p_session_id,'FINAL',1,
    jsonb_build_object(
      'currency_code',v_currency,
      'expected_amount',v_expected,
      'counted_amount',v_counted,
      'difference',v_difference,
      'operating_day',p_operating_day,
      'terminal_id',p_terminal_id
    ),
    auth.uid(),auth.uid(),v_now,v_now
  );

  insert into public.caja_conteos(
    empresa_id,local_id,cierre_id,currency_code,numero,counted_amount,
    denominaciones,actor_user_id,created_at
  ) values (
    p_empresa_id,p_local_id,v_cierre_id,v_currency,1,v_counted,
    jsonb_build_object('origen','CIERRE_SESION_A10','operating_day',p_operating_day),
    auth.uid(),v_now
  );

  update public.caja_sesion_terminales
     set hasta=v_now
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and session_id=p_session_id
     and terminal_id=p_terminal_id
     and hasta is null;

  update public.caja_sesion_responsables
     set hasta=v_now
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and session_id=p_session_id
     and hasta is null;

  update public.caja_sesiones
     set estado='CERRADA_FINAL',
         cerrada_at=v_now,
         version=version+1
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_session_id;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CAJA_SESION',p_session_id::text,
    'CAJA_SESION_CERRADA',
    jsonb_build_object(
      'caja_id',v_caja_id,
      'cierre_id',v_cierre_id,
      'currency_code',v_currency,
      'expected_amount',v_expected,
      'counted_amount',v_counted,
      'difference',v_difference
    ),
    auth.uid(),p_terminal_id,v_now,p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,
    'session_id',p_session_id,
    'cierre_id',v_cierre_id,
    'estado','CERRADA_FINAL',
    'currency_code',v_currency,
    'expected_amount',v_expected,
    'counted_amount',v_counted,
    'difference',v_difference
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin
    perform private.abc_operacion_fallar(
      p_operation_id,
      jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)
    );
  exception when others then
    null;
  end;
  raise;
end $$;

revoke all on function public.abc_cerrar_sesion_caja(
  text,text,text,uuid,uuid,text,numeric,date
) from public,anon,authenticated,service_role;
grant execute on function public.abc_cerrar_sesion_caja(
  text,text,text,uuid,uuid,text,numeric,date
) to authenticated;
