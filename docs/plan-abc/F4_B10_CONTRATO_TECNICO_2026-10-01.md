# F4 B10 — Protección de datos de tarjeta

Fecha: 01/10/2026.

## B10.1 cerrado: frontera técnica

El terminal o el proveedor de pagos captura los datos sensibles. La Suite ABC
solo conserva la referencia del proveedor, importes, moneda, estados y la
evidencia operativa necesaria. No se almacenan PAN, CVV/CVC, banda magnética,
clave privada ni el objeto completo del método de pago.

La migración `20261001090000_abc_f4_b10_card_data_boundary.sql` añade una
función recursiva de validación y restricciones a:

- `pago_intentos.provider_snapshot`;
- `reembolsos.provider_snapshot`;
- `efectos_pendientes.payload`;
- `abc_eventos.payload`;
- eventos B07 del proveedor y su último conflicto.

La migración audita primero las filas existentes y aborta si encuentra una
clave prohibida. Después, las restricciones impiden que una nueva escritura
introduzca esos datos, también cuando están anidados en arrays u objetos.

## Límites de este cierre

Esto no certifica PCI DSS ni sustituye el cuestionario del adquirente. Queda
para el siguiente subpunto decidir el proveedor, el flujo de terminal o
redirect/hosted fields y documentar el alcance PCI con el adquirente. No se
inventan credenciales ni se hace deploy remoto en este paso.

## B10.2 cerrado: captura configurable sin proveedor hardcodeado

`private.abc_b07_proveedores.capture_mode` deja configurado por proveedor
dónde captura la tarjeta, con tres opciones:

- `EXTERNAL_TERMINAL`: el terminal físico captura la tarjeta;
- `HOSTED_FIELDS`: el proveedor aloja los campos sensibles;
- `HOSTED_REDIRECT`: el cliente sale a una página alojada por el proveedor.

El resolver servidor-servidor devuelve únicamente ese modo no secreto junto
con la configuración operativa. No devuelve credenciales ni datos de tarjeta,
y ningún modo permite que el navegador envíe PAN/CVV a ABC.

La opción por defecto es `EXTERNAL_TERMINAL`, porque no amplía el alcance de
la Suite. La clasificación PCI concreta queda deliberadamente pendiente de
confirmación con el adquirente: el código no afirma que una opción concreta
sea automáticamente SAQ A, SAQ A-EP o equivalente.

## B10.3 cerrado: compuerta de revisión del adquirente

`private.abc_b07_proveedores.pci_review_status` nace como
`PENDING_ACQUIRER`. La restricción `abc_b10_pci_review_enable_ck` impide que
un proveedor quede `enabled=true` mientras no tenga estado `APPROVED`.
También se comprueban las filas existentes antes de crear la restricción; si
hubiera un proveedor activo sin revisión, la migración se detendría para no
convertir una situación desconocida en una aprobación implícita.

La Suite queda lista para registrar la decisión del adquirente sin guardar su
documentación dentro de la base de datos ni activar todavía un proveedor
real. Para cerrar la parte operativa solo faltan el adquirente, el proveedor,
el modo elegido y la evidencia de revisión que aporte el usuario.

La ficha `F4_B10_ALTA_PROVEEDOR_PCI_2026-10-01.md` reúne esos datos y la
secuencia de comprobaciones previa a cualquier activación.

## Evidencia

El contrato `tests/f4/b10/b10-card-data-contract.mjs` comprueba la función
recursiva, las claves prohibidas, las cinco restricciones, los modos de
captura, la compuerta de aprobación y la ausencia de escrituras de negocio
dentro de la migración. El workflow
`.github/workflows/abc-f4-b10-card-data.yml` lo ejecuta en CI.
