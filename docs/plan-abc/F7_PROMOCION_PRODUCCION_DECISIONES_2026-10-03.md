# F7 · Promoción a producción · decisiones de Pedro (3/10/2026)

Fecha: 2026-10-03
Estado: `DECISIONES_TOMADAS_PROMOCION_NO_AUTORIZADA_AUN`
Origen: Pedro eligió «Cerrar contigo las decisiones del primer paquete» y respondió las preguntas del apartado 12 de `F7_PROMOCION_PRODUCCION_PREPARACION_2026-10-03.md` en tres rondas (con la herramienta de preguntas, 3/10/2026).

> **Nada de esto es todavía la autorización para tocar producción.** Son decisiones de alcance y de forma. Para aplicar migraciones o publicar hace falta que Pedro dé la autorización expresa, en su momento, sobre el candidato exacto y tras repetir la foto de solo lectura (ver «Cómo se autoriza» más abajo). La única consulta a producción que Pedro autorizó aquí fue la de las dos cuentas abiertas y el envío pendiente (§3), de solo lectura.

## 1. Decisiones

| # | Tema | Decisión de Pedro | Qué implica |
|---|---|---|---|
| 1 | Alcance del primer paquete | **Base + configuración + aplicación, sin P3 ni B06–B10** | Base: A08.2, B04, B05, C04–C12 (12 migraciones) + la corrección de PM07 = 13. Configuración: piezas 1, 2, 3, 4, 5, 6d, D13 y A09 eventos (8). Aplicación nueva en un único despliegue. PM09 queda aparte |
| 2 | P3 y P3b (precio de carta con IVA incluido, D31) | **Pedro asume el riesgo por escrito**, sin esperar a la asesoría. Van en un **paquete aparte, justo después del primero**, con su propia comprobación y su propia autorización | **Constancia:** el 3/10/2026 Pedro eligió «Lo asumo yo, por escrito» ante la pregunta de si esperar a la asesoría fiscal (que todavía no tiene) o asumir que el precio de carta se lea con IVA incluido (D31): P3 cambia lo que se cobra. En producción hay 1 producto en el catálogo del TPV |
| 3 | B06–B10 (12 migraciones nunca aplicadas en QA) | **Llevarlas primero a QA** | No entran en el primer paquete. Aplicarlas en QA necesita una autorización aparte de Pedro cuando quiera empezar |
| 4 | D12 (descuento libre del encargado) | **Se mantiene la opción A** | En la ventana se escribe la política de 0 % para el local productivo (un dato, sin tocar código) y cada local nuevo la recibe al darse de alta |
| 5 | Roles retirados | Sin decisión pendiente: **nadie los tiene** en producción (foto del 3/10) | Se repite la comprobación en la ventana |
| 6 | PM09 | **Trabajo aparte, después del primer paquete** | Se prepara el plan de reconciliación de la base de producción con QA (solo documento y pruebas locales). No bloquea el primer paquete |
| 7 | Cómo se publica | **PR nuevo desde `release` con el candidato congelado y un solo despliegue de producción (D28)**, no el PR 118 | El PR 118 sigue siendo un preview de QA «NO FUSIONAR» |
| 8 | Cómo se autoriza | **Una sola autorización para el primer paquete entero** | Ver «Cómo se autoriza» |
| 9 | Ventana | **Sin fecha fija: se acuerda cuando el paquete esté listo** | Fuera del servicio, con aviso previo y con producción sin cajas, cuentas ni envíos pendientes |
| 10 | Quién ejecuta | **Claude, con el visto bueno de Pedro y Pedro presente** | Se ejecutan los pasos del documento uno a uno, comprobando cada huella |
| 11 | Corrección de PM07 | **Sí, en la base del primer paquete** | Migración `20261003130000`, escrita y probada, sin aplicar |
| 12 | Las 2 cuentas abiertas y el envío pendiente | **Mirar qué son, solo lectura** | Hecho (§3) |
| 13 | D30 (P1: aviso de guardado y plazo de 6 h) | **Sí, valido los textos y las 6 h** (Pedro, 3/10/2026, después de verlo en el preview del candidato, §5) | P1 se queda en el candidato tal cual (`index-storage-bootstrap.js`). D30 queda cerrada |

## 2. Cómo se autoriza (decisión 8)

Pedro quiere dar **una sola autorización** para el primer paquete entero en lugar de una por migración o por grupo. Para que eso sea seguro, cuando llegue el momento se hará así, y solo entonces:

1. **Candidato exacto congelado:** commit y `sha256` de `fuente.js` del PR nuevo, con la CI en verde.
2. **Foto de solo lectura repetida** en la ventana y comparada con la del 3/10: sin migraciones a medias, huellas esperadas (`COINCIDE`) y producción sin cajas, cuentas ni envíos pendientes.
3. **Pedro presente y diciendo expresamente que sí** sobre ese candidato y esa foto (una frase suya, no una respuesta ambigua).
4. Ejecución en el orden del documento, **comprobando la huella de cada migración tras aplicarla** (la foto detectó que una migración de producción perdió una barra invertida al aplicarse por otro camino).
5. **Me detengo a la primera diferencia** con lo esperado (una huella distinta, un fallo de migración, un objeto que no debía estar) y no sigo sin que Pedro lo decida; la autorización única **no** cubre continuar tras un fallo.
6. Quedan fuera de esa autorización: P3/P3b (paquete aparte), B06–B10, PM09, cualquier borrado o corrección de datos, y cualquier cambio que no esté en el candidato.

## 3. Las 2 cuentas abiertas y el envío pendiente (consulta de solo lectura en producción, 3/10/2026)

Solo estados y fechas, sin datos de clientes. Producción: `flqercbgpgmmfaakrwkc`.

| Qué | Referencia | Local | Detalle |
|---|---|---|---|
| Cuenta | `528c0715…` | `local-eac70cb00c2c67c4` | modalidad **BARRA**, estado `ABIERTA`, versión 2, abierta el **28/9/2026 a las 20:44:28 UTC** (día operativo 28/9) |
| Cuenta | `40431ef0…` | `local-eac70cb00c2c67c4` | modalidad **BARRA**, estado `ABIERTA`, versión 2, abierta el **28/9/2026 a las 20:45:48 UTC** |
| Envío | `22ca6555…` | `local-eac70cb00c2c67c4` | tipo **KITCHEN_COMANDA**, estado `PENDIENTE`, **0 intentos, sin error**, creado el **28/9/2026 a las 20:45:55 UTC**, sin completar |

**Lectura (no confirmada por nadie):** las tres filas son del mismo local y se crearon en un intervalo de poco más de un minuto la tarde del 28/9, justo en la franja de la última sesión de caja (20:09) y del último evento (21:28 UTC) de producción. Parecen **restos de una prueba de ese día** (dos cuentas de barra y una comanda de cocina que ningún proceso ha consumido), no actividad real. **No lo he comprobado con nadie** y puede haber una explicación distinta.

**Qué hacer antes de la ventana (a decidir):**
- Cerrarlas o cancelarlas desde la propia aplicación (lo haría Pedro) **o** que se cierren en la ventana con su autorización expresa; no se tocan por mi cuenta.
- El envío de cocina pendiente se queda sin consumir si no hay proceso que lo recoja; conviene decidir si se descarta o se deja (tampoco se toca sin autorización).
- La comprobación P8 de la ventana (sin cuentas abiertas ni envíos pendientes) las detectará si siguen ahí.

## 4. Lo que queda por hacer, por orden

1. Cuando Pedro lo pida: llevar B06–B10 a QA (decisión 3), con su autorización expresa.
2. ~~Preparar el PR nuevo desde `release` con el candidato exacto (decisión 7) y la CI en verde.~~ **HECHO (3/10/2026):** PR borrador 119, CI en verde, `fuente.js` `5d8aef59…`.
3. Preparar el plan de reconciliación de PM09 (decisión 6), solo documento.
4. Acordar la ventana (decisión 9) y decidir qué se hace con las dos cuentas y el envío (§3).
5. Dentro de la ventana: foto repetida, autorización expresa, ejecución con comprobación de cada huella.
6. Paquete aparte para P3/P3b (decisión 2) tras el primero.

## 5. Pruebas en pantalla del candidato (Cowork, 3/10/2026, preview del PR 119)

Preview `deploy-preview-119--chic-entremet-9107cf.netlify.app` (la aplicación del candidato; QA, no producción), usuario Propietario, Local A1. Comprobado por Cowork en pantalla y contrastado por mí en QA (solo lectura).

| Prueba | Resultado |
|---|---|
| 0 · seguridad | **Pasa.** `modoQA = true`, `nubeUrl` = proyecto de QA, 80 de 80 peticiones a QA y ninguna al proyecto de producción |
| A · P1, aviso de guardado | **Pasa.** Antes de tocar nada: «4 colecciones solo en este equipo (el servidor no permite guardarlas)» (`productos`, `historialRespaldos`, `movimientos`, `conteos`). Tras cambiar el tema: «5 colecciones…» (se añade `temaOscuro`). Tras recargar: igual y el tema persiste. Nunca «Subiendo N…». **Pedro valida textos y plazo de 6 h (decisión 13)** |
| B · arreglo de `money` (PM-08) | **Pasa.** «Entrada confirmada.» y «Retirada confirmada.» sin aviso rojo. En QA: 2 movimientos nuevos (`ENTRADA` 12,50, efecto +12,50; `RETIRADA` 12,50, efecto −12,50; neto cero) y 2 filas de auditoría `MOVIMIENTO_CAJA` con el texto exacto «ENTRADA de €12,50 · Prueba Cowork PM08 entrada» y «RETIRADA de €12,50 · Prueba Cowork PM08 retirada». Movimientos de caja de A1: 6 → 8; auditoría: 8 → 10. Antes del arreglo la auditoría no se escribía nunca y salía un aviso falso |
| C · historial de descuentos con datos (Local A2) | **No se pudo.** Con el Local A2 elegido en el selector, el TPV dijo «El TPV no puede abrirse en Todos los locales…». Ese código es **idéntico en `release`** (el candidato solo añade propiedades al TPV), así que no es un fallo nuevo. Hipótesis **no confirmada:** el contexto de la nube vuelve a poner el local activo (`sincronizarContextoPm07` aplica `localActivoId` de la nube) mientras el filtro de informes queda en A2. Además las 2 cuentas de A2 son del 26/9 y el TPV solo reanuda cuentas del día actual, así que por pantalla no se pueden abrir. Se sustituye por una prueba con un descuento nuevo en una cuenta de A1 (pendiente) |

Otras observaciones de Cowork (no relacionadas con el candidato; `index.html` no cambia):
- Consola, ruido en todas las pantallas: bloqueos de CSP de Netlify, 404 de `seleccion-neutral-patch.js?v=2` y `auth-ux-patch.js?v=1` (ninguno está en el repositorio ni lo referencia `index.html`; `_headers` menciona el primero; procedencia **no comprobada**, quizá un fragmento inyectado desde Netlify) y un aviso de React por claves repetidas en `Dashboard`.
- Un desplazamiento con la rueda del ratón subió a 0,01 el campo «Efectivo contado en caja» del arqueo; Cowork lo dejó a 0 sin guardar y en QA `arqueos_caja` sigue vacía.
