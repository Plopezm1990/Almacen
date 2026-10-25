# Plan Maestro L&A Suite — Paridad `fuente.js` ↔ `source-recovery/fuente-recuperado.js`
# (arregla A02.1 y A08.1)

Fecha: 25/10/2026
Entorno: solo código y pruebas automáticas (sin QA ni PROD).
Autorización: Pedro (chat, 25/10/2026) — "Arreglar los dos bugs de paridad de texto
preexistentes (A02.1 y ahora A08.1)".

## 1. Qué fallaba de verdad

`tests/f3/a02/a02-1-contract.mjs` comprueba que `fuente.js` termina exactamente con el
mismo texto que `source-recovery/fuente-recuperado.js` (quitando sus 14 líneas de
cabecera) — la "paridad de cuerpo completo" que esta sesión viene verificando en cada
pieza. Esa comprobación fallaba desde antes de esta sesión (confirmado ya el 25/10 con
`git stash` contra el commit `d595f3d0`, previo a toda la Etapa 6).

**La causa real**: en algún momento (antes de esta sesión) se añadieron a `fuente.js`,
pero nunca se copiaron al espejo, dos piezas completas:

- **A06, extensión "aparcar/recuperar cuenta por elección"**: `aparcarCuentaA06`,
  `listarCuentasRecuperablesA06`, la nueva firma de `recuperarCuentaA06` (ahora acepta
  `cuentaIdSolicitada`/`cuentaRecuperable` en vez de recuperar siempre la última), la
  pantalla "Cuentas aparcadas / recuperables" (`renderCuentasRecuperablesA06`) y sus
  estados asociados.
- **PM08, "Caja · entradas y retiradas" integrada en el TPV**: `abrirMovimientosCajaDesdeTpv`,
  `renderMovimientosCajaTpv`, y el cableado de `movimientosCaja`/`registrarMovimientoCaja`/
  `eliminarMovimientoCaja`/`leerBorradorMovimientoCaja` hasta `VentaRapida`.
- Además, `unirCuentasA08` (A08, unir/fusionar cuentas) le faltaba en el primer
  destructuring de nivel superior del espejo (sí llegaba a `VentaRapida`, pero con un
  hueco en un punto intermedio).

Ninguna de estas tres piezas es nueva ni dudosa: las tres tienen su propio respaldo real
en el código de `fuente.js` y, en el caso de A08/A06, sus propios contratos ya probados
(`tests/f3/a08/*`, lógica de A06 ya cubierta en otros tests). Simplemente nunca se habían
copiado al espejo.

## 2. Qué se hizo

1. Se regeneró `source-recovery/fuente-recuperado.js`: se conservaron sus primeras 14
   líneas (la cabecera con los `import` reconstruidos, que no existen igual en el bundle)
   y se sustituyó todo el resto por una copia exacta de la parte equivalente de
   `fuente.js` (desde `var C2 = {` hasta el final del archivo). Es la forma más segura de
   garantizar paridad exacta — nunca aplicar a mano 24 fragmentos de diferencias
   dispersas, con riesgo de errores de transcripción.
2. Comprobado con un `diff` dedicado: el espejo resultante coincide carácter a carácter
   con la cola de `fuente.js`. `node --check` en ambos archivos: OK.
3. Al aplicar el espejo correcto, **dos tests que antes fallaban por culpa del espejo
   desincronizado pasaron a estar en verde solos**: `tests/f3/a02/a02-1-contract.mjs`
   (paridad de cuerpo, el síntoma reportado) y, de regalo, `tests/f4/b04/b04-ui-contract.mjs`
   y `tests/f4/b05/b05-ui-contract.mjs` (fallaban por el mismo motivo, sin que nadie lo
   hubiera reportado todavía).
4. El resto de `a02-1-contract.mjs` reveló un segundo problema, de la misma familia:
   una comprobación interna (la "P14", lista cerrada de RPCs permitidas en el camino
   primario) no incluía `abc_actualizar_nota_linea` (la función de "notas de línea",
   Etapa F5, con su propio contrato ya probado en
   `tests/f5/f5-tpv-line-notes-contract.mjs`) — una función legítima añadida después de
   escribir esa lista cerrada, nunca actualizada. Se corrigió la lista esperada.
5. `tests/f3/a08/a08-1-ui-contract.mjs` (el segundo síntoma reportado) tenía dos
   comprobaciones de texto literal desactualizadas por el mismo motivo: no incluían
   `unirCuentasA08` ni el cableado de `movimientosCaja`/etc. Se actualizaron al texto
   real actual.
6. Se repitió exactamente el mismo patrón (ancla de texto desactualizada) en otros dos
   tests, descubiertos al volver a pasar **toda la batería Node del proyecto** (no solo
   los dos reportados) para comprobar que la corrección no rompía nada ni dejaba cabos
   sueltos: `tests/f3/a06/a06-1-ui-contract.mjs` y `tests/f3/a07/a07-1-ui-contract.mjs`,
   los dos con la misma firma antigua de `recuperarCuentaA06()` (sin parámetros) como
   ancla de búsqueda. Se actualizaron a la firma real actual.

## 3. Verificación

- `node --check` en `fuente.js` y el espejo: OK.
- Los 6 tests implicados (`a02-1`, `a08-1`, `a06-1`, `a07-1`, y de regalo `b04`, `b05`):
  todos en verde.
- Se repitió **toda la batería de tests en entorno `node` del manifiesto de CI** (288
  archivos, antes y después del cambio) para descartar más regresiones ocultas por el
  mismo motivo: ningún test que pasara antes se rompió; los que ya fallaban antes (24,
  todos por dependencias de entorno que esta sesión no instala — `jsdom`/`react` para
  las pruebas `*-ui-runtime` de `cfg/`, o el build de Netlify previo que exige
  `netlify-publish-boundary.mjs`) siguen fallando exactamente igual, sin relación con
  este cambio — confirmado comparando la lista de fallos antes/después.
- Toda la batería de `tests/plan-maestro/`: sin cambios de resultado.
- No hace falta tocar el manifiesto de CI: no se añadió ni se quitó ningún archivo de
  `tests/`, solo se corrigió contenido de tests existentes y del espejo.

## 4. Aviso importante para Pedro

Al intentar retirar las dos tareas sugeridas que había dejado aparcadas para esto
(`task_3a6015c0` para A02.1, `task_b21c95f8` para A08.1), el sistema respondió que
**ya no estaban pendientes — alguien las había arrancado como sesión nueva**. Es decir:
es posible que exista otra sesión (tuya, en otro sitio) trabajando en este mismo arreglo
en paralelo. Antes de fusionar esta rama, conviene comprobar si esa otra sesión también
tocó `source-recovery/fuente-recuperado.js` o estos mismos 4 archivos de test, para no
pisarse el trabajo.

## 5. Límites respetados

- No se ha tocado PROD.
- No se ha hecho ninguna escritura SQL ni migración — esto es solo código y tests.
- No se ha añadido ninguna funcionalidad nueva: todo lo "nuevo" que apareció en el
  espejo (aparcar cuenta, movimientos de caja desde el TPV, unir cuentas) ya existía y
  funcionaba en `fuente.js` desde antes de esta sesión; aquí solo se ha copiado al
  espejo y se han corregido los tests para que reflejen la realidad actual del código.

**Los dos bugs de paridad reportados (A02.1, A08.1) quedan cerrados**, junto con dos más
de la misma familia que aparecieron al verificar con la batería completa (A06.1, A07.1).
