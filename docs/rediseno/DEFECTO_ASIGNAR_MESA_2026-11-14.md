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

## El arreglo, ya aplicado

`asignarMesaCuentaA07` entra en el objeto que devuelve `crearLogicaVenta`, que
pasa de 48 nombres a 49. Un cambio de 22 caracteres, con el mismo texto en las
dos copias de la fuente y paridad de cuerpo exacta.

Queda pendiente, y no se ha hecho aquí, lo que evitaría la próxima vez:

1. Un contrato que fije que todo manejador que `VentaRapida` declara llega como
   función. Exige registrarlo en el manifiesto y subir los conteos de la puerta,
   así que es un cambio con su propio alcance.
2. Cambiar la guarda para que, si el manejador falta, lo diga en pantalla en vez
   de callarse. **Un `return` mudo en un botón habilitado es el defecto detrás
   del defecto**, y sigue ahí para los demás manejadores.

## Lo que arrastra

| | Antes del arreglo | Después |
|---|---|---|
| `tpv-06` Asignar mesa y comensales | se abría y se medía, pero **no operaba** | pendiente de comprobar en QA |
| `tpv-07` Trasladar cuenta | **no se podía alcanzar** | pendiente de comprobar en QA |

El panel de traslado solo existe cuando la cuenta ya tiene mesa —son las dos
ramas del mismo bloque, según haya ubicación o no—, y sin asignación nunca la
tiene. Dos de las 61 vistas del punto 1 dependían de esa palabra.

**No está verificado en QA todavía.** El arreglo pasa las dos comprobaciones de
la fuente —sintaxis y paridad de cuerpo exacta—, pero que la mesa pase a
«Ocupada» al pulsar, y que entonces aparezca «Trasladar a …» con su motivo, hay
que verlo en el preview con sesión. Hasta entonces esto es un arreglo creído, no
un arreglo comprobado.
