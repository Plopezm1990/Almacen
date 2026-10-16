# D01 — hoja de autorización para aplicar en QA el blindaje de la contraseña inicial

Fecha: 16/10/2026
Entorno: Supabase QA `qjqorixtkilwsndqayyx`. Producción no se toca en este paso.
Estado: **preparado, pendiente de tu autorización escrita.** Nada de lo de abajo se ha aplicado todavía.

## 1. Qué se aplicaría, en este orden exacto

Las tres migraciones del subpunto 3 y 3b, ya escritas, probadas en local contra Postgres real (35 comprobaciones en total entre los tres contratos) y subidas a la rama `claude/d01-decisiones-20261016`, commit `e4ff3d4`:

| # | Migración | Qué hace |
|---|---|---|
| 1 | `20261016120000_plataforma_password_inicial_pendiente.sql` | Crea la tabla `private.plataforma_password_pendiente`, el disparador sobre `auth.users` que detecta un cambio real de contraseña, y las funciones de comprobación y estado. Aditiva, no toca nada existente. |
| 2 | `20261016130000_plataforma_password_inicial_bloqueo_filtros.sql` | Sustituye (con comprobación de huella antes y después) el texto exacto de `private.abc_tiene_capacidad`, `private.plataforma_kv_permitido`, `private.plataforma_mov_permitido` y `public.plataforma_asignar_propietario`, añadiendo el bloqueo y la marca del nuevo dueño. |
| 3 | `20261016140000_plataforma_password_inicial_bloqueo_push.sql` | `ALTER POLICY` (sin `DROP`) sobre las 4 políticas de `suscripciones_push`, con la misma comprobación de huella. |

## 2. Comprobación de huella, repetida hoy sobre QA (solo lectura)

Antes de proponer esto comprobé que QA tiene exactamente el mismo texto que PROD en las piezas que se van a tocar — no he asumido que QA y PROD coinciden, lo he verificado:

| Pieza | Huella en QA (hoy) | Huella esperada por la migración | Coincide |
|---|---|---|---|
| `abc_tiene_capacidad` | `7e78855...` | `7e78855...` | Sí |
| `plataforma_kv_permitido` | `6438138...` | `6438138...` | Sí |
| `plataforma_mov_permitido` | `0bd40a2...` | `0bd40a2...` | Sí |
| `plataforma_asignar_propietario` | `1071c28...` | `1071c28...` | Sí |
| Política `plataforma_push_select` | `112c2af...` | `112c2af...` | Sí |
| Política `plataforma_push_insert` | `05c35a8...` | `05c35a8...` | Sí |
| Política `plataforma_push_update` | `91ef471...` | `91ef471...` | Sí |
| Política `plataforma_push_delete` | `112c2af...` | `112c2af...` | Sí |

Comprobado también: `private.plataforma_password_pendiente` y `private.plataforma_debe_cambiar_password` **no existen todavía** en QA (no hay conflicto de nombres).

## 3. Foto de QA antes de aplicar (solo lectura, solo recuentos)

| Dato | Valor |
|---|---|
| Empresas | 8 (6 activas) |
| Membresías Propietario activas | 10 |
| Administradores de plataforma | 1 |
| Filas en `suscripciones_push` | 0 |

Ninguna cuenta existente queda bloqueada por esta migración: la tabla `plataforma_password_pendiente` nace vacía y solo se rellena para los **nuevos** dueños que se asignen a partir de ahora con `plataforma_asignar_propietario`. Las 10 membresías de Propietario ya activas siguen funcionando exactamente igual.

## 4. Qué cambia y qué no

- **Cambia:** un dueño nuevo, creado a partir de ahora, queda bloqueado para operar (venta, caja, almacén, avisos push…) hasta que cambie de verdad su contraseña inicial. Antes, ese bloqueo solo existía en la pantalla y se podía saltar.
- **No cambia:** ninguna cuenta ya existente, ningún dato, ningún precio, ningún permiso de los roles Encargado/Cajero/Camarero/Churrero. Las funciones sustituidas hacen exactamente lo mismo que antes, más la línea nueva.
- **No incluido en este paso:** el cambio de pantalla (que la pantalla consulte `plataforma_mi_estado_password` en vez de fiarse de la sesión local) — es un subpunto de código aparte, posterior a esto.

## 5. Procedimiento de verificación tras aplicar (con Cowork, en QA)

1. Comprobación de solo lectura: huellas finales de las 4 funciones y las 4 políticas.
2. Repetir en QA los contratos ya probados en local: dar de alta un dueño de prueba nuevo con `plataforma_asignar_propietario`, confirmar que queda bloqueado, cambiar su contraseña de verdad, confirmar que se desbloquea.
3. Confirmar que una cuenta de Propietario ya existente (de las 10 actuales) sigue operando sin ningún cambio.
4. Repetir los contratos de regresión ya existentes de ABC (pieza 5), F4 y F4e para confirmar que nada se ha roto.

## 6. Procedimiento de reversión si algo falla

Las tres migraciones son `CREATE OR REPLACE` / `ALTER POLICY` aditivos: no hay `DROP` de nada existente. Revertir es aplicar de nuevo el texto original de las 4 funciones y las 4 políticas (lo tengo guardado, capturado hoy de PROD antes de escribir estas migraciones) y, si se quiere, borrar la tabla `plataforma_password_pendiente` y sus funciones nuevas. No hay pérdida de datos en ningún caso: nada de esto toca filas de negocio.

## 7. Frase de autorización

Para aplicar esto en QA, necesito que me confirmes con una frase explícita, por ejemplo:

> «Autorizo aplicar en QA las tres migraciones del blindaje de la contraseña inicial (D01), commit e4ff3d4.»

Esta autorización es solo para **QA** y solo para **estas tres migraciones**. No cubre producción, ni el cambio de pantalla, ni ningún otro subpunto.
