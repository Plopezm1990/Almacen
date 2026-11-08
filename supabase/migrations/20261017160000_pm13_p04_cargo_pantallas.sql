-- PM13-P04.4 — persistencia autorizada de pantallas consultables por cargo.
-- Solo prepara el contrato servidor para QA; no se aplica automáticamente.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.empresas') is null then v_missing := array_append(v_missing, 'empresas'); end if;
  if to_regclass('public.locales') is null then v_missing := array_append(v_missing, 'locales'); end if;
  if to_regclass('public.abc_cargos') is null then v_missing := array_append(v_missing, 'abc_cargos'); end if;
  if to_regclass('public.auditoria_registro') is null then v_missing := array_append(v_missing, 'auditoria_registro'); end if;
  if to_regprocedure('auth.uid()') is null then v_missing := array_append(v_missing, 'auth.uid'); end if;
  if to_regprocedure('private.pm13_cargo_validar_contexto(text,text)') is null then v_missing := array_append(v_missing, 'pm13_cargo_validar_contexto'); end if;
  if to_regprocedure('private.pm13_cargo_auditar(text,text,text,jsonb)') is null then v_missing := array_append(v_missing, 'pm13_cargo_auditar'); end if;
  if cardinality(v_missing) > 0 then
    raise exception 'PM13_P04_4_PREFLIGHT_FALLO:%', array_to_string(v_missing, ',');
  end if;
end $preflight$;

create or replace function private.pm13_p04_catalogo_consulta()
returns table(capacidad_consulta text, modulo_activo boolean)
language sql
immutable
security definer
set search_path = ''
as $$
  select capacidad, true
    from unnest(array[
      'ABC_PANTALLA_DASHBOARD_CONSULTAR', 'ABC_PANTALLA_DIRECCION_CONSULTAR', 'ABC_PANTALLA_BUSCAR_CONSULTAR',
      'ABC_PANTALLA_PROVEEDORES_CONSULTAR', 'ABC_PANTALLA_PEDIDOS_CONSULTAR', 'ABC_PANTALLA_RECEPCION_CONSULTAR', 'ABC_PANTALLA_ALBARANES_CONSULTAR', 'ABC_PANTALLA_FACTURAS_CONSULTAR',
      'ABC_PANTALLA_RESUMEN_ALMACEN_CONSULTAR', 'ABC_PANTALLA_PRODUCTOS_CONSULTAR', 'ABC_PANTALLA_HISTORIAL_PRODUCTO_CONSULTAR', 'ABC_PANTALLA_CONTEO_CONSULTAR', 'ABC_PANTALLA_SALDO_CONSULTAR', 'ABC_PANTALLA_MAPA_CONSULTAR', 'ABC_PANTALLA_TRASPASOS_CONSULTAR', 'ABC_PANTALLA_DIAGNOSTICO_CONSULTAR', 'ABC_PANTALLA_ETIQUETAS_CONSULTAR',
      'ABC_PANTALLA_VENTA_CONSULTAR', 'ABC_PANTALLA_COCINA_CONSULTAR', 'ABC_PANTALLA_ENCARGOS_CONSULTAR', 'ABC_PANTALLA_CLIENTES_CONSULTAR', 'ABC_PANTALLA_DEVOLUCIONES_CONSULTAR', 'ABC_PANTALLA_DESCUENTOS_CONSULTAR',
      'ABC_PANTALLA_FICHAS_CONSULTAR', 'ABC_PANTALLA_PRODUCCION_CONSULTAR', 'ABC_PANTALLA_MERMAS_CONSULTAR',
      'ABC_PANTALLA_PAGOS_CONSULTAR', 'ABC_PANTALLA_RESULTADOS_CONSULTAR', 'ABC_PANTALLA_REPORTES_CONSULTAR', 'ABC_PANTALLA_LIBROIVA_CONSULTAR', 'ABC_PANTALLA_CAJA_CONSULTAR', 'ABC_PANTALLA_TESORERIA_CONSULTAR', 'ABC_PANTALLA_ESTACIONALIDAD_CONSULTAR',
      'ABC_PANTALLA_PERSONAL_CONSULTAR', 'ABC_PANTALLA_FICHAJE_CONSULTAR', 'ABC_PANTALLA_TURNOS_CONSULTAR', 'ABC_PANTALLA_NOMINAS_CONSULTAR',
      'ABC_PANTALLA_APPCC_CONSULTAR', 'ABC_PANTALLA_ACEITE_CONSULTAR',
      'ABC_PANTALLA_AUDITORIA_CONSULTAR', 'ABC_PANTALLA_RESPALDOS_CONSULTAR', 'ABC_PANTALLA_NOTIFICACIONES_CONSULTAR', 'ABC_PANTALLA_LOCALES_CONSULTAR', 'ABC_PANTALLA_CONFIGURACION_CONSULTAR', 'ABC_PANTALLA_ERRORES_SISTEMA_CONSULTAR'
    ]::text[]) as t(capacidad)
$$;

create or replace function private.pm13_p04_capacidad_consulta_valida(p_capacidad text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from private.pm13_p04_catalogo_consulta() c
     where c.capacidad_consulta = p_capacidad
       and c.modulo_activo = true
  )
$$;

create table if not exists public.abc_cargo_pantallas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references public.empresas(id) on delete restrict,
  cargo_id uuid not null references public.abc_cargos(id) on delete restrict,
  capacidad_consulta text not null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint abc_cargo_pantallas_capacidad_chk check (private.pm13_p04_capacidad_consulta_valida(capacidad_consulta))
);

create unique index if not exists abc_cargo_pantallas_empresa_cargo_capacidad_uq
  on public.abc_cargo_pantallas(empresa_id, cargo_id, capacidad_consulta);
create index if not exists abc_cargo_pantallas_cargo_idx
  on public.abc_cargo_pantallas(empresa_id, cargo_id, updated_at desc);

alter table public.abc_cargo_pantallas enable row level security;
revoke all on table public.abc_cargo_pantallas from public, anon, authenticated, service_role;

create or replace function public.abc_listar_cargo_pantallas(
  p_empresa_id text,
  p_local_id text,
  p_cargo_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  if not exists (select 1 from public.abc_cargos c where c.id = p_cargo_id and c.empresa_id = p_empresa_id) then
    raise exception 'cargo_no_encontrado';
  end if;
  return jsonb_build_object(
    'ok', true,
    'empresa_id', p_empresa_id,
    'local_id', p_local_id,
    'cargo_id', p_cargo_id,
    'pantallas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'capacidad_consulta', catalogo.capacidad_consulta,
        'modulo_activo', catalogo.modulo_activo,
        'permitida', exists (
          select 1
            from public.abc_cargo_pantallas cp
           where cp.empresa_id = p_empresa_id
             and cp.cargo_id = p_cargo_id
             and cp.capacidad_consulta = catalogo.capacidad_consulta
        )
      ) order by catalogo.capacidad_consulta)
      from private.pm13_p04_catalogo_consulta() catalogo
    ), '[]'::jsonb)
  );
end
$$;

create or replace function public.abc_guardar_cargo_pantallas(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cargo_id uuid,
  p_capacidades text[]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_antes jsonb;
  v_despues jsonb;
  v_capacidades text[] := coalesce(p_capacidades, '{}'::text[]);
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  if nullif(btrim(coalesce(p_operation_id, '')), '') is null then
    raise exception 'cargo_operation_id_requerido';
  end if;
  if not exists (select 1 from public.abc_cargos c where c.id = p_cargo_id and c.empresa_id = p_empresa_id and c.activo = true) then
    raise exception 'cargo_no_disponible';
  end if;
  if exists (
    select 1
      from (select distinct capacidad from unnest(v_capacidades) as u(capacidad)) entrada
     where not exists (
       select 1
         from private.pm13_p04_catalogo_consulta() catalogo
        where catalogo.capacidad_consulta = entrada.capacidad
          and catalogo.modulo_activo = true
     )
  ) then
    raise exception 'capacidad_invalida';
  end if;

  select coalesce(jsonb_agg(cp.capacidad_consulta order by cp.capacidad_consulta), '[]'::jsonb)
    into v_antes
    from public.abc_cargo_pantallas cp
   where cp.empresa_id = p_empresa_id and cp.cargo_id = p_cargo_id;

  select coalesce(jsonb_agg(entrada.capacidad order by entrada.capacidad), '[]'::jsonb)
    into v_despues
    from (select distinct capacidad from unnest(v_capacidades) as u(capacidad)) entrada;

  delete from public.abc_cargo_pantallas
   where empresa_id = p_empresa_id and cargo_id = p_cargo_id;

  insert into public.abc_cargo_pantallas(empresa_id, cargo_id, capacidad_consulta, created_by, updated_by)
  select p_empresa_id, p_cargo_id, entrada.capacidad, auth.uid(), auth.uid()
    from (select distinct capacidad from unnest(v_capacidades) as u(capacidad)) entrada;

  perform private.pm13_cargo_auditar(
    'CARGO_PANTALLAS_GUARDADAS',
    p_empresa_id,
    p_local_id,
    jsonb_build_object(
      'cargoId', p_cargo_id,
      'antes', v_antes,
      'despues', v_despues,
      'operationId', p_operation_id,
      'momento', clock_timestamp()
    )
  );

  return jsonb_build_object('ok', true, 'cargo_id', p_cargo_id, 'pantallas_consulta', v_despues);
end
$$;

create or replace function public.abc_listar_cargos(p_empresa_id text, p_local_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  return jsonb_build_object(
    'ok', true,
    'empresa_id', p_empresa_id,
    'local_id', p_local_id,
    'cargos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'empresa_id', c.empresa_id,
        'nombre', c.nombre,
        'descripcion', c.descripcion,
        'activo', c.activo,
        'copiado_de', c.copiado_de,
        'asignados_count', (select count(*) from public.abc_cargo_asignaciones a where a.cargo_id = c.id and a.empresa_id = p_empresa_id and a.local_id = p_local_id and a.activo = true),
        'personas_asignadas', coalesce((
          select jsonb_agg(jsonb_build_object('id', a.empleado_id, 'nombre', e.nombre) order by e.nombre, e.id)
            from public.abc_cargo_asignaciones a
            join public.empleados e on e.id = a.empleado_id
           where a.cargo_id = c.id and a.empresa_id = p_empresa_id and a.local_id = p_local_id and a.activo = true
        ), '[]'::jsonb),
        'pantallas_consulta', coalesce((
          select jsonb_agg(cp.capacidad_consulta order by cp.capacidad_consulta)
            from public.abc_cargo_pantallas cp
           where cp.empresa_id = p_empresa_id and cp.cargo_id = c.id
        ), '[]'::jsonb),
        'created_at', c.created_at,
        'updated_at', c.updated_at
      ) order by c.activo desc, c.nombre_normalizado)
      from public.abc_cargos c
      where c.empresa_id = p_empresa_id
    ), '[]'::jsonb)
  );
end
$$;

revoke all on function private.pm13_p04_catalogo_consulta() from public, anon, authenticated, service_role;
revoke all on function private.pm13_p04_capacidad_consulta_valida(text) from public, anon, authenticated, service_role;
revoke all on function public.abc_listar_cargo_pantallas(text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.abc_guardar_cargo_pantallas(text, text, text, uuid, text[]) from public, anon, authenticated, service_role;
revoke all on function public.abc_listar_cargos(text, text) from public, anon, authenticated, service_role;
grant execute on function public.abc_listar_cargo_pantallas(text, text, uuid) to authenticated;
grant execute on function public.abc_guardar_cargo_pantallas(text, text, text, uuid, text[]) to authenticated;
grant execute on function public.abc_listar_cargos(text, text) to authenticated;

comment on table public.abc_cargo_pantallas is 'Capacidades estables de consulta permitidas por cargo. Las ausentes quedan denegadas por defecto.';
comment on function public.abc_guardar_cargo_pantallas(text, text, text, uuid, text[]) is 'Reemplaza atómicamente las capacidades de consulta de un cargo y registra actor, antes, después y momento.';

commit;
