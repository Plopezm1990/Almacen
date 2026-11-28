-- 01 · DERIVA de las funciones que parchean las migraciones · SOLO LECTURA
--
-- Qué hace: para cada función cuya definición VIVA parchean las migraciones del cierre de #225/#226, cuenta cuántas veces aparece en la base de datos
-- el texto que la migración espera encontrar («antes») y el que deja puesto («despues»), y lo clasifica:
--
--   YA_APLICADA        despues >= 1              → ya lleva el texto que deja el parche (es lo que se ve en QA). Ojo: el parche conserva su ancla, así que «antes» puede seguir en 1.
--   LISTA_PARA_MIGRAR  despues = 0 y antes = 1   → la migración encontrará su ancla exactamente una vez y la parcheará.
--   DERIVA             despues = 0 y antes <> 1  → la función difiere de la de QA: la migración fallaría en voz alta (ESTRUCTURA_NO_ENCONTRADA /
--                                                  GUARDA_NO_ENCONTRADA). HAY QUE REVISARLA ANTES DE MIGRAR.
--   FALTA_FUNCION      la función no existe.
--
-- Cómo usarlo: ejecútalo con un rol de solo lectura contra (a) la COPIA con el esquema de producción y, si decides hacerlo tú y lo autorizas, (b) producción.
-- Pega el resultado completo. No modifica nada: es un único SELECT dentro de una transacción de solo lectura.
-- Resultado esperado en producción ANTES de migrar: todas LISTA_PARA_MIGRAR (si alguna sale YA_APLICADA, comprueba que de verdad lo está: el texto buscado es el que inserta la migración). Cualquier DERIVA o FALTA_FUNCION es un bloqueo.

begin read only;

with p(esquema, nombre, comprobacion, patron_antes, patron_despues) as (
  values
  ('public',  'abc_c07d_emitir_checkout',               'guarda de emisión',
     'not\s+private\.abc_tiene_capacidad\(\s*p_empresa_id\s*,\s*p_local_id\s*,\s*''ABC_EMISOR_CAMBIAR''\s*\)', 'or\s+private\.abc_tiene_capacidad\(\s*p_empresa_id\s*,\s*p_local_id\s*,\s*''ABC_COBRO_INICIAR''\s*\)'),
  ('public',  'abc_c07d_emitir_checkout',               'marca de la transacción',
     'raise\s+exception\s+''abc_documento_no_autorizado''\s*;\s*end\s+if\s*;', 'app\.c07d_emision_cobro'),
  ('public',  'abc_c07d_estado_configuracion_emision',  'guarda de lectura del estado',
     'not\s+private\.abc_tiene_capacidad\(\s*p_empresa_id\s*,\s*p_local_id\s*,\s*''ABC_EMISOR_CAMBIAR''\s*\)', 'or\s+private\.abc_tiene_capacidad\(\s*p_empresa_id\s*,\s*p_local_id\s*,\s*''ABC_COBRO_INICIAR''\s*\)'),
  ('public',  'abc_reservar_numero_documental',         'primitivo de numeración',
     'not\s+private\.abc_tiene_capacidad\(\s*p_empresa_id\s*,\s*p_local_id\s*,\s*''ABC_EMISOR_CAMBIAR''\s*\)', 'abc_emision_cobro_interna'),
  ('public',  'abc_resolver_emision_documental',        'primitivo de resolución',
     'not\s+private\.abc_tiene_capacidad\(\s*p_empresa_id\s*,\s*p_local_id\s*,\s*''ABC_EMISOR_CAMBIAR''\s*\)', 'abc_emision_cobro_interna'),
  ('public',  'abc_c07d_registrar_documento_fiscal',    'primitivo de registro',
     'not\s+private\.abc_tiene_capacidad\(\s*p_empresa_id\s*,\s*p_local_id\s*,\s*''ABC_EMISOR_CAMBIAR''\s*\)', 'abc_emision_cobro_interna'),
  ('private', 'abc_c04_bloqueos_cierre',                'subconsulta de bloqueos del cierre',
     '\)\s*x\s*;', 'VENTAS_SIN_DOCUMENTO'),
  ('public',  'abc_ensayar_cierre_sesion_caja',         'clasificación BLOQUEADO',
     'or\s+v_blockers\s*\?\s*''SESION_NO_REVISABLE''', 'VENTAS_SIN_DOCUMENTO'),
  ('public',  'abc_cancelar_pedido',                    'cancelar pedido: ancla de H-21',
     'v_canceladas\s+integer\s*;', 'CUENTA_CERRADA_SIN_PEDIDOS'),
  ('private', 'abc_transicionar_linea_operativa',       'guarda de capacidad de la transición',
     'not\s+private\.abc_tiene_capacidad\(\s*p_empresa_id\s*,\s*p_local_id\s*,\s*v_capacidad\s*\)', 'abc_venta_rapida_interna'),
  ('public',  'abc_cerrar_cuenta_pagada',               'pagos que bloquean el cierre',
     'p\.estado\s+not\s+in\s*\(\s*''CONFIRMADO''\s*,\s*''REEMBOLSADO''\s*\)', '''RECHAZADO''\s*,\s*''CANCELADO''\s*\)'),
  ('public',  'pm11_finalizar_creacion_cuenta_empleado','alta de empleado: ancla del identificador de auditoría',
     'v_audit_id\s*:=\s*gen_random_uuid\(\)::text;', 'plataforma_marcar_password_pendiente')
), d as (
  select p.*, f.oid as foid, case when f.oid is null then null else pg_get_functiondef(f.oid) end as def
    from p
    left join pg_namespace n on n.nspname = p.esquema
    left join pg_proc f on f.pronamespace = n.oid and f.proname = p.nombre and f.prokind = 'f'
), c as (
  select esquema, nombre, comprobacion, foid,
         case when def is null then null else (select count(*) from regexp_matches(def, patron_antes, 'g')) end as antes,
         case when def is null then null else (select count(*) from regexp_matches(def, patron_despues, 'g')) end as despues,
         case when def is null then null else md5(def) end as md5_definicion
    from d
)
select esquema || '.' || nombre as funcion,
       comprobacion,
       antes,
       despues,
       case when foid is null                 then 'FALTA_FUNCION'
            when despues >= 1                 then 'YA_APLICADA'
            when antes = 1                    then 'LISTA_PARA_MIGRAR'
            else 'DERIVA' end as estado,
       md5_definicion
  from c
 order by 5 desc, 1, 2;

rollback;
