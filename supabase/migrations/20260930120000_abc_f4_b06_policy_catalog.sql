-- ABC F4 B06 / subpunto 4 — permisos y clasificación pendiente de asesoría.
--
-- No se inventa aquí el tratamiento fiscal, documental ni contable. Se deja un
-- catálogo explícito y versionable para que la asesoría pueda sustituir los
-- marcadores PENDIENTE_ASESORIA sin cambiar la frontera de cobros ni su saldo.

do $$
begin
  if to_regclass('public.abc_cobros_no_venta') is null then
    raise exception 'ABC_F4_B06_POLICY_PREFLIGHT_FALLO: falta abc_cobros_no_venta';
  end if;
  if to_regclass('public.abc_b06_politica_conceptos') is not null then
    raise exception 'ABC_F4_B06_POLICY_PREFLIGHT_FALLO: catálogo ya existe';
  end if;
end $$;

create table public.abc_b06_politica_conceptos (
  concepto text primary key,
  estado_definicion text not null default 'PENDIENTE_ASESORIA',
  tratamiento_fiscal text not null,
  documento_requerido text not null,
  cuenta_contable text not null,
  capacidad_registro text not null,
  capacidad_devolucion text not null,
  requiere_titular boolean not null default false,
  requiere_encargo boolean not null default false,
  requiere_responsable boolean not null default true,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint abc_b06_policy_concepto check (
    concepto in ('PROPINA','ANTICIPO','FIANZA')
  ),
  constraint abc_b06_policy_estado check (
    estado_definicion in ('PENDIENTE_ASESORIA','VALIDADO_ASESORIA')
  ),
  constraint abc_b06_policy_textos check (
    nullif(btrim(tratamiento_fiscal),'') is not null
    and nullif(btrim(documento_requerido),'') is not null
    and nullif(btrim(cuenta_contable),'') is not null
  ),
  constraint abc_b06_policy_capacidades check (
    capacidad_registro in ('ABC_COBRO_INICIAR')
    and capacidad_devolucion in ('ABC_REEMBOLSO_SOLICITAR')
  ),
  constraint abc_b06_policy_version check (version > 0)
);

insert into public.abc_b06_politica_conceptos(
  concepto,tratamiento_fiscal,documento_requerido,cuenta_contable,
  capacidad_registro,capacidad_devolucion,requiere_titular,requiere_encargo
) values
  ('PROPINA','PENDIENTE_ASESORIA','PENDIENTE_ASESORIA','PENDIENTE_ASESORIA',
   'ABC_COBRO_INICIAR','ABC_REEMBOLSO_SOLICITAR',false,false),
  ('ANTICIPO','PENDIENTE_ASESORIA','PENDIENTE_ASESORIA','PENDIENTE_ASESORIA',
   'ABC_COBRO_INICIAR','ABC_REEMBOLSO_SOLICITAR',false,true),
  ('FIANZA','PENDIENTE_ASESORIA','PENDIENTE_ASESORIA','PENDIENTE_ASESORIA',
   'ABC_COBRO_INICIAR','ABC_REEMBOLSO_SOLICITAR',true,false);

alter table public.abc_cobros_no_venta
  add constraint abc_cobro_no_venta_politica_fk
  foreign key (concepto)
  references public.abc_b06_politica_conceptos(concepto)
  on delete restrict;

alter table public.abc_b06_politica_conceptos enable row level security;

create policy abc_b06_politica_select on public.abc_b06_politica_conceptos
  for select to authenticated
  using (true);

revoke all on public.abc_b06_politica_conceptos from public, anon, authenticated;
grant select on public.abc_b06_politica_conceptos to authenticated;

comment on table public.abc_b06_politica_conceptos is
  'B06: catálogo de permisos y clasificación fiscal/documental/contable pendiente de validar con asesoría.';
comment on column public.abc_b06_politica_conceptos.tratamiento_fiscal is
  'No se aplica una regla fiscal hasta recibir validación de asesoría.';
comment on column public.abc_b06_politica_conceptos.capacidad_registro is
  'Capacidad ABC ya existente que la RPC B06 comprueba para registrar el cobro.';
comment on column public.abc_b06_politica_conceptos.capacidad_devolucion is
  'Capacidad ABC ya existente que la RPC B06 comprueba para devolver el importe.';
