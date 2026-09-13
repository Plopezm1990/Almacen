-- PM21 P01 (corrección autorizada): las 4 políticas de storage.objects para el bucket
-- qa-pruebas solo comprobaban bucket_id, sin ningún aislamiento por empresa. El bucket
-- está vacío (0 objetos) y sin ningún consumidor en fuente.js todavía, así que se fija
-- ahora la convención de ruta antes de que cualquier función de adjuntos futura la
-- necesite: primer segmento de la ruta = empresaId del objeto (name = 'empresaId/...').
-- Se exige pertenencia real a esa empresa (private.la_tiene_empresa), mismo patrón que
-- el resto de tablas de empresa. La convención de local (segundo segmento, si aplica)
-- queda para cuando exista una función de negocio real que defina su propio contrato.

drop policy if exists qa_storage_authenticated_delete on storage.objects;
drop policy if exists qa_storage_authenticated_insert on storage.objects;
drop policy if exists qa_storage_authenticated_read on storage.objects;
drop policy if exists qa_storage_authenticated_update on storage.objects;

create policy qa_storage_empresa_select on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'qa-pruebas'
    and private.la_tiene_empresa((storage.foldername(name))[1])
  );

create policy qa_storage_empresa_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'qa-pruebas'
    and private.la_tiene_empresa((storage.foldername(name))[1])
  );

create policy qa_storage_empresa_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'qa-pruebas'
    and private.la_tiene_empresa((storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'qa-pruebas'
    and private.la_tiene_empresa((storage.foldername(name))[1])
  );

create policy qa_storage_empresa_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'qa-pruebas'
    and private.la_tiene_empresa((storage.foldername(name))[1])
  );
