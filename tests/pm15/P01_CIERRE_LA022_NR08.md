# PM15 P01 — LA-022 (Locales) + NR-08 (alcance literal)

Primer punto de PM15 (Contexto, borradores y errores). Cubre LA-022 con un arreglo real y
documenta con prueba el alcance literal de NR-08 acordado con el usuario.

## LA-022 — bug real encontrado y corregido

**Síntoma descrito en el plan:** "Nombre de local vacío no culpa a una empresa ya elegida."

**Causa raíz (inspección de código):** en el componente `Locales`, el `<select>` de empresa
se renderiza con `value={empresaNuevaId || empresaPrincipalId || ""}` — por tanto **siempre**
muestra visualmente una empresa ya seleccionada en cuanto existe alguna, sin que el usuario
tenga que tocarlo. Pero el destino real que se enviaba al crear el local se calculaba con
`empresaNuevaId || (empresas.length === 1 ? empresaPrincipalId : "")`: con **2 o más
empresas** y el desplegable sin tocar, ese cálculo daba `""` aunque la UI mostrara una
empresa elegida, y el usuario recibía "Selecciona la empresa a la que pertenece el local"
en vez de "Ponle un nombre al local" — exactamente el síntoma de LA-022.

**Arreglo (una línea, cambio mínimo):** nueva función pura `empresaDestinoParaNuevoLocalPM15`
que alinea el valor realmente usado con el que ya se muestra en el `<select>`, sin depender
de cuántas empresas existan:

```js
function empresaDestinoParaNuevoLocalPM15(empresaNuevaId, empresaPrincipalId) {
  return empresaNuevaId || empresaPrincipalId || "";
}
```

No se ha tocado `crearLocal` (su orden de validación — empresa antes que nombre — ya era
correcto; el problema estaba en qué se le pasaba como `empresaId`, no en cómo lo validaba).

## NR-08 — alcance literal, con prueba, sin cerrar el problema global

Por decisión explícita del usuario: este punto **solo** cubre el escenario literal del plan
(guardar contra un contexto empresa/local equivocado por un cambio en segundo plano), y lo
demuestra en vez de darlo por hecho.

**Lo que se demuestra (inspección estática, no simulación):**
1. `Encargos` y `Clientes` se renderizan con el idioma estándar de React
   `tab === "X" && <Componente .../>`. Cuando `tab` cambia, la expresión pasa a `false` y
   React desmonta el componente en esa posición — su estado (`useState` del formulario) se
   destruye. Es semántica de reconciliación de React, no una suposición.
2. El único disparador real de cambio de local (`cambiarLocalActivo` /
   `cambiarLocalActivoConVista`, alcanzable vía `SelectorLocalInformes` o el botón "Usar
   este" de `Locales`) **no existe** dentro de las ramas `tab === "encargos"` ni
   `tab === "clientes"` — solo en dashboard/resultados/libroiva/venta y en la propia
   pestaña "Locales".

**Consecuencia:** para cambiar de local mientras se está en Encargos o Clientes, hay que
salir de esa pestaña primero, lo que ya desmonta cualquier formulario abierto. El escenario
de "guardar contra el contexto nuevo" no es alcanzable con la arquitectura de navegación
actual: no hay forma de tener el formulario abierto y cambiar el contexto sin destruir el
formulario primero.

### Pendiente explícito para PM15 (no resuelto aquí, por instrucción expresa del usuario)

Esa misma investigación revela un problema **real y más amplio** que NO se cierra en este
punto: **cualquier formulario a medio rellenar se pierde sin ningún aviso al cambiar de
pestaña** (no solo al cambiar de empresa/local — cualquier navegación lo desmonta). Es un
problema transversal (afecta potencialmente a todos los formularios de la app, no solo
Encargos/Clientes) y su corrección requiere una decisión de diseño (¿avisar? ¿bloquear la
navegación? ¿autoguardar como borrador?) antes de tocar código. Queda registrado aquí como
pendiente explícito de PM15, no oculto ni resuelto por omisión.

## Archivos

- `fuente.js`: nueva función pura `empresaDestinoParaNuevoLocalPM15`; `Locales.enviar()`
  actualizado para usarla.
- `tests/pm15/p01-la022-locales-empresa-contract.mjs` (nuevo): positivo (selección
  explícita gana), el bug real reproducido y corregido (sin tocar el selector, 2+ empresas,
  usa la que ya se mostraba), negativo (sin empresas sigue vacío), y prueba de extremo a
  extremo de que el error habla del nombre, nunca de la empresa ya elegida.
- `tests/pm15/p01-nr08-cambio-contexto-no-alcanzable-contract.mjs` (nuevo): prueba estática
  de que el escenario literal de NR-08 no es alcanzable, sin cerrar el problema general de
  pérdida de borradores.

## Regresión

Suite completa: `tests/g1`, `tests/pm04`, `tests/pm05`, `tests/pm07`, `tests/pm08`,
`tests/pm09`, `tests/pm10`, `tests/pm11-compra`, `tests/pm12`, `tests/pm13`, `tests/pm14`,
`tests/pm15` — sin regresiones.

## Estado de main/producción

`main` = `767a2c3163f924b7599338785fe4331f78f0e1ac` (release L&A Suite consolidado hasta
PM14), sin tocar directamente — este trabajo vive en la rama
`claude/pm15-contexto-borradores-errores`. Sin migraciones nuevas (cambio de frontend puro).
`L&A Suite` (producción) y `TPV` no se han tocado.

## Siguiente en PM15

MEJ-01 (empresa/local inequívocos también en modales y acciones sensibles) — orden acordado
con el usuario: LA-022 primero (este punto), MEJ-01 después.
