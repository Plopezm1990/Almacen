-- PLATAFORMA F4 — colecciones comunes del programa (public.almacen_kv) separadas por empresa.
--
-- Problema que resuelve
--   almacen_kv guarda las colecciones «pequeñas» del programa (empleados, pedidos, conteos,
--   locales, configuración...) como UNA fila por colección (clave primaria = key). Con varias
--   empresas eso no sirve: la segunda empresa no puede crear su fila `empleados` (la clave ya la
--   usa la primera) y, peor, las funciones que escriben `where key='productos'` tocarían la fila
--   de todas las empresas. Además, en QA las políticas PM05 rechazan toda lista que el cliente
--   guarda sin `empresaId` dentro del JSON (todas), y en producción las políticas por rol y clave
--   no miran la empresa.
--
-- Qué hace (todo en una transacción)
--   1. Las filas sin empresa (fixtures de QA; en producción, las colecciones de antes de existir
--      empresas) NO se borran: se etiquetan con la empresa ficticia '__sin_empresa__', a la que
--      nadie pertenece, así que dejan de ser visibles y se conservan para decidir su destino.
--   2. empresa_id pasa a NOT NULL y la clave primaria pasa de (key) a (empresa_id, key). El cliente
--      no cambia: `upsert({key, value})` usa por defecto la clave primaria; el disparador del
--      punto 4 rellena empresa_id.
--   3. Políticas nuevas (sustituyen a las pm05_almacen_* de QA y a «acceso por rol y clave» de
--      producción): la fila es visible/escribible solo si el usuario pertenece a ESA empresa
--      (membresía activa) Y su rol en esa empresa puede tocar esa clave (misma tabla de claves por
--      rol que ya tenía producción). Borrar: solo Propietario. Las claves fuera de la tabla
--      (`empresas`, `configEmpresa`) siguen rechazadas, como hoy en producción.
--   4. Disparador BEFORE INSERT/UPDATE: si la fila llega sin empresa, se toma `value->>'empresaId'`
--      o, si no hay, la única empresa donde el usuario tiene membresía activa; si hay varias o
--      ninguna se rechaza con 42501 (falla cerrado). Desde la API la empresa de una fila no se
--      puede cambiar nunca.
--   5. Funciones del servidor que escribían la lista `productos` sin mirar la empresa
--      (abc_catalogo_guardar_productos, abc_productos_guardar_lista): se les añade el filtro por
--      empresa con una sustitución de texto comprobada (cada fragmento debe aparecer exactamente
--      una vez; si la función existe y no coincide, la migración se aborta). Si la función no
--      existe en ese entorno (p. ej. producción sin P3c) no se toca nada.
--
-- Limitaciones declaradas
--   * Una cuenta = una empresa. Si una cuenta tuviera membresía activa en varias empresas, sus
--     escrituras sin empresa se rechazan y sus lecturas por clave devolverían varias filas.
--   * La lista `productos` solo la escribe el servidor (RPC) cuando existe el disparador
--     abc_productos_solo_rpc; que el cliente actual use esa RPC es otro paquete (P3c).
--
-- Este archivo NO se aplica automáticamente a producción desde esta rama.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ---------------------------------------------------------------------------------------------
-- 0. Comprobaciones previas
-- ---------------------------------------------------------------------------------------------
do $f4$
begin
  if to_regclass('public.almacen_kv') is null then raise exception 'PLATAFORMA_F4_PREVIO:almacen_kv_ausente'; end if;
  if to_regclass('public.membresias_usuario') is null then raise exception 'PLATAFORMA_F4_PREVIO:membresias_usuario_ausente'; end if;
  if to_regprocedure('private.la_tiene_empresa(text)') is null
     or to_regprocedure('private.la_tiene_local(text,text)') is null then
    raise exception 'PLATAFORMA_F4_PREVIO:helpers_la_tiene_ausentes';
  end if;
  if to_regclass('public.empresas') is not null
     and exists (select 1 from public.empresas where id = '__sin_empresa__') then
    raise exception 'PLATAFORMA_F4_PREVIO:la_empresa_ficticia_ya_existe';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.almacen_kv'::regclass and contype = 'p'
       and pg_get_constraintdef(oid) in ('PRIMARY KEY (key)', 'PRIMARY KEY (empresa_id, key)')
  ) then
    raise exception 'PLATAFORMA_F4_PREVIO:clave_primaria_inesperada';
  end if;
end
$f4$;

-- ---------------------------------------------------------------------------------------------
-- 1. Filas sin empresa: se conservan, etiquetadas con una empresa a la que nadie pertenece
-- ---------------------------------------------------------------------------------------------
update public.almacen_kv set empresa_id = '__sin_empresa__' where empresa_id is null or btrim(empresa_id) = '';

-- ---------------------------------------------------------------------------------------------
-- 2. Estructura: empresa_id obligatorio y clave primaria (empresa_id, key)
-- ---------------------------------------------------------------------------------------------
alter table public.almacen_kv alter column empresa_id set not null;
alter table public.almacen_kv drop constraint almacen_kv_pkey;
alter table public.almacen_kv add constraint almacen_kv_pkey primary key (empresa_id, key);

-- ---------------------------------------------------------------------------------------------
-- 3. Ayudas privadas
-- ---------------------------------------------------------------------------------------------
-- Qué roles pueden tocar cada clave (copia de la tabla de «acceso por rol y clave» de producción).
create or replace function private.plataforma_kv_rol_puede(p_rol text, p_key text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_key = any (array['productos','disenoMenu','temaOscuro','modoEmpleado','usuarioActivoId','localActivoId'])
      then true
    when p_key = any (array['proveedores','pedidos','conteos','fichasCosto','albaranes','catalogoProv','registrosAppcc',
                            'puntosControl','arqueos','turnos','ordenesProduccion','locales','movimientosCaja',
                            'devoluciones','freidoras','registrosAceite','traspasos'])
         and p_rol in ('Propietario','Encargado') then true
    when p_key = any (array['arqueos','movimientosCaja','devoluciones']) and p_rol = 'Cajero/a' then true
    when p_key = any (array['pedidos','conteos','albaranes','catalogoProv','ordenesProduccion','freidoras',
                            'registrosAceite','traspasos'])
         and p_rol = 'Churrero/a' then true
    when p_key = any (array['historialRespaldos','gastosGenerales','empleados','clientes','encargos','pinPropietario',
                            'facturasDirectas','nominas','movimientos','fichajes','auditoria','entrevistas'])
         and p_rol = 'Propietario' then true
    else false
  end
$$;

-- Decisión de acceso a una fila: pertenece a la empresa (y al local si lo tiene) y el rol que el
-- usuario tiene EN ESA EMPRESA puede tocar esa clave. p_accion = 'borrar' exige Propietario.
create or replace function private.plataforma_kv_permitido(p_empresa text, p_local text, p_key text, p_accion text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_empresa is not null
     and p_key is not null
     and private.la_tiene_empresa(p_empresa)
     and (p_local is null or private.la_tiene_local(p_empresa, p_local))
     and exists (
       select 1
         from public.membresias_usuario m
        where m.user_id = auth.uid()
          and m.empresa_id = p_empresa
          and m.activo = true
          and (p_accion is distinct from 'borrar' or m.rol = 'Propietario')
          and private.plataforma_kv_rol_puede(m.rol, p_key)
     )
$$;

-- Empresa de la fila `p_key` que ve el llamante: null si no hay ninguna; error si hay varias.
-- La usan las funciones del servidor que, sin parámetro de empresa, leen o escriben una colección.
create or replace function private.plataforma_kv_empresa_llamante(p_key text)
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
  select count(*), min(k.empresa_id)
    into v_n, v_empresa
    from public.almacen_kv k
   where k.key = p_key
     and exists (
       select 1 from public.membresias_usuario m
        where m.user_id = auth.uid() and m.empresa_id = k.empresa_id and m.activo = true
     );
  if v_n = 0 then return null; end if;
  if v_n > 1 then
    raise exception 'almacen_kv_empresa_ambigua' using errcode = '42501';
  end if;
  return v_empresa;
end
$$;

-- Disparador: empresa de las filas nuevas y empresa inmutable desde la API.
create or replace function private.plataforma_f4_kv_empresa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
  v_empresa text;
begin
  if tg_op = 'INSERT' then
    if nullif(btrim(coalesce(new.empresa_id, '')), '') is not null then
      return new;
    end if;
    new.empresa_id := null;
    if jsonb_typeof(new.value) = 'object'
       and nullif(btrim(coalesce(new.value->>'empresaId', '')), '') is not null then
      new.empresa_id := btrim(new.value->>'empresaId');
      return new;
    end if;
    if v_uid is null then
      return new; -- sin usuario (servicio, migración): lo resuelve NOT NULL
    end if;
    select count(distinct m.empresa_id), min(m.empresa_id)
      into v_n, v_empresa
      from public.membresias_usuario m
     where m.user_id = v_uid and m.activo = true;
    if v_n = 1 then
      new.empresa_id := v_empresa;
      return new;
    end if;
    raise exception 'almacen_kv_empresa_no_determinada' using errcode = '42501';
  end if;

  if v_uid is not null and new.empresa_id is distinct from old.empresa_id then
    raise exception 'almacen_kv_empresa_inmutable' using errcode = '42501';
  end if;
  return new;
end
$$;

revoke all on function private.plataforma_kv_rol_puede(text, text) from public, anon, authenticated;
revoke all on function private.plataforma_kv_permitido(text, text, text, text) from public, anon, authenticated;
revoke all on function private.plataforma_kv_empresa_llamante(text) from public, anon, authenticated;
revoke all on function private.plataforma_f4_kv_empresa() from public, anon, authenticated;
-- Las políticas se evalúan con el rol del usuario: necesita ejecutar estas dos.
grant execute on function private.plataforma_kv_rol_puede(text, text) to authenticated;
grant execute on function private.plataforma_kv_permitido(text, text, text, text) to authenticated;

drop trigger if exists pm05_zz_plataforma_f4_kv_empresa_trg on public.almacen_kv;
create trigger pm05_zz_plataforma_f4_kv_empresa_trg
  before insert or update on public.almacen_kv
  for each row execute function private.plataforma_f4_kv_empresa();

-- ---------------------------------------------------------------------------------------------
-- 4. Políticas: se retiran las dos familias conocidas y se comprueba que no queda ninguna otra
--    (las políticas permisivas se SUMAN: una olvidada ampliaría el acceso)
-- ---------------------------------------------------------------------------------------------
drop policy if exists pm05_almacen_select on public.almacen_kv;
drop policy if exists pm05_almacen_insert on public.almacen_kv;
drop policy if exists pm05_almacen_update on public.almacen_kv;
drop policy if exists pm05_almacen_delete on public.almacen_kv;
drop policy if exists "acceso por rol y clave - select" on public.almacen_kv;
drop policy if exists "acceso por rol y clave - insert" on public.almacen_kv;
drop policy if exists "acceso por rol y clave - update" on public.almacen_kv;
drop policy if exists "acceso por rol y clave - delete" on public.almacen_kv;
drop policy if exists plataforma_kv_select on public.almacen_kv;
drop policy if exists plataforma_kv_insert on public.almacen_kv;
drop policy if exists plataforma_kv_update on public.almacen_kv;
drop policy if exists plataforma_kv_delete on public.almacen_kv;

do $f4$
begin
  if exists (select 1 from pg_policy where polrelid = 'public.almacen_kv'::regclass) then
    raise exception 'PLATAFORMA_F4_POLITICA_DESCONOCIDA: quedan políticas en almacen_kv que esta migración no conoce';
  end if;
end
$f4$;

alter table public.almacen_kv enable row level security;

create policy plataforma_kv_select on public.almacen_kv
  for select to authenticated
  using (private.plataforma_kv_permitido(empresa_id, local_id, key, 'leer'));
create policy plataforma_kv_insert on public.almacen_kv
  for insert to authenticated
  with check (private.plataforma_kv_permitido(empresa_id, local_id, key, 'escribir'));
create policy plataforma_kv_update on public.almacen_kv
  for update to authenticated
  using (private.plataforma_kv_permitido(empresa_id, local_id, key, 'escribir'))
  with check (private.plataforma_kv_permitido(empresa_id, local_id, key, 'escribir'));
create policy plataforma_kv_delete on public.almacen_kv
  for delete to authenticated
  using (private.plataforma_kv_permitido(empresa_id, local_id, key, 'borrar'));

-- ---------------------------------------------------------------------------------------------
-- 5. Funciones del servidor que escribían la lista `productos` sin mirar la empresa
-- ---------------------------------------------------------------------------------------------
do $f4$
declare
  v_oid oid;
  v_def text;
  v_nuevo text;
  v_de text[];
  v_a text[];
  v_n integer;
  i integer;
begin
  -- 5.1 Espejo P3b: el UPDATE final tocaba la fila `productos` de TODAS las empresas.
  v_oid := to_regprocedure('public.abc_catalogo_guardar_productos(text,text,text,text,jsonb)');
  if v_oid is not null then
    v_def := pg_get_functiondef(v_oid);
    if position($m$where key='productos' and empresa_id=p_empresa_id;$m$ in v_def) = 0 then
      v_de := array[
        $x$update public.almacen_kv set value=v_kv_nuevo, updated_at=now() where key='productos';$x$
      ];
      v_a := array[
        $x$update public.almacen_kv set value=v_kv_nuevo, updated_at=now() where key='productos' and empresa_id=p_empresa_id;$x$
      ];
      v_nuevo := v_def;
      for i in 1 .. array_length(v_de, 1) loop
        v_n := (length(v_nuevo) - length(replace(v_nuevo, v_de[i], ''))) / length(v_de[i]);
        if v_n <> 1 then
          raise exception 'PLATAFORMA_F4_PARCHE_NO_APLICABLE:abc_catalogo_guardar_productos:%:%', i, v_n;
        end if;
        v_nuevo := replace(v_nuevo, v_de[i], v_a[i]);
      end loop;
      execute v_nuevo;
    end if;
  end if;

  -- 5.2 P3c: la RPC de guardado de la lista leía, bloqueaba y escribía `where key='productos'`
  --     (la fila de cualquier empresa). Ahora trabaja con la fila de la empresa del llamante.
  v_oid := to_regprocedure('public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb)');
  if v_oid is not null then
    v_def := pg_get_functiondef(v_oid);
    if position('private.plataforma_kv_empresa_llamante' in v_def) = 0 then
      v_de := array[
        $x$select k.value,k.empresa_id into v_actual,v_lista_empresa$x$,
        $x$from public.almacen_kv k where k.key='productos' for update;$x$,
        $x$update public.almacen_kv set value=v_fusion,updated_at=now() where key='productos';$x$,
        $x$select k.value into v_fusion from public.almacen_kv k where k.key='productos';$x$
      ];
      v_a := array[
        $x$v_lista_empresa:=private.plataforma_kv_empresa_llamante('productos');
  select k.value into v_actual$x$,
        $x$from public.almacen_kv k where k.key='productos' and k.empresa_id=v_lista_empresa for update;$x$,
        $x$update public.almacen_kv set value=v_fusion,updated_at=now() where key='productos' and empresa_id=v_lista_empresa;$x$,
        $x$select k.value into v_fusion from public.almacen_kv k where k.key='productos' and k.empresa_id=v_lista_empresa;$x$
      ];
      v_nuevo := v_def;
      for i in 1 .. array_length(v_de, 1) loop
        v_n := (length(v_nuevo) - length(replace(v_nuevo, v_de[i], ''))) / length(v_de[i]);
        if v_n <> 1 then
          raise exception 'PLATAFORMA_F4_PARCHE_NO_APLICABLE:abc_productos_guardar_lista:%:%', i, v_n;
        end if;
        v_nuevo := replace(v_nuevo, v_de[i], v_a[i]);
      end loop;
      execute v_nuevo;
    end if;
  end if;
end
$f4$;

-- ---------------------------------------------------------------------------------------------
-- 6. Autocomprobación
-- ---------------------------------------------------------------------------------------------
do $f4$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.almacen_kv'::regclass and contype = 'p'
       and pg_get_constraintdef(oid) = 'PRIMARY KEY (empresa_id, key)'
  ) then
    raise exception 'PLATAFORMA_F4_FINAL:clave_primaria';
  end if;
  if (select count(*) from pg_policy where polrelid = 'public.almacen_kv'::regclass) <> 4
     or (select count(*) from pg_policy where polrelid = 'public.almacen_kv'::regclass and polname like 'plataforma_kv_%') <> 4 then
    raise exception 'PLATAFORMA_F4_FINAL:politicas';
  end if;
  if exists (select 1 from public.almacen_kv where empresa_id is null) then
    raise exception 'PLATAFORMA_F4_FINAL:filas_sin_empresa';
  end if;
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.almacen_kv'::regclass and tgname = 'pm05_zz_plataforma_f4_kv_empresa_trg' and not tgisinternal
  ) then
    raise exception 'PLATAFORMA_F4_FINAL:disparador';
  end if;
  if has_function_privilege('anon', 'private.plataforma_kv_permitido(text,text,text,text)', 'execute') then
    raise exception 'PLATAFORMA_F4_FINAL:anon_ejecuta_permitido';
  end if;
end
$f4$;

commit;
