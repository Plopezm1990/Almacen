# PM13 · Punto 4.3 — Editor de pantallas por cargo

Fecha: 2026-10-17  
Rama: `codex/fix-product-bootstrap-context-20261015`  
Alcance: diseño y contrato de interacción del editor, con persistencia autorizada y auditada en servidor.

## Qué se entrega

- La configuración de cada cargo muestra un botón **Editar pantallas**.
- Las 45 pantallas del inventario se presentan agrupadas por área: Inicio, Compras, Almacén, Ventas, Costes y producción, Finanzas y análisis, Personal, Calidad y Sistema.
- Cada fila separa la etiqueta visible de su clave técnica y muestra una descripción de consulta.
- La selección distingue tres estados:
  - **Permitida para este cargo**: la pantalla está seleccionada para persistirse en el cargo.
  - **Denegada por este cargo**: el módulo está disponible, pero no se ha seleccionado.
  - **Módulo no contratado o inactivo**: el control queda deshabilitado y no puede habilitarse desde el editor.
- Se incluyen acciones para marcar o desmarcar las pantallas activas, guardar la selección y cerrar el editor.
- El editor informa expresamente que consultar una pantalla no concede acciones de crear, editar, exportar, anular o configurar; esas acciones son del punto 5.

## Límites intencionados

La selección se guarda en el servidor mediante un RPC autorizado, con validación de tenant, módulos contratados, auditoría y reemplazo atómico de las capacidades del cargo. Consultar una pantalla no concede por sí solo acciones de crear, editar, exportar, anular o configurar; esas acciones se resuelven por el catálogo de permisos protegido.

La protección del módulo se representa mediante el campo `moduloActivo`; los módulos inactivos quedan fuera del conjunto seleccionable. No existe un control para activar servicios ni para cambiar el plan contratado.

## Criterio de aceptación del subpunto

El propietario puede abrir un cargo, entender el área y la descripción de cada pantalla, distinguir denegación de falta de contratación, guardar una selección auditada y mantener separadas las capacidades de consulta de las acciones operativas.
