# Plan Maestro L&A Suite — Cierre de la Etapa 3

Fecha: 23/10/2026  
Ámbito: exclusivamente Plan Maestro L&A Suite  
Preview validado: `deploy-preview-172--chic-entremet-9107cf.netlify.app`  
Entorno: QA · `QA Empresa A, S.L.` · `Local A1`  
Producción: no tocada

## Estado

**ETAPA 3 CERRADA.**

La repetición limpia de QA-2 se completó sobre el preview 172. Las pruebas T1,
T2, T3 y T4 quedaron verificadas, y no fue necesario crear ningún cobro ni
documento fiscal.

## Aceptación QA-2

### T1 — Interfaz, zona, tarifa y atajos: PASS

- La pantalla mostró `Local A1` y tarifa `General`.
- `F2 Buscar` llevó el foco al campo de búsqueda.
- Con el carrito vacío, `F4 Vaciar` y `F9 Guardar` permanecieron desactivados.
- No se activó cobro, tarjeta simulada ni ninguna operación de caja.

### T2 — Catálogo, cantidades y estados visuales: PASS

- `Agua 50 cl (QA)`: `+2` seguido de `+3` dejó 5 unidades.
- `Bocadillo de tortilla (QA)`: `+2` abrió el configurador y, tras completar
  las opciones, dejó 2 unidades en el carrito; no volvió a quedar en 1.
- `QA Fixture E3 Foto MasVendido Alergenos` mostró imagen, `Más vendido` y
  `Alérgenos: gluten`.
- `QA AUD002 3DEC 20261022` mostró `sin stock` y mantuvo desactivados sus
  botones de cantidad.

### T3 — Opciones, nota y alérgenos: PASS

- En el configurador se seleccionaron `Sin cebolla` y `Extra de queso`.
- Se introdujo la nota de prueba `QA-ETAPA3-NOTA`.
- El configurador mostró el campo `Nota para cocina (opcional)` y el resumen
  de alérgenos.
- Las opciones se conservaron en la línea del carrito y la nota apareció
  después en Cocina.

### T4 — Guardado y Cocina: PASS

- Pedido QA creado: `18dfd9b9-2c51-4d6b-8f1a-2a5dd7a1bb86`.
- Cuenta QA asociada: `26ed05b3-2b20-426d-a40c-10f7fa3d6151`.
- Total del pedido: `15,56 €`.
- Líneas guardadas: 5 aguas y 2 bocadillos de tortilla.
- Estado operativo: `ABIERTO`; después se pulsó `Enviar pedido` y pasó a
  `ENVIADO`.
- Cocina mostró el pedido abreviado como `2a5dd7a1bb86`, con las líneas
  encaminadas a `Cocina QA-A1 PENDIENTE`.
- La nota `QA-ETAPA3-NOTA` quedó visible en Cocina.
- Confirmado: `0,00 €` cobrado; el pedido permanece pendiente de pago.

## Límites y controles

- La comanda es ficticia y queda en QA para trazabilidad de la aceptación; no
  se cobró ni se emitió documento fiscal.
- El aviso `Guardado solo en este equipo (historialRespaldos)` continuó visible
  como aviso de alcance QA. No impidió guardar el pedido operativo ni enviar
  sus líneas a Cocina, y no se considera un fallo de los criterios T1–T4.
- Se observaron comandas históricas antiguas con `Sin estación BLOQUEADA`; no
  corresponden a la comanda creada en esta regresión. La comanda nueva quedó
  correctamente encaminada.
- No se ejecutaron escrituras SQL directas, migraciones ni cambios en PROD.

## Trazabilidad

- Evidencia previa de preparación y fixture: commit `f8757be`.
- Esta acta se añade a la misma rama QA del Plan Maestro L&A Suite.

## Lo siguiente

La siguiente etapa del Plan Maestro L&A Suite es la **Etapa 4**. La Etapa 3
queda cerrada y no se debe mezclar con el Plan ABC. Antes de iniciar la Etapa 4
hay que conservar esta acta como referencia y seguir únicamente los requisitos
de la Etapa 4 del Plan Maestro L&A Suite.
