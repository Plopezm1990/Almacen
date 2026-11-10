select current_database() as base, current_timestamp as comprobado_en;

with objetos(nombre) as (
  values
    ('appcc_puntos_control'),
    ('appcc_lecturas'),
    ('appcc_lectura_correcciones'),
    ('appcc_lectura_cancelaciones')
)
select o.nombre,
       (c.oid is not null) as existe,
       coalesce(c.relrowsecurity, false) as rls_activo
from objetos o
left join pg_class c on c.oid = to_regclass('public.' || o.nombre)
order by o.nombre;

select p.proname,
       p.oid::regprocedure::text as firma,
       md5(pg_get_functiondef(p.oid)) as huella,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'appcc_registrar_lectura',
    'appcc_corregir_lectura',
    'appcc_cancelar_lectura',
    'appcc_guardar_punto',
    'appcc_desactivar_punto'
  )
order by p.proname, firma;

select nombre, existe
from (
  values
    ('private.la_usuario_activo', to_regprocedure('private.la_usuario_activo()') is not null),
    ('private.la_tiene_local', to_regprocedure('private.la_tiene_local(text,text)') is not null),
    ('private.la_tiene_empresa', to_regprocedure('private.la_tiene_empresa(text)') is not null)
) as dependencias(nombre, existe)
order by nombre;

select version
from supabase_migrations.schema_migrations
where version in ('20261109150000','20261109170000','20261109180000','20261109201101')
order by version;

