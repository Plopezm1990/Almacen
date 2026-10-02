# F5 — guía para probar P1 y P3 en el preview privado de QA

Fecha: 2026-10-02
Autorización: «Autorizo el deploy agrupado para probar P1 y P3» (Pedro, 2/10/2026).
Estado: `PREVIEW_118_RECONSTRUIDO_CON_PUENTE_V2_PENDIENTE_DE_PRUEBA_EN_PANTALLA`

> **Aviso (actualización del mismo día).** El PR 118 se reconstruyó con el puente **v2**
> (`F5_P3_CATALOGO_AUTORITATIVO_2026-10-02.md`, «Corrección del puente» y «Despliegue no pedido»):
> no estaba previsto desplegarlo, pero es solo QA. Para probar la v2 abre **otra ventana privada**
> (la caché del navegador puede servir el puente antiguo) en la dirección del **PR 118**
> (`deploy-preview-118--…`), no la del 117. Esperado tras cambiar el Agua a 1,00: **un solo envío de
> 1 producto** en `abc_operaciones` (lo comprobaré yo). El cartel rojo «No se pudo actualizar el
> producto» es un defecto previo e independiente de P1 y P3: el cambio sí se guarda.

## Qué se despliega y qué no

- **Un solo preview agrupado** de la rama `claude/vigilant-hawking-uji8l4` con **P1** (avisos de
  guardado: las colecciones que el servidor rechaza por permisos dejan de aparecer como
  «Subiendo N…») y **P3** (los cambios de productos de la pantalla llegan al catálogo del TPV).
- Se publica como **Deploy Preview de un PR en borrador «NO FUSIONAR»**. Es el único tipo de
  despliegue que el programa reconoce como QA: la dirección `deploy-preview-N--chic-entremet-9107cf…`
  usa la base de datos de **QA**. Una dirección de rama normal usaría **producción**, por eso
  no se usa.
- **No se toca producción:** el PR no se fusiona, `release` no cambia y no hay publicación
  productiva. No hay cobros reales ni datos reales.
- La migración de P3 ya está aplicada en QA desde antes; este preview solo añade el código de
  pantalla.
- Coste: un Deploy Preview no consume créditos de despliegue en los planes por créditos (según
  la documentación citada en el plan, §5); el plan real de la cuenta no se ha verificado.

## Cómo entrar

1. Abre una **ventana privada** (así no arrastras la cola de guardados antigua del navegador).
2. Entra en la dirección del preview que te doy en el chat (también está en el PR). Si Netlify
   pide acceso, es la protección del equipo: entra con tu cuenta de Netlify.
3. Inicia sesión con tu usuario de **QA** (Propietario) y elige **Local A1**.

## Prueba 1 — P1: el aviso de guardado

1. Cambia el **tema oscuro/claro** (en QA el servidor rechaza esa preferencia).
2. Mira el indicador de guardado: **antes** decía «Subiendo N…» sin fin; **ahora** debe decir
   algo como «1 colección solo en este equipo (el servidor no permite guardarla)».
3. Recarga: el aviso no debe volver a subir el contador de «Subiendo».

## Prueba 2 — P3: de la pantalla al catálogo del TPV

1. Entra en productos y cambia el precio de venta de **«Agua 50 cl (QA)»** de 0,99 € a **1,00 €**
   (el precio es CON IVA). Guarda.
2. Espera unos 5 segundos. Esto envía solo ese producto al servidor.
3. Abre la consola del navegador (la misma que usaste antes), pega esta línea y pulsa Enter:

   ```
   copy(JSON.stringify({host: location.host, puente: typeof window.__catalogoTpv, pendientes: window.__catalogoTpv && window.__catalogoTpv.pendientes(), soloLocal: window.__clavesSoloLocal && [...window.__clavesSoloLocal()], aviso: (document.getElementById("estado-guardado")||{}).textContent}))
   ```
4. Pega el resultado en el chat. Esperado: `puente` = `"object"`, `pendientes` = `{}`
   (nada atascado) y ningún aviso que empiece por «[catálogo TPV]» en la consola.
5. Dime que lo has hecho: yo compruebo en QA (solo lectura) que el catálogo de `Agua 50 cl (QA)`
   pasó a precio con IVA 1,00 € y versión nueva.
6. Opcional, en el TPV con Local A1: añade 3 aguas; el total debe ser **3,00 €**. No hace falta
   cobrar.
7. Para dejarlo como estaba, vuelve a poner el precio en 0,99 €.

## Cómo saber si el preview es el correcto

- Si `puente` sale `"undefined"`, estás viendo una versión sin P3 (caché antigua o la dirección
  equivocada): recarga sin caché o abre otra ventana privada.
- Si `host` no empieza por `deploy-preview-`, **no sigas**: no es el preview de QA.

## Qué no cubre esta prueba

- Dos dispositivos a la vez: el camino de vuelta del catálogo (P3b) no existe todavía.
- Cobros, devoluciones, cierre y documentos.
- Roles distintos del Propietario (un Camarero que edite productos recibiría un aviso en la
  consola y el cambio quedaría solo en la pantalla).
