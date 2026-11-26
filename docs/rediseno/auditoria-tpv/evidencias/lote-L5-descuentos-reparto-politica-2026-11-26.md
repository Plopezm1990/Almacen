# Lote L5 · descuento aplicado, revertir reparto y escalado del Encargado · 26/11/2026

Autorizado por el usuario («Las 2», y después «Autorizo» para activar temporalmente «Puede aplicar»
en la política del Encargado). Entró él con la cuenta de pruebas de QA `pm07.smoke@qa.invalid`
escribiendo en la conversación la contraseña y, en cada entrada, un código de segundo factor
nuevo. **Ninguna contraseña ni código se guardó en documentos**; la contraseña de la cuenta de
Encargado nueva se generó en la página, se guardó solo en la memoria de la pestaña y se borró al
terminar. Sin producción, sin `sis-13`, sin llamadas a funciones de QA desde la consola.

## Cambios de configuración (autorizados y revertidos)

| Hora (UTC) | Cambio | Quién | Resultado |
|---|---|---|---|
| 08:00:58 | Máximo del Encargado 0 % → **5 %** | Propietario | Guardado |
| 10:03:09 | «Puede aplicar» del Encargado no → **sí** | Propietario | Guardado |
| 10:16:09 | **Restauración**: máximo 0 %, «Puede aplicar» no | Propietario | Política idéntica a la original |

Política final comprobada en el servidor: Encargado 0 %, solicitar sí, aplicar no, autorizar no,
escalar sí, sin cortesías, doble aprobación no; Propietario sin cambios. Al guardar, la pantalla
reescribe también la política del Propietario (cambia su fecha de actualización, no su contenido).

## Cuenta de prueba creada (autorizada)

- Empleado «QA Auditoria Encargado2 20261126» y cuenta `qa-aud-encargado2-20261126@qa.invalid`,
  rol Encargado, QA-A1 (membresía activa comprobada en el servidor). Se puede desactivar desde
  Equipo. La cuenta anterior de Encargado ya no tiene contraseña disponible.

## Parte A · descuento aplicado y reparto

| Hora | Acción | Resultado |
|---|---|---|
| 07:56 | Abrir caja con fondo 0,00 € | `011c2138-7281-4908-ab24-3a31d5bbc473` ABIERTA |
| 07:5x | Cuenta P: 1 agua, guardar y enviar | Cuenta `70df6120…`; stock 68 → 67 |
| 07:58 | **Descuento del 10 % del Propietario** en la línea enviada | Base 0,9091 → 0,8182, IVA 0,0909 → 0,0818, importe 0,0909; **sin movimiento de caja ni de stock**; `abc_descuentos_aplicados` 6 → 7 |
| 07:59 | Cuenta Q (1 agua en borrador) como destino; repartir 1 unidad de P a Q | Reparto ACTIVO en Q; **el descuento viaja con la línea** (Q pasa a 1,90 € = 1,00 + 0,90) |
| 08:00 | Devolver la unidad desde Q a P («Mover producto» al revés) | Reparto de Q CERRADO y nuevo reparto ACTIVO en P |
| 08:0x | Cancelar el pedido de Q | CANCELADO |

La pantalla no tiene botón «Deshacer un reparto» aunque existe la capacidad
`ABC_REPARTO_REVERTIR`; deshacerlo es mover de vuelta desde la cuenta destino.
`abc_revertir_cuota_importe` es para repartos por importe y no tiene pantalla.

## Parte B · escalado del descuento del Encargado

| Hora | Quién | Acción | Resultado |
|---|---|---|---|
| 09:02 | Encargado2 | Cuenta E: 1 agua, guardar y enviar | `6d2740d7…`; stock 67 → 66 |
| 09:0x | Encargado2 | Pedir 10 % con máximo 5 % y «Puede aplicar» no | `descuento_aplicar_no_autorizado` (H-39) |
| 10:04 | Encargado2 | Pedir 10 % con máximo 5 %, solicitar, aplicar y escalar | **PENDIENTE_AUTORIZACION**: «Supera el límite del rol solicitante; debe autorizarla alguien con capacidad suficiente» |
| 10:07 | Propietario | Aprobar con motivo | APROBADA; **no se aplica sola** (aplicados siguen en 7) |
| 10:0x | Encargado2 | «Reintentar aplicación» con el formulario vacío | `operation_id_conflict` (H-44) |
| 10:0x | Encargado2 | Aplicar repitiendo exactamente tipo, valor y motivo | **APLICADA**: descuento 0,0909 €, base 0,8182 €, solicitante Encargado2, autorizador Propietario, autorización APLICADA; aplicados 7 → 8 |
| 10:1x | Encargado2 | Cierre de caja con contado 0,00 € (esperado 0,00 €) | Sesión **CERRADA_FINAL** |

## Antes y después (QA-EMP-A / QA-A1)

| Dato | Antes (06:45 UTC) | Después | Diferencia |
|---|---|---|---|
| `pagos` / `reembolsos` / `caja_operaciones` | 82 / 11 / 86 | 82 / 11 / 86 | 0 |
| `pedidos_tpv` / `cuentas_comerciales` | 127 / 127 | 130 / 130 | +3 (P, Q cancelado, E) |
| Cuentas abiertas | 86 | 89 | +3 |
| Descuentos aplicados / autorizaciones | 6 / 3 | 8 / 4 | +2 / +1 |
| Repartos nuevos | — | 4 | 2 cerrados y 2 activos |
| Stock del agua QA-A1 (almacén / piso) | 68 / 0 | 66 / 0 | −2 |
| Sesiones de caja abiertas en A1 | 0 | 0 | 0 |

## Resultado

- **Descuento aplicado por el Propietario (F-12/R-24): PASS**, con importes correctos y sin
  efectos de caja ni de stock.
- **El descuento viaja con la línea repartida: PASS.**
- **Devolver un reparto moviendo de vuelta: PASS.**
- **Escalado Encargado → Propietario → Encargado: PASS**, pero **solo con una política que el
  administrador no esperaría**: máximo mayor que 0, «Puede solicitar», «Puede aplicar» y «Permite
  escalado». Con la política original (máximo 0 %, aplicar no) el Encargado no puede ni solicitar
  (H-39).
- **La aprobación no aplica el descuento por sí sola: PASS.**
- **«Reintentar aplicación»: FAIL** (H-44).

## Comprobación de impresión (sin escrituras)

Con la sesión del Propietario, el ticket de la venta TPV-000045 se abrió desde el historial y se
pulsó «Imprimir / Guardar PDF» con `window.print` sustituida por un contador: **una llamada**. Existe
una regla `@media print` que oculta todo salvo `.zona-impresion`, y el ticket está dentro de esa
zona. **No se abrió el cuadro de impresión real ni se generó un PDF.**

## Reservas

- La política temporal se restauró y se comprobó en el servidor, pero durante ese tiempo el
  Encargado de QA-A1 tuvo permisos de descuento ampliados (la única cuenta de Encargado que lo
  habría usado era la de prueba). Concretamente: máximo 5 % durante unas 2 h 15 min y «Puede
  aplicar» durante unos 13 min.
- Quedan en QA 3 cuentas abiertas más (una con una línea enviada y con descuento, sin cobrar).
- El Propietario sigue con la sesión abierta en el navegador de la auditoría.
- Al cambiar de sesión con pendientes locales, la aplicación se bloqueó una vez: «Instalación
  bloqueada de forma segura… la copia local cambió mientras se archivaba» (H-46); se resolvió con
  «Reintentar comprobación».
