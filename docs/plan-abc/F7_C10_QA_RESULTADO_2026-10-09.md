# F7 · C10 — entrega y copias

Fecha: 2026-10-09  
Entorno de base de datos: QA (`qjqorixtkilwsndqayyx`)  
Estado: `NUCLEO_QA_VERIFICADO; CICLO_PROVEEDOR_ACCESO_Y_UI_PENDIENTES`  
Producción: no tocada

## 1. Ensayo transaccional

Se preparó un documento C05 emitido, clasificado, conservado e impreso.

| Caso | Resultado |
|---|---|
| Original por email | Entrega `REGISTRADA` |
| Replay | Misma entrega |
| Papel sin impresión | Rechazado |
| Copia en papel con impresión C09 | Registrada |
| Copia por descarga | Registrada sobre la misma versión |
| Modificar o borrar una entrega | Rechazado por inmutabilidad |
| Documentos C05 | Uno; entregar no creó otro documento |
| Camarero/a | Entrega rechazada por falta de capacidad |

Hubo tres entregas, ocho eventos y ocho comandos efectivos. El ensayo terminó
con `ROLLBACK`; la consulta posterior devolvió cero residuos.

## 2. Seguridad

La tabla no concede acceso directo a `anon`, `authenticated` ni
`service_role`. La RPC se concede a `authenticated` y comprueba empresa, local
y capacidad. Una entrega en papel exige una impresión del mismo documento y
versión.

## 3. Carencia confirmada

El servidor registra la preparación de la entrega, pero todavía no implementa:

- transición a `CONFIRMADA` o `FALLIDA`;
- reintento trazable de una entrega fallida;
- envío real por email o API;
- token, destinatario autorizado y caducidad para descargas.

Por ello C10 permanece `INCOMPLETO`.

## 4. Pendiente para cerrar C10

1. implementar el ciclo de resultado y reintento del proveedor;
2. implementar descargas autorizadas y caducables;
3. limitar y revisar los datos personales del destinatario;
4. conectar pantalla/proveedor y obtener aceptación funcional.
