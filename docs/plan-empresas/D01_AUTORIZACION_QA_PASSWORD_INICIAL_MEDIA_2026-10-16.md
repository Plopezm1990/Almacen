# D01 — hoja de autorización para aplicar en QA el blindaje de prioridad media

Fecha: 16/10/2026
Entorno: Supabase QA `qjqorixtkilwsndqayyx`. Producción no se toca en este paso.
Estado: **pendiente de autorización.**

## 1. Qué se aplicaría

Una sola migración, ya escrita, probada en local contra Postgres real (con prueba de mutación) y subida a la rama `claude/d01-decisiones-20261016`, commit `3dbd687`:

| # | Migración | Qué hace |
|---|---|---|
| 1 | `20261016170000_plataforma_password_inicial_bloqueo_media.sql` | Sustituye (con comprobación de huella antes y después, `CREATE OR REPLACE`, sin `DROP`) el texto exacto de 14 funciones del bloque de prioridad media de la auditoría: aprobación de descuentos, personal/fichajes y conteos. |

Continúa el subpunto de prioridad alta de hoy mismo (`20261016150000_...almacen_alta.sql`, ya aplicada en QA y PROD). Depende de `20261016120000_plataforma_password_inicial_pendiente.sql`, ya aplicada y verificada en QA.

Las 14 piezas (15 funciones afectadas en el `pg_proc`, pero `pm12_confirmar_ajuste_stock` no necesitó cambio — ver punto 2):

| Función | Cubre |
|---|---|
| `public.abc_aplicar_descuento_cuenta(...)` | ella misma (condición propia) |
| `public.abc_aprobar_descuento_cuenta(...)` | ella misma (condición propia) |
| `private.pm11_puede_mutar_personal(text,text)` | `pm11_alta/baja/editar/reactivar_empleado`, `pm11_crear/eliminar_prefiltro_candidato`, `pm13_registrar/anular_ausencia` (8 funciones) |
| `private.pm11_propietario_puede_gestionar_vinculo(text,text)` | `pm11_anonimizar/vincular/desvincular_cuenta_empleado` (3) |
| `private.pm11_puede_migrar_personal(text,text)` | `pm11_migrar_empleados_legacy` (1) |
| `public.pm11_estado_cuentas_empleados(...)` | ella misma (condición propia, usa `p_actor`/`v_actor`, no `auth.uid()` en el resto del cuerpo) |
| `public.pm11_preparar_cuenta_empleado(...)` | ella misma (condición propia, `p_actor_user_id`) |
| `public.pm11_finalizar_creacion_cuenta_empleado(...)` | ella misma (condición propia, `p_actor_user_id`) |
| `public.pm13_fichar(...)` | ella misma (autoservicio, sin rol) |
| `public.pm13_fichaje_manual(...)` | ella misma |
| `public.pm13_corregir_fichaje(...)` | ella misma |
| `public.pm13_anular_fichaje(...)` | ella misma |
| `private.pm12_cancelar_conteo_stock(...)` | ella misma (el envoltorio público solo la llama; hereda el bloqueo) |
| `public.pm12_cerrar_conteo(...)` | ella misma |
| `public.pm12_listar_cierres(...)` | ella misma |

A diferencia del subpunto de prioridad alta, aquí no hay un único patrón de siete funciones compartidas: tres funciones de permiso compartidas (estilo `pm11`) cubren 12 de las 19 funciones de personal/fichajes, y las otras 11 piezas tienen su guardia de acceso escrito en línea, sin pasar por ningún «puede_X» compartido — cada una con su propia condición.

**Deliberadamente NO incluida:** `public.pm12_confirmar_ajuste_stock`. Su implementación real (`private.pm12_confirmar_ajuste_stock`) ya llama a `private.pm07_puede_gestionar_stock()`, blindada hoy mismo en el subpunto de prioridad alta — comprobado leyendo su texto real antes de escribir esta migración.

**Deliberadamente NO se toca** `private.la_usuario_activo()` ni `private.la_rol()`: son primitivas de muy bajo nivel usadas por decenas de funciones no auditadas todavía; cambiar su comportamiento ampliaría el alcance más allá de lo revisado hoy.

## 2. Comprobación de huella, repetida hoy sobre QA (solo lectura)

| Pieza | Huella en QA (hoy) | Huella esperada por la migración | Coincide |
|---|---|---|---|
| `abc_aplicar_descuento_cuenta` | `ed151626...` | `ed151626...` | Sí |
| `abc_aprobar_descuento_cuenta` | `3683db77...` | `3683db77...` | Sí |
| `pm11_puede_mutar_personal` | `e4ea974c...` | `e4ea974c...` | Sí |
| `pm11_propietario_puede_gestionar_vinculo` | `cae161db...` | `cae161db...` | Sí |
| `pm11_puede_migrar_personal` | `97d51e59...` | `97d51e59...` | Sí |
| `pm11_estado_cuentas_empleados` | `b4dcbdc5...` | `b4dcbdc5...` | Sí |
| `pm11_preparar_cuenta_empleado` | `8c207ef7...` | `8c207ef7...` | Sí |
| `pm11_finalizar_creacion_cuenta_empleado` | `7d7e3ba5...` | `7d7e3ba5...` | Sí |
| `pm13_fichar` | `055e04b2...` | `055e04b2...` | Sí |
| `pm13_fichaje_manual` | `95376137...` | `95376137...` | Sí |
| `pm13_corregir_fichaje` | `2cad8198...` | `2cad8198...` | Sí |
| `pm13_anular_fichaje` | `6199cb57...` | `6199cb57...` | Sí |
| `pm12_cancelar_conteo_stock` | `60dd4f84...` | `60dd4f84...` | Sí |
| `pm12_cerrar_conteo` | `b141d981...` | `b141d981...` | Sí |
| `pm12_listar_cierres` | `cd064470...` | `cd064470...` | Sí |

Las quince tienen en QA, hoy, exactamente el mismo texto que cuando se escribió la migración. También comprobado: `private.plataforma_debe_cambiar_password` **sí existe** en QA, y `private.plataforma_password_pendiente` tiene **0 filas** ahora mismo.

## 3. Foto de QA antes de aplicar (solo lectura, solo recuentos)

| Dato | Valor |
|---|---|
| Empresas | 10 (8 activas) |
| Membresías Propietario activas | 12 |
| Membresías Encargado activas | 1 |
| Filas en `plataforma_password_pendiente` | 0 |

Como no hay ninguna cuenta con la contraseña pendiente ahora mismo, **nadie queda bloqueado por aplicar esto**.

## 4. Qué cambia y qué no

- **Cambia:** a partir de ahora, un dueño nuevo (marcado como pendiente al asignarle la empresa) queda también bloqueado para aprobar descuentos, gestionar personal, fichar por otros, corregir/anular fichajes y cancelar/cerrar conteos de stock — no solo para el TPV/caja/almacén, ya blindados en los subpuntos anteriores.
- **No cambia:** ninguna cuenta ya existente, ningún dato, ningún permiso de los roles Encargado/Cajero/Camarero/Churrero. Las funciones sustituidas hacen exactamente lo mismo que antes, más la condición nueva.
- **No incluido en este paso:** el bloque de prioridad baja (cocina/KDS) que la auditoría dejó aparte para revisión propia (posiblemente autenticado por terminal/estación, no por la sesión del dueño) — no se ha pedido todavía.
- **Fuera de esta autorización:** aplicar en PRODUCCIÓN — autorización escrita aparte, previa comprobación de si alguna de estas 15 piezas tiene en PROD el mismo problema de saltos de línea distintos que tres de las de prioridad alta.

## 5. Verificación ya realizada (antes de pedir esta autorización)

- Contrato local (`p15`) contra Postgres real: comportamiento completo sobre las tres funciones de permiso compartidas (`pm11_puede_mutar_personal`/`pm11_propietario_puede_gestionar_vinculo`/`pm11_puede_migrar_personal`), con prueba de mutación — confirma que antes de la migración solo decide el rol (y el local, en el caso de Encargado), que sin marcar a nadie nada cambia, que marcar a una cuenta bloquea los tres gates mientras otra cuenta sin marca sigue igual, y que quitar la marca restaura el acceso.
- Las otras 12 piezas (demasiadas dependencias propias para montarlas en una base mínima) se verificaron solo por huella (cambió a la esperada) y por texto (contiene la llamada al guardia) — mismo patrón que `abc_configurar_descuento_politica` en el subpunto anterior.
- Batería completa de los 28 contratos activos de Postgres local: en verde (los 8 fallos que aparecen son el hueco preexistente de `tests/f5/c05–c12`, documentado desde antes de hoy, ajeno a este cambio).
- Registrado en el manifiesto de CI y en los contadores del validador y del workflow de release.

## 6. Procedimiento de reversión si hiciera falta

La migración es `CREATE OR REPLACE FUNCTION`, aditiva: no borra nada existente. Revertir es aplicar de nuevo el texto original (capturado hoy de QA, guardado en `tests/plataforma/db/fixtures-f15/orig_*.sql` para las 12 piezas sin comportamiento probado, y en el propio contrato `p15` para las 3 compartidas). No hay pérdida de datos posible: nada de esto toca filas de negocio, solo el cuerpo de funciones de permiso.

## 7. Autorización

Para aplicar, necesito de Pedro una frase escrita similar a las anteriores, por ejemplo:
«Autorizo aplicar en QA la migración del blindaje de prioridad media (D01), commit `3dbd687`.»
