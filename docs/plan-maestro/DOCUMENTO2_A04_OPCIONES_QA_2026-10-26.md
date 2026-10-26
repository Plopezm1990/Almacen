# Documento 2 · A04 Opciones 3×3 en QA

**Fecha:** 2026-10-26  
**Referencia:** `LA-Suite-TPV-puesto-unico-documento-2.pdf`, lámina A04  
**Ámbito:** QA exclusivamente (`qjqorixtkilwsndqayyx`)  
**Estado:** TERMINADA — desplegada y comprobada en QA

## 1. Decisión aplicada

Se ha elegido una pantalla propia de **Opciones** con nueve tarjetas 3×3, accesible desde el TPV mediante el botón `Opciones`. No se ha creado una octava pestaña dentro de las secciones operativas: la pantalla sirve como lanzador visual y conserva las siete secciones existentes.

## 2. Tarjetas de la pantalla

La pantalla reproduce los nueve accesos de A04:

1. Mesas y cuentas → sección `Sala`.
2. Pedido actual → sección `Operativa`.
3. Cobrar → sección `Cobro`.
4. Cocina → salida controlada del TPV hacia la navegación general de Cocina.
5. Caja → sección `Caja`.
6. Calculadora → abre la calculadora A04 existente.
7. Documentos y correo → salida controlada del TPV hacia la navegación general del módulo.
8. Descuento/cortesía → sección `Descuento`.
9. Vales regalo → vuelve a `Venta`, donde permanece el bloque de vales existente.

Las tarjetas que llevan a módulos externos no inventan rutas ni duplican permisos. Las tarjetas internas reutilizan `setSeccionTpv` y la calculadora ya existente.

## 3. Adaptación visual

- Escritorio: cuadrícula 3×3, tarjetas amplias y foco visible.
- Móvil: cuadrícula 2×N para conservar lectura y tamaño táctil.
- Mientras Opciones está activa se ocultan temporalmente catálogo, ticket, historial, barra de búsqueda y navegación operativa para que la pantalla sea una tarea única.
- El botón `Volver a Venta` restaura la vista normal sin alterar carrito, cuentas ni datos del servidor.
- La implementación es idéntica en `fuente.js` y `source-recovery/fuente-recuperado.js`.

## 4. Contrato de no regresión

Se añadió:

`tests/plan-maestro/documento2-a04-opciones-contract.mjs`

El contrato comprueba las nueve etiquetas, el acceso independiente, los mapeos internos, la cuadrícula 3×3 de escritorio, la adaptación 2×N móvil y la igualdad entre la fuente activa y la copia de recuperación.

## 5. Validación técnica previa

Han pasado correctamente:

- sintaxis de ambas fuentes;
- contratos Documento 2 Fase 1 a Fase 5;
- pases visuales 2 y 3;
- contrato A04 Opciones;
- revisión de salida y recuperación;
- sincronización local P13;
- `git diff --check`;
- build de publicación Netlify;
- límite del payload publicable.

La comprobación viva en el preview de QA se realizó después de publicar el commit, navegando a Opciones a 1024×768 y a 390×844. No se pulsaron artículos, guardado, cobro, cajón ni tarjetas con efectos de negocio.

La comprobación viva se completó sobre el deploy QA `6adf50c0cb480c9ffd65d609`:

- A 1024×768 se visualizan las nueve tarjetas en una cuadrícula 3×3.
- A 390×844 se visualizan en dos columnas, sin desbordamiento ni textos cortados.
- El árbol de accesibilidad expone las nueve tarjetas con nombres descriptivos.
- La consola del navegador no registra errores.
- La suite quedó restaurada en viewport normal con A04 abierta.
- No se ejecutó ninguna acción de negocio ni se modificó producción.

## 6. Siguiente paso

El siguiente paso es la revisión final conjunta de fidelidad A03/A04/A17 y el pase de accesibilidad, teclado y hardware antes de considerar cerrado el bloque visual del Documento 2.

**A04 Opciones QA: TERMINADA.**
