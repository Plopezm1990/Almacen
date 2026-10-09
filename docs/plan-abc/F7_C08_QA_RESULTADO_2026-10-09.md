# F7 · C08 — conservación y corrección documental

Fecha: 2026-10-09  
Entorno de base de datos: QA (`qjqorixtkilwsndqayyx`)  
Estado: `NUCLEO_QA_VERIFICADO; POLITICA_LEGAL_Y_UI_PENDIENTES`  
Producción: no tocada

## 1. Estado conectado

QA contiene las tablas de versiones y correcciones C08, además de las RPC de
conservación y corrección. Las tablas no conceden acceso directo a `anon`,
`authenticated` ni `service_role`. Las RPC se conceden a `authenticated` y
validan la capacidad `ABC_EMISOR_CAMBIAR`.

## 2. Ensayo transaccional

Se emitieron y clasificaron una factura completa y su rectificativa. Después se
ejecutaron estas comprobaciones:

| Caso | Resultado |
|---|---|
| Conservar el original | Versión 1 y SHA-256 de 64 caracteres |
| Replay | Misma versión y misma huella |
| Segunda conservación con otra operación | Rechazada |
| Modificar la instantánea | Rechazado por inmutabilidad |
| Rectificación | Documento corrector emitido, rectificativo y enlazado |
| Rectificación sin documento corrector | Rechazada |
| Cancelación operativa | Registrada sin alterar el original |
| Reembolso | Registrado sin alterar el original |
| Modificar una corrección | Rechazado por inmutabilidad |
| Camarero/a | Corrección rechazada por falta de capacidad |

Durante el ensayo hubo dos versiones, tres correcciones, once eventos y once
comandos efectivos.

## 3. Limpieza

El ensayo terminó con `ROLLBACK`. La consulta posterior devolvió cero series,
documentos, clasificaciones, versiones, correcciones, eventos y comandos con
los identificadores de prueba.

## 4. Pendiente para cerrar C08

1. acordar con asesoría la política de conservación, acceso y rectificación;
2. implementar la descarga autorizada y la pantalla de historial;
3. recorrer desde la aplicación un cambio de precio y su corrección;
4. obtener aceptación funcional.

La respuesta fiscal usada en la prueba fue `SIMULADOR`; no se presenta como
evidencia de cumplimiento fiscal.
