-- Hallazgos H-04 y H-18 (auditoría del TPV, 25/11/2026; ampliados el 27/11/2026).
--
-- H-04. `encargos_empresa` tenía políticas INSERT y UPDATE para cualquier miembro del local: con su sesión y la clave
--       pública podía crear encargos o cambiar su estado, total o fechas sin las validaciones del servidor. El resto de
--       tablas operativas del TPV solo se escriben mediante funciones SECURITY DEFINER. La interfaz nunca escribe esta
--       tabla directamente: usa `registrar_encargo`, `registrar_pago_encargo` y `revertir_pago_encargo`, que validan
--       permiso de caja, contexto, local operable, importes e idempotencia.
-- H-18. `pagos_encargo` tenía privilegios INSERT/UPDATE/DELETE para `authenticated`; solo la ausencia de políticas de
--       escritura lo protegía. Un privilegio sobrante no debe depender de que nadie añada por error una política.
--
-- Al medir el alcance en QA (27/11/2026) apareció más de lo que decía la auditoría:
--   * `authenticated` tenía además TRUNCATE, REFERENCES y TRIGGER sobre 13 tablas de `public`. TRUNCATE no pasa por RLS.
--     PostgREST no lo expone, pero la protección no puede depender de eso.
--   * la vista `public.stock_estado` tenía privilegios de escritura (la migración 20260915132000 ya exige solo SELECT:
--     es deriva de QA). La vista es `security_invoker`, así que sus escrituras caían en la RLS de `stock_ubicacion`,
--     pero no deben existir.
--
-- Qué hace (idempotente; no toca datos, funciones ni RLS salvo quitar las dos políticas de escritura de encargos):
--   1. Quita INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES y TRIGGER a `authenticated`, `anon` y PUBLIC sobre
--      `encargos_empresa` y `pagos_encargo`, y deja SELECT a `authenticated`.
--   2. Elimina las políticas `pm14_encargos_insert` y `pm14_encargos_update`.
--   3. Quita todo menos SELECT a `anon`, `authenticated` y PUBLIC sobre la vista `stock_estado`.
--   4. Quita TRUNCATE, REFERENCES y TRIGGER a `authenticated` y `anon` sobre todas las tablas de `public`. Ninguna
--      pantalla los necesita; los INSERT/UPDATE/DELETE de las demás tablas (con sus políticas) no se tocan.
--
-- Contrato: tests/rediseno/h04-h18-encargos-solo-funciones-pglite-contract.mjs

do $migracion$
declare
  v_tabla text;
  v_rol text;
  v_mal text;
begin
  -- Precondiciones: lo que hay que proteger existe.
  foreach v_tabla in array array['encargos_empresa', 'pagos_encargo'] loop
    if to_regclass('public.' || v_tabla) is null then
      raise exception 'TABLA_OBLIGATORIA_NO_ENCONTRADA: public.%', v_tabla;
    end if;
  end loop;
  foreach v_tabla in array array['registrar_encargo', 'registrar_pago_encargo', 'revertir_pago_encargo'] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_tabla and p.prosecdef
    ) then
      -- Sin la función de servidor no se puede cerrar la escritura directa: la interfaz se quedaría sin camino.
      raise exception 'FUNCION_OBLIGATORIA_NO_ENCONTRADA: public.% (SECURITY DEFINER)', v_tabla;
    end if;
  end loop;

  -- 1 y 2. Encargos y pagos de encargo: solo lectura para el cliente.
  revoke insert, update, delete, truncate, references, trigger on public.encargos_empresa from public, anon, authenticated;
  revoke insert, update, delete, truncate, references, trigger on public.pagos_encargo from public, anon, authenticated;
  grant select on public.encargos_empresa to authenticated;
  grant select on public.pagos_encargo to authenticated;
  drop policy if exists pm14_encargos_insert on public.encargos_empresa;
  drop policy if exists pm14_encargos_update on public.encargos_empresa;

  -- 3. La vista de stock es de solo lectura.
  if to_regclass('public.stock_estado') is not null then
    revoke insert, update, delete, truncate, references, trigger on public.stock_estado from public, anon, authenticated;
    grant select on public.stock_estado to authenticated;
  end if;

  -- 4. TRUNCATE, REFERENCES y TRIGGER sobran en todas las tablas de la aplicación.
  for v_tabla in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', v_tabla);
  end loop;

  -- Postcondiciones: fallan en voz alta si algo no quedó como se esperaba.
  foreach v_rol in array array['authenticated', 'anon'] loop
    foreach v_tabla in array array['encargos_empresa', 'pagos_encargo'] loop
      foreach v_mal in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
        if has_table_privilege(v_rol, 'public.' || v_tabla, v_mal) then
          raise exception 'POSTCONDICION_FALLIDA: % conserva % sobre public.%', v_rol, v_mal, v_tabla;
        end if;
      end loop;
    end loop;
  end loop;
  if not has_table_privilege('authenticated', 'public.encargos_empresa', 'SELECT')
     or not has_table_privilege('authenticated', 'public.pagos_encargo', 'SELECT') then
    raise exception 'POSTCONDICION_FALLIDA: authenticated debe poder leer encargos y sus pagos';
  end if;
  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'encargos_empresa' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ) then
    raise exception 'POSTCONDICION_FALLIDA: encargos_empresa conserva una política de escritura';
  end if;
  if exists (
    select 1
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      cross join (values ('authenticated'), ('anon')) r(rol)
     where n.nspname = 'public' and c.relkind in ('r', 'p')
       and (has_table_privilege(r.rol, c.oid, 'TRUNCATE')
         or has_table_privilege(r.rol, c.oid, 'REFERENCES')
         or has_table_privilege(r.rol, c.oid, 'TRIGGER'))
  ) then
    raise exception 'POSTCONDICION_FALLIDA: queda alguna tabla de public con TRUNCATE, REFERENCES o TRIGGER para un rol de la aplicación';
  end if;
end
$migracion$;
