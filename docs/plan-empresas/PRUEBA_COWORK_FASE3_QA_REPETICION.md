# Repetición de la prueba de la Fase 3 en QA con Cowork (solo lo que cambió)

Solo QA (`qjqorixtkilwsndqayyx`, vista previa `deploy-preview-118--chic-entremet-9107cf.netlify.app`). Cuentas ficticias `@qa.invalid`. **No tocar producción.**
Motivo: la primera prueba (ver `FASE3_RESULTADO_QA_2026-10-09.md`) encontró un aviso falso «Un cambio no se ha podido guardar (locales)» tras elegir la contraseña inicial y al abrir «mi aplicación» desde el panel. Claude lo corrigió (ahora la página se recarga en esos cambios) y hay que comprobarlo con la pantalla.
**Resultado de esta repetición (parcial, ver `FASE3_RESULTADO_QA_2026-10-09.md`):** Cowork se paró en el paso 3: el aviso rojo seguía saliendo y aparecieron dos «Local recuperado». La causa es que la copia local del navegador se hereda entre cuentas (hueco de la Fase 4). Para repetir este guion y evitar esa interferencia hay que **empezar cada cuenta con los datos del sitio borrados** (o con un navegador distinto), o esperar a que el primer paso de la Fase 4 esté hecho.
Estado de QA: `owner.a@qa.invalid` es administradora y dueña de `QA-EMP-A`; el plazo de gracia de borrado está en **30 días**.

## Texto para pegar en Cowork

> Eres Cowork. Repite SOLO estas comprobaciones en la vista previa de QA `https://deploy-preview-118--chic-entremet-9107cf.netlify.app` (nunca en producción). Cuentas ficticias. Usa la pantalla como una persona, sin consola ni código. Para en la primera diferencia y cuéntamela con el texto exacto de lo que ves. Antes de empezar, recarga la página con Ctrl+Shift+R (o borra la caché) para asegurarte de tener la versión nueva. Si algún botón no se deja pulsar con el ratón, comprueba si la barra de Netlify de la vista previa lo tapa (puedes minimizarla) o usa el teclado, y dímelo.
>
> 1. Inicia sesión como `owner.a@qa.invalid`. Debe aparecer el panel «Plataforma».
> 2. Pulsa «+ Dar de alta una empresa» y crea: empresa `QA F3 Cliente 3` (escríbela UNA sola vez), local `Local F3`, dueño `Dueña Prueba F3`, correo `duena.f3.4@qa.invalid`, con la contraseña inicial propuesta. **Apúntala.** Comprueba que el nombre en la lista es exactamente `QA F3 Cliente 3`.
> 3. En una ventana de incógnito (o navegador distinto) inicia sesión como `duena.f3.4@qa.invalid` con esa contraseña inicial. Debe salir «Elige tu contraseña». **Espera 30 segundos sin tocar nada** y después pon `ClaveNueva2026F3` en las dos casillas. La página debe recargarse sola y entrar al programa (empresa «QA F3 Cliente 3»).
> 4. En esa pantalla del programa: ¿aparece algún aviso rojo («Un cambio no se ha podido guardar…») o en el panel de inicio algún «Guardado: cambios sin confirmar» / «algo no se ha podido guardar»? **No debería.** Dime exactamente qué ves. Ve a «Empresas y locales»: debe verse «Las empresas las da de alta el administrador de la plataforma.» y ningún «+ Añadir empresa». Cierra sesión.
> 5. Vuelve a la ventana del administrador (panel «Plataforma»). **Espera 30 segundos** y pulsa «Abrir mi aplicación». La página debe recargarse y abrir el programa (empresa `QA-EMP-A`). ¿Aparece algún aviso rojo o «cambios sin confirmar»? **No debería.**
> 6. Con la aplicación abierta debe verse un botoncito «← Plataforma». Dime dónde está (esquina y si tapa algo de la barra inferior en una ventana estrecha de unos 390 px). Púlsalo: la página se recarga y debe volver al panel.
> 7. En el panel, desactiva «QA F3 Cliente 3» (motivo `Repetición F3`, con tu contraseña de administrador) y pulsa «Eliminar para siempre…». Debe decir que todavía no ha pasado el **plazo de gracia de 30 días** con una fecha a partir de la cual se podrá borrar (30 días desde hoy), y no debe haber formulario. Cierra el diálogo y pulsa «Reactivar» → «Reactivar empresa»: vuelve a «Activa».
> 8. Pulsa «Cerrar sesión» en el panel: la página se recarga y debe aparecer la pantalla de acceso.
>
> Al terminar dime: (1) qué pasos fueron como se describe, (2) los que fueron distintos, con el texto exacto, (3) si viste algún aviso rojo en algún momento y cuándo, (4) la contraseña inicial que apuntaste.

## Resultado esperado
| Paso | Esperado |
|---|---|
| 2 | Empresa `QA F3 Cliente 3` (nombre sin repetir) con su dueña |
| 3 | «Elige tu contraseña»; tras 30 s y la contraseña buena, recarga sola y entra |
| 4 | **Sin** aviso rojo ni «cambios sin confirmar»; sin «+ Añadir empresa» |
| 5 | Recarga y abre el programa; **sin** aviso rojo ni «cambios sin confirmar» |
| 6 | «← Plataforma» visible, sin tapar la barra inferior; al pulsarlo vuelve al panel |
| 7 | Plazo de gracia de 30 días con fecha; sin formulario; «Reactivar» la deja «Activa» |
| 8 | Cerrar sesión → pantalla de acceso |
