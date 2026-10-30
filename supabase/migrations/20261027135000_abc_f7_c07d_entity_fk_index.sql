-- ABC F7 C07-D. Cobertura del FK empresa/emisor de la relacion local-emisor.

create index if not exists entidad_fiscal_locales_entidad_fk_idx
  on public.entidad_fiscal_locales(empresa_id, entidad_fiscal_id);
