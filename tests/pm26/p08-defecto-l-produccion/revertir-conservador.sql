-- PM26 P08c -- rollback CONSERVADOR del Defecto L en produccion.
--
-- PROCEDIMIENTO EXCEPCIONAL Y EXCLUSIVAMENTE MANUAL. NO es el rollback
-- recomendado, NO forma parte de ningun procedimiento automatico y NO
-- debe invocarse desde ningun script, pipeline ni gate.
--
-- QUE CONSERVA Y QUE CUESTA
-- Conserva los datos: no elimina ni una sola fila y no retira las
-- columnas empresa_id/local_id, asi que los valores ya escritos siguen
-- intactos. PERO restaura las 3 politicas originales, que solo
-- comprueban el rol Propietario, sin empresa ni local. Es decir:
-- REABRE el Defecto L. Desde el momento en que estas politicas entran
-- en vigor, un Propietario de otra empresa vuelve a poder leer y
-- borrar prefiltros de empresas y locales que no le corresponden.
-- Conservar los datos NO es conservar el aislamiento: el aislamiento
-- se pierde aqui, y el riesgo de acceso entre empresas y locales
-- vuelve a estar abierto mientras no se restablezcan las politicas
-- con private.la_tiene_local.
--
-- VIA SEGURA PREFERENTE: AVANCE CONTROLADO
-- Ante un problema con el cliente ya desplegado, la estrategia segura
-- es MANTENER las columnas y las politicas con aislamiento y corregir
-- o desplegar el cliente hacia delante. Revertir la proteccion para
-- arreglar un fallo del cliente cambia un problema de disponibilidad
-- por uno de exposicion de datos entre empresas, que es peor y ademas
-- silencioso.
--
-- AUTORIZACION EXPLICITA Y SEPARADA
-- Exige una autorizacion explicita y separada que nombre expresamente
-- que se acepta reabrir el Defecto L y durante cuanto tiempo. Para que
-- no pueda ejecutarse por inercia ni desde un automatismo, el guard de
-- abajo aborta salvo que la sesion declare esa autorizacion a mano:
--
--   psql -v ON_ERROR_STOP=1 \
--     -c "set pm26.autorizacion_reapertura_defecto_l = 'CONFIRMADA';" \
--     -f revertir-conservador.sql
--
-- Esa declaracion NO esta dentro de este archivo a proposito: quien lo
-- ejecute tiene que escribirla, y al escribirla esta afirmando que
-- cuenta con la autorizacion correspondiente.
--
-- Deliberadamente no deja el esquema igual al anterior a la migracion:
-- las columnas siguen existiendo, ahora nullable, para que un cliente
-- antiguo pueda volver a escribir sin romper NOT NULL. Retirarlas del
-- todo es una decision aparte y explicita, con revertir.sql (que exige
-- 0 filas y toma ACCESS EXCLUSIVE antes de contar), nunca desde aqui.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- PM26_P08C_AUTORIZACION_INICIO
do $$
begin
  if coalesce(current_setting('pm26.autorizacion_reapertura_defecto_l', true), '') <> 'CONFIRMADA' then
    raise exception 'ROLLBACK_CONSERVADOR_BLOQUEADO: este procedimiento REABRE el Defecto L (acceso entre empresas y locales) y es excepcional y manual. Exige autorizacion explicita y separada: declarar pm26.autorizacion_reapertura_defecto_l = CONFIRMADA en la sesion antes de ejecutarlo. La via segura preferente es mantener el aislamiento y corregir o desplegar el cliente hacia delante';
  end if;
end
$$;
-- PM26_P08C_AUTORIZACION_FIN

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
