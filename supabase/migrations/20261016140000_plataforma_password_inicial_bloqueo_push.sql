-- Plataforma · Blindaje en servidor de la contraseña inicial obligatoria (D01, decisión 3).
-- Tercera parte: las cuatro políticas RLS de suscripciones_push (subpunto 3b).
-- Diseño: docs/plan-empresas/D01_BLINDAJE_PASSWORD_INICIAL_DISENO_2026-10-16.md
-- Depende de: 20261016120000_plataforma_password_inicial_pendiente.sql.
--
-- A diferencia de las otras tres funciones (subpunto 3), suscripciones_push
-- no tiene una función de permisos propia: sus reglas están escritas
-- directamente en la condición de la política. Corrección sobre lo dicho al
-- cerrar el subpunto 3: NO hace falta DROP POLICY. Postgres permite
-- `ALTER POLICY ... USING (...) WITH CHECK (...)`, que cambia la condición
-- en el sitio sin borrar la política -- comprobado hoy en Postgres 16 local
-- antes de escribir esta migración. Evita por completo la pega conocida de
-- la herramienta de migraciones con DROP POLICY/TRIGGER.
--
-- Como las políticas RLS se evalúan con el rol de quien consulta
-- (`authenticated`), no con privilegios elevados, no pueden llamar
-- directamente a private.plataforma_debe_cambiar_password (deliberadamente
-- sin EXECUTE para authenticated/anon: no es un punto de entrada público).
-- Se añade un envoltorio sin parámetros, consistente con el patrón ya usado
-- por private.plataforma_perfil_gestionable (con EXECUTE para authenticated,
-- sin anon), que solo informa de la propia cuenta (auth.uid()), nunca de un
-- tercero.
--
-- No aplicar en QA ni en PROD sin autorización expresa para ese entorno.

do $$
declare
  v_h text;
begin
  if to_regprocedure('private.plataforma_debe_cambiar_password(uuid)') is null then
    raise exception 'PLATAFORMA_PASSWORD_PUSH_PREFLIGHT_FALLO:falta_20261016120000';
  end if;
  if to_regclass('public.suscripciones_push') is null then
    raise exception 'PLATAFORMA_PASSWORD_PUSH_PREFLIGHT_FALLO:falta_tabla';
  end if;

  select md5(coalesce(pg_get_expr(polqual, polrelid),'') || '|' || coalesce(pg_get_expr(polwithcheck, polrelid),'')) into v_h
    from pg_policy where polrelid = 'public.suscripciones_push'::regclass and polname = 'plataforma_push_select';
  if v_h is distinct from '112c2af1b784d964362583174ab3d82f' then
    raise exception 'PLATAFORMA_PASSWORD_PUSH_PREFLIGHT_FALLO:politica_distinta:plataforma_push_select:%', v_h;
  end if;

  select md5(coalesce(pg_get_expr(polqual, polrelid),'') || '|' || coalesce(pg_get_expr(polwithcheck, polrelid),'')) into v_h
    from pg_policy where polrelid = 'public.suscripciones_push'::regclass and polname = 'plataforma_push_insert';
  if v_h is distinct from '05c35a81fc9e499fad25a7106eab88e3' then
    raise exception 'PLATAFORMA_PASSWORD_PUSH_PREFLIGHT_FALLO:politica_distinta:plataforma_push_insert:%', v_h;
  end if;

  select md5(coalesce(pg_get_expr(polqual, polrelid),'') || '|' || coalesce(pg_get_expr(polwithcheck, polrelid),'')) into v_h
    from pg_policy where polrelid = 'public.suscripciones_push'::regclass and polname = 'plataforma_push_update';
  if v_h is distinct from '91ef4714399e4581569b485746739c5a' then
    raise exception 'PLATAFORMA_PASSWORD_PUSH_PREFLIGHT_FALLO:politica_distinta:plataforma_push_update:%', v_h;
  end if;

  select md5(coalesce(pg_get_expr(polqual, polrelid),'') || '|' || coalesce(pg_get_expr(polwithcheck, polrelid),'')) into v_h
    from pg_policy where polrelid = 'public.suscripciones_push'::regclass and polname = 'plataforma_push_delete';
  if v_h is distinct from '112c2af1b784d964362583174ab3d82f' then
    raise exception 'PLATAFORMA_PASSWORD_PUSH_PREFLIGHT_FALLO:politica_distinta:plataforma_push_delete:%', v_h;
  end if;
end $$;

-- Envoltorio sin parámetros para uso desde políticas RLS (mismo patrón que
-- private.plataforma_perfil_gestionable): solo informa de la propia cuenta.
create or replace function private.plataforma_password_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not private.plataforma_debe_cambiar_password(auth.uid())
$$;

revoke all on function private.plataforma_password_ok() from public, anon;
grant execute on function private.plataforma_password_ok() to authenticated;

-- Las cuatro políticas, mismo texto exacto más la condición nueva al final.
ALTER POLICY plataforma_push_select ON public.suscripciones_push
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM perfiles p
  WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND (p.activo = true))))) AND (private.plataforma_password_ok()));

ALTER POLICY plataforma_push_insert ON public.suscripciones_push
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM perfiles p
  WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND (p.activo = true))))) AND (private.plataforma_password_ok()));

ALTER POLICY plataforma_push_update ON public.suscripciones_push
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM perfiles p
  WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND (p.activo = true))))) AND (private.plataforma_password_ok()))
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM perfiles p
  WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND (p.activo = true))))) AND (private.plataforma_password_ok()));

ALTER POLICY plataforma_push_delete ON public.suscripciones_push
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM perfiles p
  WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND (p.activo = true))))) AND (private.plataforma_password_ok()));

do $$
declare
  v_nueva text;
begin
  select pg_get_expr(polqual, polrelid) into v_nueva
    from pg_policy where polrelid = 'public.suscripciones_push'::regclass and polname = 'plataforma_push_select';
  if v_nueva is null or v_nueva !~ 'plataforma_password_ok' then
    raise exception 'PLATAFORMA_PASSWORD_PUSH_POSTFLIGHT_FALLO:plataforma_push_select_sin_cambio';
  end if;
  select pg_get_expr(polwithcheck, polrelid) into v_nueva
    from pg_policy where polrelid = 'public.suscripciones_push'::regclass and polname = 'plataforma_push_insert';
  if v_nueva is null or v_nueva !~ 'plataforma_password_ok' then
    raise exception 'PLATAFORMA_PASSWORD_PUSH_POSTFLIGHT_FALLO:plataforma_push_insert_sin_cambio';
  end if;
end $$;
