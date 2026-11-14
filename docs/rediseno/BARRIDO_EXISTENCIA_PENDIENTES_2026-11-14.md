# Barrido de existencia sobre las pendientes: un resultado negativo que ahorra trabajo

14 de noviembre de 2026. Al preparar el bloque 3 salió un indicador prometedor:
las cinco vistas no construidas de Organización citaban «Plan maestro» o
«Informe de estado» en su referencia y no un componente, igual que `inv-35` e
`inv-36`. Si la referencia no nombra código, probablemente no hay código.

Pareció que eso podía resolver muchas filas sin gastar sesión. **No es así, y
conviene dejarlo escrito para que nadie lo intente otra vez.**

## Lo que se midió

Las 119 pendientes, una por una, cogiendo el componente o archivo que nombra su
referencia y buscándolo en `fuente.js`, en las capas de apariencia, en
`plataforma-panel.js` y en el árbol.

| | |
|---|---|
| Pendientes examinadas | 119 |
| Cuya referencia **no** nombra código | **1** |
| Cuyo componente o archivo **existe** | **117** |
| Resueltas por este barrido | **2** |

La veta estaba agotada. De las 119, solo `acc-03` no nombra un componente, y lo
que nombra es `restablecer-contrasena.html`, que existe. Las demás apuntan a
código que está ahí.

**Es un resultado negativo, y es útil:** significa que la matriz es fiel en esta
columna y que **no queda nada más que descartar por existencia sin entrar en
QA**. Las 117 restantes están construidas; lo que les falta es medirlas, y eso
pide sesión. Dicho de otro modo: a partir de aquí, el trabajo en frío sobre la
matriz se ha terminado y lo que queda es trabajo de sesión.

## Las dos que sí resolvió

`sis-14` «Índice de revisión» y `sis-15` «Comparar y reiniciar demostración»,
y no por lo que esperaba. No son pantallas del producto que falten: son **el
andamio de la maqueta**. Las tres señales coinciden:

- `Origen` = **Propuesta**, no Código. Solo tres filas de las 267 lo son, y la
  tercera, `org-37`, ya está cerrada.
- `Referencia` = «Diseño de la maqueta».
- `Ubicación` = «Barra de demostración», que no existe en ninguna parte:
  «demostración» aparece **cero** veces en `fuente.js`, cero en las capas de
  apariencia y cero en el panel de plataforma.

Y un detalle de paso: la columna «Ruta local de demo Pase» apunta a
`prototipo/dist/index.html`, y **`prototipo/` no está en este repositorio**. Esa
columna es una referencia al prototipo original, no algo comprobable aquí.

Quedan marcadas «No construida», que es el valor que ya lleva aparejada la
decisión correcta —entra en el alcance o se retira—, pero con el motivo escrito
en su estado funcional, porque llamar «no construida» a la barra de
demostración de una maqueta, sin más, daría a entender que al producto le falta
algo que nunca iba a tener.

No he añadido un valor nuevo para estas dos. Hoy ya añadí uno —«Bloqueada por
acceso», para las diez de Plataforma— y ese hacía falta de verdad; dos
vocabularios nuevos en un día para dos filas es peor que una nota bien escrita.

## Cómo queda la matriz

| | |
|---|---|
| Pasa | 113 |
| Pasa (vacío con los datos actuales) | 6 |
| Pasa en preview | 2 |
| No construida | 19 |
| Bloqueada por acceso | 10 |
| Pendiente | **117** |

117 vistas construidas esperando sesión, y ninguna de ellas descartable desde
aquí.
