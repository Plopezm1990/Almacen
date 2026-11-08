-- PLATAFORMA F2: borrado definitivo de una empresa cliente y de todos sus datos.
--
-- Solo el administrador de la plataforma. Varias puertas, todas en el servidor:
--   1. la empresa tiene que estar DESACTIVADA y con una baja vigente registrada;
--   2. plazo de gracia (private.plataforma_ajustes.dias_gracia_borrado, 30 por defecto);
--   3. copia de sus datos exportada DESPUÉS de la baja (plataforma_exportar_empresa), o un motivo
--      escrito de por qué no hay copia;
--   4. nombre exacto de la empresa + código de un solo uso (15 minutos) que entrega
--      plataforma_preparar_eliminacion junto con el resumen de lo que se va a borrar.
-- La contraseña del administrador la pide la aplicación (fase 3) antes de llamar a estas funciones.
--
-- Cómo borra:
--   * Descubre las tablas por el catálogo: todas las de public con empresa_id (más
--     suscripciones_push, fichajes_registro y movimientos_registro, que se atribuyen por local si no
--     tienen empresa_id) y las ordena por sus claves ajenas (hijas antes que padres). Una tabla nueva
--     con empresa_id entra sola; si no se puede ordenar o una clave ajena lo impide, se aborta TODO.
--   * Las tablas con disparadores de inmutabilidad (impresiones, entregas, conciliaciones y ensayos de
--     cierre) se desbloquean SOLO dentro de esta operación (lista cerrada de disparadores) y se
--     vuelven a activar antes de terminar. Cualquier otro bloqueo desconocido aborta el borrado.
--   * Borra después las cuentas de acceso que solo pertenecían a esta empresa (no a otra ni a un
--     administrador de plataforma) y por último la fila de la empresa. Todo en una sola transacción.
--   * Comprueba que no queda ninguna fila y deja un acta (private.plataforma_eliminaciones) sin
--     contenido de negocio: empresa, fecha, quién, filas borradas por tabla, cuentas y huellas.
--
-- almacen_kv: se borran las filas ETIQUETADAS con la empresa (empresa_id). Las colecciones sin
-- etiqueta (una fila por colección para todo el programa, p. ej. todo el almacén antiguo de
-- producción) no son de ninguna empresa y no se tocan: se resolverán con el paquete P3 (colecciones por empresa).
--
-- Fuera del alcance (y declarado): perfiles (se borran con su cuenta), empresas (se borra al final),
-- las tablas propias de plataforma (actas, copias, auditoría, bajas) y las técnicas o globales sin
-- dato de empresa (abc_b06_politica_conceptos, operaciones_procesadas, pm29_res, prefiltro_limites,
-- private.abc_b07_proveedores, g1_operation_ids_global, la_instalacion_estado).
-- private.plataforma_tablas_sin_alcance() debe devolver vacío: si aparece una tabla nueva sin
-- empresa_id, hay que decidir qué hacer con ella.
--
-- Este archivo NO se aplica automáticamente a producción desde esta rama.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regclass('private.plataforma_bajas') is null
     or to_regclass('private.plataforma_auditoria') is null
     or to_regprocedure('public.plataforma_desactivar_empresa(text,text,text)') is null
     or to_regprocedure('private.es_admin_plataforma()') is null then
    raise exception 'PREFLIGHT_FALLO: falta la fase 1 de plataforma (migración 20261009120000)';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tablas privadas
-- ---------------------------------------------------------------------------
create table if not exists private.plataforma_ajustes (
  clave text primary key,
  valor jsonb not null,
  actualizado_en timestamptz not null default now()
);
insert into private.plataforma_ajustes(clave, valor) values ('dias_gracia_borrado', '30'::jsonb)
on conflict (clave) do nothing;

create table if not exists private.plataforma_exportaciones (
  id bigint generated always as identity primary key,
  empresa_id text not null,
  exportado_en timestamptz not null default now(),
  actor uuid,
  filas_total bigint not null,
  por_tabla jsonb not null,
  huella text not null
);

create table if not exists private.plataforma_codigos (
  id bigint generated always as identity primary key,
  empresa_id text not null,
  codigo_hash text not null,
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null,
  usado_en timestamptz
);

create table if not exists private.plataforma_eliminaciones (
  id bigint generated always as identity primary key,
  eliminada_en timestamptz not null default now(),
  actor uuid,
  operation_id text unique,
  empresa_id text not null,
  nombre text not null,
  motivo_baja text,
  baja_en timestamptz,
  filas_por_tabla jsonb not null,
  filas_total bigint not null,
  cuentas_eliminadas int not null,
  sin_copia_motivo text,
  huella_copia text,
  huella text not null
);

alter table private.plataforma_ajustes enable row level security;
alter table private.plataforma_exportaciones enable row level security;
alter table private.plataforma_codigos enable row level security;
alter table private.plataforma_eliminaciones enable row level security;
revoke all on table private.plataforma_ajustes, private.plataforma_exportaciones,
  private.plataforma_codigos, private.plataforma_eliminaciones from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ayudas privadas
-- ---------------------------------------------------------------------------
create or replace function private.plataforma_dias_gracia()
returns int
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select coalesce((select (a.valor #>> '{}')::int from private.plataforma_ajustes a where a.clave = 'dias_gracia_borrado'), 30);
$$;

-- Plan de borrado: qué tablas y en qué orden (hijas antes que padres).
create or replace function private.plataforma_plan_purga()
returns table(orden int, esquema text, tabla text, modo text, columna text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_pend oid[];
  v_hojas oid[];
  v_n int := 0;
  v_oid oid;
begin
  select coalesce(array_agg(c.oid), '{}'::oid[]) into v_pend
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where c.relkind = 'r'
     and (
       -- tablas de la aplicación
       (n.nspname = 'public' and c.relname not in ('empresas', 'perfiles')
         and (
           exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'empresa_id' and not a.attisdropped and a.attnum > 0)
           or c.relname in ('suscripciones_push', 'fichajes_registro', 'movimientos_registro')
         ))
       -- tablas internas con datos de empresa (menos las propias de plataforma: actas, copias, bajas...)
       or (n.nspname = 'private' and c.relname not like 'plataforma\_%'
         and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'empresa_id' and not a.attisdropped and a.attnum > 0))
     );

  loop
    exit when cardinality(v_pend) = 0;

    select coalesce(array_agg(t.oid order by t.relname), '{}'::oid[]) into v_hojas
      from (
        select p.oid, c.relname
          from unnest(v_pend) as p(oid)
          join pg_class c on c.oid = p.oid
         where not exists (
           select 1 from pg_constraint k
            where k.contype = 'f'
              and k.confrelid = p.oid
              and k.conrelid = any(v_pend)
              and k.conrelid <> k.confrelid
         )
      ) t;

    if cardinality(v_hojas) = 0 then
      raise exception 'plataforma_ciclo_de_claves_ajenas' using errcode = 'P0001';
    end if;

    foreach v_oid in array v_hojas loop
      v_n := v_n + 1;
      orden := v_n;
      select n.nspname, c.relname into esquema, tabla
        from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.oid = v_oid;
      if exists (select 1 from pg_attribute a where a.attrelid = v_oid and a.attname = 'empresa_id' and not a.attisdropped and a.attnum > 0) then
        modo := 'empresa_id'; columna := 'empresa_id';
      elsif exists (select 1 from pg_attribute a where a.attrelid = v_oid and a.attname = 'local_id' and not a.attisdropped and a.attnum > 0) then
        modo := 'local_id'; columna := 'local_id';
      elsif exists (select 1 from pg_attribute a where a.attrelid = v_oid and a.attname = 'datos' and not a.attisdropped and a.attnum > 0) then
        modo := 'datos_localid'; columna := 'datos';
      else
        raise exception 'plataforma_tabla_sin_forma_de_atribuir: %', tabla using errcode = 'P0001';
      end if;
      return next;
    end loop;

    v_pend := coalesce(array(select x from unnest(v_pend) as x where x <> all(v_hojas)), '{}'::oid[]);
  end loop;
end;
$$;

create or replace function private.plataforma_condicion(p_modo text, p_columna text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case p_modo
    when 'empresa_id' then format('%I = $1', p_columna)
    when 'local_id' then 'local_id = any($2)'
    when 'datos_localid' then '(datos ->> ''localId'') = any($2)'
  end;
$$;

-- Tablas de public y private que ni se borran ni están declaradas como globales/técnicas ('esquema.tabla').
create or replace function private.plataforma_tablas_sin_alcance()
returns text[]
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select coalesce(array_agg(n.nspname || '.' || c.relname order by n.nspname, c.relname), '{}'::text[])
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'private')
     and c.relkind = 'r'
     and (n.nspname, c.relname) not in (select p.esquema, p.tabla from private.plataforma_plan_purga() p)
     and not (n.nspname = 'private' and c.relname like 'plataforma\_%')
     and (n.nspname || '.' || c.relname) not in (
       'public.empresas', 'public.perfiles',
       'public.abc_b06_politica_conceptos', 'public.operaciones_procesadas', 'public.pm29_res', 'public.prefiltro_limites',
       'private.abc_b07_proveedores', 'private.g1_operation_ids_global', 'private.la_instalacion_estado',
       'private.pm27_prod_recovery_20260914'
     );
$$;

create or replace function private.plataforma_contar_empresa(p_empresa_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_locales text[];
  r record;
  v_n bigint;
  v_res jsonb := '{}'::jsonb;
begin
  select coalesce(array_agg(l.id), '{}'::text[]) into v_locales from public.locales l where l.empresa_id = p_empresa_id;
  for r in select * from private.plataforma_plan_purga() order by orden loop
    execute format('select count(*) from %I.%I where %s', r.esquema, r.tabla, private.plataforma_condicion(r.modo, r.columna))
      into v_n using p_empresa_id, v_locales;
    if v_n > 0 then
      v_res := v_res || jsonb_build_object(r.tabla, v_n);
    end if;
  end loop;
  return v_res;
end;
$$;

-- Cuentas de acceso que solo pertenecen a esta empresa (no a otra, no administradores de plataforma).
create or replace function private.plataforma_cuentas_huerfanas(p_empresa_id text)
returns uuid[]
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select coalesce(array_agg(distinct m.user_id), '{}'::uuid[])
    from public.membresias_usuario m
   where m.empresa_id = p_empresa_id
     and not exists (select 1 from public.membresias_usuario m2 where m2.user_id = m.user_id and m2.empresa_id <> p_empresa_id)
     and not exists (select 1 from private.plataforma_admins a where a.user_id = m.user_id);
$$;

-- Qué impide hoy borrar la empresa (códigos). 'sin_copia' se puede salvar con un motivo escrito.
create or replace function private.plataforma_bloqueos_eliminacion(p_empresa_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_empresa public.empresas%rowtype;
  v_baja private.plataforma_bajas%rowtype;
  v_hay_baja boolean;
  v_bloqueos jsonb := '[]'::jsonb;
  v_hasta timestamptz;
  v_copia boolean := false;
begin
  select * into v_empresa from public.empresas e where e.id = p_empresa_id;
  if not found then
    raise exception 'Empresa no encontrada' using errcode = 'P0002';
  end if;

  select * into v_baja from private.plataforma_bajas b where b.empresa_id = p_empresa_id and b.reactivada_en is null;
  v_hay_baja := found;

  if v_empresa.activo is true then
    v_bloqueos := v_bloqueos || to_jsonb('empresa_activa'::text);
  end if;
  if not v_hay_baja then
    v_bloqueos := v_bloqueos || to_jsonb('sin_registro_de_baja'::text);
  else
    v_hasta := v_baja.baja_en + make_interval(days => private.plataforma_dias_gracia());
    if now() < v_hasta then
      v_bloqueos := v_bloqueos || to_jsonb('plazo_de_gracia'::text);
    end if;
    v_copia := exists (
      select 1 from private.plataforma_exportaciones x
       where x.empresa_id = p_empresa_id and x.exportado_en >= v_baja.baja_en
    );
    if not v_copia then
      v_bloqueos := v_bloqueos || to_jsonb('sin_copia'::text);
    end if;
  end if;

  return jsonb_build_object('bloqueos', v_bloqueos, 'plazo_hasta', v_hasta, 'copia_hecha', v_copia);
end;
$$;

revoke all on function private.plataforma_dias_gracia() from public, anon, authenticated;
revoke all on function private.plataforma_plan_purga() from public, anon, authenticated;
revoke all on function private.plataforma_condicion(text, text) from public, anon, authenticated;
revoke all on function private.plataforma_tablas_sin_alcance() from public, anon, authenticated;
revoke all on function private.plataforma_contar_empresa(text) from public, anon, authenticated;
revoke all on function private.plataforma_cuentas_huerfanas(text) from public, anon, authenticated;
revoke all on function private.plataforma_bloqueos_eliminacion(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Baja: si la empresa ya estaba desactivada por otra vía y no tiene baja vigente, se registra ahora
-- (así empieza a contar el plazo de gracia). Es la única diferencia con la versión de la fase 1.
-- ---------------------------------------------------------------------------
create or replace function public.plataforma_desactivar_empresa(
  p_operation_id text,
  p_empresa_id text,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_empresa public.empresas%rowtype;
  v_motivo text := left(nullif(btrim(coalesce(p_motivo, '')), ''), 500);
  v_peticion text;
  v_prev record;
  v_mems bigint[];
  v_locs text[];
  v_res jsonb;
begin
  perform private.plataforma_exigir_admin();
  perform private.plataforma_validar_operation_id(p_operation_id);

  v_peticion := jsonb_build_object('e', p_empresa_id, 'm', v_motivo)::text;

  perform pg_advisory_xact_lock(hashtextextended('la-suite:plataforma:op:' || p_operation_id, 0));
  select a.accion, a.peticion, a.resultado into v_prev
    from private.plataforma_auditoria a where a.operation_id = p_operation_id;
  if found then
    if v_prev.accion <> 'desactivar_empresa' or v_prev.peticion is distinct from v_peticion then
      raise exception 'operation_id reutilizado con otra petición' using errcode = '22023';
    end if;
    return v_prev.resultado || jsonb_build_object('idempotente', true);
  end if;

  select * into v_empresa from public.empresas e where e.id = p_empresa_id for update;
  if not found then
    raise exception 'Empresa no encontrada' using errcode = 'P0002';
  end if;

  if v_empresa.activo is not true then
    if not exists (select 1 from private.plataforma_bajas b where b.empresa_id = p_empresa_id and b.reactivada_en is null) then
      insert into private.plataforma_bajas(empresa_id, motivo, por_user, membresias_desactivadas, locales_desactivados, reactivada_en)
      values (p_empresa_id, v_motivo, auth.uid(), '{}', '{}', null)
      on conflict (empresa_id) do update
        set baja_en = now(), motivo = excluded.motivo, por_user = excluded.por_user,
            membresias_desactivadas = '{}', locales_desactivados = '{}', reactivada_en = null;
      v_res := jsonb_build_object('ok', true, 'empresa_id', p_empresa_id, 'ya_estaba_desactivada', true, 'baja_registrada_ahora', true);
    else
      v_res := jsonb_build_object('ok', true, 'empresa_id', p_empresa_id, 'ya_estaba_desactivada', true);
    end if;
  else
    select coalesce(array_agg(m.id order by m.id), '{}'::bigint[]) into v_mems
      from public.membresias_usuario m
     where m.empresa_id = p_empresa_id and m.activo = true;
    select coalesce(array_agg(l.id order by l.id), '{}'::text[]) into v_locs
      from public.locales l
     where l.empresa_id = p_empresa_id and l.activo = true;

    update public.membresias_usuario set activo = false where id = any(v_mems);
    update public.locales set activo = false where empresa_id = p_empresa_id and id = any(v_locs);
    update public.empresas set activo = false where id = p_empresa_id;

    insert into private.plataforma_bajas(empresa_id, motivo, por_user, membresias_desactivadas, locales_desactivados, reactivada_en)
    values (p_empresa_id, v_motivo, auth.uid(), v_mems, v_locs, null)
    on conflict (empresa_id) do update
      set baja_en = now(),
          motivo = excluded.motivo,
          por_user = excluded.por_user,
          membresias_desactivadas = excluded.membresias_desactivadas,
          locales_desactivados = excluded.locales_desactivados,
          reactivada_en = null;

    v_res := jsonb_build_object(
      'ok', true,
      'empresa_id', p_empresa_id,
      'ya_estaba_desactivada', false,
      'membresias_desactivadas', cardinality(v_mems),
      'locales_desactivados', cardinality(v_locs)
    );
  end if;

  insert into private.plataforma_auditoria(actor, accion, empresa_id, operation_id, peticion, detalle, resultado)
  values (auth.uid(), 'desactivar_empresa', p_empresa_id, p_operation_id, v_peticion,
          jsonb_build_object('motivo', v_motivo), v_res);

  return v_res;
end;
$$;

-- ---------------------------------------------------------------------------
-- API
-- ---------------------------------------------------------------------------
create or replace function public.plataforma_resumen_eliminacion(p_empresa_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_b jsonb;
  v_filas jsonb;
  v_total bigint;
  v_cuentas uuid[];
begin
  perform private.plataforma_exigir_admin();
  v_b := private.plataforma_bloqueos_eliminacion(p_empresa_id);
  v_filas := private.plataforma_contar_empresa(p_empresa_id);
  select coalesce(sum((value)::bigint), 0) into v_total from jsonb_each_text(v_filas);
  v_cuentas := private.plataforma_cuentas_huerfanas(p_empresa_id);

  return jsonb_build_object(
    'empresa_id', p_empresa_id,
    'puede_borrarse', (v_b -> 'bloqueos') = '[]'::jsonb,
    'bloqueos', v_b -> 'bloqueos',
    'plazo_hasta', v_b -> 'plazo_hasta',
    'copia_hecha', (v_b -> 'copia_hecha'),
    'dias_gracia', private.plataforma_dias_gracia(),
    'filas_por_tabla', v_filas,
    'filas_total', v_total,
    'cuentas_a_borrar', cardinality(v_cuentas)
  );
end;
$$;

create or replace function public.plataforma_exportar_empresa(p_operation_id text, p_empresa_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_empresa public.empresas%rowtype;
  v_peticion text;
  v_prev record;
  v_locales text[];
  r record;
  v_filas jsonb;
  v_datos jsonb := '{}'::jsonb;
  v_por_tabla jsonb := '{}'::jsonb;
  v_total bigint := 0;
  v_n int;
  v_cuentas jsonb;
  v_export jsonb;
  v_huella text;
begin
  perform private.plataforma_exigir_admin();
  perform private.plataforma_validar_operation_id(p_operation_id);

  v_peticion := jsonb_build_object('e', p_empresa_id)::text;

  perform pg_advisory_xact_lock(hashtextextended('la-suite:plataforma:op:' || p_operation_id, 0));
  select a.accion, a.peticion, a.resultado into v_prev
    from private.plataforma_auditoria a where a.operation_id = p_operation_id;
  if found then
    if v_prev.accion <> 'exportar_empresa' or v_prev.peticion is distinct from v_peticion then
      raise exception 'operation_id reutilizado con otra petición' using errcode = '22023';
    end if;
    -- La copia no se guarda en el servidor: para volver a descargarla hay que usar otro operation_id.
    return v_prev.resultado || jsonb_build_object('idempotente', true, 'datos_omitidos', true);
  end if;

  select * into v_empresa from public.empresas e where e.id = p_empresa_id;
  if not found then
    raise exception 'Empresa no encontrada' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(l.id), '{}'::text[]) into v_locales from public.locales l where l.empresa_id = p_empresa_id;

  for r in select * from private.plataforma_plan_purga() order by orden loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from %I.%I t where %s',
                   r.esquema, r.tabla, private.plataforma_condicion(r.modo, r.columna))
      into v_filas using p_empresa_id, v_locales;
    v_n := jsonb_array_length(v_filas);
    if v_n > 0 then
      v_datos := v_datos || jsonb_build_object(r.tabla, v_filas);
      v_por_tabla := v_por_tabla || jsonb_build_object(r.tabla, v_n);
      v_total := v_total + v_n;
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('user_id', u.id, 'email', u.email, 'nombre', p.nombre, 'rol', p.rol) order by u.id), '[]'::jsonb)
    into v_cuentas
    from auth.users u
    left join public.perfiles p on p.user_id = u.id
   where u.id in (select m.user_id from public.membresias_usuario m where m.empresa_id = p_empresa_id);

  v_export := jsonb_build_object(
    'version', 1,
    'empresa', to_jsonb(v_empresa),
    'exportado_en', now(),
    'cuentas', v_cuentas,
    'filas_por_tabla', v_por_tabla,
    'datos', v_datos
  );
  v_huella := encode(sha256(convert_to(v_export::text, 'utf8')), 'hex');

  insert into private.plataforma_exportaciones(empresa_id, actor, filas_total, por_tabla, huella)
  values (p_empresa_id, auth.uid(), v_total, v_por_tabla, v_huella);

  insert into private.plataforma_auditoria(actor, accion, empresa_id, operation_id, peticion, detalle, resultado)
  values (auth.uid(), 'exportar_empresa', p_empresa_id, p_operation_id, v_peticion,
          jsonb_build_object('filas_total', v_total),
          jsonb_build_object('ok', true, 'empresa_id', p_empresa_id, 'filas_total', v_total, 'huella', v_huella));

  return jsonb_build_object('ok', true, 'empresa_id', p_empresa_id, 'filas_total', v_total, 'huella', v_huella, 'copia', v_export);
end;
$$;

create or replace function public.plataforma_preparar_eliminacion(p_operation_id text, p_empresa_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_peticion text;
  v_prev record;
  v_resumen jsonb;
  v_bloqueos jsonb;
  v_codigo text;
  v_expira timestamptz;
  v_res jsonb;
begin
  perform private.plataforma_exigir_admin();
  perform private.plataforma_validar_operation_id(p_operation_id);

  v_peticion := jsonb_build_object('e', p_empresa_id)::text;

  perform pg_advisory_xact_lock(hashtextextended('la-suite:plataforma:op:' || p_operation_id, 0));
  select a.accion, a.peticion, a.resultado into v_prev
    from private.plataforma_auditoria a where a.operation_id = p_operation_id;
  if found then
    if v_prev.accion <> 'preparar_eliminacion' or v_prev.peticion is distinct from v_peticion then
      raise exception 'operation_id reutilizado con otra petición' using errcode = '22023';
    end if;
    -- El código no se repite: para obtener otro hay que usar otro operation_id.
    return v_prev.resultado || jsonb_build_object('idempotente', true, 'codigo_omitido', true);
  end if;

  v_resumen := public.plataforma_resumen_eliminacion(p_empresa_id);
  v_bloqueos := v_resumen -> 'bloqueos';

  -- 'sin_copia' se puede salvar al eliminar con un motivo escrito; cualquier otro bloqueo no.
  if (v_bloqueos - 'sin_copia') <> '[]'::jsonb then
    v_res := jsonb_build_object('ok', false, 'empresa_id', p_empresa_id, 'resumen', v_resumen);
    insert into private.plataforma_auditoria(actor, accion, empresa_id, operation_id, peticion, detalle, resultado)
    values (auth.uid(), 'preparar_eliminacion', p_empresa_id, p_operation_id, v_peticion,
            jsonb_build_object('bloqueos', v_bloqueos), v_res);
    return v_res;
  end if;

  update private.plataforma_codigos set usado_en = now()
   where empresa_id = p_empresa_id and usado_en is null;

  v_codigo := upper(substr(md5(gen_random_uuid()::text), 1, 8));
  v_expira := now() + interval '15 minutes';
  insert into private.plataforma_codigos(empresa_id, codigo_hash, expira_en)
  values (p_empresa_id, encode(sha256(convert_to(v_codigo || ':' || p_empresa_id, 'utf8')), 'hex'), v_expira);

  v_res := jsonb_build_object('ok', true, 'empresa_id', p_empresa_id, 'expira_en', v_expira, 'resumen', v_resumen);
  insert into private.plataforma_auditoria(actor, accion, empresa_id, operation_id, peticion, detalle, resultado)
  values (auth.uid(), 'preparar_eliminacion', p_empresa_id, p_operation_id, v_peticion,
          jsonb_build_object('filas_total', v_resumen -> 'filas_total'), v_res);

  return v_res || jsonb_build_object('codigo', v_codigo);
end;
$$;

create or replace function public.plataforma_eliminar_empresa(
  p_operation_id text,
  p_empresa_id text,
  p_nombre_confirmado text,
  p_codigo text,
  p_sin_copia_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_empresa public.empresas%rowtype;
  v_baja private.plataforma_bajas%rowtype;
  v_peticion text;
  v_prev record;
  v_motivo_sin_copia text := left(nullif(btrim(coalesce(p_sin_copia_motivo, '')), ''), 500);
  v_bloqueos jsonb;
  v_codigo_id bigint;
  v_filas jsonb;
  v_total bigint;
  v_locales text[];
  v_cuentas uuid[];
  v_bloq text;
  r record;
  v_n bigint;
  v_restos bigint;
  v_huella_copia text;
  v_triggers text[] := array[]::text[];
  v_tg record;
  v_res jsonb;
  v_huella text;
begin
  perform private.plataforma_exigir_admin();
  perform private.plataforma_validar_operation_id(p_operation_id);

  v_peticion := jsonb_build_object('e', p_empresa_id, 'n', p_nombre_confirmado, 'm', v_motivo_sin_copia)::text;

  perform pg_advisory_xact_lock(hashtextextended('la-suite:plataforma:op:' || p_operation_id, 0));
  select a.accion, a.peticion, a.resultado into v_prev
    from private.plataforma_auditoria a where a.operation_id = p_operation_id;
  if found then
    if v_prev.accion <> 'eliminar_empresa' or v_prev.peticion is distinct from v_peticion then
      raise exception 'operation_id reutilizado con otra petición' using errcode = '22023';
    end if;
    return v_prev.resultado || jsonb_build_object('idempotente', true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('la-suite:plataforma:alta', 0));

  select * into v_empresa from public.empresas e where e.id = p_empresa_id for update;
  if not found then
    raise exception 'Empresa no encontrada' using errcode = 'P0002';
  end if;

  if btrim(coalesce(p_nombre_confirmado, '')) is distinct from v_empresa.nombre then
    raise exception 'plataforma_nombre_no_coincide' using errcode = '22023';
  end if;

  v_bloqueos := (private.plataforma_bloqueos_eliminacion(p_empresa_id)) -> 'bloqueos';
  for v_bloq in select jsonb_array_elements_text(v_bloqueos) loop
    if v_bloq = 'sin_copia' then
      if v_motivo_sin_copia is null or char_length(v_motivo_sin_copia) < 10 then
        raise exception 'plataforma_bloqueada: sin_copia (hace falta una copia o un motivo escrito de al menos 10 caracteres)' using errcode = '22023';
      end if;
    else
      raise exception 'plataforma_bloqueada: %', v_bloq using errcode = '22023';
    end if;
  end loop;

  select c.id into v_codigo_id
    from private.plataforma_codigos c
   where c.empresa_id = p_empresa_id
     and c.usado_en is null
     and c.expira_en > now()
     and c.codigo_hash = encode(sha256(convert_to(upper(btrim(coalesce(p_codigo, ''))) || ':' || p_empresa_id, 'utf8')), 'hex')
   order by c.id desc
   limit 1;
  if v_codigo_id is null then
    raise exception 'plataforma_codigo_no_valido' using errcode = '22023';
  end if;
  update private.plataforma_codigos set usado_en = now() where id = v_codigo_id;

  select * into v_baja from private.plataforma_bajas b where b.empresa_id = p_empresa_id and b.reactivada_en is null;
  select x.huella into v_huella_copia
    from private.plataforma_exportaciones x
   where x.empresa_id = p_empresa_id and x.exportado_en >= v_baja.baja_en
   order by x.id desc limit 1;

  select coalesce(array_agg(l.id), '{}'::text[]) into v_locales from public.locales l where l.empresa_id = p_empresa_id;
  v_filas := private.plataforma_contar_empresa(p_empresa_id);
  select coalesce(sum((value)::bigint), 0) into v_total from jsonb_each_text(v_filas);
  v_cuentas := private.plataforma_cuentas_huerfanas(p_empresa_id);

  -- Desbloqueo controlado de los disparadores de inmutabilidad (lista cerrada; se reactivan al terminar).
  for v_tg in
    select format('%I.%I', n.nspname, c.relname) as tabla, t.tgname
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal and t.tgenabled <> 'D'
       and t.tgname in ('abc_f5_c09_guard_print', 'abc_f5_c10_guard_delivery', 'abc_f5_c11_guard_reconciliation', 'abc_f5_c12_guard_rehearsal')
  loop
    execute format('alter table %s disable trigger %I', v_tg.tabla, v_tg.tgname);
    v_triggers := v_triggers || (v_tg.tabla || '|' || v_tg.tgname);
  end loop;

  -- Los perfiles de las cuentas que se van a borrar van PRIMERO: un perfil puede apuntar a su empleado
  -- (clave ajena con RESTRICT) y bloquearía el borrado de la tabla de empleados.
  if cardinality(v_cuentas) > 0 then
    delete from public.perfiles where user_id = any(v_cuentas);
  end if;

  for r in select * from private.plataforma_plan_purga() order by orden loop
    execute format('delete from %I.%I where %s', r.esquema, r.tabla, private.plataforma_condicion(r.modo, r.columna))
      using p_empresa_id, v_locales;
  end loop;

  -- Las cuentas de acceso se borran DESPUÉS: muchas tablas guardan quién hizo cada cosa (RESTRICT) y ya no existen.
  if cardinality(v_cuentas) > 0 then
    delete from auth.users where id = any(v_cuentas);
  end if;

  delete from public.empresas where id = p_empresa_id;

  -- Se vuelven a activar los disparadores desbloqueados.
  for v_tg in select split_part(x, '|', 1) as tabla, split_part(x, '|', 2) as tgname from unnest(v_triggers) as x loop
    execute format('alter table %s enable trigger %I', v_tg.tabla, v_tg.tgname);
  end loop;

  -- Comprobación final: no queda nada de la empresa.
  v_restos := 0;
  for r in select * from private.plataforma_plan_purga() order by orden loop
    execute format('select count(*) from %I.%I where %s', r.esquema, r.tabla, private.plataforma_condicion(r.modo, r.columna))
      into v_n using p_empresa_id, v_locales;
    v_restos := v_restos + v_n;
  end loop;
  if v_restos > 0 or exists (select 1 from public.empresas e where e.id = p_empresa_id)
     or exists (select 1 from auth.users u where u.id = any(v_cuentas)) then
    raise exception 'plataforma_restos_tras_borrado' using errcode = 'P0001';
  end if;

  v_huella := encode(sha256(convert_to(
    jsonb_build_object('e', p_empresa_id, 'f', v_filas, 'c', cardinality(v_cuentas), 'copia', v_huella_copia)::text, 'utf8')), 'hex');

  insert into private.plataforma_eliminaciones(
    actor, operation_id, empresa_id, nombre, motivo_baja, baja_en, filas_por_tabla, filas_total,
    cuentas_eliminadas, sin_copia_motivo, huella_copia, huella)
  values (
    auth.uid(), p_operation_id, p_empresa_id, v_empresa.nombre, v_baja.motivo, v_baja.baja_en, v_filas, v_total,
    cardinality(v_cuentas), v_motivo_sin_copia, v_huella_copia, v_huella);

  v_res := jsonb_build_object(
    'ok', true,
    'empresa_id', p_empresa_id,
    'nombre', v_empresa.nombre,
    'filas_total', v_total,
    'filas_por_tabla', v_filas,
    'cuentas_eliminadas', cardinality(v_cuentas),
    'huella', v_huella
  );

  insert into private.plataforma_auditoria(actor, accion, empresa_id, operation_id, peticion, detalle, resultado)
  values (auth.uid(), 'eliminar_empresa', p_empresa_id, p_operation_id, v_peticion,
          jsonb_build_object('filas_total', v_total, 'cuentas_eliminadas', cardinality(v_cuentas), 'sin_copia', v_motivo_sin_copia is not null), v_res);

  return v_res;
end;
$$;

revoke all on function public.plataforma_desactivar_empresa(text, text, text) from public, anon;
revoke all on function public.plataforma_resumen_eliminacion(text) from public, anon;
revoke all on function public.plataforma_exportar_empresa(text, text) from public, anon;
revoke all on function public.plataforma_preparar_eliminacion(text, text) from public, anon;
revoke all on function public.plataforma_eliminar_empresa(text, text, text, text, text) from public, anon;
grant execute on function public.plataforma_desactivar_empresa(text, text, text) to authenticated;
grant execute on function public.plataforma_resumen_eliminacion(text) to authenticated;
grant execute on function public.plataforma_exportar_empresa(text, text) to authenticated;
grant execute on function public.plataforma_preparar_eliminacion(text, text) to authenticated;
grant execute on function public.plataforma_eliminar_empresa(text, text, text, text, text) to authenticated;

commit;
