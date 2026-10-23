# Plan Maestro L&A Suite — Seguimiento T5 QA: artículo, sala y cortesía

Fecha: 23/10/2026  
Entorno: preview 175 · QA Empresa A, S.L. · Local A1  
Alcance: Etapa 5 del Plan Maestro L&A Suite. Solo QA; sin PROD ni SQL directo.

## 1. Fixture de artículo QA

Se preparó un fixture controlado mediante la interfaz visible de QA:

- Producto: `Artículo varios (QA)`.
- SKU: `QA-ET5-VARIOS-20261023`.
- Precio de venta con IVA: `2,00 €`; coste con IVA: `1,00 €`.
- Stock inicial: 10 unidades.
- Se traspasó 1 unidad al piso de venta mediante el flujo de Traspasos:
  quedaron 9 unidades en almacén y 1 en el piso.
- El producto apareció en el catálogo TPV y permitió añadir 1 unidad al
  borrador.
- El guardado devolvió `Pedido guardado`, modalidad `Barra`, estado `ABIERTO`,
  una línea y total `2,00 €`.
- Evidencia técnica del guardado: cuenta
  `0066780f-c04f-4d16-94ae-60735e44b861`; pedido
  `8175b6d3-cefe-4f33-9b2d-578c9e67b351`.
- No se cobró ni se envió la comanda.

### Repetición A05 con cuenta recuperada

Para separar el bloqueo de sala del estado `BORRADOR`, se repitió el flujo en
QA con cuentas recuperables y sin abrir ningún control de cobro:

- Primera repetición: `Pedido guardado` y después `Pedido enviado`, total
  `2,00 €`, 1 línea de `Agua 50 cl (QA)`, cuenta
  `e3724c02-bfd2-4a7d-aac3-70d97f8d00f4`, pedido
  `ecc2efc6-0fbb-4ba7-bc7d-b40b8a35fdd6`.
- Segunda repetición: `Pedido guardado` y después `Pedido enviado`, total
  `2,00 €`, 1 línea de `Agua 50 cl (QA)`, cuenta
  `b4a7c8ec-7213-4c88-8396-38faec9b4f9c`, pedido
  `5926d1f4-ca45-452a-a2b6-d194664a96d0`.
- En ambos casos el estado final visible fue `ENVIADO` y la línea quedó
  `ENVIADA`; el cobro permaneció en `0,00 €` confirmado, con el importe
  pendiente.
- No se inició preparación, no se canceló ninguna línea y no se cobró.

Resultado: **PASS parcial** para el caso de un producto catalogado usado como
fixture de artículo QA.

Esto no demuestra todavía un artículo libre con precio manual. El contrato
actual del servidor exige `producto_id` y recalcula precio/IVA desde catálogo.
La invitación debe pasar por el flujo de cortesía A09 y no por un producto de
precio cero.

## 2. Recuperación y resincronización

La cuenta nueva apareció finalmente en `Cuentas aparcadas / recuperables` como
`Cuenta …5e44b861`, con `1 línea(s) activa(s)` del día operativo. Se pulsó
`Recuperar cuenta` una sola vez.

- El servidor devolvió `Cuenta recuperada correctamente en este terminal`.
- El TPV reconstruyó la línea `Artículo varios (QA)` y mantuvo el total de
  `2,00 €` sin cobro.
- La línea quedó en estado `BORRADOR`; el pedido no se envió a Cocina.

Resultado: **PASS** para la recuperación y la resincronización del contexto.
La ausencia inicial de líneas en A09 era un problema de contexto local no
recuperado, no una ausencia de persistencia del pedido.

## 3. Sala y mesas

Con la cuenta recuperada se abrió `Mesa QA-A1-01`, se dejaron los dos
comensales por defecto y se intentó `Asignar esta cuenta` mediante el flujo
visible.

- La mesa siguió mostrando `LIBRE · 0/4 personas`.
- No apareció confirmación ni error visible.
- El formulario permaneció abierto después de varios intentos.

Resultado de la primera ronda: **BLOQUEADO / no concluyente**; no es PASS. El
pedido de esa cuenta seguía en `BORRADOR`.

### Repetición con pedido enviado

Después de enviar dos pedidos QA sin cobro, se recuperó de nuevo una cuenta
con una línea `ENVIADA`, se abrió `Mesa QA-A1-01`, se mantuvieron 2 comensales
y se pulsó `Asignar esta cuenta` una vez, con una repetición controlada para
confirmar el evento. El resultado fue idéntico en ambas comprobaciones:

- La mesa continuó en `LIBRE · 0/4 personas`.
- El formulario `Asignar Mesa QA-A1-01` permaneció abierto.
- No apareció `role=alert`, confirmación ni cambio de ubicación.
- La cuenta siguió mostrando el pedido `ENVIADO` y la línea `ENVIADA`.

Resultado de la repetición: **FAIL / BLOQUEADO reproducible**. El bloqueo no
venía de la RPC ni de las versiones de cuenta/mesa: la función sí estaba
implementada, pero `crearLogicaVenta` no la incluía en el objeto que devuelve.
Por eso `VentaRapida` recibía `asignarMesaCuentaA07` como `undefined` y el
guard del formulario salía silenciosamente antes de iniciar la RPC. Se corrigió
la exportación en `fuente.js` y en `source-recovery/fuente-recuperado.js` para
mantener ambos artefactos alineados. En el preview reconstruido se repitió la
prueba una sola vez sobre la cuenta QA recuperada:

- `Mesa QA-A1-01` pasó a `OCUPADA · 2/4 personas · 1 cuenta(s) activa(s)`.
- La cuenta mantuvo su pedido `ENVIADO` y la línea `Agua 50 cl (QA)` en
  `ENVIADA`.
- El cobro no se activó: `Confirmado €0,00` y `Pendiente €2,00`.

Resultado de asignación: **PASS**. La modificación fue exclusivamente de
ubicación/comensales en QA.

## 4. Descuento/cortesía A09

Se abrió el panel `Descuento / cortesía` después de recuperar la cuenta y sin
aplicar cambios.

- El panel cargó correctamente.
- Ahora sí mostró la línea comercial del servidor:
  `Producto mvl860eb81drfo · cantidad 1,00 unidad · línea 297-2b6c00699117`.
- No había descuentos aplicados, autorizaciones pendientes ni líneas fiscales
  activas.
- `Aplicar / solicitar` permaneció deshabilitado porque no se rellenó el
  motivo; no se aplicó descuento ni cortesía y no se modificó el importe.

Resultado: **PASS** para lectura de líneas y controles de seguridad A09;
queda pendiente probar una solicitud de cortesía autorizada en un caso de QA
aislado, si el plan lo exige.

## 5. Catálogo visible

En este preview ya están visibles los fixtures siguientes:

- `QA AUD002 3DEC 20261022`: `sin stock`, con botones deshabilitados.
- `QA Fixture E3 Foto MasVendido Alergenos`: marca `Más vendido` y
  `Alérgenos: gluten`.
- El catálogo muestra además `Artículo varios (QA)` con precio y botones de
  cantidad.

Estos puntos dejan de estar bloqueados por ausencia de datos. Falta repetir la
validación completa dentro de una venta enviada a Cocina si el caso lo exige.

## 6. Estado de Etapa 5

La ronda se mantuvo en QA, no accedió a PROD, no ejecutó SQL directo y no
registró cobros.

**La asignación de mesa de T5 queda PASS. T5 continúa PARCIAL y la Etapa 5
permanece ABIERTA.**

### Siguiente paso

1. Validar en Cocina el envío del fixture `Artículo varios (QA)` sin cobrar;
   los dos envíos usados en la repetición fueron de `Agua 50 cl (QA)`.
2. Si el plan exige probar el efecto económico, ejecutar una solicitud A09 de
   cortesía solo con el motivo y la autorización QA requeridos; no cobrar.
3. Mantener pendientes T6 (Bizum, propina, vale regalo, factura y email) y T7
   (impresora, puente y cajón) hasta disponer de sus entornos/equipos de QA.
