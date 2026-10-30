-- ABC F7 C07-D. Hardening de concurrencia de la cadena fiscal.
-- Se conserva como migracion separada para QA ya reconciliada.

do $$
begin
  if to_regclass('public.abc_c07d_registros_fiscales') is null then
    raise exception 'ABC_F7_C07D_HARDENING_PREFLIGHT_FALLO:registro_fiscal_no_disponible';
  end if;
end $$;

create or replace function private.abc_c07d_normalize_registro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anterior public.abc_c07d_registros_fiscales%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      new.empresa_id || ':' || new.entidad_fiscal_id::text, 0
    )
  );
  if new.evento = 'EMISION' and not exists (
    select 1
      from public.abc_c05_documentos_emitidos d
     where d.id = new.documento_id
       and d.empresa_id = new.empresa_id
       and d.entidad_fiscal_id = new.entidad_fiscal_id
       and d.estado = 'EMITIDO'
  ) then
    raise exception 'registro_fiscal_requiere_documento_emitido';
  end if;
  select * into v_anterior
    from public.abc_c07d_registros_fiscales r
   where r.empresa_id = new.empresa_id
     and r.entidad_fiscal_id = new.entidad_fiscal_id
   order by r.secuencia desc
   limit 1
   for update;
  new.secuencia := coalesce(v_anterior.secuencia, 0) + 1;
  new.hash_anterior_sha256 := v_anterior.hash_sha256;
  new.hash_sha256 := encode(
    extensions.digest(coalesce(v_anterior.hash_sha256, '') || new.snapshot::text, 'sha256'),
    'hex'
  );
  return new;
end $$;

drop trigger if exists abc_c07d_registro_chain_lock
  on public.abc_c07d_registros_fiscales;
create trigger abc_c07d_registro_chain_lock
before insert on public.abc_c07d_registros_fiscales
for each row execute function private.abc_c07d_normalize_registro();

revoke all on function private.abc_c07d_normalize_registro() from public, anon, authenticated, service_role;
