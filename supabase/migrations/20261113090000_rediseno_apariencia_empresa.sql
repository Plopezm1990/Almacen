-- ============================================================================
-- Rediseno · Apariencia de la empresa (org-37) con autoridad en el servidor
-- ----------------------------------------------------------------------------
-- Motivo. La apariencia se guardaba con la clave generica `apariencia` de
-- `window.storage`. En QA se comprobo que `almacen_kv` solo admite una lista
-- cerrada de claves: la escritura se rechaza con 42501 y el cliente cae a
-- `localStorage`. Resultado: la configuracion no sale del navegador, no llega
-- a los demas locales ni sesiones, y ni el permiso ni la revision se validan
-- en el servidor.
--
-- Esta migracion es ADITIVA: crea su propio almacen, su historial y sus RPC.
-- No toca `almacen_kv`, ni `abc_tiene_capacidad`, ni ninguna tabla existente.
-- El frontend sigue funcionando sin ella (cae a su reserva local), asi que es
-- compatible hacia atras en ambos sentidos.
-- ============================================================================

create table if not exists public.apariencia_empresa (
  empresa_id      text primary key,
  diseno          text not null,
  paleta          text,
  colores         jsonb,
  revision        bigint not null default 1,
  anterior        jsonb,
  actualizado_por uuid not null references auth.users(id) on delete restrict,
  actualizado_en  timestamptz not null default now(),
  constraint apariencia_revision_positiva check (revision >= 1),
  constraint apariencia_diseno_registrado check (
    diseno in ('oliva','claro','pulso','patio','rumbo','sello','orbita','ascua','pase')
  ),
  constraint apariencia_paleta_registrada check (
    paleta is null or paleta in ('bosque','cafe-tostado','azul-ambar','amatista','granada','ascua')
  )
);

create table if not exists public.apariencia_revisiones (
  id              bigserial primary key,
  empresa_id      text not null,
  revision        bigint not null,
  diseno          text not null,
  paleta          text,
  colores         jsonb,
  accion          text not null,
  actor_user_id   uuid not null references auth.users(id) on delete restrict,
  creado_en       timestamptz not null default now(),
  constraint apariencia_rev_accion check (accion in ('APLICAR','RESTAURAR')),
  constraint apariencia_rev_unica unique (empresa_id, revision)
);

-- Delegacion: el propietario autoriza a un cargo concreto de SU empresa.
create table if not exists public.apariencia_delegaciones (
  empresa_id     text not null,
  rol            text not null,
  concedido_por  uuid not null references auth.users(id) on delete restrict,
  concedido_en   timestamptz not null default now(),
  primary key (empresa_id, rol)
);

alter table public.apariencia_empresa      enable row level security;
alter table public.apariencia_revisiones   enable row level security;
alter table public.apariencia_delegaciones enable row level security;

-- Sin politicas permisivas: el acceso pasa siempre por los RPC de abajo, que
-- son security definer y comprueban membresia y capacidad. Una consulta
-- directa desde el navegador no devuelve ni escribe nada.
revoke all on table public.apariencia_empresa      from anon, authenticated;
revoke all on table public.apariencia_revisiones   from anon, authenticated;
revoke all on table public.apariencia_delegaciones from anon, authenticated;

-- ---------------------------------------------------------------- helpers --

create or replace function private.abc_apariencia_rol(p_empresa_id text)
returns text
language sql
stable
security definer
set search_path=''
as $$
  select m.rol
    from public.membresias_usuario m
   where m.user_id = auth.uid()
     and m.empresa_id = p_empresa_id
     and m.activo = true
   order by case when m.todos_locales then 0 else 1 end, m.id desc
   limit 1;
$$;

create or replace function private.abc_apariencia_puede_aplicar(p_empresa_id text)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_rol text;
begin
  if auth.uid() is null then return false; end if;
  v_rol := private.abc_apariencia_rol(p_empresa_id);
  if v_rol is null then return false; end if;
  if v_rol = 'Propietario' then return true; end if;
  return exists(
    select 1 from public.apariencia_delegaciones d
     where d.empresa_id = p_empresa_id and d.rol = v_rol
  );
end $$;

-- Paleta propia: o no hay ninguna, o estan los seis campos semanticos con una
-- cadena HEX de seis digitos en cada uno.
--
-- Solo el NULL de SQL significa "sin paleta propia". Un `null` de JSON en
-- cualquiera de los seis campos es un valor invalido, no una ausencia: por eso
-- se exige jsonb_typeof(...) = 'string' campo a campo, en vez de confiar en el
-- operador ->> , que devuelve NULL tanto para un `null` de JSON como para una
-- clave ausente. La envoltura coalesce(..., false) mantiene el resultado
-- estrictamente booleano: bool_and ignora los NULL y, sin ella, seis `null`
-- de JSON devolvian NULL y el `if not ...` de quien llama no se disparaba.
create or replace function private.abc_apariencia_colores_validos(p_colores jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(
    p_colores is null
    or (
      jsonb_typeof(p_colores) = 'object'
      and (select count(*) from jsonb_object_keys(p_colores)) = 6
      and (
        select coalesce(bool_and(
                 p_colores ? k
                 and jsonb_typeof(p_colores -> k) = 'string'
                 and p_colores ->> k ~ '^#[0-9A-Fa-f]{6}$'
               ), false)
          from unnest(array['fondo','tarjetas','texto','enlaces','boton','detalle']) k
      )
    ),
    false);
$$;

-- -------------------------------------------------------------------- leer --

create or replace function public.abc_apariencia_leer(p_empresa_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_fila public.apariencia_empresa%rowtype;
begin
  if auth.uid() is null or private.abc_apariencia_rol(p_empresa_id) is null then
    raise exception 'apariencia_no_autorizada';
  end if;

  select * into v_fila from public.apariencia_empresa where empresa_id = p_empresa_id;
  if not found then
    return jsonb_build_object(
      'ok', true, 'existe', false,
      'puede_aplicar', private.abc_apariencia_puede_aplicar(p_empresa_id)
    );
  end if;

  return jsonb_build_object(
    'ok', true, 'existe', true,
    'diseno', v_fila.diseno, 'paleta', v_fila.paleta, 'colores', v_fila.colores,
    'revision', v_fila.revision, 'anterior', v_fila.anterior,
    'actualizado_por', v_fila.actualizado_por, 'actualizado_en', v_fila.actualizado_en,
    'puede_aplicar', private.abc_apariencia_puede_aplicar(p_empresa_id)
  );
end $$;

-- ----------------------------------------------------------------- guardar --
-- p_revision_leida es la revision sobre la que el editor trabajaba. null solo
-- vale cuando todavia no hay configuracion. Cualquier otro valor distinto del
-- vigente se rechaza: la comparacion la hace el servidor, no el navegador.

create or replace function public.abc_apariencia_guardar(
  p_empresa_id     text,
  p_revision_leida bigint,
  p_diseno         text,
  p_paleta         text,
  p_colores        jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_actual   public.apariencia_empresa%rowtype;
  v_siguiente bigint;
  v_anterior jsonb;
begin
  if not private.abc_apariencia_puede_aplicar(p_empresa_id) then
    raise exception 'apariencia_no_autorizada';
  end if;
  if p_diseno not in ('oliva','claro','pulso','patio','rumbo','sello','orbita','ascua','pase') then
    raise exception 'apariencia_diseno_no_registrado';
  end if;
  if not private.abc_apariencia_colores_validos(p_colores) then
    raise exception 'apariencia_colores_invalidos';
  end if;

  select * into v_actual from public.apariencia_empresa
   where empresa_id = p_empresa_id for update;

  if found then
    if p_revision_leida is null or p_revision_leida <> v_actual.revision then
      raise exception 'apariencia_revision_obsoleta'
        using detail = 'revision_vigente=' || v_actual.revision;
    end if;
    v_siguiente := v_actual.revision + 1;
    v_anterior := jsonb_build_object(
      'diseno', v_actual.diseno, 'paleta', v_actual.paleta, 'colores', v_actual.colores,
      'revision', v_actual.revision, 'actualizado_por', v_actual.actualizado_por,
      'actualizado_en', v_actual.actualizado_en
    );
    update public.apariencia_empresa
       set diseno = p_diseno, paleta = p_paleta, colores = p_colores,
           revision = v_siguiente, anterior = v_anterior,
           actualizado_por = auth.uid(), actualizado_en = now()
     where empresa_id = p_empresa_id;
  else
    if p_revision_leida is not null then
      raise exception 'apariencia_revision_obsoleta' using detail = 'sin_configuracion_previa';
    end if;
    v_siguiente := 1;
    v_anterior := null;
    insert into public.apariencia_empresa(
      empresa_id, diseno, paleta, colores, revision, anterior, actualizado_por, actualizado_en)
    values (p_empresa_id, p_diseno, p_paleta, p_colores, 1, null, auth.uid(), now());
  end if;

  insert into public.apariencia_revisiones(
    empresa_id, revision, diseno, paleta, colores, accion, actor_user_id)
  values (p_empresa_id, v_siguiente, p_diseno, p_paleta, p_colores, 'APLICAR', auth.uid());

  return public.abc_apariencia_leer(p_empresa_id);
end $$;

-- --------------------------------------------------------------- restaurar --
-- Restaurar no borra: crea una revision nueva a partir de la anterior.

create or replace function public.abc_apariencia_restaurar(
  p_empresa_id     text,
  p_revision_leida bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_actual public.apariencia_empresa%rowtype;
  v_prev   jsonb;
  v_sig    bigint;
begin
  if not private.abc_apariencia_puede_aplicar(p_empresa_id) then
    raise exception 'apariencia_no_autorizada';
  end if;

  select * into v_actual from public.apariencia_empresa
   where empresa_id = p_empresa_id for update;
  if not found then raise exception 'apariencia_sin_configuracion'; end if;
  if p_revision_leida is null or p_revision_leida <> v_actual.revision then
    raise exception 'apariencia_revision_obsoleta'
      using detail = 'revision_vigente=' || v_actual.revision;
  end if;

  v_prev := v_actual.anterior;
  if v_prev is null then raise exception 'apariencia_sin_revision_anterior'; end if;
  v_sig := v_actual.revision + 1;

  update public.apariencia_empresa
     set diseno = v_prev->>'diseno',
         paleta = nullif(v_prev->>'paleta',''),
         colores = case when jsonb_typeof(v_prev->'colores')='object' then v_prev->'colores' else null end,
         revision = v_sig,
         anterior = jsonb_build_object(
           'diseno', v_actual.diseno, 'paleta', v_actual.paleta, 'colores', v_actual.colores,
           'revision', v_actual.revision, 'actualizado_por', v_actual.actualizado_por,
           'actualizado_en', v_actual.actualizado_en),
         actualizado_por = auth.uid(),
         actualizado_en = now()
   where empresa_id = p_empresa_id;

  insert into public.apariencia_revisiones(
    empresa_id, revision, diseno, paleta, colores, accion, actor_user_id)
  values (p_empresa_id, v_sig, v_prev->>'diseno', nullif(v_prev->>'paleta',''),
          case when jsonb_typeof(v_prev->'colores')='object' then v_prev->'colores' else null end,
          'RESTAURAR', auth.uid());

  return public.abc_apariencia_leer(p_empresa_id);
end $$;

-- ------------------------------------------------------------------ grants --

revoke all on function public.abc_apariencia_leer(text)                             from public, anon, authenticated, service_role;
revoke all on function public.abc_apariencia_guardar(text,bigint,text,text,jsonb)    from public, anon, authenticated, service_role;
revoke all on function public.abc_apariencia_restaurar(text,bigint)                  from public, anon, authenticated, service_role;

grant execute on function public.abc_apariencia_leer(text)                           to authenticated;
grant execute on function public.abc_apariencia_guardar(text,bigint,text,text,jsonb) to authenticated;
grant execute on function public.abc_apariencia_restaurar(text,bigint)               to authenticated;
