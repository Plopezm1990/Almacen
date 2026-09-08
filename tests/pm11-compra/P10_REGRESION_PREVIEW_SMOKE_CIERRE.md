# PM11 · Compra, recepción y pago E2E · P10 — Regresión, preview, smoke y cierre

Fecha: 2026-09-07  
Rama: `pm11-compra-recepcion-pago-e2e`  
PR de validación: `#27` — NO MERGE  
Base aprobada: G1 `1e21458b48a11302c59911ef966ded0aca3eb639`  
HEAD funcional del smoke: `2a9372bf93ef33cf78411155db76773125937409`  
Deploy Preview: `https://deploy-preview-27--chic-entremet-9107cf.netlify.app`  
Producción/main: **NO MODIFICADOS**

## Resultado

P10 valida el circuito PM11 Compra/Recepción/Pago E2E y su comportamiento móvil. Los puntos P01–P09 conservan evidencia y contratos PASS. La regresión integral P10 pasó sobre el candidato funcional identificado.

## Smoke móvil real

Validación visual realizada por la usuaria en un dispositivo Android sobre el Deploy Preview #27:

1. El formulario «Nuevo pedido» abre y permanece dentro del ancho del móvil.
2. Proveedor, fecha esperada y producto son visibles.
3. Los campos numéricos muestran etiquetas inequívocas:
   - `Cantidad`
   - `Precio unitario (€)`
4. Se creó un pedido de prueba con cantidad `1` y precio unitario `3`.
5. La tarjeta resultante mostró:
   - base: `3,00 €`
   - IVA: `0,30 €`
   - total: `3,30 €`
   - estado: `Pendiente`
6. La acción Eliminar abrió un diálogo explícito:
   - título `Eliminar pedido`
   - advertencia de acción irreversible
   - botones `Sí, eliminar` y `Cancelar`
7. Tras confirmar, el pedido desapareció y volvió el estado `No hay pedidos registrados todavía.`
8. No se observó desbordamiento horizontal, error fatal, duplicación ni navegación bloqueada.

## Correcciones móviles cerradas

- El formulario se limita al viewport móvil.
- Las líneas de producto usan rejilla responsive.
- Cantidad y precio tienen etiquetas visibles y atributos accesibles.
- La acción de retirar una línea se identifica como `× Eliminar`.
- El parche se carga una sola vez desde `index.html`, antes del dashboard.
- El contrato P10 protege sintaxis, carga, etiquetas y layout.

## Regresión

Gate: `PM11 Compra P10 regresion integral`.

Incluye:
- contratos PM11 P02–P10;
- contratos PM10;
- regresiones funcionales PM05, PM07 y PM08;
- regresión completa PM09;
- G1 concurrencia y finanzas;
- sintaxis y artefacto Git exacto;
- confirmación de cero escrituras en Supabase y producción durante la regresión automática.

Los workflows independientes PM07/PM08 pueden conservar el rojo heredado de comparación histórica source-recovery → bundle; el gate integral P10 ejecuta sus contratos funcionales y pasa. No se silencian ni se presentan esos rojos como funcionales.

## Decisión

PM11 Compra P10 queda apto para cierre documental y cierre de la PR #27 **sin merge**. PM11 Compra/Recepción/Pago E2E no autoriza publicar producción ni promover migraciones.

**PM11_COMPRA_P10=PASS**  
**PM11_COMPRA_SMOKE_MOVIL=PASS**  
**PM11_COMPRA_PRODUCTION_WRITES=0**  
**PM11_COMPRA_MAIN_WRITES=0**
