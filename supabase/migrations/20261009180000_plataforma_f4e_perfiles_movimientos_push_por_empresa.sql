-- PLATAFORMA F4e — cuentas, movimientos y avisos push separados por empresa.
--
-- Problema que resuelve (hallazgo del 2026-10-10, solo lectura de producción)
--   F4 separó por empresa las colecciones de public.almacen_kv, pero otras tres tablas y dos
--   disparadores antiguos de producción no miran la empresa:
--     * public.perfiles: «leer propio o propietario» / «propietario actualiza» usan
--       private.es_propietario_activo(), que no mira la empresa: el Propietario de una empresa lee
--       y cambia el cargo y el estado de las cuentas de TODAS las empresas.
--     * public.movimientos_registro (sin empresa_id en producción): cualquier perfil activo lee e
--       inserta los movimientos de todas las empresas y cualquier Propietario los borra.
--     * public.suscripciones_push: las filas sin user_id las ve y borra cualquier Propietario.
--     * public.completar_local_movimiento() (disparador de movimientos) busca la lista `productos`
--       por clave en TODAS las empresas, y public.estampar_propiedad_suscripcion_push() (disparador
--       de avisos push) lee `empleados`, `productos` y `locales` por clave con subconsultas
--       escalares: desde F4 dejan de ser válidas en cuanto hay dos empresas con la misma clave
--       («more than one row returned by a subquery used as an expression»).
--
-- Qué hace (todo en una transacción)
--   1. movimientos_registro: añade empresa_id y local_id (QA ya los tiene), los rellena en las filas
--      antiguas a partir de datos.empresaId / datos.localId (y de public.locales), y deja un
--      disparador que los rellena en las filas nuevas (datos.empresaId, o la empresa del local, o la
--      única empresa activa de la cuenta; si no se puede saber, falla cerrado con 42501). Las filas
--      que no se pueden atribuir se CONSERVAN sin empresa y nadie las ve.
--   2. Reglas nuevas, con la misma semántica que tenían dentro de una empresa y con el límite de la
--      empresa: movimientos (leer/insertar: miembro de la empresa y del local; borrar: Propietario de
--      la empresa), perfiles (un Propietario solo lee y actualiza perfiles de cuentas con membresía
--      activa en una empresa activa donde él también es Propietario) y avisos push (solo los propios;
--      desaparece la rama «user_id nulo y Propietario», que la función de envío ignora).
--   3. Las dos funciones antiguas se sustituyen por la misma función con el filtro de empresa, solo
--      si su huella es exactamente la de producción (si existe y es otra versión, la migración se
--      aborta). Si no existen (QA) no se hace nada.
--   4. Una empresa dada de baja no cuenta (como en F4d).
--
-- Limitaciones declaradas
--   * Una cuenta = una empresa activa para los disparadores: con dos empresas activas, las altas de
--     movimientos sin empresa y de avisos push fallan cerradas (42501 almacen_kv_empresa_ambigua).
--   * Las funciones antiguas descontar_stock, descontar_stock_carrito y anular_venta_tpv (producción)
--     escriben `where key = 'productos'` sin empresa, pero ni `authenticated` ni `anon` pueden
--     ejecutarlas y ninguna otra función las llama: no se tocan aquí (candidatas a retirar en la
--     Fase 6).
--
-- Debe aplicarse DESPUÉS de F4 y F4d. Este archivo NO se aplica automáticamente a producción desde
-- esta rama.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ---------------------------------------------------------------------------------------------
-- 0. Comprobaciones previas
-- ---------------------------------------------------------------------------------------------
do $f4e$
declare
  v_def text;
begin
  if to_regprocedure('private.plataforma_kv_empresa_llamante(text)') is null
     or to_regprocedure('private.plataforma_kv_permitido(text,text,text,text)') is null then
    raise exception 'PLATAFORMA_F4E_PREVIO:falta_F4';
  end if;
  if position('e.activo = true' in pg_get_functiondef('private.plataforma_kv_permitido(text,text,text,text)'::regprocedure)) = 0 then
    raise exception 'PLATAFORMA_F4E_PREVIO:falta_F4d';
  end if;
  if to_regclass('public.perfiles') is null or to_regclass('public.movimientos_registro') is null
     or to_regclass('public.suscripciones_push') is null or to_regclass('public.membresias_usuario') is null
     or to_regclass('public.empresas') is null or to_regclass('public.locales') is null
     or to_regclass('public.almacen_kv') is null then
    raise exception 'PLATAFORMA_F4E_PREVIO:tablas_ausentes';
  end if;
  if to_regprocedure('private.la_tiene_empresa(text)') is null
     or to_regprocedure('private.la_tiene_local(text,text)') is null then
    raise exception 'PLATAFORMA_F4E_PREVIO:helpers_la_tiene_ausentes';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'empresas' and column_name = 'activo') then
    raise exception 'PLATAFORMA_F4E_PREVIO:empresas_sin_columna_activo';
  end if;

  -- Reglas conocidas (producción, QA y las propias de esta migración); cualquier otra aborta.
  if exists (select 1 from pg_policy where polrelid = 'public.perfiles'::regclass
              and polname not in ('perfiles - leer propio o propietario', 'perfiles - propietario actualiza',
                                  'qa_perfil_propio_select', 'qa_perfil_propio_update',
                                  'plataforma_perfiles_select', 'plataforma_perfiles_update')) then
    raise exception 'PLATAFORMA_F4E_POLITICA_DESCONOCIDA:perfiles';
  end if;
  if exists (select 1 from pg_policy where polrelid = 'public.movimientos_registro'::regclass
              and polname not in ('movimientos - borrar', 'movimientos - insertar', 'movimientos - leer',
                                  'movimientos_registro_select',
                                  'plataforma_mov_select', 'plataforma_mov_insert', 'plataforma_mov_delete')) then
    raise exception 'PLATAFORMA_F4E_POLITICA_DESCONOCIDA:movimientos_registro';
  end if;
  if exists (select 1 from pg_policy where polrelid = 'public.suscripciones_push'::regclass
              and polname not in ('push - propia actualiza', 'push - propia borra', 'push - propia inserta', 'push - propia lee',
                                  'qa_push_propio',
                                  'plataforma_push_select', 'plataforma_push_insert', 'plataforma_push_update', 'plataforma_push_delete')) then
    raise exception 'PLATAFORMA_F4E_POLITICA_DESCONOCIDA:suscripciones_push';
  end if;

  -- Funciones antiguas: solo la versión exacta de producción (o la ya sustituida).
  v_def := pg_get_functiondef(to_regprocedure('public.completar_local_movimiento()'));
  if v_def is not null and position('plataforma_empresa_del_llamante' in v_def) = 0
     and md5(v_def) <> 'b1cf0a6a62799a274b0b84a74902646f' then
    raise exception 'PLATAFORMA_F4E_FUNCION_DESCONOCIDA:completar_local_movimiento';
  end if;
  if to_regprocedure('public.estampar_propiedad_suscripcion_push()') is not null then
    v_def := pg_get_functiondef(to_regprocedure('public.estampar_propiedad_suscripcion_push()'));
    if position('plataforma_empresa_del_llamante' in v_def) = 0 and md5(v_def) <> '573e7b05c005384039b43489e06cd518' then
      raise exception 'PLATAFORMA_F4E_FUNCION_DESCONOCIDA:estampar_propiedad_suscripcion_push';
    end if;
  end if;
end
$f4e$;

-- ---------------------------------------------------------------------------------------------
-- 1. movimientos_registro: empresa y local de cada movimiento
-- ---------------------------------------------------------------------------------------------
alter table public.movimientos_registro add column if not exists empresa_id text;
alter table public.movimientos_registro add column if not exists local_id text;
create index if not exists movimientos_registro_empresa_fecha_idx on public.movimientos_registro (empresa_id, fecha);

-- Solo rellena columnas vacías; nunca pisa una empresa o un local ya presentes.
update public.movimientos_registro m
   set empresa_id = coalesce(
         nullif(btrim(coalesce(m.empresa_id, '')), ''),
         nullif(btrim(coalesce(m.datos->>'empresaId', '')), ''),
         (select l.empresa_id from public.locales l where l.id = nullif(btrim(coalesce(m.datos->>'localId', '')), ''))),
       local_id = coalesce(
         nullif(btrim(coalesce(m.local_id, '')), ''),
         nullif(btrim(coalesce(m.datos->>'localId', '')), ''))
 where nullif(btrim(coalesce(m.empresa_id, '')), '') is null
    or nullif(btrim(coalesce(m.local_id, '')), '') is null;

-- ---------------------------------------------------------------------------------------------
-- 2. Ayudas privadas
-- ---------------------------------------------------------------------------------------------
-- Única empresa activa de la cuenta: null si no hay ninguna; error si hay varias.
create or replace function private.plataforma_empresa_del_llamante()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_n integer;
  v_empresa text;
begin
  select count(distinct m.empresa_id), min(m.empresa_id)
    into v_n, v_empresa
    from public.membresias_usuario m
    join public.empresas e on e.id = m.empresa_id and e.activo = true
   where m.user_id = auth.uid() and m.activo = true;
  if v_n = 0 then return null; end if;
  if v_n > 1 then
    raise exception 'almacen_kv_empresa_ambigua' using errcode = '42501';
  end if;
  return v_empresa;
end
$$;

-- Acceso a un movimiento: empresa activa, miembro de la empresa (y del local si lo tiene).
-- p_accion = 'borrar' exige Propietario de esa empresa.
create or replace function private.plataforma_mov_permitido(p_empresa text, p_local text, p_accion text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_empresa is not null
     and private.la_tiene_empresa(p_empresa)
     and (p_local is null or private.la_tiene_local(p_empresa, p_local))
     and exists (
       select 1
         from public.membresias_usuario m
         join public.empresas e on e.id = m.empresa_id and e.activo = true
        where m.user_id = auth.uid()
          and m.empresa_id = p_empresa
          and m.activo = true
          and (p_accion is distinct from 'borrar' or m.rol = 'Propietario')
     )
$$;

-- Un Propietario activo gestiona solo cuentas con membresía activa en una empresa activa
-- donde él también es Propietario.
create or replace function private.plataforma_perfil_gestionable(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and p_user is not null
     and exists (
       select 1 from public.perfiles pc
        where pc.user_id = auth.uid() and pc.activo = true and pc.rol = 'Propietario')
     and exists (
       select 1
         from public.membresias_usuario mc
         join public.empresas e on e.id = mc.empresa_id and e.activo = true
         join public.membresias_usuario mo on mo.empresa_id = mc.empresa_id and mo.user_id = p_user and mo.activo = true
        where mc.user_id = auth.uid() and mc.activo = true and mc.rol = 'Propietario')
$$;

-- Disparador de movimientos: empresa y local de las filas nuevas; inmutables desde la API.
create or replace function private.plataforma_f4e_movimientos_empresa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_empresa text;
  v_local text;
begin
  if tg_op = 'UPDATE' then
    if v_uid is not null
       and (new.empresa_id is distinct from old.empresa_id or new.local_id is distinct from old.local_id) then
      raise exception 'movimientos_empresa_inmutable' using errcode = '42501';
    end if;
    return new;
  end if;

  v_local := nullif(btrim(coalesce(new.local_id, '')), '');
  if v_local is null then
    v_local := nullif(btrim(coalesce(new.datos->>'localId', '')), '');
  end if;
  v_empresa := nullif(btrim(coalesce(new.empresa_id, '')), '');
  if v_empresa is null then
    v_empresa := nullif(btrim(coalesce(new.datos->>'empresaId', '')), '');
  end if;
  if v_empresa is null and v_local is not null then
    select l.empresa_id into v_empresa from public.locales l where l.id = v_local;
  end if;
  if v_empresa is null and v_uid is not null then
    v_empresa := private.plataforma_empresa_del_llamante();
  end if;
  if v_empresa is null and v_uid is not null then
    raise exception 'movimientos_empresa_no_determinada' using errcode = '42501';
  end if;
  new.empresa_id := v_empresa;
  new.local_id := v_local;
  return new;
end
$$;

revoke all on function private.plataforma_empresa_del_llamante() from public, anon, authenticated;
revoke all on function private.plataforma_mov_permitido(text, text, text) from public, anon, authenticated;
revoke all on function private.plataforma_perfil_gestionable(uuid) from public, anon, authenticated;
revoke all on function private.plataforma_f4e_movimientos_empresa() from public, anon, authenticated;
-- Las políticas se evalúan con el rol del usuario: necesita ejecutar estas dos.
grant execute on function private.plataforma_mov_permitido(text, text, text) to authenticated;
grant execute on function private.plataforma_perfil_gestionable(uuid) to authenticated;

-- El disparador corre después de movimientos_completar_local (orden alfabético).
drop trigger if exists zz_plataforma_f4e_movimientos_empresa_trg on public.movimientos_registro;
create trigger zz_plataforma_f4e_movimientos_empresa_trg
  before insert or update on public.movimientos_registro
  for each row execute function private.plataforma_f4e_movimientos_empresa();

-- ---------------------------------------------------------------------------------------------
-- 3. Reglas
-- ---------------------------------------------------------------------------------------------
drop policy if exists "perfiles - leer propio o propietario" on public.perfiles;
drop policy if exists "perfiles - propietario actualiza" on public.perfiles;
drop policy if exists qa_perfil_propio_select on public.perfiles;
drop policy if exists qa_perfil_propio_update on public.perfiles;
drop policy if exists plataforma_perfiles_select on public.perfiles;
drop policy if exists plataforma_perfiles_update on public.perfiles;
create policy plataforma_perfiles_select on public.perfiles for select to authenticated
  using ((select auth.uid()) = user_id or private.plataforma_perfil_gestionable(user_id));
create policy plataforma_perfiles_update on public.perfiles for update to authenticated
  using (private.plataforma_perfil_gestionable(user_id))
  with check (private.plataforma_perfil_gestionable(user_id));

drop policy if exists "movimientos - borrar" on public.movimientos_registro;
drop policy if exists "movimientos - insertar" on public.movimientos_registro;
drop policy if exists "movimientos - leer" on public.movimientos_registro;
drop policy if exists movimientos_registro_select on public.movimientos_registro;
drop policy if exists plataforma_mov_select on public.movimientos_registro;
drop policy if exists plataforma_mov_insert on public.movimientos_registro;
drop policy if exists plataforma_mov_delete on public.movimientos_registro;
create policy plataforma_mov_select on public.movimientos_registro for select to authenticated
  using (empresa_id is not null and private.plataforma_mov_permitido(empresa_id, local_id, 'leer'));
create policy plataforma_mov_insert on public.movimientos_registro for insert to authenticated
  with check (empresa_id is not null and private.plataforma_mov_permitido(empresa_id, local_id, 'escribir'));
create policy plataforma_mov_delete on public.movimientos_registro for delete to authenticated
  using (empresa_id is not null and private.plataforma_mov_permitido(empresa_id, local_id, 'borrar'));

drop policy if exists "push - propia actualiza" on public.suscripciones_push;
drop policy if exists "push - propia borra" on public.suscripciones_push;
drop policy if exists "push - propia inserta" on public.suscripciones_push;
drop policy if exists "push - propia lee" on public.suscripciones_push;
drop policy if exists qa_push_propio on public.suscripciones_push;
drop policy if exists plataforma_push_select on public.suscripciones_push;
drop policy if exists plataforma_push_insert on public.suscripciones_push;
drop policy if exists plataforma_push_update on public.suscripciones_push;
drop policy if exists plataforma_push_delete on public.suscripciones_push;
create policy plataforma_push_select on public.suscripciones_push for select to authenticated
  using (user_id = (select auth.uid())
         and exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = true));
create policy plataforma_push_insert on public.suscripciones_push for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = true));
create policy plataforma_push_update on public.suscripciones_push for update to authenticated
  using (user_id = (select auth.uid())
         and exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = true))
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = true));
create policy plataforma_push_delete on public.suscripciones_push for delete to authenticated
  using (user_id = (select auth.uid())
         and exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = true));

-- ---------------------------------------------------------------------------------------------
-- 4. Disparadores antiguos de producción: misma función con el filtro de empresa
-- ---------------------------------------------------------------------------------------------
do $f4e$
declare
  v_def text;
begin
  if to_regprocedure('public.completar_local_movimiento()') is not null then
    v_def := pg_get_functiondef(to_regprocedure('public.completar_local_movimiento()'));
    if position('plataforma_empresa_del_llamante' in v_def) = 0 then
      execute $nf1$CREATE OR REPLACE FUNCTION public.completar_local_movimiento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_local_id text;
  v_empresa text;
begin
  if coalesce(new.datos->>'localId','') <> '' then
    return new;
  end if;

  -- F4e: solo se consulta la lista de productos de la empresa del movimiento.
  v_empresa := coalesce(
    nullif(btrim(coalesce(new.empresa_id,'')),''),
    nullif(btrim(coalesce(new.datos->>'empresaId','')),''),
    case when auth.uid() is null then null else private.plataforma_empresa_del_llamante() end
  );
  if v_empresa is null then
    return new;
  end if;

  select elem->>'localId'
    into v_local_id
  from public.almacen_kv k,
       lateral jsonb_array_elements(coalesce(k.value,'[]'::jsonb)) elem
  where k.key='productos'
    and k.empresa_id = v_empresa
    and elem->>'id' = new.datos->>'productoId'
    and coalesce(elem->>'localId','') <> ''
  limit 1;

  if v_local_id is not null then
    new.datos := jsonb_set(new.datos, '{localId}', to_jsonb(v_local_id), true);
  end if;
  return new;
end;
$function$$nf1$;
    end if;
  end if;
  if to_regprocedure('public.estampar_propiedad_suscripcion_push()') is not null then
    v_def := pg_get_functiondef(to_regprocedure('public.estampar_propiedad_suscripcion_push()'));
    if position('plataforma_empresa_del_llamante' in v_def) = 0 then
      execute $nf2$CREATE OR REPLACE FUNCTION public.estampar_propiedad_suscripcion_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_rol text;
  v_activo boolean;
  v_empleado_id text;
  v_local_empleado text;
  v_local_unico text;
  v_num_locales integer := 0;
  v_local_valido boolean := false;
  v_empresa text;
begin
  -- Las operaciones internas con service_role no tienen auth.uid(). En ese
  -- caso no se inventa identidad y se conserva lo que ya traiga la fila.
  if v_uid is null then
    return new;
  end if;

  select p.rol, p.activo, p.empleado_id
    into v_rol, v_activo, v_empleado_id
  from public.perfiles p
  where p.user_id = v_uid
  limit 1;

  if not found or v_activo is distinct from true then
    raise exception 'Perfil no activo' using errcode = '42501';
  end if;

  -- F4e: las listas de empleados, productos y locales que se consultan son las
  -- de la empresa de la cuenta (con varias empresas activas falla cerrado).
  v_empresa := private.plataforma_empresa_del_llamante();

  if tg_op = 'UPDATE' and new.endpoint is distinct from old.endpoint then
    raise exception 'No se puede cambiar el endpoint de una suscripción' using errcode = '42501';
  end if;

  -- Para reclamar una fila antigua sin propietario, el navegador debe aportar
  -- exactamente las mismas claves criptográficas que ya estaban guardadas.
  if tg_op = 'UPDATE' and old.user_id is null then
    if new.p256dh is distinct from old.p256dh or new.auth is distinct from old.auth then
      raise exception 'No se puede reclamar una suscripción antigua con claves distintas' using errcode = '42501';
    end if;
  end if;

  -- La identidad nunca se confía al JSON enviado por el navegador.
  new.user_id := v_uid;

  -- Para cuentas ligadas a un empleado, el local se deriva del propio registro
  -- del empleado. El cliente no puede elegir otro local.
  if v_empleado_id is not null then
    select elem->>'localId'
      into v_local_empleado
    from jsonb_array_elements(
      coalesce((select value from public.almacen_kv where key = 'empleados' and empresa_id = v_empresa), '[]'::jsonb)
    ) elem
    where elem->>'id' = v_empleado_id
    limit 1;

    new.local_id := nullif(v_local_empleado, '');
    return new;
  end if;

  -- Propietario/Encargado: si el futuro frontend envía un local, se acepta
  -- únicamente si existe entre los locales de productos o en la lista de
  -- locales. Si no envía ninguno y toda la empresa usa un único local, se
  -- infiere automáticamente.
  if new.local_id is not null and btrim(new.local_id) <> '' then
    select exists (
      select 1
      from jsonb_array_elements(
        coalesce((select value from public.almacen_kv where key = 'productos' and empresa_id = v_empresa), '[]'::jsonb)
      ) elem
      where elem->>'localId' = new.local_id
    ) or exists (
      select 1
      from jsonb_array_elements(
        coalesce((select value from public.almacen_kv where key = 'locales' and empresa_id = v_empresa), '[]'::jsonb)
      ) elem
      where elem->>'id' = new.local_id
    ) into v_local_valido;

    if not v_local_valido then
      raise exception 'Local de suscripción no válido' using errcode = '42501';
    end if;
  else
    select count(*), min(local_id)
      into v_num_locales, v_local_unico
    from (
      select distinct nullif(elem->>'localId', '') as local_id
      from jsonb_array_elements(
        coalesce((select value from public.almacen_kv where key = 'productos' and empresa_id = v_empresa), '[]'::jsonb)
      ) elem
      where nullif(elem->>'localId', '') is not null
    ) s;

    new.local_id := case when v_num_locales = 1 then v_local_unico else null end;
  end if;

  return new;
end;
$function$$nf2$;
    end if;
  end if;
end
$f4e$;

-- ---------------------------------------------------------------------------------------------
-- 5. Comprobación final
-- ---------------------------------------------------------------------------------------------
do $f4e$
begin
  if (select count(*) from pg_policy where polrelid = 'public.perfiles'::regclass) <> 2
     or (select count(*) from pg_policy where polrelid = 'public.movimientos_registro'::regclass) <> 3
     or (select count(*) from pg_policy where polrelid = 'public.suscripciones_push'::regclass) <> 4 then
    raise exception 'PLATAFORMA_F4E_FINAL:politicas';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.movimientos_registro'::regclass
                   and tgname = 'zz_plataforma_f4e_movimientos_empresa_trg' and not tgisinternal) then
    raise exception 'PLATAFORMA_F4E_FINAL:disparador';
  end if;
  if to_regprocedure('public.completar_local_movimiento()') is not null
     and position('plataforma_empresa_del_llamante' in pg_get_functiondef(to_regprocedure('public.completar_local_movimiento()'))) = 0 then
    raise exception 'PLATAFORMA_F4E_FINAL:completar_local_movimiento';
  end if;
  if to_regprocedure('public.estampar_propiedad_suscripcion_push()') is not null
     and position('plataforma_empresa_del_llamante' in pg_get_functiondef(to_regprocedure('public.estampar_propiedad_suscripcion_push()'))) = 0 then
    raise exception 'PLATAFORMA_F4E_FINAL:estampar_propiedad_suscripcion_push';
  end if;
end
$f4e$;

commit;
