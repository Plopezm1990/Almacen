# Fase 4b · Prueba con la pantalla (Cowork): lista de productos por empresa

Solo QA (`qjqorixtkilwsndqayyx`, vista previa `deploy-preview-118--chic-entremet-9107cf.netlify.app`, que ya lleva P3c y la Fase 4). Cuentas ficticias `@qa.invalid`. **No tocar producción.**
Qué se comprueba: con P3c + F4 + F4b, la lista de productos de cada empresa se guarda en la nube, no se mezcla y se recupera desde «otro equipo». Se reutilizan `duena.f4.1` y `duena.f4.2` (contraseña `ClaveNueva2026F4`, lista rellenada por F4b) y se crea una tercera empresa para comprobar el alta nueva.

## Resultado de la primera ronda (2026-10-10, pasos 1–3a bien, 3b con diferencia)

- Empresa 1 (`duena.f4.1`): `Café F4-1` se guardó en la nube (fila `productos` con su producto, `localId` y `empresaId` correctos, vía la RPC de P3c) y se recuperó desde «otro equipo». Sin aviso rojo, «cambios sin confirmar: 0». Campos obligatorios al crear un producto: nombre, **costo** (Precio CAJA sin IVA o Costo UNIDAD sin IVA) y **stock mínimo**.
- Empresa 2 (`duena.f4.2`): `Harina F4-2` se vio en su lista local pero **no llegó a la nube** (fila `productos` aún vacía) y desde «otro equipo» salió vacía.
- **Causa (registros de QA):** mientras se creó `Harina F4-2` no hubo ninguna llamada a `abc_productos_guardar_lista`; el programa no lo intentó. La ronda anterior de la Fase 4 (07:02–07:32 UTC, con el cliente sin P3c) dejó en el navegador de `duena.f4.2` la marca «el servidor no permite guardar esta colección» (`almacen__denegados`, vigencia **6 h**, por diseño del cliente): por eso en esta ronda `duena.f4.2` ya mostraba «1 colección solo en este equipo» al entrar y `duena.f4.1` (cuyo navegador se había borrado) no. No es un fallo del servidor ni de F4/F4b.
- Se repite la prueba **empezando con los datos del sitio borrados**.

## Resultado de la segunda ronda (2026-10-10, navegador limpio): hallazgo de fondo

- Empresa 2 (`duena.f4.2`): `Harina F4-2b` **sí** se guardó en la nube (RPC de P3c, 08:42:44 UTC). Confirma que la ronda 1 fue la marca caducada de 6 h.
- Empresa 1 (`duena.f4.1`): `Café F4-2b` **no** se guardó. Registro de la base de datos (08:39:03 UTC): `catalogo_contexto_fiscal_ausente`, respuesta HTTP 400 de `abc_productos_guardar_lista`. El programa dejó el producto solo en el equipo con un aviso «Subiendo 1…» que no desaparecía (y «cambios sin confirmar: 0» no lo reflejaba).
- **Causa:** el puente de P3c manda «intención de venta» (`p_venta`) cuando una persona crea o cambia un producto (clic en los últimos 3 s). Con `p_venta` no vacío la RPC llama a `abc_catalogo_guardar_productos`, que exige contexto fiscal del local (entidad fiscal + vínculo con el local + moneda) **antes de mirar** si el producto es vendible, y su error aborta TODA la transacción, también la lista. Las empresas nuevas no tienen contexto fiscal (QA: solo `QA Empresa A` lo tiene; no hay pantalla para crearlo y `plataforma_crear_empresa` no lo crea). Si el guardado ocurre más de 3 s después del clic (la pantalla de Cowork se quedaba en blanco), no hay intención de venta y la lista se guarda: por eso `Café F4-1` (ronda 1) sí y `Café F4-2b` no. Es **un hueco de P3c en empresas sin contexto fiscal**, no de F4/F4b.


## Arreglo F4c (2026-10-10, decidido por Pedro: «que la lista se guarde aunque falte lo fiscal»)

- Migración `20261009160000_plataforma_f4c_lista_sin_contexto_fiscal.sql`: si, y solo si, el catálogo del TPV falla con `catalogo_contexto_fiscal_ausente`, `abc_productos_guardar_lista` salta el catálogo de ese grupo y **conserva la lista**; responde `catalogo_ya_sincronizado=false` y `catalogo_pendiente_contexto_fiscal=true` (el cliente sigue su camino anterior y recibe el aviso de contexto fiscal sin reintentar sin fin). Cualquier otro error (permiso, producto inválido, contexto fiscal ambiguo) sigue abortando todo. Las empresas con contexto fiscal no notan nada.
- Probado en Postgres real (p09): antes de F4c el error aborta la lista; con F4c la lista se guarda; el ambiguo sigue siendo error; la empresa con catálogo operativo sigue sincronizando; idempotente; se niega si el texto de la función no es el esperado; 6 mutaciones detectadas. Su fragmento aparece exactamente una vez en la versión de P3c de `release`.
- Aplicado en QA y comprobado con una llamada real dentro de QA deshecha al final: lista 1 → 2, `ok=true`, `catalogo_ya_sincronizado=false`, `catalogo_pendiente_contexto_fiscal=true`.
- Fuera de esta migración y aún abierto: configuración fiscal automática al dar de alta una empresa (hace falta decidir qué datos se piden) y el catálogo del TPV de empresas nuevas.

## Resultado de la ronda 3 (2026-10-10, con F4c): paso 1 bien, paso 2 interrumpido por la caché

- **Paso 1 (`duena.f4.1`):** `Café F4-3` se guardó **en la nube** (fila `productos` de la empresa 1: `Café F4-1 | Café F4-3`, 12:19 UTC), sin «Subiendo 1…», sin aviso rojo, sin aviso de TPV ni de contexto fiscal, «cambios sin confirmar» 0. **F4c funciona de punta a punta con el cliente de P3c.**
- **Paso 2 (`duena.f4.2`):** al entrar salió tres veces «No se ha podido cargar el programa» y cargó al cuarto intento. Consola: 404 (con contenido HTML) de `seleccion-neutral-patch.js?v=2` y `auth-ux-patch.js?v=1`. Esos dos archivos **ya no existen en el repositorio** y `index.html` no los menciona: el navegador estaba usando una copia antigua del programa de su caché/service worker (el «borrar datos del sitio» de Cowork no incluía la caché del navegador). No es de F4. En la siguiente ronda se borra también la caché.
- Dato extra de Cowork: tras recuperarse, `Harina F4-2b` (ronda anterior) salió en las alertas de `duena.f4.2` con el navegador limpio, es decir, vino de la nube: confirma la sincronización de la empresa 2.

## Texto para pegar en Cowork (ronda 3b: continuar desde el paso 2)

> Eres Cowork. Haz SOLO estas comprobaciones en la vista previa de QA `https://deploy-preview-118--chic-entremet-9107cf.netlify.app` (nunca en producción). Cuentas ficticias. Usa la pantalla como una persona, sin consola ni código. Para en la primera diferencia y cuéntamela con el texto exacto. Si un botón no se deja pulsar con el ratón, usa el teclado y dímelo. «Esperar 30 segundos» es esperar de verdad sin tocar nada. «Borrar los datos del sitio» = borrar cookies, almacenamiento local y de sesión y bases IndexedDB del sitio, y recargar con Ctrl+Shift+R; dime cada vez que lo hagas. Al pulsar «Guardar producto» pulsa UNA sola vez y espera 10 segundos antes de tocar nada más; si la pantalla se queda en blanco, espera y comprueba que el producto aparece, sin volver a pulsar.
>
> 0. «Borrar los datos del sitio» incluye ahora TAMBIÉN la caché y los service workers (en Chrome: herramientas de desarrollo → Application → Storage → «Clear site data» con todo marcado, o equivalente) y recargar con Ctrl+Shift+R. Hazlo ahora. Si aparece «No se ha podido cargar el programa», pulsa «Volver a cargar» y cuéntame cuántos intentos hicieron falta.
> 1. (Ya hecho en la ronda anterior: `Café F4-3` está guardado en la nube para `duena.f4.1`.) Inicia sesión como `duena.f4.1@qa.invalid` / `ClaveNueva2026F4` y comprueba que en «Productos» están `Café F4-1` y `Café F4-3`. Anota avisos. Cierra sesión.
> 2. En la misma ventana (sin borrar nada) inicia sesión como `duena.f4.2@qa.invalid` / `ClaveNueva2026F4`. Anota el aviso «N colecciones solo en este equipo» si sale. En «Productos» **NO debe aparecer `Café F4-3`** (puede aparecer `Harina F4-2` de la ronda anterior solo si sigue en el almacenamiento local de esa cuenta: dímelo). Crea `Harina F4-3` igual (costo 2, stock mínimo 1, sin precio de venta), guarda UNA vez, espera 30 segundos, anota avisos y «cambios sin confirmar». Cierra sesión.
> 3. Borra los datos del sitio (con caché y service workers). Inicia sesión como `duena.f4.1`: en «Productos» debe verse `Café F4-3` y NO `Harina F4-3`. Cierra sesión. Borra los datos del sitio otra vez e inicia sesión como `duena.f4.2`: debe verse `Harina F4-3` y NO `Café F4-3`. Cierra sesión.
> 4. Entra como `owner.a@qa.invalid` (panel «Plataforma») y crea la empresa `QA F4 Cliente 3`, local `Local F4-3`, dueño `Dueña F4-3`, correo `duena.f4.3@qa.invalid`, con la contraseña inicial propuesta (apúntala). Cierra la sesión del panel. Borra los datos del sitio. Entra como `duena.f4.3@qa.invalid` con esa contraseña, elige `ClaveNueva2026F4` (espera 30 s antes), y crea el producto `Azúcar F4-3` (costo 2, stock mínimo 1, sin precio de venta). Espera 30 segundos, anota avisos y «cambios sin confirmar». Cierra sesión, borra los datos del sitio, vuelve a entrar como `duena.f4.3`: debe verse `Azúcar F4-3`.
> 5. Entra como `owner.a@qa.invalid`, «Abrir mi aplicación» (espera 30 s) y mira «Productos»: debe verse el catálogo de `QA Empresa A` y NINGUNO de los productos de las empresas F4. Pulsa «← Plataforma» y cierra sesión.
>
> Al terminar dime: (1) qué pasos fueron como se describe; (2) los distintos, con el texto exacto; (3) cada aviso rojo, «cambios sin confirmar» distinto de 0 o «colecciones solo en este equipo», con el número y el paso; (4) la contraseña inicial de `duena.f4.3`; (5) cualquier OTRO aviso o mensaje que salga al guardar productos (por ejemplo del catálogo del TPV o del contexto fiscal), con el texto exacto y el paso.

## Resultado de la ronda 3b (2026-10-10): pasos 0–4 bien, paso 5 con diferencia → arreglo F4d

- **Pasos 0–4 sin ninguna diferencia** (caché y service workers borrados, 0 reintentos de carga): `duena.f4.1` ve `Café F4-1` y `Café F4-3`; `duena.f4.2` crea `Harina F4-3` sin avisos y con «cambios sin confirmar» 0; cada empresa recupera solo lo suyo desde la nube; la empresa nueva `QA F4 Cliente 3` (dueña `duena.f4.3`) crea `Azúcar F4-3` y lo recupera con el almacenamiento borrado.
- **Paso 5 (`owner.a` → «Abrir mi aplicación» → QA Empresa A):** banner rojo «No se han podido cargar tus datos guardados (productos — revisa el acceso)…», aviso «4 colecciones solo en este equipo» y «Arranque: datos que no se pudieron cargar» = 1.
- **Causa (leída en los registros de QA, 13:18:52–55 UTC):** `owner.a` tiene membresía activa en `QA-EMP-A` **y** en `QA-EMP-B`, y `QA-EMP-B` es una empresa **dada de baja** (la baja de la plataforma desactiva también las membresías, pero esta empresa de prueba es anterior y las conservó activas). Desde F4b ambas tienen fila `productos`, así que el servidor veía dos empresas para la misma cuenta y falló cerrado: `almacen_kv_empresa_no_determinada` (×2, en las subidas de colecciones) y `almacen_kv_empresa_ambigua` (en `abc_productos_guardar_lista`, 403). No es un fallo de la prueba ni del cliente. (El cuarto error, `movimientos_registro … row-level security`, es anterior a F4: esa tabla solo tiene regla de lectura en QA y ya salía el 9 y el 10 de octubre desde las 07:02; queda aparte.)
- **Dato de producción (solo conteos, 2026-10-10):** 3 empresas, 1 activa; 3 membresías activas; **una cuenta** tiene membresía activa en las tres (dos en empresas dadas de baja) y **ninguna** cuenta tiene dos empresas *activas*. Sin arreglo, F4 habría dejado a esa cuenta sin poder guardar en producción.

## Arreglo F4d (2026-10-10): una empresa dada de baja no cuenta

- Migración `20261009170000_plataforma_f4d_empresas_vigentes.sql`: `create or replace` de tres funciones de F4 (`plataforma_kv_permitido`, `plataforma_kv_empresa_llamante`, `plataforma_f4_kv_empresa`) para que solo cuenten las empresas con `activo = true`. No cambia datos, tablas, claves ni reglas. Una empresa dada de baja queda invisible y no escribible para sus antiguos miembros (sus datos no se tocan; al reactivarla vuelve a verse). Una cuenta con **dos empresas activas** sigue fallando cerrado.
- Probado en Postgres real (`p09`): antes de F4d la cuenta con una empresa viva y otra de baja ve las dos listas y falla (escritura y RPC); después ve solo la viva, escribe y guarda su lista; no puede escribir ni borrar en la empresa de baja (ni por `empresa_id` ni por el JSON); la cuenta cuya única membresía está en la empresa de baja no ve ni escribe nada; reactivar la empresa devuelve su visibilidad; dos empresas vivas siguen fallando cerrado; la tabla de roles y los permisos no cambian; es idempotente; se niega sin F4 o sin `empresas.activo`; y reproduce la situación de producción (tres empresas, una activa) en la forma «prod». 10 mutaciones: 7 detectadas y 3 equivalentes (repiten permisos que `create or replace` ya conserva).
- Aplicado en QA (huellas idénticas a las del Postgres local; `authenticated` sin permiso sobre las ayudas privadas salvo `plataforma_kv_permitido`). Comprobado con la cuenta real `owner.a` dentro de QA y deshecho al final: ve solo la lista de `QA-EMP-A`, su guardado cae en `QA-EMP-A` y la RPC de la lista responde `ok`.

## Texto para pegar en Cowork (ronda 4: repetir el paso 5)

> Eres Cowork. Haz SOLO estas comprobaciones en la vista previa de QA `https://deploy-preview-118--chic-entremet-9107cf.netlify.app` (nunca en producción). Cuentas ficticias. Usa la pantalla como una persona, sin consola ni código. Para en la primera diferencia y cuéntamela con el texto exacto. «Borrar los datos del sitio» = borrar cookies, almacenamiento local y de sesión, bases IndexedDB, caché y service workers del sitio, y recargar con Ctrl+Shift+R; dime cuándo lo haces.
>
> 0. Borra los datos del sitio (con caché y service workers) ahora. Esto quita el marcador de «colecciones denegadas» que dejó la ronda anterior.
> 1. Entra como `owner.a@qa.invalid` (la contraseña de siempre), pulsa «Abrir mi aplicación» de `QA Empresa A` y espera 30 segundos sin tocar nada. Dime si sale banner rojo, el aviso «N colecciones solo en este equipo» (con el número) o «Arranque: datos que no se pudieron cargar» (con el número).
> 2. Abre «Productos»: debe verse el catálogo de `QA Empresa A` (unos 30 productos) y NINGUNO de los productos de las empresas F4 (`Café F4-1`, `Café F4-3`, `Harina F4-3`, `Azúcar F4-3`). Dime cuántos productos ves.
> 3. Pulsa «← Plataforma» y cierra sesión.
>
> Al terminar dime: (1) qué pasos fueron como se describe; (2) los distintos, con el texto exacto; (3) cada aviso rojo o «colecciones solo en este equipo», con el número y el paso.

Resultado esperado de la ronda 4: sin banner rojo; «colecciones solo en este equipo» en 0 o 1 (solo `empresas`/`configEmpresa`, que no se sincronizan por diseño); catálogo de `QA Empresa A` sin productos de F4. Después, Claude comprueba en los registros de QA que no hay 403 de `almacen_kv` ni `abc_productos_guardar_lista` en esa ventana.

## Resultado de la ronda 4, intento 1 (2026-10-10): el borrado de datos no borró nada → no prueba nada

- Cowork ejecutó «borrar los datos del sitio» y su propio guion contó **0 cookies, 0 bases IndexedDB, 0 cachés y 0 service workers**: no limpió el almacenamiento real de la app. Tras recargar, la sesión de `owner.a` seguía abierta y salieron **exactamente** el banner rojo, «4 colecciones solo en este equipo» y «Arranque: datos que no se pudieron cargar: 1» de la ronda anterior. Cowork se detuvo en el paso 0 y no llegó a «Productos».
- **Los registros de QA lo confirman:** entre las 13:30 y las 14:30 UTC no hubo **ninguna** petición a `almacen_kv` ni a `abc_productos_guardar_lista` ni ningún error 4xx. La pantalla mostró solo el estado guardado en ese navegador (marcador de «colecciones denegadas», válido 6 horas desde las 13:18). F4d no llegó a ejercitarse.
- **Cambio de método:** en vez de depender de borrar datos, se usa una **dirección nueva del mismo QA**, cuyo almacenamiento está vacío por definición: la dirección permanente del despliegue del commit `08121db`, `https://6aca40b93a0a2c0008a1fd88--chic-entremet-9107cf.netlify.app`. El programa la reconoce como vista previa de QA (`reset-pruebas-preview.js`, patrón de 24 caracteres hexadecimales) y bloquea cualquier salida a producción. En la dirección antigua (`deploy-preview-118…`) no se debe volver a probar hasta las 19:30 UTC, porque conserva el marcador.

## Texto para pegar en Cowork (ronda 4b: dirección nueva, sin borrar nada)

> Eres Cowork. Haz SOLO estas comprobaciones en la vista previa de QA `https://6aca40b93a0a2c0008a1fd88--chic-entremet-9107cf.netlify.app` (es una dirección nueva del mismo QA; nunca uses producción ni la dirección `deploy-preview-118…` en esta prueba). Cuentas ficticias. Usa la pantalla como una persona, sin consola ni código. Para en la primera diferencia y cuéntamela con el texto exacto.
>
> 0. Abre esa dirección en una pestaña nueva. Debe mostrar la pantalla de inicio de sesión (almacenamiento vacío). Si NO sale la pantalla de inicio de sesión, para y dímelo.
> 1. Entra como `owner.a@qa.invalid` (la contraseña de siempre), pulsa «Abrir mi aplicación» de `QA Empresa A` y espera 30 segundos sin tocar nada. Dime si sale banner rojo, el aviso «N colecciones solo en este equipo» (con el número) o «Arranque: datos que no se pudieron cargar» (con el número).
> 2. Abre «Productos»: debe verse el catálogo de `QA Empresa A` (unos 30 productos) y NINGUNO de los productos de las empresas F4 (`Café F4-1`, `Café F4-3`, `Harina F4-3`, `Azúcar F4-3`). Dime cuántos productos ves.
> 3. Pulsa «← Plataforma» y cierra sesión.
>
> Al terminar dime: (1) qué pasos fueron como se describe; (2) los distintos, con el texto exacto; (3) cada aviso rojo o «colecciones solo en este equipo», con el número y el paso.

## Resultado de la ronda 4b, pasos 0–1 (2026-10-10, dirección nueva): F4d funciona; queda un aviso que no es de F4

- **Paso 0:** la dirección nueva mostró el inicio de sesión (almacenamiento vacío). **Paso 1** (`owner.a` → «Abrir mi aplicación» de `QA Empresa A`, 30 s): **sin banner rojo** y «Arranque: datos que no se pudieron cargar» = **0** (antes: banner y 1). Quedó el aviso «1 colección solo en este equipo (el servidor no permite guardarla)» (antes: 4). Cowork se detuvo ahí por la regla de «parar en la primera diferencia»; ese 1 estaba dentro de lo esperado (0 o 1) y se le pide continuar con los pasos 2 y 3.
- **Registros de QA de la ventana 13:53–15:30 UTC (solo lectura):** ningún `almacen_kv_empresa_ambigua` ni `almacen_kv_empresa_no_determinada` y **ningún 403 sobre `almacen_kv`**. Solo dos respuestas de error de la aplicación:
  1. `POST movimientos_registro` → 403 «new row violates row-level security policy for table "movimientos_registro"». El cliente marca como «solo en este equipo» toda clave rechazada por permisos; esta es, casi con seguridad, la «1 colección» (`movimientos`). Es una diferencia **de QA**: allí `movimientos_registro` solo tiene regla de lectura (`movimientos_registro_select`, con `empresa_id`); la de producción es otra (ver FASE4 §4d). Ya salía el 9 de octubre a las 17:32, antes de F4.
  2. `POST rpc/abc_productos_guardar_lista` → 400 `abc_productos_cambio_contexto_no_admitido:QA-CAT-A1-AGUA` (regla propia de P3c, no es un error de permisos, por eso no activa ningún marcador). Los 30 productos de `QA Empresa A` son datos antiguos de pruebas de QA: llevan `localId` pero **no `empresaId`** dentro del dato, y P3c no admite que un guardado les añada `empresaId`/`localId`. Afecta solo a esa lista antigua (las empresas nuevas guardan con `empresaId` desde el primer producto) y no es de F4; queda anotado como asunto abierto de P3c.
  (Otros errores de Postgres de esa franja —`column "q" does not exist`, `pedido_lineas … foreign key`, etc.— son de consultas manuales a QA ajenas a la aplicación.)

## Resultado esperado
| Paso | Esperado |
|---|---|
| 1 | `Café F4-3` guardado en la nube sin aviso rojo, **sin** «Subiendo 1…» que no acabe y sin «colecciones solo en este equipo»; «cambios sin confirmar» llega a 0. Es normal que salga UN aviso del catálogo del TPV del tipo «el local no tiene contexto fiscal configurado»: cópialo |
| 2 | Sin `Café F4-3`; `Harina F4-3` se guarda; **sin** aviso de colecciones solo en este equipo (navegador limpio) |
| 3 | Cada empresa recupera solo su producto desde la nube |
| 4 | La empresa nueva guarda y recupera `Azúcar F4-3` |
| 5 | La administradora, en `QA-EMP-A`, no ve ningún producto de F4 |

Después, Claude comprueba en QA (solo lectura) que cada empresa tiene su fila `productos` con su producto y que no hay mezcla.
