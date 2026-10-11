-- ABC A09 · lectura de los eventos de descuento de una cuenta por una función del servidor (solo QA hasta que Pedro autorice otra cosa).
--
-- Fallo que corrige (hallazgo del 3/10/2026, al arreglar la lectura del cobro): el historial de descuentos del TPV («Auditoría A09 · historial»)
-- leía la tabla `abc_eventos` directamente desde el navegador, pero la migración 20260924004000 (ACL parity) quita al navegador todo acceso directo
-- a esa tabla (contiene los eventos de todo el sistema, con sus cargas). Resultado en QA: «permission denied for table abc_eventos» y el historial
-- no llegaba a cargar (se perdían también las solicitudes y los intentos de aprobación del mismo bloque).
--
-- Qué hace: una función de solo lectura, `abc_listar_eventos_descuento_cuenta(empresa, local, cuenta)`, que devuelve SOLO los eventos
-- `CUENTA_DESCUENTO_APLICADO` de esa cuenta (lo mismo que pedía la pantalla: últimos 100, del más reciente al más antiguo) con las mismas seis
-- columnas (operation_id, event_type, payload, actor_user_id, occurred_at, operating_day). Más estrecha que el acceso directo que había antes:
-- no expone otros tipos de evento ni otras cuentas.
--
-- Quién puede: quien puede operar cuentas en ese local (`ABC_CUENTA_OPERAR`: los cuatro roles por plantilla), igual que `abc_recuperar_cuenta`
-- o `abc_estado_cobro_cuenta`. Sin sesión o sin esa capacidad: `descuento_eventos_no_autorizado`. Sin cuenta: `descuento_eventos_parametros_invalidos`.
--
-- No cambia ninguna tabla ni ninguna función existente: migración aditiva (una función nueva, permisos solo de `authenticated`).

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('auth.uid()') is null then v_missing:=array_append(v_missing,'auth.uid'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_A09_EVENTOS_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
  if to_regprocedure('public.abc_listar_eventos_descuento_cuenta(text,text,uuid)') is not null then
    raise exception 'ABC_A09_EVENTOS_PREFLIGHT_FALLO: RPC ya existe';
  end if;
end $$;

create function public.abc_listar_eventos_descuento_cuenta(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_eventos jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'descuento_eventos_no_autorizado';
  end if;
  if p_cuenta_id is null then
    raise exception 'descuento_eventos_parametros_invalidos';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'operation_id',e.operation_id,
      'event_type',e.event_type,
      'payload',e.payload,
      'actor_user_id',e.actor_user_id,
      'occurred_at',e.occurred_at,
      'operating_day',e.operating_day
    ) order by e.occurred_at desc,e.id desc),'[]'::jsonb)
    into v_eventos
    from (
      select x.*
        from public.abc_eventos x
       where x.empresa_id=p_empresa_id
         and x.local_id=p_local_id
         and x.aggregate_type='CUENTA'
         and x.aggregate_id=p_cuenta_id::text
         and x.event_type='CUENTA_DESCUENTO_APLICADO'
       order by x.occurred_at desc,x.id desc
       limit 100
    ) e;

  return v_eventos;
end $$;

revoke all on function public.abc_listar_eventos_descuento_cuenta(text,text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_listar_eventos_descuento_cuenta(text,text,uuid)
  to authenticated;

comment on function public.abc_listar_eventos_descuento_cuenta(text,text,uuid) is
  'A09: eventos CUENTA_DESCUENTO_APLICADO de una cuenta (últimos 100) para el historial de descuentos del TPV; solo lectura, exige ABC_CUENTA_OPERAR en el local.';
