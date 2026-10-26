# Plan Maestro L&A Suite — Etapa 7.1 — medición de rendimiento QA

Fecha: 26/10/2026  
Entorno: QA `qjqorixtkilwsndqayyx` y Deploy Preview del PR `#175`  
Estado: **MEDICIÓN REPETIDA TRAS LIMPIEZA QA; CONTEXTO, TPV Y SHELL OFFLINE EN PASS**

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

1. Repetir la comparación A/B cuando B disponga de un fixture operativo
   equivalente; el aislamiento de contexto ya quedó comprobado.
2. Ejecutar por separado la campaña T9 física con hardware autorizado.
3. Mantener la vigilancia de producción y del contrato offline; esta prueba no
   habilita cobros ni sincronización offline.

## 7. Repetición tras limpieza autorizada de QA

La limpieza fue autorizada expresamente y se limitó al almacenamiento local del
Deploy Preview QA. No se usó Supabase de producción ni se ejecutó ninguna
mutación en servidor. Se retiraron únicamente:

- la entrada `conteos` de `almacen__pendientes`;
- una entrada de contexto `conteos` de `almacen__pendientes_contexto`.

El valor local `almacen:conteos` se conservó. Tras recargar, la interfaz mostró
`Guardado: cambios sin confirmar 0` y `Arranque: datos que no se pudieron
cargar 0`. El aviso de una colección local que el servidor no permite guardar
se mantuvo como característica del entorno QA, no como una cola pendiente.

### 7.1 Mediciones obtenidas

| Escenario | Resultado | Tiempo observado |
|---|---|---:|
| Navegación online posterior a la limpieza | PASS; `Local A1` y panel montados | `DOMContentLoaded 294 ms`; `load 323 ms` |
| Cambio `Local A1 → Local A2` | PASS; sin pendiente ni reintento | `232 ms` |
| Cambio `Local A2 → Local A1` | PASS; sin pendiente ni reintento | `254 ms` |
| Apertura de TPV desde `Más` | PASS; TPV visible, 18 productos, ticket vacío y `F9 Guardar` deshabilitado | `966 ms` |
| Pérdida de red y recarga | PASS de bloqueo seguro; shell propio de la suite visible | `online=false`, service worker controlador |
| Restauración de red | PASS; vuelve el panel A1 | `DOMContentLoaded 294 ms`; `load 323 ms` |

Durante la repetición no se añadió producto, no se abrió Caja, no se guardó una
comanda, no se cobró y no se generó ningún movimiento. El pendiente local quedó
en `[]` antes y después de la prueba.

### 7.2 Decisión de esta medición

La medición de rendimiento de esta tanda queda **PASS** para el ciclo de
contexto A1 ↔ A2, la apertura del TPV y la recuperación segura del shell ante
pérdida de red. El bloqueo observado en la primera tanda queda explicado por un
pendiente local QA preexistente y no reapareció después de su limpieza
autorizada.

Este PASS no amplía el alcance a una segunda empresa, a hardware físico ni a
cobros o sincronización offline. Esos controles siguen abiertos en el acta de
Etapa 7.1.
