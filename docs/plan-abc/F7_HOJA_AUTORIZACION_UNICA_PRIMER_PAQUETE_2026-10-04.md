# F7 · Hoja de la autorización única del primer paquete (BORRADOR para que la revise Pedro)

Fecha: 2026-10-04
Estado: `BORRADOR_NO_AUTORIZA_NADA`
Origen: decisión 8 de `F7_PROMOCION_PRODUCCION_DECISIONES_2026-10-03.md` («una sola autorización para el primer paquete entero») y guion de la ventana (`F7_PROMOCION_PRODUCCION_PREPARACION_2026-10-03.md`, §8–§10).

> **Esta hoja no autoriza nada por sí sola.** Leerla, corregirla o estar de acuerdo con ella no es la autorización. La autorización existe solo cuando Pedro, **en la ventana y con todo lo de §3 cumplido**, dice la frase de §5 con el commit, la fecha y la hora rellenados. Hasta entonces producción no se toca (D29).

## 1. Qué se autorizaría (todo junto, en este orden)

| # | Qué | Detalle |
|---|---|---|
| 1 | **Lecturas de solo lectura de producción** | Foto repetida (bloques P0–P9 y P8b del archivo de comprobaciones previas), huellas P3, P4 (definiciones), y las comprobaciones posteriores. No escriben nada |
| 2 | **21 migraciones**, una a una, en el orden de la tabla de §2, con la herramienta de migraciones (cada una es una transacción) | Tras cada una: su fila en el registro, sus objetos (P2) y, si tiene huella, P3 |
| 3 | **Un dato:** la política de descuento del Encargado (D12, opción A, 0 %) para el local productivo | Se escribe tras la última migración y se comprueba (decisión 17) |
| 4 | **Humo transaccional con `ROLLBACK`** | Pruebas con identidades ficticias que no dejan ninguna fila; se comprueba que no queda nada |
| 5 | **Fusionar el PR 119 en `release`** | Es el **único despliegue de producción** (D28). Se comprueba después que lo servido es el candidato (`sha256` de `fuente.js`) |
| 6 | **Pantallas, solo mirar (lo hace Cowork)** | Abrir con el Propietario la pantalla de configuración y el historial de descuentos, sin pulsar nada que cree o guarde. **Nadie crea cuentas, ventas, cobros ni descuentos.** La aplicación puede guardar por sí sola su sincronización habitual (local activo, contexto empresa/local, cambios de catálogo pendientes en ese equipo): no se puede evitar al abrirla |
| 7 | **Volver a publicar el despliegue anterior de Netlify, solo si la aplicación nueva falla tras publicarla** (decisión 22) | No toca la base de datos y deja la aplicación como está hoy. Es la **única** marcha atrás autorizada de antemano; cualquier otra diferencia es parar y esperar tu decisión |

## 2. Las 21 migraciones, en orden (todas faltan hoy en producción)

| Orden | Marca | Nombre | Grupo |
|---|---|---|---|
| 1 | `20260927203000` | `abc_f3_a08_2_payment_interlock` | Base |
| 2 | `20260929213000` | `abc_f4_b04_unknown_payment` | Base |
| 3 | `20260929220000` | `abc_f4_b05_mixed_payments` | Base |
| 4 | `20261001140000` | `abc_f5_c04_close_reopen` | Base |
| 5 | `20261001150000` | `abc_f5_c05_document_series` | Base |
| 6 | `20261001160000` | `abc_f5_c06_document_types` | Base |
| 7 | `20261001170000` | `abc_f5_c07_fiscal_gate` | Base |
| 8 | `20261001180000` | `abc_f5_c08_document_retention` | Base |
| 9 | `20261001190000` | `abc_f5_c09_document_printing` | Base |
| 10 | `20261001200000` | `abc_f5_c10_document_delivery` | Base |
| 11 | `20261001210000` | `abc_f5_c11_explainable_reconciliation` | Base |
| 12 | `20261001220000` | `abc_f5_c12_close_rehearsal` | Base |
| 13 | `20261002190000` | `abc_config_pieza1_dia_cajas` | Configuración |
| 14 | `20261002210000` | `abc_config_pieza2_diferencia_caja` | Configuración |
| 15 | `20261002220000` | `abc_config_pieza3_modalidades` | Configuración |
| 16 | `20261002230000` | `abc_config_pieza4_equipos` | Configuración |
| 17 | `20261002240000` | `abc_config_pieza5_permisos` | Configuración |
| 18 | `20261002250000` | `abc_config_pieza6d_dia_operativo` | Configuración |
| 19 | `20261003100000` | `abc_config_d13_reembolsos_aprobacion` | Configuración |
| 20 | `20261003120000` | `abc_a09_eventos_descuento_cuenta` | Configuración |
| 21 | `20261003130000` | `abc_pm07_correccion_numero_catalogo` | Corrección de PM07 |

## 3. Lo que NO se autoriza (queda fuera aunque Pedro diga la frase)

- **P3 y P3b** (precio de carta con IVA incluido, D31): paquete aparte, justo después, con su propia autorización.
- **B06–B10** (proveedor de pagos): primero a QA.
- **PM09** (reconciliación de la base): trabajo aparte.
- **Cualquier borrado o corrección de datos**, incluidas las **2 cuentas y la comanda** de la prueba A10 (decisiones 14 y 15: se dejan como restos conocidos).
- **Cualquier cambio que no esté en el candidato**, y **seguir adelante después de un fallo o de una diferencia**.
- **Abrir caja, ventas, cobros o devoluciones reales** durante o después de la ventana sin su autorización expresa.
- **Contratar o cambiar planes** (por ejemplo pasar Supabase a Pro): decisión suya aparte (D27).
- **La contraseña de la base de datos**: nunca se me da; la copia manual la hace Pedro.

## 4. Condiciones previas (todas, antes de decir la frase)

| ✔ | Condición | Cómo se comprueba |
|---|---|---|
| ☐ | **Candidato congelado**: commit exacto del PR 119 y `sha256` de `fuente.js` | Hoy `88fcf88015b6c85eb75c98080480ffde3da9a80f67688ff1824c7f1dfc07fbe8`. Se anota el commit de la cabeza congelada: `[COMMIT]` |
| ☐ | **CI en verde** en esa cabeza (22 de 22 + Netlify sin error) | Panel de comprobaciones del PR |
| ☐ | **`release` sigue en `01f47bf`** | Si se movió, el árbol publicado no sería el probado: actualizar el PR, repetir la CI y volver a congelar |
| ☐ | **Foto de producción repetida** sin diferencias con la del 3/10, con cero migraciones en «ALGUNOS (deriva)» | Bloques P0–P9 |
| ☐ | **Bloque P8b**: 0, 0, 0 y 2, 2, 1 | Cualquier otro valor = hay algo en curso que no es un resto conocido |
| ☐ | **Huellas P3**: las 13 en `COINCIDE` | Si alguna da `DISTINTA`, la migración se negaría a aplicarse y no se fuerza |
| ☐ | **Definiciones guardadas (P4)** de las 46 funciones que se reemplazan | Salida guardada fuera del repositorio |
| ☐ | **Copia manual hecha por Pedro** (`roles.sql`, `schema.sql`, `data.sql`) | Hora y tamaños anotados; ninguno de 0 bytes; guardada fuera del repositorio y en dos sitios |
| ☐ | **Despliegue de Netlify al que volver** anotado | `6abf43047ed8030008ffb5a9` (commit `01f47bf`, 2/10/2026); se comprueba que sigue siendo el actual |
| ☐ | **Sin servicio y sin cajas abiertas**; personal avisado | Bloque P8 |
| ☐ | **Pedro presente** durante toda la ventana | — |

## 5. La frase (la que Pedro diría en la ventana, con los huecos rellenados)

> «Autorizo aplicar en producción el primer paquete tal como lo describe la hoja de autorización: las 21 migraciones, la política D12 y el despliegue del PR 119 en el commit `[COMMIT]` (`sha256` de `fuente.js` `88fcf880…`), hoy `[FECHA]` a las `[HORA]`. La foto previa no tiene diferencias, la copia manual está hecha y estoy presente. Si la aplicación nueva falla tras publicarla, queda autorizado volver a publicar el despliegue anterior de Netlify (`6abf43047ed8030008ffb5a9`); ante cualquier otra diferencia, para y espera mi decisión.»

Una respuesta ambigua («vale», «adelante» sin más) **no** cuenta: se necesita esa frase o una equivalente que nombre el commit y el alcance.

## 6. Dónde paro (a la primera diferencia, sin seguir)

- Una migración falla o se niega por su comprobación previa.
- Una huella da `DISTINTA`, o aparece una migración en «ALGUNOS (deriva)».
- Una fila del registro o un objeto esperado no aparece tras aplicar una migración.
- P8b da un valor distinto de lo esperado, o aparece una caja abierta, un pago o un reembolso en curso.
- El humo con `ROLLBACK` deja alguna fila.
- `release` ya no está en `01f47bf`, o la CI de la cabeza congelada no está en verde.
- El `sha256` de `fuente.js` servido tras el despliegue no es el del candidato.

Al parar: te cuento qué ha pasado y en qué estado queda producción, y **no hago nada más hasta que decidas**. Opciones habituales: una migración correctora hacia delante (nunca borrar), `create or replace` con la definición guardada en P4 para una función reemplazada, desactivar un disparador que bloquee un flujo real (solo con tu autorización) o, si la aplicación nueva falla tras publicarla, **publicar de nuevo el despliegue anterior de Netlify**: inmediato, sin tocar la base y **ya autorizado de antemano** (punto 7 de §1). Es la única de estas opciones que no espera tu decisión.

## 7. Lo que Pedro asume (en claro)

- **Producción no tiene copias automáticas** (plan gratuito de Supabase, confirmado en el panel): la única copia es la manual del día de la ventana. Un volcado reconstruye una base nueva; no es una vuelta atrás rápida.
- **Lo que se escriba después de promocionar no tiene vuelta atrás limpia.** Por eso: ventana corta, humo con `ROLLBACK` y no abrir caja hasta terminar.
- **Servidor y aplicación nunca se han probado en combinación en QA** sobre la base real de producción; la tabla del §7 del documento de preparación sale de leer el código y los informes. El orden «servidor primero, aplicación después» limita el riesgo.
- **No hay prueba de carga ni de concurrencia real** de ninguna pieza.
- **El coste del despliegue de producción de Netlify no está comprobado** (según un documento del repositorio, 15 créditos; sin verificar). **Pedro lo asume** (decisión 23, 4/10/2026).
- Quedan **2 cuentas, 2 pedidos y 1 comanda de prueba** abiertos en producción (restos conocidos) y no se tocan.
- La pantalla antigua de producción **ya falla** en el cobro y en el historial de descuentos (porque m04d está aplicada): la aplicación nueva lo arregla.

## 8. Qué hago yo y qué haces tú

| Pasos | Quién |
|---|---|
| Copia manual (`supabase db dump` ×3), avisar al personal, decir la frase | **Pedro** |
| Abrir las pantallas de producción tras el despliegue, solo mirar (yo le doy el prompt a Cowork y reviso lo que cuenta) | **Cowork**, con Pedro presente |
| Foto, huellas, P4, migraciones una a una, D12, humo con `ROLLBACK`, fusionar, comprobaciones posteriores, volver a publicar el despliegue anterior si la app nueva falla, informar de cada paso | **Claude** |
| Parar y esperar tu decisión ante cualquier diferencia | **Claude** |

## 9. Registro (se rellena al congelar y durante la ventana)

| Dato | Valor |
|---|---|
| Commit congelado | `[COMMIT]` |
| Fecha y hora de la ventana | `[FECHA / HORA]` |
| Hora y tamaños de la copia manual | `[HORA]` · `roles.sql [bytes]` · `schema.sql [bytes]` · `data.sql [bytes]` |
| Despliegue de Netlify anterior | `6abf43047ed8030008ffb5a9` |
| Resultado | `[RESULTADO]` |
