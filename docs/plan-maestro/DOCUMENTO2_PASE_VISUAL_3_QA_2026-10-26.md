# Documento 2 · Pase visual 3 del TPV en QA

**Fecha:** 2026-10-26  
**Referencia:** `LA-Suite-TPV-puesto-unico-documento-2.pdf`, láminas A03, A05, A06, A08 y A17  
**Ámbito:** QA exclusivamente (`qjqorixtkilwsndqayyx`)  
**Estado:** TERMINADA — tercera pasada visual desplegada y comprobada

## 1. Objetivo de esta pasada

La segunda pasada fijó la jerarquía de Venta: cabecera, búsqueda, categorías, catálogo, ticket y navegación operativa. Esta tercera pasada aborda el problema que aparecía al entrar en las demás vistas: el catálogo seguía ocupando espacio aunque la tarea activa fuera Sala, Pedido, Descuento, Cobro o Caja.

El criterio aplicado es el del documento: una pantalla debe mostrar una tarea principal reconocible, con controles grandes y sin duplicar el contenido de Venta. Se mantiene el alcance visual y no se cambia la semántica de negocio ni el contrato server-side.

## 2. Cambios realizados

Se ha añadido el bloque visual de tercera pasada, idéntico en:

- `fuente.js`
- `source-recovery/fuente-recuperado.js`

Cambios principales:

- Las vistas operativas secundarias dejan de mostrar el layout de catálogo y ticket mientras están seleccionadas.
- El panel de la tarea activa se promociona como contenido principal de la pantalla.
- El historial se oculta en las vistas secundarias para que no compita con Sala, Pedido, Cobro o Caja; en Venta conserva su posición posterior.
- Cobro y Caja quedan centrados y limitados a una anchura de trabajo razonable, alineada con las láminas de tarea única.
- El teclado numérico de cobro conserva una cuadrícula táctil de tres columnas y botones de tamaño estable.
- En el rango de 901–1100 px se ajusta el puesto a una columna de catálogo y un ticket lateral de 300 px, que es la proporción útil para la lámina A03 a 1024 × 768.
- En móvil se mantiene el catálogo a dos columnas, se compactan las tarjetas, se conserva el ticket debajo y la navegación queda accesible como barra inferior desplazable.
- Se conserva el foco visible y no se eliminan las funciones existentes: solo cambia el orden y la visibilidad contextual.

## 3. Correspondencia con el PDF

La pasada cubre la composición y el comportamiento de las siguientes referencias:

- **A03:** Venta primero, con catálogo/ticket y adaptación de escritorio a móvil.
- **A05/A06:** la tarea secundaria queda aislada del catálogo y preparada para lectura de Sala, cuentas y pedido completo.
- **A08:** la pantalla de búsqueda/teclado conserva el toolbar y el espacio de tarea sin el ruido del ticket duplicado.
- **A17:** el puesto móvil conserva dos columnas, resumen inferior, ticket posterior y navegación táctil.

El acceso visual exacto de **A04**, con las nueve tarjetas 3×3 de “Opciones”, todavía requiere una decisión de producto: el código actual expone siete pestañas operativas (`Venta`, `Sala`, `Reparto`, `Operativa`, `Descuento`, `Cobro`, `Caja`) y no debe inventarse una nueva pantalla ni renombrar rutas sin cerrar esa decisión. Queda anotado como el siguiente ajuste de fidelidad, no como una tarea escondida.

## 4. Contrato de no regresión

Se añadió:

`tests/plan-maestro/documento2-pase-visual3-contract.mjs`

El contrato comprueba que:

- existe el marcador de la tercera pasada en ambos archivos;
- las seis pestañas secundarias ocultan el layout de Venta;
- el panel no oculto se promociona y el historial se retira de esas vistas;
- existen los ajustes de 1024 px y móvil;
- se conserva el ajuste de Cobro/Caja y del teclado numérico;
- la fuente activa y la recuperación contienen exactamente el mismo bloque visual.

## 5. Validación técnica

Se han ejecutado:

- `node --check fuente.js`
- `node --check source-recovery/fuente-recuperado.js`
- contratos Documento 2 Fase 1 a Fase 5;
- contratos de pase visual 1 y 2;
- contrato de revisión de salida y recuperación;
- contrato de sincronización local P13;
- `git diff --check`;
- build de publicación Netlify;
- límite de publicación Netlify.

La publicación no incorpora los documentos ni las pruebas en el payload público: el boundary de publicación mantiene esa separación.

## 6. Comprobación viva en QA

La preview del PR #175 se comprobó sobre el tenant de QA, con la sesión de datos de Empresa A, S.L. / Local A1 / TPV. Se verificó sin guardar pedidos ni pulsar artículos:

- Venta carga el catálogo y el ticket vacío.
- La navegación operativa sigue visible y accionable.
- Las vistas secundarias no arrastran visualmente el catálogo/ticket de Venta.
- Cobro conserva el panel centrado y el teclado numérico.
- El layout responde a escritorio de 1024 × 768 y a móvil de 390 × 844.
- No se alteraron productos, cuentas, inventario, empresa, local, permisos ni producción.

## 7. Siguiente paso

El siguiente trabajo recomendado es un pase específico de A04: decidir si “Opciones” será una pantalla 3×3 propia o una reorganización de las siete pestañas actuales. Después de esa decisión se puede cerrar la fidelidad de A04 y repetir la comprobación de A03/A17 antes de pasar a una revisión final de accesibilidad y hardware.

**Pase visual 3 QA: TERMINADA.**  
Producción continúa sin cambios.
