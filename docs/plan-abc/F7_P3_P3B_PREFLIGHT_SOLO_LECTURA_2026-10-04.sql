-- F7 P3/P3b · comprobación previa de SOLO LECTURA.
-- No ejecutar en producción sin permiso específico de Pedro para esta lectura.
-- No devuelve contenido de productos, clientes, sesiones ni copias de seguridad.
-- Ejecutar cada bloque por separado y parar si falta una dependencia o P3/P3b ya existen.

-- P0 · Las dos migraciones deben faltar por NOMBRE, no por versión del registro.
with esperadas(nombre) as (
  values ('abc_p3_catalogo_autoritativo'), ('abc_p3b_espejo_lista_nube')
)
select e.nombre, count(m.name) as filas_registradas
from esperadas e
left join supabase_migrations.schema_migrations m
  on m.name=e.nombre or m.name like '%_' || e.nombre
group by e.nombre
order by e.nombre;

-- P1 · Dependencias exactas del preflight de P3.
with objetos(tipo, firma) as (
  values
    ('tabla','public.catalogo_tpv_productos'),
    ('tabla','public.catalogo_tpv_opciones'),
    ('tabla','public.stock_ubicacion'),
    ('tabla','public.entidad_fiscal_locales'),
    ('tabla','public.entidad_fiscal_local_monedas'),
    ('tabla','public.entidades_fiscales'),
    ('tabla','public.membresias_usuario'),
    ('funcion','private.abc_calcular_linea_tpv(text,text,text,text,numeric)'),
    ('funcion','private.abc_calcular_linea_tpv_configurada(text,text,text,text,numeric,bigint,jsonb)'),
    ('funcion','private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)'),
    ('funcion','private.abc_operacion_completar(text,jsonb)'),
    ('funcion','private.la_tiene_local(text,text)'),
    ('funcion','auth.uid()')
)
select tipo, firma,
  case when tipo='tabla' then to_regclass(firma) is not null
       else to_regprocedure(firma) is not null end as existe
from objetos
order by tipo, firma;

-- P2 · Los objetos nuevos de P3 deben faltar; P3b necesita las columnas de almacen_kv.
select
  exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='catalogo_tpv_productos'
            and column_name='precio_con_impuesto') as precio_con_impuesto_existe,
  to_regprocedure('private.abc_catalogo_puede_gestionar(text,text)') is not null as permiso_p3_existe,
  to_regprocedure('private.abc_catalogo_numero(text)') is not null as numero_p3_existe,
  to_regprocedure('public.abc_catalogo_guardar_productos(text,text,text,text,jsonb)') is not null as rpc_p3_existe,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='almacen_kv'
      and column_name in ('key','value','empresa_id')) as columnas_kv_presentes;

-- P3 · Solo recuentos del catálogo y de la lista heredada; ningún valor de producto.
select
  (select count(*) from public.catalogo_tpv_productos) as productos_tpv,
  (select count(*) from public.almacen_kv where key='productos') as filas_lista_productos,
  (select count(*) from public.almacen_kv
    where key='productos' and jsonb_typeof(value)='array') as listas_validas;

-- P4 · Contextos fiscales activos por identificador de local y moneda.
-- Para el local y la moneda que se ensayarán, debe haber exactamente una fila.
select efl.empresa_id, efl.local_id, elm.currency_code, count(*) as contextos_activos
from public.entidad_fiscal_locales efl
join public.entidades_fiscales ef
  on ef.empresa_id=efl.empresa_id and ef.id=efl.entidad_fiscal_id and ef.activa=true
join public.entidad_fiscal_local_monedas elm
  on elm.empresa_id=efl.empresa_id and elm.local_id=efl.local_id
 and elm.entidad_fiscal_id=efl.entidad_fiscal_id and elm.activa=true
where efl.activa=true
group by efl.empresa_id, efl.local_id, elm.currency_code
order by efl.empresa_id, efl.local_id, elm.currency_code;

-- P5 · Huellas y atributos de las dos funciones de cálculo que P3 reemplaza.
select p.oid::regprocedure::text as funcion,
  md5(replace(p.prosrc, chr(13), '')) as md5_cuerpo,
  p.prosecdef as security_definer, p.proconfig::text as configuracion
from pg_proc p
where p.oid in (
  to_regprocedure('private.abc_calcular_linea_tpv(text,text,text,text,numeric)'),
  to_regprocedure('private.abc_calcular_linea_tpv_configurada(text,text,text,text,numeric,bigint,jsonb)')
)
order by funcion;

-- P6 · Permisos y políticas de la lista. Si el navegador puede escribir
-- directamente productos en produccion, revisar la carrera con el espejo P3b.
select has_table_privilege('authenticated','public.almacen_kv','SELECT') as puede_leer,
       has_table_privilege('authenticated','public.almacen_kv','INSERT') as puede_insertar,
       has_table_privilege('authenticated','public.almacen_kv','UPDATE') as puede_actualizar;

select policyname, cmd, roles::text as roles, qual, with_check
from pg_policies
where schemaname='public' and tablename='almacen_kv'
order by policyname;

-- P7 · Disparadores sobre la lista de productos; solo metadatos.
select t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) as definicion
from pg_trigger t
where t.tgrelid='public.almacen_kv'::regclass and not t.tgisinternal
order by t.tgname;
