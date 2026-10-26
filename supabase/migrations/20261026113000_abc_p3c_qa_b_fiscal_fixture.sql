-- ABC P3c / Etapa 7 — fixture fiscal simulado para QA B.
--
-- Alcance deliberadamente limitado al entorno QA y a QA-EMP-B / QA-B1.
-- No crea configuración fiscal en producción ni pretende modelar una entidad
-- legal real. Su objetivo es habilitar la proyección controlada del catálogo
-- TPV durante la aceptación de la persistencia contextual P3c.
--
-- Idempotente: puede reaplicarse sin duplicar entidad, enlaces ni moneda.

begin;

do $$
begin
  if to_regclass('public.empresas') is null
     or to_regclass('public.locales') is null
     or to_regclass('public.entidades_fiscales') is null
     or to_regclass('public.entidad_fiscal_locales') is null
     or to_regclass('public.entidad_fiscal_monedas') is null
     or to_regclass('public.entidad_fiscal_local_monedas') is null then
    raise exception 'ABC_P3C_QA_FISCAL_B_PREFLIGHT_FALLO: dependencias ausentes';
  end if;

end $$;

do $$
begin
  -- En producción u otro entorno sin el fixture QA, esta migración es un
  -- no-op deliberado: no crea empresas, locales ni configuración fiscal.
  if not exists (
    select 1 from public.empresas where id='QA-EMP-B'
  ) or not exists (
    select 1
    from public.locales
    where empresa_id='QA-EMP-B' and id='QA-B1'
  ) then
    raise notice 'ABC_P3C_QA_FISCAL_B: fixture QA ausente; no-op fuera de QA';
    return;
  end if;

  if exists (
    select 1
    from public.entidades_fiscales
    where id='b0000000-0000-0000-0000-0000000000b1'::uuid
      and empresa_id<>'QA-EMP-B'
  ) then
    raise exception 'ABC_P3C_QA_FISCAL_B_PREFLIGHT_FALLO: UUID reservado pertenece a otra empresa';
  end if;

insert into public.entidades_fiscales(
  id,
  empresa_id,
  nombre_legal,
  identificador_fiscal,
  country_code,
  simulada,
  activa,
  version,
  datos_legales
)
values (
  'b0000000-0000-0000-0000-0000000000b1'::uuid,
  'QA-EMP-B',
  'QA Fiscal B · Contexto TPV simulado',
  'QA-B1-TEST',
  'ES',
  true,
  true,
  1,
  jsonb_build_object(
    'entorno','QA',
    'origen','ETAPA7_P3C_FISCAL_B_20261026',
    'modo','simulado'
  )
)
on conflict (id) do update set
  empresa_id=excluded.empresa_id,
  nombre_legal=excluded.nombre_legal,
  identificador_fiscal=excluded.identificador_fiscal,
  country_code=excluded.country_code,
  simulada=excluded.simulada,
  activa=excluded.activa,
  version=excluded.version,
  datos_legales=excluded.datos_legales,
  updated_at=now();

insert into public.entidad_fiscal_locales(
  empresa_id,
  local_id,
  entidad_fiscal_id,
  activa
)
values (
  'QA-EMP-B',
  'QA-B1',
  'b0000000-0000-0000-0000-0000000000b1'::uuid,
  true
)
on conflict (empresa_id,local_id,entidad_fiscal_id)
do update set activa=true;

insert into public.entidad_fiscal_monedas(
  empresa_id,
  entidad_fiscal_id,
  currency_code,
  es_principal,
  activa
)
values (
  'QA-EMP-B',
  'b0000000-0000-0000-0000-0000000000b1'::uuid,
  'EUR',
  true,
  true
)
on conflict (empresa_id,entidad_fiscal_id,currency_code)
do update set es_principal=true, activa=true;

insert into public.entidad_fiscal_local_monedas(
  empresa_id,
  local_id,
  entidad_fiscal_id,
  currency_code,
  activa
)
values (
  'QA-EMP-B',
  'QA-B1',
  'b0000000-0000-0000-0000-0000000000b1'::uuid,
  'EUR',
  true
)
on conflict (empresa_id,local_id,entidad_fiscal_id,currency_code)
do update set activa=true;

end $$;

commit;
