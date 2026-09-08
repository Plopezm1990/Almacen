# PM15 P04 — NR-08 (ampliación): proteger borradores al cambiar de pestaña

Cuarto punto de PM15. Resuelve el pendiente explícito registrado en P01: "cualquier
formulario a medio rellenar se pierde sin aviso al cambiar de pestaña", más amplio que el
escenario literal de NR-08 (guardar contra un empresa/local equivocado) ya cerrado en P01.

## Problema (ya diagnosticado en P01, resuelto aquí por decisión expresa del usuario)

`Encargos`, `Clientes`, `Personal` y `Locales` se renderizan con el idioma
`tab === "X" && <Componente/>`: al cambiar de pestaña, React desmonta el componente y su
`useState` local desaparece sin ningún aviso. Un formulario abierto (encargo, cliente,
empleado o local a medio rellenar) se pierde en silencio con un solo clic accidental en
otra pestaña.

## Diseño (deliberadamente simple, documentado)

**"Borrador abierto" = el formulario está visible** (`showForm`/`mostrarForm === true`), no
un análisis campo por campo de si el usuario ya escribió algo. Se prefiere este criterio
simple porque:

- Nunca hay falsos negativos: un formulario abierto siempre queda protegido.
- El único coste es una confirmación de más si alguien abre un formulario vacío y navega
  sin escribir nada — un coste aceptable frente al riesgo de perder datos reales sin avisar.
- Es consistente con cómo ya se comportan muchas aplicaciones (la protección salta al abrir
  el formulario, no solo cuando se detecta contenido "real").

## Mecanismo

- **`decidirCambioTabPM15(formularioAbierto, confirmar)`** (función pura, nueva): sin
  borrador abierto, permite el cambio sin preguntar nunca; con borrador abierto, pregunta
  (vía la función `confirmar` que se le pasa) y solo permite el cambio si la respuesta es
  afirmativa.
- **`formularioAbiertoPM15Ref`** (ref mutable en el componente raíz) + **prop
  `marcarFormularioAbiertoPM15`**: cada uno de los 4 componentes con formulario
  (`Encargos`, `Clientes`, `Personal`, `Locales`) reporta su propio `showForm`/`mostrarForm`
  real vía un `useEffect`, sin inventar ni un componente adicional de estado global.
- **`cambiarTabPM15(nuevaTab)`**: sustituye el `setTab` crudo en todas las superficies de
  navegación reales de usuario — barra lateral (`SidebarGrupos`), barra superior y
  navegación inferior del diseño C (`TopBarC`, `BottomNavC`), buscador global
  (`BusquedaGlobal`) y las tarjetas resumen del Dashboard. Antes de cambiar de pestaña,
  consulta `decidirCambioTabPM15` con `window.confirm` como mecanismo de pregunta
  (consistente con el resto de confirmaciones ya existentes en la app).

## Lo que **no** se ha tocado (deliberado)

La navegación **programática** que ocurre dentro de la lógica de negocio tras un guardado
con éxito (p.ej. redirigir a "albaranes" después de crear un albarán, o a "pagos" tras
registrar un pago) sigue usando el `setTab` crudo, sin pasar por la confirmación —
interrumpir con un diálogo una acción que el usuario ya completó con éxito sería un error
de UX, no una protección. Verificado con test que ese `setTab` crudo sigue intacto.

Tampoco se ha tocado ningún otro formulario de la app fuera de los 4 ya auditados en MEJ-01
(Encargos, Clientes, Personal, Locales) — ampliar la protección a todos los formularios
existentes es una tarea mayor, fuera del alcance mínimo de este punto.

## Archivos

- `fuente.js`: `decidirCambioTabPM15` (función pura), `formularioAbiertoPM15Ref`,
  `marcarFormularioAbiertoPM15`, `cambiarTabPM15`; nueva prop y `useEffect` en Encargos,
  Clientes, Personal y Locales; `SidebarGrupos`, `TopBarC`, `BottomNavC`, `BusquedaGlobal` y
  `Dashboard` reciben `cambiarTabPM15` en vez del `setTab` crudo.
- `tests/pm15/p04-nr08-proteccion-borrador-navegacion-contract.mjs` (nuevo): la función pura
  (sin borrador nunca pregunta; con borrador, confirma permite y cancela bloquea), los 4
  componentes reportan su propio estado real, la composición pasa la prop real a los 4, las
  superficies de navegación de usuario usan la versión protegida, y la navegación
  programática tras guardar sigue sin interrumpirse.

## Regresión

Suite completa: `tests/g1`, `tests/pm04`, `tests/pm05`, `tests/pm07`, `tests/pm08`,
`tests/pm09`, `tests/pm10`, `tests/pm11-compra`, `tests/pm12`, `tests/pm13`, `tests/pm14`,
`tests/pm15` (P01, P02, P03, P04) — sin regresiones.

## Estado de main/producción

`main` = `767a2c3163f924b7599338785fe4331f78f0e1ac`, sin tocar directamente — este trabajo
vive en `claude/pm15-contexto-borradores-errores`. Sin migraciones nuevas (cambio de
frontend puro). `L&A Suite` (producción) y `TPV` no se han tocado.

## Estado de PM15

P01 (LA-022 + NR-08 alcance literal), P02 (MEJ-01), P03 (MEJ-02) y P04 (NR-08 ampliación) —
cerrados con gate verde. No quedan pendientes explícitos abiertos de esta sesión de trabajo
sobre PM15.
