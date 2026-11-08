# Paso maestro 1 — cierre de la compatibilidad operativa

Fecha de cierre: 30/10/2026  
Entorno validado: QA, preview `deploy-preview-192--chic-entremet-9107cf.netlify.app`  
Producción: sin cambios durante este cierre.  
Alcance: TPV, venta, cobro, cierre, stock, historial, ticket y QR simulado.

## Decisión

**Paso maestro 1 cerrado en QA.**

La compatibilidad operativa mínima del TPV queda validada con una venta
controlada de QA. El cierre no habilita fiscalidad real ni autoriza todavía la
venta controlada de producción del Paso maestro 4.

## Checklist del paso maestro

| Requisito | Resultado | Evidencia |
|---|---|---|
| Revisar cierre de cuenta | PASS | Cuenta pagada y cerrada en QA |
| Revisar modo mostrador | PASS | Modo Venta rápida/Mostrador validado |
| Revisar historial e importes | PASS | Historial muestra el importe de la venta |
| Revisar stock | PASS | Movimiento `-1 CONFIRMACION_VENTA` comprobado |
| Repetir venta completa en QA | PASS | Venta E2E con Agua 50 cl (QA), 1,00 € |
| Abrir ticket | PASS | Ticket `V-20261030-08868A` recuperable |
| Verificar pago y cambio | PASS | Efectivo 1,00 €, entregado 1,00 €, cambio 0,00 € |
| Verificar QR simulado | PASS | QR QA con TPV, fecha e importe coherentes |
| Verificar impresión/guardado | PASS | Zona imprimible completa y sin recortes |
| Guardar evidencia única | PASS | Esta acta y las evidencias enlazadas |

## Evidencia técnica

Venta QA utilizada:

- referencia: `V-20261030-08868A`;
- operación: `40fabcb2-223c-4a5e-87c5-c83b4c1d3207`;
- terminal: `TPV-000020`;
- fecha del payload: `30-10-2026`;
- importe: `1.00`;
- cuenta comercial: `CERRADA`;
- emisión real AEAT: desactivada.

Contratos verificados:

```text
QA_RECEPCION_TPV_CAJA=PASS
A02_QUICK_SALE_TICKET_CONTRACT=PASS
C07D_HISTORICAL_TICKET_CONTRACT=PASS
QR_TICKET_UI_STATIC=5/5 PASS
QR_TICKET_PREVIEW=2/2 PASS
QR_MATRIX_CONTRACT=4/4 PASS
AEAT_QR_CONTRACT=7/7 PASS
git diff --check=PASS
```

## Límite del cierre

El Paso maestro 1 queda cerrado únicamente como validación operativa QA. No
se considera cerrado todavía:

- el Paso maestro 4, que exige una venta controlada formal en producción;
- el Paso maestro 5, que requiere una empresa piloto y sandbox;
- el Paso maestro 6, que requiere hardware;
- el Paso maestro 7, que requiere activación fiscal real con doble aprobación.

El QR utilizado es simulado y no constituye una factura enviada a la AEAT.

## Evidencias detalladas

- [ETAPA_1_CIERRE_OPERATIVO_QA_2026-10-30.md](ETAPA_1_CIERRE_OPERATIVO_QA_2026-10-30.md)
- [ETAPA_2_MODO_VENTA_RAPIDA_QA_2026-10-30.md](ETAPA_2_MODO_VENTA_RAPIDA_QA_2026-10-30.md)
- [ETAPA_3_PRUEBA_E2E_TPV_QA_2026-10-30.md](ETAPA_3_PRUEBA_E2E_TPV_QA_2026-10-30.md)
- [ETAPA_4_FORMATO_VISUAL_TICKET_QA_2026-10-30.md](ETAPA_4_FORMATO_VISUAL_TICKET_QA_2026-10-30.md)
- [ETAPA_5_VALIDACION_QR_SIMULADO_QA_2026-10-30.md](ETAPA_5_VALIDACION_QR_SIMULADO_QA_2026-10-30.md)

## Siguiente paso

El siguiente paso del plan maestro es el **Paso maestro 2: crear y revisar la
variante SQL productiva**, manteniendo la activación fiscal real separada y
bloqueada.
