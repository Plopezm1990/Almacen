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

Resultado: **BLOQUEADO / no concluyente**; no es PASS. El pedido sigue en
`BORRADOR`, por lo que falta repetir esta prueba con la comanda confirmada y
enviada a Cocina, sin cobrar.

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

**T5 continúa PARCIAL. La Etapa 5 permanece ABIERTA.**

### Siguiente paso

1. Repetir la asignación de mesa con la línea confirmada y el pedido enviado a
   Cocina; el intento actual queda bloqueado porque la línea sigue en
   `BORRADOR` y el botón no muestra resultado.
2. Validar el envío a Cocina del fixture `Artículo varios (QA)` sin cobrar.
3. Si el plan exige probar el efecto económico, ejecutar una solicitud A09 de
   cortesía solo con el motivo y la autorización QA requeridos; no cobrar.
4. Mantener pendientes T6 (Bizum, propina, vale regalo, factura y email) y T7
   (impresora, puente y cajón) hasta disponer de sus entornos/equipos de QA.
