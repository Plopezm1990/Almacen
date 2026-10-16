# D01 — hoja de autorización para aplicar en PRODUCCIÓN el blindaje del almacén clásico (prioridad alta)

Fecha: 16/10/2026. Entorno: Supabase PRODUCCIÓN `flqercbgpgmmfaakrwkc`.
Estado: **aplicado y verificado en PRODUCCIÓN.** Autorización de Pedro: «Autorizo» (en respuesta directa a la propuesta de este documento, con una sola acción pendiente: aplicar esta migración, commit `575a37a`).

## 0. Verificación tras aplicar (solo lectura)

La migración se aplicó sin incidencias (preflight y postflight en verde). Comprobado después:
- Las ocho huellas cambiaron exactamente a los valores anunciados en el punto 3 (`7e60ce28...`, `bd7cd310...`, `02990754...`, `98093459...`, `f77ca13a...`, `40814e9c...`, `79374d16...`, `fff788e3...`).
- `pm07_puede_gestionar_stock` conserva el `search_path` vacío que ya tenía en PRODUCCIÓN (no se adoptó el de QA) — comprobado leyendo `proconfig` después de aplicar.
- Recuentos de negocio sin cambios: 3 empresas (1 activa), 1 membresía Propietario activa — idénticos a la foto del punto 4. **0 filas** en `plataforma_password_pendiente`: nadie quedó bloqueado retroactivamente.
- **No se repitió** en PRODUCCIÓN la prueba de marcar/desmarcar una cuenta como pendiente (sí hecha en QA): la única membresía de Propietario activa en PRODUCCIÓN es una cuenta real, no una cuenta de pruebas descartable, y no se toca para no interferir con su uso real. El comportamiento del guardia (bloquea con la marca puesta, no afecta a quien no la tiene) ya quedó probado en QA el mismo día sobre una cuenta de pruebas real, con el mismo texto lógico que esta migración aplica aquí.

## 1. Qué se aplicaría

Una migración, escrita hoy específicamente para PRODUCCIÓN (no la misma que ya se aplicó en QA — ver punto 2), subida a la rama `claude/d01-decisiones-20261016`:

| # | Migración | Qué hace |
|---|---|---|
| 1 | `20261016160000_plataforma_password_inicial_bloqueo_almacen_alta_prod.sql` (commit `575a37a`) | Variante para PRODUCCIÓN de `20261016150000_...almacen_alta.sql` (ya aplicada en QA, commit `720a11c`). Sustituye (con huella antes y después) las ocho piezas que bloquean el almacén clásico para quien tenga la contraseña inicial pendiente. |

Depende de `20261016120000_plataforma_password_inicial_pendiente.sql` (del subpunto 3), ya aplicada y verificada en PRODUCCIÓN.

## 2. Por qué esta migración es distinta de la que se aplicó en QA

Al comprobar hoy las huellas en PRODUCCIÓN antes de proponer esto, encontré que **tres de las ocho piezas tienen en PRODUCCIÓN el mismo texto que en QA pero con saltos de línea distintos** (misma lógica, huella distinta — ya avisado en el propio archivo de la migración de QA cuando se escribió):

| Pieza | ¿Coincide con QA? | Diferencia |
|---|---|---|
| `pm06_puede_gestionar_finanzas` | No | PROD parte la condición en dos líneas; QA la tiene en una |
| `pm07_puede_vender` | No | PROD parte la lista de roles en una línea aparte; QA no |
| `pm07_puede_gestionar_stock` | No | PROD tiene todo en una línea; QA lo parte en dos. Además, PROD tiene `search_path` vacío (`''`) y QA tiene la lista de cuatro esquemas — otra diferencia preexistente entre entornos, sin relación con este blindaje |
| `pm08_puede_operar_caja` | Sí | — |
| `pm08_puede_corregir_caja` | Sí | — |
| `abc_config_puede_configurar` | Sí | — |
| `abc_config_puede_configurar_empresa` | Sí | — |
| `abc_configurar_descuento_politica` | Sí | — |

Por eso esta migración lee hoy el texto EXACTO de PRODUCCIÓN para las tres primeras (no el de QA) y conserva el `search_path` que cada una ya tiene en PRODUCCIÓN — para no introducir ningún cambio de configuración que no sea añadir el guardia. Las otras cinco reutilizan tal cual el mismo bloque ya aplicado en QA, porque coinciden exactamente.

## 3. Comprobación de huella, hecha hoy sobre PRODUCCIÓN (solo lectura)

| Pieza | Huella en PROD (hoy) | Huella que exige el preflight | Coincide |
|---|---|---|---|
| `pm06_puede_gestionar_finanzas` | `f4e2831c...` | `f4e2831c...` | Sí |
| `pm07_puede_vender` | `5a32f8ba...` | `5a32f8ba...` | Sí |
| `pm07_puede_gestionar_stock` | `48bf5e7d...` | `48bf5e7d...` | Sí |
| `pm08_puede_operar_caja` | `ce7b8bc1...` | `ce7b8bc1...` | Sí |
| `pm08_puede_corregir_caja` | `53479408...` | `53479408...` | Sí |
| `abc_config_puede_configurar` | `529c3057...` | `529c3057...` | Sí |
| `abc_config_puede_configurar_empresa` | `81143401...` | `81143401...` | Sí |
| `abc_configurar_descuento_politica` | `105141d7...` | `105141d7...` | Sí |

También comprobado: `private.plataforma_debe_cambiar_password` **sí existe** en PRODUCCIÓN (del subpunto 3), y `private.plataforma_password_pendiente` tiene **0 filas** ahora mismo.

Huellas que resultarán tras aplicar (para comprobarlas después, solo lectura): `pm06` → `7e60ce28...`, `pm07_vender` → `bd7cd310...`, `pm07_stock` → `02990754...`; las otras cinco, las mismas que ya quedaron en QA tras aplicar allí.

## 4. Foto de PRODUCCIÓN antes de aplicar (solo lectura, solo recuentos)

| Dato | Valor |
|---|---|
| Empresas | 3 (1 activa) |
| Membresías Propietario activas | 1 |
| Filas en `suscripciones_push` | 0 |
| Filas en `plataforma_password_pendiente` | 0 |

Igual que en QA: como no hay ninguna cuenta con la contraseña pendiente ahora mismo, **nadie queda bloqueado por aplicar esto**. La única membresía de Propietario activa sigue operando exactamente igual.

## 5. Qué cambia y qué no

- **Cambia:** a partir de ahora, un dueño nuevo (marcado como pendiente al asignarle la empresa) queda bloqueado también para vender, cobrar, mover stock, cerrar caja y cambiar la configuración de permisos — no solo para el TPV/caja y las colecciones de la Plataforma, que ya estaban blindados desde el subpunto 3.
- **No cambia:** ninguna cuenta ya existente, ningún dato, ningún precio, ningún permiso de los roles Encargado/Cajero/Camarero/Churrero. Para `pm07_puede_gestionar_stock` se conserva además el `search_path` vacío que ya tenía en PRODUCCIÓN (no se adopta el de QA), así que tampoco cambia nada de configuración aparte del guardia.
- **No incluido en este paso:** las funciones de prioridad media y baja que la auditoría dejó priorizadas aparte, pendientes de decidir si se blindan también.

## 6. Verificación ya realizada (antes de pedir esta autorización)

- Contrato local (`p14`) contra Postgres real, con prueba de mutación, sobre el texto de QA — el mismo guardia, en el mismo punto de cada función, que esta variante inserta sobre el texto real de PRODUCCIÓN.
- Aplicado y verificado en QA el 16/10/2026: huellas cambiadas, recuentos de negocio sin cambios, y prueba de comportamiento real sobre una cuenta de prueba (`owner.a@qa.invalid`) marcándola y desmarcándola como pendiente — los siete filtros bloquean con la marca y conceden sin ella, otra cuenta sin marca no se ve afectada, la base queda exactamente como estaba.
- Para esta variante de PRODUCCIÓN: verificado hoy, antes de escribir el archivo, que el texto exacto capturado de PRODUCCIÓN para las tres piezas distintas reproduce la huella que PRODUCCIÓN tiene ahora mismo, y que el texto resultante tras insertar el guardia reproduce exactamente la huella indicada en el punto 3 — comprobado con un script aparte, no a ojo. Las otras cinco piezas se compararon byte a byte contra el bloque ya aplicado en QA: idénticas.

## 7. Procedimiento de reversión si hiciera falta

La migración es `CREATE OR REPLACE FUNCTION`, aditiva: no borra nada existente. Revertir es aplicar de nuevo el texto original de PRODUCCIÓN (capturado hoy, guardado) de las ocho funciones. No hay pérdida de datos posible: nada de esto toca filas de negocio, solo el cuerpo de funciones de permiso.

## 8. Autorización

Para aplicar, necesito de Pedro una frase escrita similar a la que autorizó el subpunto 3 en PRODUCCIÓN, por ejemplo:
«Autorizo aplicar en PRODUCCIÓN la migración del blindaje del almacén clásico (D01), commit `575a37a`.»
