-- C03: vista previa del arqueo de una sesion ABC. El cierre C04 vuelve a
-- calcular el esperado al confirmar y finalizar; esta lectura no fija saldo.
do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.caja_sesiones') is null then v_missing:=array_append(v_missing,'caja_sesiones'); end if;
  if to_regclass('public.caja_sesion_terminales') is null then v_missing:=array_append(v_missing,'caja_sesion_terminales'); end if;
  if to_regclass('public.caja_operaciones') is null then v_missing:=array_append(v_missing,'caja_operaciones'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('public.abc_confirmar_cierre_provisional(text,text,text,uuid,uuid,text,numeric,date)') is null then v_missing:=array_append(v_missing,'abc_confirmar_cierre_provisional'); end if;
  if to_regprocedure('public.abc_previsualizar_arqueo_caja(text,text,uuid,uuid,text)') is not null then
    raise exception 'ABC_F5_C03_FUNCION_YA_EXISTE';
  end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F5_C03_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
end $$;

create function public.abc_previsualizar_arqueo_caja(
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid,
  p_terminal_id uuid,
  p_currency_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_currency text:=upper(btrim(coalesce(p_currency_code,'')));
  v_estado text;
  v_fondo numeric(24,8);
  v_entradas numeric(24,8);
  v_salidas numeric(24,8);
  v_movimientos bigint;
begin
  if auth.uid() is null or
     not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then
    raise exception 'abc_caja_no_autorizado';
  end if;
  if p_session_id is null or p_terminal_id is null or v_currency !~ '^[A-Z]{3}$' then
    raise exception 'arqueo_parametros_invalidos';
  end if;

  select s.estado into v_estado
    from public.caja_sesiones s
   where s.empresa_id=p_empresa_id and s.local_id=p_local_id
     and s.id=p_session_id
     and s.estado in ('ABIERTA','EN_CIERRE','CIERRE_PROVISIONAL');
  if not found then raise exception 'sesion_caja_no_disponible'; end if;
  if not exists (
    select 1 from public.caja_sesion_terminales st
     where st.empresa_id=p_empresa_id and st.local_id=p_local_id
       and st.session_id=p_session_id and st.terminal_id=p_terminal_id
       and st.hasta is null
  ) then raise exception 'terminal_no_vinculado_sesion'; end if;

  -- El mismo filtro de moneda y sesion que C04. El fondo de apertura ya esta
  -- registrado como una operacion de caja y se cuenta una sola vez.
  select
    round(coalesce(sum(case when co.categoria='FONDO_INICIAL'
      then co.efecto_efectivo else 0 end),0),8),
    round(coalesce(sum(case when co.categoria is distinct from 'FONDO_INICIAL'
      and co.efecto_efectivo>0 then co.efecto_efectivo else 0 end),0),8),
    round(coalesce(sum(case when co.categoria is distinct from 'FONDO_INICIAL'
      and co.efecto_efectivo<0 then -co.efecto_efectivo else 0 end),0),8),
    count(*)
    into v_fondo,v_entradas,v_salidas,v_movimientos
    from public.caja_operaciones co
   where co.empresa_id=p_empresa_id and co.local_id=p_local_id
     and co.session_id=p_session_id
     and upper(coalesce(co.currency_code,v_currency))=v_currency;

  return jsonb_build_object(
    'ok',true,'session_id',p_session_id,'estado',v_estado,
    'currency_code',v_currency,'fondo_inicial',v_fondo,
    'entradas_efectivo',v_entradas,'salidas_efectivo',v_salidas,
    'expected_amount',(v_fondo+v_entradas-v_salidas)::numeric(24,8),
    'movimientos',v_movimientos
  );
end $$;

revoke all on function public.abc_previsualizar_arqueo_caja(text,text,uuid,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_previsualizar_arqueo_caja(text,text,uuid,uuid,text)
  to authenticated;
