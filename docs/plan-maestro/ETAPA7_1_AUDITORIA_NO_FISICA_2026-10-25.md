# Plan Maestro L&A Suite — Etapa 7.1 — auditoría QA no física

Fecha: 25/10/2026  
Entorno objetivo: QA `qjqorixtkilwsndqayyx` y Deploy Preview del PR #175  
HEAD local auditado: `53269e7` (`docs(plan): confirm etapa 7 QA on current preview`)  
Estado: `7.1_CONTRATOS_COMPLETADOS; ACEPTACION_VIVA_PENDIENTE; ETAPA_7_ABIERTA`

## 1. Alcance ejecutado

Esta acta continúa el preflight de la Etapa 7.1 definido en
`ETAPA7_PREFLIGHT_QA_2026-10-25.md`. Se ejecutó la parte segura y no física de
la campaña:

- permisos y aislamiento por empresa/local;
- arranque y barrera de Plataforma;
- copias locales aisladas por cuenta y cuota/historial;
- contexto de escritura y pantallas con roles fijos;
- frontera de contingencia offline;
- aislamiento del registro de errores;
- validaciones de sintaxis y estado del worktree.

No se crearon cuentas, ventas, cobros, fixtures, migraciones ni cambios de
permisos durante esta campaña. No se tocaron datos de producción.

## 2. Resultado de contratos

### 2.1 Contratos estáticos y de aislamiento

Los siguientes 13 contratos terminaron con resultado satisfactorio:

| Bloque | Resultado |
|---|---:|
| Plataforma P02 — creación de propietario | PASS |
| Plataforma P04 — panel | PASS |
| G1 P05 — permisos y aislamiento | PASS, 12 comprobaciones |
| PM10 P13 — contexto y aislamiento | PASS |
| PM11 P07 — aislamiento de compra | PASS |
| PM12 P07 — permisos y aislamiento de ajustes | PASS |
| PM13 P08 — cargos y permisos de UI | PASS |
| PM13 P13 — aislamiento de cargos | PASS de contrato; conserva una nota de pendiente para permisos distintos por empresa |
| PM13 P21 — pantallas configurables para roles fijos | PASS |
| PM14 P06 — clientes y anonimización por empresa | PASS |
| F4 B11 — frontera offline | PASS |
| PM20 P06 — errores del sistema aislados por empresa | PASS |
| PM19 P05 — contexto único de escritura | PASS |

La nota de PM13 P13 no se oculta: el contrato confirma el aislamiento y deja
fuera de este bloque los puntos que requieren validar permisos diferentes por
empresa. No se presenta como una certificación de la matriz viva completa.

### 2.2 Runtimes de Plataforma

Los cinco runtimes se repitieron declarando la carpeta local de dependencias
UI (`react@18.3.1`, `react-dom@18.3.1` y `jsdom`). Resultado: **5/5 PASS**.

- P05 panel de Plataforma: `95/95`;
- P06 arranque de Plataforma: `44/44`;
- P07 empresas sin alta: `8/8`;
- P08 copia local por cuenta: `28/28`;
- P08c historial y cuota: PASS.

La ejecución inicial sin `CFG6_UI_DEPS` no se contabiliza como fallo de
producto: se detuvo por dependencia de entorno y se repitió correctamente
con la carpeta disponible.

## 3. Comprobación del preview abierto

El preview inspeccionado respondió correctamente y el deploy de Netlify estaba
en estado `ready`, pero su registro identifica:

- deploy: `6ade1e88f2cddc8fd71f0124`;
- PR: `#175`;
- commit servido: `c436d4ad8b81b06fac56be37ee1d3e2289bdd8e2`;
- HEAD local auditado: `53269e7`.

Por tanto, el preview abierto no es una prueba del HEAD actual. La pantalla de
errores mostró únicamente entradas históricas de `leerConfigPuenteLA` y
conflictos de sincronización, con última entrada visible el 25/10 a las
12:31:57; no se observó una entrada nueva durante la navegación no destructiva.
El histórico se conserva y no se borra.

La comprobación viva confirmó además que la aplicación carga como Propietario
en `QA Empresa A, S.L.`, `Local A1`, y que el selector permanece dentro de
los locales de esa empresa. Esta observación queda limitada por el desfase del
commit servido y no se usa para aceptar el HEAD `53269e7`.

## 4. Qué queda fuera de esta acta

La campaña 7.1 no queda cerrada como aceptación viva completa porque todavía
no existe evidencia reproducible sobre el preview del HEAD actual para:

1. cuentas QA reales de Propietario, Encargado, Cajero/a y Camarero/a;
2. consultas y mutaciones controladas A/B y A1/A2 con esas cuentas;
3. tiempos medidos de arranque, cambio de local, carga del TPV y recuperación;
4. recarga y pérdida de red observables sobre el preview actualizado;
5. comparación del mismo pedido TPV viejo/nuevo y conteo de toques;
6. impresora de tickets y cajón físicos;
7. entrega push real de AUD-010.

Los contratos PASS demuestran invariantes del código y de las piezas aisladas,
pero no sustituyen la campaña viva ni la prueba física exigida por T9.

## 5. Decisión

**Etapa 7.1 — bloque automatizado/no físico: ejecutado y documentado.**  
**Etapa 7 completa: permanece ABIERTA.**  
**T9: no se declara PASS.**  
**No se autoriza fusión a `release` ni promoción a producción desde esta acta.**

## 6. Siguiente paso

Actualizar o regenerar el Deploy Preview del PR #175 desde el HEAD actual
`53269e7` y repetir sobre ese deploy la matriz viva de cuentas, aislamiento y
métricas. Después se abrirá la campaña 7.2/T9 únicamente cuando estén
disponibles una impresora y un cajón reales. La aceptación final de la Etapa 7
requiere ambas campañas y una decisión explícita sobre AUD-010.

## 7. Nueva comprobación viva sobre el alias QA

Se abrió el alias del preview sin el parámetro que fijaba el deploy antiguo y
se repitió una navegación no destructiva con la cuenta QA visible en la
sesión:

- la pantalla de Plataforma cargó correctamente;
- la aplicación abrió como Propietario en `QA Empresa A, S.L.`, `Local A1`;
- el selector ofreció `Local A1` y `Local A2`, sin mezclar empresas;
- el arranque terminó mostrando el resumen general, `Arranque: datos que no
  se pudieron cargar 0` y el contexto de `Local A1`;
- el cambio a `Local A2` mostró los datos de A2 y el retorno a A1 recuperó el
  contexto y las cifras de A1.

Las mediciones observadas en esta sesión fueron:

| Medición | Resultado observado | Interpretación |
|---|---:|---|
| Recarga hasta resumen general | `10,666 ms` (≈`10,7 s`) | Medición de navegador, no un SLA aprobado |
| Cambio de local A1 → A2 | `489 ms` | Estado de A2 visible y coherente |
| Cambio de local A2 → A1 | completó la vista, con incidencia de sincronización | No aceptable como PASS hasta aislar la causa |
| Carga del TPV | No ejecutada | Se detuvo la campaña al aparecer el bloqueo de escritura |

### Incidencia detectada y contención

Antes de cambiar de local ya existía un pendiente local. Al volver de A2 a A1
la interfaz mostró:

> `Un cambio no se ha podido guardar (movimientos). Comprueba tu conexión o
> reintenta ahora; mientras tanto queda guardado en este equipo.`

El contador visible pasó de `1` a `2` y apareció el botón `Reintentar`. El
botón no se pulsó: hacerlo habría iniciado una escritura/reintento y no es
necesario para demostrar el fallo. Tampoco se borró el pendiente ni se
modificó el histórico.

El panel `Errores del sistema` siguió mostrando únicamente los registros
históricos de `leerConfigPuenteLA` y conflictos de sincronización ya
documentados; no apareció una nueva excepción de runtime durante esta
navegación. Esto distingue el bloqueo de sincronización pendiente de una
excepción JavaScript nueva, pero no demuestra que el flujo de escritura sea
aceptable.

Resultado de esta sesión: `7.1_VIVO_BLOQUEADA_POR_SINCRONIZACION_MOVIMIENTOS`.
La prueba de aislamiento visual es positiva, pero la campaña no puede
declararse PASS mientras no se reproduzca el flujo con una sesión QA limpia y
se determine por qué una navegación entre locales intenta sincronizar un
pendiente de `movimientos` y lo deja en error.

## 8. Decisión actualizada

La Etapa 7.1 conserva el estado **automatizado completado / aceptación viva
bloqueada**. La Etapa 7 global sigue abierta y T9 no se declara PASS. No se
autoriza fusión a `release` ni promoción a producción.

El siguiente paso técnico es preparar una sesión QA limpia o una cuenta QA
aislada, conservar esta evidencia como caso de regresión y repetir A1↔A2 sin
pendientes previos. Si el fallo se reproduce, hay que corregir o justificar
formalmente el manejo de `movimientos` antes de continuar con la carga TPV,
la comparación de toques o el hardware real.

## 9. Diagnóstico técnico posterior a la sesión viva

Se consultó el proyecto Supabase de QA `qjqorixtkilwsndqayyx` en modo
solo lectura, sin reintentar ni modificar el pendiente de la interfaz.

### 9.1 Evidencia observada

- `public.movimientos_registro` tiene 984 filas visibles en QA; 981 pertenecen
  a `QA-EMP-A / QA-A1`, una a `QA-EMP-A / QA-A2`, una a `QA-EMP-B / QA-B1` y
  una a otro contexto de empresa.
- No hay filas con `empresa_id` o `local_id` nulos.
- La tabla tiene índice por `(empresa_id, fecha)` y clave primaria por `id`.
- La política de lectura exige `private.plataforma_mov_permitido(...)`, que
  comprueba membresía, empresa activa, local permitido y cambio de contraseña
  pendiente por fila visible.
- En los logs de QA no apareció ningún `POST`, `PATCH` ni `DELETE` sobre
  `movimientos_registro` asociado a la sesión observada. Por tanto, el fallo
  visible no demuestra un rechazo del `upsert` de una fila.
- Sí aparecen lecturas `GET` de hasta `1.000` filas sobre
  `movimientos_registro` con tiempos de origen observados de hasta `5.722 ms`.
  La aplicación utiliza `ESPERA_NUBE_MS = 6.000`, de modo que la lectura
  completa queda en el límite operativo y puede vencer por cualquier latencia
  adicional del navegador, la red o la cola de sincronización.
- El proyecto registra además eventos de `Warp server error: Thread killed by
  timeout manager` durante la ventana de observación. No se atribuye ese
  evento automáticamente a una única petición de movimientos, pero confirma
  que el backend QA estaba bajo presión de tiempo durante la campaña.

### 9.2 Conclusión técnica acotada

La hipótesis con mejor respaldo es un bloqueo por **lectura completa del
histórico bajo RLS y límite de seis segundos**, antes de que el flujo llegue a
la escritura fila a fila. Sigue siendo una hipótesis de causa raíz, no una
prueba definitiva de que cada evento de la interfaz provenga de esa única
lectura.

La arquitectura actual de `index-storage-bootstrap.js` confirma el punto de
presión: para sincronizar `movimientos`, primero lee todas las filas remotas
por páginas, compara la colección completa y solo después ejecuta los
`upsert`. Al cambiar de local, el guardado reactivo de `movimientos` puede
volver a recorrer esa ruta aunque el usuario no haya creado una operación de
negocio nueva.

### 9.3 Criterio de salida añadido

Antes de declarar PASS la aceptación viva de 7.1 se debe conseguir una de
estas dos salidas verificables:

1. optimizar la lectura/sincronización de `movimientos` y demostrar en una
   sesión QA limpia que A1↔A2 no genera pendientes ni avisos; o
2. demostrar con una traza controlada que la lectura termina por debajo del
   límite, que el pendiente corresponde a un caso conocido y que existe una
   recuperación automática sin pérdida ni duplicación.

No se cambia la política RLS ni se aplica una migración desde esta acta. La
Etapa 7 permanece abierta y la campaña TPV/hardware continúa bloqueada hasta
resolver este criterio.

## 10. Corrección aplicada para el bloqueo de navegación A1↔A2

Se corrigió `fuente.js` para distinguir entre:

- un cambio real de movimientos heredados que sí debe persistirse en
  `movimientos_registro`; y
- la sustitución de la proyección `_pm07Servidor` que llega desde
  `movimientos_stock` al cambiar de local o refrescar el contexto.

La corrección calcula una huella de los movimientos persistibles, ignorando
las filas autoritativas de PM07 y sus marcas locales. Si esa huella no cambia,
la actualización visual se conserva, pero el efecto reactivo no vuelve a
ejecutar la lectura completa del histórico heredado. Si cambia un movimiento
real, el guardado normal continúa funcionando.

Validaciones ejecutadas después del cambio:

- `node --check fuente.js`: PASS.
- P05 panel UI runtime: `95/95` PASS.
- P06 arranque plataforma runtime: `44/44` PASS.
- P08 copia local por cuenta runtime: `28/28` PASS.
- P08C copia de historial/cuota runtime: PASS.
- `git diff --check`: PASS.

El cambio todavía no se considera aceptado en vivo: debe publicarse en un
preview QA actualizado y repetirse A1→A2→A1 con una sesión limpia, verificando
que no aumenta la cola de `movimientos` y que no aparece el aviso de pendiente.

## 11. Repetición viva tras publicar la corrección

El commit `de4ac98` se publicó por avance directo en
`codex/etapa5-recuperacion-qa`, que alimenta el PR 175. Sobre el preview QA
actualizado se abrió una sesión nueva con la cuenta visible de Propietario y
se ejecutó la secuencia no destructiva `A1 → A2 → A1`.

Resultado observado:

- A1 cargó con `Arranque: datos que no se pudieron cargar 0`.
- La cola inicial mostraba únicamente `1` copia de `historialRespaldos`
  conservada solo en este equipo por la política de QA.
- A1 → A2 mostró correctamente el resumen de A2 y la cola siguió en `1`.
- A2 → A1 recuperó correctamente el resumen de A1 y la cola siguió en `1`.
- No apareció el aviso `Un cambio no se ha podido guardar (movimientos)`.
- No apareció botón `Reintentar` asociado a `movimientos`.
- No se realizó ninguna venta, alta, ajuste, borrado ni reintento manual.

La comprobación de logs de QA mantiene las lecturas históricas de
`movimientos_registro` con respuesta HTTP `200` y no muestra escrituras
fallidas. La sesión actual tampoco generó un nuevo pendiente de movimientos.

Estado de salida de este bloqueo: **RESUELTO EN PREVIEW QA PARA EL CASO DE
REGRESIÓN A1↔A2**. La aceptación global de la Etapa 7 sigue abierta porque
faltan todavía el resto de la matriz viva, la prueba TPV completa, offline,
roles y el hardware físico de T9.

## 12. Comprobación TPV, contratos relacionados y bloqueo de CI

En la sesión QA del preview se abrió el TPV en `Local A1` con la tarifa
General. La interfaz mostró el catálogo de 18 productos, ticket vacío,
categorías, búsqueda, vale regalo, simulador de cajón, historial y las vistas
de Venta, Sala, Reparto, Operativa, Descuento, Cobro y Caja. Se añadió un
producto al ticket y se vació inmediatamente mediante `Vaciar carrito` para
comprobar la respuesta visual. La acción quedó en borrador local y no se
guardó ninguna venta, cobro, caja, cajón ni operación de negocio.

La batería de contratos ejecutada el 25-10-2026 terminó completa con PASS:

- `f4/b11`: límites del modo offline.
- `f5`: UI T1-T4 y notas TPV/alérgenos.
- `f3/a07`: integración real de planta y reasignación de mesa/cuenta.
- `f3/a08`: reparto de líneas, bloqueo de cobro incierto, bloqueo optimista y
  prohibición de UUID manual.
- `f3/a10`: recuperación de comandas bloqueadas y UI de cocina/estaciones.
- `pm07`: cantidades rápidas del TPV sin botones anidados.
- `plan-maestro`: TPV/movimientos de caja y cobro/caja de Documento 2.
- `pm13/p21`: pantallas por roles fijos.
- `pm09/p10`: conciliación de caja, ventas, reversos y devoluciones.

Durante esta ejecución apareció un fallo de CI en el contrato A08.1. La
implementación era correcta, pero el test buscaba `vendibles` en una posición
fija que dejó de ser válida al existir funciones de descuentos entre la
etiqueta de destino y el listado de productos. Se corrigió únicamente el
delimitador del contrato para localizar la siguiente declaración válida,
conservando las aserciones de seguridad. Tras la corrección, A08.1 y toda la
batería anterior pasaron.

Este resultado cierra el bloqueo de CI de esta matriz y confirma la carga y
respuesta básica del TPV en QA. No constituye todavía la aceptación completa
de Etapa 7: quedan pendientes la matriz viva por roles, la recuperación offline
real, la prueba completa de cobro/caja sin datos de negocio y la validación
física de impresora, cajón y periféricos T9.
