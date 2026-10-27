-- C07-D.2.2 — índices de cobertura para las FK nuevas de la configuración.
-- No cambia el contrato ni expone las tablas privadas.

create index if not exists abc_c07d_emision_adapter_fk_idx
  on private.abc_c07d_emision_config(adapter_code);

create index if not exists abc_c07d_emision_updated_by_fk_idx
  on private.abc_c07d_emision_config(updated_by);

create index if not exists abc_c07d_revision_actor_fk_idx
  on private.abc_c07d_emision_config_revisiones(actor_user_id);
