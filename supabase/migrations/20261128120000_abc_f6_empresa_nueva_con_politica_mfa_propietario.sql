-- Hallazgo H-17 (auditoría del TPV; pendiente anotado el 25/11/2026).
-- Decisión del usuario (25/11): segundo factor obligatorio SOLO para Propietario. La migración 20261115120000 pasó la
-- exigencia a la tabla private.mfa_politica, donde «sin fila = no se exige». En QA se creó la fila de Propietario de las 12
-- empresas existentes, pero una empresa nueva no recibía ninguna: nacía sin segundo factor para su Propietario hasta que
-- alguien la configurara a mano. Tres funciones crean empresas (bootstrap_owner_instalacion, plataforma_crear_empresa y
-- guardar_contexto_instalacion_ui), y mañana puede haber otra.
--
-- Corrección: un disparador AFTER INSERT sobre public.empresas siembra la fila (empresa, 'Propietario', exigida = true).
-- Así cubre cualquier camino de alta, presente o futuro, y en la misma transacción que la empresa.
--   * `on conflict do nothing`: nunca pisa una política que ya exista (p. ej. una que el Propietario dejó en no exigida).
--   * NO rellena las empresas que ya existen: cambiar la exigencia de segundo factor de empresas en uso es una decisión
--     por empresa y por entorno, no un efecto secundario de una migración.
--
-- Contrato: tests/rediseno/h17-empresa-nueva-politica-mfa-pglite-contract.mjs

do $preflight$
begin
  if to_regclass('private.mfa_politica') is null then
    raise exception 'DEPENDENCIA_OBLIGATORIA_NO_ENCONTRADA: private.mfa_politica (migración 20261115120000)';
  end if;
  if to_regclass('public.empresas') is null then
    raise exception 'TABLA_OBLIGATORIA_NO_ENCONTRADA: public.empresas';
  end if;
end
$preflight$;

create or replace function private.mfa_sembrar_politica_empresa_nueva()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into private.mfa_politica (empresa_id, rol, exigida)
  values (new.id::text, 'Propietario', true)
  on conflict (empresa_id, rol) do nothing;
  return new;
end;
$function$;

revoke all on function private.mfa_sembrar_politica_empresa_nueva() from public, anon, authenticated;

drop trigger if exists mfa_politica_empresa_nueva_trg on public.empresas;
create trigger mfa_politica_empresa_nueva_trg
after insert on public.empresas
for each row execute function private.mfa_sembrar_politica_empresa_nueva();

do $postflight$
begin
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.empresas'::regclass and tgname = 'mfa_politica_empresa_nueva_trg' and not tgisinternal
  ) then
    raise exception 'POSTCONDICION_FALLIDA: falta el disparador mfa_politica_empresa_nueva_trg';
  end if;
  if has_function_privilege('authenticated', 'private.mfa_sembrar_politica_empresa_nueva()', 'EXECUTE')
     or has_function_privilege('anon', 'private.mfa_sembrar_politica_empresa_nueva()', 'EXECUTE') then
    raise exception 'POSTCONDICION_FALLIDA: la función del disparador no debe ser ejecutable por authenticated ni anon';
  end if;
end
$postflight$;
