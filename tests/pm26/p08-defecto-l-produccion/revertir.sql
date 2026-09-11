-- PM26 P08 -- reversion exacta de la migracion propuesta del Defecto L
-- en produccion. Restaura las 3 politicas originales (texto exacto,
-- solo restriccion por rol) y retira las columnas nuevas.
--
-- SOLO segura cuando la tabla esta vacia (igual que la propia
-- migracion). Si ya hubo trafico real (filas escritas con la
-- migracion y el cliente coordinado ya desplegados), retirar las
-- columnas destruiria ese aislamiento para siempre -- usar en su lugar
-- revertir-conservador.sql, que nunca borra filas ni columnas y solo
-- revierte el comportamiento (politicas + NOT NULL). El guard de abajo
-- aborta automaticamente en ese caso en vez de ejecutar el DROP COLUMN
-- a ciegas.

begin;

do $$
declare
  v_total int;
begin
  select count(*) into v_total from public.prefiltros_candidatos;
  if v_total <> 0 then
    raise exception 'ROLLBACK_FALLO: prefiltros_candidatos tiene % filas -- esta reversion retira empresa_id/local_id y perderia esos datos para siempre. Usar revertir-conservador.sql en su lugar (conserva todas las filas y columnas, solo revierte las 3 politicas y relaja NOT NULL)', v_total;
  end if;
end
$$;

drop policy if exists "prefiltros - propietario lee" on public.prefiltros_candidatos;
create policy "prefiltros - propietario lee"
  on public.prefiltros_candidatos for select to authenticated
  using (exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = true and p.rol = 'Propietario'::text));

drop policy if exists "prefiltros - propietario crea" on public.prefiltros_candidatos;
create policy "prefiltros - propietario crea"
  on public.prefiltros_candidatos for insert to authenticated
  with check (exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = true and p.rol = 'Propietario'::text));

drop policy if exists "prefiltros - propietario borra" on public.prefiltros_candidatos;
create policy "prefiltros - propietario borra"
  on public.prefiltros_candidatos for delete to authenticated
  using (exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = true and p.rol = 'Propietario'::text));

alter table public.prefiltros_candidatos drop column if exists empresa_id;
alter table public.prefiltros_candidatos drop column if exists local_id;

commit;
