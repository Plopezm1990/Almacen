# F6 · pieza 6d: cierre de caja con diferencia — resultado

Fecha: 2026-10-02
Autorización: «6d: cierre de caja con diferencia» y decisiones **A** (el servidor calcula el día operativo del cierre) y **B** (el Propietario aprueba en la misma pantalla de cierre), Pedro, 2/10/2026.
**Solo QA.** Producción no consultada ni tocada.
Estado: `IMPLEMENTADA_Y_VERIFICADA_LOCALMENTE_SERVIDOR_APLICADO_EN_QA_PENDIENTE_DE_PRUEBA_EN_PANTALLA_POR_PEDRO`
Plan de partida: `F6_PIEZA6D_CIERRE_DIFERENCIA_PLAN_2026-10-02.md`. Guía de prueba: `F6_PRUEBA_PREVIEW_CIERRE_CAJA_2026-10-02.md`.

## Qué se ha hecho

| Parte | Qué es | Dónde |
|---|---|---|
| Servidor (QA) | `abc_obtener_dia_operativo_local(empresa, local)`: lectura que devuelve el día operativo actual del local según su regla (hora de corte y zona horaria), con el mismo cálculo que los eventos de configuración. Solo quien opera la caja (`ABC_CAJA_OPERAR`) y para un local que exista y esté activo en la empresa. Aditiva: sin tablas nuevas y sin cambiar ninguna función existente | `supabase/migrations/20261002250000_abc_config_pieza6d_dia_operativo.sql`, aplicada en QA |
| Cliente | `contextoCierreA10`: localiza la sesión del terminal en **cualquier** estado del cierre (`ABIERTA`, `EN_CIERRE`, `CIERRE_PROVISIONAL`) y toma el día operativo del servidor. Los cuatro pasos del cierre (iniciar, confirmar provisional, finalizar, reabrir) pasan a usarlo. Tres funciones nuevas: `consultarCierreCajaA10` (estado y diferencia), `registrarDiferenciaCajaA10` (motivo) y `decidirDiferenciaCajaA10` (aprobar o rechazar), con idempotencia y recuperación como el resto | `fuente.js` y `source-recovery/fuente-recuperado.js` (idénticos) |
| Pantalla de cierre (Cocina A10) | Al entrar y al pulsar «Actualizar» recupera el estado real del servidor (un cierre a medias ya no vuelve a «ABIERTA»). Tras confirmar el provisional lee la diferencia: con diferencia pide el **motivo**; si supera el umbral, el **Propietario** ve «Aprobar diferencia» / «Rechazar diferencia» (cada uno con su motivo) y los demás ven «Pendiente de aprobación del Propietario». «Finalizar cierre» no se ofrece mientras haya bloqueos de diferencia. Rechazada: solo queda reabrir y volver a contar. Errores traducidos a español | `CocinaA10` y `errorRpcA02` |

## Lo que se arregla de antes (hallazgos del plan)

- **H1** «Abre o recupera primero un pedido real…»: el cierre ya no depende de la última cuenta guardada en el navegador.
- **H2** Los pasos posteriores a «Iniciar cierre» buscaban la sesión en estado `ABIERTA` y fallaban con «Este terminal no tiene una sesión de caja abierta». **Reproducido con el código real y un servidor falso** antes de tocar nada (`iniciar` funcionaba y `confirmar` y `finalizar` fallaban) y arreglado.
- **H3** El estado del cierre vivía solo en la pantalla: ahora se recupera del servidor.
- **Hallazgo nuevo al probar la recarga:** la lógica de venta se recrea en cada pintado de la aplicación y las funciones del cierre solo se «colgaban» de `listarEstacionesA10` la primera vez que se la llamaba, así que la pantalla podía recibir esa función sin ellas.
  Ahora se enlazan al crear la lógica (y se mantienen al llamarla). Era un fallo latente de la pantalla de cierre anterior y de cualquier recuperación al entrar.

## Qué no cambia

- Ninguna función de cierre de C04 ni de C12 ni la pieza 2 del servidor; la guarda del servidor sigue siendo quien impone el cierre.
- «Abrir sesión de caja» sigue tomando la fecha del navegador (no se toca el flujo de apertura).
- Un cierre con diferencia **no inventa ningún movimiento de caja**: la pantalla solo llama a las funciones del cierre y de la diferencia.
- La otra operación de A10 que usaba el mismo contexto (`contextoA10(true)`) conserva el suyo y su aviso.

## Pruebas hechas (todas locales salvo la de QA indicada)

| Prueba | Resultado |
|---|---|
| Contrato vivo del servidor `tests/cfg/cfg6d-contract.sql` en réplica local (PostgreSQL 16) **y en QA** (con `ROLLBACK`, sin residuos, función con permisos solo de `authenticated`) | **56/56** y **56/56** |
| Contrato estático del servidor `cfg6d-static-contract.mjs` | OK |
| Averías provocadas sobre el servidor: 22 en el contrato vivo y 31 en el estático | vivo: 17 detectadas y 5 equivalentes (comprobaciones redundantes de defensa que el contrato estático sí fija); estático **31/31** |
| Contrato estático de pantalla `tests/cfg/cfg6d-ui-contract.mjs` (paridad entre `fuente.js` y el fuente recuperado, nombres y parámetros exactos frente a las migraciones, sin escrituras directas, textos) | OK |
| Prueba de ejecución `tests/cfg/cfg6d-ui-runtime.mjs` (módulo real de la aplicación con React 18 en un navegador simulado y un servidor falso con las reglas de C04, pieza 2 y 6d) | **93/93** |
| Averías provocadas sobre la pantalla y el cliente (60) | estático **60/60**; ejecución **57/60** (3 equivalentes); ver «Averías provocadas» |
| La misma secuencia que hará la pantalla, contra las funciones **reales de QA** (suplantando al Propietario, con `ROLLBACK`) | correcta en los dos escenarios; sin residuos (ver más abajo) |
| Regresión: los 171 contratos Node activos del manifiesto contra la versión anterior y la nueva | resultados **idénticos** (170 ejecutados; el único que falla, `netlify-publish-boundary.mjs`, falla igual antes del cambio) |
| Regresión de la pantalla «Configuración» y contratos de las piezas 1 a 5 (`cfg1`…`cfg6`, incluida la prueba de ejecución de la pieza 6) | OK |
| Paridad de la fuente recuperada (`recuperar_candidato.py --check`) | PASS |
| Capturas en Chromium con la hoja de estilos real (escritorio claro y móvil oscuro; casos: sin motivo, pendiente, decidir, rechazada, aprobada) | sin errores de consola ni desborde horizontal |

Cobertura destacable de la prueba de ejecución: cierre sin cuenta en el navegador; día del servidor frente a una cuenta antigua guardada; diferencia sin motivo, dentro y fuera del umbral;
Cajero/a que no puede aprobar; aprobar, rechazar y reabrir; recargar en cada estado del cierre; otro dispositivo que decide o reabre mientras tanto; fallo de lectura; versión antigua de la lógica sin las funciones nuevas.

## Averías provocadas (pantalla y cliente)

60 averías provocadas sobre el cliente y la pantalla (contexto del cierre, día del servidor, estados admitidos, vínculo del terminal, consulta y envío de la diferencia, identificadores de operación,
traducciones, enlace de las funciones, cada botón y texto de la caja de diferencia, quién decide, bloqueo de «Finalizar», limpieza de lo escrito y recuperación del estado del servidor; más 2 de la
primera tanda que quedaron obsoletas al cambiar el código).

- **Contrato estático: 60/60 detectadas** (la misma avería aplicada a las dos fuentes).
- **Prueba de ejecución: 57/60 detectadas.** Las 3 que sobreviven son equivalentes en el comportamiento visible y las detecta el contrato estático:
  `u11` (limpiar lo escrito al finalizar: ya se limpia al registrar o decidir), `u19` (limpiar la diferencia al volver a «ABIERTA»: solo se pinta con el cierre provisional y se vuelve a leer al entrar en él) y
  `v01` (reordenar dos ramas con el mismo resultado).
- Las tandas intermedias dejaron supervivientes que llevaron a **8 pruebas nuevas** (recuperar un cierre en marcha tras «Actualizar», no arrastrar lo escrito al reabrir, otro dispositivo que decide o reabre, fallo de lectura al actualizar,
  rechazo del servidor al finalizar sin saber de la diferencia) y a **un cambio de código**: tras cada acción la pantalla vuelve a leer **todo** el estado del cierre (antes solo la diferencia).

## Comprobación contra el servidor REAL de QA (con `ROLLBACK`)

Para cubrir lo que el servidor falso no puede, ejecuté contra las funciones reales de QA, suplantando al Propietario y dentro de una transacción que se revierte, **la misma secuencia que hará la pantalla** sobre la sesión abierta de A1 (`ee3392f5…`):

- **A · diferencia aprobada**: día operativo del servidor (`2026-10-02`) → iniciar (`EN_CIERRE`) → provisional con contado 5 (esperado 0, diferencia 5, bloqueo `DIFERENCIA_SIN_MOTIVO`) → finalizar rechazado
  (`cierre_definitivo_diferencia_pendiente:["DIFERENCIA_SIN_MOTIVO"]`) → registrar motivo (`DIFERENCIA_PENDIENTE_APROBACION`) → finalizar rechazado → aprobar → sin bloqueos → finalizar (`CERRADA_FINAL`).
  Eventos en orden: `CAJA_SESION_EN_CIERRE`, `CAJA_SESION_CIERRE_PROVISIONAL`, `CAJA_DIFERENCIA_REGISTRADA`, `CAJA_DIFERENCIA_APROBADA`, `CAJA_SESION_CERRADA`.
- **B · diferencia rechazada**: contado 7 → registrar → rechazar (`DIFERENCIA_RECHAZADA`) → finalizar rechazado → reabrir con motivo (`ABIERTA`) → iniciar de nuevo → contado 0 sin diferencia → finalizar (`CERRADA_FINAL`).
- Tras el `ROLLBACK`: la sesión de A1 sigue `ABIERTA` y **no queda ningún evento** de la prueba.

Esto confirma con el servidor real que el orden de llamadas y los parámetros de la pantalla son los correctos, y que los textos de los bloqueos coinciden con los que la pantalla traduce.
Lo que sigue sin comprobarse es la pantalla funcionando contra QA (límite 1).

## Límites y avisos

1. **Aún no la he visto funcionando contra QA**: no tengo credenciales para iniciar sesión en el preview. La primera vez real será en el navegador de Pedro (guía de prueba).
2. **El modelo del servidor de las pruebas de pantalla es un modelo en memoria**, no el servidor real: reproduce las reglas leídas de las migraciones. El servidor real se prueba con los contratos SQL; la integración real queda para la prueba de Pedro y mi comprobación en QA.
3. **Un Cajero/a no se puede probar en pantalla** sin otro usuario de QA; está cubierto por la prueba de ejecución.
4. **El Propietario aprueba en el mismo terminal** (decisión B). Si no está, la caja queda en cierre provisional hasta que lo haga y esa caja no abre otra sesión; la lista de «cierres pendientes» para aprobar desde otro dispositivo es una ampliación posible.
5. La sesión de caja de QA-A1 sigue abierta desde las 19:47 UTC (fondo 0 €); la guía de prueba la usa.
6. **Producción** no está autorizada. Antes de promocionar habría que: aplicar `20261002250000` (la migración se niega a aplicarse si faltan las funciones de las piezas 1 y 5), registrar las pruebas nuevas (`cfg1`…`cfg6d`) en la puerta de CI y adaptar los contratos históricos citados en `F6_PIEZA5_PERMISOS_2026-10-02.md`.
7. La cadena de reconstrucción exacta del bundle (`CURRENT_RELEASE.patch`) la regenera la integración continua.

## Lo que sigue abierto de la capa de configuración

- **6e**: elegir modalidad al abrir cuenta en el TPV (y poder deshabilitar Barra).
- **D13**: devoluciones del cajero (el flujo hoy encola el efecto al solicitar).
- **Producción** y los puntos pendientes de promoción.
