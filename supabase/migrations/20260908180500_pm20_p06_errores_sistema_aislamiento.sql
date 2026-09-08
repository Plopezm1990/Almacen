-- PM20 P06: errores_sistema no tenía aislamiento por empresa (cualquier usuario
-- autenticado podía leer el historial de errores de TODAS las empresas -- política
-- previa qa_errores_authenticated: USING (true), WITH CHECK (true) para todos los
-- comandos). Se añade empresa_id/local_id y se reemplaza la política permisiva por el
-- mismo patrón ya establecido en auditoria_registro/clientes_empresa/proveedores_empresa.

alter table public.errores_sistema
  add column if not exists empresa_id text,
  add column if not exists local_id text;

drop policy if exists qa_errores_authenticated on public.errores_sistema;

create policy errores_sistema_select on public.errores_sistema
  for select
  to authenticated
  using (
    private.la_usuario_activo()
    and empresa_id is not null
    and private.la_tiene_empresa(empresa_id)
    and private.la_rol() = 'Propietario'
  );

create policy errores_sistema_insert on public.errores_sistema
  for insert
  to authenticated
  with check (
    empresa_id is null or private.la_tiene_empresa(empresa_id)
  );
