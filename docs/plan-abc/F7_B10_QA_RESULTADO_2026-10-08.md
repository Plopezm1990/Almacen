# F7 · B10 en QA — protección de datos de tarjeta

Fecha: 2026-10-08  
Entorno: `L&A Suite QA` (`qjqorixtkilwsndqayyx`)  
Estado: `NUCLEO_TECNICO_APLICADO_Y_VERIFICADO_EN_QA`  
Producción: no tocada

## 1. Fuente aplicada

La fuente de B10 ya formaba parte de `release` en el commit
`9ca58df6633da38edd259d215033a8f71802f587`.

Se aplicaron, en orden y sin modificar su contenido:

1. `20261001090000_abc_f4_b10_card_data_boundary.sql`;
2. `20261001100000_abc_f4_b10_pci_capture_modes.sql`;
3. `20261001110000_abc_f4_b10_pci_review_gate.sql`.

Antes de escribir pasaron:

- `ABC_F4_B10_CARD_DATA=PASS`;
- `node --check fuente.js` sin errores.

## 2. Comprobación previa

QA confirmó antes de la aplicación:

- presencia de pagos, reembolsos, outbox, eventos ABC y eventos B07;
- presencia del registro privado de proveedores B07;
- ausencia del validador, columnas y restricciones B10;
- cero proveedores configurados o activos;
- cero claves prohibidas en el primer nivel de las filas existentes.

La primera migración ejecutó además su auditoría recursiva sobre 136 filas de
snapshots y payloads existentes antes de crear las restricciones. No encontró
datos de tarjeta prohibidos.

## 3. Registro remoto

| Versión remota | Nombre |
|---|---|
| `20261008174256` | `20261001090000_abc_f4_b10_card_data_boundary` |
| `20261008174259` | `20261001100000_abc_f4_b10_pci_capture_modes` |
| `20261008174302` | `20261001110000_abc_f4_b10_pci_review_gate` |

## 4. Contrato estructural

El contrato remoto confirmó:

- validador privado `private.abc_b10_payload_sin_datos_tarjeta`;
- ejecución revocada para `anon`, `authenticated` y `service_role`;
- cinco restricciones validadas sobre intentos, reembolsos, outbox, eventos y
  eventos B07;
- modos permitidos `EXTERNAL_TERMINAL`, `HOSTED_FIELDS` y
  `HOSTED_REDIRECT`;
- valor inicial `EXTERNAL_TERMINAL`;
- estado inicial PCI `PENDING_ACQUIRER`;
- restricción que solo permite `enabled=true` con estado `APPROVED`;
- inclusión de `capture_mode` en el resolver servidor-servidor B07.

## 5. Simulador transaccional

El ensayo verificó:

1. aceptación de una referencia y estado permitidos;
2. rechazo recursivo de `pan`, `cvv`, `card_number` y `private-key`;
3. rechazo efectivo al intentar introducir esas claves en un intento de pago,
   un reembolso y un evento existente;
4. modo inicial `EXTERNAL_TERMINAL`;
5. revisión inicial `PENDING_ACQUIRER`;
6. rechazo de un modo de captura inventado;
7. rechazo de `enabled=true` mientras la revisión está pendiente;
8. activación válida después de `pci_review_status='APPROVED'`;
9. resolución de una cuenta B07 con `HOSTED_REDIRECT` sin datos de tarjeta.

El ensayo terminó con `B10_QA_SMOKE_PASS_ROLLBACK`.

Después de la reversión quedaron en cero el proveedor y la cuenta ficticios.

## 6. Auditoría posterior y advisors

La auditoría recursiva posterior devolvió cero filas inseguras en:

- `pago_intentos`;
- `reembolsos`;
- `efectos_pendientes`;
- `abc_eventos`;
- `abc_b07_eventos_proveedor`.

No hay proveedores activos con revisión distinta de `APPROVED`. Los asesores de
seguridad y rendimiento no informaron hallazgos específicos nuevos de B10.

## 7. Límite pendiente

El núcleo técnico queda instalado, pero esto no constituye certificación PCI.
La activación real sigue pendiente de elegir adquirente y proveedor, determinar
el modo de captura, obtener sandbox y conservar la confirmación de alcance PCI
del adquirente. Hasta entonces no debe configurarse ni habilitarse un proveedor
real.
