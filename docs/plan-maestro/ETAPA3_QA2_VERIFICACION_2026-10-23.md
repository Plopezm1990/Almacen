# Plan Maestro L&A Suite — Verificación QA-2 de la Etapa 3

Fecha: 23/10/2026  
Ámbito: exclusivamente Plan Maestro L&A Suite  
Preview: `deploy-preview-172--chic-entremet-9107cf.netlify.app`  
Entorno: QA · `QA Empresa A, S.L.` · `Local A1`  
Producción: no tocada

## Resultado de esta sesión

La sesión completa los puntos visuales y de seguridad operativa que estaban
pendientes en QA-2. No constituye todavía el cierre de la Etapa 3, porque la
aceptación global requiere conservar y repetir la batería completa T1–T4 en un
estado limpio y confirmar todos sus criterios de regresión.

## Evidencias

### Catálogo y ficha de producto

- Fixture QA utilizado: `QA Fixture E3 Foto MasVendido Alergenos`.
- Se actualizó únicamente desde la pantalla de Productos de QA la URL HTTPS de
  la foto a:
  `https://deploy-preview-172--chic-entremet-9107cf.netlify.app/la-suite-logo.svg`.
- La tarjeta del TPV mostró visualmente la imagen de L&A Suite: **PASS**.
- La tarjeta mostró `Más vendido`: **PASS**.
- La tarjeta mostró `Alérgenos: gluten`: **PASS**.
- El producto `QA AUD002 3DEC 20261022` continuó mostrando `sin stock` y sus
  botones rápidos permanecieron desactivados: **PASS**.

### TPV y seguridad de la prueba

- Se comprobó que el TPV estaba en `Local A1` y tarifa `General`.
- El fixture se añadió accidentalmente al carrito durante la inspección visual
  para poder confirmar la tarjeta y se retiró inmediatamente después.
- El carrito quedó vacío al terminar.
- `F4 Vaciar` y `F9 Guardar` quedaron desactivados con el carrito vacío:
  **PASS**.
- No se creó un pedido nuevo, no se registró cobro y no se modificó ninguna
  venta existente.

### Opciones, notas y alérgenos

- El configurador de `Bocadillo de tortilla (QA)` mostró opciones, el campo
  `Nota para cocina (opcional)` y el resumen de alérgenos: **PASS de presencia
  de controles**.
- No se guardó un pedido nuevo en esta comprobación, para no generar otra
  comanda QA ni interferir con el pedido operativo ya existente.

### Cocina

- La ruta guardada para `Bocadillo de tortilla (QA)` quedó asociada a
  `COCINA-QA · Cocina QA-A1`.
- La comanda existente `3af9f2430e23` dejó de mostrar `Sin estación BLOQUEADA`
  y aparece como `Cocina QA-A1 PENDIENTE`: **PASS de la ruta vigente**.
- No se creó ni se reenvió una comanda nueva.

## Incidencias y límites conservados

- Sigue visible un aviso de guardado local relacionado con `historialRespaldos`;
  no bloqueó la verificación visual del catálogo.
- La evidencia de esta sesión es QA y de interfaz. No autoriza extrapolar el
  resultado a PROD.
- No se ejecutaron escrituras SQL directas, migraciones ni cambios de
  configuración de producción.

## Estado de la Etapa 3

**ABIERTA — aceptación QA-2 parcial completada.**

Para cerrar la etapa todavía hay que ejecutar una repetición limpia de T1–T4,
conservar evidencia del resultado y resolver o aceptar formalmente cualquier
aviso de sincronización pendiente que aparezca durante esa regresión.

## Lo siguiente

Repetir la batería QA-2 completa en el preview vigente, empezando por T1 con
carrito vacío, después T2–T4, y registrar el acta de aceptación o las
incidencias que queden. Si todas salen PASS y no aparece ningún bloqueo, se
podrá formalizar el cierre de la Etapa 3.
