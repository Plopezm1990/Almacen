# Documento 2 — A11–A16: cobro, documentos, cocina y caja

**Fecha:** 26/10/2026  
**Estado del bloque:** TERMINADA
**Alcance:** secciones 10–16 del cuerpo del PDF y láminas A11–A16  
**Entorno:** preview QA de la rama de recuperación  
**Producción:** no modificada  
**Supabase:** no utilizado ni modificado en este bloque

## 1. Correspondencia con el PDF

Este bloque continúa el trabajo visual y de contrato después de las láminas
A07–A09 y A10 (calculadora), cerradas en el bloque anterior. Aquí se cubren:

- **A11:** cobro dedicado con total confirmado, pendiente, recibido, cambio,
  teclado de efectivo y acción final claramente diferenciada.
- **A12:** documentos del cobro: factura a empresa y ticket por correo, con
  sus límites de simulación/QA y sin convertir la preparación de campos en un
  cobro real.
- **A13:** vale regalo, manteniendo su flujo separado del cobro ordinario.
- **A14:** pago pendiente, incierto o con respuesta perdida, preservando la
  referencia y bloqueando un segundo cobro hasta resolver el estado.
- **A15:** cocina y comandas por estación, con producto, cantidad, nota y
  estados legibles a distancia.
- **A16:** caja, movimientos de efectivo, arqueo y cierre como tareas distintas,
  incluyendo la revisión explícita de diferencias.

## 2. Cambios aplicados

Se añadieron marcadores semánticos en `fuente.js` y
`source-recovery/fuente-recuperado.js` para que la validación visual pueda
identificar cada lámina sin duplicar pantallas ni lógica:

- A11: marco de cobro, resumen de importes de 96px, acción final de 64px y
  teclas de efectivo de 56px.
- A13: marco propio para el vale regalo.
- A15: marco de cocina, tarjetas de comanda y separación de producto/cantidad;
  el producto se presenta a 22px, la cantidad a 28px y la nota conserva un
  campo táctil de al menos 48px.
- A16: marco de caja con anchura legible y cifras monoespaciadas mayores.

La modificación es visual y de marcado. Se conserva el comportamiento ya
existente: el servidor sigue siendo la autoridad para importes, permisos,
estaciones, rutas, caja y estados de pago.

## 3. Límites de esta validación

La prueba se ejecuta exclusivamente en QA. No se realizan:

- cobros, reintentos ni confirmaciones de pago;
- creación o modificación de pedidos, comandas, estaciones o rutas;
- cambios de stock o resolución de mermas;
- apertura de sesión, movimientos de caja, arqueo o cierre;
- emisión de vales, facturas, correos o reimpresiones reales;
- consultas ni escrituras en Supabase de producción.

La suite puede mostrar el esqueleto de cada pantalla y sus estados vacíos,
pero una validación completa con datos vivos requiere fixtures QA controlados
para cuenta cobrable, estaciones/comandas y sesión de caja.

## 4. Contrato de paridad

El contrato:

`tests/plan-maestro/documento2-a11-a16-puesto-contract.mjs`

comprueba en ambas fuentes:

- presencia de los marcos A11, A13, A15 y A16;
- paridad exacta del bloque CSS entre fuente activa y fuente de recuperación;
- jerarquía visible de cobro, documentos, vale, cocina y caja;
- bloqueo de pago incierto y separación de operaciones sensibles;
- tamaños mínimos establecidos por el PDF.

## 5. Evidencia de validación QA

La validación se realizó sobre el deploy QA de Netlify:

- deploy: `6adf5b0f1ab45ecc5124ca10`;
- commit: `02503e8fa1f804b1121a0269eb9c501379a15861`;
- preview: `https://deploy-preview-175--chic-entremet-9107cf.netlify.app/`;
- estado Netlify: `ready`;
- frontera de publicación: `NETLIFY_PUBLISH_BOUNDARY_PASS entries=68 tailwind_bytes=17764`;
- escaneo de secretos del deploy: sin coincidencias.

Comprobaciones visibles y de métricas:

- cobro: resumen de importes a 96 px de alto en móvil y escritorio; factura a
  empresa y ticket por correo visibles; no se disparó ningún cobro;
- vales: tarjeta A13 visible con radio de 14 px; no se emitió ningún vale;
- cocina: contenedor A15 visible, 37 comandas QA cargadas, producto a 22 px,
  cantidad a 28 px y campo de nota a 48 px;
- caja: contenedor A16 visible con anchura de 980 px en escritorio, sin
  desbordamiento horizontal ni vertical; no se abrió la caja ni se registró
  movimiento;
- consola del navegador: 0 errores;
- acciones sensibles: 0 cobros, 0 pedidos, 0 cambios de comanda, 0
  reimpresiones, 0 mermas, 0 aperturas/cierres y 0 escrituras de producción.

## 6. Estado y siguiente paso

**Estado actual:** implementación, contrato, build, deploy QA y comprobación
visual completados. El ajuste final del campo de nota se corrigió de 44 px a
48 px y quedó incluido en el deploy final.

**Siguiente:** realizar la prueba controlada de estados con fixtures QA
(cuenta cobrable, pago incierto, documentos, cocina y caja) sin tocar
producción; después queda la aceptación del hardware físico T9, que se mantiene
reservada para el final como se acordó.
