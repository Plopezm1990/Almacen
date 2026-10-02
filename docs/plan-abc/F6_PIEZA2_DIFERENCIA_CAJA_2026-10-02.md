# F6 · pieza 2 de la capa de configuración: tratamiento de la diferencia de caja

Fecha: 2026-10-02
Alcance: **solo QA** (`qjqorixtkilwsndqayyx`) y repositorio. **Producción no tocada. Pantalla no modificada.**
Autorización: «Autorizo la pieza 2 solo en QA» (Pedro, 2/10/2026), sobre el diseño de
`F6_INVENTARIO_CAPA_CONFIGURACION_2026-10-02.md`.
Estado: `PIEZA_2_APLICADA_Y_VERIFICADA_EN_QA_SIN_PANTALLA`

La migración la **pegó Pedro a mano en el editor SQL de Supabase de QA** (resultado «Success. No rows returned»)
porque la herramienta de aplicar migraciones de la sesión pedía una aprobación que no llegó a concederse (dos
intentos se cortaron sin aplicar nada; se comprobó entre medias que QA seguía intacta). Por eso **no aparece en la
lista de migraciones de Supabase** (la herramienta es la que la registra); el archivo del repositorio es
`supabase/migrations/20261002210000_abc_config_pieza2_diferencia_caja.sql`.

## Qué se pidió (D15 y D19)

«Toda diferencia de caja se registra en la auditoría, **exige motivo** y, sobre un **umbral configurable por el
propietario**, requiere **su aprobación**; nunca se inventa un ingreso para cuadrar» (D15). El cajero abre y cierra
caja; si hay diferencia sobre el umbral, aprueba el propietario (D19).

## Qué hace

| Pieza | Resultado |
|---|---|
| Umbral configurable | Segundo ajuste por local, `caja_diferencia_umbral`: importe de 0 a 10 000 con hasta 2 decimales, **0 por defecto** (cualquier diferencia exige aprobación del propietario). Lo configura solo el Propietario con la función de la pieza 1 (`abc_configurar_ajuste`) y se lee con `abc_obtener_ajustes` |
| Motivo obligatorio | `abc_registrar_diferencia_caja`: con el cierre en provisional y diferencia distinta de cero, quien opera la caja (propietario, encargado o cajero) escribe el motivo (1 a 500 caracteres). La diferencia se **recalcula en el servidor** con el mismo cálculo que el cierre; el cliente no envía importes |
| Aprobación del propietario | `abc_decidir_diferencia_caja`: **solo el Propietario** aprueba o rechaza, con motivo, y solo si la diferencia **supera** el umbral (en valor absoluto: un sobrante también cuenta; justo en el umbral no hace falta). Se decide una sola vez |
| Rechazo | Rechazar bloquea el cierre definitivo de ese cierre; hay que reabrir (función de C04) y recontar. La fila rechazada queda como historia |
| Guarda del cierre definitivo | Un trigger en `caja_sesiones`: el paso a `CERRADA_FINAL` se rechaza con `cierre_definitivo_diferencia_pendiente:[…]` si falta el motivo (`DIFERENCIA_SIN_MOTIVO`), falta la aprobación (`DIFERENCIA_PENDIENTE_APROBACION`), se rechazó (`DIFERENCIA_RECHAZADA`) o la diferencia cambió tras registrarla (`DIFERENCIA_CAMBIADA`). Vale para cualquier camino, no solo para la función de finalizar |
| Lectura para la pantalla | `abc_obtener_diferencia_caja`: diferencia, esperado, contado, umbral, si requiere aprobación, el registro y los bloqueos |
| Auditoría | Cada paso deja un evento en la cinta (`CAJA_DIFERENCIA_REGISTRADA`, `CAJA_DIFERENCIA_APROBADA`, `CAJA_DIFERENCIA_RECHAZADA`) con diferencia, esperado, contado, umbral, ambos motivos y el actor. El cierre ya guardaba la diferencia en sus eventos de C04 y eso no cambia |
| Datos | Tabla nueva `caja_cierre_diferencias` (una fila por cierre, sin acceso directo). Nada crea movimientos de caja: **no se inventa ningún ingreso** |

Es **aditiva**: no cambia ninguna función de cierre de C04 ni de C12 (comprobado por texto en la prueba estática).
Solo se amplían dos funciones de la pieza 1 (`abc_configurar_ajuste` y `abc_obtener_ajustes`) para admitir el
segundo ajuste; la migración comprueba por huella que son exactamente las de la pieza 1 antes de reemplazarlas.
Los permisos de cada función se reafirman: solo `authenticated`.

## Efecto en la pantalla actual

La pantalla cierra la caja en tres pasos (iniciar, confirmar provisional, finalizar) y **no pide motivo**. Con la
pieza 2 aplicada, **finalizar un cierre que tenga diferencia dará un error** (`cierre_definitivo_diferencia_pendiente`)
y la sesión se queda en cierre provisional (se puede reabrir con motivo, como hoy) hasta que la pantalla use las
funciones nuevas (pieza 6). Con diferencia 0 todo sigue igual. En QA no hay ninguna sesión en cierre provisional
ahora mismo, así que ningún dato existente queda bloqueado.

## Decisiones de Pedro (2/10/2026, por preguntas con opciones) y límites

| Tema | Decisión |
|---|---|
| Pantalla actual | **Se deja hasta la pieza de pantalla (pieza 6)**: no se toca la pantalla ahora. En QA, finalizar un cierre con diferencia dará error hasta entonces |
| Umbral por defecto | **0 €** (cualquier diferencia exige aprobación del propietario); cada propietario lo cambia por local |
| Autoaprobación | **El propietario puede aprobar su propia diferencia**; queda el actor en la auditoría |
| Siguiente paso | **Esperar** a que Pedro permita en el conector de Supabase la herramienta de aplicar migraciones y entonces aplicar la pieza 2 en QA |

Límites que siguen abiertos:

1. **Reabrir un cierre** sigue permitido a quien opera la caja (también al cajero): D14 y la plantilla D19 piden
   solo el propietario, pero eso pertenece a la pieza de permisos y no se cambió aquí.
2. **Una sola moneda (EUR) por ahora**: el umbral se aplica al importe de la moneda de la sesión.
3. Si la diferencia **cambia después de registrarla** (en la práctica no se puede mover caja con el cierre
   provisional; es una defensa), el cierre se bloquea con `DIFERENCIA_CAMBIADA` y hay que registrar de nuevo.

## Pruebas

| Prueba | Resultado |
|---|---|
| Contrato vivo `tests/cfg/cfg2-contract.sql` **en QA**, con `ROLLBACK`, en cuatro llamadas (la herramienta corta a los 60 s): ajustes 44/44, aprobación y dentro del umbral 57/57, rechazo y umbral 68/68, guarda y aislamiento 32/32 | **201/201** |
| Mismo contrato en una réplica local (cadena de migraciones con C04, funciones reales de membresía), 6 trozos independientes | **201/201** |
| Contrato vivo de la pieza 1 con la pieza 2 aplicada, en la réplica local (regresión) | **102/102** |
| Contrato original de C04 con Postgres real (`c04-postgres-contract.mjs`) con las piezas 1 y 2 aplicadas | **PASS** |
| Contrato original de C12 con Postgres real (`c12-postgres-contract.mjs`) con las piezas 1 y 2 aplicadas | **PASS** |
| Contrato estático `tests/cfg/cfg2-static-contract.mjs` | OK |
| Mutantes del contrato vivo: 22 averías provocadas (sin guarda, guarda ciega al cierre final, «mayor o igual», el encargado decide, motivo opcional, rechazo que no bloquea, umbral por defecto distinto, sin valor absoluto, evento equivocado…) | **22/22 detectadas** |
| Mutantes del contrato estático: 27 averías provocadas (permisos, `search_path`, ACL, RLS, política, toca C04, borra, huella, rangos, orden de bloqueo…) | **27/27 detectadas** |

Estado de QA comprobado **después** de aplicar y de las pruebas: tabla `caja_cierre_diferencias` con RLS activada, sin
políticas y sin permisos de tabla; las 8 funciones son SECURITY DEFINER con `search_path` vacío, las 3 privadas sin
permiso para nadie y las 5 públicas solo para `authenticated` (ni `anon`, ni `service_role`, ni `public`); la restricción de
la clave de ajustes admite `caja_diferencia_umbral`; el trigger nuevo convive con el de C04; **cero residuos** de las
pruebas (empresas, locales, membresías, cajas, sesiones, diferencias, eventos y operaciones `CFG-*`), sin transacciones
abiertas ni bloqueos; la única sesión de QA sigue `ABIERTA`, las reglas del día siguen en 00:00 y no hay ajustes
guardados (el umbral rige por su valor por defecto, 0).

Cobertura destacable del contrato vivo: permisos por rol y por empresa/local (`anon` y `service_role` rechazados),
idempotencia con replay y conflicto de `operation_id`, justo en el umbral y un céntimo por encima, umbral 0, sobrante,
rechazo con reapertura y nuevo cierre, umbral que cambia entre el registro y el cierre, guarda por vía directa y
aislamiento entre locales y empresas.

Hallazgos durante las pruebas (resueltos en el propio contrato):

- Todo el contrato corre en una sola transacción y `now()` no avanza, así que las restricciones del cierre real
  (`hasta > desde`) obligan a retrasar una hora lo guardado al abrir la sesión (`pg_temp.envejecer`); en producción
  son transacciones distintas.
- La guarda necesita ver el cierre ya marcado `FINAL`: el trigger corre cuando la función de finalizar ya lo
  actualizó. Un mutante que solo mira `PROVISIONAL` deja pasar todo y el contrato lo detecta.

## Límites de la verificación

- La réplica local no incluye todas las migraciones posteriores a C04; la ejecución en QA es la que cubre la cadena
  real. Aun así, **QA no es producción**.
- Producción **no** se consultó: podría tener versiones distintas de las funciones que la migración comprueba por
  huella (en ese caso se detendría sin cambiar nada).
- Sin prueba de carga ni de concurrencia real. El orden de bloqueo (primero el cierre, luego la sesión, igual que
  C04) se razona y se comprueba por texto, no se midió.
- La migración no está registrada en la lista de migraciones de Supabase de QA (se aplicó a mano).
- Para el contrato en QA, la prueba de «el Encargado sin acceso a ese local» desactiva su membresía en lugar de
  borrarla (la herramienta pide una confirmación extra con sentencias de borrado, aunque sea dentro de una
  transacción que se revierte); es una prueba equivalente y más realista, y el archivo del repositorio ya usa esa
  versión (201/201 también en local).
- Antes de promocionar: registrar `cfg2-static-contract.mjs` y el contrato vivo en la puerta de CI, y adaptar la
  pantalla (pieza 6) para no romper el cierre con diferencia.

## Siguiente paso

Pieza 3 (modalidades por local), pieza 4 (registro de equipos), pieza 5 (permisos configurables y retirada de roles) o la
pantalla de configuración (pieza 6); cada una necesita su autorización.
