-- C07-D: solo lectura; no crea, modifica ni borra objetos o filas.
select to_regclass('public.abc_c05_series_documentales') as c05_series,
       to_regclass('public.abc_c05_documentos_emitidos') as c05_documentos,
       to_regclass('public.abc_c07d_registros_fiscales') as c07d_registros,
       to_regclass('public.abc_c07d_cola_fiscal') as c07d_cola,
       to_regclass('public.efectos_pendientes') as efectos_genericos;

select p.proname, pg_get_function_identity_arguments(p.oid) as argumentos,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('abc_configurar_serie_documental',
                    'abc_reservar_numero_documental',
                    'abc_resolver_emision_documental')
order by p.proname;

select e.empresa_id,e.id as entidad_fiscal_id,e.nombre_legal,
       el.local_id,el.activa
from public.entidades_fiscales e
join public.entidad_fiscal_locales el
  on el.empresa_id=e.empresa_id and el.entidad_fiscal_id=e.id
where e.activa and el.activa
order by e.empresa_id,el.local_id,e.id;

select s.empresa_id,s.local_id,s.tipo_documento,s.codigo_serie,
       s.autoridad,s.siguiente_numero,s.activa
from public.abc_c05_series_documentales s
order by s.empresa_id,s.local_id,s.codigo_serie;

select table_name,column_name
from information_schema.columns
where table_schema='public'
  and table_name='abc_c05_documentos_emitidos'
  and column_name='entidad_fiscal_id';
