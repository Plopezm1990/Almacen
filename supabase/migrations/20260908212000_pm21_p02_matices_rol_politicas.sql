-- PM21 P02 (corrección autorizada, matices menores identificados en P01):
--
-- 1. pagos_encargo/encargos_empresa tenían sus políticas registradas para el rol
--    `public` en vez de `authenticated` como el resto de la base. Verificado que no era
--    un bypass real (la condición ya exige auth.uid() vía la_tiene_empresa), pero se
--    normaliza por consistencia.
--
-- 2. albaranes_empresa no exigía private.pm06_puede_gestionar_finanzas() en sus
--    mutaciones, a diferencia de gastos_empresa/facturas_directas_empresa. Verificado
--    antes de aplicar: albaranes_empresa no tiene NINGÚN consumidor en fuente.js (ni
--    RPC de escritura ni supabase.from directo) y tiene 0 filas -- el flujo real de
--    albaranes hoy pasa por almacen_kv (ya aislado por empresa/local, sin gate de rol,
--    y por eso Churrero/a puede seguir operándolo sin verse afectado). Se añade el
--    mismo check que sus tablas hermanas para que, si en el futuro se conecta esta
--    tabla, ya herede el modelo de roles correcto.

drop policy if exists pm14_pagos_encargo_select on public.pagos_encargo;
create policy pm14_pagos_encargo_select on public.pagos_encargo
  for select
  to authenticated
  using (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id));

drop policy if exists pm14_encargos_select on public.encargos_empresa;
create policy pm14_encargos_select on public.encargos_empresa
  for select
  to authenticated
  using (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id));

drop policy if exists pm14_encargos_insert on public.encargos_empresa;
create policy pm14_encargos_insert on public.encargos_empresa
  for insert
  to authenticated
  with check (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id));

drop policy if exists pm14_encargos_update on public.encargos_empresa;
create policy pm14_encargos_update on public.encargos_empresa
  for update
  to authenticated
  using (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id))
  with check (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id));

drop policy if exists pm06_albaranes_insert on public.albaranes_empresa;
create policy pm06_albaranes_insert on public.albaranes_empresa
  for insert
  to authenticated
  with check (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id) and private.pm06_puede_gestionar_finanzas());

drop policy if exists pm06_albaranes_update on public.albaranes_empresa;
create policy pm06_albaranes_update on public.albaranes_empresa
  for update
  to authenticated
  using (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id) and private.pm06_puede_gestionar_finanzas())
  with check (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id) and private.pm06_puede_gestionar_finanzas());

drop policy if exists pm06_albaranes_delete on public.albaranes_empresa;
create policy pm06_albaranes_delete on public.albaranes_empresa
  for delete
  to authenticated
  using (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id) and private.pm06_puede_gestionar_finanzas());
