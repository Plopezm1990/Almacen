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

## 2. Sala y mesas

Con la cuenta QA nueva se abrió `Mesa QA-A1-01`, se dejaron los dos comensales
por defecto y se intentó `Asignar esta cuenta`.

- La mesa siguió mostrando `LIBRE · 0/4 personas`.
- No apareció confirmación ni error.
- El formulario permaneció abierto después del intento.

Resultado: **BLOQUEADO / no concluyente**; no es PASS.

## 3. Descuento/cortesía A09

Se abrió el panel `Descuento / cortesía` sin aplicar cambios.

- El panel cargó correctamente.
- La cuenta se mostró sin líneas comerciales asociadas, aunque el pedido
  abierto mostraba total `2,00 €`.
- `Aplicar / solicitar` permaneció deshabilitado.
- No se aplicó descuento ni cortesía y no se modificó el importe.

Resultado: **BLOQUEADO por estado inconsistente de líneas/pedido**.

## 4. Catálogo visible

En este preview ya están visibles los fixtures siguientes:

- `QA AUD002 3DEC 20261022`: `sin stock`, con botones deshabilitados.
- `QA Fixture E3 Foto MasVendido Alergenos`: marca `Más vendido` y
  `Alérgenos: gluten`.
- El catálogo muestra además `Artículo varios (QA)` con precio y botones de
  cantidad.

Estos puntos dejan de estar bloqueados por ausencia de datos. Falta repetir la
validación completa dentro de una venta enviada a Cocina si el caso lo exige.

## 5. Estado de Etapa 5

La ronda se mantuvo en QA, no accedió a PROD, no ejecutó SQL directo y no
registró cobros.

**T5 continúa PARCIAL. La Etapa 5 permanece ABIERTA.**

### Siguiente paso

1. Corregir o diagnosticar el vínculo servidor entre pedido abierto, líneas
   comerciales y asignación de mesa.
2. Repetir la asignación de mesa y el panel A09 con una cuenta cuya línea esté
   confirmada por el servidor.
3. Validar el envío a Cocina del fixture `Artículo varios (QA)` sin cobrar.
4. Mantener pendientes T6 (Bizum, propina, vale regalo, factura y email) y T7
   (impresora, puente y cajón) hasta disponer de sus entornos/equipos de QA.
