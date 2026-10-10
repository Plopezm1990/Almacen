# Fase 4b · Prueba con la pantalla (Cowork): lista de productos por empresa

Solo QA (`qjqorixtkilwsndqayyx`, vista previa `deploy-preview-118--chic-entremet-9107cf.netlify.app`, que ya lleva P3c y la Fase 4). Cuentas ficticias `@qa.invalid`. **No tocar producción.**
Qué se comprueba: con P3c + F4 + F4b, la lista de productos de cada empresa se guarda en la nube, no se mezcla y se recupera desde «otro equipo». Se reutilizan `duena.f4.1` y `duena.f4.2` (contraseña `ClaveNueva2026F4`, lista rellenada por F4b) y se crea una tercera empresa para comprobar el alta nueva.

## Resultado de la primera ronda (2026-10-10, pasos 1–3a bien, 3b con diferencia)

- Empresa 1 (`duena.f4.1`): `Café F4-1` se guardó en la nube (fila `productos` con su producto, `localId` y `empresaId` correctos, vía la RPC de P3c) y se recuperó desde «otro equipo». Sin aviso rojo, «cambios sin confirmar: 0». Campos obligatorios al crear un producto: nombre, **costo** (Precio CAJA sin IVA o Costo UNIDAD sin IVA) y **stock mínimo**.
- Empresa 2 (`duena.f4.2`): `Harina F4-2` se vio en su lista local pero **no llegó a la nube** (fila `productos` aún vacía) y desde «otro equipo» salió vacía.
- **Causa (registros de QA):** mientras se creó `Harina F4-2` no hubo ninguna llamada a `abc_productos_guardar_lista`; el programa no lo intentó. La ronda anterior de la Fase 4 (07:02–07:32 UTC, con el cliente sin P3c) dejó en el navegador de `duena.f4.2` la marca «el servidor no permite guardar esta colección» (`almacen__denegados`, vigencia **6 h**, por diseño del cliente): por eso en esta ronda `duena.f4.2` ya mostraba «1 colección solo en este equipo» al entrar y `duena.f4.1` (cuyo navegador se había borrado) no. No es un fallo del servidor ni de F4/F4b.
- Se repite la prueba **empezando con los datos del sitio borrados**.

## Texto para pegar en Cowork (repetición)

> Eres Cowork. Haz SOLO estas comprobaciones en la vista previa de QA `https://deploy-preview-118--chic-entremet-9107cf.netlify.app` (nunca en producción). Cuentas ficticias. Usa la pantalla como una persona, sin consola ni código. Para en la primera diferencia y cuéntamela con el texto exacto. Si un botón no se deja pulsar con el ratón, usa el teclado y dímelo. «Esperar 30 segundos» es esperar de verdad sin tocar nada. «Borrar los datos del sitio» = borrar cookies, almacenamiento local y de sesión y bases IndexedDB del sitio, y recargar con Ctrl+Shift+R; dime cada vez que lo hagas. Al pulsar «Guardar producto» pulsa UNA sola vez y espera 10 segundos antes de tocar nada más; si la pantalla se queda en blanco, espera y comprueba que el producto aparece, sin volver a pulsar.
>
> 0. Borra los datos del sitio ahora (antes de empezar).
> 1. Inicia sesión como `duena.f4.1@qa.invalid` / `ClaveNueva2026F4`. Anota si ves aviso rojo, «Guardado: cambios sin confirmar: N» o «N colecciones solo en este equipo» (texto y número exactos). Ve a «Productos» → «Nuevo producto». Rellena: nombre `Café F4-2b`, costo (Costo UNIDAD sin IVA, p. ej. 2), stock mínimo (p. ej. 1) y deja VACÍO el precio de venta. Guarda UNA vez. Debe aparecer en la lista. Espera 30 segundos y mira otra vez los avisos y «cambios sin confirmar» (¿llegó a 0?). Cierra sesión.
> 2. En la misma ventana (sin borrar nada) inicia sesión como `duena.f4.2@qa.invalid` / `ClaveNueva2026F4`. Anota el aviso «N colecciones solo en este equipo» si sale. En «Productos» **NO debe aparecer `Café F4-2b`** (puede aparecer `Harina F4-2` de la ronda anterior solo si sigue en el almacenamiento local de esa cuenta: dímelo). Crea `Harina F4-2b` igual (costo 2, stock mínimo 1, sin precio de venta), guarda UNA vez, espera 30 segundos, anota avisos y «cambios sin confirmar». Cierra sesión.
> 3. Borra los datos del sitio. Inicia sesión como `duena.f4.1`: en «Productos» debe verse `Café F4-2b` y NO `Harina F4-2b`. Cierra sesión. Borra los datos del sitio otra vez e inicia sesión como `duena.f4.2`: debe verse `Harina F4-2b` y NO `Café F4-2b`. Cierra sesión.
> 4. Entra como `owner.a@qa.invalid` (panel «Plataforma») y crea la empresa `QA F4 Cliente 3`, local `Local F4-3`, dueño `Dueña F4-3`, correo `duena.f4.3@qa.invalid`, con la contraseña inicial propuesta (apúntala). Cierra la sesión del panel. Borra los datos del sitio. Entra como `duena.f4.3@qa.invalid` con esa contraseña, elige `ClaveNueva2026F4` (espera 30 s antes), y crea el producto `Azúcar F4-3` (costo 2, stock mínimo 1, sin precio de venta). Espera 30 segundos, anota avisos y «cambios sin confirmar». Cierra sesión, borra los datos del sitio, vuelve a entrar como `duena.f4.3`: debe verse `Azúcar F4-3`.
> 5. Entra como `owner.a@qa.invalid`, «Abrir mi aplicación» (espera 30 s) y mira «Productos»: debe verse el catálogo de `QA Empresa A` y NINGUNO de los productos de las empresas F4. Pulsa «← Plataforma» y cierra sesión.
>
> Al terminar dime: (1) qué pasos fueron como se describe; (2) los distintos, con el texto exacto; (3) cada aviso rojo, «cambios sin confirmar» distinto de 0 o «colecciones solo en este equipo», con el número y el paso; (4) la contraseña inicial de `duena.f4.3`.

## Resultado esperado
| Paso | Esperado |
|---|---|
| 1 | `Café F4-2b` guardado sin aviso rojo y **sin** «colecciones solo en este equipo»; «cambios sin confirmar» llega a 0 |
| 2 | Sin `Café F4-2b`; `Harina F4-2b` se guarda; **sin** aviso de colecciones solo en este equipo (navegador limpio) |
| 3 | Cada empresa recupera solo su producto desde la nube |
| 4 | La empresa nueva guarda y recupera `Azúcar F4-3` |
| 5 | La administradora, en `QA-EMP-A`, no ve ningún producto de F4 |

Después, Claude comprueba en QA (solo lectura) que cada empresa tiene su fila `productos` con su producto y que no hay mezcla.
