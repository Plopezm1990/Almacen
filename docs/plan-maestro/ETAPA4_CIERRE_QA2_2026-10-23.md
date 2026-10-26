# Plan Maestro L&A Suite — Cierre de la Etapa 4 / QA-2

Fecha: 23/10/2026  
Ámbito: exclusivamente Plan Maestro L&A Suite  
Preview QA: `deploy-preview-172--chic-entremet-9107cf.netlify.app`  
Entorno: QA · `QA Empresa A, S.L.` · `Local A1`  
Producción: no tocada

## Estado

**ETAPA 4 CERRADA — QA-2 ACEPTADA EN QA.**

La Etapa 4 es la etapa **TPV: la base** y su hoja QA-2 se compone de las
pruebas T1–T4. La evidencia funcional, la corrección publicada y la
persistencia después de recarga permiten cerrar esta etapa en QA.

## Aceptación T1–T4

### T1 — Interfaz, zona, tarifa y atajos: PASS

- `Local A1` y tarifa `General` visibles.
- `F2 Buscar` enfocó la búsqueda.
- Con carrito vacío, `F4 Vaciar` y `F9 Guardar` quedaron desactivados.

### T2 — Catálogo y cantidades: PASS

- Los botones rápidos `+2` y `+3` funcionaron para Agua y para Bocadillo de
  tortilla sin abrir configuraciones duplicadas.
- El fixture `QA Fixture E3 Foto MasVendido Alergenos` mostró foto, distintivo
  `Más vendido` y alérgeno `gluten`.
- `QA AUD002 3DEC 20261022` mostró `sin stock` y bloqueó sus acciones de
  cantidad.

### T3 — Opciones, suplementos, notas y alérgenos: PASS

- Se conservaron `Sin cebolla` y `Extra de queso`.
- La nota `QA-ETAPA3-NOTA` quedó en la línea y se mostró en Cocina.
- Se observaron el campo `Nota para cocina (opcional)` y el resumen de
  alérgenos.

### T4 — Guardado, envío y Cocina: PASS

- Pedido QA aceptado: `18dfd9b9-2c51-4d6b-8f1a-2a5dd7a1bb86`.
- Total: `15,56 €`; líneas: 5 aguas y 2 bocadillos de tortilla.
- El pedido se envió a Cocina y las líneas quedaron encaminadas a
  `Cocina QA-A1 PENDIENTE`.
- No se registró cobro: `0,00 €`.

## Persistencia server-side: PASS

Después de recargar el preview y esperar la carga completa reaparecieron la
estación `COCINA-QA · Cocina QA-A1`, sus tres rutas y las comandas existentes.
También reapareció la comanda `2a5dd7a1bb86` con la nota
`QA-ETAPA3-NOTA`. Esto confirma que la aceptación no dependía únicamente del
estado local del navegador.

## Verificación técnica

- `node tests/f5/f5-etapa4-t1-t4-ui-contract.mjs`: PASS.
- `node tests/pm12/p10-preview-smoke-contract.mjs`: PASS.
- `node tests/pm26/defecto-l-context-hotfix.test.mjs`: PASS tras ajustar la
  aserción para aceptar el parámetro de versión del bundle.
- `node tests/pm12/p11-create-account-routing-contract.mjs`: PASS.
- `git diff --check`: PASS.
- No se hicieron escrituras SQL directas, migraciones, cobros ni cambios en
  producción.

## Incidencia independiente que permanece abierta

El preview sigue mostrando un aviso de sincronización de `movimientos` y dos
pendientes locales tras reintentar. Se conserva como seguimiento de AUD-009;
no se oculta ni se atribuye a QA-2, y no impide el cierre funcional de la
Etapa 4.

## Lo siguiente

**Etapa 4 cerrada.** Lo siguiente es comenzar la **Etapa 5** del Plan Maestro
L&A Suite, manteniendo separada la incidencia AUD-009 y sin mezclar el Plan
ABC.
