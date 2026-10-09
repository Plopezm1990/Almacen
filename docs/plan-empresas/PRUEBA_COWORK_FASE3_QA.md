# Prueba de la Fase 3 en QA con Cowork (panel de Plataforma y contraseña inicial del dueño)

Solo QA (`qjqorixtkilwsndqayyx`, vista previa `deploy-preview-118--chic-entremet-9107cf.netlify.app`). Cuentas ficticias `@qa.invalid`. **No tocar producción.**
Preparado por Claude el 9/10/2026. Código probado: commit `bbd057f` (vista previa publicada). Estado de QA para la prueba: `owner.a@qa.invalid` es administradora de la plataforma y además dueña de `QA-EMP-A`; el plazo de gracia de borrado está puesto a **0 días solo durante esta prueba** (Claude lo vuelve a poner en 30 al recibir el resultado); la función `plataforma-crear-propietario` (versión 1) está desplegada.

Aviso conocido (no es un fallo de esta fase): hasta la Fase 4 (aislamiento de datos por empresa) algunas colecciones del programa son comunes a todas las empresas, así que dentro del programa de una dueña nueva puede verse información de otras empresas de pruebas o algún aviso de «colección solo en este equipo». Anótalo si lo ves, sin intentar nada.

Esta prueba se hace **con la pantalla** (no con código en la consola): Cowork usa el programa como lo usaría Pedro.

## Texto para pegar en Cowork

> Eres Cowork. Haz esta prueba SOLO en la vista previa de QA `https://deploy-preview-118--chic-entremet-9107cf.netlify.app` (nunca en producción `chic-entremet-9107cf.netlify.app` sin «deploy-preview»). Es una prueba con cuentas ficticias. Usa la pantalla como una persona: no abras la consola ni ejecutes código. Para en la primera diferencia, cuéntamela con lo que ves en pantalla (texto exacto de los mensajes) y no intentes arreglar nada. Si puedes, haz una captura en cada paso marcado con 📷.
>
> **Parte A — el administrador (ventana normal)**
> 1. Abre la vista previa e inicia sesión como `owner.a@qa.invalid` (con su contraseña de pruebas de QA). 📷 Debe aparecer el panel **«Plataforma · L&A Suite»** (barra verde oscura arriba), NO el programa. Debe listar solo las empresas de QA (`QA-EMP-A` y `QA-EMP-B`, y las de pruebas anteriores si quedaran), con su estado, locales, usuarios y dueño. Arriba debe haber «Abrir mi aplicación», «Cerrar sesión», «Actualizar» y «+ Dar de alta una empresa».
> 2. Pulsa **«+ Dar de alta una empresa»** y prueba primero a pulsar «Crear empresa y cuenta» con todo vacío: no debe crear nada y debe señalar los campos que faltan. 📷
> 3. Rellena: empresa `QA F3 Cliente 1`, local `Local F3`, dueño `Dueña Prueba F3`, correo `duena.f3.1@qa.invalid`. Deja la contraseña inicial que viene puesta (tiene el formato `xxxx-xxxx-xxxx`). Pulsa «Crear empresa y cuenta». 📷 Debe salir «Cuenta del dueño creada» con empresa, dirección, correo y contraseña inicial, y un botón «Copiar datos». **Apunta la contraseña inicial exacta.** Pulsa «Hecho». La empresa debe aparecer en la lista como «Activa», 1 local, 1 usuario, con el correo del dueño.
> 4. Repite el alta con el MISMO correo `duena.f3.1@qa.invalid` pero otra empresa `QA F3 Cliente 2`: debe dar un error claro («Ya existe una cuenta con ese correo») y avisar de que la empresa «QA F3 Cliente 2» **ya está creada pero falta el dueño**. Cambia el correo a `duena.f3.2@qa.invalid` y pulsa el botón del diálogo («Crear solo la cuenta del dueño»): debe completarse sin crear una empresa duplicada (en la lista debe haber UNA sola «QA F3 Cliente 2»). Apunta también su contraseña inicial.
>
> **Parte B — la dueña con su contraseña inicial (ventana de incógnito o navegador distinto, para no mezclar sesiones)**
> 5. Abre la vista previa e inicia sesión como `duena.f3.1@qa.invalid` con la contraseña inicial apuntada. 📷 Debe aparecer **«Elige tu contraseña»** (primer acceso), no el programa.
> 6. Prueba contraseñas malas: una corta (`abc1`), dos que no coincidan, y una que contenga su correo (`duena.f3.1` + números). Cada una debe dar un mensaje claro y no avanzar. Prueba también la contraseña inicial otra vez como nueva: debe decir que tiene que ser distinta.
> 7. Pon una buena: `ClaveNueva2026F3` en las dos casillas. Debe entrar al programa (empresa «QA F3 Cliente 1»). 📷
> 8. Ve a **Locales** (pestaña «Empresas y locales»). En el bloque «Empresas» NO debe haber botón «+ Añadir empresa»; en su lugar debe verse el texto «Las empresas las da de alta el administrador de la plataforma.».
> 9. Cierra sesión e inicia sesión de nuevo con `ClaveNueva2026F3`: debe entrar directamente, sin volver a pedir contraseña. Cierra sesión.
>
> **Parte C — el administrador otra vez (ventana normal)**
> 10. En el panel pulsa «Actualizar»: «QA F3 Cliente 1» debe seguir activa con su dueño. Pulsa **«Desactivar»** en esa tarjeta. Escribe un motivo (`Prueba Cowork F3`) y una contraseña de administrador **incorrecta**: debe decir «La contraseña no es correcta.» y NO desactivar. 📷 Escríbela bien y confirma: la tarjeta pasa a «Desactivada» con la fecha de hoy y el motivo.
> 11. En esa tarjeta desactivada comprueba los botones: «Reactivar», «Descargar copia», «Eliminar para siempre…». Pulsa **«Descargar copia»**: debe descargarse un archivo `copia-qa-f3-cliente-1-AAAA-MM-DD.json` y aparecer un aviso verde con el número de filas y una huella. Abre el archivo y dime solo cuántas tablas tiene dentro de «datos» (no pegues su contenido).
> 12. Pulsa **«Reactivar»** y confirma: vuelve a «Activa». Vuelve a desactivarla (con la contraseña buena) para la prueba siguiente.
> 13. Pulsa **«Eliminar para siempre…»** en «QA F3 Cliente 1». 📷 Debe mostrar un aviso rojo («No se puede deshacer»), cuántas filas y cuentas se borrarían, y el formulario. Pruebas, en este orden, y NO debe avanzar en ninguna hasta la última:
>    a. Pulsa «Preparar borrado» con el nombre mal escrito (`qa f3 cliente`): debe decir que no coincide.
>    b. Con el nombre bien (`QA F3 Cliente 1`) y una contraseña de administrador mala: «La contraseña no es correcta.».
>    c. Con todo bien: debe salir un **código de 8 caracteres** (letras y números) y su hora de caducidad. 📷 Escribe un código equivocado en la casilla: debe decir que no coincide.
>    d. Escribe el código correcto y pulsa «Eliminar para siempre». Debe decir que la empresa se ha eliminado, con filas y cuentas borradas y una huella del acta. 📷
> 14. En la lista, «QA F3 Cliente 1» ya no debe aparecer. Intenta iniciar sesión (ventana de incógnito) con `duena.f3.1@qa.invalid` / `ClaveNueva2026F3`: ya no debe poder entrar.
> 15. «QA F3 Cliente 2» (la del reintento): pulsa «Añadir dueño», crea `duena.f3.3@qa.invalid` con la contraseña propuesta; debe mostrar sus credenciales y en la tarjeta deben verse dos dueños. Luego desactívala y pulsa «Eliminar para siempre…» solo para ver que, SIN copia descargada, ofrece «Descargar copia ahora» o escribir un motivo de al menos 10 caracteres. Prueba el motivo corto (`corto`): debe rechazarlo. Cierra el diálogo sin borrar nada (Cancelar).
>
> **Parte D — el administrador usando su propia aplicación**
> 16. En el panel pulsa **«Abrir mi aplicación»**: debe abrirse el programa normal (empresa `QA-EMP-A`) y aparecer abajo a la izquierda un botoncito **«← Plataforma»**. Púlsalo: debe volver al panel. Comprueba que el panel no se queda a medias ni aparece el programa debajo.
> 17. Cierra la sesión desde el panel («Cerrar sesión»): debe volver a la pantalla de acceso.
>
> **Parte E — en el móvil (o con la ventana estrecha, unos 390 px de ancho)**
> 18. Repite el paso 1 y el paso 2 con la ventana estrecha. 📷 Los botones no deben salirse de la pantalla ni taparse, y el diálogo debe poder desplazarse hasta el último botón.
>
> Al terminar dime: (1) en qué pasos todo fue como se describe, (2) los pasos donde algo fue distinto, con el texto exacto, (3) cualquier mensaje de error que viste en pantalla aunque pareciera normal, (4) las contraseñas iniciales que apuntaste (son de cuentas ficticias de QA).

## Resultado esperado (para comparar)
| Paso | Esperado |
|---|---|
| 1 | Panel de Plataforma (no el programa) con las empresas de QA |
| 2 | Formulario vacío: no se crea nada y se señalan los campos |
| 3 | Credenciales visibles una vez; empresa «Activa» con 1 usuario |
| 4 | Error por correo repetido sin duplicar la empresa; el reintento completa el dueño |
| 5–7 | «Elige tu contraseña» antes del programa; contraseñas malas rechazadas; la buena entra |
| 8 | Sin «+ Añadir empresa»; texto de que las da de alta el administrador |
| 9 | Segundo acceso directo, sin pedir contraseña |
| 10 | Contraseña de admin mala → no desactiva; buena → «Desactivada» |
| 11 | Copia descargada con nombre `copia-…json` y aviso con filas y huella |
| 12 | Reactivar devuelve «Activa» |
| 13 | Nombre mal → no; contraseña mala → no; código mal → no; todo bien → eliminada con acta |
| 14 | La empresa desaparece de la lista y su dueño ya no puede entrar |
| 15 | Dos dueños; sin copia exige copia o motivo de 10+ caracteres |
| 16 | «Abrir mi aplicación» abre el programa; «← Plataforma» vuelve al panel |
| 17 | Cerrar sesión lleva a la pantalla de acceso |
| 18 | Se ve y se usa bien en pantalla estrecha |

## Qué hace Claude después
Al recibir el resultado: comparar con la tabla, corregir lo que falle, volver a poner el plazo de gracia de QA en 30 días y dejar constancia en `FASE3_RESULTADO_QA_2026-10-09.md`.
