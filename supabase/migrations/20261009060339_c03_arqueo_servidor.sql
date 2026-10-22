-- Plan ABC F7 / C03: arqueo calculado por el servidor.
-- Mantiene la tabla PM08 para compatibilidad, pero las altas nuevas usan una
-- operación ABC con sesión, caja, terminal, moneda y día operativo explícitos.

do $$
begin
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null
     or to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null
     or to_regprocedure('private.abc_terminal_sesion_operativa(text,text,uuid,uuid)') is null
     or to_regprocedure('public.abc_obtener_dia_operativo_local(text,text)') is null then
    raise exception 'ABC_F7_C03_PREFLIGHT_FALLO';
  end if;
end $$;

alter table public.arqueos_caja
  add column if not exists abc_command_id text,
  add column if not exists caja_id uuid,
  add column if not exists session_id uuid,
  add column if not exists terminal_id uuid,
  add column if not exists currency_code text,
  add column if not exists operating_day date,
  add column if not exists denominaciones jsonb not null default '{}'::jsonb;

create unique index if not exists abc_c03_arqueo_command_uq
  on public.arqueos_caja(abc_command_id)
  where abc_command_id is not null;
create index if not exists abc_c03_arqueo_session_idx
  on public.arqueos_caja(empresa_id,local_id,session_id,created_at desc)
  where session_id is not null;

create or replace function public.abc_registrar_arqueo_caja(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_caja_id uuid,
  p_session_id uuid,
  p_terminal_id uuid,
  p_currency_code text,
  p_efectivo_contado numeric,
  p_denominaciones jsonb,
  p_notas text,
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
  v_arqueo public.arqueos_caja%rowtype;
  v_currency text:=upper(btrim(coalesce(p_currency_code,'')));
  v_contado numeric(14,2);
  v_base numeric(14,2);
  v_esperado numeric(14,2);
  v_notas text:=left(btrim(coalesce(p_notas,'')),1000);
  v_denominaciones jsonb:=coalesce(p_denominaciones,'{}'::jsonb);
  v_denominacion record;
  v_total_denominaciones numeric:=0;
  v_arqueo_operation_id text;
  v_dia_servidor date;
  v_snapshot jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then
    raise exception 'abc_arqueo_caja_no_autorizado';
  end if;
  if p_caja_id is null or p_session_id is null or p_terminal_id is null
     or p_operating_day is null then
    raise exception 'arqueo_caja_parametros_requeridos';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'moneda_caja_invalida'; end if;
  if p_efectivo_contado is null
     or p_efectivo_contado::text in ('NaN','Infinity','-Infinity')
     or p_efectivo_contado<0
     or p_efectivo_contado>999999999999.99
     or p_efectivo_contado<>round(p_efectivo_contado,2) then
    raise exception 'efectivo_contado_invalido';
  end if;
  v_contado:=p_efectivo_contado::numeric(14,2);

  if jsonb_typeof(v_denominaciones)<>'object' or pg_column_size(v_denominaciones)>4096 then
    raise exception 'denominaciones_caja_invalidas';
  end if;
  for v_denominacion in select key,value from jsonb_each_text(v_denominaciones)
  loop
    if v_denominacion.key !~ '^(500|200|100|50|20|10|5|2|1|0[.]5|0[.]2|0[.]1|0[.]05|0[.]02|0[.]01)$'
       or v_denominacion.value !~ '^[0-9]+$'
       or v_denominacion.value::numeric>100000 then
      raise exception 'denominaciones_caja_invalidas';
    end if;
    v_total_denominaciones:=v_total_denominaciones+
      v_denominacion.key::numeric*v_denominacion.value::numeric;
  end loop;
  if v_denominaciones<>'{}'::jsonb and round(v_total_denominaciones,2)<>v_contado then
    raise exception 'denominaciones_no_coinciden_contado';
  end if;

  v_dia_servidor:=((public.abc_obtener_dia_operativo_local(p_empresa_id,p_local_id))->>'operating_day')::date;
  if p_operating_day<>v_dia_servidor then raise exception 'arqueo_caja_dia_no_operativo'; end if;

  v_request:=jsonb_build_object(
    'caja_id',p_caja_id,
    'session_id',p_session_id,
    'terminal_id',p_terminal_id,
    'currency_code',v_currency,
    'efectivo_contado',v_contado,
    'denominaciones',v_denominaciones,
    'notas',v_notas,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_REGISTRAR_ARQUEO_CAJA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  perform 1
    from public.caja_sesiones s
   where s.empresa_id=p_empresa_id
     and s.local_id=p_local_id
     and s.id=p_session_id
     and s.caja_id=p_caja_id
     and s.estado='ABIERTA'
   for update;
  if not found then raise exception 'sesion_caja_no_abierta'; end if;

  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_no_vinculado_sesion';
  end if;

  if exists(
    select 1 from public.arqueos_caja a
     where a.empresa_id=p_empresa_id
       and a.local_id=p_local_id
       and a.fecha=p_operating_day
       and a.estado='ACTIVO'
  ) then
    raise exception 'arqueo_ya_existe';
  end if;

  select
    round(coalesce(sum(co.efecto_efectivo) filter(where co.categoria='FONDO_INICIAL'),0),2),
    round(coalesce(sum(co.efecto_efectivo),0),2)
    into v_base,v_esperado
    from public.caja_operaciones co
   where co.empresa_id=p_empresa_id
     and co.local_id=p_local_id
     and co.session_id=p_session_id
     and upper(coalesce(co.currency_code,v_currency))=v_currency;

  v_snapshot:=jsonb_build_object(
    'version',1,
    'autoridad','SERVIDOR_C03',
    'session_id',p_session_id,
    'caja_id',p_caja_id,
    'terminal_id',p_terminal_id,
    'currency_code',v_currency,
    'operating_day',p_operating_day,
    'efectivo_base',v_base,
    'efectivo_esperado',v_esperado,
    'operaciones_incluidas',(
      select count(*) from public.caja_operaciones co
       where co.empresa_id=p_empresa_id
         and co.local_id=p_local_id
         and co.session_id=p_session_id
         and upper(coalesce(co.currency_code,v_currency))=v_currency
    )
  );
  v_arqueo_operation_id:='abc.cash.count.'||private.abc_request_hash(
    jsonb_build_object('command',p_operation_id,'session_id',p_session_id)
  );

  begin
    insert into public.arqueos_caja(
      operation_id,empresa_id,local_id,fecha,alcance,
      efectivo_base,efectivo_esperado,efectivo_contado,diferencia,
      notas,snapshot,payload,estado,actor_user_id,
      abc_command_id,caja_id,session_id,terminal_id,currency_code,
      operating_day,denominaciones
    ) values (
      v_arqueo_operation_id,p_empresa_id,p_local_id,p_operating_day,'DIA',
      v_base,v_esperado,v_contado,v_contado-v_esperado,
      v_notas,v_snapshot,v_request,'ACTIVO',auth.uid(),
      p_operation_id,p_caja_id,p_session_id,p_terminal_id,v_currency,
      p_operating_day,v_denominaciones
    ) returning * into v_arqueo;
  exception when unique_violation then
    raise exception 'arqueo_ya_existe';
  end;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CAJA_SESION',p_session_id::text,
    'CAJA_ARQUEO_REGISTRADO',
    jsonb_build_object(
      'arqueo_operation_id',v_arqueo_operation_id,
      'caja_id',p_caja_id,
      'currency_code',v_currency,
      'efectivo_base',v_base,
      'efectivo_esperado',v_esperado,
      'efectivo_contado',v_contado,
      'diferencia',v_contado-v_esperado,
      'denominaciones',v_denominaciones
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,
    'replayed',false,
    'arqueo',to_jsonb(v_arqueo),
    'session_id',p_session_id,
    'caja_id',p_caja_id,
    'currency_code',v_currency,
    'efectivo_base',v_base,
    'efectivo_esperado',v_esperado,
    'efectivo_contado',v_contado,
    'diferencia',v_contado-v_esperado
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin
    perform private.abc_operacion_fallar(
      p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)
    );
  exception when others then null;
  end;
  raise;
end $$;

revoke all on function public.abc_registrar_arqueo_caja(
  text,text,text,uuid,uuid,uuid,text,numeric,jsonb,text,date
) from public,anon,authenticated,service_role;
grant execute on function public.abc_registrar_arqueo_caja(
  text,text,text,uuid,uuid,uuid,text,numeric,jsonb,text,date
) to authenticated;

comment on function public.abc_registrar_arqueo_caja(
  text,text,text,uuid,uuid,uuid,text,numeric,jsonb,text,date
) is 'C03: registra un arqueo trazable y calcula base, esperado y diferencia desde el libro de caja de la sesión.';
