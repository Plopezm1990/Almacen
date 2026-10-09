# F4 B11 — Pagos sin conexión

Fecha: 01/10/2026.

## B11.1 cerrado: conexión obligatoria para confirmar cobros

El primer alcance de B11 no activa pagos offline. En modo sincronizado:

- un pago solo se confirma con respuesta del backend;
- sin conexión se permite consultar lo local y preparar un borrador;
- el borrador se identifica como local y pendiente, no como cobro confirmado;
- no se aplican offline ventas fiscales, pagos, reembolsos, stock ni cierres
  con efectos compartidos;
- una repetición online debe recuperar el mismo contexto y usar la identidad
  idempotente de la operación, nunca crear un cobro paralelo.

La decisión reutiliza `DEC-03` de `docs/plan-maestro/PM03_CONTRATOS_MINIMOS_PROPUESTA.md`.
El TPV A06 conserva un borrador local con caducidad visible; PM07 deja el
fallback de venta local acotado y no permite déficit de stock. Estas funciones
no equivalen a un pago offline ni a una autorización bancaria.

## Fuera de este subpunto

Quedan pendientes un diseño específico para terminales que soporten pagos
offline, límites de riesgo, confirmación posterior, conciliación y decisión
del negocio. Hasta entonces, la contingencia operativa es anotar el pedido o
usar un terminal independiente conectado y conciliarlo después; no se finge
una confirmación bancaria en ABC.

El diseño de esa contingencia queda descrito, sin activarse, en
`F4_B11_CONTINGENCIA_TERMINAL_OFFLINE_2026-10-01.md`.

## Evidencia

`tests/f4/b11/b11-offline-boundary-contract.mjs` comprueba la decisión, el
borrador local visible y la ruta de venta que el TPV activo usa en
`fuente.js`: exige conexión, no deriva al registro local y conserva el fallo
cerrado. También comprueba que la ruta local heredada no permite déficit. El workflow
`.github/workflows/abc-f4-b11-offline-contract.yml` ejecuta el contrato sin
deploy ni escritura remota.
