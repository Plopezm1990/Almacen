-- B-02: acelera el historial de errores, que el frontend pide por fecha DESC
-- y limita a los 100 registros más recientes.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if to_regclass('public.errores_sistema') is null then
    raise exception 'B02_PREFLIGHT_FALLO: falta public.errores_sistema';
  end if;

  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'errores_sistema'
       and column_name = 'fecha'
  ) then
    raise exception 'B02_PREFLIGHT_FALLO: falta public.errores_sistema.fecha';
  end if;
end;
$$;

create index if not exists errores_sistema_fecha_idx
  on public.errores_sistema (fecha desc);

commit;
