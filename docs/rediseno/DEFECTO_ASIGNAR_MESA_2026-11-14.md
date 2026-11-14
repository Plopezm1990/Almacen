# Asignar una mesa a una cuenta no funciona, y falla en silencio

14 de noviembre de 2026. Encontrado durante el barrido de apertura del punto 1,
en el preview de QA del PR #225. **No es un defecto de esta rama: falla igual en
`release`.**

## El síntoma

En el TPV, en modo Sala, al seleccionar una mesa libre aparece el panel
«Asignar Mesa QA-A1-01» con su campo de comensales y el botón «Asignar esta
cuenta». El botón está habilitado. Al pulsarlo:

- la mesa sigue **Libre**,
- no aparece ningún mensaje de error,
- y **no sale ni una sola petición de red**.

Lo último está medido, no supuesto: instrumenté `fetch` en la página para
registrar toda llamada a `rest/v1` o `rpc`, pulsé el botón y el registro quedó
vacío.

## La causa

```js
// crearLogicaVenta, línea 12863: la función existe
async function asignarMesaCuentaA07(mesaId, comensales, expectedMesaVersion) { … }

// línea 13583: el objeto que devuelve crearLogicaVenta tiene 48 nombres.
// moverMesaCuentaA07 está. asignarMesaCuentaA07 NO.
return { venderCarrito, …, moverMesaCuentaA07, … };
```

`AppConSesion` desestructura `asignarMesaCuentaA07` de ese retorno, así que
recibe `undefined`, y se la pasa igual a `VentaRapida`. El manejador sale por su
primera guarda:

```js
async function confirmarAsignacionMesaA07() {
  if (!mesaSeleccionadaA07 || typeof asignarMesaCuentaA07 !== "function") return;
  …
}
```

Esa guarda **devuelve sin efectos y sin mensaje**. Es lo que convierte un cable
sin conectar en un botón que miente.

## Por qué nadie lo había visto

`asignarMesaCuentaA07` entró con «A07.1 materialize real floor integration» y
`moverMesaCuentaA07` con «A07.2 materialize move and reassignment». La segunda
se acordó de exportarse; la primera no. Y **ningún contrato cubre la
asignación**, así que la puerta de CI pasa en verde con el cable suelto.

Encaja con el otro hallazgo de este trabajo: de los 87 flujos cuyos contratos
leen el paquete, 37 no se disparan cuando el paquete cambia.

## El arreglo

Una palabra: añadir `asignarMesaCuentaA07` al objeto que devuelve
`crearLogicaVenta`. **No se ha aplicado**: es un cambio de comportamiento del
producto, no de presentación, y este PR es de presentación.

Si se aplica, conviene acompañarlo de dos cosas:

1. Un contrato que fije que todo manejador que `VentaRapida` declara llega como
   función. La guarda silenciosa seguirá ahí, pero ya no podrá esconder nada.
2. Cambiar la guarda para que, si el manejador falta, lo diga en pantalla en vez
   de callarse. Un `return` mudo en un botón habilitado es el defecto detrás del
   defecto.

## Lo que arrastra

| | |
|---|---|
| `tpv-06` Asignar mesa y comensales | se abre y se mide, pero **no opera** |
| `tpv-07` Trasladar cuenta | **no se puede alcanzar** |

El panel de traslado solo existe cuando la cuenta ya tiene mesa —son las dos
ramas del mismo bloque, según haya ubicación o no—, y sin asignación nunca la
tiene. Dos de las 61 vistas del punto 1 dependen de esa palabra.
