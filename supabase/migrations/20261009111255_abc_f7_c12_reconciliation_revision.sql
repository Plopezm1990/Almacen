-- ABC F7 C12. Orden total para seleccionar la ultima conciliacion documental.
-- Corrige el desempate no determinista por UUID cuando dos conciliaciones C11
-- se crean dentro de la misma transaccion y comparten created_at.

do $$
declare
  v_definition text;
begin
  if to_regclass('public.abc_c11_conciliaciones_documentales') is null then
    raise exception 'ABC_F7_C12_REVISION_PREFLIGHT_FALLO:falta_tabla_C11';
  end if;
  if to_regprocedure('public.abc_ensayar_cierre_sesion_caja(text,text,text,uuid,uuid,date)') is null then
    raise exception 'ABC_F7_C12_REVISION_PREFLIGHT_FALLO:falta_funcion_C12';
  end if;
  if exists (
    select 1
      from information_schema.columns
     where table_schema='public'
       and table_name='abc_c11_conciliaciones_documentales'
       and column_name='revision'
  ) then
    raise exception 'ABC_F7_C12_REVISION_PREFLIGHT_FALLO:revision_ya_existe';
  end if;

  select pg_get_functiondef(
    'public.abc_ensayar_cierre_sesion_caja(text,text,text,uuid,uuid,date)'::regprocedure
  ) into v_definition;
  if position('order by r.documento_id,r.created_at desc,r.id desc' in v_definition)=0 then
    raise exception 'ABC_F7_C12_REVISION_PREFLIGHT_FALLO:definicion_C12_inesperada';
  end if;
end $$;

alter table public.abc_c11_conciliaciones_documentales
  add column revision bigint generated always as identity;

create unique index abc_c11_conciliacion_revision_uq
  on public.abc_c11_conciliaciones_documentales(revision);

create index abc_c11_conciliacion_documento_revision_idx
  on public.abc_c11_conciliaciones_documentales(
    empresa_id,local_id,documento_id,revision desc
  );

revoke all on sequence public.abc_c11_conciliaciones_documentales_revision_seq
  from public,anon,authenticated,service_role;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.abc_ensayar_cierre_sesion_caja(text,text,text,uuid,uuid,date)'::regprocedure
  ) into v_definition;

  v_definition:=replace(
    v_definition,
    'order by r.documento_id,r.created_at desc,r.id desc',
    'order by r.documento_id,r.revision desc'
  );
  execute v_definition;

  select pg_get_functiondef(
    'public.abc_ensayar_cierre_sesion_caja(text,text,text,uuid,uuid,date)'::regprocedure
  ) into v_definition;
  if position('order by r.documento_id,r.revision desc' in v_definition)=0 then
    raise exception 'ABC_F7_C12_REVISION_POSTFLIGHT_FALLO:orden_no_actualizado';
  end if;
end $$;

