-- Issue #190 — aislamiento Storage por empresa y local en QA
-- Preparación únicamente. No aplicar automáticamente en PROD.
--
-- Contrato de rutas:
--   <empresa_id>/<local_id>/<archivo>
--
-- Si el bucket qa-pruebas no existe, la migración no hace cambios. Esto permite
-- que el archivo permanezca en el árbol de migraciones sin crear Storage en PROD.
-- Si el bucket existe, sustituye las políticas antiguas que solo validaban
-- empresa_id por políticas que validan empresa_id + local_id.

do $$
begin
  if to_regclass('storage.objects') is null
     or to_regclass('storage.buckets') is null then
    raise exception 'ISSUE_190_STORAGE_PREFLIGHT_FALLO: schema storage ausente';
  end if;

  if to_regprocedure('private.la_tiene_local(text,text)') is null then
    raise exception 'ISSUE_190_STORAGE_PREFLIGHT_FALLO: falta private.la_tiene_local(text,text)';
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
      from storage.buckets
     where id = 'qa-pruebas'
  ) then
    execute 'drop policy if exists qa_storage_empresa_select on storage.objects';
    execute 'drop policy if exists qa_storage_empresa_insert on storage.objects';
    execute 'drop policy if exists qa_storage_empresa_update on storage.objects';
    execute 'drop policy if exists qa_storage_empresa_delete on storage.objects';
    execute 'drop policy if exists qa_storage_empresa_local_select on storage.objects';
    execute 'drop policy if exists qa_storage_empresa_local_insert on storage.objects';
    execute 'drop policy if exists qa_storage_empresa_local_update on storage.objects';
    execute 'drop policy if exists qa_storage_empresa_local_delete on storage.objects';

    execute $policy$
      create policy qa_storage_empresa_local_select
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'qa-pruebas'
        and private.la_tiene_local(
          (storage.foldername(name))[1],
          (storage.foldername(name))[2]
        )
      )
    $policy$;

    execute $policy$
      create policy qa_storage_empresa_local_insert
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'qa-pruebas'
        and private.la_tiene_local(
          (storage.foldername(name))[1],
          (storage.foldername(name))[2]
        )
      )
    $policy$;

    execute $policy$
      create policy qa_storage_empresa_local_update
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'qa-pruebas'
        and private.la_tiene_local(
          (storage.foldername(name))[1],
          (storage.foldername(name))[2]
        )
      )
      with check (
        bucket_id = 'qa-pruebas'
        and private.la_tiene_local(
          (storage.foldername(name))[1],
          (storage.foldername(name))[2]
        )
      )
    $policy$;

    execute $policy$
      create policy qa_storage_empresa_local_delete
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'qa-pruebas'
        and private.la_tiene_local(
          (storage.foldername(name))[1],
          (storage.foldername(name))[2]
        )
      )
    $policy$;
  else
    raise notice 'ISSUE_190_STORAGE: bucket qa-pruebas ausente; no se cambia Storage';
  end if;
end
$$;
