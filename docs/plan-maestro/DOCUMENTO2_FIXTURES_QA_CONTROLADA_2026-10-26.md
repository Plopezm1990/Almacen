# Documento 2 · Prueba controlada de fixtures QA

**Fecha:** 26 de octubre de 2026  
**Estado:** `TERMINADA_CON_LIMITACIONES_DE_FIXTURE`  
**Alcance:** QA del puesto único de L&A Suite. No se ejecutaron operaciones irreversibles.

## 1. Objetivo

Comprobar, sobre el entorno QA y utilizando los datos que ya existían, que las vistas de cobro, documentos, cocina y caja pueden leer y presentar estados reales del servidor. También se intentó localizar una cuenta cobrable y un caso de pago incierto sin crear datos nuevos ni alterar una cuenta existente.

La prueba no autoriza ni sustituye:

- un cobro real o simulado sobre una cuenta nueva;
- reintentos de pago, resolución de una incidencia o devolución;
- apertura, movimiento o cierre de caja;
- emisión de factura, envío de ticket o reimpresión;
- creación de estaciones, rutas, comandas o cuentas;
- cualquier operación en producción.

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

**Resultado: BLOCKED (fixture no disponible, sin mutación).**

En TPV → Sala, la aplicación informó: **“No hay cuentas recuperables en este momento”**. La mesa `QA-A1-02` aparecía ocupada con una cuenta activa, pero al abrir su selector solo se ofrecía asignarla al terminal; se canceló el selector sin asignar ni modificar nada.

En TPV → Operativa existía un pedido `ENVIADO` de `Agua 50 cl (QA)`, pero la aplicación indicó que la cuenta pertenecía a otro día operativo y requería resolución antes de continuar. No se pulsó `Iniciar preparación`, ni se intentó cobrarla.

Conclusión: no había una cuenta cobrable segura del día que permitiera probar el cálculo de pendiente, efectivo recibido y confirmación sin crear o modificar datos.

### C03 · Pago incierto y recuperación

**Resultado: BLOCKED en la UI actual; comportamiento backend ya ensayado anteriormente.**

No se encontró en la UI QA una cuenta con intento `PENDIENTE` o `INCIERTO` que pudiera abrirse sin alterar datos. Por tanto, no se provocó un pago incierto ni se resolvió ninguna incidencia.

El ensayo backend QA documentado previamente en `docs/plan-abc/F5_ENSAYO_INTEGRAL_QA_2026-10-02.md` cubrió transaccionalmente la retención de saldo, la resolución `CONFIRMED`, la liberación de reserva, la confirmación del pago y la ausencia de efecto de caja; aquel ensayo terminó con las transacciones revertidas y no constituye una prueba UI actual.

### C04 · Documentos de la venta

**Resultado: PASS de presentación; no ejecutado el efecto externo.**

La vista Cobro mostró los controles de factura y ticket con las advertencias de modo simulador/informativo. La pantalla global Facturas del mes mostró `0 factura(s) confirmada(s)`, por lo que no se afirmó que existiera una factura fiscal emitida.

No se pulsaron `Emitir factura`, `Enviar ticket por correo` ni `Imprimir ticket (simulado)`. Esto deja pendiente comprobar los efectos de documento y sus reintentos con fixtures autorizados.

### C05 · Cocina y comandas

**Resultado: PASS de lectura y presentación; rutas incompletas en el fixture QA.**

La pantalla Cocina y comandas cargó 37 tarjetas visibles del servidor. Se observaron estados `NUEVA`, `RECIBIDA`, `PENDIENTE` y `BLOQUEADA`, incluidas comandas con notas de cocina como `QA-F5-NOTA-COCINA-20261022`, `QA-ETAPA3-NOTA-3127EF3`, `QA-ETAPA3-ROUTE-3E0659B` y `PRUEBA QA F5 - sin cebolla`.

La interfaz mantuvo las acciones de cambio deshabilitadas en esta inspección. No se pulsó `Reimprimir`, no se envió ningún cambio y no se editaron notas.

Hallazgo funcional del fixture: la pantalla informó **“No hay estaciones configuradas todavía”**, dejó `Crear estación` deshabilitado y no ofreció una estación seleccionable para guardar rutas. Esto explica por qué varias comandas aparecen `Sin estación` y `BLOQUEADA`; no debe confundirse con una incidencia nueva de producción.

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

- No se creó ninguna cuenta, línea, comanda, estación o ruta.
- No se asignó la mesa ocupada al terminal.
- No se cambió el estado de ninguna comanda.
- No se generó ningún cobro, devolución, pago incierto o reintento.
- No se emitió factura, ticket ni impresión.
- No se abrió, movió ni cerró caja.
- Producción no fue consultada ni modificada.
- El navegador terminó la inspección sin errores de consola.

## 5. Resultado formal

La etapa de lectura UI de fixtures QA queda **TERMINADA**. La cobertura no es una aprobación completa del flujo de cobro incierto porque el entorno no dispone actualmente de fixtures seguros para ese caso. La cocina y la caja sí quedan verificadas a nivel de presentación y lectura server-side, con la salvedad de que QA no tiene estaciones/rutas configuradas para esas comandas históricas.

## 6. Qué sigue

El siguiente paso recomendado es preparar un paquete de fixtures QA reversible y explícito, sin tocar producción, que incluya:

1. un día operativo actual con una cuenta abierta y cobrable;
2. una cuenta con intento de pago `PENDIENTE/INCIERTO` y su incidencia resoluble;
3. una estación QA y una ruta para eliminar el estado `Sin estación`;
4. una política clara para probar documentos en modo simulador sin enviar ni emitir fiscalidad real.

Después se repetirán C02 y C03, se comprobará idempotencia y se cerrará formalmente la cobertura funcional. El hardware T9 continúa reservado para el último bloque, cuando esté disponible.

