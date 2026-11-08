# F4 B10 — ficha de alta de proveedor y revisión PCI

Estado: plantilla preparada; pendiente de datos del usuario y revisión del
adquirente.

## Datos que faltan para activar un proveedor

Completar esta ficha fuera del repositorio y conservar únicamente los nombres
de secretos, nunca sus valores:

| Dato | Valor pendiente |
|---|---|
| Adquirente / banco | `PENDIENTE` |
| Proveedor de pagos | `PENDIENTE` |
| País y moneda de operación | `PENDIENTE` |
| Modo de captura | `EXTERNAL_TERMINAL`, `HOSTED_FIELDS` o `HOSTED_REDIRECT` |
| Identificador de cuenta comercial | `PENDIENTE` |
| URL de sandbox/documentación oficial | `PENDIENTE` |
| URL de webhook y firma | `PENDIENTE` |
| Nombre lógico del secreto servidor | `PENDIENTE` |
| Evidencia o confirmación de alcance PCI del adquirente | `PENDIENTE` |

## Regla de activación

Mientras falte la evidencia del adquirente, el proveedor debe permanecer:

```text
enabled = false
pci_review_status = PENDING_ACQUIRER
```

Solo después de revisar el flujo real y recibir la confirmación del
adquirente se podrá pasar a `pci_review_status = APPROVED` y habilitar la
cuenta. Esa decisión no se toma automáticamente por elegir hosted fields o
redirección.

## Comprobaciones antes de usar dinero real

1. Confirmar que el PAN/CVV se captura únicamente en terminal o superficie
   alojada por el proveedor.
2. Verificar que el navegador no envía datos de tarjeta a ABC.
3. Validar firma, replay, timeout, idempotencia y estados desconocidos en
   sandbox.
4. Confirmar que logs, trazas, adjuntos y snapshots solo contienen referencia,
   importe, moneda, estado y datos permitidos por el proveedor.
5. Ejecutar una autorización, rechazo, cancelación, cobro y reembolso de
   prueba sin dinero real.
6. Revisar el resultado con el adquirente antes de activar producción.

## No introducir aquí

- PAN, CVV/CVC, claves privadas, tokens reales ni contraseñas;
- capturas de pantalla con datos de tarjeta;
- credenciales en commits, incidencias, chat o archivos del repositorio;
- una clasificación PCI asumida sin confirmación del adquirente.

La Suite ya dispone de la compuerta técnica B10.3. Esta ficha es la entrada
operativa necesaria para completar el alta cuando el usuario elija proveedor.
