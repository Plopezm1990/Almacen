# Ocho flujos que decían ejecutar nueve contratos y ejecutaban cuatro

14 de noviembre de 2026. Salió de tirar del hilo de los 37 flujos ciegos al
paquete, y resultó ser otra cosa, más concreta y más fácil de arreglar.

## Primero, una corrección de mi propio diagnóstico

Escribí que 37 flujos no se disparan cuando cambia `fuente.js` y que eso dejaba
el rediseño sin red. Medido en detalle, **el riesgo era menor de lo que dije**:

- Esos 37 flujos ejecutan **62 rutas de contrato** distintas.
- **55 existen** en el árbol, y **las 55 están en el manifiesto**, así que la
  batería local de 304 las corre en cada tanda. En esta rama se han ejecutado
  siempre, y pasan.

Es decir: el hueco es de **CI**, no de cobertura real, porque la batería local
no mira filtros de rutas. Por eso llevo corriéndola en cada confirmación que
toca el paquete. Conviene decirlo así y no más grande de lo que es.

## Lo que sí era un defecto

Las otras **7 rutas no existen**. Y no es que falten los contratos: es que
**cambiaron de nombre** del español al inglés y las referencias se quedaron
atrás.

Aparecen en un paso llamado «Regresiones heredadas disponibles», que vive en
**8 flujos** y está escrito así:

```bash
for f in \
  tests/pm09/p17-robustez-contract.mjs \
  …
  tests/pm09/la008-unidades-rotacion-margen-contract.mjs; do
  if [ -f "$f" ]; then node "$f"; fi
done
```

El `if [ -f "$f" ]` es el problema. **Convierte una referencia rota en un salto
silencioso**: el fichero no está, no se ejecuta, y el paso termina en verde.

De los nueve contratos que el paso dice ejecutar, **se ejecutaban cuatro**. Los
otros cinco llevaban sin correr desde que se renombraron, en ocho flujos a la
vez, sin que nada lo dijera.

Es el mismo patrón que el `return` mudo de la asignación de mesa: **una guarda
que convierte lo que falta en un aprobado.**

## El arreglo

Cinco nombres corregidos en los ocho flujos:

| Decía | Es |
|---|---|
| `la007-resultados-contract.mjs` | `la007-results-contract.mjs` |
| `la008-unidades-rotacion-margen-contract.mjs` | `la008-rotation-margin-contract.mjs` |
| `p15-casos-economicos-contract.mjs` | `p15-special-economic-contract.mjs` |
| `p16-aislamiento-contexto-contract.mjs` | `p16-isolation-context-contract.mjs` |
| `p17-robustez-contract.mjs` | `p17-robustness-contract.mjs` |

Y dos entradas retiradas, `p13-rotacion-unidades-contract.mjs` y
`p14-escenario-maestro-contract.mjs`, que estaban en tres de los flujos: **no
existen con ningún nombre**. Listar un contrato que no existe, bajo una guarda
que lo salta en silencio, es peor que no listarlo.

### Comprobado antes de tocar nada

Los nueve contratos pasan en esta rama, ejecutados uno a uno:
`PM09_LA007_CONTRACT_OK=1`, `PM09_LA008_CONTRACT_OK=1`,
`PM09_P15_SPECIAL_ECONOMIC_CONTRACT_OK=1`,
`PM09_P16_ISOLATION_CONTEXT_CONTRACT_OK=1`,
`PM09_P17_ROBUSTNESS_CONTRACT_OK=1`, y los cuatro que ya corrían. Así que
corregir los nombres no pone nada en rojo: pone a correr lo que debía correr.

### Y después

Simulado el bucle corregido tal cual queda en el flujo: **ejecutados 9, fallos
0**. Antes eran 4 de 9.

## Lo que queda por decidir, y no he tocado

El `if [ -f "$f" ]` sigue ahí. Ahora no esconde nada, porque las nueve rutas
existen, pero volverá a esconderlo el día que alguien renombre otro contrato.
Lo honesto sería que el paso **falle** si un fichero de su lista no está, en vez
de saltárselo. Es una línea:

```bash
if [ -f "$f" ]; then node "$f"; else echo "FALTA $f" >&2; exit 1; fi
```

No lo he aplicado porque cambia el comportamiento de la puerta en ocho flujos y
eso es decisión de quien la lleva. Pero es el arreglo que impide que esto
vuelva a pasar, y el de los nombres sin este solo cura el síntoma.
