# F6 · D13 devoluciones: hallazgos y plan

Fecha: 2026-10-03
Alcance de este documento: **solo lectura** de las migraciones, del código de la aplicación y de la documentación, más **una consulta de solo lectura a QA** (cuántos pagos, reembolsos y efectos hay). **Ningún cambio de pantalla, de base de datos ni de despliegue.** Producción no consultada.
Autorización: «D13: devoluciones» elegida por Pedro el 3/10/2026 (solo QA). El plan se presenta antes de implementar y las decisiones de la última sección esperan su respuesta.
Estado: `PLAN_EJECUTADO_VER_RESULTADO` (decisiones A «Servidor, permiso y pantalla», B «Encargado y Propietario», C «Se aprueba en el acto» y D «No por defecto; lo activa el Propietario», Pedro, 3/10/2026; informe: `F6_D13_DEVOLUCIONES_RESULTADO_2026-10-03.md`)

## Qué pide D13

«Devoluciones: quién puede y hasta cuánto» → **Propietario y encargado; el cajero solo con aprobación; límite neto = cobrado menos devuelto menos reservado.** En la pieza 5 (permisos) se vio que el flujo actual no permite cumplirlo para el cajero, y se dejó **sin permiso** hasta cambiar el flujo (`F6_PIEZA5_PERMISOS_2026-10-02.md`, «Hallazgo (D13)»).

## Cómo funciona hoy

La pestaña **Devoluciones** tiene tres vistas: «De cliente» y «A proveedor» (el sistema anterior, que mueve stock) y **«Reembolso económico»** (flujo B08 sobre la base transaccional ABC). D13 trata de esta última.

| Paso | Función del servidor | Quién puede hoy | Qué hace |
|---|---|---|---|
| 1 · Solicitar | `abc_solicitar_reembolso` | Capacidad `ABC_REEMBOLSO_SOLICITAR`: **Propietario y Encargado** (Cajero y Camarero no; techo Encargado) | Comprueba pago confirmado, misma moneda, motivo y **saldo reembolsable** (por pago y por venta) y **reserva** el importe: reembolso en `PENDIENTE`. **Si el pago no es en efectivo, en la misma llamada encola el envío al proveedor** (`PROVIDER_REEMBOLSO`) |
| 2 · Confirmar (efectivo) | `abc_confirmar_reembolso_efectivo` | Capacidad `ABC_REEMBOLSO_CONFIRMAR`: los mismos roles | Crea **un único movimiento negativo de caja** en una sesión abierta del terminal |
| 3 · Cancelar | `abc_cancelar_reembolso` | `ABC_REEMBOLSO_CONFIRMAR` | Libera la reserva, **solo si todavía no se ha enviado a un proveedor** |
| 4 · Resultado del proveedor | `abc_resolver_reembolso` | **Solo el sistema** (`service_role`), no la pantalla | Registra `CONFIRMADO`, `RECHAZADO`, `CANCELADO` o `DESCONOCIDO` con la evidencia del proveedor |

- **No hay ningún proveedor conectado:** nada consume la cola de envíos (`PROVIDER_REEMBOLSO` solo aparece en la migración del outbox) y la pantalla avisa «El simulador no envía dinero a un proveedor real».
- **QA hoy:** 0 pagos, 0 reembolsos y 0 efectos pendientes. Para probar una devolución en pantalla habría que **generar antes un cobro de prueba**.

## Hallazgos

| Nº | Hallazgo | Consecuencia |
|---|---|---|
| H1 | **El efectivo ya tiene dos pasos con permisos distintos** (solicitar reserva; confirmar mueve el dinero) | Para el efectivo, lo que pide D13 se cumple separando quién solicita y quién confirma. Hoy las dos capacidades son idénticas (mismos roles, techo Encargado), así que no se puede dar «solicitar» al cajero sin dar también «confirmar» |
| H2 | **No efectivo: el envío al proveedor se encola al SOLICITAR** | Con un proveedor real, quien pueda solicitar movería dinero **sin aprobación**. Es el hallazgo de la pieza 5 y lo que bloquea el permiso del cajero |
| H3 | **Cancelar solo libera mientras no se haya enviado** | Con el envío inmediato, la ventana para rechazar una solicitud se cierra en cuanto se solicita: otra razón para mover el envío al paso de aprobar |
| H4 | **No existe el concepto «pendiente de aprobación»** | Hoy `PENDIENTE` significa «reservado» (y, si no es efectivo, «ya encolado»). La pantalla muestra solicitudes y estados con «Cancelar» y «Confirmar efectivo», pero nadie ve una lista de lo que espera una aprobación |
| H5 | **Autoaprobación** | Quien tenga las dos capacidades puede solicitar y confirmar la misma devolución. Para Encargado y Propietario D13 lo permite; para el cajero el servidor debe **impedir que apruebe la suya** |
| H6 | **«Hasta cuánto» ya está resuelto en el servidor** | `abc_max_reembolsable_pago` y `abc_max_reembolsable_venta` calculan cobrado − devuelto − reservado, con bloqueo ordenado para que dos solicitudes simultáneas no devuelvan de más. **No hay un límite por rol** (como el de descuentos de D12); D13 no lo pide |
| H7 | **Existe una guarda de moneda y de conversión** (`conversion_reembolso_no_habilitada`) | Solo devoluciones en la misma moneda del cobro. No cambia con D13 |
| H8 | **Los contratos históricos fijan el comportamiento actual** (`tests/f2/m03c`, `m04c`, `m04d` y `tests/f4/b08`) | Cambiar el momento del envío obliga a **actualizar esos contratos** (como pasó con A02.1 en la 6e). Son de las piezas F2/F4 y tocan dinero: riesgo medio a alto |
| H9 | **La vista «De cliente» (sistema anterior) no pasa por este flujo** | Registra devoluciones de stock con su propio reembolso fuera de ABC. No la he analizado a fondo; D13 se aplica solo al «Reembolso económico» salvo que Pedro diga otra cosa |

## Plan por pasos (todo solo QA; cada paso con sus pruebas)

| Paso | Qué incluye | Toca | Riesgo |
|---|---|---|---|
| D13-1 · Servidor: nada sale sin aprobar | `abc_solicitar_reembolso` **deja de encolar el envío**. Nueva `abc_aprobar_reembolso` (capacidad `ABC_REEMBOLSO_CONFIRMAR`) deja constancia de quién aprueba y cuándo y, si el pago no es en efectivo, **encola entonces** el envío. Dos columnas nuevas (aprobado por / cuándo) en lugar de un estado nuevo, para no tocar la máquina de estados. El servidor **impide aprobar la propia solicitud** a quien necesita aprobación. La solicitud de quien ya puede confirmar se aprueba en el acto (un solo paso, como hoy). Evento de auditoría `REEMBOLSO_APROBADO` | Una migración aditiva (`create or replace` de una función y dos columnas) | Medio a alto (dinero) |
| D13-2 · Permiso del cajero | `ABC_REEMBOLSO_SOLICITAR` pasa a poder darse al **Cajero/a** (techo Cajero); `ABC_REEMBOLSO_CONFIRMAR` **sigue con techo Encargado**. Por defecto el cajero **no** lo tiene: lo activa el Propietario en Configuración → Permisos (pieza 5) | Datos de la matriz de capacidades | Bajo a medio |
| D13-3 · Pantalla | En «Reembolso económico»: las solicitudes de quien necesita aprobación salen como **«Pendiente de aprobación»**, con **Aprobar** y **Rechazar** (con motivo) para quien puede confirmar; quien solo puede solicitar ve el estado y un aviso claro de que **no sale dinero hasta que alguien lo apruebe**. Mensajes en español para los errores nuevos | `ReembolsosEconomicosB08` y sus mensajes | Medio |
| D13-4 · Pruebas y contratos | Contrato vivo en réplica local y en QA con `ROLLBACK` (roles suplantados: cajero solicita, cajero no aprueba lo suyo, encargado aprueba, rechazo libera saldo, efectivo sin cambios), contrato estático de pantalla y de ejecución con servidor falso, averías provocadas, regresión de los contratos Node activos y **actualización de los contratos F2/F4 afectados** | Tests | — |
| D13-5 · Prueba en pantalla | Con una guía (o Cowork): hace falta **un cobro de prueba en QA** para tener un pago confirmado; después solicitar, rechazar, aprobar y confirmar en efectivo | Pedro / Cowork | — |

No cambia: el cálculo del saldo reembolsable, el bloqueo contra solicitudes simultáneas, la guarda de moneda, el movimiento negativo de caja del efectivo, `abc_resolver_reembolso` (sigue siendo solo del sistema), el stock (un reembolso económico no devuelve stock) ni la vista «De cliente».

## Decisiones que necesito de Pedro

**A · Alcance.**
- **Servidor, permiso y pantalla (D13-1 a D13-3)** (recomendada): el flujo completo y se puede probar en pantalla.
- **Solo servidor y permiso (D13-1 y D13-2)**: sin cambiar la pantalla; nadie vería ni aprobaría las pendientes desde ella.

**B · Quién aprueba.**
- **Encargado y Propietario** (recomendada): como hoy con `ABC_REEMBOLSO_CONFIRMAR`.
- **Solo el Propietario**: más estricto; un encargado no podría aprobar la devolución de un cajero.

**C · Cuando solicita un Encargado o el Propietario.**
- **Se aprueba en el acto, en un solo paso** (recomendada): igual que hoy; D13 dice que ellos no necesitan aprobación.
- **Siempre en dos pasos**, también para ellos (otra persona aprueba): más control, más fricción.

**D · Permiso del cajero por defecto.**
- **No por defecto; el Propietario lo activa en Configuración → Permisos** (recomendada).
- **Activado por defecto para el Cajero/a.**

Por defecto, y sin preguntar: **el cajero siempre necesita aprobación de otra persona** (sin límite de importe «libre»), la devolución en efectivo sigue exigiendo confirmar con una caja abierta, y solo se reembolsa en la moneda del cobro.

## Límites

- **No hay pagos en QA**: sin un cobro de prueba no se puede ver una devolución en pantalla. No he comprobado si el simulador de cobros de F4 permite generarlo desde el preview.
- **Sin proveedor conectado**: aprobar una devolución que no es en efectivo solo deja el envío en la cola; nadie lo procesa todavía (es lo previsto hasta conectar un proveedor).
- Un **Cajero/a** solo se prueba con las pruebas automáticas (no hay otro usuario de QA); con Cowork y la sesión de Pedro solo se prueba lo que ve el Propietario.
- Esto cambia una **función de dinero ya aplicada en QA**: se hará con migración aditiva, prueba contra la réplica local y contra QA con `ROLLBACK`, y contratos históricos actualizados a la vista.
- Producción: no autorizada; antes habría que registrar las pruebas nuevas en la puerta de CI general.
