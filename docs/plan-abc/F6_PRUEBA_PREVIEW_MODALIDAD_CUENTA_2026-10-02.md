# F6 · 6e — guía para probar la modalidad al abrir cuenta en el preview privado de QA

Fecha: 2026-10-02
Autorización: «6e: modalidad al abrir cuenta» y decisiones A (automática y selector) y B (todas las habilitadas), Pedro, 2/10/2026. **Solo QA.**
Informe: `F6_PIEZA6E_MODALIDAD_AL_ABRIR_CUENTA_RESULTADO_2026-10-02.md`.

## Antes de empezar

- Entra por la dirección del **PR 118** (`deploy-preview-118--…`) en una **ventana privada nueva** (la caché del navegador puede servir la versión anterior) y con tu usuario de **QA** (Propietario), **Local A1**.
  Si la dirección no empieza por `deploy-preview-`, **no sigas**. Espera a que yo te diga que el preview ya lleva esta pieza.
- Necesitas la **caja de A1 abierta** (pestaña Cocina → «Abrir sesión de caja», fondo 0). Si hiciste antes la prueba del cierre de caja y terminaste con la caja cerrada, ábrela de nuevo.
- Todo lo que guardes **se guarda de verdad en QA** (con auditoría). **Al terminar hay que cancelar los pedidos de prueba** (ver el final) y **volver a habilitar Barra**.

## Prueba 1 — Selector con todo habilitado (estado normal)

1. Pestaña **TPV** (venta), Local A1. Con el carrito **vacío** no debe verse «Tipo de cuenta».
2. Añade **1 Agua** (o cualquier producto con precio). Encima de «Guardar pedido» debe aparecer **«Tipo de cuenta»** con cinco botones: **Barra** (marcado), Mesa, Terraza, Para llevar, Otro.
3. Pulsa **Para llevar**: se marca ese y se desmarca Barra.
4. Pulsa **Guardar pedido**. La confirmación debe decir **«Cuenta … · Pedido … · Modalidad: Para llevar»**.
5. Cierra la confirmación. **Cancela el pedido** desde el panel del pedido: escribe el motivo «prueba 6e» y pulsa «Cancelar pedido».

## Prueba 2 — Barra deshabilitada (lo que antes bloqueaba el TPV)

1. Menú **Sistema → Configuración → Modalidades** (local A1). Ahora **Barra se puede desmarcar** (ya no sale el aviso de «el TPV abre siempre en Barra»). Desmárcala y deja las demás.
2. Escribe un motivo («prueba 6e»), pulsa **Guardar modalidades** y comprueba que lo confirma.
3. Vuelve al **TPV** (recarga la página si quieres) y añade 1 Agua. El selector debe ofrecer **Mesa, Terraza, Para llevar y Otro** (sin Barra), con **Mesa** marcada.
4. Pulsa **Guardar pedido**: debe guardarse sin error y decir **«Modalidad: Mesa»**. (Antes de esta pieza, con Barra deshabilitada «Guardar pedido» no podía abrir ninguna cuenta.)
5. **Cancela este pedido** como en la prueba 1.

## Prueba 3 — Volver al estado normal

1. **Sistema → Configuración → Modalidades**: vuelve a marcar **Barra**, motivo «prueba 6e», **Guardar modalidades**.
2. En el TPV, con 1 Agua en el carrito, vuelven a verse las cinco modalidades con Barra marcada. **Vacía el carrito** («Vaciar carrito») sin guardar.

## Prueba 4 (opcional, avanzada) — La modalidad cambia mientras tanto

Necesita **dos pestañas** del mismo preview, ambas en Local A1.
1. Pestaña A (TPV): añade 1 Agua y elige **Mesa**, **sin guardar**.
2. Pestaña B (Sistema → Configuración → Modalidades): desmarca **Mesa** y guarda (motivo «prueba 6e»).
3. Pestaña A: pulsa **Guardar pedido**. Debe aparecer, **dentro del carrito y en rojo**, «La modalidad «Mesa» no está habilitada en este local. Elige otra o pide al Propietario que la habilite en Configuración.»,
   el selector ya **no ofrece Mesa** y vuelve a estar marcada Barra. No se crea ninguna cuenta. Pulsa de nuevo «Guardar pedido»: se guarda en Barra.
4. Cancela ese pedido y en la pestaña B **vuelve a marcar Mesa** y guarda.

## Al terminar

- **Cancela todos los pedidos de prueba** (botón «Cancelar pedido», motivo obligatorio). La cuenta puede quedar abierta y vacía: no hace falta hacer nada más, **yo reviso en QA** (solo lectura) qué ha quedado y te lo digo.
- Comprueba que **las cinco modalidades están habilitadas** en Sistema → Configuración → Modalidades.

## Qué debes avisarme

Dime «hecho» (y cualquier cosa rara: el selector no aparece, aparece con el carrito vacío, un cartel rojo que no entiendas, un botón que no responde, la confirmación sin «Modalidad: …»). Yo compruebo en QA, **solo lectura**:
las cuentas de prueba con su modalidad (`cuentas_comerciales.modalidad`), los cambios de modalidades con su motivo y auditoría, y que al final las cinco estén habilitadas.

## Qué no cubre esta prueba

- Un **Cajero/a** (no hay otro usuario de QA): está cubierto por las pruebas automáticas.
- Asignar una cuenta a una **mesa o terraza** desde la sala (fija Mesa o Terraza según la zona; ya probado en la pieza 3): aquí solo se prueba abrir la cuenta.
- Cobros reales, devoluciones y producción.
