# PM19 P05 — Contexto de escritura único: NR-07 y "Todos" nunca destino de mutación

Quinto punto de PM19, surgido al revisar "movimientos" (una de las áreas literales de
PM19) y NR-07 en el resto de módulos más allá de Traspasos.

## Diagnóstico (dos hallazgos)

1. **NR-07 no se aplicaba** en Productos, Producción, Fichas de coste, APPCC ni Aceite:
   ninguna de sus funciones mutadoras comprobaba si el local activo seguía activo antes
   de operar.
2. **Más serio: "Todos los locales" podía ser destino de mutación**, violando la regla
   fijada al principio de esta sesión ("Todos los locales" solo consolida lecturas, nunca
   es destino de una mutación que requiera un local real). Causa: los helpers de
   pertenencia al local (`productoEsDelLocalActivo` y equivalentes en cada módulo)
   devuelven `true` cuando `localActivoId` es `null` — exactamente el valor que
   representa "Todos" en esta app (confirmado por inspección: `setLocalActivoId` nunca
   se llama con un sentinela "todos", solo con `null` o un id real).

## Corrección de rumbo durante la implementación

El encargo inicial pedía generalizar `localActivoEstaActivoPM19` (creada en el cierre
original de P03). Antes de aplicarla a los 5 módulos se encontró que **ya existía**
`validarContextoEscrituraPM10` — función establecida en el código desde antes de esta
sesión, ya reutilizada en 7 puntos del proyecto (Personal, Productos `addProducto`/
`updateProducto`, Pedidos, Encargos, Albaranes), con más cobertura que la nueva función
(local inexistente, empresa/local incompatibles, además de inactivo/"Todos"). Generalizar
`localActivoEstaActivoPM19` en vez de reutilizar la función ya establecida habría creado
la segunda lógica paralela que el propio encargo pedía evitar. Se confirmó su cobertura
con una prueba dedicada antes de sustituir nada, y se corrigió también `traspasarStock`
(P03) para usar la misma función única, retirando `localActivoEstaActivoPM19` por
completo (sin consumidores restantes).

## Solución

`validarContextoEscrituraPM10({ localActivoId, locales })` se añade como primera
comprobación en las 23 funciones mutadoras identificadas:

| Módulo | Funciones protegidas |
|---|---|
| Productos | `addProducto`\*, `updateProducto`\*, `ajustarProductoPorOtro`, `deleteProducto`, `reactivarProducto`, `registrarSalida` |
| Producción | `producir`, `anularProduccion` |
| Fichas de coste | `addFichaCosto`, `updateFichaCosto`, `deleteFichaCosto` |
| APPCC | `addPuntoControl`, `updatePuntoControl`, `deletePuntoControl`, `registrarAppcc`, `cancelarRegistroAppcc` |
| Aceite | `addFreidora`, `updateFreidora`, `deleteFreidora`, `registrarCambio`, `registrarRelleno`, `eliminarRegistroAceite` |
| Traspasos | `traspasarStock` (corregida, ver nota en `P03_CIERRE_TRASPASO_LOCAL_CERRADO.md`) |

\* `addProducto`/`updateProducto` ya la usaban antes de P05 — no se tocaron.

Cada función conserva su propio contrato de retorno ya existente: las que ya devolvían
`{ok, error}` devuelven el resultado de la guarda directamente; las que devuelven
booleano (`deleteProducto`, `reactivarProducto`, `registrarSalida`, `updateFreidora`,
`deleteFreidora`) devuelven `false`; las que no devolvían nada (`addFichaCosto`,
`updateFichaCosto`, `deleteFichaCosto`, `addPuntoControl`, `updatePuntoControl`,
`deletePuntoControl`, `addFreidora`) simplemente no ejecutan la mutación — mismo
convenio de "no-op silencioso" que esas funciones ya usaban para sus propias
comprobaciones de pertenencia al local, así que no se ha introducido ningún
comportamiento nuevo de cara al usuario, solo se ha cerrado un hueco de autorización.

### Función 6: verificación de alcance local vs. empresarial/global

Se revisaron todas las funciones mutadoras de los 5 módulos. Ninguna es
empresarial/global sin alcance de local: las 23 protegidas operan sobre datos que
pertenecen a un local concreto (productos, fichas, órdenes de producción, puntos/
registros de control, freidoras/registros de aceite, traspasos). No hay ninguna
excepción que documentar.

### Condición 4: lecturas consolidadas y locales cerrados no se bloquean

Este punto **no toca ninguna lectura**: los `useMemo` que arman `productosDelLocalActivo`,
`movimientosDelLocalActivo`, etc. siguen devolviendo todo cuando `localActivoId` es
`null` (modo "Todos"), y el histórico de un local desactivado sigue accesible según los
permisos ya existentes — solo se bloquean las 23 funciones que escriben.

## Archivos

- `fuente.js`: `traspasarStock` corregida; `crearLogicaProduccion`, `crearLogicaFichasCosto`,
  `crearLogicaAppcc`, `crearLogicaAceite` reciben ahora `locales`; 21 funciones (18 nuevas
  + 3 de Traspasos/Productos ya existentes referenciadas arriba) llaman a
  `validarContextoEscrituraPM10` antes de mutar; composición actualizada para pasar
  `locales` a los 4 módulos que no lo recibían. `localActivoEstaActivoPM19` retirada.
- `tests/pm19/p05-validar-contexto-escritura-contract.mjs` (nuevo): confirma, antes de
  sustituir nada, que `validarContextoEscrituraPM10` cubre los 5 casos exigidos (ausencia
  de local activo/"Todos", local inactivo, local fusionado, empresa/local incompatibles,
  local inexistente, operación válida).
- `tests/pm19/p05-inventario-mutaciones-protegidas-contract.mjs` (nuevo): inventario
  automático de las 23 mutaciones protegidas — confirma que la guarda aparece, y que
  aparece **antes** de la primera mutación real de estado en cada una (condición 5: sin
  cambios parciales).
- `tests/pm19/p05-comportamiento-guardia-contract.mjs` (nuevo): prueba de comportamiento
  real (no solo estática) positivo/negativo en una función representativa de cada uno de
  los 5 módulos — con contexto rechazado, cero mutaciones; con contexto válido, la
  mutación se ejecuta de verdad.
- `tests/pm19/p03-wiring-traspasos-contract.mjs` (actualizado): ya no prueba la función
  retirada; prueba que `traspasarStock` usa la función única y que el resto de sus
  validaciones (stock disponible, ruta atómica remota, trazabilidad) sigue intacto.
- `tests/pm19/p03-traspaso-local-cerrado-contract.mjs` (retirado): probaba
  exclusivamente la función ya retirada; su cobertura la asume por completo
  `p05-validar-contexto-escritura-contract.mjs`.
- `.github/workflows/pm19-p01-p04-modulos-operativos.yml`: se retira la referencia al
  test eliminado (limpieza menor, no reabre el alcance funcional de P01-P04).

## Regresión

Suite completa del proyecto, con énfasis explícito en PM07 y PM12 — 103/103 sin
regresiones.

## Estado de main/producción

`main` = `34253537bfa132d56e8338b66832f758a8903c73` (release consolidado hasta PM19
P01-P04), sin tocar directamente. Frontend puro, sin migraciones Supabase.
