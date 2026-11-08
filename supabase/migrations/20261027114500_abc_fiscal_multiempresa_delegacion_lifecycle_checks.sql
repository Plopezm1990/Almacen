-- C07-C corrección: aceptar, revocar y caducar conservan la evidencia histórica.
begin;

alter table private.abc_fiscal_delegaciones
  drop constraint if exists abc_fiscal_delegaciones_check1,
  drop constraint if exists abc_fiscal_delegaciones_check2;

alter table private.abc_fiscal_delegaciones
  add constraint abc_fiscal_delegaciones_accepted_data_check
    check (estado <> 'ACEPTADA' or (aceptada_at is not null and aceptada_por is not null)),
  add constraint abc_fiscal_delegaciones_revoked_data_check
    check (estado <> 'REVOCADA' or revocada_at is not null);

commit;
