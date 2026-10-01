# F5 / PM09 — inventario de callers `service_role`

Fecha: 2026-10-01  
Estado: `INVENTARIO_LOCAL_COMPLETADO_NO_APLICADO`

## Resultado

Se revisó el código local buscando los cinco wrappers PM09 y su uso desde
servidor:

| Zona | Resultado |
|---|---|
| Frontend `fuente.js` | Sí hay llamadas PM09 mediante el cliente de usuario: devolución, venta de carrito y reverso de carrito |
| `source-recovery/fuente-recuperado.js` | Reproduce las mismas llamadas del frontend |
| `supabase/functions/**` | No hay callers de los wrappers PM09 |
| Uso de `SUPABASE_SERVICE_ROLE_KEY` junto a un wrapper PM09 | No encontrado |

Las llamadas del frontend se hacen a través de `window.__nubeCliente` o del
cliente obtenido por `window.getSupabaseClient()`, por lo que el flujo previsto
es el de un usuario autenticado, no el de `service_role`.

## Conclusión de compatibilidad

En el repositorio no aparece un consumidor servidor que necesite mantener
`EXECUTE` para `service_role` en los cinco wrappers. Esto elimina el bloqueo de
compatibilidad basado en callers conocidos dentro del código versionado.

La conclusión no sustituye una comprobación de configuración externa,
jobs SQL, scripts operativos o clientes no versionados. Antes de aplicar la
migración en QA/PROD todavía debe hacerse una verificación de esos consumidores
externos y una prueba de autenticación en QA.

## Evidencia automatizada

El contrato `tests/f5/pm09/pm09-service-role-caller-inventory.mjs` comprueba que
las llamadas existentes están en el frontend y que `supabase/functions` no
contiene callers PM09 ni una combinación de `SUPABASE_SERVICE_ROLE_KEY` con
estos wrappers.

No se modificaron permisos remotos, no se ejecutaron migraciones y no se hizo
deploy.
