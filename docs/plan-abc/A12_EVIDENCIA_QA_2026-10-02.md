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

## Comprobación visual local QA

Con sesión autenticada de Propietario A y apuntando al proyecto QA, el módulo TPV se abrió correctamente al seleccionar `Local A1 · QA Empresa A, S.L.`. La pantalla mostró el histórico de ventas y los filtros de pago/estado sin el error de esquema B05. El piso de venta aparece vacío porque el catálogo QA no tiene productos publicados para ese local; no es un fallo de renderizado del TPV.

La copia local mostró además un aviso de sincronización de `locales`; se conserva como aviso de entorno local y no impidió abrir ni renderizar el TPV. No se creó ninguna venta ni se modificaron datos comerciales.

## Validación visual del Deploy Preview QA

La prueba autenticada se repitió directamente en `https://deploy-preview-117--chic-entremet-9107cf.netlify.app/` con el Propietario A. El preview mostró `Local A1 · QA Empresa A, S.L.`, confirmando visualmente el tenant QA, y el módulo TPV abrió al seleccionar `Local A1`.

La pantalla mostró el histórico de ventas, filtros de pago y estado, y el mensaje funcional A02/A04/A05/F4 sin el error de esquema B05. El piso de venta está vacío porque no hay productos publicados para ese local. No se creó ninguna venta ni se ejecutó ningún cobro.

El preview permaneció privado durante la prueba (`Private` en el panel de Netlify). La producción sigue sin modificarse y no se cambiaron permisos de acceso.

## Cierre de A12

A12 queda validado en backend QA, copia local y Deploy Preview autenticado. Se mantiene como aviso no bloqueante la sincronización pendiente de `locales` que muestra la aplicación; no impidió abrir ni renderizar el TPV. No se ha modificado producción ni se ha hecho deploy adicional.
