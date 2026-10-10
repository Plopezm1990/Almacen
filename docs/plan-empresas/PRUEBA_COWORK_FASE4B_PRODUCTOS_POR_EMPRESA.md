# Fase 4b · Prueba con la pantalla (Cowork): lista de productos por empresa

Solo QA (`qjqorixtkilwsndqayyx`, vista previa `deploy-preview-118--chic-entremet-9107cf.netlify.app`, que ya lleva P3c y la Fase 4). Cuentas ficticias `@qa.invalid`. **No tocar producción.**
Qué se comprueba: con P3c + F4 + F4b, la lista de productos de cada empresa se guarda en la nube, no se mezcla y se recupera desde «otro equipo». Se reutilizan `duena.f4.1` y `duena.f4.2` (contraseña `ClaveNueva2026F4`, lista rellenada por F4b) y se crea una tercera empresa para comprobar el alta nueva.

## Texto para pegar en Cowork

> Eres Cowork. Haz SOLO estas comprobaciones en la vista previa de QA `https://deploy-preview-118--chic-entremet-9107cf.netlify.app` (nunca en producción). Cuentas ficticias. Usa la pantalla como una persona, sin consola ni código. Para en la primera diferencia y cuéntamela con el texto exacto. Antes de empezar recarga con Ctrl+Shift+R. Si un botón no se deja pulsar con el ratón, usa el teclado y dímelo. «Esperar 30 segundos» es esperar de verdad sin tocar nada. Para simular «otro equipo» borra todos los datos del sitio (cookies, almacenamiento local) entre ventanas, como hiciste antes, y dímelo en cada cambio.
>
> 1. Inicia sesión como `duena.f4.1@qa.invalid` / `ClaveNueva2026F4`. Anota si ves aviso rojo, «Guardado: cambios sin confirmar: N» o «N colecciones solo en este equipo» (texto y número exactos). Ve a «Productos» → «Nuevo producto». Rellena SOLO lo obligatorio: nombre `Café F4-1`, y lo mínimo que pida (unidad, coste/IVA de compra, etc.). **Deja VACÍO el precio de venta.** Si te exige un proveedor u otro dato que la empresa no tiene, dímelo (qué te pidió) y para. Guarda. Debe aparecer en la lista. Espera 30 segundos y mira otra vez los avisos y «cambios sin confirmar» (¿llegó a 0?). Cierra sesión.
> 2. En la misma ventana inicia sesión como `duena.f4.2@qa.invalid` / `ClaveNueva2026F4`. En «Productos» **NO debe aparecer `Café F4-1`**. Crea `Harina F4-2` igual (sin precio de venta), espera 30 segundos, anota avisos y «cambios sin confirmar». Cierra sesión.
> 3. Borra los datos del sitio (otro equipo). Inicia sesión como `duena.f4.1`: en «Productos» debe verse `Café F4-1` y NO `Harina F4-2`. Cierra sesión. Borra los datos del sitio otra vez e inicia sesión como `duena.f4.2`: debe verse `Harina F4-2` y NO `Café F4-1`. Cierra sesión.
> 4. Entra como `owner.a@qa.invalid` (panel «Plataforma») y crea la empresa `QA F4 Cliente 3`, local `Local F4-3`, dueño `Dueña F4-3`, correo `duena.f4.3@qa.invalid`, con la contraseña inicial propuesta (apúntala). Cierra la sesión del panel. Borra los datos del sitio. Entra como `duena.f4.3@qa.invalid` con esa contraseña, elige `ClaveNueva2026F4` (espera 30 s antes), y crea el producto `Azúcar F4-3` (sin precio de venta). Espera 30 segundos, anota avisos y «cambios sin confirmar». Cierra sesión, borra los datos del sitio, vuelve a entrar como `duena.f4.3`: debe verse `Azúcar F4-3`.
> 5. Entra como `owner.a@qa.invalid`, «Abrir mi aplicación» (espera 30 s) y mira «Productos»: debe verse el catálogo de `QA Empresa A` y NO `Café F4-1`, `Harina F4-2` ni `Azúcar F4-3`. Pulsa «← Plataforma» y cierra sesión.
>
> Al terminar dime: (1) qué pasos fueron como se describe; (2) los distintos, con el texto exacto; (3) cada aviso rojo, «cambios sin confirmar» distinto de 0 o «colecciones solo en este equipo», con el número y el paso; (4) qué campos fueron obligatorios al crear un producto; (5) la contraseña inicial de `duena.f4.3`.

## Resultado esperado
| Paso | Esperado |
|---|---|
| 1 | Producto guardado sin aviso rojo; «cambios sin confirmar» llega a 0 |
| 2 | La lista de la empresa 2 sale vacía al entrar; `Harina F4-2` se guarda |
| 3 | Cada empresa recupera solo su producto desde la nube |
| 4 | La empresa nueva guarda y recupera `Azúcar F4-3` |
| 5 | La administradora, en `QA-EMP-A`, no ve ninguno de los tres |

Después, Claude comprueba en QA (solo lectura) que cada empresa tiene su fila `productos` con su producto y que no hay mezcla.
