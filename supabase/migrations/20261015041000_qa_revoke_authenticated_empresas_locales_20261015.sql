-- P2 SEC: keep company/local tables behind authorized SECURITY DEFINER RPCs.
--
-- QA currently carried a direct authenticated-table grant that is absent in
-- production. The revoke is idempotent and leaves postgres/service_role
-- privileges untouched.
revoke all on table public.empresas, public.locales from authenticated;
