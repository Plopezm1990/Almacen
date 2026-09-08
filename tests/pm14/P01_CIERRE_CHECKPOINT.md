# PM14 · P01 — Checkpoint de cierre

Fecha: 2026-09-08
Rama: `pm14-encargos-anticipos-clientes`
Base PM14: `6ee2752a8f6aba882a6fa926892ab5b04aac231d`
Commit funcional P01: `d6dd24c5e125313100ed77895c37361f0e15c0b1`

## Resultado funcional

P01 fija el encargo como documento con identidad estable:

- empresa y local explícitos para altas nuevas;
- cliente compatible con empresa;
- `id`, `empresaId`, `localId` y `fechaCreacion` protegidos frente a cambios ordinarios;
- total calculado y conservado en el documento;
- precios de líneas históricos no se reinterpretan por cambios posteriores del catálogo;
- local inactivo, local inexistente y contexto sin local concreto bloquean nueva escritura;
- un legado sin `empresaId` no se repara silenciosamente desde el selector actual.

## Regresiones

El run `34192114900` ejecutó correctamente el contrato P01, PM10 Encargos, PM10 contexto, PM05 y barreras de alcance, y generó el commit funcional anterior. Como el push realizado con `GITHUB_TOKEN` no dispara una ejecución posterior por sí mismo, este checkpoint existe para exigir un gate remoto nuevo sobre un HEAD que ya contiene el commit funcional.

## Rojos históricos resueltos

- `34191994148`: fallo de mantenimiento del harness P01; un `null` explícito de local era sustituido por `L1` en la propia prueba. No hubo commit funcional.
- `34192048859`: P01 pasó, pero una aserción estática heredada de PM10 tenía una ventana de 900 caracteres y el nuevo bloque de guardas de identidad la excedió. Se amplió solo esa ventana; no se relajó el contrato de dominio. No hubo commit funcional.
- `34192114900`: pruebas y gate verdes; produjo `d6dd24c5...`.

## Alcance

Sin cambios en `main`, sin cambios en Supabase, sin producción, sin datos reales y sin migraciones. P02 será el bloque de anticipos/cobro trazable; P01 no declara que el `cobros` embebido antiguo sea un movimiento real de caja.
