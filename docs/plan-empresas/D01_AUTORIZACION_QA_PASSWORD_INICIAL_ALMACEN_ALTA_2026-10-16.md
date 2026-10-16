# D01 — hoja de autorización para aplicar en QA el blindaje del almacén clásico (prioridad alta)

Fecha: 16/10/2026
Entorno: Supabase QA `qjqorixtkilwsndqayyx`. Producción no se toca en este paso.
Estado: **pendiente de autorización.**

## 1. Qué se aplicaría

Una sola migración, ya escrita, probada en local contra Postgres real (con prueba de mutación) y subida a la rama `claude/d01-decisiones-20261016`, commit `720a11c`:

| # | Migración | Qué hace |
|---|---|---|
| 1 | `20261016150000_plataforma_password_inicial_bloqueo_almacen_alta.sql` | Sustituye (con comprobación de huella antes y después, `CREATE OR REPLACE`, sin `DROP`) el texto exacto de siete funciones de permiso compartidas del almacén clásico más `abc_configurar_descuento_politica`, añadiendo en cada una el mismo bloqueo que ya usa `abc_tiene_capacidad` desde el subpunto 3. |

Es la continuación directa de la auditoría del propio 16/10/2026 (`D01_AUDITORIA_FUNCIONES_SIN_BLINDAJE_2026-10-16.md`), que encontró 55 funciones que no pasaban por ningún filtro del blindaje y priorizó este bloque — dinero/stock y configuración de permisos — como prioridad alta.

Esta migración depende de `20261016120000_plataforma_password_inicial_pendiente.sql` (del subpunto 3), ya aplicada y verificada en QA. No depende de las otras dos migraciones de ese subpunto (filtros de ABC/kv/mov y push), que tocan sitios distintos.

Las ocho piezas, qué cubre cada una (de la propia migración):

| Función de permiso compartida | Cubre |
|---|---|
| `private.pm06_puede_gestionar_finanzas()` | `registrar_pago_factura`, `revertir_pago_factura` |
| `private.pm07_puede_vender()` | `registrar_venta_stock(_carrito)(_pm09)` |
| `private.pm07_puede_gestionar_stock()` | `revertir_venta_stock(_carrito)(_pm09)`, `registrar_devolucion_proveedor`, `trasladar_stock_entre_locales`/`_interno` |
| `private.pm08_puede_operar_caja()` | `registrar_arqueo_caja`, `registrar_movimiento_caja`, `registrar_encargo`, `registrar_pago_encargo`, `registrar_devolucion_venta(_pm09)` |
| `private.pm08_puede_corregir_caja()` | `anular_arqueo_caja`, `revertir_movimiento_caja` |
| `private.abc_config_puede_configurar(text,text)` | `abc_configurar_ajuste`/`dia_operativo`/`equipo_local`/`modalidad_local` |
| `private.abc_config_puede_configurar_empresa(text,text)` | `abc_configurar_capacidad_rol` (ámbito EMPRESA) |
| `public.abc_configurar_descuento_politica(...)` | ella misma (condición propia, sin función compartida) |

Las variantes `_pm09` llaman a la función base y heredan el bloqueo sin tocarlas. `abc_configurar_modalidad_fiscal` queda fuera a propósito: ya pasa por `private.abc_tiene_capacidad`, blindada desde el subpunto 3 — comprobado leyendo su texto real durante la auditoría.

## 2. Comprobación de huella, repetida hoy sobre QA (solo lectura)

Antes de proponer esto comprobé que QA sigue teniendo exactamente el mismo texto que cuando se diseñó la migración (no he asumido que no cambió, lo he verificado de nuevo):

| Pieza | Huella en QA (hoy) | Huella esperada por la migración | Coincide |
|---|---|---|---|
| `pm06_puede_gestionar_finanzas` | `bdda0898...` | `bdda0898...` | Sí |
| `pm07_puede_vender` | `5e0162f3...` | `5e0162f3...` | Sí |
| `pm07_puede_gestionar_stock` | `53479408...` | `53479408...` | Sí |
| `pm08_puede_operar_caja` | `ce7b8bc1...` | `ce7b8bc1...` | Sí |
| `pm08_puede_corregir_caja` | `53479408...` | `53479408...` | Sí |
| `abc_config_puede_configurar` | `529c3057...` | `529c3057...` | Sí |
| `abc_config_puede_configurar_empresa` | `81143401...` | `81143401...` | Sí |
| `abc_configurar_descuento_politica` | `105141d7...` | `105141d7...` | Sí |

Las ocho tienen en QA, hoy, **exactamente** el mismo texto que cuando se escribió la migración — nada ha cambiado por el camino. También comprobado: `private.plataforma_debe_cambiar_password` (la dependencia del subpunto 3) **sí existe** en QA, y `private.plataforma_password_pendiente` tiene **0 filas** ahora mismo.

**Nota sobre PROD, ya en el propio archivo de la migración:** tres de las ocho piezas (`pm06_puede_gestionar_finanzas`, `pm07_puede_vender`, `pm07_puede_gestionar_stock`) tienen en PRODUCCIÓN el mismo texto pero con saltos de línea distintos (comprobado al diseñar esta migración) — misma lógica, huella distinta. Esta migración lleva el texto de QA; aplicar en PROD necesitará su propio preflight y, para esas tres, su propio texto exacto. Ese paso es aparte y no se pide aquí.

## 3. Foto de QA antes de aplicar (solo lectura, solo recuentos)

| Dato | Valor |
|---|---|
| Empresas | 10 (8 activas) |
| Membresías Propietario activas | 12 |
| Filas en `suscripciones_push` | 1 |
| Filas en `plataforma_password_pendiente` | 0 |

Como no hay ninguna cuenta con la contraseña pendiente ahora mismo, **nadie queda bloqueado por aplicar esto**: el guardia nuevo solo actúa para quien tenga una fila en `plataforma_password_pendiente`, y hoy esa tabla está vacía. Las 12 membresías de Propietario activas, y todo el resto de roles, siguen operando exactamente igual.

## 4. Qué cambia y qué no

- **Cambia:** a partir de ahora, un dueño nuevo (marcado como pendiente al asignarle la empresa, igual que ya hace `plataforma_asignar_propietario` desde el subpunto 3) queda bloqueado también para vender, cobrar, mover stock, cerrar caja y cambiar la configuración de permisos — no solo para el TPV/caja y las colecciones de la Plataforma, que ya estaban blindados.
- **No cambia:** ninguna cuenta ya existente, ningún dato, ningún precio, ningún permiso de los roles Encargado/Cajero/Camarero/Churrero. Las ocho funciones sustituidas hacen exactamente lo mismo que antes, más la condición nueva.
- **No incluido en este paso:** las funciones de prioridad media (aprobación de descuentos, Personal/Fichajes, conteos de stock) y las de prioridad baja (cocina/KDS) que la misma auditoría dejó priorizadas aparte, pendientes de decidir si se blindan también.
- **Fuera de esta autorización:** aplicar en PROD — autorización escrita aparte, con su propio preflight para las tres piezas con formato distinto.

## 5. Verificación ya realizada (antes de pedir esta autorización)

- Contrato local (`p14`) contra Postgres real, montando el texto real de las siete funciones compartidas (comprobado que reproduce exactamente la huella de QA) y de `abc_configurar_descuento_politica` (verificada solo por huella, no por comportamiento — tiene demasiadas dependencias propias para montarlas en una base mínima): confirma que antes de la migración solo decide el rol, que sin marcar a nadie como pendiente nada cambia (regresión), que marcar a una cuenta bloquea las siete funciones mientras otra cuenta sin marca sigue igual, y que quitar la marca restaura el acceso.
- Prueba de mutación: quitando el guardia de una de las siete funciones, el contrato lo detecta y falla — confirma que el contrato de verdad vigila lo que dice vigilar.
- Batería completa de los 27 contratos activos de Postgres local: en verde (los 8 fallos que aparecen son el hueco preexistente de `tests/f5/c05–c12` por falta del driver `pg` en este entorno de trabajo, documentado desde antes de hoy, ajeno a este cambio).
- Registrado en el manifiesto de CI y en los contadores del validador y del workflow de release.

## 6. Procedimiento de reversión si hiciera falta

La migración es `CREATE OR REPLACE FUNCTION`, aditiva: no borra nada existente. Revertir es aplicar de nuevo el texto original (capturado hoy de QA, guardado) de las ocho funciones. No hay pérdida de datos posible: nada de esto toca filas de negocio, solo el cuerpo de funciones de permiso.

## 7. Autorización

Para aplicar, necesito de Pedro una frase escrita similar a la que autorizó el subpunto 3, por ejemplo:
«Autorizo aplicar en QA la migración del blindaje del almacén clásico (D01), commit `720a11c`.»
