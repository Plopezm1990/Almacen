-- Hallazgo H-37 de la auditoría del TPV (26/11/2026), decisión del usuario el 27/11/2026:
-- con la cuenta de Cajero/a, «Cobrar ahora» guardaba y enviaba el pedido y se cortaba al iniciar la
-- preparación («Tu perfil no tiene permiso para realizar esta transición del pedido»): la cuenta quedaba
-- ENVIADA y sin cobrar, con el stock ya consumido. El Cajero/a no tiene ABC_PREPARACION_INICIAR,
-- ABC_PREPARACION_COMPLETAR ni ABC_PEDIDO_SERVIR, y la venta rápida encadena los tres pasos por línea.
--
-- Diseño (el mismo que en H-38: no se abren los primitivos, se abre una ENTRADA):
--   1. public.abc_completar_venta_rapida(...) exige ABC_COBRO_INICIAR y solo sirve pedidos de cuentas
--      de modalidad BARRA (el mostrador, donde quien cobra entrega el producto). Por dentro hace los
--      tres pasos de cada línea (iniciar preparación, marcar preparada, servir).
--   2. La entrada marca la TRANSACCIÓN en curso (app.abc_venta_rapida = id de transacción) y la guarda
--      de private.abc_transicionar_linea_operativa acepta su capacidad habitual O esa marca. La marca
--      no sobrevive al commit y un valor falseado no la activa.
--   3. Las funciones públicas de transición llamadas directamente siguen exigiendo su capacidad.
--   4. Cada paso queda registrado a nombre de quien cobra (transiciones y eventos reales).
--
-- Cómo se aplica: se parchea la definición VIVA de la transición (idempotente; falla en voz alta si
-- la guarda esperada no está) y se crean la marca y la entrada. Es una sola transacción.
--
-- Contrato: tests/rediseno/h37-venta-rapida-por-cobro-pglite-contract.mjs

create or replace function private.abc_venta_rapida_interna()
returns boolean
language sql
stable
set search_path = ''
as $fn$
  select coalesce(current_setting('app.abc_venta_rapida', true), '') = txid_current()::text
$fn$;

revoke all on function private.abc_venta_rapida_interna() from public;

do $migracion$
declare
  v_oid oid;
  v_def text;
  v_nuevo text;
  v_patron constant text :=
    'not\s+private\.abc_tiene_capacidad\(\s*p_empresa_id\s*,\s*p_local_id\s*,\s*v_capacidad\s*\)';
  v_reemplazo constant text :=
    'not (private.abc_tiene_capacidad(p_empresa_id, p_local_id, v_capacidad) '
    || 'or private.abc_venta_rapida_interna())';
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'abc_transicionar_linea_operativa' and p.prokind = 'f';
  if v_oid is null then
    raise exception 'FUNCION_OBLIGATORIA_NO_ENCONTRADA: private.abc_transicionar_linea_operativa';
  end if;
  v_def := pg_get_functiondef(v_oid);
  if position('abc_venta_rapida_interna' in v_def) = 0 then
    if (select count(*) from regexp_matches(v_def, v_patron, 'g')) <> 1 then
      raise exception 'GUARDA_NO_ENCONTRADA: % no tiene exactamente una guarda de capacidad que ampliar', v_oid::regprocedure;
    end if;
    v_nuevo := regexp_replace(v_def, v_patron, v_reemplazo, 'g');
    execute v_nuevo;
  end if;
end
$migracion$;

create or replace function public.abc_completar_venta_rapida(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_pedido_id uuid,
  p_expected_pedido_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pedido public.pedidos_tpv%rowtype;
  v_modalidad text;
  v_linea record;
  v_objetivos text[];
  v_objetivo text;
  v_linea_version bigint;
  v_pedido_version bigint;
  v_r jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_COBRO_INICIAR') then
    raise exception 'venta_rapida_no_autorizada';
  end if;
  if p_pedido_id is null or p_expected_pedido_version is null or p_terminal_id is null
     or p_session_id is null or p_operating_day is null or p_operation_id is null then
    raise exception 'venta_rapida_parametros_requeridos';
  end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id, p_local_id, p_terminal_id, p_session_id) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  select * into v_pedido
    from public.pedidos_tpv
   where empresa_id = p_empresa_id and local_id = p_local_id and id = p_pedido_id
   for update;
  if not found then raise exception 'pedido_no_encontrado'; end if;

  select c.modalidad into v_modalidad
    from public.cuentas_comerciales c
   where c.empresa_id = p_empresa_id and c.local_id = p_local_id and c.id = v_pedido.cuenta_id;
  if v_modalidad is distinct from 'BARRA' then
    raise exception 'venta_rapida_modalidad_no_permitida';
  end if;
  if v_pedido.estado in ('CERRADO', 'CANCELADO') then raise exception 'pedido_no_operable'; end if;

  v_pedido_version := v_pedido.version;
  -- Un pedido ya servido (repetir la operacion) no cambia nada: la version esperada es la actual.
  if v_pedido_version <> p_expected_pedido_version
     and exists(select 1 from public.pedido_lineas
                 where empresa_id = p_empresa_id and local_id = p_local_id and pedido_id = p_pedido_id
                   and estado in ('ENVIADA', 'EN_PREPARACION', 'PREPARADA')) then
    raise exception 'pedido_version_conflict';
  end if;

  perform set_config('app.abc_venta_rapida', txid_current()::text, true);

  for v_linea in
    select l.id, l.estado, l.version
      from public.pedido_lineas l
     where l.empresa_id = p_empresa_id and l.local_id = p_local_id and l.pedido_id = p_pedido_id
       and l.estado in ('ENVIADA', 'EN_PREPARACION', 'PREPARADA')
     order by l.id
  loop
    v_linea_version := v_linea.version;
    v_objetivos := case v_linea.estado
      when 'ENVIADA' then array['EN_PREPARACION', 'PREPARADA', 'SERVIDA']
      when 'EN_PREPARACION' then array['PREPARADA', 'SERVIDA']
      else array['SERVIDA']
    end;
    foreach v_objetivo in array v_objetivos loop
      v_r := private.abc_transicionar_linea_operativa(
        v_objetivo,
        p_operation_id || ':' || v_linea.id::text || ':' || v_objetivo,
        p_empresa_id, p_local_id, v_linea.id,
        v_linea_version, v_pedido_version,
        p_terminal_id, p_session_id, p_operating_day
      );
      v_linea_version := (v_r->>'linea_version')::bigint;
      v_pedido_version := (v_r->>'pedido_version')::bigint;
    end loop;
  end loop;

  select * into v_pedido
    from public.pedidos_tpv
   where empresa_id = p_empresa_id and local_id = p_local_id and id = p_pedido_id;

  return jsonb_build_object(
    'ok', true,
    'pedido_id', p_pedido_id,
    'pedido_estado', v_pedido.estado,
    'pedido_version', v_pedido.version,
    'lineas', coalesce((
      select jsonb_agg(jsonb_build_object('linea_id', l.id, 'estado', l.estado, 'linea_version', l.version) order by l.id)
        from public.pedido_lineas l
       where l.empresa_id = p_empresa_id and l.local_id = p_local_id and l.pedido_id = p_pedido_id
    ), '[]'::jsonb)
  );
end
$function$;

revoke all on function public.abc_completar_venta_rapida(text, text, text, uuid, bigint, uuid, uuid, date)
  from public, anon, authenticated, service_role;
grant execute on function public.abc_completar_venta_rapida(text, text, text, uuid, bigint, uuid, uuid, date) to authenticated;
