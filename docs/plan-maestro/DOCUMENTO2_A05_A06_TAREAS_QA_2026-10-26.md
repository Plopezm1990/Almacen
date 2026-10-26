# Documento 2 · A05/A06 Mesas, cuentas y pedido operativo en QA

**Fecha:** 2026-10-26  
**Referencia:** `LA-Suite-TPV-puesto-unico-documento-2.pdf`, láminas A05 y A06  
**Ámbito:** QA exclusivamente (`qjqorixtkilwsndqayyx`)  
**Estado:** IMPLEMENTACIÓN PREPARADA — pendiente de publicación y comprobación viva

## 1. Objetivo

Continuar la adaptación visual del puesto único a las láminas A05/A06 del documento: una tarea operativa debe leerse como una pantalla de trabajo propia, sin que el catálogo y el ticket de Venta compitan con ella.

El alcance de este bloque es visual y de accesibilidad. No cambia permisos, consultas, mutaciones, estados de negocio ni contratos server-side.

## 2. Cambios preparados

Se han marcado las tarjetas reales de `VentaRapida` en las dos fuentes que deben mantenerse sincronizadas:

- `renderCuentasRecuperablesA06()` → cuentas aparcadas/recuperables.
- `renderSalaA07()` → sala, mesas, ocupación y responsable.
- `renderPedidoOperativoA05()` → pedido operativo, líneas y estados.

El bloque visual común añade:

- anchura de trabajo limitada y centrada;
- mayor separación interna y radios coherentes con A03/A04;
- títulos de tarea más legibles;
- objetivos táctiles de al menos 48 px para botones;
- tarjetas de mesa/cuenta con altura mínima de 112 px en escritorio y 96 px en móvil;
- foco visible con `--c-focus-ring` en tarjetas seleccionables;
- rejilla de mesas de tres columnas en escritorio y dos en móvil;
- mayor ritmo vertical para las líneas del pedido y sus estados;
- reducción controlada en móvil sin romper el ancho del viewport.

## 3. Límites funcionales

Durante la validación se leerán las pantallas activas de Sala y Operativa, pero no se pulsarán mesas, Aparcar, Actualizar, Cambiar responsable, Iniciar preparación, Cancelar línea, Cancelar pedido ni controles de cobro. Las operaciones reales de servidor quedan fuera de esta revisión visual.

No se toca el proyecto Supabase de producción (`flqercbgpgmmfaakrwkc`), el deploy de producción ni los datos de QA. La preview de PR #175 es el único destino de comprobación.

## 4. Contrato de no regresión

Se añade `tests/plan-maestro/documento2-a05-a06-tareas-contract.mjs`, que comprueba en ambas fuentes:

- el marcador y el CSS idéntico del bloque A05/A06;
- las clases semánticas de cuentas, sala y pedido dentro de sus funciones reales;
- tamaños táctiles y foco visible;
- composición de tres columnas en escritorio y dos en móvil;
- conservación de los títulos y contenidos operativos de las tres tareas.

## 5. Validación prevista

Se ejecutarán comprobación sintáctica, el contrato específico, los contratos Documento 2 ya existentes, `git diff --check`, build y boundary de publicación. Después se publicará únicamente una preview de QA y se comprobarán Sala y Operativa a 1024×768 y 390×844, incluyendo ausencia de overflow horizontal y errores de consola.

## 6. Estado y siguiente paso

Este documento queda preparado antes de publicar para que el alcance sea auditable. Tras pasar las pruebas y la revisión viva, se cerrará como **TERMINADA** si las dos resoluciones mantienen la lectura de tarea y no aparecen regresiones.

El hardware físico de T9 permanece deliberadamente aparcado para el final, hasta disponer del equipo real. Después de A05/A06, el siguiente bloque no físico recomendado es completar las láminas A07/A08/A09 —cantidad, teclado de búsqueda/notas y descuento/cortesía— antes de volver al hardware.
