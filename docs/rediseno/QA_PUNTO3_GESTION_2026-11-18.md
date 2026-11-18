# QA · Punto 3 — Gestión, Clientes, Compras e Inventario

Fecha: 18/11/2026  
Rama: `rediseno/f0-base-qa`  
PR: #225, borrador, sin fusionar  
Entorno permitido: Deploy Preview / Supabase QA. Producción no se ha tocado.

Deploy más reciente para el recorrido de esta tanda: `6afd50dfec4c454497a53772`,
[URL directa](https://6afd50dfec4c454497a53772--chic-entremet-9107cf.netlify.app/?cache=p3-clientes-final).
El alias estable de PR #225 puede tardar en apuntar al último deploy; no se
debe usar para certificar esta pantalla si todavía muestra el listado antiguo.

## Alcance del punto

El Punto 3 se ocupa de cerrar Gestión y decidir qué trabajo pendiente de
Clientes, Compras e Inventario entra realmente en la suite. La especificación
exige para Clientes búsqueda, filtros por estado y tipo, vistas guardadas,
paginación, ficha con actividad y privacidad del NIF de particulares. Compras e
Inventario se mantienen como un bloque separado: una pantalla que abre no se
declara funcional sin recorrer su operación y comprobar su persistencia.

## Implementado en esta tanda — Clientes

`fuente.js` y `source-recovery/fuente-recuperado.js` incorporan el panel
`ClientesPunto3` y el contrato de datos asociado:

- Alta y edición con tipo `Particular`/`Empresa`, NIF/CIF, teléfono, correo,
  dirección, datos fiscales y notas.
- Filtro por búsqueda, estado y tipo, con paginación real de ocho filas y
  conservación del resultado al abrir/cerrar la ficha.
- Vistas predefinidas y vistas guardadas por usuario del navegador; no se
  presentan como configuración de empresa ni como persistencia servidor hasta
  que el recorrido autenticado lo confirme.
- Ficha separada en Resumen, Actividad y Fiscal. El listado enmascara el NIF
  de particulares y la ficha autorizada muestra el valor completo.
- Actividad por cliente con fecha, actor, acción y valor anterior/nuevo. Las
  altas, ediciones y anonimización quedan registradas en `clientes_empresa`;
  no se inventan entradas de auditoría cuando el servidor no las devuelve.
- Eliminación y anonimización con confirmación explícita; los encargos
  históricos no se borran por borrar una ficha.

El contrato local `tests/p3/p3-clientes-gestion-contract.mjs` comprueba que
ambas fuentes llevan el mismo núcleo. La paridad fail-closed del espejo se
comprueba con `python source-recovery/recuperar_candidato.py --check`.

## Estado de QA live de Clientes

La nueva superficie aún necesita una pasada autenticada en el preview para
cerrar el criterio funcional: crear un particular y una empresa, guardar una
vista, ir a la segunda página, abrir/editar/volver, comprobar el NIF enmascarado
en listado y revisar la actividad desde una segunda sesión o con el actor
visible. Hasta esa pasada, la matriz se marca como **construida en rama;
pendiente de recorrido live**, no como “Pasa”.

No se han creado clientes ni se ha escrito en QA durante esta tanda.

## Compras e Inventario: decisión de alcance

Se conserva la evidencia histórica de las operaciones ya comprobadas (entrada
de albarán, confirmación, coste/stock, pagos con diálogo propio y protecciones
de contexto). Las filas que solo certifican que una pantalla abre siguen
pendientes y no se convierten en cierres por inferencia.

Quedan fuera de este cierre hasta disponer de contrato y recorrido QA:

- `inv-32`: detalle/impresión de ficha de coste; decidir si la impresión es
  requisito o se retira de la matriz.
- `inv-35` y `inv-36`: biblioteca y editor de opciones reutilizables; el
  servidor conoce variantes, pero no existe superficie de administración.
- Listados de Compras e Inventario marcados en la matriz como “solo apertura”;
  requieren fixture reversible y comprobación de persistencia antes de cerrar.
- `enc-05`: no se crea como pantalla independiente; el comportamiento de
  anticipos sigue documentado en el flujo de Encargos y su alcance se decide
  aparte.

No se toca `sis-13`, no se vacía QA y no se ejecutan cobros, reembolsos ni
operaciones destructivas nuevas.

## Orden de la siguiente pasada

1. Publicar el commit en el Deploy Preview #225.
2. Recorrer Clientes con propietario en QA-A1: alta particular/empresa,
   vista guardada, filtro tipo/estado, paginación, ficha, actividad y NIF.
3. Repetir lectura en una segunda sesión y comprobar que la vista local no se
   presenta falsamente como configuración compartida.
4. Actualizar `enc-09`–`enc-12` con evidencia real y cerrar solo las filas que
   hayan pasado ese recorrido.
5. Abrir una tanda separada para Compras/Inventario con una lista explícita de
   operaciones, fixtures y reversión; no mezclarla con la aceptación de
   Clientes.

## Evidencia técnica de esta tanda

- SHA de la rama al cierre de esta tanda: `3800030e` (incluye la implementación,
  el aislamiento por empresa de las vistas y la sincronización del espejo).
- Prueba: `node tests/p3/p3-clientes-gestion-contract.mjs` → `OK`.
- Sintaxis: `node --check fuente.js` → `OK`.
- Paridad: `SOURCE_RECOVERY_CHECK=PASS`.
- El espejo recuperado se regenera desde el sufijo exacto del bundle cuando la
  cabecera histórica no coincide; no se relaja la comparación del cuerpo.
