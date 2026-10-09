# F7 · C06 — tipos documentales

Fecha: 2026-10-09  
Entorno de base de datos: QA (`qjqorixtkilwsndqayyx`)  
Estado: `NUCLEO_QA_VERIFICADO; REGLAS_FISCALES_Y_UI_PENDIENTES`  
Producción: no tocada

## 1. Alcance de la verificación

La prueba valida el contrato técnico de clasificación. No declara que los
campos probados basten para cumplir una obligación fiscal concreta. Esa
decisión sigue reservada para asesoría y C07.

QA contiene `abc_c06_documentos_clasificados` y
`abc_clasificar_documento`. La tabla no concede acceso directo a `anon`,
`authenticated` ni `service_role`; la RPC se concede a `authenticated` y
comprueba la capacidad `ABC_EMISOR_CAMBIAR`.

## 2. Ensayo transaccional

Se crearon series y documentos temporales de factura y pedido.

| Caso | Resultado |
|---|---|
| Factura completa sin receptor | Rechazada |
| Factura completa con nombre e identificador | Clasificada |
| Replay de la clasificación | Recuperó la misma clasificación |
| Reclasificar el mismo documento | Rechazado |
| Factura simplificada | Clasificada |
| Factura rectificativa | Conservó el vínculo con la factura completa emitida |
| Factura sobre serie de pedido | Rechazada |
| Pedido sobre serie de pedido | Clasificado |
| Modificar la clasificación | Rechazado por inmutabilidad |
| Camarero/a | Clasificación rechazada por falta de capacidad |

Durante el ensayo hubo cuatro clasificaciones, once eventos y once comandos
efectivos.

## 3. Limpieza

El ensayo terminó con `ROLLBACK`. La consulta posterior devolvió cero series,
documentos, clasificaciones, eventos y comandos con los identificadores de
prueba.

## 4. Pendiente para cerrar C06

1. validar con asesoría los supuestos y campos de cada tipo fiscal;
2. resolver en C07 régimen, SIF y emisor;
3. conectar la clasificación al flujo visible de la aplicación;
4. probar la petición posterior de factura completa sin duplicar la venta;
5. obtener aceptación funcional.
