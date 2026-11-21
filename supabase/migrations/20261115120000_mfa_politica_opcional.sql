-- MFA opcional: el segundo factor lo elige la persona, y el propietario puede
-- exigirlo a un cargo si quiere.
--
-- Qué cambia respecto de 20261110230000_m03_server_aal2_gate.sql: aquella
-- migración exigía `aal2` a toda membresía activa de Propietario, Encargado o
-- Cajero/a, con la lista de cargos escrita a mano dentro de
-- `private.la_usuario_activo()`. Aquí esa lista deja de estar en el código y
-- pasa a ser una política que se consulta: `private.mfa_politica`.
--
-- Por defecto NO hay ninguna fila, así que por defecto NO se exige a nadie, que
-- es justo el encargo. Quien quiera inscribir un segundo factor puede hacerlo
-- igual; lo que desaparece es la obligación.
--
-- Por qué la tabla vive en `private` y sin RLS: `la_usuario_activo()` es la
-- guarda maestra del RLS de todo el programa. Si la política viviera en una
-- tabla con RLS, su propia política llamaría a `la_usuario_activo()` y habría
-- recursión. Es el mismo motivo por el que `private.plataforma_admins` está
-- donde está.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('private.la_usuario_activo()') is null then
    raise exception 'MFA_POLITICA requiere private.la_usuario_activo()';
  end if;
  if to_regclass('public.membresias_usuario') is null then
    raise exception 'MFA_POLITICA requiere public.membresias_usuario';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- La política
-- ---------------------------------------------------------------------------
-- empresa_id es `text` en todo el programa, no uuid: asi esta declarado en las
-- 395 apariciones del resto de migraciones y asi llegan los identificadores
-- reales, del estilo de 'QA-EMP-A'. Declararlo uuid aqui habria roto el join
-- contra membresias_usuario.
create table if not exists private.mfa_politica (
  empresa_id text not null,
  rol text not null,
  exigida boolean not null default false,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid,
  primary key (empresa_id, rol)
);

comment on table private.mfa_politica is
  'Cargos a los que se exige segundo factor, por empresa. Sin fila = no se exige. '
  'Vive en private y sin RLS para no entrar en recursion con la_usuario_activo().';

-- ---------------------------------------------------------------------------
-- ¿Se le exige a esta sesión?
-- ---------------------------------------------------------------------------
create or replace function private.mfa_exigida_para_uid()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists(
    select 1
      from public.membresias_usuario m
      join private.mfa_politica pol
        on pol.empresa_id = m.empresa_id
       and pol.rol = m.rol
     where m.user_id = (select auth.uid())
       and m.activo = true
       and pol.exigida = true
  );
$function$;

revoke all on function private.mfa_exigida_para_uid() from public, anon;
grant execute on function private.mfa_exigida_para_uid() to authenticated;

-- ---------------------------------------------------------------------------
-- La guarda maestra, ahora colgando de la política
-- ---------------------------------------------------------------------------
-- Se conserva intacto todo lo demas de la version M-03: sesion, membresia
-- activa, perfil activo y empleado activo. Lo unico que cambia es la ultima
-- clausula, que antes nombraba tres cargos y ahora pregunta a la politica.
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
     )
     and (
       not private.mfa_exigida_para_uid()
       or coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
     );
$function$;

revoke all on function private.la_usuario_activo() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- API para la interfaz
-- ---------------------------------------------------------------------------
-- Leer: cualquier usuario autenticado sabe si a el se le exige, y un
-- Propietario ve ademas la politica completa de su empresa para poder
-- cambiarla. No se filtra nada de otras empresas.
create or replace function public.mfa_politica_leer()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_empresa text;
  v_es_propietario boolean;
  v_politica jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select m.empresa_id,
         bool_or(m.rol = 'Propietario')
    into v_empresa, v_es_propietario
    from public.membresias_usuario m
   where m.user_id = auth.uid()
     and m.activo = true
   group by m.empresa_id
   order by bool_or(m.rol = 'Propietario') desc
   limit 1;

  if v_empresa is null then
    return jsonb_build_object('exigida_para_mi', false, 'es_propietario', false, 'politica', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('rol', pol.rol, 'exigida', pol.exigida) order by pol.rol), '[]'::jsonb)
    into v_politica
    from private.mfa_politica pol
   where pol.empresa_id = v_empresa
     and coalesce(v_es_propietario, false) = true;

  return jsonb_build_object(
    'exigida_para_mi', private.mfa_exigida_para_uid(),
    'es_propietario', coalesce(v_es_propietario, false),
    'politica', coalesce(v_politica, '[]'::jsonb)
  );
end;
$$;

-- Guardar: solo un Propietario activo, y solo sobre su propia empresa.
create or replace function public.mfa_politica_guardar(p_rol text, p_exigida boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_empresa text;
  v_rol text;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  v_rol := nullif(btrim(coalesce(p_rol, '')), '');
  if v_rol is null then
    raise exception 'Indica el cargo' using errcode = '22023';
  end if;
  if v_rol not in ('Propietario', 'Encargado', 'Cajero/a', 'Camarero/a', 'Churrero/a') then
    raise exception 'Cargo no reconocido' using errcode = '22023';
  end if;

  select m.empresa_id into v_empresa
    from public.membresias_usuario m
   where m.user_id = auth.uid()
     and m.activo = true
     and m.rol = 'Propietario'
   limit 1;

  if v_empresa is null then
    raise exception 'Solo un Propietario puede cambiar la política de verificación en dos pasos'
      using errcode = '42501';
  end if;

  insert into private.mfa_politica as pol (empresa_id, rol, exigida, actualizado_en, actualizado_por)
  values (v_empresa, v_rol, coalesce(p_exigida, false), now(), auth.uid())
  on conflict (empresa_id, rol) do update
     set exigida = excluded.exigida,
         actualizado_en = now(),
         actualizado_por = excluded.actualizado_por;

  return jsonb_build_object('ok', true, 'rol', v_rol, 'exigida', coalesce(p_exigida, false));
end;
$$;

revoke all on function public.mfa_politica_leer() from public, anon;
revoke all on function public.mfa_politica_guardar(text, boolean) from public, anon;
grant execute on function public.mfa_politica_leer() to authenticated;
grant execute on function public.mfa_politica_guardar(text, boolean) to authenticated;

commit;
