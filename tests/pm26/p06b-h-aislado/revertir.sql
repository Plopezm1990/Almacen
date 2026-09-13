-- Reversion exacta de la migracion PM26 P06b-H, para verificar en el
-- entorno aislado que el estado vuelve a ser byte a byte el original.
drop index if exists public.idx_auditoria_registro_actor_user_id;
drop index if exists public.idx_movimientos_stock_operation_id;
drop index if exists public.idx_pagos_encargo_revierte_pago_id;
drop index if exists public.idx_suscripciones_push_user_id;

alter policy qa_perfil_propio_select
  on public.perfiles
  using (user_id = auth.uid());

alter policy qa_perfil_propio_update
  on public.perfiles
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter policy qa_push_propio
  on public.suscripciones_push
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter policy membresia_propia_select
  on public.membresias_usuario
  using (
    (user_id = auth.uid())
    and (activo = true)
    and private.la_usuario_activo()
  );
