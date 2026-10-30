-- ABC F7 C07-D. Indices de cobertura de las claves foraneas fiscales.

create index if not exists abc_c05_serie_scope_fk_idx
  on public.abc_c05_series_documentales(empresa_id, local_id);
create index if not exists abc_c05_serie_entidad_local_fk_idx
  on public.abc_c05_series_documentales(empresa_id, local_id, entidad_fiscal_id);
create index if not exists abc_c05_documento_serie_fk_idx
  on public.abc_c05_documentos_emitidos(serie_id);
create index if not exists abc_c05_documento_entidad_local_fk_idx
  on public.abc_c05_documentos_emitidos(empresa_id, local_id, entidad_fiscal_id);
create index if not exists abc_c07d_registro_documento_fk_idx
  on public.abc_c07d_registros_fiscales(documento_id);
create index if not exists abc_c07d_registro_local_entidad_idx
  on public.abc_c07d_registros_fiscales(empresa_id, local_id, entidad_fiscal_id);
create index if not exists abc_c07d_cola_registro_fk_idx
  on public.abc_c07d_cola_fiscal(registro_id);
create index if not exists abc_c07d_cola_local_entidad_idx
  on public.abc_c07d_cola_fiscal(empresa_id, local_id, entidad_fiscal_id);
