-- 04 · ESTADO DE LAS 20 MIGRACIONES NUEVAS · SOLO LECTURA
--
-- Para cada migración nueva de #225/#226 dice (a) si está registrada en el historial (`supabase_migrations.schema_migrations`) por NOMBRE y (b) si su objeto principal EXISTE.
-- Se mira por nombre y por objeto porque en QA varias se aplicaron con otra marca de tiempo de historial (o por el editor SQL, sin historial): la verdad es el objeto, no el número.
-- (b) sirve también para las migraciones que solo parchean funciones: ahí el estado fino lo da el informe 01.
--
--   estado = APLICADA              historial y objeto
--   estado = SOLO_OBJETO           el objeto existe pero no consta en el historial (aplicada fuera del historial: hay que registrarla o reconciliar antes de `db push`)
--   estado = SOLO_HISTORIAL        consta en el historial pero falta el objeto (anómalo: investigar)
--   estado = PENDIENTE             ni historial ni objeto: es la que hay que aplicar
--
-- No modifica nada. Ejecútalo con un rol de solo lectura.

begin read only;

with m(orden, version_repo, nombre, objeto_esquema, objeto_nombre, objeto_tipo) as (
  values
  ( 1, '20261024070000', 't6_propina_efectivo',                                   'public',  'abc_registrar_propina_efectivo',        'f'),
  ( 2, '20261113090000', 'rediseno_apariencia_empresa',                           'public',  'abc_apariencia_leer',                   'f'),
  ( 3, '20261113140000', 'rediseno_apariencia_delegaciones',                      'public',  'abc_apariencia_delegar',                'f'),
  ( 4, '20261115120000', 'mfa_politica_opcional',                                 'private', 'mfa_politica',                          'r'),
  ( 5, '20261116171854', 'salida_stock_manual',                                   'public',  'registrar_salida_stock',                'f'),
  ( 6, '20261120120000', 'rediseno_org33_tarifas_horario',                        'public',  'abc_guardar_tarifa_horario',            'f'),
  ( 7, '20261126120000', 'abc_f7_c07d_emision_por_capacidad_de_cobro',            'public',  'abc_c07d_emitir_checkout',              'f'),
  ( 8, '20261126130000', 'abc_f7_c07d_emision_cobro_acceso_interno',              'private', 'abc_emision_cobro_interna',             'f'),
  ( 9, '20261126140000', 'abc_f5_c04_bloqueo_ventas_sin_documento',               'private', 'abc_c04_bloqueos_cierre',               'f'),
  (10, '20261126150000', 'abc_f5_c04_listar_ventas_sin_documento',                'public',  'abc_c04_listar_ventas_sin_documento',   'f'),
  (11, '20261127100000', 'abc_f5_cancelar_pedido_cierra_cuenta_vacia',            'public',  'abc_cancelar_pedido',                   'f'),
  (12, '20261127110000', 'abc_f5_venta_rapida_completar_por_cobro',               'public',  'abc_completar_venta_rapida',            'f'),
  (13, '20261127120000', 'abc_f4_cerrar_cuenta_ignora_pagos_rechazados',          'public',  'abc_cerrar_cuenta_pagada',              'f'),
  (14, '20261128100000', 'abc_f6_encargos_solo_funciones_y_privilegios',          'public',  'encargos_empresa',                      'r'),
  (15, '20261128110000', 'abc_f6_cuenta_empleado_password_inicial_pendiente',     'public',  'pm11_finalizar_creacion_cuenta_empleado','f'),
  (16, '20261128120000', 'abc_f6_empresa_nueva_con_politica_mfa_propietario',     'private', 'mfa_sembrar_politica_empresa_nueva',    'f'),
  (17, '20261128130000', 'abc_f6_cancelar_pedido_cancela_cobro_sin_dinero',       'public',  'abc_cancelar_pedido',                   'f'),
  (18, '20261128140000', 'abc_f6_cerrar_cuentas_sin_actividad',                   'public',  'abc_cerrar_cuentas_sin_actividad',      'f'),
  (19, '20261128150000', 'abc_f6_repartos_de_lineas_canceladas_no_retienen_cuenta','public', 'abc_cerrar_cuentas_sin_actividad',      'f'),
  (20, '20261128160000', 'abc_f6_reembolsos_por_venta',                           'public',  'abc_reembolsos_por_venta',              'f')
), e as (
  select m.*,
         exists (select 1 from supabase_migrations.schema_migrations h where h.name = m.nombre)            as en_historial,
         case m.objeto_tipo
           when 'f' then exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                  where n.nspname = m.objeto_esquema and p.proname = m.objeto_nombre)
           else           exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                                  where n.nspname = m.objeto_esquema and c.relname = m.objeto_nombre)
         end                                                                                                as objeto_existe
    from m
)
select orden, version_repo, nombre,
       en_historial, objeto_existe,
       case when en_historial and objeto_existe     then 'APLICADA'
            when objeto_existe                      then 'SOLO_OBJETO'
            when en_historial                       then 'SOLO_HISTORIAL'
            else 'PENDIENTE' end as estado,
       (select string_agg(h.version, ', ' order by h.version) from supabase_migrations.schema_migrations h where h.name = e.nombre) as versiones_en_historial
  from e
 order by orden;

-- Nota: las migraciones 11, 17 y 19 parchean funciones que ya existen (cancelar pedido; cerrar cuentas): «objeto_existe» solo prueba que la función está; el informe 01 dice si el parche está.
-- Nota: la 14 es de privilegios sobre tablas que ya existen: el estado real se ve con la consulta siguiente.
-- Privilegios que la migración 14 debe haber quitado (TRUNCATE/REFERENCES/TRIGGER a anon y authenticated en public, y escritura sobre encargos): deben salir 0 filas DESPUÉS de migrar.
select grantee, table_name, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon', 'authenticated')
   and (privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
        or (table_name in ('encargos_empresa', 'pagos_encargo') and privilege_type in ('INSERT', 'UPDATE', 'DELETE')))
 order by table_name, grantee, privilege_type;

rollback;
