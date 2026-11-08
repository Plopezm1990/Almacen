-- A-01 — Dar de baja a un empleado debe retirarle el acceso.
--
-- Hasta ahora `pm11_baja_empleado` marcaba al empleado y lo auditaba, pero no
-- tocaba `perfiles`, ni `membresias_usuario`, ni `auth.users`. La credencial
-- seguía autenticando y seguía autorizando: comprobado en QA el 2026-11-08,
-- donde tras la baja `/auth/v1/token` devolvió 200 y tanto el perfil como la
-- membresía siguieron activos.
--
-- Por qué se corta en la membresía y no solo en la guarda: en producción hay
-- 182 funciones SECURITY DEFINER ejecutables por `authenticated`, y solo 33
-- pasan por `private.la_usuario_activo()`. Las 71 del TPV autorizan con
-- `private.abc_tiene_capacidad`, que se apoya únicamente en
-- `membresias_usuario` y nunca mira al empleado. La membresía es la llave
-- común a todos los caminos; retirarla los cierra todos a la vez.
--
-- Alcance de la revocación: solo las membresías del usuario ligado a ese
-- empleado EN LA EMPRESA DEL EMPLEADO, y solo las que cubren su local. Una
-- persona con membresías en otras empresas las conserva.
--
-- Reversibilidad: la baja anota en `empleados.datos->'membresiasRevocadasEnBaja'`
-- los identificadores que ha desactivado, y la reactivación restaura
-- exactamente esos y ninguno más. Así reactivar nunca concede más de lo que
-- la baja quitó.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

do $preflight$
declare
  v_falta text[] := array[]::text[];
begin
  if to_regclass('public.empleados') is null then v_falta := v_falta || 'public.empleados'; end if;
  if to_regclass('public.perfiles') is null then v_falta := v_falta || 'public.perfiles'; end if;
  if to_regclass('public.membresias_usuario') is null then v_falta := v_falta || 'public.membresias_usuario'; end if;
  if array_length(v_falta, 1) is not null then
    raise exception 'a01_preflight_faltan_objetos: %', array_to_string(v_falta, ', ');
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- 1. Ayudante: qué membresías cubren a un empleado concreto.
--    Se deja como función para que baja, reactivación y el relleno de
--    histórico usen exactamente el mismo criterio y no puedan divergir.
-- ---------------------------------------------------------------------------
create or replace function private.pm11_membresias_del_empleado(p_empleado_id text)
returns table (membresia_id bigint)
language sql
stable
security definer
set search_path to ''
as $$
  select m.id
    from public.empleados e
    join public.perfiles p on p.empleado_id = e.id
    join public.membresias_usuario m
      on m.user_id = p.user_id
     and m.empresa_id = e.empresa_id
     and (m.todos_locales = true or m.local_id = e.local_id)
   where e.id = p_empleado_id;
$$;

revoke all on function private.pm11_membresias_del_empleado(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. La baja retira el acceso.
--    Cuerpo idéntico al anterior salvo el bloque marcado como A-01.
-- ---------------------------------------------------------------------------
create or replace function public.pm11_baja_empleado(p_empresa_id text, p_local_id text, p_empleado_id text, p_motivo text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_empleado public.empleados%rowtype;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_datos jsonb;
  v_revocadas bigint[];
begin
  if (select auth.uid()) is null or not private.pm13_p05_accion_autorizada(p_empresa_id, p_local_id, 'PM13_PERSONAL_ANULAR', 'ANULAR_ELIMINAR', 'LOCAL') then
    raise exception 'personal_contexto_no_autorizado';
  end if;
  select * into v_empleado from public.empleados e where e.id = p_empleado_id for update;
  if not found then raise exception 'empleado_no_encontrado'; end if;
  if v_empleado.empresa_id <> p_empresa_id or v_empleado.local_id <> p_local_id then raise exception 'empleado_contexto_no_coincide'; end if;
  if v_empleado.estado = 'inactivo' then return jsonb_build_object('ok', true, 'yaBaja', true, 'empleado', to_jsonb(v_empleado)); end if;
  if v_empleado.estado <> 'activo' then raise exception 'empleado_baja_estado_invalido'; end if;

  -- A-01: retirar el acceso, no solo marcar la ficha. Se anotan primero las
  -- que estaban activas, y se desactivan esas mismas: así lo guardado para la
  -- reactivación es exactamente lo que esta baja quitó.
  select coalesce(array_agg(m.id), array[]::bigint[])
    into v_revocadas
    from public.membresias_usuario m
   where m.id in (select membresia_id from private.pm11_membresias_del_empleado(v_empleado.id))
     and m.activo = true;

  if array_length(v_revocadas, 1) is not null then
    update public.membresias_usuario set activo = false, updated_at = now() where id = any(v_revocadas);
  end if;

  v_datos := v_empleado.datos || jsonb_build_object('activo', false, 'estado', 'inactivo', 'fechaBaja', current_date::text);
  if v_motivo is not null then v_datos := v_datos || jsonb_build_object('motivoBaja', v_motivo); end if;
  v_datos := v_datos || jsonb_build_object('membresiasRevocadasEnBaja', to_jsonb(v_revocadas));

  update public.empleados set estado = 'inactivo', baja_at = now(), datos = v_datos where id = v_empleado.id returning * into v_empleado;
  perform private.pm11_auditar_empleado(
    'Personal · baja empleado', v_empleado.id, v_empleado.empresa_id, v_empleado.local_id,
    jsonb_build_object('estadoAnterior', 'activo', 'estadoNuevo', 'inactivo', 'motivoInformado', v_motivo is not null,
                       'membresiasRevocadas', coalesce(array_length(v_revocadas, 1), 0)));
  return jsonb_build_object('ok', true, 'yaBaja', false, 'empleado', to_jsonb(v_empleado));
end
$function$;

-- ---------------------------------------------------------------------------
-- 3. La reactivación devuelve exactamente lo que la baja quitó.
-- ---------------------------------------------------------------------------
create or replace function public.pm11_reactivar_empleado(p_empresa_id text, p_local_id text, p_empleado_id text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_empleado public.empleados%rowtype;
  v_revocadas bigint[];
  v_restauradas integer := 0;
begin
  if (select auth.uid()) is null or not private.pm13_p05_accion_autorizada(p_empresa_id, p_local_id, 'PM13_PERSONAL_ANULAR', 'ANULAR_ELIMINAR', 'LOCAL') then
    raise exception 'personal_contexto_no_autorizado';
  end if;
  select * into v_empleado from public.empleados e where e.id = p_empleado_id for update;
  if not found then raise exception 'empleado_no_encontrado'; end if;
  if v_empleado.empresa_id <> p_empresa_id or v_empleado.local_id <> p_local_id then raise exception 'empleado_contexto_no_coincide'; end if;
  if v_empleado.estado = 'activo' then return jsonb_build_object('ok', true, 'yaActivo', true, 'empleado', to_jsonb(v_empleado)); end if;
  if v_empleado.estado <> 'inactivo' then raise exception 'empleado_reactivacion_estado_invalido'; end if;

  -- A-01: devolver solo las membresías que esta baja desactivó.
  select coalesce(array_agg((value #>> '{}')::bigint), array[]::bigint[])
    into v_revocadas
    from jsonb_array_elements(coalesce(v_empleado.datos->'membresiasRevocadasEnBaja', '[]'::jsonb));

  if array_length(v_revocadas, 1) is not null then
    update public.membresias_usuario m
       set activo = true,
           updated_at = now()
     where m.id = any(v_revocadas)
       and m.activo = false;
    get diagnostics v_restauradas = row_count;
  end if;

  update public.empleados
     set estado = 'activo',
         reactivado_at = now(),
         datos = (datos - 'fechaBaja' - 'motivoBaja' - 'membresiasRevocadasEnBaja') || jsonb_build_object('activo', true, 'estado', 'activo')
   where id = v_empleado.id
  returning * into v_empleado;

  perform private.pm11_auditar_empleado(
    'Personal · reactivar empleado', v_empleado.id, v_empleado.empresa_id, v_empleado.local_id,
    jsonb_build_object('estadoAnterior', 'inactivo', 'estadoNuevo', 'activo', 'membresiasRestauradas', v_restauradas));
  return jsonb_build_object('ok', true, 'yaActivo', false, 'empleado', to_jsonb(v_empleado));
end
$function$;

-- ---------------------------------------------------------------------------
-- 4. Defensa en profundidad: la guarda general también mira el estado del
--    empleado. Cubre las bajas anteriores a esta migración y cualquier
--    camino que retire la membresía sin pasar por la RPC.
--    Condición añadida únicamente; las tres anteriores se conservan.
-- ---------------------------------------------------------------------------
create or replace function private.la_usuario_activo()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select (select auth.uid()) is not null
     and exists(
       select 1 from public.membresias_usuario m
        where m.user_id=(select auth.uid()) and m.activo=true
     )
     and not exists(
       select 1 from public.perfiles p
        where p.user_id=(select auth.uid()) and p.activo=false
     )
     and not exists(
       select 1
         from public.perfiles p
         join public.empleados e on e.id = p.empleado_id
        where p.user_id=(select auth.uid()) and e.estado is distinct from 'activo'
     );
$function$;

revoke all on function private.la_usuario_activo() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Histórico: empleados ya dados de baja que conservan membresía activa.
--    Se les aplica el mismo criterio y se anota igual, para que una futura
--    reactivación devuelva exactamente esto y nada más.
-- ---------------------------------------------------------------------------
do $backfill$
declare
  v_empleado record;
  v_revocadas bigint[];
  v_total integer := 0;
begin
  for v_empleado in
    select e.id
      from public.empleados e
     where e.estado <> 'activo'
       and exists (
         select 1 from public.membresias_usuario m
          where m.id in (select membresia_id from private.pm11_membresias_del_empleado(e.id))
            and m.activo = true
       )
  loop
    select coalesce(array_agg(m.id), array[]::bigint[])
      into v_revocadas
      from public.membresias_usuario m
     where m.id in (select membresia_id from private.pm11_membresias_del_empleado(v_empleado.id))
       and m.activo = true;

    update public.membresias_usuario set activo = false, updated_at = now() where id = any(v_revocadas);

    update public.empleados
       set datos = coalesce(datos, '{}'::jsonb) || jsonb_build_object('membresiasRevocadasEnBaja', to_jsonb(v_revocadas))
     where id = v_empleado.id;

    v_total := v_total + coalesce(array_length(v_revocadas, 1), 0);
  end loop;
  raise notice 'a01_backfill_membresias_revocadas=%', v_total;
end
$backfill$;

commit;
