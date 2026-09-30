\set ON_ERROR_STOP on

-- La bateria F2 M03C es la autoridad transaccional reutilizada por B08.
-- Este wrapper le da una entrada F4 explicita sin duplicar la logica ni crear
-- una segunda autoridad para reembolsos.
\ir ../../f2/m03c/m03c-contract.sql

select 'ABC_F4_B08_CONTRACT=PASS' as resultado;
