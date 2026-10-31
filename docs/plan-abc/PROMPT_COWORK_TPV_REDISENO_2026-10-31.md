# TPV · rediseño (fases 1-4 + categorías) — guion para que Cowork lo pruebe en el preview de QA

Fecha: 2026-10-31
Rama: `ccr-e0f72ee0-mfjorr`. **Solo QA.** Producción no se toca.

## Antes de pegarle nada a Cowork

1. **Hace falta un preview.** Esta rama todavía no tiene PR, así que no hay
   dirección `deploy-preview-NNN--`. Abre el PR, espera a que Netlify publique el
   preview y sustituye `NNN` en el guion por su número.
2. **Las dos migraciones ya están aplicadas en QA** (`20261031120000` y
   `20261031150000`). El preview apunta a QA, así que el editor de categorías
   funcionará. No hace falta tocar la base de datos.
3. Entra tú en el preview con el usuario de QA (**Propietario**, local **QA-A1**)
   y deja la sesión abierta. Cowork usa tu sesión.
4. Para el paso 6 hace falta un empleado con cargo **Camarero/a** en QA-A1. Si no
   existe, Cowork lo anotará y saltará ese paso; créalo antes si quieres cubrirlo.

Los textos entre « » son los que la aplicación debe mostrar. Si un texto difiere
pero el comportamiento es el mismo, que lo anote y siga.

---

```
Eres un agente de pruebas. Vas a probar en el navegador la pantalla de TPV de una aplicación de restaurante, SOLO en el entorno de pruebas (QA). Sigue el guion en orden. Al final cuéntame, paso a paso, qué viste.

REGLAS DE SEGURIDAD (obligatorias)
- Trabaja SOLO en la dirección de la vista previa del PR NNN, que empieza por «deploy-preview-NNN--». Si la dirección NO empieza por «deploy-preview-», PARA y dímelo.
- Usa mi sesión ya iniciada (usuario de QA, Propietario, local QA-A1). No cierres sesión ni cambies de local salvo donde el guion lo pida.
- Todo lo que hagas se guarda de verdad en QA. Haz SOLO lo que dice el guion.
- NO pulses nada que diga «Cerrar caja», «Iniciar cierre» ni «Finalizar cierre». NO uses tarjeta en ningún cobro. No toques empleados, productos ni precios salvo donde se indique.
- Si aparece un error que el guion no prevé, o un botón del guion no existe, PARA en ese paso, no improvises, y dime exactamente qué ves (texto literal).
- Si un texto es un poco distinto de lo previsto pero el comportamiento es el mismo, anótalo («texto distinto: …») y sigue.
- Haz una captura en cada paso que empiece por FOTO.
- Usa «prueba rediseño TPV» en cualquier campo de motivo.

PASO 0 · Confirmar que es la versión nueva
0.1 Menú lateral → «TPV».
0.2 Arriba a la derecha deben verse los botones «Modo caja», «F2 Buscar», «F4 Vaciar» y «F9 Guardar», y un botón de tema que dice «🌙 Oscuro» o «☀️ Claro».
0.3 Debajo debe haber una fila con un botón «Categorías».
    Si NO ves «Modo caja» ni «Categorías», es la versión antigua: PARA y dime que espere o abra una ventana privada.
0.4 FOTO de la pantalla completa del TPV.

PASO 1 · Que los productos se vean sin bajar (fase 1)
1.1 Sin tocar nada más, mira la pantalla: debajo de las barras de arriba tiene que verse YA la rejilla de productos y, a la derecha, el ticket. No deberías tener que bajar para ver un producto.
1.2 Comprueba que NO aparece ningún texto con códigos internos tipo «A02», «A04», «A05», «B04», «B05», «Stack aplicado» ni estados en mayúsculas con guion bajo como «EN_PREPARACION».
1.3 Anota cuántos productos cuentas sin bajar.
1.4 FOTO.

PASO 2 · Vender y ver el ticket por bloques (fases 1 y 2)
2.1 En la barra «Cantidad», pulsa «×2». Luego pulsa UN producto cualquiera. Debe añadirse con cantidad 2, y la barra debe volver sola a «×1». Anótalo: es importante que vuelva a ×1.
2.2 Añade 2 o 3 productos más pulsándolos normalmente, hasta un total de 5 € o más. Apunta el TOTAL exacto (lo llamaremos T).
2.3 En el ticket de la derecha pulsa «Guardar pedido €T». Debe salir una ventana «Pedido guardado». Lee el texto: NO debe mencionar «A02», «A04» ni «A05». Pulsa «Enviar pedido» y luego «Aceptar».
2.4 Ahora el ticket debe mostrar DOS bloques: arriba «Ya enviado a cocina» con las líneas y su estado en castellano («Enviada a cocina», «En preparación»…), y debajo lo nuevo si añades algo.
2.5 FOTO del ticket con los dos bloques.

PASO 3 · Teclas y paneles (fases 1, 2 y 3)
3.1 Pulsa la tecla F3 del teclado. Debe abrirse la ventana «Mesa y sala» con un plano de mesas de colores y una leyenda (Libre, Ocupada, Reservada, Bloqueada, Fuera de servicio). FOTO. Ciérrala.
3.2 Pulsa F8. Debe abrirse «Cobro de la cuenta». FOTO. Ciérrala.
3.3 Pulsa F2. El cursor debe ir al buscador de productos.
3.4 Comprueba que los botones de esa fila muestran su tecla: «Mesa y sala · F3» y «Cobro · F8».

PASO 4 · La ventana de cobro (fase 3)
4.1 Abre «Cobro de la cuenta» (F8 o el botón).
4.2 Debe verse: «A cobrar» con el importe en grande, «Efectivo recibido (€)», una fila de billetes («Exacto» y varios importes), un teclado numérico y, al teclear, «Cambio a devolver» en grande.
4.3 Pulsa el billete más cercano por encima del total. El «Cambio a devolver» debe calcularse solo y ser correcto. Anota el importe que pone.
4.4 Teclea con el teclado de pantalla un importe MENOR que el total. Debe cambiar a «Faltan …» en rojo y el botón de cobrar debe quedar deshabilitado. Anótalo.
4.5 Vuelve a pulsar «Exacto». Pulsa «Cobrar efectivo». Debe confirmarse el cobro.
4.6 FOTO antes y después de cobrar.

PASO 5 · Categorías: guardar orden y color (lo nuevo)
5.1 En la fila de botones, pulsa «Categorías». Debe abrirse «Orden y color de categorías» con la lista, flechas ▲▼ y una paleta de colores por fila.
5.2 Apunta el orden actual de las 3 primeras categorías.
5.3 Baja la primera categoría dos posiciones con ▼. Cambia el color de otra categoría a uno claramente distinto. Pulsa «Guardar para todo el local».
5.4 La ventana debe cerrarse y el carril de categorías de la izquierda debe mostrar YA el nuevo orden y el nuevo color. La franja de color de las tarjetas de producto de esa categoría debe cambiar a juego.
5.5 FOTO del carril después de guardar.
5.6 Recarga la página (F5) y comprueba que el orden y el color se mantienen.

PASO 6 · Categorías: el conflicto entre dos terminales (ESTE ES EL IMPORTANTE)
6.1 Abre una SEGUNDA pestaña en la misma dirección del preview, con el mismo local.
6.2 En las DOS pestañas, abre «Categorías».
6.3 En la pestaña 1: cambia un color y pulsa «Guardar para todo el local». Debe guardar bien.
6.4 En la pestaña 2, SIN recargar: cambia otro color distinto y pulsa «Guardar para todo el local».
6.5 La pestaña 2 debe AVISAR de que «otra persona cambió las categorías mientras editabas» y recargar la lista. NO debe guardar.
6.6 Cierra la pestaña 2, recarga la pestaña 1 y comprueba que lo que quedó guardado es lo de la pestaña 1, NO lo de la 2. Esto es lo que demuestra que no se pisan entre terminales.
6.7 FOTO del aviso y del resultado final.

PASO 7 · Categorías: el permiso
7.1 Cambia a un empleado con cargo «Camarero/a» (menú de usuario → entrar como empleado). Si no hay ninguno, anótalo y salta al paso 8.
7.2 Entra en el TPV. El botón «Categorías» NO debe aparecer.
7.3 Vuelve a tu usuario Propietario y comprueba que el botón «Categorías» vuelve a aparecer.
7.4 Anota si en algún momento viste el botón con el Camarero/a.

PASO 8 · Modo caja y tema oscuro (fases 2 y 4)
8.1 Pulsa «Modo caja». El menú lateral izquierdo debe desaparecer y el TPV ocupar toda la pantalla. Cuenta cuántos productos ves ahora sin bajar y compáralo con el paso 1.3.
8.2 Pulsa el botón de tema («🌙 Oscuro»). Toda la pantalla debe pasar a oscuro y TODO debe seguir leyéndose: carril de categorías, tarjetas, ticket y botones. Mira con atención si algún texto queda ilegible.
8.3 Abre «Mesa y sala» y «Cobro» en oscuro y comprueba que también se leen bien. FOTO de cada uno.
8.4 Vuelve a tema claro. Pulsa «Salir del modo caja»: el menú lateral debe volver.
8.5 Ve a otra pantalla cualquiera del menú y vuelve al TPV: comprueba que el menú lateral sigue estando (el modo caja no debe dejar la aplicación sin menú).

PASO 9 · Móvil
9.1 Reduce la ventana del navegador a ancho de móvil (unos 390 px) o usa la vista de móvil del navegador.
9.2 En el TPV con líneas sin enviar, abajo debe aparecer una barra fija con las unidades, el total y los botones «Ver ticket» y «Guardar». Puede que tengas que bajar un poco primero.
9.3 Pulsa «Ver ticket»: debe llevarte al ticket.
9.4 FOTO.

AL TERMINAR
Dime, paso a paso: qué funcionó, qué texto viste distinto, y cualquier cosa que te pareciera rara aunque no estuviera en el guion. Si algo falló, dime el texto literal del error y en qué paso.
```

## Qué mira cada paso

| Paso | Qué valida | Fase |
|---|---|---|
| 1 | Los productos y el ticket se ven sin bajar; nada de jerga interna | 1 |
| 2 | Multiplicador que vuelve a ×1; ticket por bloques; textos en castellano | 1 y 2 |
| 3 | Atajos F2, F3 y F8; teclas visibles en los botones | 1, 2 y 3 |
| 4 | Billetes, teclado, cambio, y que «Faltan» bloquee el cobro | 3 |
| 5 | El orden y el color se guardan y se aplican al carril y a las tarjetas | Categorías |
| 6 | El bloqueo optimista entre dos terminales **no pisa** lo del otro | Categorías |
| 7 | El botón solo aparece a quien tiene `ABC_SALA_CONFIGURAR` | Categorías |
| 8 | Modo caja, vuelta atrás y tema oscuro en todo lo nuevo | 2 y 4 |
| 9 | Barra inferior del comandero | 4 |

El paso 6 es el que no se puede probar de otra forma: el servidor ya está
verificado, pero que la pantalla explique bien el conflicto y recargue solo se ve
con dos terminales reales.
