-- PM26 P08b -- rollback CONSERVADOR del Defecto L en produccion: usar
-- unicamente cuando ya hubo trafico real (filas escritas) despues de
-- aplicar la migracion y desplegar el cliente coordinado, y aun asi
-- hace falta revertir el aislamiento por empresa/local.
--
-- A diferencia de revertir.sql (que exige 0 filas y retira
-- empresa_id/local_id por completo), esta version NUNCA borra ni una
-- fila ni un valor: revierte solo el COMPORTAMIENTO --las 3 politicas
-- RLS vuelven a su texto original, solo por rol-- y relaja
-- empresa_id/local_id a NULLABLE en vez de eliminarlas, para que un
-- cliente antiguo (sin esos dos campos en el INSERT) pueda volver a
-- escribir sin romper NOT NULL. Las filas ya escritas conservan su
-- empresa_id/local_id intactos para siempre; las que se creen despues
-- de este rollback con el cliente antiguo simplemente los tendran a
-- NULL, exactamente como antes de que existiera el Defecto L.
--
-- Deliberadamente NO deja el esquema bit a bit igual al anterior a la
-- migracion: las columnas siguen existiendo (ahora nullable). Ese es
-- el precio de no perder datos reales. Retirarlas del todo, si mas
-- adelante se confirma que ninguna fila las necesita, es una decision
-- aparte y explicita con revertir.sql (que exige 0 filas) -- nunca
-- automatica desde aqui.

begin;

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

alter table public.prefiltros_candidatos alter column empresa_id drop not null;
alter table public.prefiltros_candidatos alter column local_id drop not null;

commit;
