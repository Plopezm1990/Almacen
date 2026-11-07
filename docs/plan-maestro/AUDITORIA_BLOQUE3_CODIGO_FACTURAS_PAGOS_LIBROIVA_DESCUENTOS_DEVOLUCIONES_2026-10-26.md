# Auditoría completa L&A Suite — Bloque 3 (código): Facturas, Pagos, Libro IVA, Descuentos y Devoluciones

Fecha: 26/10/2026
Entorno: QA, Deploy Preview `#181` (borrador) — `https://deploy-preview-181--chic-entremet-9107cf.netlify.app`
Rama: `audit/qa-preview-2026-10-26`

## 0. Alcance de este bloque

Siguiendo el orden por impacto económico/fiscal de la auditoría, el Bloque 3 cubre
las 5 pantallas que todavía estaban sin revisar y que mueven dinero o generan
documentos fiscales: `facturas`, `pagos`, `libroiva`, `descuentos`, `devoluciones`.
Esta parte es la revisión de **código** (cálculos, validación cliente↔servidor,
permisos). La parte de **prueba en vivo** está en
`AUDITORIA_COWORK_BLOQUE3_FACTURAS_PAGOS_2026-10-26.md`.

Componentes revisados: `PoliticasDescuentos` (`fuente.js:104482`), `LibroIva`
(`fuente.js:123446`), `Devoluciones` (`fuente.js:123937`), `Facturas`
(`fuente.js:123005`), `CuentasPorPagar` (`fuente.js:121658`), y sus funciones de
guardado (`registrarDevolucionCliente`/`registrarDevolucionProveedor` en
`fuente.js:109543-109780` aprox.) junto con las RPC de servidor correspondientes.

## 1. Hallazgos positivos (confirmados en código)

**P1 — El Libro de IVA ya evita el doble conteo histórico (AUD-003).**
`LibroIva` (`fuente.js:123455`) excluye explícitamente del IVA soportado cualquier
albarán que ya esté incluido en una factura directa:
`!albaranIncluidoEnFacturaDirectaPM11(a22, facturasDirectas)`. Esto confirma que el
riesgo de doble conteo (albarán + factura directa contando el mismo IVA dos veces)
está resuelto en esta vía de cálculo, al menos para este cruce concreto.

**P2 — Devoluciones: validación simétrica cliente↔servidor (a diferencia del bug de cobro en efectivo).**
En `registrarDevolucionCliente` (`fuente.js:109543-109694`) el cliente valida: cantidad
> 0, cantidad acumulada ≤ cantidad original de la venta, reembolso ≥ 0, reembolso
acumulado ≤ tope calculado por `cantidadDevuelta × brutoUnitario` (redondeado a
centavos), motivo obligatorio, medio de reintegro coherente con el importe. La
función de servidor `registrar_devolucion_venta`
(`supabase/migrations/20260916195500_p2_r03a_restore_pm08_pm09_post_reset.sql:498-563`)
repite exactamente las mismas reglas con `for update` (bloqueo de fila) y además
comprueba: rol autorizado (`pm08_puede_operar_caja`), contexto empresa/local,
venta no anulada, y bloquea el reembolso en efectivo si ya hay un arqueo `ACTIVO`
para esa fecha (`periodo_caja_cerrado`). **No encontré aquí la discrepancia de
tolerancia numérica que causó H-CRIT-01** en el cobro en efectivo — los dos lados
usan el mismo cálculo redondeado a 2 decimales (`round(...,2)`).

**P3 — Devoluciones a proveedor: no permite stock negativo.**
`registrar_devolucion_proveedor`
(`supabase/migrations/20260916195500_...sql:565-602`) comprueba
`v_stock.almacen+v_stock.piso<v_cantidad` antes de descontar, y reparte la salida
entre almacén y piso de forma determinista (`least(...)`). El cliente
(`fuente.js:109760`) hace la misma comprobación de stock suficiente antes de llamar
al servidor (en el camino sin servidor/local).

**P4 — Patrón idempotente aplicado consistentemente.**
Las cuatro operaciones de este bloque (`registrar_devolucion_venta`,
`registrar_devolucion_proveedor`, `abc_configurar_descuento_politica` y el guardado
de facturas) usan `operation_id` único y comparan el `payload` completo antes de
responder `replayed:true` — reintentar tras un corte de red no duplica stock,
reembolso ni deuda.

## 2. Hallazgos a vigilar / pendientes

**H3-01 — Documentación de migración desactualizada (no bloqueante, confirmado).**
El archivo `supabase/migrations/20261001230000_abc_f5_pm09_security_hardening.sql`
lleva en su cabecera: *"Local candidate only. Do not apply to QA/PROD until the
service_role caller inventory and compatibility gate described in the evidence
document have been reviewed."* Comprobé contra el proyecto QA real
(`qjqorixtkilwsndqayyx`, solo lectura) y **la migración `abc_f5_pm09_security
hardening` SÍ está aplicada en QA** (aparece dos veces en el historial: versiones
`20261002082225` y `20261020171714`). Es decir, el aviso de "no aplicar todavía" ya
no refleja la realidad — quedó desactualizado después de que otra sesión la
aplicara. No es un riesgo de producción (QA está aislado), pero es un documento que
puede inducir a error si alguien lo lee literalmente hoy. Recomendación: actualizar
o borrar esa advertencia ahora que está aplicada y probada.

**H3-02 — `window.prompt()` nativo para confirmar el importe de un pago (menor, UX).**
En `CuentasPorPagar` (`fuente.js:121691`), marcar una factura como pagada abre un
`window.prompt()` del navegador para pedir el importe, en vez de un modal con
`Input` propio como el resto de la aplicación. Es inconsistente visualmente, no se
puede estilizar, y en tablet/táctil (contexto habitual del TPV) el cuadro de
diálogo nativo puede comportarse de forma distinta a como lo prueba un ratón de
escritorio. No es un error funcional — el cálculo de validación tras el prompt
(`importe > 0`, `importe <= pendiente + 1e-3`) es correcto — pero merece
homogeneizarse con el resto de la UI en algún momento.

**H3-03 — `PoliticasDescuentos`: validación del servidor sin confirmar (pendiente, NO verificado).**
El cliente valida en `validarPolitica` (`fuente.js:104580-104587`) reglas de
negocio (p. ej. "cortesía exige máximo 100%", "autorizar exige máximo > 0"). No he
localizado todavía ni leído la definición completa de la RPC
`abc_configurar_descuento_politica` para confirmar si el servidor repite
exactamente las mismas reglas (como sí ocurre en Devoluciones) o si confía en el
cliente. Lo marco explícitamente como pendiente — no como una discrepancia
confirmada — porque no he leído ese código todavía.

**H3-04 — `Facturas`/conciliación factura↔albarán: lógica no auditada a fondo (pendiente).**
`confirmarFacturaConAlbaranes`, `clasificarAlbaranesFacturaAgrupada` y
`validarFacturaAgrupada` son el núcleo de cálculo de esta pantalla (vincular
albaranes recibidos, calcular base/IVA/total, decidir qué queda bloqueante). Es la
pieza más compleja del bloque y no la he revisado en profundidad todavía — solo he
leído el componente de UI que la consume. Queda pendiente una pasada de código
dedicada antes de poder decir algo concreto sobre su corrección.

## 3. Lo que todavía falta para cerrar este bloque

- Prueba en vivo con Cowork (ver documento de guion de pruebas).
- Leer `abc_configurar_descuento_politica` (servidor) para cerrar H3-03.
- Leer `confirmarFacturaConAlbaranes`/`clasificarAlbaranesFacturaAgrupada`/`validarFacturaAgrupada` para cerrar H3-04.
- Nada de esto ha tocado producción ni ha hecho ninguna escritura en QA: todo lo
  anterior es lectura de código y una sola consulta de solo lectura al historial
  de migraciones de QA.
