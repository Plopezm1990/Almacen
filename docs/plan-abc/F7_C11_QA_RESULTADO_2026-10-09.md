# F7 · C11 — conciliación explicable

Fecha: 2026-10-09  
Entorno de base de datos: QA (`qjqorixtkilwsndqayyx`)  
Estado: `CADENA_DOCUMENTAL_QA_VERIFICADA; CONCILIACION_ECONOMICA_Y_UI_PENDIENTES`  
Producción: no tocada

## 1. Ensayo transaccional

Se creó un documento emitido, clasificado y conservado.

| Caso | Resultado |
|---|---|
| Antes de entregar | `PENDIENTE_ENTREGA`, bloqueo `ENTREGA_FALTANTE` |
| Después de registrar email | Nueva foto `CONCILIADO`, sin bloqueos |
| Contadores | 0 impresiones y 1 entrega, tal como existían |
| Huellas | SHA-256 de 64 caracteres |
| Replay | Mismo informe y misma huella |
| Modificar o borrar un informe | Rechazado por inmutabilidad |
| Documentos C05 | Uno; conciliar no creó otro documento |
| Camarero/a | Conciliación rechazada por falta de capacidad |

Hubo dos informes, siete eventos y siete comandos efectivos. El ensayo terminó
con `ROLLBACK`; la consulta posterior devolvió cero residuos.

## 2. Seguridad

La tabla no concede acceso directo a `anon`, `authenticated` ni
`service_role`. La RPC se concede a `authenticated` y valida empresa, local y
capacidad.

## 3. Límite confirmado

La función actual explica la cadena C05/C06/C08/C09/C10. No lee ni compara:

- importes de venta y documentos;
- movimientos y cierres de caja;
- pagos y anticipos;
- devoluciones y reembolsos;
- comisiones y liquidaciones del proveedor.

Por tanto, `CONCILIADO` significa **cadena documental completa**, no
conciliación económica integral.

## 4. Pendiente para cerrar C11

1. definir una vista económica común con las autoridades de B06, B08, B09 y C02;
2. explicar diferencias por importe y origen;
3. añadir exportación para asesoría y pantalla;
4. ejecutar el ensayo integral C12 y obtener aceptación.
