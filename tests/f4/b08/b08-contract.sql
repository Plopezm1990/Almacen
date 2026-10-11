\set ON_ERROR_STOP on

-- B08.2 reutiliza la autoridad de outbox de F2 M04C sin crear una segunda
-- cola ni una segunda autoridad para reembolsos.
-- El contrato M04C cubre el flujo de reembolso externo, sus reintentos,
-- cancelación previa al envío y resolución idempotente.
\ir ../../f2/m04c/m04c-contract.sql

select 'ABC_F4_B08_OUTBOX_CONTRACT=PASS' as resultado;
