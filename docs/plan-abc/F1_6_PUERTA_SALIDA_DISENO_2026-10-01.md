# F1.6 — puerta de salida del diseño común

Fecha: 2026-10-01  
Estado: `PENDIENTE_APROBACION_F1`  
Base: F1.1–F1.5 y `origin/release` `7859508`

Esta puerta comprueba si el diseño común está suficientemente decidido para
empezar F2. No marca el producto como terminado y no sustituye la aprobación
del negocio, asesoría ni proveedor.

## Entregables preparados

| Entregable | Estado técnico | Aprobación pendiente |
|---|---|---|
| Contratos monetarios | preparado | moneda, escala, redondeo e impuestos |
| Estados y transiciones | preparado | flujo de barra/sala y reapertura |
| Permisos | preparado | roles reales y límites por importe |
| Decisión fiscal | checklist preparado | asesoría y emisor |
| Vectores monetarios | 12 casos preparados | parámetros aprobados |
| Proveedor de pagos | aislado detrás de contrato | proveedor y sandbox |

## Bloqueos antes de F2

1. Aprobar moneda, precisión y redondeo.
2. Confirmar los impuestos aplicables con asesoría.
3. Confirmar roles, operaciones y contexto empresa/local.
4. Elegir regla de reserva, consumo, retorno y merma de stock.
5. Confirmar si el primer alcance usa solo conexión y borradores locales.
6. Mantener B07/B08/B12 pendientes hasta contar con proveedor verificable.

## Condiciones para abrir F2

- Existe una decisión fechada para cada bloqueo o se acepta explícitamente su
  impacto y responsable.
- Los vectores M01–M12 tienen parámetros y resultados esperados.
- Las transiciones tienen actor, condición, efecto y caso negativo.
- Las operaciones protegidas tienen prueba positiva y negativa por rol.
- La decisión fiscal no se presenta como validada sin respaldo de asesoría.
- El paquete F2 tiene alcance, migración candidata, pruebas y reversión
  revisables antes de cualquier aplicación.

## Fuera de esta puerta

No incluye `db push`, migración en QA/PROD, activación de pagos, contratación de
proveedor, compra de equipos, merge a `release` ni deploy de Netlify. Tampoco
cierra los requisitos A01–C12: solo permite pasar del diseño común a la
preparación transaccional cuando las decisiones estén aceptadas.

## Resultado de F1.6

F1 queda documentalmente preparado, pero la puerta permanece
`PENDIENTE_APROBACION_F1` hasta que el negocio y la asesoría completen sus
decisiones. El siguiente paquete técnico es F2, que debe abrirse con una
autorización separada y una migración candidata revisable.
