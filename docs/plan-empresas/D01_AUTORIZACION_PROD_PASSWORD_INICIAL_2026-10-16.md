# D01 — hoja de autorización para aplicar en PRODUCCIÓN el blindaje de la contraseña inicial

Fecha: 16/10/2026. Entorno: Supabase PRODUCCIÓN `flqercbgpgmmfaakrwkc`.
Estado: **pendiente de autorización.** No se ha aplicado ni tocado nada en producción todavía.

## 1. Qué se aplicaría, en este orden exacto

Las mismas tres migraciones ya aplicadas y verificadas en QA dos veces (por consola y por pantalla real), en la rama `claude/d01-decisiones-20261016`, commit `2d3875f`:

| # | Migración | Qué hace |
|---|---|---|
| 1 | `20261016120000_plataforma_password_inicial_pendiente.sql` | Crea la tabla `private.plataforma_password_pendiente`, el disparador sobre `auth.users` que detecta un cambio real de contraseña, y las funciones de comprobación y estado. Aditiva. |
| 2 | `20261016130000_plataforma_password_inicial_bloqueo_filtros.sql` | Sustituye (con comprobación de huella antes y después) `private.abc_tiene_capacidad`, `private.plataforma_kv_permitido`, `private.plataforma_mov_permitido` y `public.plataforma_asignar_propietario`. |
| 3 | `20261016140000_plataforma_password_inicial_bloqueo_push.sql` | `ALTER POLICY` (sin `DROP`) sobre las 4 políticas de `suscripciones_push`, con la misma comprobación de huella. |

## 2. Comprobación de huella, repetida hoy sobre PRODUCCIÓN (solo lectura)

| Pieza | Huella en PROD (hoy) | Huella esperada por la migración | Coincide |
|---|---|---|---|
| `abc_tiene_capacidad` | `7e78855...` | `7e78855...` | Sí |
| `plataforma_kv_permitido` | `6438138...` | `6438138...` | Sí |
| `plataforma_mov_permitido` | `0bd40a2...` | `0bd40a2...` | Sí |
| `plataforma_asignar_propietario` | `1071c28...` | `1071c28...` | Sí |
| Política `plataforma_push_select` | `112c2af...` | `112c2af...` | Sí |
| Política `plataforma_push_insert` | `05c35a8...` | `05c35a8...` | Sí |
| Política `plataforma_push_update` | `91ef471...` | `91ef471...` | Sí |
| Política `plataforma_push_delete` | `112c2af...` | `112c2af...` | Sí |

Las cuatro funciones y las cuatro políticas tienen en producción, hoy, **exactamente** el mismo texto que cuando se diseñó el blindaje — nada ha cambiado por el camino. También comprobado: `private.plataforma_password_pendiente` y `private.plataforma_debe_cambiar_password` **no existen todavía** en producción — sin conflicto de nombres.

## 3. Foto de producción antes de aplicar (solo lectura, solo recuentos)

| Dato | Valor |
|---|---|
| Empresas | 3 (1 activa) |
| Membresías Propietario activas | 1 |
| Administradores de plataforma | 1 |
| Filas en `suscripciones_push` | 0 |

Ninguna cuenta existente queda bloqueada por esta migración: la tabla `plataforma_password_pendiente` nace vacía y solo se rellena para los **nuevos** dueños que se asignen a partir de ahora con `plataforma_asignar_propietario`. La única membresía de Propietario ya activa sigue funcionando exactamente igual — comprobado hoy en QA con el mismo mecanismo, dos veces.

## 4. Qué cambia y qué no

- **Cambia:** un dueño nuevo, creado a partir de ahora, queda bloqueado para operar (venta ABC/TPV, caja, colecciones de la Plataforma, avisos push) hasta que cambie de verdad su contraseña inicial — comprobado en el servidor, no en lo que diga el navegador.
- **No cambia:** ninguna cuenta ya existente, ningún dato, ningún precio, ningún permiso de los roles Encargado/Cajero/Camarero/Churrero.
- **No incluido en esta autorización:** el cambio de pantalla (commit `e7bcef5`, ya escrito, probado —95/95 y 44/44 con prueba de mutación— y verificado en vivo en QA) vive en el código del navegador (`plataforma-panel.js`, `owner-bootstrap-prelock.js`), no en la base de datos. Para que llegue a producción hace falta fusionar la rama a `release` y que Netlify despliegue el sitio real — un paso **aparte**, con su propia autorización, del todo independiente de estas tres migraciones. Mientras tanto, el código ya desplegado en producción sigue mirando `user_metadata` (el criterio antiguo) y funciona exactamente igual que hoy — el cambio de pantalla tiene además, por diseño, un respaldo automático a ese mismo criterio si el servidor no tuviera todavía la función nueva, así que aplicar las migraciones de la base de datos primero, sin el cambio de pantalla, no rompe nada.
- **Fuera de esta autorización, ya documentado y priorizado aparte:** la auditoría de hoy encontró 55 funciones del almacén clásico (Personal, Fichajes, Conteos, Stock/Caja) que no pasan por este blindaje — un hueco anterior a D01, no agravado por esto (`D01_AUDITORIA_FUNCIONES_SIN_BLINDAJE_2026-10-16.md`).

## 5. Verificación ya realizada (antes de pedir esta autorización)

- Contrato local contra Postgres real, con prueba de mutación: 35 comprobaciones (p11/p12/p13), todas sobre el texto exacto capturado de producción.
- Aplicado y verificado dos veces en QA con una cuenta nueva de verdad: por consola (disparador real + los tres filtros + push) y por pantalla real (aparece, desaparece, no vuelve a pedirla en una cuenta ya resuelta).
- Regresión F4/F4e (`p09`, `p10`) contra Postgres real: en verde, sin el blindaje por delante — confirma que la base que las migraciones de hoy tocan no ha cambiado.
- CI completo de la rama en verde (`gate-final`, `node-y-postgres`, y el resto de comprobaciones del repositorio).

## 6. Procedimiento de reversión si hiciera falta

Igual que en QA: las tres migraciones son `CREATE OR REPLACE` / `ALTER POLICY` aditivas, no borran nada existente. Revertir es aplicar de nuevo el texto original (capturado y guardado) de las 4 funciones y las 4 políticas y, si se quiere, borrar la tabla `plataforma_password_pendiente` y sus funciones nuevas. No hay pérdida de datos posible: nada de esto toca filas de negocio.

## 7. Autorización

Para aplicar, necesito de Pedro una frase escrita similar a la que autorizó QA, por ejemplo:
«Autorizo aplicar en PRODUCCIÓN las tres migraciones del blindaje de la contraseña inicial (D01), commit `2d3875f`.»
