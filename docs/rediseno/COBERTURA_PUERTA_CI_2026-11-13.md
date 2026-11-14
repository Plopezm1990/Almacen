# Los filtros de rutas de la puerta: lo que no se dispara no protege

13 de noviembre de 2026. Esto no estaba en el plan del rediseño. Salió de
investigar por qué `p2-p06` se puso en rojo en el PR #225, y conviene que quede
escrito porque afecta a la puerta, no a la apariencia.

## La regla

Todo archivo que un contrato **lee** tiene que estar en el filtro `paths:` del
flujo que lo ejecuta. Si falta, el contrato solo se dispara cuando el PR toca
por casualidad algún otro archivo de la lista. Deja de ser un contrato y pasa a
ser una lotería.

## El caso que lo destapó

El contrato `p2-p06` hace **seis aserciones** sobre `edge-auth-patch.js`, que es
donde viven los guardas de lectura y escritura por rol. Ese archivo **no estaba**
en su filtro.

El PR #220 cambió exactamente esas líneas: convirtió

```js
if (rol === "Propietario") return getOriginal(key, shared);
```

en un bloque que antes de devolver pasa `empleados` por
`empleadosPropietarioSinSecretos`, que borra el PIN. Un endurecimiento correcto.
El contrato no se enteró, siguió exigiendo la forma vieja y salió en rojo
semanas después, en una rama que sí tocaba `index.html`.

Dos consecuencias, y la segunda es la grave:

1. Un cambio en la capa de autoridad de servidor pasó sin su contrato.
2. El contrato quedó desalineado y, cuando por fin se disparó, lo hizo contra
   trabajo ajeno, en una rama que no lo había provocado.

Arreglado en dos pasos: el contrato ahora fija la forma endurecida y, además,
el filtro de `p2-p06` incluye los dos archivos que leía a ciegas,
`edge-auth-patch.js` e `index-storage-bootstrap.js`.

## El barrido

Con la regla escrita, se puede medir. `docs/rediseno/auditar-filtros-de-rutas.mjs`
lo hace sin dependencias y sin escribir nada:

```bash
node docs/rediseno/auditar-filtros-de-rutas.mjs --detalle
```

| | |
|---|---|
| Flujos con filtro de rutas | **205** |
| Flujos sin filtro, que corren siempre | **40** |
| Flujos con **algún** archivo leído fuera de su filtro | **64** |
| Flujos cuyo contrato lee el paquete (`fuente.js` o la copia legible) | **87** |
| De esos, **ciegos al paquete** | **37** |

No todos los 64 son igual de serios. Un contrato que lee su propio documento de
evidencia no necesita volver a correr porque cambie ese documento. Hay que
mirarlos uno a uno, y por eso no se ha tocado ninguno más.

Los **37 ciegos al paquete** sí importan, y le importan directamente a este
trabajo: **el rediseño edita `fuente.js`**. Un PR que solo tocara el paquete se
saltaría 37 contratos que hacen aserciones sobre el paquete.

Es la razón de fondo por la que en este rediseño la batería local de 304
contratos, que corre todos sin mirar rutas, ha pesado más que la puerta remota.
No es desconfianza: es que la puerta remota, por construcción, no corre lo que
su filtro no nombra.

## Lo que no se ha hecho, y por qué

Cerrar los 37 no se ha metido aquí. Cambiaría el comportamiento de la puerta en
**todos** los PR futuros, exige criterio flujo por flujo, y es más que probable
que despierte contratos que llevan meses dormidos y salgan en rojo por cosas
que no tienen nada que ver con la apariencia. Eso es trabajo con su propio
triaje, y meterlo en el PR del rediseño convertiría un cambio de presentación en
una reforma de la puerta.

Queda medido, reproducible con un comando, y con el caso de `p2-p06` ya cerrado
como ejemplo de cómo se arregla uno.
