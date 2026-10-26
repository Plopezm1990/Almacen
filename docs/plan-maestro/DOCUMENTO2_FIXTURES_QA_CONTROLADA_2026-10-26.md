# Documento 2 · Prueba controlada de fixtures QA

**Fecha:** 26 de octubre de 2026  
**Estado:** `C02_C03_RESUELTOS_QA_SIN_DUPLICIDAD_OBSERVADA`
**Alcance:** QA del puesto único de L&A Suite. No se ejecutó ningún cobro confirmado real ni se contactó con un proveedor real.

## 1. Objetivo

Comprobar, sobre el entorno QA y utilizando los datos que ya existían, que las vistas de cobro, documentos, cocina y caja pueden leer y presentar estados reales del servidor. También se intentó localizar una cuenta cobrable y un caso de pago incierto sin crear datos nuevos ni alterar una cuenta existente.

La prueba no autoriza ni sustituye:

- un cobro real confirmado sobre una cuenta nueva;
- reintentos de pago, resolución de una incidencia o devolución;
- apertura, movimiento o cierre de caja;
- emisión de factura, envío de ticket o reimpresión;
- creación de estaciones, rutas, comandas o cuentas;
- cualquier operación en producción.

Como parte de la preparación controlada se creó un intento de tarjeta **simulado y pendiente** en QA y se abrió una incidencia B04 para conservar el caso bloqueado. Después de una confirmación explícita para el paso financiero, la incidencia se resolvió con importes sintéticos de `1,00 €`; no hubo comunicación con una pasarela externa.

## 2. Entorno y evidencia

- Sitio: `chic-entremet-9107cf`.
- Proyecto Supabase usado: QA `qjqorixtkilwsndqayyx`.
- Proyecto Supabase producción: no usado.
- Alias QA: `https://deploy-preview-175--chic-entremet-9107cf.netlify.app/`.
- Deploy funcional inspeccionado: `6adf5b0f1ab45ecc5124ca10`.
- Commit del deploy funcional: `02503e8fa1f804b1121a0269eb9c501379a15861`.
- Identificador de la sesión: `qa=a11-a16-final`.
- Rol visible: Propietario, empresa `QA Empresa A, S.L.`, local `Local A1`.
- Consola del navegador durante la navegación: sin errores `error`.

## 3. Casos ejecutados

### C01 · Cuenta ya pagada y lectura de cobro

**Resultado: PASS (solo lectura).**

La vista Cobro presentó los valores server-side siguientes:

- Total: `€1,00`.
- Confirmado: `€1,00`.
- Pendiente: `€0,00`.
- Estado de cuenta: `PAGADO`.
- Último intento: `Confirmado`.

La vista también presentó el bloque de factura a empresa en modo simulador y el bloque de ticket por correo. No se pulsaron sus botones ni se escribieron datos.

### C02 · Cuenta cobrable del día

**Resultado inicial: BLOCKED (fixture no disponible). Fixture preparado después; ver §6.**

En la primera inspección, TPV → Sala informó: **“No hay cuentas recuperables en este momento”**. La mesa `QA-A1-02` aparecía ocupada con una cuenta activa, pero al abrir su selector solo se ofrecía asignarla al terminal; se canceló el selector sin asignar ni modificar nada.

En TPV → Operativa existía un pedido `ENVIADO` de `Agua 50 cl (QA)`, pero la aplicación indicó que la cuenta pertenecía a otro día operativo y requería resolución antes de continuar. No se pulsó `Iniciar preparación`, ni se intentó cobrarla.

Conclusión: no había una cuenta cobrable segura del día que permitiera probar el cálculo de pendiente, efectivo recibido y confirmación sin crear o modificar datos.

### C03 · Pago incierto y recuperación

**Resultado inicial: BLOCKED en la UI existente. Fixture simulado preparado y resuelto después.**

No se encontró en la UI QA existente una cuenta con intento `PENDIENTE` o `INCIERTO` que pudiera abrirse sin alterar datos. Posteriormente se preparó expresamente el fixture descrito en §6: tarjeta simulada QA en `PENDIENTE` e incidencia B04 `ABIERTA`. Ese fixture se resolvió después con datos sintéticos y quedó confirmado en QA.

El ensayo backend QA documentado previamente en `docs/plan-abc/F5_ENSAYO_INTEGRAL_QA_2026-10-02.md` cubrió transaccionalmente la retención de saldo, la resolución `CONFIRMED`, la liberación de reserva, la confirmación del pago y la ausencia de efecto de caja; aquel ensayo terminó con las transacciones revertidas y no constituye una prueba UI actual.

### C04 · Documentos de la venta

**Resultado: PASS de presentación; no ejecutado el efecto externo.**

La vista Cobro mostró los controles de factura y ticket con las advertencias de modo simulador/informativo. La pantalla global Facturas del mes mostró `0 factura(s) confirmada(s)`, por lo que no se afirmó que existiera una factura fiscal emitida.

No se pulsaron `Emitir factura`, `Enviar ticket por correo` ni `Imprimir ticket (simulado)`. Esto deja pendiente comprobar los efectos de documento y sus reintentos con fixtures autorizados.

### C05 · Cocina y comandas

**Resultado inicial: PASS de lectura y presentación; rutas incompletas. Fixture nuevo enrutado después.**

La pantalla Cocina y comandas cargó 37 tarjetas visibles del servidor. Se observaron estados `NUEVA`, `RECIBIDA`, `PENDIENTE` y `BLOQUEADA`, incluidas comandas con notas de cocina como `QA-F5-NOTA-COCINA-20261022`, `QA-ETAPA3-NOTA-3127EF3`, `QA-ETAPA3-ROUTE-3E0659B` y `PRUEBA QA F5 - sin cebolla`.

La interfaz mantuvo las acciones de cambio deshabilitadas en esta inspección. No se pulsó `Reimprimir`, no se envió ningún cambio y no se editaron notas.

Hallazgo de la primera lectura: la pantalla informó **“No hay estaciones configuradas todavía”**, dejó `Crear estación` deshabilitado y no ofreció una estación seleccionable para guardar rutas. En la segunda lectura, tras recargar el contexto, ya apareció la estación activa `COCINA-QA` con 5 rutas y la comanda nueva quedó enrutada a `Cocina QA-A1`; las comandas históricas `Sin estación` y `BLOQUEADA` no se modificaron.

### C06 · Caja y arqueo

**Resultado: PASS de lectura; operaciones financieras no ejecutadas.**

La pantalla Arqueo de caja presentó:

- sesión server-side: `ABIERTA`;
- día operativo: `2026-10-26`;
- efectivo esperado: `€1,50`;
- otras ventas: `€0,00`;
- base declarada: `€0,00`;
- desglose: fondo `€0,00`, entradas `€1,50`, salidas `€0,00`;
- movimientos contabilizados: `2`;
- historial anterior visible: `2026-10-25`, activo, cuadra, esperado y contado `€1,50`.

No se pulsó `Abrir caja`, `Añadir`, `Guardar arqueo`, `Contar por denominaciones` ni `Iniciar cierre`.

## 4. Integridad de la prueba

- Durante la inspección inicial no se creó ninguna cuenta, línea, comanda, estación o ruta.
- Durante la preparación posterior se creó únicamente la cuenta/pedido/línea QA identificada en §6 y se envió su comanda de prueba.
- No se asignó la mesa ocupada al terminal ni se modificaron comandas históricas.
- Se inició una tarjeta **simulada** y se abrió una incidencia B04 QA; no se confirmó ni liquidó el pago.
- No se generó ningún cobro real, devolución ni reintento.
- No se emitió factura, ticket ni impresión.
- No se abrió, movió ni cerró caja.
- Producción no fue consultada ni modificada.
- El navegador terminó la inspección sin errores de consola.

## 5. Resultado formal

La etapa de lectura UI de fixtures QA queda **TERMINADA**. La preparación y resolución de fixtures C02/C03 queda **TERMINADA**: la cuenta QA pasó de pendiente a pagada, la incidencia B04 quedó resuelta y una nueva lectura server-side mantuvo el mismo resultado.

La estación `COCINA-QA` ya aparece activa con 5 rutas. La nueva comanda del fixture quedó en estado `NUEVA · Cocina QA-A1 PENDIENTE`, por lo que el caso de cocina ya dispone de una ruta utilizable.

## 6. Fixture QA creado y resultado de resolución

La preparación se realizó el 26 de octubre de 2026 en `QA Empresa A, S.L. · Local A1`:

- Cuenta: `16cae507-2855-4c02-8d35-5a98abcf3b68`.
- Pedido: `0b28ba43-782a-4c0b-99cd-6b5f7931ac14`.
- Modalidad: `Barra`.
- Producto: `Agua 50 cl (QA)`.
- Importe: `€1,00`.
- Estado del pedido: `ENVIADO`.
- Comanda visible: sufijo de pedido `6b5f7931ac14`, en `Cocina QA-A1`, estado de entrega `PENDIENTE`.
- Pago: tarjeta simulada QA, intento `PENDIENTE`.
- Cuenta tras el intento: `PENDIENTE`, confirmado `€0,00`, pendiente `€1,00`.
- Incidencia B04: creada con motivo `Respuesta del proveedor perdida` y posteriormente `RESUELTA` con resultado `CONFIRMADO`.

Identificadores server-side obtenidos mediante lectura QA posterior:

- Checkout: `0a083f51-9936-4187-a65e-a696e247e4cf`, estado `COMPLETADO`.
- Pago: `c2ef67f6-762d-457c-9336-d5b8acb96c67`, medio `TARJETA`, estado `CONFIRMADO`.
- Intento: `6bcf07d1-ca1a-4c83-adec-72aa203822d1`, estado `CONFIRMADO`.
- Incidencia: `1688871a-db4e-442b-a1b2-37a26d53c789`, estado `RESUELTA`.
- Proveedor sintético: `QA-SIMULADOR`.
- Referencia sintética: `QA-REF-20261026-16CA`.
- Autorizado, capturado y liquidado: `1,00 €` en cada campo.

La UI mostró `Pago confirmado por el servidor`, `Cuenta: PAGADO`, `Último intento: Confirmado`, `Confirmado €1,00` y `Pendiente €0,00`. La acción de actualización volvió a leer esos mismos valores. No se emitió factura, no se envió ticket y no se registró movimiento de caja.

## 7. Control de duplicidad e idempotencia

La lectura directa y no mutante de QA encontró una única fila completada para cada operación del flujo:

- `f4.b02b03.pay.6bcf07d1-ca1a-4c83-adec-72aa203822d1` · `ABC_INICIAR_COBRO` · 1 evento.
- `f4.b04.incident.open.a3f5af1e-7240-4c47-91bb-53209da259a2` · `ABC_ABRIR_INCIDENCIA_COBRO` · 1 evento.
- `f4.b04.incident.resolve.2e2be5fb-455d-4579-b2c4-2bd27ac74062` · `ABC_RESOLVER_INTENTO` · 1 evento.

No se observan operaciones ni eventos duplicados, y la UI no ofrece un segundo cobro después de la confirmación. La repetición literal del mismo `operation_id` para comprobar la rama `replayed=true` no se ejecutó: la interfaz no expone ese control y reproducirlo mediante SQL saltaría el contexto autenticado de la UI. Por tanto, el resultado formal es **sin duplicidad observada**, no una afirmación de replay end-to-end.

## 8. Continuación comprobada el 26/10/2026

Se hizo una lectura adicional, exclusivamente de QA y sin mutaciones, antes de decidir la
limpieza de la fixture:

- La cuenta `16cae507-2855-4c02-8d35-5a98abcf3b68` sigue `ABIERTA`.
- El pedido `0b28ba43-782a-4c0b-99cd-6b5f7931ac14` sigue `ENVIADO`, versión `4`.
- El checkout sigue `COMPLETADO`, el pago e intento siguen `CONFIRMADO` y la venta fiscal
  `8d83372f-5e3b-42c7-991a-898d151c3dd1` sigue `ABIERTA` por `€1,00`.
- El único efecto asociado al cobro es `PROVIDER_COBRO`, estado `COMPLETADO`, con la clave
  de deduplicación `pago-intento:6bcf07d1-ca1a-4c83-adec-72aa203822d1`.
- No hay efectos de esta fixture en `PENDIENTE`, `EN_PROCESO` ni `ERROR`, y no hay fila de
  `caja_operaciones` asociada al cobro de tarjeta.

La limpieza no se ejecutó deliberadamente. El contrato server-side de cierre operativo solo
permite cerrar un pedido en estado `SERVIDO`; la UI actual muestra el pedido `ENVIADO` y solo
ofrece `Iniciar preparación`. No existe una función general autorizada de cierre de cuenta en
este recorrido. Forzar una transición de cocina o borrar filas directamente en QA introduciría
una mutación distinta de la prueba financiera, por lo que la fixture queda abierta y trazable
hasta que exista un procedimiento de limpieza QA aprobado.

## 9. Contratos locales del bloque siguiente

Se ejecutaron los contratos de T6/T7 con este resultado:

- Factura empresa en simulador: `PASS`.
- Ticket por correo: `PASS`.
- Impresión/cajón simulados: `PASS`.
- Tarjeta QA, Bizum operativo y vale regalo: `PASS`.
- Puente L&A pieza 1: `PASS` después de repetir el runner fuera del aislamiento local; el
  primer intento fue un bloqueo del entorno al abrir `127.0.0.1`, no un fallo del código.
- Puente L&A pieza 2: `PASS`.

La vista Cobro QA se dejó abierta con el pago confirmado. Se verificó que los controles de
factura y ticket existen, pero no se pulsaron: la factura crea un documento server-side y el
ticket invoca la función de correo, aunque ambos estén etiquetados como simulador/informativo.
No se introdujeron datos de empresa cliente, NIF ni correo, y no se realizó ninguna emisión,
envío o impresión.

## 10. C04 · factura simulada ejecutada

Con autorización puntual se ejecutó únicamente la factura simulada en QA, usando datos
ficticios:

- Receptor: `Cliente QA S.L.`.
- Identificador fiscal sintético: `B12345678`.
- Resultado visible: `Factura FA-000003 emitida (modo simulador)`.
- Documento server-side: `286d38f2-d74e-45d1-aec0-e2b85b2b5962`, estado `EMITIDO`.
- Evaluación fiscal: modo `SIMULADOR`, resultado `PREPARADO_SIMULADOR`, sin bloqueos.
- Eventos observados: uno de reserva de número, uno de clasificación y uno de emisión.
- Efectos pendientes asociados: ninguno; no se creó movimiento de caja.
- Consola del navegador tras la operación: sin errores.

La factura no activa fiscalidad real y no se contactó con un proveedor fiscal. El ticket por
correo no se ejecutó: falta un destinatario autorizado y esa acción invoca el servicio de
correo, por lo que queda separada de la factura.

## 11. Qué sigue

1. Obtener o definir el procedimiento autorizado para cerrar/purgar únicamente esta fixture QA,
   sin tocar producción y sin alterar comandas históricas.
2. Con una confirmación puntual y un destinatario concreto, probar el ticket informativo por
   correo y verificar el resultado server-side, el efecto de entrega y la idempotencia.
3. Después, revisar la impresión simulada y el puente local en modo no físico.
4. Mantener el hardware T9 para el último bloque, cuando esté disponible.

