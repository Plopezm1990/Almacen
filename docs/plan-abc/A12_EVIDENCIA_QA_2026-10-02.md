# A12 — Evidencia funcional TPV en QA

Fecha: 2026-10-02  
Entorno: Supabase QA `qjqorixtkilwsndqayyx`  
Identidad de prueba: Propietario A de QA (`16c79749-a206-47d9-8d56-fbc7a4a49eb7`)

## Resultado

La validación funcional del backend TPV se ejecutó dentro de transacciones temporales con contexto autenticado y terminó correctamente. Cada transacción hizo `ROLLBACK`; no se dejaron datos comerciales de prueba en QA.

Casos verificados:

- apertura de cuenta: barra, mesa, terraza y llevar (`TAKEAWAY`);
- creación de zona y mesas, asignación y traslado de mesa;
- creación de pedido, línea, confirmación y envío;
- aplicación de descuento autorizado;
- reparto de una línea entre cuentas y unión posterior de cuentas;
- preparación de checkout;
- cobro mixto: 8 EUR en efectivo con 10 EUR recibidos y 2 EUR de cambio, más reserva de 14 EUR en tarjeta;
- lectura del estado mixto: `PARCIALMENTE_PAGADO`, confirmado 8 EUR, saldo 14 EUR, cambio 2 EUR y disponible para nuevo cobro 0 EUR;
- lecturas de mapa de sala, responsables, cuentas recuperables y políticas de descuento.

Comprobación posterior al rollback:

- cuentas temporales: 0;
- pedidos temporales: 0;
- líneas temporales: 0;
- reglas temporales del día operativo: 0.

## Validación local

La batería dirigida A02/A05/A06/A07/A10 y los contratos F4/F5 ejecutados previamente pasan. En la batería amplia se observaron dos incidencias de entorno/contrato que no corresponden a un fallo funcional remoto de A12:

1. El contrato UI A08 tiene una aserción de snapshot desalineada con el nombre actual de la función de etiqueta de destino.
2. El contrato PostgreSQL local A09 no puede conectar porque no hay servidor local escuchando en `127.0.0.1:55416`; el contrato PGlite sí pasa.

## Pendiente para cerrar A12 al 100 %

Falta únicamente la prueba visual autenticada desde el Deploy Preview QA. Netlify protege ese preview con Team Protection y la producción sigue sin promover las migraciones B04/B05/F5. No se ha modificado producción ni se ha hecho deploy adicional.

