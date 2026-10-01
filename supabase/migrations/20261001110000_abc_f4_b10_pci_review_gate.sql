-- ABC F4 B10.3 — no activar un proveedor antes de revisar el alcance PCI.
--
-- La aprobación es una decisión operativa del adquirente. La base de datos
-- solo impone que un proveedor pendiente no pueda quedar habilitado.

begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $$
begin
  if to_regclass('private.abc_b07_proveedores') is null then
    raise exception 'ABC_F4_B10_PCI_GATE_PREFLIGHT_FALLO:falta abc_b07_proveedores';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema='private'
       and table_name='abc_b07_proveedores'
       and column_name='pci_review_status'
  ) then
    raise exception 'ABC_F4_B10_PCI_GATE_PREFLIGHT_FALLO:pci_review_status ya existe';
  end if;
end $$;

alter table private.abc_b07_proveedores
  add column pci_review_status text not null default 'PENDING_ACQUIRER';

do $$
begin
  if exists (
    select 1 from private.abc_b07_proveedores
     where enabled and pci_review_status <> 'APPROVED'
  ) then
    raise exception 'ABC_F4_B10_PCI_GATE_REQUIERE_REVISION:hay proveedores habilitados sin aprobación';
  end if;
end $$;

alter table private.abc_b07_proveedores
  add constraint abc_b10_pci_review_status_ck
  check (pci_review_status in ('PENDING_ACQUIRER','APPROVED'));

alter table private.abc_b07_proveedores
  add constraint abc_b10_pci_review_enable_ck
  check (enabled = false or pci_review_status = 'APPROVED');

comment on column private.abc_b07_proveedores.pci_review_status is
  'B10: aprobación explícita del alcance PCI por el adquirente; por defecto pendiente.';

commit;
