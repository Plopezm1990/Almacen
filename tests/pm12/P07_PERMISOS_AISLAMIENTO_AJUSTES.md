# PM12–P07 — Permisos y aislamiento de ajustes de inventario

## Objetivo

Impedir que un conteo modifique stock sin autorización y sin un contexto inequívoco de empresa y local.

## Reglas cerradas

- Contar, revisar y cerrar inventarios puede seguir disponible para los roles operativos que ya tengan acceso al módulo de conteo.
- Aplicar ajustes de stock y revertir ajustes queda reservado a **Propietario** y **Encargado**.
- La autorización se verifica dentro de la ruta que muta stock; la UI es solo una segunda barrera.
- Toda mutación exige actor identificable, empresa activa y local activo concreto.
- **Todos los locales** es una vista de consulta y nunca un destino válido de mutación.
- El conteo debe pertenecer a la misma empresa y al mismo local del contexto activo.
- Los conteos nuevos conservan `empresaId` y `localId`.
- Los conteos antiguos sin `empresaId` se normalizan conservadoramente al contexto activo únicamente cuando su local ya queda resuelto por el aislamiento existente; no se permite cruzar de local.
- Al aplicar ajustes se registra actor, rol, empresa y local junto al `operationId` ya trazable de P05.
- La cancelación P06 solo exige el permiso elevado cuando realmente debe revertir movimientos de stock; cancelar un conteo sin efecto de stock no se convierte artificialmente en una operación privilegiada.
- La reversión de una aplicación duplicada exige el mismo permiso elevado que una aplicación normal.

## Capas de protección

1. `__pm12ConteoEstados.autorizarAjusteInventario`: política pura y comprobable.
2. `crearLogicaConteos`: validación antes de `aplicarAjustes`, `revertirUltimaAplicacion` y reversos de cancelación.
3. `GestionAlmacen`: resuelve rol, actor, empresa y local activos.
4. `InventarioCiego`: no ofrece la acción de aplicar a usuarios sin permiso y desactiva la reversión de duplicados.

## Compatibilidad y seguridad

- P02–P06 deben continuar en verde.
- El gate remoto permanente queda activado en la rama de PM12.
- No se modifica `main`.
- No se ejecutan despliegues de producción.
- No se realizan escrituras en Supabase.

PM12_P07_PERMISOS_AISLAMIENTO_AJUSTES=PASS
