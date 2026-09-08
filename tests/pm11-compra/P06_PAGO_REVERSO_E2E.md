# PM11 · Compra, recepción y pago E2E · P06 — Pago parcial, total y reverso

Fecha: 2026-09-07  
Rama: `pm11-compra-recepcion-pago-e2e`  
P05: factura e identidad financiera cerrada  
Producción/main: **NO TOCAR**

## Objetivo

Validar que una obligación financiera exacta creada desde un albarán-factura P05 recorre correctamente el ledger de pagos existente:

`pendiente -> pago parcial -> pago total -> pagada -> reverso -> pendiente`

sin sobrepago, sin contaminar otras obligaciones y manteniendo la trazabilidad del reverso.

## Resultado técnico

P06 no necesitó modificar `fuente.js`: la capa PM06 heredada ya contiene las reglas financieras necesarias y P05 ya cerró la entrada al ledger para que solo pueda usarse una factura explícita, confirmada y con identidad válida.

El contrato P06 verifica directamente la función real `calcularSaldoFacturaPM06` y las invariantes estructurales de `registrarPagoPM06`, `revertirUltimoPagoPM06` y `marcarPagada`.

## Secuencia validada

Sobre una factura de 100 €:

1. Estado inicial: pagado 0 €, pendiente 100 €.
2. Pago parcial de 40 €: pagado 40 €, pendiente 60 €, todavía no pagada.
3. La capa de registro contiene una guardia que rechaza importes superiores al saldo pendiente.
4. Pago final de 60 €: pagado 100 €, pendiente 0 €, estado financiero pagado.
5. Un pago adicional sobre saldo cero queda fuera del contrato permitido por la misma guardia de sobrepago.
6. Reverso trazable del último pago de 60 €: el ledger añade un movimiento `REVERSO` con `reviertePagoId` apuntando al pago original; el saldo vuelve a pagado 40 € / pendiente 60 €.
7. Movimientos de otro local u otro `origenFactura` no alteran el saldo de la obligación exacta.

## Invariantes confirmadas

- La identidad del ledger sigue siendo `facturaId + origenFactura + empresaId + localId`.
- `registrarPagoPM06` exige `facturaId`, empresa y local.
- Rechaza importes no positivos y sobrepagos.
- Usa una clave de operación pendiente por factura/origen para evitar solapamientos mientras una operación está en curso.
- Cada pago confirmado conserva `operationId` y se deduplica por ese identificador al incorporar la respuesta.
- `revertirUltimoPagoPM06` identifica pagos confirmados que todavía no han sido reversados.
- El reverso enlaza explícitamente `reviertePagoId` con el pago original.
- P05 sigue siendo la barrera de entrada: `marcarPagada` exige albarán confirmado y `validarIdentidadFacturaAlbaranPM11(... exigirFactura: true)` antes de delegar en PM06.

## Automatización

Contrato:

`tests/pm11-compra/p06-pago-reverso-e2e-contract.mjs`

Workflow:

`.github/workflows/pm11-compra-p06-pago-reverso.yml`

Run final P06: `34088970929`.

En el run final pasaron:

- `node --check fuente.js`;
- contrato P06;
- regresión P05;
- regresión P04;
- regresión P03;
- contrato E2E P02;
- verificación de que `main` sigue exactamente en `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`.

Los tres primeros intentos de P06 fallaron únicamente por problemas del propio arnés de prueba (extracción de funciones async y, después, rutas incorrectas de dos regresiones). El contrato P06 llegó a PASS antes del último ajuste; no se detectó un fallo funcional nuevo en el ledger durante esos intentos.

## Límite honesto

P06 valida semántica de saldo, pago, sobrepago, reverso, aislamiento e integración con la frontera P05 en el modelo actual. No afirma atomicidad ACID ni resuelve todavía crash/reintento/concurrencia multicliente entre documento y ledger; esas ventanas permanecen reservadas para P08.

## Estado

**PM11_COMPRA_P06_PAGO_REVERSO_E2E=PASS**
