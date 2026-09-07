# PM12–P10 · Regresión integral, Deploy Preview, smoke y cierre

Estado: **CERRADO — PM12 COMPLETADO**.

## Resultado

PM12 queda cerrado con evidencia acumulada de P02–P10. `main` no fue modificado y continúa congelado en el checkpoint acordado. P10 no contiene cambios nuevos en Supabase ni escrituras de negocio en producción.

## Regresión integral

Gate de rama previo al PR: `34154260011` — **SUCCESS**.

Pasaron:

- sintaxis de los motores/capas PM12;
- contratos PM12 P02–P09;
- smoke seguro de Deploy Preview;
- contrato PostgreSQL P08 sobre base desechable protegida;
- Supabase completo desechable con Auth, JWT, PostgREST y RLS;
- gate final P10;
- verificación de cero cambios nuevos en `supabase/` durante P10;
- verificación de cero nuevos secretos/destinos remotos y cero escrituras productivas.

El primer intento P10 detectó un falso positivo del extractor de assets del propio smoke; la aplicación ya había superado las barreras de Preview. Se corrigió únicamente el arnés. El segundo intento alcanzó PostgreSQL y detectó que P10 había renombrado la base desechable, mientras el contrato P08 exige deliberadamente `pm12_p08_test`. Se conservó ese blindaje y se corrigió solo la invocación del gate. La ejecución posterior quedó íntegramente verde.

## Deploy Preview real

PR de validación: **#28 — DRAFT / NO MERGE**.

Deploy Preview:

`https://deploy-preview-28--chic-entremet-9107cf.netlify.app`

Netlify confirmó el deploy como **READY / SUCCESS** para el commit funcional P10. El despliegue es de contexto `deploy-preview`, no manual ni productivo. Se mantuvo el SSO obligatorio de entornos no productivos.

El workflow P10 disparado por el propio PR (`34154406047`) también terminó **SUCCESS** en:

- regresión integral;
- Supabase completo;
- gate final.

## Smoke seguro de Preview

El contrato P10 demuestra sin escribir en producción que:

1. un host `deploy-preview-*` activa el modo QA;
2. el bootstrap de Preview usa datos locales/QA de prueba;
3. una petición no inventariada al destino productivo queda bloqueada antes de salir;
4. las Edge Functions productivas conocidas se redirigen a sus equivalentes QA;
5. el dominio productivo no activa QA ni recibe el reset de Preview;
6. los assets JavaScript locales referenciados por `index.html` existen;
7. los motores PM12 y la capa P09 están cargados una sola vez.

No se relajó SSO y no se ejecutó smoke mutante en producción.

## Checks heredados PM07/PM08

En el PR #28 aparecen dos checks heredados en rojo, PM07 y PM08. No son fallos funcionales del candidato:

- sus contratos frontend pasan;
- el contrato de migración/RLS/atomicidad PM08 pasa;
- el aislamiento de replay PM08 pasa;
- sintaxis de fuente y bundle pasa;
- fallan únicamente en el antiguo paso `npm run build` + comparación directa contra el bundle moderno.

Ese rojo histórico ya estaba documentado en el cierre PM11: el repositorio evolucionó después de PM08 y la reproducibilidad moderna usada por PM11/P10 no se basa en ese comparador histórico. P10 vuelve a ejecutar los contratos funcionales relevantes y los supera. Los checks heredados no se silencian ni se presentan falsamente como verdes.

## Producción al cierre

Validación final de solo lectura:

- 0 filas en `membresias_usuario`;
- 0 filas en `stock_ubicacion`;
- 0 filas en `stock_operaciones`;
- 0 filas en `movimientos_stock`;
- 0 filas en `almacen_kv`;
- 0 filas en `movimientos_registro`;
- RLS activo en las tres tablas de stock;
- índice único P08 presente;
- RPC de confirmación P08 presente;
- RPC de cancelación P08 presente;
- `anon` sin EXECUTE sobre ambos RPC;
- `authenticated` con EXECUTE sobre ambos RPC.

P10 no generó efectos de negocio en producción.

## Resumen PM12

- P02 — estados y normalización: **CERRADO**.
- P03 — documento y corte temporal: **CERRADO**.
- P04 — cierre honesto/UX: **CERRADO**.
- P05 — ajustes trazables: **CERRADO**.
- P06 — cancelación conservadora: **CERRADO**.
- P07 — permisos y aislamiento: **CERRADO**.
- P08 — fallos, replay y concurrencia; baseline/despliegue productivo: **CERRADO**.
- P09 — historial, informes y móvil: **CERRADO**.
- P10 — regresión integral, Deploy Preview, smoke y cierre: **CERRADO**.

## Decisión

**PM12 queda COMPLETADO.**

El PR #28 permanece **DRAFT / NO MERGE**. Este cierre no autoriza modificar `main` ni promover el código frontend a producción. Cualquier promoción futura debe tratarse como un bloque separado y explícitamente autorizado.
