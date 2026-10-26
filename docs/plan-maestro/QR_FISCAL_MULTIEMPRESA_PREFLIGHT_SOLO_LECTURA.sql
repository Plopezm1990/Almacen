-- C07-A. Ejecutar en el entorno seleccionado antes de aplicar la migración.
-- Solo metadatos: no devuelve datos empresariales, credenciales ni configuración.
-- Dependencias: todas deben estar presentes; objetos C07-A: todos ausentes antes de primera aplicación.
with dependencias(nombre, presente) as (
  values
    ('empresas',to_regclass('public.empresas') is not null),
    ('locales',to_regclass('public.locales') is not null),
    ('entidades_fiscales',to_regclass('public.entidades_fiscales') is not null),
    ('entidad_fiscal_locales',to_regclass('public.entidad_fiscal_locales') is not null),
    ('membresias_usuario',to_regclass('public.membresias_usuario') is not null),
    ('auth.uid',to_regprocedure('auth.uid()') is not null),
    ('abc_tiene_capacidad',to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is not null)
)
select nombre, presente from dependencias order by nombre;

with nuevos(nombre, presente) as (
  values
    ('abc_fiscal_borradores',to_regclass('private.abc_fiscal_borradores') is not null),
    ('abc_fiscal_borrador_revisiones',to_regclass('private.abc_fiscal_borrador_revisiones') is not null),
    ('abc_fiscal_borrador_guard',to_regprocedure('private.abc_fiscal_borrador_guard()') is not null),
    ('abc_fiscal_config_acceso',to_regprocedure('private.abc_fiscal_config_acceso(text,text,uuid)') is not null),
    ('abc_fiscal_config_normalizar',to_regprocedure('private.abc_fiscal_config_normalizar(jsonb)') is not null),
    ('abc_fiscal_leer_borrador',to_regprocedure('public.abc_fiscal_leer_borrador(text,text,uuid)') is not null),
    ('abc_fiscal_guardar_borrador',to_regprocedure('public.abc_fiscal_guardar_borrador(uuid,text,text,uuid,bigint,jsonb)') is not null)
)
select nombre,presente from nuevos order by nombre;

-- Validar que la clave de referencia del emisor incluye empresa e identificador.
select indexname,indexdef from pg_indexes
where schemaname='public' and tablename='entidades_fiscales'
order by indexname;

-- Examinar estas definiciones con los contratos vigentes de identidad/permisos.
select p.oid::regprocedure::text as funcion,p.prosecdef,p.proconfig,
  md5(pg_get_functiondef(p.oid)) as huella
from pg_proc p
where p.oid in (
  to_regprocedure('auth.uid()'),
  to_regprocedure('private.abc_tiene_capacidad(text,text,text)')
);
