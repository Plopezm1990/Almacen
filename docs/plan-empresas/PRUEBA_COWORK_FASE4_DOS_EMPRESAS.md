# Fase 4 · Prueba con la pantalla (Cowork): dos empresas, mismos nombres de colección

Solo QA (`qjqorixtkilwsndqayyx`, vista previa `deploy-preview-118--chic-entremet-9107cf.netlify.app`). Cuentas ficticias `@qa.invalid`. **No tocar producción.**

Qué se comprueba: con la Fase 4 aplicada, dos empresas nuevas guardan cada una sus colecciones comunes en la nube sin verse ni pisarse, y se recuperan desde «otro equipo» (ventana nueva). Usamos «Puntos de control» (Control sanitario), que se guarda como colección común `puntosControl`.
Estado de QA: `owner.a@qa.invalid` es administradora (y dueña de `QA-EMP-A`); plazo de gracia de borrado: **30 días**.

## Texto para pegar en Cowork

> Eres Cowork. Haz SOLO estas comprobaciones en la vista previa de QA `https://deploy-preview-118--chic-entremet-9107cf.netlify.app` (nunca en producción). Cuentas ficticias. Usa la pantalla como una persona, sin consola ni código. Para en la primera diferencia y cuéntamela con el texto exacto de lo que ves. Antes de empezar recarga con Ctrl+Shift+R. Si un botón no se deja pulsar con el ratón, mira si la barra de Netlify lo tapa (puedes minimizarla) o usa el teclado, y dímelo. Cada vez que se pida «esperar 30 segundos», espera de verdad sin tocar nada.
>
> 1. Inicia sesión como `owner.a@qa.invalid` (panel «Plataforma»). Pulsa «+ Dar de alta una empresa» y crea DOS empresas, una detrás de otra, escribiendo cada nombre UNA sola vez:
>    - empresa `QA F4 Cliente 1`, local `Local F4-1`, dueño `Dueña F4-1`, correo `duena.f4.1@qa.invalid`;
>    - empresa `QA F4 Cliente 2`, local `Local F4-2`, dueño `Dueña F4-2`, correo `duena.f4.2@qa.invalid`.
>    Apunta las dos contraseñas iniciales propuestas. Comprueba en la lista los nombres exactos. Cierra la sesión del panel.
> 2. En una ventana de incógnito (ventana 1) inicia sesión como `duena.f4.1@qa.invalid` con su contraseña inicial. Sale «Elige tu contraseña»: espera 30 segundos y pon `ClaveNueva2026F4` en las dos casillas; la página se recarga sola y entra. Anota si ves algún aviso rojo, «Guardado: cambios sin confirmar» o un aviso del tipo «N colecciones solo en este equipo» (copia el texto exacto y el número). Ve a «Control sanitario» → pestaña «Puntos de control» → «Nuevo punto de control»: Nombre `Frigorífico F4-1`, deja el tipo que viene, y guarda (anota el texto del botón). Debe aparecer en la lista. Espera 30 segundos. Ve a «Empresas y locales» → «Locales»: debe haber un solo local, `Local F4-1`. Cierra sesión.
> 3. En ESA MISMA ventana inicia sesión como `duena.f4.2@qa.invalid` (contraseña inicial → espera 30 s → `ClaveNueva2026F4`). Anota otra vez avisos rojos y el aviso «N colecciones solo en este equipo». Ve a «Control sanitario» → «Puntos de control»: **NO debe aparecer `Frigorífico F4-1`** (la lista debe salir vacía). Crea `Congelador F4-2` y espera 30 segundos. En «Locales» debe haber solo `Local F4-2`. Cierra sesión.
> 4. Abre una ventana de incógnito NUEVA (ventana 2, simula otro equipo; cierra antes la 1). Inicia sesión como `duena.f4.1@qa.invalid` con `ClaveNueva2026F4`. Ve a «Control sanitario» → «Puntos de control»: debe verse `Frigorífico F4-1` y **NO** `Congelador F4-2`. Cierra sesión y cierra la ventana.
> 5. Abre otra ventana de incógnito NUEVA (ventana 3). Inicia sesión como `duena.f4.2@qa.invalid`: en «Puntos de control» debe verse `Congelador F4-2` y **NO** `Frigorífico F4-1`. Cierra sesión.
> 6. Vuelve a entrar como `owner.a@qa.invalid`: pulsa «Abrir mi aplicación» (espera 30 s) y mira «Control sanitario» → «Puntos de control»: **no debe aparecer ninguno de los dos puntos nuevos**. Pulsa «← Plataforma» y cierra la sesión.
>
> Al terminar dime: (1) qué pasos fueron como se describe; (2) los distintos, con el texto exacto; (3) cada aviso rojo o «colecciones solo en este equipo» que viste, con el número y en qué paso; (4) las dos contraseñas iniciales.

## Resultado esperado
| Paso | Esperado |
|---|---|
| 1 | Dos empresas, nombres exactos, cada una con su dueña |
| 2 | Sin aviso rojo; el aviso «N colecciones solo en este equipo» (si sale) con **N = 3** (`empresas`, `configEmpresa`, `productos`); el punto `Frigorífico F4-1` se guarda; un solo local |
| 3 | La lista de puntos sale vacía (nada de la empresa 1); `Congelador F4-2` se guarda; un solo local `Local F4-2` |
| 4 | Ventana nueva de la empresa 1: solo `Frigorífico F4-1` (viene de la nube) |
| 5 | Ventana nueva de la empresa 2: solo `Congelador F4-2` |
| 6 | La administradora, en `QA-EMP-A`, no ve ninguno de los dos |

Después, Claude comprueba en la base de QA (solo leyendo) que `puntosControl` tiene una fila por empresa con su contenido y que ninguna fila mezcla datos.
