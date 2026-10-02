# F6 · pieza 6d: cierre de caja con diferencia — hallazgos y plan

Fecha: 2026-10-02
Alcance de este documento: **solo lectura** del código de la aplicación y de las migraciones de las piezas 2 y C04, y este plan. **Ningún cambio de
pantalla, de base de datos ni de despliegue.** Producción no consultada. QA solo lectura.
Autorización: «6d: cierre de caja con diferencia» elegida por Pedro el 2/10/2026 (solo QA). El plan se presenta antes de implementar y las
decisiones de diseño de la última sección esperan su respuesta.
Estado: `PLAN_PRESENTADO_SIN_IMPLEMENTAR`

## Qué se pidió (D15 y D19)

Toda diferencia de caja se registra, **exige motivo** y, sobre un umbral configurable (0 € por defecto), la **aprueba el Propietario**. El cajero
abre y cierra la caja. El servidor ya lo hace (pieza 2, `F6_PIEZA2_DIFERENCIA_CAJA_2026-10-02.md`): `abc_obtener_diferencia_caja` (leer),
`abc_registrar_diferencia_caja` (motivo; quien opera la caja), `abc_decidir_diferencia_caja` (aprobar o rechazar; solo Propietario) y una guarda que
rechaza el cierre definitivo mientras la diferencia no esté tratada. **Falta la pantalla**: hoy un cierre con diferencia no se puede finalizar.

## Hallazgos al leer la pantalla actual (previos a esta pieza)

| Nº | Hallazgo | Consecuencia |
|---|---|---|
| H1 | Los pasos del cierre (`contextoA10(true)`) toman el **día operativo** de la última cuenta abierta en el TPV *en ese mismo navegador* (almacenamiento local). Sin ella: «Abre o recupera primero un pedido real…». **Lo vio Pedro en el preview** | Una ventana privada, otro equipo o un navegador limpio no pueden cerrar la caja |
| H2 | «Iniciar cierre» pasa la sesión de caja a `EN_CIERRE` (`abc_iniciar_cierre_sesion_caja`), pero los pasos siguientes buscan la sesión con `estado = 'ABIERTA'` (`contextoTerminalA02`). **Por lectura del código, «Confirmar cierre provisional» fallaría con «Este terminal no tiene una sesión de caja abierta»**, igual que «Finalizar» y «Reabrir» | **El cierre desde la pantalla no se puede completar de principio a fin.** No lo he probado en vivo a propósito: pulsar «Iniciar cierre» en QA podría dejar la sesión atascada en `EN_CIERRE` |
| H3 | El estado del cierre (ABIERTA, EN_CIERRE, CIERRE_PROVISIONAL) vive solo en la pantalla: si se recarga a mitad, vuelve a mostrar «ABIERTA» aunque el servidor diga otra cosa | Riesgo de órdenes que el servidor rechaza o de dejar un cierre a medias |
| H4 | Al confirmar el provisional la pantalla solo imprime la diferencia en un texto; no hay motivo ni aprobación | Es la pieza 2 sin pantalla |

H1 y H2 no son de la pantalla «Configuración»: son anteriores. Pero **sin arreglarlos no se puede llegar a la diferencia**, así que forman parte de la 6d.

**Aviso para las pruebas en QA:** hasta que esta pieza esté hecha, **no pulsar «Iniciar cierre»** en el preview con un contexto de cuenta (la sesión
de caja de QA-A1 está ABIERTA desde las 19:47 UTC): si H2 es cierto, quedaría en `EN_CIERRE` y la pantalla no podría continuar.

## Plan por pasos (todo solo en QA; cada paso con sus pruebas)

| Paso | Qué incluye | Toca |
|---|---|---|
| 6d-1 · Sesión y día del cierre | La pantalla localiza la sesión del terminal en cualquier estado del cierre (`ABIERTA`, `EN_CIERRE`, `CIERRE_PROVISIONAL`), lee el estado real del servidor al entrar (resuelve H3) y obtiene el día operativo sin depender de la última cuenta del navegador (resuelve H1; ver decisión A) | `contextoA10` y la pantalla de cierre de `CocinaA10` |
| 6d-2 · Diferencia y motivo | Tras el provisional lee `abc_obtener_diferencia_caja`. Con diferencia 0 todo sigue igual. Con diferencia: muestra contado, esperado y diferencia, pide el **motivo** y lo guarda con `abc_registrar_diferencia_caja` | Pantalla de cierre |
| 6d-3 · Aprobación | Si supera el umbral: el **Propietario** ve «Aprobar» y «Rechazar» (cada uno con su motivo, `abc_decidir_diferencia_caja`); los demás ven «Pendiente de aprobación del Propietario». Rechazada: se muestra el motivo y solo queda **reabrir y recontar** (si el rol puede reabrir, 6f) | Pantalla de cierre |
| 6d-4 · Finalizar | «Finalizar cierre» solo se ofrece cuando no quedan bloqueos (`DIFERENCIA_SIN_MOTIVO`, `DIFERENCIA_PENDIENTE_APROBACION`, `DIFERENCIA_RECHAZADA`, `DIFERENCIA_CAMBIADA`); el servidor sigue siendo quien lo impone (guarda de la pieza 2). Errores traducidos a español | Pantalla de cierre y `errorRpcA02` |

No cambia: ninguna función de cierre de C04 ni de C12, el servidor de la pieza 2, ni el flujo de venta. «Abrir sesión de caja» no se toca.

## Decisiones que necesito de Pedro

**A · Día operativo del cierre.** Es solo la etiqueta del día que llevan los eventos del cierre.
- **Que lo calcule el servidor** (recomendada): una función nueva de solo lectura (`abc_obtener_dia_operativo_local`) que devuelve el día según la hora de corte
  y la zona horaria del local (piezas 1 y D06). Es una migración pequeña, solo QA, con sus pruebas. Coherente con la configuración que ya existe.
- **Que lo tome de la fecha del navegador**, como ya hace «Abrir sesión de caja»: no toca el servidor, pero ignora la hora de corte del local y el reloj del
  equipo.

**B · Dónde aprueba el Propietario.**
- **En la misma pantalla de cierre** (recomendada para empezar): el Propietario entra en el terminal donde se cerró la caja y aprueba allí. Si no está,
  la caja queda en cierre provisional hasta que lo haga (con la sesión sin cerrar, esa caja no abre otra).
- **Además, una lista de «cierres pendientes de aprobar»** en Configuración, para aprobar desde cualquier dispositivo. Exige otra función de lectura y
  otra pantalla; alarga la pieza.

Sin decisión, aplico las recomendadas (servidor para el día; aprobación en la misma pantalla) solo si Pedro las acepta.

## Pruebas previstas

- Contrato estático de pantalla (como `cfg6-ui-contract.mjs`): paridad exacta entre `fuente.js` y `fuente-recuperado.js`; nombres y parámetros exactos
  de cada llamada contra las firmas de las migraciones; sin acceso directo a tablas de escritura; motivo y `operation_id` en cada paso; los pasos del
  cierre no exigen una cuenta del TPV ni estado `ABIERTA`.
- Prueba de ejecución (React real en navegador simulado, servidor falso) con los casos: diferencia 0; diferencia sin motivo; dentro del umbral;
  fuera del umbral con Propietario y con otro rol; aprobada; rechazada y reapertura; recarga a mitad del cierre en cada estado; error del servidor
  en cada paso; permiso de reabrir (6f).
- Averías provocadas (mutantes) sobre ambas pruebas, como en las piezas anteriores.
- Regresión: paridad de la fuente recuperada y contratos de pantalla existentes (A05–A10) sin cambios respecto a la línea base; `cfg1` a `cfg6`.
- Si se elige la función nueva del día: contrato vivo en réplica local y en QA (con `ROLLBACK`), mutantes y comprobación de permisos (solo `authenticated`).
- **Prueba en pantalla por Pedro** en el preview 118, con guía, y comprobación mía en QA (solo lectura): cierre sin diferencia, con diferencia
  aprobada y con diferencia rechazada y reabierta. Dejará datos de prueba en QA (movimientos de cierre de la caja de A1).

## Límites

- Sin credenciales de QA, la primera vez real será en el navegador de Pedro.
- H2 está concluido por lectura del código; **el primer paso de la implementación es reproducirlo con una prueba** antes de tocar nada.
- La aprobación desde otro dispositivo (decisión B, segunda opción) no está en el alcance base.
- La cadena de reconstrucción exacta del bundle (`CURRENT_RELEASE.patch`) la regenera la integración continua.
- Producción: no autorizada; antes habría que registrar las pruebas nuevas en la puerta de CI.
