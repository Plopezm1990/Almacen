# Plan Maestro L&A Suite — Etapa 7.1 — medición de rendimiento QA

Fecha: 26/10/2026  
Entorno: QA `qjqorixtkilwsndqayyx` y Deploy Preview del PR `#175`  
Estado: **MEDICIÓN INICIADA; BLOQUEADA POR PENDIENTE QA PREEXISTENTE**

## 1. Objetivo

Medir el arranque, el cambio de local, la carga del TPV y la recuperación de
red sobre QA, sin crear ventas, cobros ni movimientos de Caja. La medición
debe realizarse sobre una sesión limpia; si aparece una escritura pendiente,
no se debe pulsar `Reintentar` ni borrarla durante la auditoría.

## 2. Sesión y línea base parcial

Se abrió una pestaña nueva del Deploy Preview sobre el contexto QA del
propietario. La Plataforma cargó y se abrió la aplicación en `QA Empresa A,
S.L.`, `Local A2`.

La navegación registró de forma parcial:

| Señal | Resultado observado | Alcance |
|---|---:|---|
| `domContentLoadedEventEnd` | `815,1 ms` | Documento inicial |
| `loadEventEnd` | `839,9 ms` | Documento inicial |
| Recursos registrados | `90` | Navegación observada |
| Shell/plataforma visible | Sí | Confirmado visualmente |
| Estado inicial de negocio | `Local A2`, ticket no abierto | Sin mutación |

Estos tiempos son observaciones de navegador y no constituyen un SLA. La
medición de hidratación completa del TPV no se acepta todavía porque la sesión
quedó contaminada por un pendiente local de QA.

## 3. Incidencia encontrada durante A2 → A1

Antes de cambiar de local, la interfaz ya mostraba:

`Subiendo 1… · 1 solo en este equipo`

Al seleccionar `Local A1`, el contexto visual cambió correctamente y mostró
los datos de A1. El tiempo observado desde la acción hasta la actualización
visible fue aproximadamente `260 ms`.

Sin embargo, la sesión mostró después:

- `Un cambio no se ha podido guardar (conteos). Comprueba tu conexión o
  reintenta ahora; mientras tanto queda guardado en este equipo.`;
- botón `Reintentar`;
- `Guardado: cambios sin confirmar 1`;
- `Subiendo 1… · 1 solo en este equipo`.

El pendiente de `conteos` ya estaba presente antes del cambio de local, por lo
que esta tanda no permite atribuirlo a la medición ni declarar A2 → A1 como
PASS de rendimiento. El cambio visual de contexto sí terminó, pero la
recuperación de la cola no queda aceptada.

## 4. Contención aplicada

No se pulsó `Reintentar`, no se eliminó el pendiente y no se provocó ninguna
venta, cobro, movimiento de Caja ni modificación de negocio. La razón es
preservar la evidencia y no convertir una auditoría de lectura en una nueva
escritura QA.

La pérdida de red no se emuló en esta tanda porque la incidencia de cola
apareció antes de completar la línea base. La red permanece restaurada.

## 5. Decisión

La medición de rendimiento queda **BLOQUEADA / NO CONCLUYENTE** por el
pendiente de `conteos` que ya existía en la sesión QA. No se declara un fallo
de producción ni se mezcla con Supabase de producción.

Los datos parciales quedan registrados para no perderlos, pero no deben usarse
como aceptación final:

- documento inicial: observado por debajo de un segundo hasta `loadEventEnd`;
- cambio visual A2 → A1: aproximadamente `260 ms`;
- sincronización de `conteos`: pendiente y no aceptada;
- hidratación completa del TPV: pendiente;
- recuperación offline: pendiente de una sesión QA limpia;
- rendimiento final: pendiente.

## 6. Qué sigue

1. Preparar una sesión QA limpia que no tenga el pendiente local de `conteos`.
2. Repetir A2 → A1 → A2 sin pulsar acciones de negocio.
3. Medir la hidratación completa del TPV y la cola de movimientos/conteos.
4. Solo después ejecutar la pérdida de red y la recuperación.
5. Si el pendiente reaparece en una sesión limpia, abrir una incidencia técnica
   separada y corregirla antes de cerrar la aceptación de rendimiento.
