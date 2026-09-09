-- PM21 P01 (corrección autorizada): movimientos_registro tenía la misma política
-- permisiva que errores_sistema (USING/WITH CHECK true para cualquier authenticated).
-- Tabla huérfana (sin consumidores en fuente.js/migraciones/funciones), 3 filas de
-- fixture QA cuyo id ya identifica su empresa/local real
-- (QA-MOV-A1-INIT/QA-MOV-A2-INIT/QA-MOV-B1-INIT). Se añade empresa_id/local_id, se
-- rellenan esas 3 filas con su contexto real, y se sustituye la política permisiva por
-- una de solo lectura equivalente a auditoria_registro (nada escribe en esta tabla hoy,
-- así que no se repone ninguna política de escritura para clientes).

alter table public.movimientos_registro
  add column if not exists empresa_id text,
  add column if not exists local_id text;

update public.movimientos_registro set empresa_id = 'QA-EMP-A', local_id = 'QA-A1' where id = 'QA-MOV-A1-INIT';
update public.movimientos_registro set empresa_id = 'QA-EMP-A', local_id = 'QA-A2' where id = 'QA-MOV-A2-INIT';
update public.movimientos_registro set empresa_id = 'QA-EMP-B', local_id = 'QA-B1' where id = 'QA-MOV-B1-INIT';

drop policy if exists qa_authenticated_movimientos on public.movimientos_registro;

create policy movimientos_registro_select on public.movimientos_registro
  for select
  to authenticated
  using (
    private.la_usuario_activo()
    and empresa_id is not null
    and private.la_tiene_empresa(empresa_id)
    and (
      private.la_rol() = 'Propietario'
      or (private.la_rol() = 'Encargado' and local_id is not null and private.la_tiene_local(empresa_id, local_id))
    )
  );
