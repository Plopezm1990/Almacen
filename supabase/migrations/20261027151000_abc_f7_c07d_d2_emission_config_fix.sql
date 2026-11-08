-- ABC F7 C07-D.2.1 — reparación del trigger de alcance tras la primera prueba QA.
-- En INSERT no existe OLD; el alcance solo es inmutable durante UPDATE.

create or replace function private.abc_c07d_emision_config_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (old.empresa_id is distinct from new.empresa_id
       or old.local_id is distinct from new.local_id
       or old.entidad_fiscal_id is distinct from new.entidad_fiscal_id
       or old.tipo_documento is distinct from new.tipo_documento) then
    raise exception 'C07D_CONFIG_SCOPE_INMUTABLE';
  end if;
  if not exists (
    select 1
      from public.abc_c05_series_documentales s
     where s.id = new.serie_id
       and s.empresa_id = new.empresa_id
       and s.local_id = new.local_id
       and s.entidad_fiscal_id = new.entidad_fiscal_id
       and s.tipo_documento = new.tipo_documento
       and s.activa
  ) then
    raise exception 'C07D_CONFIG_SERIE_NO_CORRESPONDE';
  end if;
  return new;
end $$;

revoke all on function private.abc_c07d_emision_config_guard() from public,anon,authenticated,service_role;
