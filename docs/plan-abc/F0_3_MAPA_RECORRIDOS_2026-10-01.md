# F0.3 — mapa de recorridos operativos

Fecha: 2026-10-01  
Estado: `PENDIENTE_EJECUCION_CON_DATOS_FICTICIOS`  
Base: F0.1 y F0.2 sobre `origin/release` `7859508`

Este documento es una plantilla de observación para el recorrido real del
servicio. No inventa resultados: cada fila se completa al ejecutar el caso en
un entorno aislado con datos ficticios y con la versión exacta anotada.

## Datos de la sesión

| Campo | Valor |
|---|---|
| Versión o SHA | `PENDIENTE` |
| Entorno | `LOCAL_AISLADO` por defecto |
| Empresa/local | `PENDIENTE` |
| Usuario y rol | `PENDIENTE` |
| Modalidad | `BARRA / MESA / TERRAZA / PARA_LLEVAR` |
| Navegador y equipo | `PENDIENTE` |
| Datos ficticios usados | `PENDIENTE` |

## Recorridos mínimos

| ID | Recorrido | Pantalla o acción | Backend/datos a observar | Resultado esperado | Estado |
|---|---|---|---|---|---|
| R01 | Abrir venta de barra | localizar producto y añadir línea | pedido, línea, precio y versión | borrador visible sin cobro implícito | `PENDIENTE` |
| R02 | Abrir cuenta de mesa | asignar mesa y responsable | cuenta, local, comensales y estado | cuenta recuperable tras recargar | `PENDIENTE` |
| R03 | Pedido para llevar | crear líneas y confirmar pedido | pedido, preparación y contexto | modalidad conservada sin cambiar local | `PENDIENTE` |
| R04 | Cobro en efectivo simulado | introducir importe y confirmar | intento, pago y efecto de caja | cambio correcto y un solo efecto | `PENDIENTE` |
| R05 | Cobro no efectivo simulado | iniciar y resolver resultado | intento, estado y referencia externa | resultado incierto no se cobra dos veces | `PENDIENTE` |
| R06 | Anulación antes del cobro | cancelar pedido o línea | estado, actor, motivo y auditoría | no crea pago ni movimiento de caja | `PENDIENTE` |
| R07 | Devolución económica simulada | seleccionar pago y solicitar devolución | reembolso, aplicaciones y saldo | límite disponible respetado | `PENDIENTE` |
| R08 | Arqueo | abrir y cerrar sesión ficticia | movimientos y saldo esperado | diferencia explicable y trazable | `PENDIENTE` |
| R09 | Cambio de local | cambiar contexto con operación abierta | pertenencia, empresa y local | operación ajena denegada | `PENDIENTE` |
| R10 | Recuperación tras recarga | recargar o reiniciar cliente | identificador y versión | no duplica líneas ni cobros | `PENDIENTE` |

## Evidencia que debe conservarse

Por cada recorrido se registrará: pasos, entrada ficticia, llamada relevante,
respuesta, estado antes/después, resultado esperado/observado, actor, local,
versión y captura opcional. No se guardarán contraseñas, PAN, CVV, tokens ni
datos reales de clientes.

Un resultado `PASS` solo significa que ese recorrido fue observado y coincide
con su criterio. No cierra A01–C12 ni convierte los simuladores de pagos en
validación de proveedor.

## Resultado de F0.3

El mapa queda preparado para ejecutar recorridos cuando se disponga de local,
roles y entorno de prueba. Mientras tanto, B07, B08 y B12 siguen bloqueados por
proveedor; F0 puede continuar con documentación y contratos locales sin
despliegues de Netlify.
