# Plan Maestro L&A Suite — Verificación parcial de la Etapa 4 / QA-2

Fecha: 23/10/2026  
Ámbito: exclusivamente Plan Maestro L&A Suite  
Preview: `deploy-preview-172--chic-entremet-9107cf.netlify.app`  
Entorno: QA · `QA Empresa A, S.L.` · `Local A1`  
Producción: no tocada

## Corrección de clasificación

La batería T1–T4 del TPV corresponde a la **Etapa 4 — TPV: la base / Hoja
QA-2**, según el Plan Maestro. No corresponde a la Etapa 3. Esta acta sustituye
la clasificación anterior y deja la Etapa 4 en estado parcial, no cerrada.

## Verificaciones realizadas

### T1 — Estructura, zona, tarifa y atajos

- `Local A1` y tarifa `General`: PASS.
- `F2 Buscar` enfocó el campo de búsqueda: PASS.
- Con carrito vacío, `F4 Vaciar` y `F9 Guardar` quedaron desactivados: PASS.

### T2 — Productos con foto, marcas y cantidad rápida

- Agua: `+2` seguido de `+3` dejó 5 unidades: PASS.
- Bocadillo de tortilla: `+2` en el configurador dejó 2 unidades: PASS.
- Fixture `QA Fixture E3 Foto MasVendido Alergenos`: imagen visible, `Más
  vendido` y `Alérgenos: gluten`: PASS visual en QA.
- `QA AUD002 3DEC 20261022`: `sin stock` visible y botones desactivados: PASS.

### T3 — Opciones, suplementos y nota

- `Sin cebolla` y `Extra de queso`: PASS.
- Nota `QA-ETAPA3-NOTA` conservada en la línea: PASS.
- Campo `Nota para cocina (opcional)` y resumen de alérgenos visibles: PASS.

### T4 — Comanda y Cocina

- Pedido QA: `18dfd9b9-2c51-4d6b-8f1a-2a5dd7a1bb86`.
- Total: `15,56 €`; 5 aguas y 2 bocadillos de tortilla.
- Enviado a Cocina; líneas encaminadas a `Cocina QA-A1 PENDIENTE`.
- Nota visible en Cocina; cobro confirmado: `0,00 €`.

## Límites

- La foto se comprobó visualmente en QA; el aviso de guardado local de
  `historialRespaldos` impide tratar esa comprobación como confirmación de
  persistencia multiempresa hasta hacer la comprobación de servidor prevista en
  QA-2.
- No se ejecutaron escrituras SQL directas, migraciones ni cambios en PROD.
- Esta acta no cierra la Etapa 4.

## Estado

**Etapa 4 abierta — QA-2 parcialmente verificada.**

La ejecución queda conservada como evidencia funcional de T1–T4, pero el plan
indica que la publicación QA-2 agrupa las etapas 3 y 4. Primero hay que
completar la Etapa 3 real y después cerrar ambas con la aceptación conjunta.
