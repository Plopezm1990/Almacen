# PM12–P09 · Historial, informes y móvil

Estado: **EN VALIDACIÓN FINAL**.

## Objetivo documental

Hacer visibles y coherentes los estados de conteo ya cerrados en P02–P08 dentro del historial, los informes y la experiencia móvil, sin inventar datos históricos ni crear otra fuente de verdad.

## Diagnóstico reutilizado

Se conserva `P09_DIAGNOSTICO_TEMP.txt`. El diagnóstico mostró que el historial existente enseñaba fecha, ámbito y una etiqueta básica de estado, pero no exponía la trazabilidad ya disponible en el documento: cobertura de cierre, responsable, revisor, hora de cierre, motivo parcial, ajustes aplicados ni datos de cancelación/reversos. También detectó tarjetas y controles rígidos en móvil.

## Solución mínima

`pm12-p09-historial-informes-movil-v1.js` es una capa de presentación de solo lectura. No modifica el motor de estados, el motor de stock, Supabase ni el documento persistido.

Reglas:

1. normaliza el estado visible a `BORRADOR`, `EN_CURSO`, `PARCIAL`, `COMPLETADO` o `CANCELADO` reutilizando el contrato PM12;
2. un cierre moderno muestra la cobertura congelada que realmente se guardó;
3. un cierre legado sin cobertura guardada muestra explícitamente **cobertura no disponible**; no se reconstruye retrospectivamente;
4. el historial muestra responsable/revisor, cierre, motivo parcial, ajustes y cancelación/reversos cuando existen;
5. Reportes añade un resumen de estados de conteo y distingue cierres con cobertura conocida de históricos sin cobertura;
6. los informes no mezclan varios locales si no puede resolverse de forma inequívoca el scope activo;
7. la presentación móvil apila tarjetas, acciones, metadatos y responsables sin retirar el scroll horizontal ya existente de las tablas de captura;
8. la capa no hace `fetch`, no escribe `localStorage`, no llama RPC y no contiene endpoints o identificadores remotos.

## Integración y primera evidencia

La capa está integrada exactamente una vez en `index.html`, después de los motores PM12 y antes de `fuente.js`. La integración automática quedó en el commit `fe45105302b1729b6e752fa25551602549c413c2`.

El primer gate P09 (`34153794649`) terminó **SUCCESS**: sintaxis, contrato P09, regresión frontend P02–P08, `main` congelado, cero cambios Supabase y cero escrituras remotas.

Este checkpoint provoca un segundo gate para validar el commit integrado exacto antes del cierre.

## Gate requerido

Antes de cerrar P09 deben pasar:

- contrato P09 de estados, cobertura honesta, trazabilidad, scope e informes;
- sintaxis de la capa;
- integración única en `index.html`;
- regresión acumulada P02–P08 aplicable al frontend;
- `main` congelado;
- cero cambios en `supabase/` desde el inicio de P09;
- cero identificadores remotos nuevos;
- gate remoto sobre el head integrado **SUCCESS**.

P10 no empieza hasta cumplir este gate.
