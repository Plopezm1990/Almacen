# Documento 2 · Prueba controlada de fixtures QA

**Fecha:** 26 de octubre de 2026  
**Estado:** `FIXTURES_QA_PREPARADOS_C02_C03_PENDIENTES`
**Alcance:** QA del puesto único de L&A Suite. No se ejecutó ningún cobro confirmado ni se contactó con un proveedor real.

## 1. Objetivo

Comprobar, sobre el entorno QA y utilizando los datos que ya existían, que las vistas de cobro, documentos, cocina y caja pueden leer y presentar estados reales del servidor. También se intentó localizar una cuenta cobrable y un caso de pago incierto sin crear datos nuevos ni alterar una cuenta existente.

La prueba no autoriza ni sustituye:

- un cobro real confirmado sobre una cuenta nueva;
- reintentos de pago, resolución de una incidencia o devolución;
- apertura, movimiento o cierre de caja;
- emisión de factura, envío de ticket o reimpresión;
- creación de estaciones, rutas, comandas o cuentas;
- cualquier operación en producción.

Como parte de la preparación controlada sí se creó un intento de tarjeta **simulado y pendiente** en QA y se abrió una incidencia B04 para conservar el caso bloqueado. No hubo autorización, captura, liquidación ni comunicación con una pasarela externa.

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

**Resultado inicial: BLOCKED en la UI existente. Fixture simulado preparado después; resolución pendiente.**

No se encontró en la UI QA existente una cuenta con intento `PENDIENTE` o `INCIERTO` que pudiera abrirse sin alterar datos. Posteriormente se preparó expresamente el fixture descrito en §6: tarjeta simulada QA en `PENDIENTE` e incidencia B04 `ABIERTA`. Todavía no se ha aprobado ni resuelto.

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

La etapa de lectura UI de fixtures QA queda **TERMINADA**. La preparación de fixtures C02/C03 queda **TERMINADA**, con una cuenta QA cobrable y un intento simulado pendiente bloqueado por una incidencia B04 abierta. La resolución de la incidencia, la aprobación simulada y la comprobación de idempotencia siguen pendientes para la siguiente ejecución controlada.

La estación `COCINA-QA` ya aparece activa con 5 rutas. La nueva comanda del fixture quedó en estado `NUEVA · Cocina QA-A1 PENDIENTE`, por lo que el caso de cocina ya dispone de una ruta utilizable.

## 6. Fixture QA creado y dejado preparado

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
- Incidencia B04: `ABIERTA`, motivo `Respuesta del proveedor perdida`.

El fixture se deja expresamente en ese estado para ejecutar la resolución en la siguiente prueba. No se pulsó `Aprobar pago simulado`, no se resolvió la incidencia y no se registró ningún importe en caja.

## 7. Qué sigue

El siguiente paso es ejecutar sobre este fixture, sin crear otra cuenta:

1. comprobar que la UI mantiene bloqueado un segundo cobro;
2. resolver B04 con proveedor y referencia sintéticos, importes autorizados/capturados/liquidados de `1,00 €` y evidencia sin datos de tarjeta;
3. verificar que la cuenta pasa a confirmada, que el pendiente queda en `0,00 €` y que no se duplica ningún efecto;
4. repetir el cobro una segunda vez para confirmar idempotencia;
5. cerrar la cobertura con documento y limpieza/reversión QA de acuerdo con las reglas del entorno.

El hardware T9 continúa reservado para el último bloque, cuando esté disponible.

