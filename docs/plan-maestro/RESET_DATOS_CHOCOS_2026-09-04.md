# Reinicio autorizado de datos de Chocoloyos

Fecha: 2026-09-04
Proyecto: L&A Suite
Supabase: proyecto `flqercbgpgmmfaakrwkc`

## Acción ejecutada

Por solicitud explícita del usuario, se eliminaron los datos funcionales de Chocoloyos para dejar la aplicación en estado limpio y permitir comenzar desde cero.

Se vaciaron completamente:

- `public.almacen_kv`
- `public.movimientos_registro`
- `public.fichajes_registro`
- `public.auditoria_registro`
- `public.operaciones_procesadas`
- `public.prefiltros_candidatos`
- `public.suscripciones_push`
- `public.errores_sistema`
- `public.prefiltro_limites`

Además, se eliminó cualquier vínculo `empleado_id` de `public.perfiles`, ya que los empleados funcionales quedaron eliminados con el reinicio.

## Datos conservados

No se modificaron ni eliminaron:

- usuarios de `auth.users`;
- identidades/sesiones de Auth;
- los 2 registros de `public.perfiles` necesarios para conservar acceso;
- esquema de base de datos;
- RLS y políticas;
- funciones SQL/RPC;
- Edge Functions;
- configuración técnica de Supabase;
- código de producción.

## Verificación posterior

Todas las tablas funcionales vaciadas devolvieron `0` filas tras la operación y `public.perfiles` conservó `2` registros.

El objetivo fue dejar los datos de negocio y pruebas a cero sin romper la estructura ni el acceso al programa.
