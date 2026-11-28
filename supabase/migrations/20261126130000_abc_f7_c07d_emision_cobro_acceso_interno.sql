-- Hallazgo H-38 de la auditoría del TPV (26/11/2026), segunda parte: la emisión
-- del documento fiscal del cobro de un Cajero/a falla DENTRO de la cadena.
--
-- Lo que dejó la primera migración (20261126120000): la entrada
-- `abc_c07d_emitir_checkout` y la lectura del estado ya aceptan a quien puede
-- iniciar un cobro (`ABC_COBRO_INICIAR`). Pero la entrada llama por dentro a tres
-- primitivos de numeración fiscal que vuelven a exigir `ABC_EMISOR_CAMBIAR` al
-- usuario de la sesión, y un Cajero/a sigue recibiendo `abc_documento_no_autorizado`:
--   * public.abc_reservar_numero_documental(...)
--   * public.abc_resolver_emision_documental(...)
--   * public.abc_c07d_registrar_documento_fiscal(...)
--
-- Diseño (los primitivos NO se abren a quien cobra):
--   1. La entrada, tras superar su propia autorización, marca la TRANSACCIÓN en
--      curso con `app.c07d_emision_cobro` = id de la transacción (set_config local).
--   2. `private.abc_emision_cobro_interna()` es verdadera solo si esa marca vale el
--      id de la transacción actual. No sobrevive al commit y un valor falseado
--      (otro id, constante) no la activa.
--   3. Cada primitivo acepta `ABC_EMISOR_CAMBIAR` O la marca interna. Llamado
--      directamente por un Cajero/a (sin pasar por la entrada) sigue rechazando.
--
-- Cómo se aplica: igual que la primera migración, sobre la definición ACTUAL de
-- cada función (`pg_get_functiondef`), idempotente, y falla en voz alta si la
-- guarda esperada no está. Toda la migración es una sola transacción: si un
-- primitivo no se puede parchear, la entrada tampoco queda marcada.
--
-- Contrato: tests/rediseno/c07d-emision-cobro-pglite-contract.mjs

create or replace function private.abc_emision_cobro_interna()
returns boolean
language sql
stable
set search_path = ''
as $fn$
  select coalesce(current_setting('app.c07d_emision_cobro', true), '') = txid_current()::text
$fn$;

revoke all on function private.abc_emision_cobro_interna() from public;

do $migracion$
declare
  v_nombre text;
  v_tipo text;
  v_oid oid;
  v_def text;
  v_nuevo text;
  v_encontradas integer;
  v_aplicadas integer := 0;
  v_patron_entrada constant text :=
    '(raise\s+exception\s+''abc_documento_no_autorizado''\s*;\s*end\s+if\s*;)';
  v_reemplazo_entrada constant text :=
    '\1' || chr(10)
    || '    perform set_config(''app.c07d_emision_cobro'', txid_current()::text, true);';
  v_patron_primitivo constant text :=
    'not\s+private\.abc_tiene_capacidad\(\s*p_empresa_id\s*,\s*p_local_id\s*,\s*''ABC_EMISOR_CAMBIAR''\s*\)';
  v_reemplazo_primitivo constant text :=
    'not (private.abc_tiene_capacidad(p_empresa_id, p_local_id, ''ABC_EMISOR_CAMBIAR'') '
    || 'or private.abc_emision_cobro_interna())';
begin
  -- La entrada va la primera: si un primitivo falla, la transacción entera se deshace.
  for v_nombre, v_tipo in
    values ('abc_c07d_emitir_checkout', 'entrada'),
           ('abc_reservar_numero_documental', 'primitivo'),
           ('abc_resolver_emision_documental', 'primitivo'),
           ('abc_c07d_registrar_documento_fiscal', 'primitivo')
  loop
    v_encontradas := 0;
    for v_oid in
      select p.oid
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname = v_nombre
         and p.prokind = 'f'
    loop
      v_encontradas := v_encontradas + 1;
      v_def := pg_get_functiondef(v_oid);

      if v_tipo = 'entrada' then
        -- Ya aplicada: no se vuelve a tocar.
        if position('app.c07d_emision_cobro' in v_def) > 0 then
          continue;
        end if;
        if (select count(*) from regexp_matches(v_def, v_patron_entrada, 'gi')) <> 1 then
          raise exception 'GUARDA_NO_ENCONTRADA: % no tiene exactamente un bloque de rechazo (abc_documento_no_autorizado) tras el que marcar la transaccion', v_oid::regprocedure;
        end if;
        v_nuevo := regexp_replace(v_def, v_patron_entrada, v_reemplazo_entrada, 'gi');
      else
        if position('abc_emision_cobro_interna' in v_def) > 0 then
          continue;
        end if;
        if (select count(*) from regexp_matches(v_def, v_patron_primitivo, 'g')) <> 1 then
          raise exception 'GUARDA_NO_ENCONTRADA: % no tiene exactamente una guarda de ABC_EMISOR_CAMBIAR que ampliar', v_oid::regprocedure;
        end if;
        v_nuevo := regexp_replace(v_def, v_patron_primitivo, v_reemplazo_primitivo, 'g');
      end if;

      execute v_nuevo;
      v_aplicadas := v_aplicadas + 1;
    end loop;

    if v_encontradas = 0 then
      raise exception 'FUNCION_OBLIGATORIA_NO_ENCONTRADA: public.%', v_nombre;
    end if;
  end loop;

  raise notice 'c07d emision acceso interno: % funcion(es) actualizada(s)', v_aplicadas;
end
$migracion$;
