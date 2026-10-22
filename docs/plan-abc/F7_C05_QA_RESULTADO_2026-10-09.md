# F7 · C05 — series y numeración documental

Fecha: 2026-10-09  
Entorno de base de datos: QA (`qjqorixtkilwsndqayyx`)  
Estado: `NUCLEO_QA_VERIFICADO; EMISOR_Y_UI_PENDIENTES`  
Producción: no tocada

## 1. Estado conectado

QA contiene las tablas `abc_c05_series_documentales` y
`abc_c05_documentos_emitidos`, además de las RPC de reserva y resolución. Las
tablas no conceden acceso directo a `anon`, `authenticated` ni `service_role`.
Las RPC conceden ejecución a `authenticated` y comprueban autenticación,
empresa, local y la capacidad `ABC_EMISOR_CAMBIAR`.

## 2. Ensayo transaccional

Se creó una serie temporal `FACTURA/QA09` con siguiente número 410.

| Caso | Resultado |
|---|---|
| Primera reserva | Número 410 |
| Segunda reserva | Número 411, documento distinto |
| Replay de la primera | Mismo documento y mismo número; dos filas en total |
| Mismo `operation_id`, payload distinto | Rechazado |
| Documento 410 | `PENDIENTE → EMITIDO`; recuperación posterior del mismo 410 |
| Documento 411 | `ERROR → EMITIDO`; conservó el 411 |
| Cambiar el número | Rechazado por identidad inmutable |
| Cambiar un emitido a error | Rechazado por documento emitido inmutable |
| Camarero/a | Reserva rechazada por falta de capacidad |

Durante el ensayo hubo dos documentos, seis eventos y siete comandos efectivos.
El replay no creó una tercera identidad.

## 3. Concurrencia

El contrato PostgreSQL 16 usa dos conexiones independientes sobre la misma
serie. Las dos reservas concurrentes reciben números distintos y consecutivos.
La función bloquea la fila de la serie con `FOR UPDATE` y la restricción única
protege empresa, local, tipo, serie y número.

## 4. Limpieza

El ensayo QA terminó con `ROLLBACK`. La consulta posterior devolvió cero series,
documentos, eventos y comandos con los identificadores de prueba.

## 5. Pendiente para cerrar C05

1. elegir y configurar el emisor fiscal autorizado;
2. conectar reserva y resolución al flujo de documentos de la aplicación;
3. recorrer desde la pantalla la interrupción y el reintento;
4. obtener aceptación funcional.

La autoridad `INTERNA` usada en la prueba valida la identidad técnica; no se
presenta como emisión fiscal conforme.
