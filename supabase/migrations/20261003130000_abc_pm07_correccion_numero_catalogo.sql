-- PM-07 · corrección de la expresión regular de private.pm07_numero_catalogo (solo para producción; en QA ya está correcta).
--
-- Hallazgo (foto de solo lectura de producción, 3/10/2026, `F7_PROMOCION_PRODUCCION_FOTO_RESULTADO_2026-10-03.md`): en producción la función
-- tiene la expresión regular '^[0-9]+(.[0-9]+)?$' (SIN la barra invertida) y el archivo de PM07 y QA tienen '^[0-9]+(\.[0-9]+)?$'. Con el punto sin
-- escapar, cualquier carácter vale como separador decimal: un valor como '1,5' pasa la comprobación y el `::numeric` posterior lanza un error
-- (22P02) en lugar de devolver el valor por defecto. La usa el disparador pm07_bootstrap_stock_desde_productos_kv (al guardar la lista de
-- productos). Con valores normales ('12', '12.5') no cambia nada.
--
-- Qué hace: reemplaza SOLO esa función por la versión del archivo de PM07 (misma firma, misma volatilidad, mismo search_path, mismo cuerpo salvo
-- la barra invertida). No toca ninguna tabla, ni el disparador, ni la otra función de PM07 (private.pm07_inicializar_stock_desde_productos_kv: la de
-- producción solo difiere de la del archivo en comentarios y espacios, no en lógica), ni permisos (create or replace conserva los que tenga).
--
-- Seguridad: se niega a aplicarse si la función no existe o si su cuerpo no es exactamente uno de los dos conocidos: el borrador de producción
-- (md5 3dcbe27249f1fd2d37c40ea6398d0215) o la versión correcta (7f36af3c791b2d94a2c76aed2ee4a095, en cuyo caso es una repetición sin efecto).
-- Idempotente. No se aplica en producción sin autorización expresa de Pedro (ver el documento de preparación F7).

set local lock_timeout = '10s';

do $$
declare
  v_oid regprocedure;
  v_h text;
begin
  v_oid := to_regprocedure('private.pm07_numero_catalogo(text,numeric)');
  if v_oid is null then
    raise exception 'ABC_PM07_FIX_PREFLIGHT_FALLO:funcion_ausente:pm07_numero_catalogo';
  end if;
  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid=v_oid;
  if v_h is distinct from '3dcbe27249f1fd2d37c40ea6398d0215'
     and v_h is distinct from '7f36af3c791b2d94a2c76aed2ee4a095' then
    raise exception 'ABC_PM07_FIX_PREFLIGHT_FALLO:funcion_distinta:pm07_numero_catalogo:%',v_h;
  end if;
end $$;

create or replace function private.pm07_numero_catalogo(p_valor text, p_defecto numeric default 0)
returns numeric
language plpgsql
immutable
set search_path='pg_catalog','pg_temp'
as $$
begin
  if coalesce(btrim(p_valor),'') ~ '^[0-9]+(\.[0-9]+)?$' then
    return greatest(0, p_valor::numeric);
  end if;
  return greatest(0, coalesce(p_defecto,0));
end;
$$;
