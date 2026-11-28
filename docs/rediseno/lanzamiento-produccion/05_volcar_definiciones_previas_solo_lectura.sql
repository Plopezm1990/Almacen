-- 05 · VOLCADO DE LAS DEFINICIONES PREVIAS A MIGRAR · SOLO LECTURA
--
-- Para qué sirve: las migraciones de clase B (docs/rediseno/lanzamiento-produccion/README.md) parchean la definición VIVA de funciones. No hay migración inversa: la vuelta atrás de
-- cada una es volver a crear la función con su definición ANTERIOR. Esa definición solo existe en la base de datos hasta que se migra, así que hay que guardarla ANTES.
--
-- Cómo usarlo: ejecútalo en producción (o en la copia) justo antes de migrar, guarda el resultado completo (columna `definicion`) en archivos con el nombre de la columna `funcion`
-- y súbelos al registro de lanzamiento. Para volver atrás, ejecuta cada `definicion` tal cual (ya es un CREATE OR REPLACE FUNCTION; conserva propietario y permisos).
--
-- No modifica nada. Ejecútalo con un rol de solo lectura.

begin read only;

select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as funcion,
       md5(pg_get_functiondef(p.oid))                                                           as md5,
       pg_get_functiondef(p.oid)                                                                as definicion
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where p.prokind = 'f'
   and (n.nspname, p.proname) in (
         ('public',  'abc_c07d_emitir_checkout'),
         ('public',  'abc_c07d_estado_configuracion_emision'),
         ('public',  'abc_preparar_ticket_fiscal_qa'),
         ('public',  'abc_reservar_numero_documental'),
         ('public',  'abc_resolver_emision_documental'),
         ('public',  'abc_c07d_registrar_documento_fiscal'),
         ('private', 'abc_c04_bloqueos_cierre'),
         ('public',  'abc_ensayar_cierre_sesion_caja'),
         ('public',  'abc_cancelar_pedido'),
         ('private', 'abc_transicionar_linea_operativa'),
         ('public',  'abc_cerrar_cuenta_pagada'),
         ('public',  'pm11_finalizar_creacion_cuenta_empleado'),
         ('private', 'la_usuario_activo')
       )
 order by 1;

-- Estado de los privilegios y políticas que cambia la migración 20261128100000 (para poder restaurarlos si el cliente antiguo tuviera que volver):
select 'privilegio' as tipo, grantee || ' ' || privilege_type || ' sobre ' || table_name as detalle
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name in ('encargos_empresa', 'pagos_encargo', 'stock_estado')
   and grantee in ('anon', 'authenticated', 'PUBLIC')
union all
select 'politica', tablename || ' · ' || policyname || ' · ' || cmd
  from pg_policies
 where schemaname = 'public' and tablename in ('encargos_empresa', 'pagos_encargo')
 order by 1, 2;

rollback;
