-- PM26 P06b -- aviso H (rendimiento, QA): indices de cobertura para las
-- 4 claves foraneas senaladas por el asesor de Supabase, y reescritura
-- de las 4 politicas RLS senaladas por auth_rls_initplan para evaluar
-- auth.uid() una sola vez por consulta en vez de una vez por fila.
--
-- No cambia ninguna garantia de seguridad: cada politica conserva
-- exactamente su tabla, comando, roles, USING y WITH CHECK -- el unico
-- cambio es envolver auth.uid() en (select auth.uid()).
-- No se retira ningun indice existente.
--
-- AVISO -- este archivo NO vive en supabase/migrations a proposito.
-- Las politicas qa_* solo existen en el proyecto QA (produccion tiene,
-- para las mismas tablas, politicas con nombres y alcance distintos, o
-- ninguna) -- aplicar esto contra produccion no tiene sentido y no
-- debe ser posible por accidente. La CLI de Supabase (`migration
-- list`/`db push`) solo descubre archivos dentro de
-- supabase/migrations; al vivir fuera de ahi, ninguna de las dos
-- puede verlo ni aplicarlo jamas, se apunte al proyecto que se apunte.
-- Unico mecanismo de aplicacion sancionado: la herramienta
-- apply_migration de Supabase, invocada manualmente con el project_id
-- de QA explicito, tras autorizacion especifica del usuario para esta
-- migracion concreta -- nunca via `supabase db push`/`migration up`.
-- Ver tests/pm26/p06b-h-aislado/preflight-catalogo.sql, que debe
-- ejecutarse y pasar limpio inmediatamente antes de aplicar esto.

-- 1. Indices de cobertura para las 4 FK sin indice (unindexed_foreign_keys)
create index if not exists idx_auditoria_registro_actor_user_id
  on public.auditoria_registro (actor_user_id);

create index if not exists idx_movimientos_stock_operation_id
  on public.movimientos_stock (operation_id);

create index if not exists idx_pagos_encargo_revierte_pago_id
  on public.pagos_encargo (revierte_pago_id);

create index if not exists idx_suscripciones_push_user_id
  on public.suscripciones_push (user_id);

-- 2. Reescritura de las 4 politicas con auth_rls_initplan
alter policy qa_perfil_propio_select
  on public.perfiles
  using (user_id = (select auth.uid()));

alter policy qa_perfil_propio_update
  on public.perfiles
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy qa_push_propio
  on public.suscripciones_push
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy membresia_propia_select
  on public.membresias_usuario
  using (
    (user_id = (select auth.uid()))
    and (activo = true)
    and private.la_usuario_activo()
  );
