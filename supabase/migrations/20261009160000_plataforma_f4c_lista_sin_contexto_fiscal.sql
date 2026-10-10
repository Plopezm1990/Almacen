-- PLATAFORMA F4c — la lista de productos se guarda aunque el local aún no tenga contexto fiscal.
--
-- Problema que resuelve
--   Con P3c, abc_productos_guardar_lista guarda la lista `productos` y el catálogo del TPV en UNA
--   transacción. El catálogo (abc_catalogo_guardar_productos) exige, antes de mirar ningún producto,
--   que el local tenga contexto fiscal (entidad fiscal + vínculo con el local + moneda). Una empresa
--   dada de alta por la plataforma no lo tiene, y no hay pantalla para crearlo: el error
--   `catalogo_contexto_fiscal_ausente` abortaba TODA la transacción, también la lista, y el cliente
--   dejaba el producto solo en el equipo con un «Subiendo 1…» que no terminaba.
--
-- Qué hace
--   Si, y solo si, la llamada al catálogo falla con `catalogo_contexto_fiscal_ausente`, se salta el
--   catálogo de ese grupo (empresa+local) y se conserva la lista. La respuesta lo dice:
--   `catalogo_ya_sincronizado = false` y `catalogo_pendiente_contexto_fiscal = true`, de modo que el
--   cliente sigue su camino anterior (intenta el catálogo por separado, recibe el mismo aviso
--   «el local no tiene contexto fiscal configurado» y no reintenta sin fin). Cualquier otro error
--   (permiso, producto inválido, contexto fiscal ambiguo...) sigue abortando la transacción entera.
--   Las empresas con contexto fiscal no notan ningún cambio.
--
-- Cómo: sustitución de texto comprobada sobre la función existente (cada fragmento debe aparecer
-- exactamente una vez; si la función existe y no coincide, la migración se aborta; si no existe, no
-- se hace nada). Debe aplicarse DESPUÉS de P3c (abc_p3c_lista_confirmada) y de F4.
--
-- Este archivo NO se aplica automáticamente a producción desde esta rama.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $f4c$
declare
  v_oid oid;
  v_def text;
  v_nuevo text;
  v_de text[];
  v_a text[];
  v_n integer;
  i integer;
begin
  v_oid := to_regprocedure('public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb)');
  if v_oid is null then
    return;
  end if;
  v_def := pg_get_functiondef(v_oid);
  if position('v_sin_fiscal' in v_def) > 0 then
    return; -- ya aplicada
  end if;

  v_de := array[
    $x$v_rpc jsonb;$x$,
    $x$      v_rpc:=public.abc_catalogo_guardar_productos(
        p_operation_id||'.'||v_grupo_n,v_grupo.empresa_id,
        v_grupo.local_id,'EUR',v_grupo.productos
      );$x$,
    $x$'catalogo_ya_sincronizado',true,$x$
  ];
  v_a := array[
    $x$v_rpc jsonb;
  v_sin_fiscal boolean:=false;$x$,
    $x$      begin
        v_rpc:=public.abc_catalogo_guardar_productos(
          p_operation_id||'.'||v_grupo_n,v_grupo.empresa_id,
          v_grupo.local_id,'EUR',v_grupo.productos
        );
      exception when raise_exception then
        -- Sin contexto fiscal el catálogo del TPV aún no se puede guardar; la lista sí.
        if sqlerrm='catalogo_contexto_fiscal_ausente' then
          v_sin_fiscal:=true;
          continue;
        end if;
        raise;
      end;$x$,
    $x$'catalogo_ya_sincronizado',not v_sin_fiscal,
    'catalogo_pendiente_contexto_fiscal',v_sin_fiscal,$x$
  ];

  v_nuevo := v_def;
  for i in 1 .. array_length(v_de, 1) loop
    v_n := (length(v_nuevo) - length(replace(v_nuevo, v_de[i], ''))) / length(v_de[i]);
    if v_n <> 1 then
      raise exception 'PLATAFORMA_F4C_PARCHE_NO_APLICABLE:abc_productos_guardar_lista:%:%', i, v_n;
    end if;
    v_nuevo := replace(v_nuevo, v_de[i], v_a[i]);
  end loop;
  execute v_nuevo;
end
$f4c$;

do $f4c$
declare
  v_oid oid := to_regprocedure('public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb)');
begin
  if v_oid is not null
     and position('catalogo_pendiente_contexto_fiscal' in pg_get_functiondef(v_oid)) = 0 then
    raise exception 'PLATAFORMA_F4C_FINAL:funcion_sin_parche';
  end if;
end
$f4c$;

commit;
