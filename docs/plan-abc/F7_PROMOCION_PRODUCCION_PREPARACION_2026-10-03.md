# F7 · Promoción a producción · documento de preparación

Fecha: 2026-10-03
Estado: `PREPARADO_FOTO_HECHA_Y_DECISIONES_TOMADAS_PROMOCION_NO_AUTORIZADA` — **la promoción NO está autorizada y NO se ha escrito nada en producción.** Resultado de la foto: `F7_PROMOCION_PRODUCCION_FOTO_RESULTADO_2026-10-03.md`. Decisiones de Pedro (alcance, P3, B06–B10, D12, PM09, despliegue, ventana, quién ejecuta): `F7_PROMOCION_PRODUCCION_DECISIONES_2026-10-03.md`.
Autorizaciones recibidas (3/10/2026): «preparar el documento de promoción a producción» (un documento y un archivo de comprobaciones) y, después, «autorizo la foto de solo lectura de producción» (solo consultas `select`).
Qué NO se ha hecho: no se ha aplicado ninguna migración ni escrito ninguna fila en producción (proyecto `flqercbgpgmmfaakrwkc`), no se ha fusionado ninguna rama, no se ha publicado nada y no se ha escrito nada en QA (solo se leyó su registro de migraciones y unas huellas). La foto de producción **sí** se hizo, solo lectura, el 3/10/2026 a las 11:33 UTC.
Archivo que lo acompaña: `F7_PROMOCION_PRODUCCION_PREFLIGHT_SOLO_LECTURA_2026-10-03.sql` (comprobaciones previas de **solo lectura**; probado únicamente contra la réplica local, en una sesión forzada a solo lectura). Lo vigila el contrato `tests/cfg/f7-preflight-static-contract.mjs`: que no contenga ninguna sentencia que escriba y que sus listas (objetos nuevos, huellas md5, funciones reemplazadas, tablas) coincidan con las migraciones reales y con este documento (14 averías provocadas, todas detectadas).
Decisiones que cita: D12, D26, D28, D29, D31 (`F1_HOJA_DECISIONES_PEDRO_2026-10-02.md`): **0 despliegues durante la iteración y 1 productivo agrupado al final; la promoción se decide más tarde, con candidato exacto, comprobaciones previas y recuperación.**

## 1. Resumen para Pedro

Promocionar no es subir «la capa de configuración» sola. Esa capa (piezas 1 a 6, devoluciones, arreglos de cobro y descuentos) está construida **encima de otras migraciones anteriores**: de las **46 migraciones candidatas** desde la A09 (24/9), **producción tiene 10 y le faltan 36** (foto del 3/10; la número 46 es la corrección de PM07 que propone esa foto). Lo que pesa, por orden:

1. **Ya sé en qué estado está producción** (foto del 3/10, solo lectura): tiene todo hasta B02-B03 (29/9) y nada posterior, ninguna migración a medias, y su registro coincide con sus objetos. **Una deriva pequeña:** las dos funciones de PM07 de producción son un borrador anterior (a una expresión regular le falta una barra invertida): hay que corregirlas con una migración aparte. Lleva sin actividad desde el 28/9.
2. **12 de las 46 migraciones candidatas nunca se han aplicado en QA** (B06, B07, B09 y B10: proveedor de pagos, anticipos, liquidaciones, tarjeta). Solo se han probado en una base desechable de CI. Mi propuesta: **dejarlas fuera** del primer paquete.
3. **Datos:** el volumen en producción es muy pequeño (0 pagos, 0 reembolsos, 30 eventos, 1 producto en el catálogo). PM07 y PM10 ya hicieron sus bootstraps y D13 no tiene reembolsos que marcar. Lo que sí pesa es que P3 pasa a leer el precio de carta **con IVA incluido** (D31, **sin confirmar con la asesoría**, que aún no tienes): cambia lo que se cobra. Mi propuesta: P3 y P3b **no** entran hasta que lo confirmes.
4. **La pieza 5 retira tres roles** (Churrero/a, Básico, Estándar): **nadie los tiene en producción** (las 3 membresías son Propietario activo), así que no quita permisos a nadie; sí impide dar de alta a alguien con ellos.
5. **PM09 está bloqueada** por la deriva de producción (faltan dos funciones y la RPC base de reverso). Es otro trabajo, previo, y no está hecho.
6. **El orden importa:** primero el servidor (todo es aditivo), después la aplicación, en una ventana corta y sin cajas abiertas. La aplicación nueva **no** debe salir antes que el servidor nuevo.
7. **La puerta de CI general:** estaba en rojo por 32 pruebas sin registrar. El 3/10 quedaron **registradas las 33 pruebas** (241 archivos, 224 contratos activos), la puerta instala las dependencias de las pruebas de ejecución y hay un flujo nuevo para los contratos SQL de configuración. Probado en local y **en verde en GitHub** (PR 118, commit `c66da24`, 25 de 25 comprobaciones; un fallo intermitente del contrato A09 en una ejecución anterior que no se repitió: `F7_CI_CAPA_CONFIGURACION_RESULTADO_2026-10-03.md`, §5).

Tú decides al final (§12). Mientras tanto, **no se aplica nada**.

## 2. Qué es el candidato

- **Rama:** `claude/vigilant-hawking-uji8l4`, commit `c85ff0c` al escribir esto. **PR 118: borrador, «NO FUSIONAR»**, base `release`, 64 commits, 101 archivos (+21 576 / −249). Es un PR de **preview de QA**: no debe fusionarse (la aplicación solo reconoce como QA los previews de PR `deploy-preview-N--chic-entremet-9107cf…`; cualquier otra dirección usa producción).
- **Contenido:** 4 archivos de aplicación (`fuente.js`, `source-recovery/fuente-recuperado.js`, `index-storage-bootstrap.js`, `ui-context-bridge.js`), las migraciones, las pruebas y la documentación.
- **Recomendación:** **no fusionar el PR 118.** Cuando se autorice, abrir un **PR de promoción nuevo desde la última `release`**, con un candidato congelado (un commit exacto y el `sha256` de `fuente.js`), con las pruebas registradas en el manifiesto de CI y sin documentación de trabajo que no deba viajar. Hoy la rama figura «behind» respecto a `release`: habrá que traer lo nuevo de `release` y volver a probar.
- **Migraciones candidatas:** 46 archivos desde `20260924160739` (A09) hasta `20261003130000` (corrección de PM07, nueva el 3/10). Lista completa, con su registro en QA, en el apéndice A. Las 10 de la capa de configuración: P3, P3b, piezas 1, 2, 3, 4, 5, 6d, D13 y A09 eventos (P3 y P3b van en un paquete aparte, §5).

## 3. Lo que se sabe de producción, y lo que no

| Fecha | Qué se sabe | Fuente |
|---|---|---|
| 24/9 | A08 aplicada (`20260924082637_abc_f3_a08_account_split_merge`); tres tablas nuevas con 0 filas; mismas funciones que QA (por huella md5); humo transaccional con `ROLLBACK` pasado | `A08_POSTFLIGHT_PROD_2026-09-24.md` |
| 28/9 | A11 y la recuperación de cuenta con día operativo registradas; una regla de día operativo para el local productivo: `Europe/Madrid`, corte 00:00, versión 1 | `A11_CIERRE_2026-09-28.md` |
| 2/10 | **PM09: bloqueado.** En producción faltan `registrar_venta_stock_pm09`, `revertir_venta_stock_pm09` y la RPC base `revertir_venta_stock`; el resto existe. No se aplicó | `F5_PM09_PROD_PREFLIGHT_2026-10-02.md` |
| **3/10, 11:33 UTC** | **Foto de solo lectura.** Registro hasta `abc_f4_b02_b03_checkout_bridge`; **faltaban 35 de las 45 candidatas de entonces** (hoy 36 de 46, con la corrección de PM07) (A08.2, B04, B05, B06–B10, C04–C12, PM09, P3, P3b y las 8 de configuración), ninguna a medias; m04d **aplicada** (el navegador no lee `abc_eventos`, `pago_intentos`, etc.); `abc_abrir_sesion_caja` y las tres funciones de reembolso **coinciden** con las que esperan las migraciones; 27 de 33 funciones comparables coinciden con el repositorio, **2 de PM07 no** (§4 del informe); roles retirados: **nadie**; 3 empresas, 4 locales, 3 membresías, 0 pagos, 0 reembolsos, 1 sesión de caja cerrada, **2 cuentas abiertas**, **1 efecto pendiente**; última actividad 28/9 | `F7_PROMOCION_PRODUCCION_FOTO_RESULTADO_2026-10-03.md` |

Producción tiene un local productivo y muy pocos datos. Las comprobaciones previas son solo recuentos y huellas, nunca contenido. Lo que **no** sé: qué versión de la aplicación sirve hoy, qué son las 2 cuentas abiertas ni el efecto pendiente, y si hay copia de seguridad.

## 4. Hallazgos de esta preparación (el repositorio y QA no coinciden del todo)

1. **B06, B07, B09 y B10 (12 archivos) nunca se han aplicado en QA.** Comprobado hoy en QA, solo lectura: no existe ninguna tabla, función ni restricción con esos nombres y ninguna aparece en su registro de migraciones. Sí tienen contratos que corren en una base desechable de CI (flujos `abc-f4-b04`, `b08`, `b09`, `b10-card-data`, `b11`, `b12`). Regla del plan: **no se promociona lo que QA no ha probado**.
2. **La pieza 2 está aplicada en QA, pero no figura en su registro de migraciones**: la aplicaste a mano desde el editor SQL el 2/10 (verificada 201/201; ya constaba en su informe). **Comprobada el 3/10 contra su archivo** (solo lectura en QA, y la cadena construida desde el archivo en un PostgreSQL local): de 11 elementos (8 funciones, columnas, restricciones y disparadores de `caja_cierre_diferencias`), **10 son idénticos**. **Uno difiere:** `abc_registrar_diferencia_caja` en QA no tiene **una línea de comentario** que sí tiene el archivo (`-- Mismo orden de bloqueo que C04: primero el cierre, luego la sesión.`, dentro del cuerpo); el resto del cuerpo, línea a línea, es igual, así que **la lógica es idéntica**. Efecto: al promocionar, esa función tendrá en producción una huella distinta de la de QA solo por ese comentario (no es deriva). Si prefieres que coincidan, se puede reaplicar esa función en QA con el texto del archivo (con tu autorización).
3. **El registro de QA usa marcas de tiempo propias**, distintas de las del archivo, y nombres cortos o largos según cómo se aplicó. Para comparar con producción hay que usar el **nombre**, no la marca (apéndice A).
4. **Los contratos SQL de la capa de configuración** (`cfg1`…`cfg6d`, `d13`, `a09-eventos`), `d13-upgrade.sh` y el de la corrección de PM07 no tenían flujo de CI: **ya lo tienen** (`abc-f6-config-contract.yml`, creado el 3/10, probado en local en un clúster limpio, con 5 averías provocadas detectadas, y **en verde en GitHub** sobre PostgreSQL 16.15).
5. **`tests/netlify-publish-boundary.mjs` no es un fallo real:** fallaba en mi entorno por una copia vieja del build; la batería de CI la reconstruye y con ello **pasa** (comprobado el 3/10).

## 5. Paquetes propuestos y orden

Mi propuesta, para que decidas (§12). Cada paquete se aprueba **por separado**, no en bloque.

| Paquete | Qué incluye | Mi recomendación |
|---|---|---|
| **0 · Foto** | Solo lectura de producción: bloques P0–P9. **Hecha el 3/10** (`F7_PROMOCION_PRODUCCION_FOTO_RESULTADO_2026-10-03.md`). Pendiente: huellas en QA de la pieza 2 | Hecha. Se repite dentro de la ventana |
| **A · Base** | Lo que **falta** en producción antes de la configuración: **12 migraciones**: A08.2 (fila 7), B04 y B05 (filas 12–13) y C04–C12 (filas 26–34), más la **corrección de PM07** (fila 46, nueva por la deriva de la foto: escrita y probada el 3/10 en la réplica y en QA con `ROLLBACK`, **sin aplicar en producción**), es decir, 13. **PM09 (fila 35) solo después de reconciliar la base de producción** (cambio de alcance aparte) | Sí, en el orden de las marcas, **cada migración con su comprobación de huella** |
| **B · Catálogo con IVA** | P3 y P3b (filas 36–37). Cambia el importe que se cobra (D31) | **Paquete aparte, justo después del primero.** Decidido el 3/10: Pedro asume D31 por escrito (sin asesoría), con su propia comprobación y su propia autorización |
| **C · Configuración** | Piezas 1, 2, 3, 4, 5, 6d, D13 y A09 eventos (filas 38–45; la 46 es del paquete A) | Sí, **después de A** (la pieza 6d se niega a aplicarse si faltan funciones de las piezas 1 y 5) |
| **D · Proveedor de pagos** | B06, B07, B09, B10 (filas 14–25) | **Fuera del primer paquete.** Decidido el 3/10: primero a QA (con tu autorización expresa cuando quieras empezar) y probarlas allí |
| **E · Aplicación** | Un solo despliegue de producción (D28): `fuente.js` y los otros tres archivos del candidato | **Después** de C, en la misma ventana |

La foto del 3/10 ya dio el veredicto por migración (`todos` / `ninguno`; ninguna `ALGUNOS (deriva)`). Se repite en la ventana: si apareciera una `ALGUNOS (deriva)`, **se detiene todo** hasta revisarla.

## 6. Qué cambia en datos y comportamiento al aplicar

**Datos que se escriben al aplicar** (comprobado leyendo el SQL fuera de los cuerpos de las funciones):

| Migración | Qué escribe |
|---|---|
| PM07 (fila 8) | `insert` en `stock_ubicacion` para productos sin fila autoritativa; no reemplaza saldos. **Ya aplicada en producción** (con una deriva: ver el informe de la foto, §4) |
| PM10 (fila 9) | `insert` de un contexto fiscal **simulado** en locales activos sin configuración y del catálogo del TPV desde los productos; no pisa filas ni precios. **Ya aplicada en producción** |
| B06 catálogo de políticas (fila 17) | `insert` del catálogo de conceptos (solo si entrara el paquete D) |
| D13 (fila 44) | dos columnas nuevas en `reembolsos` y `update reembolsos set aprobado_por = created_by, aprobado_at = created_at where aprobado_at is null`: todo reembolso existente se da por aprobado (es la regla que ya regía). **En producción hay 0 reembolsos: tocaría 0 filas** |

**Cambios de comportamiento inmediatos** (disparadores y funciones): C04–C12 y las piezas 2, 3 y 5 añaden disparadores de guarda. En concreto: **pieza 5** bloquea dar de alta o reactivar a quien tenga Churrero/a, Básico o Estándar (`rol_retirado:<rol>`), y **solo el Propietario** puede reabrir un cierre; **pieza 2**: un cierre con diferencia exige decisión; **pieza 3**: no se abre una cuenta con una modalidad deshabilitada; **D13**: pedir un reembolso ya no lo encola si quien lo pide no puede aprobar (por defecto, Propietario y Encargado aprueban en el acto y el Cajero/a no tiene el permiso).

**D12 (descuento del encargado):** elegiste la opción A: política explícita de **0 %** escrita por datos para cada empresa y local. En producción hay que **escribirla para el local productivo** (si no, rige el 20 % por defecto del código) o aplicar la opción B (cambiar el valor por defecto en el código y adaptar los contratos A09). Decisión tuya en §12.

## 7. Servidor y aplicación: quién va primero

Lectura del código y de los informes de cada pieza (**no probado** en combinación en QA): con el servidor nuevo y la aplicación vieja, y al revés.

| Cambio | Servidor nuevo + aplicación vieja | Aplicación nueva + servidor viejo |
|---|---|---|
| Cierre de caja con diferencia (pieza 2) | Con la pantalla vieja, finalizar un cierre con diferencia da error (la pantalla nueva pide la decisión) | Sin efecto: la pantalla nueva no ofrece la decisión si el servidor no la tiene |
| Reabrir cierre solo el Propietario | La pantalla vieja ofrece el botón a otros roles y da `abc_caja_no_autorizado` | Sin efecto (oculta el botón) |
| Alta de empleado con roles retirados | Error `rol_retirado:…` | Sin efecto |
| Devoluciones con aprobación (D13) | Sin cambio por defecto; si el Propietario diera el permiso al Cajero/a, sus solicitudes quedarían sin botón para aprobar | El botón «Aprobar» llama a una función que no existe: error |
| Cobro: leer pagos | Si la migración m04d está en producción, la pantalla vieja **ya falla** con «permission denied for table pago_intentos» | Funciona: usa los intentos que ya devuelve `abc_estado_pago_mixto_cuenta` (B05), que la pantalla ya llamaba |
| Historial de descuentos | Con m04d, la pantalla vieja **ya falla** al leer `abc_eventos` | Exige `abc_listar_eventos_descuento_cuenta` (A09 eventos) |
| Pantalla de configuración | No la ofrece | Error en cada panel sin su función |
| Catálogo P3 | Si el servidor lo tiene y la pantalla no, no se envía nada | Sin la RPC se apaga en silencio (documentado en el informe de P3) |

**Conclusión:** servidor primero (aditivo), aplicación después, ventana corta. La aplicación nueva **nunca** antes que su servidor.

## 8. Condiciones de entrada (todas, antes de aplicar nada)

1. Autorizaciones de §12.
2. **Foto de producción** (bloques P0–P9) repetida en la ventana, con hora y proyecto, y comparada con la del 3/10 (11:33 UTC); **cero** migraciones en «ALGUNOS (deriva)».
3. **Paridad por huellas:** P3 del archivo SQL sobre producción. Cada una de las 11 huellas (piezas 1, 2, 5 y D13) debe dar `COINCIDE`; si alguna da `DISTINTA`, la migración se negaría a aplicarse (por diseño) y **no se fuerza**. Comprobado en la réplica local que da `COINCIDE` sobre el estado previo de cada migración.
4. **Base PM09 reconciliada** en producción (la RPC base `revertir_venta_stock` y los wrappers que faltan), como cambio de alcance aparte y con su propio preflight.
5. **Pieza 2:** comprobada el 3/10: lógica idéntica entre QA y el archivo (una diferencia solo de un comentario, §4). Falta, si lo quieres, registrarla en el registro de QA o reaplicar esa función con el comentario.
6. **Pruebas registradas:** hecho el 3/10 en la rama (los 33 archivos del apéndice B en `tests/ci/manifiesto_clasificacion.json`, el flujo de CI para los contratos SQL). La puerta ya está en verde en GitHub; queda adaptar los contratos históricos F2/F4 de reembolsos a D13 (o decidir su destino).
7. **Roles retirados:** el 3/10 nadie los tenía; repetir P7 en la ventana.
8. **m04d:** **aplicada en producción** (foto del 3/10): los dos arreglos de pantalla (cobro y historial de descuentos) son necesarios; el de cobro necesita B05 en producción antes que la aplicación.
9. **D12:** política de 0 % del local productivo preparada (o la opción B decidida).
10. **Ventana:** bloque P8: **sin cajas abiertas, sin cuentas abiertas, sin reembolsos ni envíos pendientes**; fuera del servicio. El 3/10 había **2 cuentas abiertas y 1 efecto pendiente** (con 5 días sin actividad): hay que ver qué son y decidir qué se hace con ellas (con tu permiso).
11. **Netlify:** confirmar cuál es la rama de producción (el documento `A09_NETLIFY_QA_REVIEW_PROPOSAL_2026-09-24.md` no pudo comprobarlo; el PR 118 da a entender que fusionar en `release` publica producción), anotar el identificador del despliegue de producción actual (para volver) y el coste (según ese documento, en el plan basado en créditos cada despliegue de producción exitoso cuesta 15 créditos y los previews 0; no comprobado hoy).
12. **Copia de seguridad:** guardar la salida del bloque P4 (definición de las **46 funciones** que las migraciones reemplazan) y comprobar si el proyecto de producción tiene copia diaria o recuperación a un instante (no consultado).

## 9. Ejecución, paso a paso

Solo con las autorizaciones de §12 y en este orden. **Parar al primer fallo.**

1. **Congelar el candidato:** commit exacto del PR de promoción, `sha256` de `fuente.js`, resultado de `recuperar_candidato.py --check`.
2. **Repetir la foto** (P0–P9) dentro de la ventana y comparar con la de antes: si algo cambió, parar.
3. **Guardar P4** (definiciones) y anotar el despliegue actual de Netlify.
4. **Aplicar las migraciones una a una**, en el orden del apéndice A, con la herramienta de migraciones (cada una es una transacción: se aplica entera o nada). Tras cada una: ver su fila en el registro, repetir su fila de P2 (`todos`) y, si tiene huellas, P3.
5. **Humo transaccional con `ROLLBACK`** (modelo del humo A08 en producción, sin ventas reales): reutilizar los contratos vivos de las piezas con sus identidades ficticias, sustituyendo por usuarios existentes (la plantilla de A08 muestra cómo) y comprobando después que no queda ninguna fila.
6. **Fusionar el PR de promoción en `release`** (solo con CI en verde y la puerta de CI general arreglada) → un único despliegue de producción. Comprobar que lo servido es el candidato (`sha256` de `fuente.js`).
7. **Postflight:** P2 todo `todos`; P3 de nuevo (las huellas pasan a ser las de QA); permisos (P5) y advertencias de seguridad de Supabase; el registro con los nombres esperados.
8. **Pantallas, solo lectura:** abrir la pantalla de configuración y el historial sin crear datos. Cualquier flujo con ventas, cobros o devoluciones reales **solo** con tu autorización expresa y una cuenta de prueba acordada.

## 10. Recuperación

| Situación | Qué se hace |
|---|---|
| Una migración falla en su comprobación previa | No cambia nada (es una transacción). Se corrige la causa y se reintenta; las anteriores se quedan aplicadas |
| Una migración se aplica y algo va mal | **Hacia delante:** una migración correctora. Para las funciones reemplazadas, `create or replace` con la definición guardada en P4. Lo que se creó nuevo (tablas, funciones, columnas) queda sin uso y es inocuo |
| Un disparador nuevo bloquea un flujo real (pieza 2, 3 o 5, C04–C12) | Medida de emergencia: desactivarlo (`alter table … disable trigger …`) **con tu autorización**, y corregir después |
| Los datos creados al aplicar (PM07, PM10) | No se borran sin tu autorización; son idempotentes |
| La marca de aprobación de D13 | No se revierte: es el valor que ya regía |
| La aplicación nueva falla | En Netlify, **publicar de nuevo el despliegue anterior** (el anotado en el paso 3): inmediato y sin tocar la base. Con servidor nuevo y aplicación vieja el efecto es el de la tabla del §7 (degradado, no roto) |
| Algo que se escribió después de promocionar | **No hay vuelta atrás limpia** de los datos que los usuarios creen con el sistema nuevo. Por eso la ventana, el humo con `ROLLBACK` y no abrir caja hasta terminar |

## 11. Qué se comprueba después

- Para cada migración: su fila en el registro de producción y todos sus objetos (P2).
- Huellas P3 de las piezas 1, 2, 5 y D13 iguales a las de QA.
- Permisos del navegador sobre las 28 tablas (P5): ninguna lectura directa que no estuviera antes.
- Ninguna fila inesperada: recuentos de P6 contra los de la foto (salvo lo que las migraciones deben escribir, §6).
- Humo con `ROLLBACK` sin residuos.
- La pantalla de configuración y el historial de descuentos abren sin cartel rojo.

## 12. Lo que necesitaba de ti (decidido el 3/10: ver `F7_PROMOCION_PRODUCCION_DECISIONES_2026-10-03.md`; la promoción sigue SIN autorizar)

1. **Foto de producción: hecha** el 3/10 con tu autorización. Falta decidir qué hacer con la **deriva de PM07** (una migración correctora pequeña, en el paquete A) y si miro, solo lectura, qué son las **2 cuentas abiertas** y el **efecto pendiente**.
2. **Alcance del primer paquete:** A + C + E (mi propuesta), con P3/P3b y B06–B10 fuera.
3. **P3 y P3b (precio con IVA incluido):** esperar a la asesoría (recomendado) o asumirlo tú por escrito.
4. **B06–B10:** llevarlas primero a QA (con tu autorización) o dejarlas fuera del producto por ahora.
5. **D12:** política de 0 % por datos para el local productivo (opción A, ya elegida) o cambiar el valor por defecto del código (opción B).
6. **Roles retirados:** nadie los tiene en producción; solo repetir la comprobación en la ventana.
7. **PM09:** autorizar el trabajo aparte de reconciliar la base de producción (preflight del 2/10).
8. **Ventana y responsable:** cuándo (sin servicio ni cajas abiertas) y quién ejecuta y vigila.
9. **Despliegue y fusión:** un solo despliegue (D28) mediante un PR nuevo desde `release`, no el 118.
10. **Aplicar las migraciones:** una autorización por paquete, no en bloque.

## 13. Límites de este documento

- La foto de producción es del 3/10/2026 a las 11:33 UTC y puede cambiar; no dice qué versión de la aplicación sirve producción, ni qué son las 2 cuentas abiertas y el efecto pendiente, ni si hay copia de seguridad.
- El orden de las migraciones es el de las marcas de tiempo de los archivos; las dependencias principales (B04 antes de la pieza 5, C04 antes de la pieza 5, pieza 5 antes de D13) están confirmadas con los datos de producción (§5 del informe de la foto); el resto no se ha comprobado migración a migración.
- La tabla del §7 sale de leer el código y los informes, no de probar las combinaciones.
- El archivo SQL se probó solo en la réplica local (sin errores en una sesión de solo lectura, con las huellas dando `COINCIDE` sobre el estado previo de cada migración). En producción las columnas de los bloques P8 y P9 (`estado`, `created_at`, `occurred_at`) podrían diferir; si fallaran, fallan sin efectos y se anota como deriva.
- No hay prueba de carga ni de concurrencia real de ninguna pieza.

---

## Apéndice A · Las 46 migraciones candidatas, en orden

«Registro en QA» es la marca con la que la herramienta las registró en QA y «Producción» la marca con la que figura en el registro de producción (ambos leídos el 3/10/2026, solo lectura). Producción tiene 10 de las 46 y le faltan 36.

| # | Archivo | Nombre | Qué hace | Paquete | Registro en QA | Producción (3/10) |
|---|---|---|---|---|---|---|
| 1 | `20260924160739` | `abc_f3_a09_descuentos_cortesias` | Descuentos y cortesías con autorización (A09) | F3 | `20260925062334` | `20260926051548` |
| 2 | `20260926110000` | `abc_f3_a10_kitchen_commands` | Comandas de cocina (A10) | F3 | `20260926125550` | `20260926131350` |
| 3 | `20260926140000` | `abc_f3_a10b_kitchen_audit` | Auditoría de cocina (A10b) | F3 | `20260926133422` | `20260926134235` |
| 4 | `20260926203000` | `abc_f3_a02_operating_day_a11` | Día operativo (A11). **Documentada en PROD el 28/9** | F3 | `20260927070910` | `20260927072741` |
| 5 | `20260927113403` | `abc_f3_a06_recovery_server_operating_day` | Recuperar cuenta con día operativo. **Documentada en PROD el 28/9** | F3 | `20260927113403` | `20260927113504` |
| 6 | `20260927150500` | `abc_f3_a07_2_list_responsables` | Lista de responsables de cuenta (A07.2) | F3 | `20260927170018` | `20260927172341` |
| 7 | `20260927203000` | `abc_f3_a08_2_payment_interlock` | Cuenta bloqueada con cobro incierto (A08.2) | F3 | `20260927205020` | **falta** |
| 8 | `20260928170000` | `pm07_bootstrap_stock_desde_productos` | PM07: crea el stock autoritativo desde los productos. **Inserta filas.** En producción hay un **borrador anterior** (le falta una barra invertida en una expresión regular) | F3 | `20260929060333` | `20260928203006` |
| 9 | `20260928222000` | `pm10_bootstrap_tpv_catalogo` | PM10: crea contexto fiscal SIMULADO y catálogo del TPV desde los productos. **Inserta filas** | F3 | `20260929060754` | `20260928204348` |
| 10 | `20260928223000` | `pm10_cierre_sesion_caja` | Cierre de sesión de caja (PM10) | F3 | `20260929061405` | `20260928211206` |
| 11 | `20260929040000` | `abc_f4_b02_b03_checkout_bridge` | Cobro: puente de checkout (B02-B03) | F4 | `20260929061816` | `20260929062815` |
| 12 | `20260929213000` | `abc_f4_b04_unknown_payment` | Pago de resultado desconocido (B04) | F4 | `20261002060601` | **falta** |
| 13 | `20260929220000` | `abc_f4_b05_mixed_payments` | Pagos mixtos (B05). Da `abc_estado_pago_mixto_cuenta`, que usa la pantalla de cobro | F4 | `20261002060610` | **falta** |
| 14 | `20260930100000` | `abc_f4_b06_non_sale_receipts` | Cobros que no son venta (B06) | B06-B10 | **nunca aplicada en QA** | **falta** |
| 15 | `20260930103000` | `abc_f4_b06_advance_traceability` | Anticipos: trazabilidad (B06) | B06-B10 | **nunca aplicada en QA** | **falta** |
| 16 | `20260930110000` | `abc_f4_b06_advance_balance_guard` | Anticipos: guarda del saldo (B06) | B06-B10 | **nunca aplicada en QA** | **falta** |
| 17 | `20260930120000` | `abc_f4_b06_policy_catalog` | Catálogo de políticas de conceptos (B06). **Inserta filas** | B06-B10 | **nunca aplicada en QA** | **falta** |
| 18 | `20260930150000` | `abc_f4_b07_provider_registry` | Registro de proveedores de pago (B07) | B06-B10 | **nunca aplicada en QA** | **falta** |
| 19 | `20260930153000` | `abc_f4_b07_server_config` | Configuración del proveedor desde el servidor (B07) | B06-B10 | **nunca aplicada en QA** | **falta** |
| 20 | `20260930160000` | `abc_f4_b07_event_processing` | Procesado de eventos del proveedor (B07) | B06-B10 | **nunca aplicada en QA** | **falta** |
| 21 | `20260930230000` | `abc_f4_b09_settlements_disputes` | Liquidaciones y disputas (B09) | B06-B10 | **nunca aplicada en QA** | **falta** |
| 22 | `20260930233000` | `abc_f4_b09_import_resolution` | Importar liquidaciones y resolver disputas (B09) | B06-B10 | **nunca aplicada en QA** | **falta** |
| 23 | `20261001090000` | `abc_f4_b10_card_data_boundary` | Frontera de datos de tarjeta (B10) | B06-B10 | **nunca aplicada en QA** | **falta** |
| 24 | `20261001100000` | `abc_f4_b10_pci_capture_modes` | Modos de captura PCI (B10) | B06-B10 | **nunca aplicada en QA** | **falta** |
| 25 | `20261001110000` | `abc_f4_b10_pci_review_gate` | Puerta de revisión PCI (B10) | B06-B10 | **nunca aplicada en QA** | **falta** |
| 26 | `20261001140000` | `abc_f5_c04_close_reopen` | Cierre y reapertura de caja (C04) | F5 | `20261002060641` | **falta** |
| 27 | `20261001150000` | `abc_f5_c05_document_series` | Series de numeración documental (C05) | F5 | `20261002060652` | **falta** |
| 28 | `20261001160000` | `abc_f5_c06_document_types` | Tipos documentales (C06) | F5 | `20261002060700` | **falta** |
| 29 | `20261001170000` | `abc_f5_c07_fiscal_gate` | Puerta fiscal (C07), cerrada a propósito | F5 | `20261002060709` | **falta** |
| 30 | `20261001180000` | `abc_f5_c08_document_retention` | Conservación y corrección de documentos (C08) | F5 | `20261002060718` | **falta** |
| 31 | `20261001190000` | `abc_f5_c09_document_printing` | Impresión sin duplicar (C09) | F5 | `20261002060727` | **falta** |
| 32 | `20261001200000` | `abc_f5_c10_document_delivery` | Entrega de copias (C10) | F5 | `20261002060735` | **falta** |
| 33 | `20261001210000` | `abc_f5_c11_explainable_reconciliation` | Conciliación explicable (C11) | F5 | `20261002060744` | **falta** |
| 34 | `20261001220000` | `abc_f5_c12_close_rehearsal` | Ensayo de cierre (C12) | F5 | `20261002060752` | **falta** |
| 35 | `20261001230000` | `abc_f5_pm09_security_hardening` | Endurecimiento de seguridad PM09. **BLOQUEADA en PROD (2/10): la base no coincide con QA** | F5 | `20261002082225` | **falta** |
| 36 | `20261002150000` | `abc_p3_catalogo_autoritativo` | P3: catálogo autoritativo, precio de carta con IVA incluido (D31). **Cambia el importe que se cobra** | P3 | `20261002133018` | **falta** |
| 37 | `20261002170000` | `abc_p3b_espejo_lista_nube` | P3b: la copia de la lista en la nube refleja los campos de venta | P3 | `20261002151826` | **falta** |
| 38 | `20261002190000` | `abc_config_pieza1_dia_cajas` | Pieza 1: día operativo y cajas configurables (D06, D12 opción A) | Configuración | `20261002164602` | **falta** |
| 39 | `20261002210000` | `abc_config_pieza2_diferencia_caja` | Pieza 2: diferencia de caja con aprobación (D15) | Configuración | **no** (aplicada a mano) | **falta** |
| 40 | `20261002220000` | `abc_config_pieza3_modalidades` | Pieza 3: modalidades por local (D02) | Configuración | `20261002182214` | **falta** |
| 41 | `20261002230000` | `abc_config_pieza4_equipos` | Pieza 4: equipos y terminales por local | Configuración | `20261002183425` | **falta** |
| 42 | `20261002240000` | `abc_config_pieza5_permisos` | Pieza 5: permisos configurables y retirada de tres roles (D14) | Configuración | `20261002190532` | **falta** |
| 43 | `20261002250000` | `abc_config_pieza6d_dia_operativo` | Pieza 6d: lectura del día operativo por local | Configuración | `20261002201209` | **falta** |
| 44 | `20261003100000` | `abc_config_d13_reembolsos_aprobacion` | D13: devoluciones con aprobación. **Actualiza todos los reembolsos existentes** | Configuración | `20261003081109` | **falta** |
| 45 | `20261003120000` | `abc_a09_eventos_descuento_cuenta` | A09: eventos de descuento de una cuenta por función del servidor | Configuración | `20261003103727` | **falta** |
| 46 | `20261003130000` | `abc_pm07_correccion_numero_catalogo` | Corrección de PM07 (nueva, por la foto): arregla la expresión regular de `pm07_numero_catalogo` en producción. **Reemplaza una función** | A · corrección | no hace falta (QA ya la tiene correcta) | **falta** |

Paquetes: F3/F4/F5 = «A · Base»; B06-B10 = «D · Proveedor de pagos»; P3 = «B · Catálogo con IVA»; Configuración = «C».

## Apéndice B · Pruebas registradas el 3/10 en el manifiesto de CI (33 archivos)

`tests/cfg/`: `a09-acciones-ui-runtime`, `a09-eventos-static-contract`, `a09-eventos-ui-runtime`, `a09-panel-ui-runtime`, `alcance-static-contract`, `cfg1-static-contract`, `cfg2-static-contract`, `cfg3-static-contract`, `cfg4-static-contract`, `cfg5-static-contract`, `cfg6-ui-contract`, `cfg6-ui-runtime`, `cfg6d-static-contract`, `cfg6d-ui-contract`, `cfg6d-ui-runtime`, `cfg6e-ui-contract`, `cfg6e-ui-runtime`, `cobro-lectura-runtime`, `cobro-lectura-static-contract`, `d13-static-contract`, `d13-ui-contract`, `d13-ui-runtime`, `pm07-fix-static-contract`, `f7-preflight-static-contract` (vigila que el archivo de comprobaciones previas sea de solo lectura y coincida con las migraciones y con este documento), `pm08-caja-ui-runtime` y las tres ayudas `lib/servidor-caja-falso`, `lib/servidor-reembolsos-falso`, `lib/tablas-sin-acceso-qa` (utilidades).
`tests/`: `p1-denied-keys-solo-local`, `p3-catalogo-bridge`, `p3/p3-actualizar-producto-resultado`, `p3/p3-catalogo-static-contract`, `p3/p3b-espejo-static-contract`.

Además, sin contar para el validador (solo cuenta `.mjs`) y ejecutados por el flujo `abc-f6-config-contract.yml`: los contratos SQL `cfg1`…`cfg6d`, `d13`, `a09-eventos` y `d13-upgrade.sh`. Las pruebas de ejecución (`*-ui-runtime`) necesitan librerías que no están en el repositorio (react 18.3.1, react-dom, jsdom) y el contrato de alcance necesita acorn y eslint-scope: el flujo de CI debe instalarlas.
