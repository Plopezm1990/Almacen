# F6 · PM-08 · aviso falso al registrar un movimiento manual de caja («money is not defined») — resultado

Fecha: 2026-10-03
Autorización: Pedro eligió «Arreglar el fallo de `money` en movimientos de caja» como siguiente pieza (3/10/2026). **Solo cliente** (ningún cambio en el servidor ni en QA). Producción no consultada ni tocada.
Estado: `ARREGLADO_Y_VERIFICADO_CON_PRUEBAS_LOCALES_Y_EN_PANTALLA_CON_COWORK_Y_EN_QA`
Origen del hallazgo: `F6_A09_HISTORIAL_DESCUENTOS_RESULTADO_2026-10-03.md`, párrafo «Hallazgo del escaneo» (contrato de alcance).

## Qué fallaba

Al registrar una **entrada o retirada manual de caja** (pantalla de arqueo, «Entradas y salidas»), la aplicación guarda el movimiento y después anota la auditoría `MOVIMIENTO_CAJA`. Esa anotación llamaba a una función **`money()` que no existe en la aplicación** (dos veces: rama de la nube y rama local). En el navegador, eso es «ReferenceError: money is not defined»:

| Rama | Qué pasaba |
|---|---|
| Cuenta sincronizada (la nube) | El servidor **ya había guardado** el movimiento y la lista local ya lo tenía, pero el error caía en el `catch` y la pantalla decía **«No se pudo confirmar si el servidor recibió el movimiento. Reintenta: se utilizará el mismo identificador y no se duplicará.»** Aviso falso: el reintento es idempotente (no duplica), pero el usuario creía que no se había guardado. La auditoría no se anotaba nunca |
| Modo local | El error se propagaba sin control desde la función que guarda el movimiento |

Origen: el nombre `money` viene de una versión anterior; el módulo ya tiene el formateador de importes `fmt()` (el que usan las demás anotaciones, p. ej. las devoluciones: «reembolso €3,85»).

## Qué se ha hecho

Las dos líneas de auditoría usan ahora `€${fmt(imp)}` en lugar de `${money(imp)}`: la anotación queda **«ENTRADA de €12,50 · Cambio inicial»** / **«RETIRADA de €7,00 · Pago proveedor»**. `imp` es el importe ya redondeado a céntimos que realmente se envía al servidor (con el importe tecleado, 2,135, saldría «€2,14» cuando se envía 2,13; la prueba lo cubre). Cambio de una línea en cada rama, en `fuente.js` y `source-recovery/fuente-recuperado.js` (idénticos). No cambia el servidor, ni una tabla, ni una función de base de datos.

El contrato de **alcance** (`tests/cfg/alcance-static-contract.mjs`) tenía `money` anotado como fallo conocido; he vaciado esa lista. Ahora cualquier identificador sin declarar, sin excepción, hace fallar el contrato.

## Pruebas hechas

| Prueba | Resultado |
|---|---|
| Prueba de ejecución nueva `tests/cfg/pm08-caja-ui-runtime.mjs` (la lógica **real** `crearLogicaMovimientosCaja` con React 18 en un navegador simulado, contra un servidor falso): nube (entrada, salida, parámetros exactos de la llamada, movimiento en la lista, borrador limpio, auditoría con el texto exacto, redondeo, reintento ya registrado sin repetir auditoría), errores del servidor (transitorio, rechazo, caída de la conexión: sin cambio de comportamiento), modo local, validaciones previas | **14/14** con el arreglo. **Contra la versión anterior fallan 5** (la entrada en la nube, el texto de la auditoría, la salida y las dos del modo local) y reproducen el fallo |
| Averías provocadas del arreglo (13: cada rama de vuelta a `money`, sin formato, sin símbolo del euro, auditar también el reintento, auditar solo el reintento, quitar la auditoría en cada rama, texto sin concepto, tipo fijo, `fmt(importe)` en lugar de `fmt(imp)`) | **13/13 detectadas** (la última, `fmt(importe)`, solo con el caso del medio céntimo) |
| Contrato de alcance `alcance-static-contract.mjs` con la lista de fallos conocidos vacía | OK. **Contra la versión anterior falla** y nombra `money` (2 usos) |
| Resto de contratos de `tests/cfg`, `tests/pm08` y `tests/f3/a09` | OK; fallan 3 (`tests/f3/a09/local-pglite-*`, `local-postgres-contract`) que necesitan una base de datos local y **fallan igual sin el cambio** |
| Paridad de la fuente recuperada (`recuperar_candidato.py --check`) y `git diff --check` | PASS / limpio |
| Regresión: 170 contratos Node activos del manifiesto, antes y después del cambio | resultados **idénticos** (el único que falla, `tests/netlify-publish-boundary.mjs`, falla igual antes del cambio) |

## Límites

- **Visto en pantalla el 3/10/2026** (ver la última sección). Antes solo había pruebas de ejecución con un servidor falso.
- **Efecto secundario que sigue vigente (no es de este arreglo):** si la anotación de auditoría lanzara cualquier otro error después de guardar en el servidor, el `catch` de la rama de la nube volvería a mostrar el mismo aviso falso, porque esa anotación está dentro del mismo `try` que la llamada al servidor. Con `fmt` ya no hay causa conocida, pero la estructura queda así. No lo he cambiado (más cirugía que la autorizada).
- Producción: no autorizada. Antes: registrar `pm08-caja-ui-runtime` (y el resto de pruebas nuevas de la capa de configuración) en la puerta de CI general.

## Comprobación en pantalla con Cowork (3/10/2026, preview del PR 119)

Preview `deploy-preview-119--chic-entremet-9107cf.netlify.app` (QA), Propietario, Local A1, caja abierta. Dos movimientos manuales en «Arqueo de caja» → «Entradas, retiradas y reembolsos».

| Qué | Resultado |
|---|---|
| Entrada de 12,50 «Prueba Cowork PM08 entrada» | Salió «Entrada confirmada.» y el movimiento «+€12,50» en la lista. **Sin** el aviso rojo «No se pudo confirmar si el servidor recibió el movimiento…» ni errores con «money» en la consola |
| Auditoría | `MOVIMIENTO_CAJA` — «ENTRADA de €12,50 · Prueba Cowork PM08 entrada» |
| Retirada de 12,50 «Prueba Cowork PM08 retirada» | «Retirada confirmada.»; auditoría «RETIRADA de €12,50 · Prueba Cowork PM08 retirada»; la caja vuelve a €400,00 |
| Contraste mío en QA (solo lectura) | `caja_operaciones` del Local A1: 6 → 8 (2 nuevas: `ENTRADA` 12,50 con efecto en efectivo +12,50 a las 21:21:43 UTC y `RETIRADA` 12,50 con −12,50 a las 21:30:47 UTC; neto cero). `auditoria_registro`: 8 → 10 (las 2 filas `MOVIMIENTO_CAJA` con ese texto exacto, usuario «Propietario/a»). Sin eventos de descuento nuevos, mismas cuentas abiertas, `arqueos_caja` vacía |

Es la prueba directa del arreglo: antes la auditoría `MOVIMIENTO_CAJA` no se escribía nunca y salía el aviso falso.
