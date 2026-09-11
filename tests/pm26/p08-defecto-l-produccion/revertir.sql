-- PM26 P08 / P08c -- reversion EXACTA de la migracion propuesta del
-- Defecto L en produccion. Restaura las 3 politicas originales (texto
-- exacto, solo restriccion por rol) y retira las columnas nuevas.
--
-- ATENCION: restaurar las 3 politicas originales NO conserva el
-- aislamiento -- lo ELIMINA. Las politicas originales solo comprueban
-- el rol Propietario, sin empresa ni local, asi que esta reversion
-- vuelve a dejar la tabla expuesta al Defecto L (un Propietario de
-- otra empresa puede leer y borrar filas ajenas). Es una reversion
-- legitima solo porque exige 0 filas: si no hay ningun dato, no hay
-- nada que quede expuesto en ese instante.
--
-- SOLO segura con la tabla vacia (igual que la propia migracion). El
-- guard de abajo lo comprueba el mismo y aborta sin tocar nada si
-- encuentra alguna fila. Con datos reales la via segura NO es
-- revertir: es mantener el aislamiento y corregir o desplegar el
-- cliente (avance controlado). Ver P08C_ENDURECIMIENTO_FINAL_PREVIO_PRODUCCION.md.
--
-- PM26 P08c endurece el guard contra una carrera real: antes, el
-- conteo se hacia bajo el ACCESS SHARE implicito del SELECT, que es
-- compatible con el ROW EXCLUSIVE de un INSERT. La primera sentencia
-- que adquiria ACCESS EXCLUSIVE era el primer DROP POLICY, ya
-- despues del conteo. Entre ambos quedaba una ventana en la que un
-- INSERT concurrente podia confirmarse, y las columnas se retiraban
-- luego con esa fila ya dentro, destruyendo su empresa_id/local_id
-- sin que nada avisara. La ventana es estrecha en reposo, pero se
-- ensancha sola bajo carga: esa sentencia puede quedarse esperando en
-- la cola de bloqueos mientras otras transacciones terminan. Ahora el
-- bloqueo se adquiere ANTES de contar y se mantiene hasta el COMMIT,
-- de modo que el numero contado ya no puede cambiar. Demostrado con
-- dos sesiones reales en concurrencia-revertir.sh, incluido un
-- control negativo que reproduce el orden antiguo y si pierde datos.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- PM26_P08C_GUARD_INICIO
do $$
declare
  v_total int;
begin
  -- 1) Bloqueo ANTES de contar. ACCESS EXCLUSIVE es el mismo nivel que
  --    exige el ALTER TABLE del final, asi que adquirirlo aqui y
  --    mantenerlo hasta el COMMIT cierra por completo la ventana entre
  --    el conteo y la retirada de columnas: cualquier INSERT
  --    concurrente queda bloqueado hasta que esta transaccion termina,
  --    y si ya habia uno en vuelo somos nosotros quienes esperamos y
  --    abortamos por lock_timeout sin haber tocado nada.
  begin
    lock table public.prefiltros_candidatos in access exclusive mode;
  exception
    when lock_not_available then
      raise exception 'ROLLBACK_FALLO: no se pudo adquirir ACCESS EXCLUSIVE sobre prefiltros_candidatos en % -- hay sesiones usando la tabla (posible INSERT en vuelo). No se ha revertido nada; reintentar en una ventana sin trafico', current_setting('lock_timeout');
  end;

  -- 2) Conteo bajo el bloqueo ya adquirido: este numero no puede
  --    cambiar mientras esta transaccion siga viva, asi que el
  --    DROP COLUMN de mas abajo opera sobre exactamente este estado.
  select count(*) into v_total from public.prefiltros_candidatos;
  if v_total <> 0 then
    raise exception 'ROLLBACK_FALLO: prefiltros_candidatos tiene % filas -- esta reversion retira empresa_id/local_id y perderia para siempre esos valores. No se ha revertido nada. Con datos reales la via segura NO es revertir: mantener el aislamiento y corregir o desplegar el cliente (avance controlado). revertir-conservador.sql es un procedimiento excepcional y manual que REABRE el Defecto L y exige autorizacion explicita y separada', v_total;
  end if;
end
$$;
-- PM26_P08C_GUARD_FIN

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
