# Pasada de accesibilidad y tacto sobre la aplicación entera

13 de noviembre de 2026. QA, preview del PR #225.

El plan pide objetivo 44 × 44 px en los controles operativos, tablas que se
conviertan en fichas con su etiqueta cuando el ancho no da para comparar
columnas, y un nombre accesible en cada campo. Son tres requisitos que afectan a
las 267 vistas.

## La decisión de método

Al medir el programa quedó claro que hacerlo pantalla por pantalla dentro del
paquete era el camino caro y frágil: el paquete son 6,3 MB y la única vía
certificada es editar las **dos** copias con texto idéntico, con el riesgo de
ancla que ya se documentó (un ancla de texto razonable llegó a coincidir 33
veces).

Así que estos tres requisitos se resuelven en **capas genéricas** que leen la
interfaz real y no tocan el paquete:

| Capa | Qué hace | Archivo |
|---|---|---|
| Tablas a fichas | Copia el texto real de cada `<th>` en `data-etiqueta` de su celda; marca la tabla y exceptúa las filas con celdas combinadas | `la-tablas-fichas.js` |
| Nombre por marcador | Copia `placeholder` a `aria-label` **solo** cuando el campo no tiene ya nombre | `la-tablas-fichas.js` |
| Fichas | Reglas a ≤ 760 px: cabecera oculta y celda con su etiqueta. Cuelga del ancho porque habla de sitio para comparar columnas | `la-apariencia.css` |
| Tacto | `min-height`/`min-width` de 44 px en botones y campos, con la puerta en el **puntero**, no en el ancho: `(max-width: 760px), (any-pointer: coarse)`. Más el margen de desplazamiento del teclado del teléfono, que sigue colgado del ancho | `la-apariencia.css` |

Las etiquetas salen del propio `<th>`, así que **no pueden mentir**: si una
pantalla cambia de columnas, sus fichas cambian con ella. Ninguna de las dos
capas altera contenido, orden, filas ni manejadores.

Lo que una capa genérica **no** puede arreglar es un campo que no tiene ni
marcador de posición. Eso exige una etiqueta de verdad y se corrige en su
pantalla. Se decidió deliberadamente no inventar nombres.

## Lo medido en QA

| | Antes | Después |
|---|---|---|
| Botones por debajo de 44 px (390 px de ancho) | **82** | **0** |
| Campos sin nombre accesible | **7** | **0** |
| Tabla de kardex en modo ficha | no | sí, con sus etiquetas |
| Alta de producto, 23 campos | ninguno por debajo de 44 px | igual |
| Tres modales de producto | sin controles pequeños | igual |

De los 7 campos sin nombre, **3** los resolvió la capa genérica porque tenían
marcador de posición. Los **4** restantes son los filtros del historial de
ventas del TPV (`renderHistorialVentas`): forma de pago, estado de la venta y el
intervalo de fechas. No llevan marcador, así que se han etiquetado en su sitio,
con `aria-label` y el mismo texto en las dos copias de la fuente:

- «Forma de pago»
- «Estado de la venta»
- «Desde la fecha»
- «Hasta la fecha»

No cambia el estado, ni los manejadores, ni lo que ve el usuario.
`PARIDAD_CUERPO_EXACTA=1`, `SOURCE_RECOVERY_CHECK=PASS`.

## Reverificado en el preview

`cb8ab07b`, sesión real de Propietario en QA-EMP-A / QA-A1, con el historial de
ventas a la vista. El paquete servido son 6.311.354 bytes y lleva las cuatro
etiquetas. Medido con la misma comprobación que las encontró:

| | 390 px | 1440 px |
|---|---|---|
| Campos visibles | 6 | 6 |
| **Sin nombre accesible** | **0** | **0** |
| Campos por debajo de 44 px | 0 | 0 |
| Botones visibles | 142 | 193 |
| Botones por debajo de 44 × 44 | **0** | 68 |
| Desbordamiento horizontal | no | no |

Dos de los seis nombres los pone la capa genérica desde su marcador; los cuatro
de los filtros vienen ya de la fuente. Evidencia en
`docs/rediseno/medicion-etiquetas-tpv-qa-2026-11-13.json`.

### Los 68 controles cortos del escritorio: la puerta estaba mal puesta

Los **68** controles cortos a 1440 px parecían pedir una de dos respuestas:
dejar el escritorio como está o subirlo todo a 44. Las dos son peores que la
tercera, porque la pregunta estaba mal planteada: **el umbral no es el ancho de
la ventana, es con qué se toca la pantalla.**

Lo que decía cada vara de medir:

- **WCAG 2.2 AA**, criterio 2.5.8 «Target Size (Minimum)», pide 24 × 24 px. A
  1440 px con ratón hay **0 controles por debajo de 24 × 24**: se cumple.
- **44 × 44** es el criterio 2.5.5, de nivel **AAA**, y nació para el dedo.

Subir el escritorio a 44 habría apretado pantallas densas sin que nadie lo
pidiera: el menú de 40 a 44 y los distintivos de cabecera de 24 a 44. Pero
dejarlo en el ancho tapaba **un agujero de verdad, y del lado contrario**: este
programa se usa en **terminales de barra con pantalla táctil**, que a 1024 o
1280 px nunca entraban en `max-width: 760px` y se quedaban con distintivos de
24 px para pulsar con el dedo. Eso sí es un riesgo operativo, y no se veía
porque la medición se había hecho en móvil estrecho y en escritorio con ratón,
nunca en el caso real del producto.

Así que la puerta pasa a ser el puntero, y solo en las dos reglas que hablan de
tamaño del objetivo:

```css
@media (max-width: 760px), (any-pointer: coarse) { … }
```

`any-pointer: coarse` significa «esta máquina tiene algún puntero grueso»,
aunque además tenga ratón: es lo que describe un terminal táctil con ratón
conectado, mientras que `pointer: coarse` mira solo el principal y se lo
perdería. En un portátil con pantalla táctil también se activa; en un producto
de hostelería, ese lado del error es el bueno. El programa ya usaba consultas de
puntero —`(pointer: fine)` en dos bloques—, así que no se introduce nada nuevo.

**Dos reglas se quedan colgadas del ancho, a propósito:**

- La **conversión de tabla a fichas**, porque habla de sitio para comparar
  columnas, no de dedos. Un terminal táctil ancho debe seguir viendo su tabla.
- El **margen de desplazamiento** de 96 px, porque habla del teclado en pantalla
  del teléfono. En un terminal apoyado en el mostrador no hay teclado que tape
  nada y reservarle 96 px sería mover el foco sin motivo.

#### Comprobado

| Escenario | `any-pointer: coarse` | Chips | Regla |
|---|---|---|---|
| 1440 px, ratón | no | 27 px | apagada, densidad intacta |
| 768 px, ratón | no | 27 px | apagada |
| 375 px, táctil | sí | 44 px | encendida |

El caso que importa —pantalla ancha **y** táctil— no se puede emular en este
panel: al pasar de 768 px se pierde la emulación táctil (`maxTouchPoints` cae a
0). Así que se probó el mecanismo aislando el segundo brazo del OR: a 1280 px con
ratón se cambió `any-pointer: coarse` por `any-pointer: fine` sobre la hoja viva.
Los chips subieron de 27 a 44 y al restaurar la condición volvieron a 27. El
brazo de puntero se evalúa y se aplica en ancho grande, que es lo que hacía falta
demostrar.

Sin regresión a 375 px: la tabla sigue en modo ficha con sus seis etiquetas
sacadas del `<th>` real, cabecera oculta, 0 chips por debajo de 44, 7 campos
ninguno por debajo de 44, margen de foco en 96 px y sin desbordamiento.

## Lo que queda
- Medir el modal «Eliminar producto» y el aviso «Ojo: has cambiado el contenido
  del envase», que no entraron en la pasada.
- Recorrido con lector de pantalla. La medición automática comprueba que el
  nombre **existe**; no comprueba que se anuncie en el orden útil.
- El resto de pantallas que aún no se han abierto en QA: la medición de tamaños
  hay que hacerla en **cada** pantalla, no al final. Es la lección del piloto de
  la pantalla de acceso, donde dos enlaces operativos quedaron a 17 px.
