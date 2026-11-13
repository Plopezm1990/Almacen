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
| Fichas y tacto | Reglas a ≤ 760 px: cabecera oculta, celda con su etiqueta, `min-height`/`min-width` de 44 px en botones y campos, y margen de desplazamiento para que la barra fija no tape el campo con el foco | `la-apariencia.css` |

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

## Lo que queda

- Reverificar los cuatro nombres en el preview una vez publicado, con la misma
  medición que los encontró.
- Medir el modal «Eliminar producto» y el aviso «Ojo: has cambiado el contenido
  del envase», que no entraron en la pasada.
- Recorrido con lector de pantalla. La medición automática comprueba que el
  nombre **existe**; no comprueba que se anuncie en el orden útil.
- El resto de pantallas que aún no se han abierto en QA: la medición de tamaños
  hay que hacerla en **cada** pantalla, no al final. Es la lección del piloto de
  la pantalla de acceso, donde dos enlaces operativos quedaron a 17 px.
