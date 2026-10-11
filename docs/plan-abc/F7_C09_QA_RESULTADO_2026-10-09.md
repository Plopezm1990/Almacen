# F7 · C09 — impresión sin duplicar la venta

Fecha: 2026-10-09  
Entorno de base de datos: QA (`qjqorixtkilwsndqayyx`)  
Estado: `NUCLEO_QA_VERIFICADO; IMPRESORA_Y_UI_PENDIENTES`  
Producción: no tocada

## 1. Estado conectado

QA contiene `abc_c09_impresiones_documentales` y la RPC
`abc_registrar_impresion_documental`. La tabla no concede acceso directo a
`anon`, `authenticated` ni `service_role`. La RPC se concede a
`authenticated` y valida la capacidad `ABC_EMISOR_CAMBIAR`.

## 2. Ensayo transaccional

Se creó un único documento técnico C05, se emitió, clasificó y conservó, y se
registraron sus copias:

| Caso | Resultado |
|---|---|
| Original en papel | Copia nº1 |
| Replay del original | Mismo registro y misma copia nº1 |
| Segundo original | Rechazado |
| Reimpresión PDF | Copia nº2 |
| Reimpresión digital | Copia nº3 |
| Reimpresión con motivo `EMISION` | Rechazada |
| Modificar o borrar una impresión | Rechazado por inmutabilidad |
| Documentos C05 resultantes | Uno; imprimir no creó otro documento |
| Camarero/a | Reimpresión rechazada por falta de capacidad |

Durante el ensayo hubo tres impresiones, siete eventos y siete comandos
efectivos.

## 3. Limpieza

El ensayo terminó con `ROLLBACK`. La consulta posterior devolvió cero series,
documentos, versiones, impresiones, eventos y comandos con los identificadores
de prueba.

## 4. Pendiente para cerrar C09

1. probar una impresora real apagada después de confirmar un cobro;
2. recuperar la copia al volver a estar disponible el dispositivo;
3. validar la matriz de equipos y canales;
4. conectar la pantalla y obtener aceptación funcional.

El ensayo valida el registro de impresión. No genera un PDF fiscal ni demuestra
el funcionamiento de una impresora física.
