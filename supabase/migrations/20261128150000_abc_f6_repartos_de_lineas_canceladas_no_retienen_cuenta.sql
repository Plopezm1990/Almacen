-- H-50 (hallado al probar H-47 en QA, 27/11/2026): un reparto «ACTIVO» sobre una línea ya CANCELADA retenía la cuenta abierta para siempre.
--
-- Caso real: se reparte un producto de la cuenta B a la cuenta A, se devuelve con «Deshacer reparto» (H-47) y se cancela el pedido de B. La línea queda CANCELADA pero su fila de
-- `cuenta_linea_repartos` sigue ACTIVA. Resultado: public.abc_cancelar_pedido (H-21) no cerraba la cuenta, y public.abc_cerrar_cuentas_sin_actividad (H-28) la trataba como «reparto vivo»
-- y la omitía. Una línea cancelada no tiene importe (el total comercial de la cuenta ya la excluye): su reparto no debe contar como dinero en juego.
--
-- Corrección: en las dos funciones, un reparto solo cuenta como vivo si su línea NO está CANCELADA. Todo lo demás se deja igual (cuotas por importe, repartos de líneas vivas, etc.).
--
-- Cómo se aplica: se parchea la definición VIVA de cada función (sin arrastrar deriva entre el repositorio y lo desplegado); es idempotente (marca «H-50») y falla en voz alta si la forma
-- esperada no está (FUNCION_OBLIGATORIA_NO_ENCONTRADA / ESTRUCTURA_NO_ENCONTRADA / POSTCONDICION_FALLIDA).
--
-- Contrato: tests/rediseno/h50-repartos-de-lineas-canceladas-pglite-contract.mjs

do $migracion$
declare
  v_oid oid;
  v_def text;
  v_nuevo text;
  v_n integer;
  v_funcion text;
  v_patron text;
  v_reemplazo text;
  v_lista text[][] := array[
    -- abc_cancelar_pedido (cierra la cuenta al cancelar el último pedido vivo)
    array[
      'abc_cancelar_pedido',
      'r\.estado not in \(''CERRADO'',''CANCELADO'',''CANCELADA''\)\s+and \(r\.cuenta_id=v_pedido\.cuenta_id',
      'r.estado not in (''CERRADO'',''CANCELADO'',''CANCELADA'')' || chr(10)
        || '          -- H-50: un reparto sobre una linea cancelada no es dinero en juego.' || chr(10)
        || '          and not exists(select 1 from public.pedido_lineas lc' || chr(10)
        || '                          where lc.empresa_id=r.empresa_id and lc.local_id=r.local_id' || chr(10)
        || '                            and lc.id=r.source_line_id and lc.estado=''CANCELADA'')' || chr(10)
        || '          and (r.cuenta_id=v_pedido.cuenta_id'
    ],
    -- abc_cerrar_cuentas_sin_actividad (H-28 / H-29)
    array[
      'abc_cerrar_cuentas_sin_actividad',
      'r\.estado not in \(''CERRADO'', ''CANCELADO'', ''CANCELADA''\)\s+and \(r\.cuenta_id = v_cuenta\.id',
      'r.estado not in (''CERRADO'', ''CANCELADO'', ''CANCELADA'')' || chr(10)
        || '         -- H-50: un reparto sobre una linea cancelada no es dinero en juego.' || chr(10)
        || '         and not exists (select 1 from public.pedido_lineas lc' || chr(10)
        || '                          where lc.empresa_id = r.empresa_id and lc.local_id = r.local_id' || chr(10)
        || '                            and lc.id = r.source_line_id and lc.estado = ''CANCELADA'')' || chr(10)
        || '         and (r.cuenta_id = v_cuenta.id'
    ]
  ];
  i integer;
begin
  for i in 1 .. array_length(v_lista, 1) loop
    v_funcion := v_lista[i][1];
    v_patron := v_lista[i][2];
    v_reemplazo := v_lista[i][3];

    select p.oid into v_oid
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_funcion and p.prokind = 'f';
    if v_oid is null then
      raise exception 'FUNCION_OBLIGATORIA_NO_ENCONTRADA: public.%', v_funcion;
    end if;
    v_def := pg_get_functiondef(v_oid);

    if position('H-50' in v_def) > 0 then
      raise notice 'H-50: % ya aplicada', v_funcion;
      continue;
    end if;

    select count(*) into v_n from regexp_matches(v_def, v_patron, 'g');
    if v_n <> 1 then
      raise exception 'ESTRUCTURA_NO_ENCONTRADA: % no tiene exactamente una coincidencia del control de repartos (hay %)', v_oid::regprocedure, v_n;
    end if;

    v_nuevo := regexp_replace(v_def, v_patron, replace(v_reemplazo, '\', '\\'), 'g');
    execute v_nuevo;

    if position('H-50' in pg_get_functiondef(v_oid)) = 0 then
      raise exception 'POSTCONDICION_FALLIDA: % no recoge la correccion H-50', v_funcion;
    end if;
    raise notice 'H-50: % aplicada', v_funcion;
  end loop;
end
$migracion$;
