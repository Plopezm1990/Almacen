-- Reversion exacta de la migracion PM26 P06h (aviso F), para verificar
-- en el entorno aislado que el estado vuelve a ser el original.
begin;

-- El estado original de QA no concedia NINGUN privilegio a
-- authenticated sobre esta tabla (verificado en
-- P06B_AVISO_F_INVESTIGACION.md) -- revertir es retirar lo que esta
-- migracion añadio, no restaurar INSERT/UPDATE/DELETE (que nunca
-- estuvieron concedidos).
revoke select on public.prefiltros_candidatos from authenticated;

drop policy if exists prefiltros_candidatos_select_gestion on public.prefiltros_candidatos;
drop function if exists public.pm11_crear_prefiltro_candidato(text, text, text);
drop function if exists public.pm11_eliminar_prefiltro_candidato(text, text, text);

alter table public.prefiltros_candidatos drop column if exists empresa_id;
alter table public.prefiltros_candidatos drop column if exists local_id;

commit;
