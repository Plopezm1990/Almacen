# F7 · C04 — cierre provisional y definitivo

Fecha: 2026-10-09  
Entorno de base de datos: QA (`qjqorixtkilwsndqayyx`)  
Estado: `NUCLEO_QA_VERIFICADO; UI_PREVIA_VALIDADA; DESPLIEGUE_CONSOLIDADO_PENDIENTE`  
Producción: no tocada

## 1. Flujo verificado

El ensayo creó tres cajas, sesiones y terminales temporales dentro de una sola
transacción y usó el día operativo calculado por el servidor (`2026-10-09`).

| Ruta | Resultado |
|---|---|
| Sin diferencia | `ABIERTA → EN_CIERRE → CIERRE_PROVISIONAL → CERRADA_FINAL` |
| Reintento del inicio | Recuperó el mismo resultado y conservó un solo cierre |
| Reintento de la finalización | Recuperó el mismo cierre definitivo |
| Reapertura | Dejó la sesión `ABIERTA` y el cierre `CANCELADO`, con motivo |
| Cierre directo | La guarda rechazó `ABIERTA → CERRADA_FINAL` |
| Diferencia de 5 EUR sin motivo | La finalización fue rechazada |
| Diferencia tratada | Motivo, aprobación del Propietario y cierre definitivo |

La vista previa C03 devolvió un esperado de 0 EUR antes de confirmar los dos
cierres comprobados. Durante el ensayo se generaron 11 comandos y 11 eventos
ABC para las acciones efectivas. Los reintentos no duplicaron el cierre.

## 2. Seguridad y carrera

Las cuatro funciones de C04 conservan ejecución para `authenticated` y no la
conceden a `anon` ni a `service_role`. Validan autenticación, empresa, local,
capacidad y vínculo del terminal. La reapertura exige capacidad específica y
motivo.

El contrato de concurrencia comprueba los bloqueos `FOR UPDATE` sobre sesión y
cierre. El contrato PostgreSQL 16 con dos conexiones independientes ya había
verificado que una sola confirmación concurrente gana y que cobros y
reembolsos solo operan sobre una sesión `ABIERTA`.

## 3. Limpieza

El ensayo terminó con `ROLLBACK`. La consulta posterior devolvió cero cajas,
terminales, sesiones, comandos y eventos con los identificadores de prueba.

## 4. Interfaz y regresión

La pantalla ya ofrece iniciar, confirmar provisional, finalizar y reabrir con
motivo. Recupera el estado del servidor, muestra los bloqueos y trata las
diferencias. Las rutas sin diferencia, rechazada y aprobada se recorrieron en
un preview anterior contra QA. La versión local actual añade la vista previa
C03 antes del conteo.

## 5. Pendiente para cerrar C04

1. desplegar la interfaz consolidada en QA;
2. repetir el recorrido visual con la vista previa del servidor;
3. obtener aceptación funcional final.

C04 permanece `INCOMPLETO` hasta completar esos pasos. Producción requiere una
autorización separada.
