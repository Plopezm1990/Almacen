# Documento 2 · Pase visual 2 del TPV en QA

**Fecha:** 2026-10-26  
**Referencia:** `LA-Suite-TPV-puesto-unico-documento-2.pdf`, lámina A03 · Pantalla principal del puesto  
**Ámbito:** QA exclusivamente (`qjqorixtkilwsndqayyx`)  
**Estado:** TERMINADA — segunda pasada visual desplegada y comprobada

## 1. Objetivo de esta pasada

La lámina A03 ordena la venta en este flujo: cabecera del puesto, búsqueda, categorías, catálogo y ticket simultáneos, y navegación inferior. Las herramientas ocasionales —calculadora, vales, puente, cajón e historial— no deben competir con el catálogo y el ticket al entrar en Venta.

La primera pasada había mejorado tamaños y tarjetas, pero todavía dejaba el resumen de catálogo/ticket y varias herramientas antes de la zona principal. Esta pasada corrige esa jerarquía sin cambiar las operaciones ni el contrato server-side.

## 2. Cambios realizados

Se ha añadido el bloque visual de segunda pasada, idéntico en:

- `fuente.js`
- `source-recovery/fuente-recuperado.js`

Cambios principales:

- La cabecera, zona/tarifa y barra de acciones quedan arriba con menos ruido visual.
- El aviso introductorio ocupa menos espacio y deja de desplazar la venta.
- La zona `.tpv-layout` pasa a ser el foco principal de la pantalla.
- El catálogo ocupa la columna principal y el ticket queda como columna lateral estable.
- La búsqueda y las categorías se compactan para empezar a ver artículos antes.
- Las tarjetas de productos se acercan a la proporción de A03: imagen arriba, nombre, precio y cantidades rápidas.
- El resumen duplicado “Catálogo y ticket” se elimina visualmente porque el catálogo y el ticket reales ya están presentes.
- La navegación operativa inferior queda después del bloque principal y con un tratamiento más parecido a una barra de opciones.
- Las herramientas secundarias quedan después de la navegación, manteniendo su funcionalidad para no romper las etapas ya cerradas.
- En pantallas de hasta 900 px el ticket pasa debajo del catálogo.
- En pantallas estrechas la barra de secciones se desplaza horizontalmente y las tarjetas conservan una zona táctil utilizable.

La regla es visual y de orden de presentación: no se han eliminado los flujos de calculadora, vale regalo, puente, cajón, historial, cobro, sala, reparto, operativo, descuento ni caja.

## 3. Contrato de no regresión

Se añadió:

`tests/plan-maestro/documento2-pase-visual2-contract.mjs`

El contrato comprueba que:

- existe el marcador de la segunda pasada en ambos archivos;
- el layout y la navegación tienen el orden esperado;
- el resumen duplicado conserva la regla de ocultación visual;
- existen los breakpoints de escritorio, tablet y móvil;
- la fuente activa y la recuperación contienen exactamente el mismo bloque visual.

Resultado: `DOCUMENTO2_PASE_VISUAL2=PASS`.

## 4. Validación técnica

También han pasado:

- `node --check fuente.js`
- `node --check source-recovery/fuente-recuperado.js`
- contratos Documento 2 Fase 1 a Fase 5;
- contrato de revisión de salida y recuperación;
- contrato de sincronización local P13;
- `git diff --check`;
- build de publicación Netlify;
- límite de publicación Netlify.

La publicación no incorpora los documentos ni las pruebas en el payload público: el boundary confirma que el paquete final conserva únicamente las entradas publicables.

## 5. Comprobación viva en QA

La preview del PR #175 quedó en estado `READY` con:

- commit: `7dc9e79bd1a30f075fc86d8f6e690bafa7d8d2d2`;
- deploy de preview: `6adf45040980a0a8a602725f`;
- alias: `https://deploy-preview-175--chic-entremet-9107cf.netlify.app/`.

Se comprobó en QA Empresa A, S.L. / Local A1 / TPV / Venta:

- el catálogo cargó 18 productos;
- se mostraron búsqueda, categorías y tarjetas de producto en el bloque principal;
- el ticket quedó visible y vacío, con total `€0,00`;
- F4 y F9 permanecieron deshabilitados al no existir líneas;
- las herramientas secundarias quedaron posteriores al bloque de venta;
- la paleta clara del documento se comprobó temporalmente y la preferencia original del navegador se restauró.

No se hizo ninguna acción destructiva ni de negocio:

- no se pulsó ningún producto;
- no se cambió la cantidad de ningún artículo;
- no se guardó ningún pedido;
- no se abrió cobro;
- no se abrió cajón;
- no se modificó inventario, empresa, local, permisos ni configuración.

## 6. Pendiente después de esta pasada

Todavía no se declara cerrada la fidelidad completa al PDF. El siguiente trabajo recomendado es el **Pase visual 3**, limitado a:

1. probar la lámina A03 en modo claro con el viewport de 1024 × 768;
2. revisar A04 y convertir las opciones ocasionales en accesos coherentes sin saturar Venta;
3. revisar A05/A06 para Sala, cuentas y pedido completo;
4. revisar A08 para búsqueda con teclado y A17 para móvil 390 × 844;
5. comprobar el mismo flujo con datos reales de catálogo y ticket, sin guardar;
6. decidir con el usuario qué nombres y navegación deben conservarse antes de tocar la semántica de las pestañas.

**Pase visual 2 QA: TERMINADA.**  
Producción continúa sin cambios.
