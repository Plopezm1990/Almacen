# Paquete de preparación F5: notas TPV y recuperación de rutas

Fecha: 2026-10-25  
Base: `release` en `4e8f629cefa614e0705096f87efa4f8dd13ad2af`

## Alcance de esta etapa

Este paquete prepara para una futura promoción controlada dos capacidades relacionadas con el circuito TPV/cocina:

1. Notas de línea TPV: captura de una nota de cocina de hasta 500 caracteres, persistencia idempotente mediante `abc_actualizar_nota_linea` y copia de la nota a la línea de comanda.
2. Recuperación de rutas A10: al configurar la estación de un producto, reencolar únicamente las líneas bloqueadas por `SIN_RUTA`, fusionando con la comanda destino cuando ya existe una comanda compatible.

Quedan fuera deliberadamente de este paquete: fotos, alérgenos, propinas, vales, fiscal, email, hardware, T7, T8 y cualquier cambio de QA que no sea necesario para estas dos capacidades.

## Evidencia de preflight en Supabase PROD

La comprobación fue únicamente de lectura sobre el proyecto `flqercbgpgmmfaakrwkc`:

- Existen `public.pedido_lineas`, `public.comanda_lineas`, `public.comandas_preparacion`, `public.efectos_pendientes`, `public.tpv_producto_estaciones` y `public.tpv_estaciones_preparacion`.
- `public.pedido_lineas.nota` no existía en PROD; `public.comanda_lineas.nota` sí existe.
- Existe `private.abc_a10_encolar_comanda`, junto con las funciones de sesión/capacidad necesarias.
- `private.abc_a10_reencolar_bloqueadas` no existe todavía.
- La versión actual de `public.abc_asignar_producto_estacion` no devuelve `comandas_reencoladas` ni invoca la recuperación A10.
- No se ejecutó ninguna migración ni escritura en PROD.

Conclusión: el paquete cubre los huecos observados sin crear tablas nuevas. La migración deberá aplicarse sólo después de que la revisión QA y la promoción explícita estén aprobadas.

## Archivos incluidos

- `fuente.js` y `source-recovery/fuente-recuperado.js`: nota visible para cocina y envío idempotente.
- `supabase/migrations/20261022130000_abc_f5_tpv_line_notes.sql`: columna, RPC, trigger y permisos de nota.
- `supabase/migrations/20261022140000_abc_f3_a10_route_recovery.sql`: helper privado de recuperación y actualización de asignación.
- `supabase/migrations/20261022150000_abc_f3_a10_route_recovery_merge.sql`: variante de fusión con comanda destino.
- `tests/f5/f5-tpv-line-notes-contract.mjs` y `tests/f3/a10/a10-route-recovery-contract.mjs`: contratos de contenido y seguridad.
- Manifiesto y puerta CI: inventario actualizado a 297 archivos y 280 contratos activos, con 250 contratos Node.

## Verificaciones realizadas

- Contrato de notas TPV: OK.
- Contrato de recuperación A10: 3/3 pruebas OK.
- Contrato de recuperación del Documento 2: OK.
- `node --check` sobre ambas fuentes: OK.
- Validador de manifiesto, incluyendo pruebas negativas: OK.
- `git diff --check`: OK.
- Build Netlify reproducible: OK; `TAILWIND_CSS_BYTES=17764` y publicación generada en `.netlify-dist`.

## Estado y siguiente paso

Estado: paquete preparado para revisión, todavía no promovido a PROD y todavía sin despliegue de producción.

Siguiente paso recomendado: repetir el preflight justo antes de aplicar las tres migraciones. Sólo después corresponde autorizar el merge a `release`, aplicar Supabase PROD y desplegar.

## Evidencia de prueba controlada QA — 2026-10-25

- Producto probado: `Bocadillo de jamón (QA)`.
- Configuración: modificador `Sin cebolla`.
- Nota introducida: `PRUEBA QA F5 - sin cebolla`.
- Pedido creado: `c707c99a-e70f-409e-a632-0f1e909e436c`.
- Resultado del TPV: pedido enviado con estado operativo `ENVIADO`.
- Resultado en Cocina: una sola comanda para el pedido `0f1e909e436c`, en estación `Cocina QA-A1`, estado `PENDIENTE`, con la nota visible.
- Recuperación de ruta: se asignó `Café solo (QA)` a `COCINA-QA · Cocina QA-A1`; la comanda previamente `SIN_RUTA/BLOQUEADA` (`99c9c190f7e6`) apareció como `PENDIENTE` en la estación destino.
- No duplicación: el pedido con nota y la comanda recuperada aparecen una sola vez en la lista visible de Cocina.
- Alcance de la prueba: QA; no se aplicaron migraciones, no se fusionó el PR y no se escribió en PROD.

Resultado: validación controlada QA de notas y recuperación de rutas **TERMINADA**.

## Qué sigue

Repetir el preflight de Supabase en modo lectura inmediatamente antes de promoción. Después, con autorización explícita de promoción, fusionar el PR #177, aplicar las tres migraciones en orden, desplegar y verificar producción.
