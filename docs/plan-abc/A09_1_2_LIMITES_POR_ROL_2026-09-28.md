# A09.1.2 — límites configurables por rol

Fecha: 2026-09-28.

## Cambio

La pantalla A09 deja de estar limitada a Propietario y Encargado. Mantiene esos dos perfiles y añade Cajero/a, Camarero/a, Churrero/a y Básico con política cerrada por defecto (0 %, sin capacidades). También carga cualquier política de rol ya existente y permite añadir un nombre de rol adicional exclusivamente para A09.

## Autoridad y seguridad

- El servidor sigue siendo la autoridad.
- Solo Propietario puede listar y configurar políticas mediante las RPC A09.
- Un rol nuevo A09 nace con límite 0 y todas las capacidades desactivadas.
- Añadir un rol en A09 no crea una cuenta, una membresía ni permisos generales de navegación.
- No se elimina ni relaja el CHECK de public.perfiles. Un rol desconocido todavía cae al fallback de navegación Estándar; abrir perfiles personalizados globales sin un modelo explícito de permisos podría ampliar acceso.
- No hay migración de base de datos en A09.1.2.
- No se toca QA, PROD, main ni Netlify.

## Contratos ampliados

- UI: Cajero/a, Camarero/a, Churrero/a y Básico están presentes y el guardado itera sobre Object.keys(form), no sobre dos roles fijos.
- PostgreSQL: configuración positiva por rol para Cajero/a, Camarero/a y un rol adicional.
- PostgreSQL: precedencia de política específica por usuario.

El soporte global de perfiles personalizados queda como trabajo separado porque debe definir primero su matriz de permisos y eliminar el fallback implícito de Estándar.
