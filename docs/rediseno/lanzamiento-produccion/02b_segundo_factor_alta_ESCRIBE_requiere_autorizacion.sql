-- 02b · SEGUNDO FACTOR (MFA) · ALTA DE LA POLÍTICA «Propietario exige segundo factor» · ESCRIBE DATOS
--
-- ⚠ ESTE SCRIPT MODIFICA DATOS. No lo ejecutes sin la autorización expresa del usuario en ese momento, y solo DESPUÉS de aplicar la migración 20261115120000
-- (que crea `private.mfa_politica`) y de revisar el informe 02. Está pensado para el paso 5 de la ventana de lanzamiento (docs/rediseno/PLAN_CIERRE_PR225_PR226_2026-11-28.md).
-- Claude no lo ejecuta contra producción: lo ejecuta el usuario, o lo ejecuta Claude solo si el usuario lo ordena en ese paso y sobre el proyecto que indique.
--
-- Qué hace: inserta (empresa, 'Propietario', exigida = true) para las empresas de la lista de abajo. `on conflict do nothing`: NUNCA pisa una política que ya exista
-- (por ejemplo, una que un Propietario dejó en «no exigida»). No toca a nadie más: ni Encargado, ni Cajero/a, ni Camarero/a (decisión E6).
--
-- Cómo usarlo:
--   1. Rellena `elegidas` con los identificadores de las empresas de ESE entorno que deben exigir segundo factor al Propietario (sale del informe 02).
--   2. Ejecútalo entero. Está en una transacción con comprobaciones: si algo no cuadra, aborta sin cambiar nada.
--   3. Anota en el registro de avance el resultado (filas insertadas) y comprueba con una cuenta de Propietario real que se le pide el factor.
--
-- Vuelta atrás: `delete from private.mfa_politica where empresa_id = any(<lista>) and rol = 'Propietario' and actualizado_por is null;`
-- (solo borra las filas que este script creó, que quedan con `actualizado_por` nulo).

begin;

do $$
declare
  elegidas text[] := array[
    -- 'empresa-xxxxxxxxxxxxxxxx',
    -- 'empresa-yyyyyyyyyyyyyyyy'
  ]::text[];
  v_faltan text[];
  v_antes integer;
  v_despues integer;
begin
  if to_regclass('private.mfa_politica') is null then
    raise exception 'ABORTA: private.mfa_politica no existe (¿falta la migración 20261115120000?)';
  end if;
  if coalesce(array_length(elegidas, 1), 0) = 0 then
    raise exception 'ABORTA: la lista de empresas está vacía; rellénala antes de ejecutar';
  end if;

  select array_agg(x) into v_faltan
    from unnest(elegidas) x
   where not exists (select 1 from public.empresas e where e.id = x);
  if v_faltan is not null then
    raise exception 'ABORTA: estas empresas no existen en este entorno: %', v_faltan;
  end if;

  select count(*) into v_antes from private.mfa_politica where rol = 'Propietario';

  insert into private.mfa_politica (empresa_id, rol, exigida)
  select x, 'Propietario', true from unnest(elegidas) x
  on conflict (empresa_id, rol) do nothing;

  select count(*) into v_despues from private.mfa_politica where rol = 'Propietario';
  raise notice 'Politica de segundo factor del Propietario: % fila(s) nueva(s) (antes %, ahora %)', v_despues - v_antes, v_antes, v_despues;

  if exists (select 1 from unnest(elegidas) x
              where not exists (select 1 from private.mfa_politica p where p.empresa_id = x and p.rol = 'Propietario')) then
    raise exception 'ABORTA: alguna empresa elegida no quedó con política de Propietario';
  end if;
end
$$;

-- Si todo salió bien y el aviso de arriba es el esperado, confirma; si no, haz ROLLBACK.
commit;
