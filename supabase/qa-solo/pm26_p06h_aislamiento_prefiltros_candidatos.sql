-- PM26 P06h -- aviso F (Opción B, diseño estricto): aislamiento
-- obligatorio por empresa/local para prefiltros_candidatos, lectura
-- por RLS, escritura exclusivamente por RPC, roles
-- Propietario/Encargado via private.pm11_puede_ver_personal /
-- private.pm11_puede_mutar_personal (ya vigentes en QA).
--
-- AVISO -- igual que la migracion del aviso H, este archivo vive en
-- supabase/qa-solo a proposito, NUNCA en supabase/migrations. A
-- diferencia del aviso H (donde aplicarlo por error a produccion
-- simplemente fallaria por nombres de politica inexistentes),
-- aplicar esto a produccion seria ACTIVAMENTE DAÑINO: produccion
-- concede hoy INSERT y DELETE directos a `authenticated` sobre esta
-- tabla (verificado en P06D_AVISO_F_PRODUCCION_SOLO_LECTURA.md) -- el
-- REVOKE de este archivo rompería ese acceso real y ya en uso. El
-- preflight de abajo comprueba explícitamente que NO se está en
-- producción (ausencia de las 3 políticas reales de producción,
-- nombradas "prefiltros - propietario ..."), y aborta si las
-- encuentra.
--
-- Combina en un solo archivo lo que en un entorno con filas
-- existentes requeriría dos migraciones separadas (ver
-- P06H_AVISO_F_DISENO_DESPLIEGUE.md, sección "Orden de despliegue"):
--   Fase A (aditiva): columnas nullable, RPC, política de lectura,
--     revocar mutaciones directas.
--   Fase C (endurecer): NOT NULL en empresa_id/local_id, solo cuando
--     un preflight confirma que ninguna fila quedaría inválida.
-- Aquí se combinan porque el preflight confirma, en el momento de
-- aplicar, que la tabla sigue vacía (0 filas) -- si no lo estuviera,
-- aborta explícitamente en vez de imponer NOT NULL a ciegas.
--
-- No se aplica en QA sin autorización específica adicional. P07b
-- prepara de forma coordinada el cliente que sustituye INSERT/DELETE
-- directos por estas RPC, pero no despliega ni este SQL ni el cliente.
--
-- P07c confirmó además que QA conserva privilegios por defecto de
-- Supabase que conceden EXECUTE directamente a anon, authenticated y
-- service_role para funciones nuevas de public. Por eso cada RPC retira
-- tanto PUBLIC como esos grants directos y vuelve a conceder únicamente
-- authenticated. Revocar solo PUBLIC no basta en este proyecto real.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- PM26_P06H_PREFLIGHT_INICIO
do $$
declare
  v_total int;
  v_ya_existe int;
begin
  -- 1) No es producción: las 3 políticas reales de producción para
  --    esta tabla no deben existir aquí.
  select count(*) into v_ya_existe
    from pg_policies
   where tablename = 'prefiltros_candidatos'
     and policyname in ('prefiltros - propietario lee', 'prefiltros - propietario crea', 'prefiltros - propietario borra');
  if v_ya_existe > 0 then
    raise exception 'PREFLIGHT_FALLO: se encontraron políticas de producción sobre prefiltros_candidatos -- esto no es QA, abortando';
  end if;

  -- 2) No aplicado ya: ninguna de las dos columnas, la política nueva
  --    ni ninguna de las dos RPC deben existir todavía.
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='prefiltros_candidatos' and column_name in ('empresa_id', 'local_id')) then
    raise exception 'PREFLIGHT_FALLO: ya existe empresa_id o local_id en prefiltros_candidatos -- esta migración puede haberse aplicado ya';
  end if;
  if exists (select 1 from pg_policies where tablename='prefiltros_candidatos' and policyname='prefiltros_candidatos_select_gestion') then
    raise exception 'PREFLIGHT_FALLO: la política prefiltros_candidatos_select_gestion ya existe';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('pm11_crear_prefiltro_candidato', 'pm11_eliminar_prefiltro_candidato')) then
    raise exception 'PREFLIGHT_FALLO: ya existe alguna RPC PM11 de prefiltros';
  end if;

  -- 3) La tabla debe estar vacía -- si no lo está, esta migración
  --    combinada NO es segura (impondría NOT NULL sin backfill). Debe
  --    rediseñarse en dos fases (ver documento de diseño) en vez de
  --    forzarlo aquí.
  select count(*) into v_total from public.prefiltros_candidatos;
  if v_total <> 0 then
    raise exception 'PREFLIGHT_FALLO: prefiltros_candidatos tiene % filas -- esta migración combinada exige 0 filas; con filas existentes hace falta la migración en dos fases (Fase A aditiva + Fase C con backfill), no esta', v_total;
  end if;

  raise notice 'PREFLIGHT_CATALOGO=PASS';
end
$$;
-- PM26_P06H_PREFLIGHT_FIN

-- Columnas obligatorias de aislamiento, NOT NULL directamente: el
-- preflight ya confirmó 0 filas, así que no hay ningún valor
-- existente que pueda violarlo -- no hace falta ningún valor por
-- defecto transitorio.
alter table public.prefiltros_candidatos add column empresa_id text not null;
alter table public.prefiltros_candidatos add column local_id text not null;

-- Lectura: RLS directo, reutilizando el helper ya existente del mismo
-- dominio (empleados).
create policy prefiltros_candidatos_select_gestion
  on public.prefiltros_candidatos
  for select to authenticated
  using (private.pm11_puede_ver_personal(empresa_id, local_id));

-- Escritura: RPC autoritativa, empresa_id/local_id fijados en el
-- servidor -- nunca aceptados ciegamente del cliente.
create or replace function public.pm11_crear_prefiltro_candidato(
  p_empresa_id text, p_local_id text, p_candidato_nombre text
) returns text
language plpgsql security definer
set search_path to ''
as $$
declare v_token text;
begin
  if auth.uid() is null or not private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) then
    raise exception 'personal_contexto_no_autorizado';
  end if;
  if nullif(btrim(p_candidato_nombre), '') is null then
    raise exception 'prefiltro_candidato_nombre_requerido';
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.prefiltros_candidatos (token, candidato_nombre, estado, empresa_id, local_id)
  values (v_token, btrim(p_candidato_nombre), 'pendiente', p_empresa_id, p_local_id);
  return v_token;
end;
$$;
revoke all on function public.pm11_crear_prefiltro_candidato(text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.pm11_crear_prefiltro_candidato(text, text, text) to authenticated;

create or replace function public.pm11_eliminar_prefiltro_candidato(
  p_empresa_id text, p_local_id text, p_token text
) returns boolean
language plpgsql security definer
set search_path to ''
as $$
declare v_empresa text; v_local text;
begin
  if auth.uid() is null or not private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) then
    raise exception 'personal_contexto_no_autorizado';
  end if;
  select empresa_id, local_id into v_empresa, v_local
    from public.prefiltros_candidatos where token = p_token;
  if not found then
    return false;
  end if;
  if v_empresa is distinct from p_empresa_id or v_local is distinct from p_local_id then
    raise exception 'prefiltro_candidato_contexto_no_coincide';
  end if;
  delete from public.prefiltros_candidatos where token = p_token;
  return true;
end;
$$;
revoke all on function public.pm11_eliminar_prefiltro_candidato(text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.pm11_eliminar_prefiltro_candidato(text, text, text) to authenticated;

-- Mutaciones directas revocadas explícitamente -- la única vía de
-- escritura son las dos RPC de arriba.
revoke insert, update, delete on public.prefiltros_candidatos from authenticated, anon, public;
grant select on public.prefiltros_candidatos to authenticated;

commit;
