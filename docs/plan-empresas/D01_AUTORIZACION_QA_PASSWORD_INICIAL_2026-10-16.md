# D01 — hoja de autorización para aplicar en QA el blindaje de la contraseña inicial

Fecha: 16/10/2026
Entorno: Supabase QA `qjqorixtkilwsndqayyx`. Producción no se toca en este paso.
Estado: **aplicado y verificado en QA.** Autorización de Pedro: «Autorizo aplicar en QA las tres migraciones del blindaje de la contraseña inicial (D01), commit e4ff3d4.»

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

## 5. Aplicación: incidencia con la herramienta y cómo se resolvió

Las migraciones 1 y 3 llevaban sentencias que la herramienta de migraciones cancela en bloque (ya documentado en el informe de traspaso, §8.2): la 1 traía un `DROP TRIGGER IF EXISTS` de seguridad para repetirla en el futuro (en esta primera aplicación no podía existir nada que borrar, así que se quitó solo del envío a la herramienta, sin tocar el archivo del repositorio); la 3 no llevaba `DROP`, aplicó a la primera. La migración 2 tampoco llevaba `DROP` y aplicó sin incidencias.

Las tres se aplicaron **en orden**, cada una con su comprobación de huella antes y después, todas con éxito.

## 6. Verificación realizada tras aplicar

1. **Huellas finales**, solo lectura: `abc_tiene_capacidad`, `plataforma_kv_permitido` y `plataforma_mov_permitido` tienen ahora un texto distinto del original (confirma la sustitución); `plataforma_asignar_propietario` contiene la llamada nueva; las 4 políticas de `suscripciones_push` contienen la condición nueva. `plataforma_password_pendiente` existía con **0 filas** justo después de aplicar: ninguna cuenta quedó bloqueada retroactivamente.
2. **Prueba de comportamiento real**, sobre la cuenta de prueba `Propietario QA` (`16c79749-…`, `QA-EMP-A` / `QA-A1`), **sin tocar su contraseña real**:
   - Antes: `abc_tiene_capacidad`, `plataforma_kv_permitido`, `plataforma_mov_permitido` y la condición de `suscripciones_push` conceden los cuatro (`true`).
   - Se le marcó la contraseña como pendiente con `plataforma_marcar_password_pendiente` (la misma función que usaría `plataforma_asignar_propietario` con un dueño nuevo de verdad).
   - Con la marca puesta: los cuatro deniegan (`false`), y `plataforma_mi_estado_password()` devuelve `pendiente: true`.
   - Se quitó la marca (sin tocar `encrypted_password`) y los cuatro volvieron a conceder (`true`), `pendiente: false`.
   - Comprobación final: **0 filas** en `plataforma_password_pendiente` en toda la base — la cuenta de prueba quedó exactamente como estaba antes de la prueba.
   - **Límite de esta verificación:** el disparador que detecta un cambio *real* de `encrypted_password` no se probó en QA (para no tocar la contraseña real de una cuenta compartida contigo y con Cowork); ese mecanismo ya está probado a fondo en los contratos locales (T2, T13, T18, con su propia prueba de mutación). Queda pendiente probarlo en QA de verdad dando de alta un dueño **nuevo** (punto 7 más abajo), que es un escenario distinto y no toca ninguna cuenta compartida.
3. **Regresión:** no se han vuelto a ejecutar aquí los contratos de ABC/pieza 5/F4/F4e contra QA (quedan para la prueba con Cowork, punto 7). La prueba de comportamiento del punto 2 ya confirma que una cuenta sin fila pendiente no se ve afectada.

## 7. Lo que queda (fuera del alcance de esta autorización)

1. ~~Prueba con Cowork en QA: dar de alta un dueño **nuevo** de verdad...~~ **Hecho el 16/10/2026.** Dos rondas con Cowork sobre un dueño nuevo real: (a) por consola, el disparador real de `encrypted_password` y los tres filtros (ABC/kv/mov) y push, todos correctos (una sonda mal elegida —`abc_obtener_modalidades_local`, que no pasa por `abc_tiene_capacidad`— corregida en el documento); (b) por pantalla, con el cambio del punto 2 ya desplegado en la vista previa: aparece «Elige tu contraseña» para la cuenta nueva, desaparece tras el cambio real, y una cuenta ya resuelta de la ronda anterior no la vuelve a pedir. Sin repetir aquí los contratos de regresión completos de ABC/F4/F4e (quedan como auditoría aparte, punto 4).
2. ~~Cambiar la pantalla para que consulte `plataforma_mi_estado_password` en vez de `user_metadata`.~~ **Hecho el 16/10/2026** (commit `e7bcef5`), con respaldo automático al criterio anterior si el servidor no tiene la función todavía (antes de aplicar en PROD). Verificado con pruebas automatizadas (p04/p05/p06, con prueba de mutación) y en vivo en QA (punto 1).
3. Aplicar en PROD — autorización escrita aparte.
4. Auditar las funciones que no pasan por estos filtros comunes (incluye, como mínimo, repetir contra QA los contratos de regresión de ABC/F4/F4e).

## 8. Procedimiento de reversión si hiciera falta

Las tres migraciones son `CREATE OR REPLACE` / `ALTER POLICY` aditivas: no han borrado nada existente. Revertir es aplicar de nuevo el texto original de las 4 funciones y las 4 políticas (guardado, capturado de PROD antes de escribir estas migraciones) y, si se quiere, borrar la tabla `plataforma_password_pendiente` y sus funciones nuevas. No hay pérdida de datos en ningún caso: nada de esto ha tocado filas de negocio.
