# PM14 P08 — Historial, informes, móvil y regresión final del paquete

Último punto de PM14. Cierra el paquete con el único gap concreto y verificable que
quedaba abierto en la UI de Encargos, y con la regresión final de todo lo construido en
P01–P07.

## Problema real encontrado (inspección de código, no hipotético)

Antes de este punto, un encargo **Cancelado** o **Devuelto** desaparecía por completo de
la interfaz:

- `encargosPendientes` (fuente.js:102750, ya excluía `Entregado`/`Cancelado`/`Devuelto`
  desde antes de PM14).
- La sección "Ver encargos entregados" del componente `Encargos` solo filtra
  `estado === "Entregado"` (fuente.js, `const entregados = encargos.filter(...)`).

El dato seguía existiendo (documento local + `encargos_empresa` en la nube desde P02), pero
**nadie podía volver a verlo** desde la UI una vez cancelado o devuelto: ni para consultar el
motivo, ni para saber cuánto se cobró y si se reembolsó. Esto es exactamente el gap que P05
ya había anotado explícitamente como pendiente ("El histórico de encargos devueltos no tiene
todavía su propia sección en la UI... corresponde a P08 (historial/informes)").

## Solución (cambio mínimo, reutilizando el patrón ya existente de "Ver entregados")

- **`historialEncargosPM14(encargos)`** (nueva función pura, fuente.js, justo antes de
  `crearLogicaEncargos`): filtra `Cancelado`/`Devuelto`, recalcula `total` igual que el
  resto del módulo (fallback a líneas si no hay `total` propio), y mapea la fecha/motivo
  reales que ya escriben `cancelarEncargo`/`devolverEncargo`
  (`fechaCancelacion`/`motivoCancelacion`, `fechaDevolucion`/`motivoDevolucion`) a
  `fechaHistorial`/`motivoHistorial`. Ordena por fecha descendente (más reciente primero).
  Es una función de solo lectura: no muta el array de entrada ni llama a `setEncargos`,
  `setTimeout` ni ninguna RPC — no hay nada que idempotencia/replay pueda romper aquí.
- **UI (`Encargos`)**: nuevo toggle "Ver historial (cancelados y devueltos) (N)", con el
  mismo patrón visual que "Ver encargos entregados": cliente, fecha, motivo si existe,
  total, y un color por estado (rojo para Cancelado, ámbar para Devuelto) reutilizando los
  colores (`C2.red`/`C2.amber`) ya usados en el resto del módulo. No añade ninguna acción
  nueva (no hay "deshacer" un cancelado/devuelto: eso ya se decidió explícitamente fuera de
  alcance en P04/P05 — la corrección es dar de alta un encargo nuevo, no revivir el viejo).

## Informes

No se ha añadido una sección nueva a `Reportes` (fuente.js:110756, que hoy no recibe
`encargos` en absoluto). Motivo, documentado y no oculto: integrar Encargos en el motor de
informes ya existente exige decidir qué agregados tienen sentido económico (¿encargos
entregados cuentan ya en Resultados vía `venderLote`? sí, desde P03 — así que un "informe de
encargos" separado corre el riesgo de duplicar cifras que ya están en Resultados/Caja). Eso
es una decisión de producto, no un "cambio mínimo" de cierre de PM14. Lo que sí es
verificable y ya lo es: el dinero de encargos (ventas al entregar, señales, reembolsos) ya
pasa por el mismo motor de venta/caja que TPV (P02/P03/P05), así que **ya aparece
correctamente en los informes existentes** (Resultados, Caja, IVA) sin doble contabilidad;
lo único que faltaba y que este punto resuelve es poder **ver el propio encargo** cancelado o
devuelto, no un informe agregado nuevo.

## Móvil

La aplicación no tiene una vista "móvil" separada: usa clases Tailwind responsivas
(`grid md:grid-cols-2`, etc.) de forma uniforme, y las listas de encargos (pendientes,
entregados, y ahora historial) son `Card` apiladas verticalmente sin anchos fijos —el mismo
patrón ya usado y ya en producción para "Ver encargos entregados". La sección nueva no
introduce ningún elemento de ancho fijo, tabla no-responsiva, ni overflow horizontal: sigue
exactamente el mismo patrón que el resto del módulo, así que no hay regresión de
responsividad que verificar más allá de la revisión de código ya hecha.

## Explícitamente fuera de alcance (documentado, no oculto)

- Ninguna acción nueva sobre encargos cancelados/devueltos desde el historial (no se
  "reabren"): consistente con P04/P05, la corrección de un cancelado/devuelto es un encargo
  nuevo, no una reversión del estado.
- Un informe agregado dedicado a encargos (cuántos se cancelan, motivos más frecuentes,
  etc.) no se construye aquí: el dato ya es correcto en Resultados/Caja/IVA; un agregado
  específico de Encargos es una funcionalidad nueva de producto, no un cierre de gap.
- El riesgo de pérdida de actualización del blob `almacen_kv` (documentado en P07, NR-06 del
  traspaso, destinado a PM23) sigue sin resolverse: la nueva vista de historial lee del mismo
  array `encargos` que ya usa el resto del módulo, sin cambiar su modelo de persistencia.

## Archivos principales

- `fuente.js`: nueva función `historialEncargosPM14`, estado `verHistorial` y sección
  "Ver historial" en el componente `Encargos`.
- `tests/pm14/p08-encargos-historial-contract.mjs` (nuevo): positivo (cancelados/devueltos
  con fecha/motivo correctos), negativo (pendientes/entregados excluidos; datos legados sin
  fecha/motivo no rompen ni inventan datos), orden determinista, y "replay" equivalente para
  una función pura (misma entrada → misma salida, sin mutar el array/objetos de entrada).

## Regresión final de todo el paquete PM14

`tests/pm14/p01` a `p08`, `tests/pm10/p08-encargos-contract.mjs`,
`tests/pm07/frontend-contract.mjs`, `tests/pm09/*.mjs` (17 archivos) — todos en verde, sin
regresiones. Es la misma regresión acumulada que ya se ejecutaba en cada punto anterior,
ahora completa con P08 incluido.

## Estado de main/producción

`main` = `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`, sin tocar. Sin migraciones nuevas (este
punto no toca `supabase/`: es un cambio de UI de solo lectura sobre datos que ya existían).
`L&A Suite` (producción) y `TPV` no se han tocado.

## Cierre de PM14

Con P08 cerrado (pendiente de confirmación del gate remoto sobre el commit exacto), los 8
puntos de PM14 (Encargos, anticipos y clientes) quedan completos: P01 (identidad), P02
(anticipos/saldo), P03 (entrega atómica), P04 (cancelación trazable), P05 (devolución
trazable), P06 (aislamiento de clientes), P07 (verificación de replay/concurrencia) y P08
(historial visible + regresión final).
