# Plan Maestro L&A Suite — Arranque de la Etapa 5 / QA-3

Fecha: 23/10/2026  
Ámbito: exclusivamente Plan Maestro L&A Suite  
Preview QA inspeccionado: `deploy-preview-172--chic-entremet-9107cf.netlify.app`  
Entorno: QA · `QA Empresa A, S.L.` · `Local A1`  
Producción: no tocada

## Estado

**ETAPA 5 ABIERTA — PREVUELO QA-3 COMPLETADO; NO CERRADA.**

La Etapa 5 del Plan Maestro es «TPV: caja, cobro e impresoras» y comprende
T5 Caja y mesa, T6 Cobro completo y T7 Impresoras y cajón. Esta hoja fija el
punto de partida antes de modificar el programa o preparar una nueva
validación. No se mezclan aquí tareas ni contratos del Plan ABC.

## Criterios de la etapa según el plan

### T5 — Caja y mesa

Debe cubrir, como mínimo:

- último ticket y reimpresión;
- entradas y salidas de caja desde el TPV;
- aparcar y recuperar una cuenta;
- artículo varios e invitación;
- cambiar y unir mesas.

### T6 — Cobro completo

Debe cubrir, como mínimo:

- Bizum;
- propina;
- vale regalo;
- billetes rápidos;
- factura a empresa con NIF y numeración propia;
- envío por email.

### T7 — Impresoras y cajón

Debe cubrir, como mínimo:

- impresoras Epson/Star directas desde navegador;
- puente L&A para el resto de impresoras;
- pantalla de impresoras/aparatos;
- cajón monedero con sus reglas de apertura.

## Lo que ya existe y se ha comprobado

### Caja y arqueo

- La navegación `Arqueo de caja` está disponible en QA.
- Se muestran fecha, efectivo esperado, otras ventas, base de efectivo,
  anulaciones, ajustes/reembolsos, entradas/retiradas y efectivo contado.
- Existe `Guardar arqueo` y el modelo conserva el historial; no se ha creado
  ningún arqueo nuevo durante este prevuelo.
- El contrato local PM09 de caja pasa completo (`PM09_P10_CAJA_CONTRACT_OK=1`).
- El contrato de UI PM08 se ejecuta con cero fallos cuando se le proporciona
  el directorio de dependencias de UI.

### TPV y pedido operativo

- QA muestra `Local A1` y tarifa `General`.
- El TPV conserva el ticket visible, historial de ventas, responsables,
  reparto y pedido operativo.
- El historial abre una venta y permite entrar en `Ver ticket / reimprimir`;
  la vista del ticket ofrece `Imprimir / Guardar PDF`. Validado en QA con
  `V-20261023-152967`.
- El TPV expone el cobro con `Cobrar efectivo` e `Iniciar tarjeta simulada`.
- El servidor mantiene la separación entre preparar/enviar/cancelar un
  pedido y cobrarlo; no se ha confirmado ningún cobro en este prevuelo.
- La Cocina conserva rutas, comandas y `Reimprimir`.

### Contratos de L&A Suite ejecutados

- `tests/f5/f5-etapa3-ui-contract.mjs`: PASS.
- `tests/f5/f5-etapa4-t1-t4-ui-contract.mjs`: PASS.
- `tests/f5/f5-tpv-line-notes-contract.mjs`: PASS.
- `tests/cfg/pm08-caja-ui-runtime.mjs`: PASS (14/14).
- `tests/pm09/p10-caja-contract.mjs`: PASS.
- `tests/cfg/cobro-lectura-static-contract.mjs`: PASS.
- `tests/plan-maestro/etapa5-t5-t6-ui-contract.mjs`: PASS (contrato base
  exclusivo del Plan Maestro; ticket/reimpresión y cobro base).
- `node --check fuente.js`: PASS.

El runtime de lectura de cobro no se declara verde en este arranque porque el
script histórico apunta a una instantánea `source-recovery` que no está
alineada con el `fuente.js` actual; al forzar el bundle actual, el adaptador
de imports del test no es compatible. Esto es una limitación del test, no una
prueba de que el cobro real esté aceptado.

## Ausencias verificadas que impiden cerrar QA-3

En la pantalla TPV y en el código actual no se han localizado aún:

- botones o flujo de Bizum;
- propina;
- vale regalo;
- billetes rápidos;
- factura a empresa con NIF y numeración propia desde el cobro;
- envío de factura/ticket por email;
- aparcar y recuperar cuenta como flujo visible del TPV (existe una rutina
  interna de recuperación, pero no una operación de usuario completa);
- artículo varios e invitación;
- cambio y unión de mesas como operaciones completas del TPV.

El punto «último ticket y reimpresión» deja de estar pendiente: queda
**PASS parcial** en QA para abrir el ticket e imprimir/guardar PDF. La salida
física por impresora sigue dentro de T7 y no se considera validada por esta
vista del navegador.

Por tanto, T5 y T6 están **PARCIALES**, no aceptados. La existencia de cobro
en efectivo/tarjeta y de funciones históricas de caja no equivale a cumplir
T6 completo.

## T7 y decisiones necesarias

La pantalla de equipos indica expresamente que el registro de aparatos «no los
conecta ni los configura». Solo aparecen identificadores de aparatos como
impresora de ticket, impresora de cocina y cajón monedero. No se ha hecho una
prueba física porque todavía no hay una impresora de prueba identificada.

Además, antes de ejecutar el apartado de email hay que fijar el proveedor y
la dirección de prueba. No se elegirá proveedor, no se enviará ningún correo
y no se comprará hardware automáticamente.

T7 queda **BLOQUEADA** hasta disponer de:

1. una impresora de prueba Epson/Star o un puente L&A de prueba;
2. el proveedor/dirección de email QA que se autorice para las pruebas.

## Datos y seguridad del prevuelo

- No se cobraron pedidos.
- No se enviaron correos.
- No se tocaron migraciones ni PROD.
- No se hicieron escrituras SQL directas.
- No se borraron los datos QA existentes.
- Los contratos `ABC_F5_*` no se usan como evidencia de esta etapa: son del
  Plan ABC y quedan fuera del ámbito.

## Decisión y siguiente paso

La Etapa 5 queda **abierta** con prevuelo documentado. El siguiente trabajo
es preparar la especificación y el contrato QA-3 de T5/T6, empezando por las
operaciones de cuenta/mesa y los métodos de cobro sin ejecutar cargos reales.
Después habrá que elegir el proveedor/destino de email y aportar una
impresora de prueba para desbloquear T7. Solo tras implementar y repetir
T5–T7 en QA se podrá declarar «ETAPA 5 CERRADA».
